const express = require('express');
const cors = require('cors');
const path = require('path');
const fse = require('fs-extra');
const multiparty = require('multiparty');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 导入数据库连接和模型
const connectDB = require('./config/db');
const User = require('./models/User');
const File = require('./models/File');

// JWT 密钥（建议放到环境变量中）
const JWT_SECRET = 'your-secret-key-here-change-in-production';
const JWT_EXPIRE = '7d'; // Token有效期7天
const Folder = require('./models/Folder');
const app = express();

// 连接数据库
connectDB();

// 1. 配置跨域：允许前端 Vite 项目访问
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 2. 用户隔离的文件目录配置
const getTargetDir = (userId) => path.resolve(__dirname, 'target', userId);
const getUploadDir = (userId) => path.resolve(__dirname, 'uploads', userId);

// 确保用户目录存在
const ensureUserDirs = (userId) => {
  const targetDir = getTargetDir(userId);
  const uploadDir = getUploadDir(userId);
  if (!fse.existsSync(targetDir)) fse.mkdirsSync(targetDir);
  if (!fse.existsSync(uploadDir)) fse.mkdirsSync(uploadDir);
  return { targetDir, uploadDir };
};
// // 3. 探活接口：测试前后端是否连通

// 4. 启动服务
const PORT = 3000;
// JWT验证中间件
const auth = (req, res, next) => {
  // 从请求头获取Token
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ code: 401, msg: '未授权，请先登录' });
  }

  try {
    // 验证Token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 将用户信息挂载到req对象
    next();
  } catch (error) {
    res.status(401).json({ code: 401, msg: 'Token无效或已过期' });
  }
};

// 注册接口
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查用户是否已存在
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ code: 400, msg: '用户名已存在' });
    }

    // 创建新用户
    user = new User({ username, password });
    await user.save();

    res.json({ code: 200, msg: '注册成功' });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// 登录接口
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查用户是否存在
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ code: 400, msg: '用户名或密码错误' });
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ code: 400, msg: '用户名或密码错误' });
    }

    // 生成JWT Token
    const payload = {
      id: user.id,
      username: user.username
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    res.json({
      code: 200,
      msg: '登录成功',
      data: {
        token,
        username: user.username
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// 验证Token接口
app.get('/verify', auth, (req, res) => {
  res.json({
    code: 200,
    msg: 'Token有效',
    data: {
      username: req.user.username
    }
  });
});

// 动态文件预览接口（支持用户隔离）
app.get('/target/:fileName', auth, async (req, res) => {
  const { fileName } = req.params;
  const { targetDir } = ensureUserDirs(req.user.id);
  const filePath = path.resolve(targetDir, decodeURIComponent(fileName));

  try {
    if (!fse.existsSync(filePath)) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    const ext = path.extname(fileName).toLowerCase();
    const contentTypeMap = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain; charset=utf-8',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac'
    };

    const stat = fse.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // 如果有 Range 请求头，支持断点续传/流式传输
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fse.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentTypeMap[ext] || 'application/octet-stream',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // 正常请求，返回完整文件
      res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      const fileStream = fse.createReadStream(filePath);
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('预览失败：', error);
    res.status(500).json({ code: 500, msg: '预览失败' });
  }
});

app.listen(PORT, () => {
  console.log(`
    🚀  服务器已成功启动！
    📡  监听端口: ${PORT}
    🔗  探活地址: http://localhost:${PORT}/test
    📦  数据库: MongoDB
    `);
});


app.post('/upload', auth, (req, res) => {
  const form = new multiparty.Form();
  const { uploadDir } = ensureUserDirs(req.user.id);
  form.uploadDir = uploadDir;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ code: 500, msg: '上传失败' });
    }

    const [name] = fields.name;
    const [file] = files.file;
    const oldPath = file.path;
    const newPath = path.resolve(uploadDir, name);

    try {
      await fse.move(oldPath, newPath, { overwrite: true });
      console.log('收到并重命名分片:', name);
      res.json({ code: 200, msg: '分片上传并命名成功' });
    } catch (moveErr) {
      console.error('重命名失败:', moveErr);
      res.status(500).json({ code: 500, msg: '重命名失败' });
    }
  });
});

app.post('/merge', auth, async (req, res) => {
  try {
    const { fileName, folderId } = req.body;
    const { targetDir, uploadDir } = ensureUserDirs(req.user.id);
    const chunkDir = uploadDir;
    const targetPath = path.resolve(targetDir, fileName);

    const chunkPaths = await fse.readdir(chunkDir);
    chunkPaths.sort((a, b) => a.split('-').pop() - b.split('-').pop());

    await fse.writeFile(targetPath, "");

    for (const chunkPath of chunkPaths) {
      const fullChunkPath = path.resolve(chunkDir, chunkPath);
      const content = await fse.readFile(fullChunkPath);
      await fse.appendFile(targetPath, content);
    }

    await fse.emptyDir(chunkDir);

    // 保存文件记录到数据库
    const stats = await fse.stat(targetPath);
    await File.create({
      userId: req.user.id,
      fileName,
      filePath: targetPath,
      fileSize: stats.size,
      folderId: folderId || null
    });

    res.json({ code: 200, msg: '合并成功！' });
  } catch (error) {
    console.error("❌ 合并失败：", error);
    res.status(500).json({ code: 500, msg: '合并过程出错' });
  }
});

app.get('/files', auth, async (req, res) => {
  const { targetDir } = ensureUserDirs(req.user.id);
  const { folderId } = req.query;

  try {
    if (!fse.existsSync(targetDir)) {
      return res.json({ code: 200, data: [] });
    }

    // 从数据库查询文件，支持按文件夹筛选
    const query = { userId: req.user.id };
    if (folderId) {
      query.folderId = folderId;
    } else {
      query.folderId = null;
    }

    const dbFiles = await File.find(query);
    const fileList = await Promise.all(
      dbFiles.map(async (dbFile) => {
        const stats = await fse.stat(dbFile.filePath);
        return {
          id: dbFile._id.toString(),
          name: dbFile.fileName,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          time: stats.mtime.toLocaleString(),
          folderId: dbFile.folderId?.toString() || null
        };
      })
    );

    res.json({ code: 200, data: fileList });
  } catch (err) {
    console.error('获取文件列表失败:', err);
    res.status(500).json({ code: 500, msg: '获取列表失败' });
  }
});
// 下载接口
app.get('/download/:fileName', auth, async (req, res) => {
  const { fileName } = req.params;
  const { targetDir } = ensureUserDirs(req.user.id);
  const filePath = path.resolve(targetDir, fileName);

  try {
    if (!fse.existsSync(filePath)) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const fileStream = fse.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('下载失败：', error);
    res.status(500).json({ code: 500, msg: '下载失败' });
  }
});

// 下载接口
app.get('/download/:fileName', async (req, res) => {
  const { fileName } = req.params;
  const filePath = path.resolve(__dirname, 'target', fileName);

  try {
    // 检查文件是否存在
    if (!fse.existsSync(filePath)) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    // 设置响应头，触发浏览器下载
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // 创建文件流并发送
    const fileStream = fse.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('下载失败：', error);
    res.status(500).json({ code: 500, msg: '下载失败' });
  }
});

// 删除接口
app.delete('/delete/:fileName', auth, async (req, res) => {
  const { fileName } = req.params;
  const { targetDir } = ensureUserDirs(req.user.id);
  const targetPath = path.resolve(targetDir, fileName);

  try {
    if (fse.existsSync(targetPath)) {
      await fse.unlink(targetPath);
      await File.deleteOne({ userId: req.user.id, fileName });
      res.json({ code: 200, msg: '删除成功' });
    } else {
      res.status(404).json({ code: 404, msg: '文件不存在' });
    }
  } catch (error) {
    res.status(500).json({ code: 500, msg: '删除失败' });
  }
});
// 查询文件已上传的切片列表
app.get('/check-chunks/:fileName', auth, async (req, res) => {
  try {
    const { fileName } = req.params;
    const { uploadDir } = ensureUserDirs(req.user.id);

    if (!fse.existsSync(uploadDir)) {
      return res.json({ code: 200, data: [] });
    }

    const allFiles = await fse.readdir(uploadDir);
    const uploadedChunks = allFiles
      .filter(name => name.startsWith(fileName + '-'))
      .map(name => parseInt(name.split('-').pop() || '0'));

    res.json({ code: 200, data: uploadedChunks });
  } catch (error) {
    console.error("查询切片失败：", error);
    res.json({ code: 500, data: [] });
  }
});

// 1. 获取文件夹树
app.get('/folders', auth, async (req, res) => {
  try {
    const { parentId } = req.query;
    const query = { userId: req.user.id };

    // 如果有 parentId 参数，按父文件夹筛选
    if (parentId !== undefined) {
      query.parentId = parentId === 'null' ? null : parentId;
    }

    const folders = await Folder.find(query);

    // 如果没有 parentId 参数，返回树结构和所有文件
    if (parentId === undefined) {
      const files = await File.find({ userId: req.user.id });

      // 构建树结构
      const buildTree = (pid = null) => {
        const children = folders.filter(f => {
          if (pid === null) {
            return f.parentId === null || f.parentId === undefined;
          }
          return f.parentId?.toString() === pid.toString();
        });
        return children.map(folder => ({
          id: folder._id.toString(),
          name: folder.name,
          type: 'folder',
          children: buildTree(folder._id)
        }));
      };

      res.json({
        code: 200,
        data: {
          tree: buildTree(),
          files: files.map(f => ({
            id: f._id.toString(),
            name: f.fileName,
            size: f.fileSize,
            folderId: f.folderId?.toString() || null,
            createdAt: f.createdAt
          }))
        }
      });
    } else {
      // 如果有 parentId 参数，返回该目录下的文件夹列表
      res.json({
        code: 200,
        data: folders.map(folder => ({
          _id: folder._id.toString(),
          name: folder.name,
          parentId: folder.parentId?.toString() || null,
          createdAt: folder.createdAt
        }))
      });
    }
  } catch (error) {
    res.status(500).json({ code: 500, msg: '获取失败' });
  }
});

// 2. 创建文件夹
app.post('/folders', auth, async (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, msg: '请输入文件夹名称' });
    }

    const folder = await Folder.create({
      userId: req.user.id,
      name,
      parentId: parentId || null
    });

    res.json({ code: 200, msg: '创建成功', data: folder });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '创建失败' });
  }
});

// 3. 删除文件夹（递归删除子文件夹和文件）
app.delete('/folders/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // 递归删除所有子文件夹
    const deleteFolder = async (folderId) => {
      const subFolders = await Folder.find({ parentId: folderId });
      for (const sub of subFolders) {
        await deleteFolder(sub._id);
      }
      await Folder.deleteOne({ _id: folderId });
      await File.deleteMany({ folderId });
    };

    await deleteFolder(id);
    res.json({ code: 200, msg: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '删除失败' });
  }
});

// 4. 移动文件到文件夹
app.post('/files/move', auth, async (req, res) => {
  try {
    const { fileId, folderId } = req.body;

    await File.findByIdAndUpdate(fileId, { folderId: folderId || null });
    res.json({ code: 200, msg: '移动成功' });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '移动失败' });
  }
});

// 5. 获取文件夹树
function arrayToTree(arr, parentId = null) {
  const branch = [];
  arr.forEach(node => {
    if (String(node.parentId) === String(parentId)) {
      const children = arrayToTree(arr, node._id);
      if (children.length > 0) {
        node.children = children;
      }
      branch.push(node);
    }
  });
  return branch;
}

app.get('/api/folders/tree', auth, async (req, res) => {
  try {
    const allFolders = await Folder.find({ userId: req.user.id }).lean();
    const tree = arrayToTree(allFolders, null);
    res.json({ code: 200, data: tree });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// 6. 移动文件夹
async function isDescendant(sourceId, targetId) {
  if (!targetId) return false;

  const target = await Folder.findById(targetId);
  if (!target || !target.parentId) return false;

  if (String(target.parentId) === String(sourceId)) return true;

  return isDescendant(sourceId, target.parentId);
}

app.patch('/api/folders/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    const isIllegal = await isDescendant(id, parentId);
    if (isIllegal) {
      return res.status(400).json({ code: 400, msg: '不能移动到自己的子文件夹中' });
    }

    await Folder.findByIdAndUpdate(id, { parentId: parentId || null });
    res.json({ code: 200, msg: '移动成功' });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '移动失败' });
  }
});
require('dotenv').config();
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
const UserFile = require('./models/File');
const FileRecord = require('./models/FileRecord');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE;
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
const PORT = process.env.PORT || 3000;
// JWT验证中间件
const auth = (req, res, next) => {
  // 从请求头或 query 参数获取 Token
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;

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
  const decodedName = decodeURIComponent(fileName);

  try {
    // 通过 UserFile → FileRecord 找到真实文件路径
    const userFile = await UserFile.findOne({ userId: req.user.id, fileName: decodedName });
    if (!userFile) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }
    const record = await FileRecord.findById(userFile.fileRecordId);
    if (!record || !fse.existsSync(record.filePath)) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }
    const filePath = record.filePath;

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
    const { fileName, folderId, fileHash } = req.body;
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
    const fileRecord = await FileRecord.create({
      fileHash: fileHash || '',
      filePath: targetPath,
      fileSize: stats.size,
      referenceCount: 1
    });
    await UserFile.create({
      userId: req.user.id,
      fileName,
      fileRecordId: fileRecord._id,
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
  const { folderId, category } = req.query;

  try {
    if (!fse.existsSync(targetDir)) {
      return res.json({ code: 200, data: [] });
    }

    const categoryMap = {
      video: ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv'],
      music: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'mgg'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
      doc: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'],
    };

    let dbFiles;

    // 基础条件：排除已删除的文件
    const baseQuery = { userId: req.user.id, isDeleted: { $ne: true } };

    if (category && category !== 'all') {
      // 分类模式：查询用户全部未删除文件，按扩展名过滤
      dbFiles = await UserFile.find(baseQuery).populate('fileRecordId');

      if (category === 'other') {
        const allExts = Object.values(categoryMap).flat();
        dbFiles = dbFiles.filter(f => {
          const ext = f.fileName.split('.').pop()?.toLowerCase();
          return !allExts.includes(ext || '');
        });
      } else {
        const exts = categoryMap[category] || [];
        dbFiles = dbFiles.filter(f => {
          const ext = f.fileName.split('.').pop()?.toLowerCase();
          return exts.includes(ext || '');
        });
      }
    } else {
      // 目录模式：按文件夹筛选
      const query = { ...baseQuery };
      if (folderId) {
        query.folderId = folderId;
      } else {
        query.folderId = null;
      }
      dbFiles = await UserFile.find(query).populate('fileRecordId');
    }

    const fileList = (await Promise.all(
      dbFiles.map(async (dbFile) => {
        try {
          const record = dbFile.fileRecordId;
          if (!record) return null;
          const stats = await fse.stat(record.filePath);
          return {
            id: dbFile._id.toString(),
            name: dbFile.fileName,
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            time: stats.mtime.toLocaleString(),
            folderId: dbFile.folderId?.toString() || null
          };
        } catch {
          return null;
        }
      })
    )).filter(Boolean);

    res.json({ code: 200, data: fileList });
  } catch (err) {
    console.error('获取文件列表失败:', err);
    res.status(500).json({ code: 500, msg: '获取列表失败' });
  }
});
// 下载接口
app.get('/download/:fileName', auth, async (req, res) => {
  const { fileName } = req.params;
  const decodedName = decodeURIComponent(fileName);

  try {
    // 通过 UserFile → FileRecord 找到真实文件路径
    const userFile = await UserFile.findOne({ userId: req.user.id, fileName: decodedName });
    if (!userFile) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }
    const record = await FileRecord.findById(userFile.fileRecordId);
    if (!record || !fse.existsSync(record.filePath)) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }
    const filePath = record.filePath;

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const fileStream = fse.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('下载失败：', error);
    res.status(500).json({ code: 500, msg: '下载失败' });
  }
});

// 删除接口（软删除 → 回收站）
app.delete('/delete/:fileName', auth, async (req, res) => {
  const { fileName } = req.params;

  try {
    const userFile = await UserFile.findOne({ userId: req.user.id, fileName, isDeleted: { $ne: true } });
    if (!userFile) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    // 软删除：标记为已删除，不物理删除文件
    userFile.isDeleted = true;
    userFile.deleteTime = new Date();
    await userFile.save();

    res.json({ code: 200, msg: '删除成功' });
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
    const query = { userId: req.user.id, isDeleted: { $ne: true } };

    // 如果有 parentId 参数，按父文件夹筛选
    if (parentId !== undefined) {
      query.parentId = parentId === 'null' ? null : parentId;
    }

    const folders = await Folder.find(query);

    // 如果没有 parentId 参数，返回树结构和所有文件
    if (parentId === undefined) {
      const files = await UserFile.find({ userId: req.user.id, isDeleted: { $ne: true } }).populate('fileRecordId');

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
            size: f.fileRecordId?.fileSize || 0,
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

// 3. 删除文件夹（递归软删除子文件夹和文件 → 回收站）
app.delete('/folders/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    // 递归软删除所有子文件夹及其下的文件
    const softDeleteFolder = async (folderId) => {
      const subFolders = await Folder.find({ parentId: folderId, isDeleted: { $ne: true } });
      for (const sub of subFolders) {
        await softDeleteFolder(sub._id);
      }

      // 标记文件夹为已删除
      await Folder.updateOne({ _id: folderId }, { isDeleted: true, deleteTime: now });

      // 标记该文件夹下的所有用户文件为已删除
      await UserFile.updateMany({ folderId, isDeleted: { $ne: true } }, { isDeleted: true, deleteTime: now });
    };

    await softDeleteFolder(id);
    res.json({ code: 200, msg: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '删除失败' });
  }
});

// 4. 移动文件到文件夹
app.post('/files/move', auth, async (req, res) => {
  try {
    const { fileId, folderId } = req.body;

    await UserFile.findByIdAndUpdate(fileId, { folderId: folderId || null });
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
    const allFolders = await Folder.find({ userId: req.user.id, isDeleted: { $ne: true } }).lean();
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

// 重命名文件
app.patch('/files/:id/rename', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ code: 400, msg: '文件名不能为空' });
    }

    const file = await UserFile.findOne({ _id: id, userId: req.user.id }).populate('fileRecordId');
    if (!file) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    const { targetDir } = ensureUserDirs(req.user.id);
    const record = file.fileRecordId;
    const oldPath = record.filePath;
    const newPath = path.resolve(targetDir, newName.trim());

    if (fse.existsSync(newPath)) {
      return res.status(400).json({ code: 400, msg: '同名文件已存在' });
    }

    await fse.move(oldPath, newPath);
    file.fileName = newName.trim();
    await file.save();
    record.filePath = newPath;
    await record.save();

    res.json({ code: 200, msg: '重命名成功' });
  } catch (error) {
    console.error('重命名失败:', error);
    res.status(500).json({ code: 500, msg: '重命名失败' });
  }
});

// 重命名文件夹
app.patch('/folders/:id/rename', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ code: 400, msg: '文件夹名称不能为空' });
    }

    const folder = await Folder.findOne({ _id: id, userId: req.user.id });
    if (!folder) {
      return res.status(404).json({ code: 404, msg: '文件夹不存在' });
    }

    // 检查同级目录下是否有同名文件夹
    const existing = await Folder.findOne({
      userId: req.user.id,
      parentId: folder.parentId,
      name: newName.trim(),
      _id: { $ne: id }
    });
    if (existing) {
      return res.status(400).json({ code: 400, msg: '同名文件夹已存在' });
    }

    folder.name = newName.trim();
    await folder.save();

    res.json({ code: 200, msg: '重命名成功' });
  } catch (error) {
    console.error('重命名失败:', error);
    res.status(500).json({ code: 500, msg: '重命名失败' });
  }
});

// 秒传：检查文件 hash 是否已存在
app.post('/check-hash', auth, async (req, res) => {
  try {
    const { fileHash, fileName, fileSize, folderId } = req.body;

    if (!fileHash) {
      return res.json({ code: 200, data: { exists: false } });
    }

    const existingRecord = await FileRecord.findOne({ fileHash });

    if (existingRecord) {
      // 验证物理文件是否真的存在
      if (!fse.existsSync(existingRecord.filePath)) {
        // 物理文件已不存在，清理残留记录
        await FileRecord.deleteOne({ _id: existingRecord._id });
        return res.json({ code: 200, data: { exists: false } });
      }

      // 物理文件已存在，创建用户文件引用
      existingRecord.referenceCount += 1;
      await existingRecord.save();

      await UserFile.create({
        userId: req.user.id,
        fileName,
        fileRecordId: existingRecord._id,
        folderId: folderId || null
      });

      return res.json({ code: 200, data: { exists: true } });
    }

    res.json({ code: 200, data: { exists: false } });
  } catch (error) {
    console.error('检查hash失败:', error);
    res.status(500).json({ code: 500, msg: '检查失败' });
  }
});

// 文件预览/下载接口（通过 fileId 查找，支持 Range 流式播放）
app.get('/api/file/preview', auth, async (req, res) => {
  try {
    const { fileId } = req.query;
    if (!fileId) {
      return res.status(400).json({ code: 400, msg: '缺少 fileId' });
    }

    const userFile = await UserFile.findOne({ _id: fileId, userId: req.user.id });
    if (!userFile) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    const record = await FileRecord.findById(userFile.fileRecordId);
    if (!record || !fse.existsSync(record.filePath)) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    const filePath = record.filePath;
    const ext = path.extname(userFile.fileName).toLowerCase();
    const contentTypeMap = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
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
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const fileStream = fse.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      fileStream.pipe(res);
    } else {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      fse.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('预览失败:', error);
    res.status(500).json({ code: 500, msg: '预览失败' });
  }
});

// 搜索文件
app.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ code: 200, data: [] });
    }

    const keyword = q.trim();
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // 搜索文件（排除已删除）
    const files = await UserFile.find({
      userId: req.user.id,
      fileName: regex,
      isDeleted: { $ne: true }
    }).populate('fileRecordId');

    // 搜索文件夹（排除已删除）
    const folders = await Folder.find({
      userId: req.user.id,
      name: regex,
      isDeleted: { $ne: true }
    });

    const fileList = await Promise.all(
      files.map(async (dbFile) => {
        try {
          const record = dbFile.fileRecordId;
          if (!record) return null;
          const stats = await fse.stat(record.filePath);
          return {
            id: dbFile._id.toString(),
            name: dbFile.fileName,
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            time: stats.mtime.toLocaleString(),
            folderId: dbFile.folderId?.toString() || null,
            type: 'file'
          };
        } catch {
          return null;
        }
      })
    );

    const folderList = folders.map(folder => ({
      id: folder._id.toString(),
      name: folder.name,
      type: 'folder',
      size: '-',
      time: folder.createdAt.toLocaleString(),
      folderId: folder.parentId?.toString() || null
    }));

    // 文件夹优先
    const result = [...folderList, ...fileList.filter(Boolean)];
    res.json({ code: 200, data: result });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ code: 500, msg: '搜索失败' });
  }
});

// ==================== 回收站接口 ====================

// 获取回收站列表（只显示最顶层被删除的项，子项隐藏在父文件夹内）
app.get('/trash', auth, async (req, res) => {
  try {
    // 查询所有已删除的文件夹
    const allDeletedFolders = await Folder.find({
      userId: req.user.id,
      isDeleted: true
    });

    // 收集所有已删除文件夹的 ID 集合，用于判断父文件夹是否也被删除
    const deletedFolderIds = new Set(allDeletedFolders.map(f => f._id.toString()));

    // 只保留最顶层的文件夹：父文件夹没有被删除的（parentId 为 null，或父文件夹不在回收站中）
    const topDeletedFolders = allDeletedFolders.filter(folder => {
      if (!folder.parentId) return true; // 根目录下的文件夹，直接显示
      return !deletedFolderIds.has(folder.parentId.toString()); // 父文件夹未被删除，显示
    });

    // 只显示父文件夹未被删除的文件（如果父文件夹也被删除了，文件"藏在"父文件夹里）
    const deletedFiles = await UserFile.find({
      userId: req.user.id,
      isDeleted: true
    }).populate('fileRecordId');

    const topDeletedFiles = deletedFiles.filter(dbFile => {
      if (!dbFile.folderId) return true; // 根目录下的文件，直接显示
      return !deletedFolderIds.has(dbFile.folderId.toString()); // 父文件夹未被删除，显示
    });

    // 构建文件夹 ID 到名称的映射
    const folderNameMap = new Map();
    allDeletedFolders.forEach(f => folderNameMap.set(f._id.toString(), f.name));

    const fileList = (await Promise.all(
      topDeletedFiles.map(async (dbFile) => {
        try {
          const record = dbFile.fileRecordId;
          if (!record) return null;
          const stats = await fse.stat(record.filePath);

          let originalPath = '根目录';
          if (dbFile.folderId) {
            const parentName = folderNameMap.get(dbFile.folderId.toString());
            originalPath = parentName ? `📁 ${parentName}` : '根目录';
          }

          return {
            id: dbFile._id.toString(),
            name: dbFile.fileName,
            type: 'file',
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            deleteTime: dbFile.deleteTime?.toLocaleString() || '',
            originalFolderId: dbFile.folderId?.toString() || null,
            originalPath
          };
        } catch {
          return null;
        }
      })
    )).filter(Boolean);

    const folderList = topDeletedFolders.map(folder => {
      let originalPath = '根目录';
      if (folder.parentId) {
        const parentName = folderNameMap.get(folder.parentId.toString());
        originalPath = parentName ? `📁 ${parentName}` : '根目录';
      }

      return {
        id: folder._id.toString(),
        name: folder.name,
        type: 'folder',
        size: '-',
        deleteTime: folder.deleteTime?.toLocaleString() || '',
        originalFolderId: folder.parentId?.toString() || null,
        originalPath
      };
    });

    // 按删除时间倒序排列
    const result = [...folderList, ...fileList].sort((a, b) => {
      return new Date(b.deleteTime).getTime() - new Date(a.deleteTime).getTime();
    });

    res.json({ code: 200, data: result });
  } catch (error) {
    console.error('获取回收站失败:', error);
    res.status(500).json({ code: 500, msg: '获取回收站失败' });
  }
});

// 还原文件/文件夹
app.post('/trash/restore/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'file' 或 'folder'

    if (type === 'file') {
      const userFile = await UserFile.findOne({ _id: id, userId: req.user.id, isDeleted: true });
      if (!userFile) {
        return res.status(404).json({ code: 404, msg: '文件不存在' });
      }

      // 只有父文件夹被彻底删除（数据库记录不存在）时才还原到根目录
      // 如果父文件夹只是在回收站中（软删除），保留原始 folderId 不动
      if (userFile.folderId) {
        const parentFolder = await Folder.findOne({ _id: userFile.folderId });
        if (!parentFolder) {
          // 父文件夹已被彻底删除，还原到根目录
          userFile.folderId = null;
        }
        // 如果父文件夹存在（无论是否在回收站），保留原始 folderId
      }

      userFile.isDeleted = false;
      userFile.deleteTime = null;
      await userFile.save();

      res.json({ code: 200, msg: '还原成功' });
    } else if (type === 'folder') {
      const folder = await Folder.findOne({ _id: id, userId: req.user.id, isDeleted: true });
      if (!folder) {
        return res.status(404).json({ code: 404, msg: '文件夹不存在' });
      }

      // 只有父文件夹被彻底删除（数据库记录不存在）时才修改 parentId
      // 如果父文件夹只是在回收站中（软删除），保留原始 parentId 不动
      let newParentId = folder.parentId;
      if (folder.parentId) {
        const parentFolder = await Folder.findOne({ _id: folder.parentId });
        if (!parentFolder) {
          // 父文件夹已被彻底删除，还原到根目录
          newParentId = null;
        }
      }

      // 递归还原文件夹及其所有子项
      const restoreFolder = async (folderId) => {
        // 还原当前文件夹
        await Folder.updateOne({ _id: folderId }, { isDeleted: false, deleteTime: null });

        // 还原该文件夹下的所有文件
        await UserFile.updateMany({ folderId, isDeleted: true }, { isDeleted: false, deleteTime: null });

        // 递归还原子文件夹
        const subFolders = await Folder.find({ parentId: folderId, isDeleted: true });
        for (const sub of subFolders) {
          await restoreFolder(sub._id);
        }
      };

      await restoreFolder(id);

      // 如果需要修改 parentId（父文件夹已被彻底删除的情况）
      if (newParentId !== folder.parentId) {
        await Folder.updateOne({ _id: id }, { parentId: newParentId });
      }

      res.json({ code: 200, msg: '还原成功' });
    } else {
      res.status(400).json({ code: 400, msg: '无效的 type 参数' });
    }
  } catch (error) {
    console.error('还原失败:', error);
    res.status(500).json({ code: 500, msg: '还原失败' });
  }
});

// 彻底删除单个文件/文件夹
app.delete('/trash/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'file' 或 'folder'

    if (type === 'file') {
      const userFile = await UserFile.findOne({ _id: id, userId: req.user.id, isDeleted: true });
      if (!userFile) {
        return res.status(404).json({ code: 404, msg: '文件不存在' });
      }

      // 物理删除：递减引用计数
      const record = await FileRecord.findById(userFile.fileRecordId);
      if (record) {
        record.referenceCount -= 1;
        if (record.referenceCount <= 0) {
          if (fse.existsSync(record.filePath)) {
            await fse.unlink(record.filePath);
          }
          await FileRecord.deleteOne({ _id: record._id });
        } else {
          await record.save();
        }
      }

      await UserFile.deleteOne({ _id: userFile._id });
      res.json({ code: 200, msg: '彻底删除成功' });
    } else if (type === 'folder') {
      const folder = await Folder.findOne({ _id: id, userId: req.user.id, isDeleted: true });
      if (!folder) {
        return res.status(404).json({ code: 404, msg: '文件夹不存在' });
      }

      // 递归彻底删除
      const permanentDeleteFolder = async (folderId) => {
        // 删除该文件夹下的所有文件
        const userFiles = await UserFile.find({ folderId, isDeleted: true });
        for (const uf of userFiles) {
          const record = await FileRecord.findById(uf.fileRecordId);
          if (record) {
            record.referenceCount -= 1;
            if (record.referenceCount <= 0) {
              if (fse.existsSync(record.filePath)) {
                await fse.unlink(record.filePath);
              }
              await FileRecord.deleteOne({ _id: record._id });
            } else {
              await record.save();
            }
          }
        }
        await UserFile.deleteMany({ folderId, isDeleted: true });

        // 递归删除子文件夹
        const subFolders = await Folder.find({ parentId: folderId, isDeleted: true });
        for (const sub of subFolders) {
          await permanentDeleteFolder(sub._id);
        }

        // 删除文件夹本身
        await Folder.deleteOne({ _id: folderId });
      };

      await permanentDeleteFolder(id);
      res.json({ code: 200, msg: '彻底删除成功' });
    } else {
      res.status(400).json({ code: 400, msg: '缺少 type 参数' });
    }
  } catch (error) {
    console.error('彻底删除失败:', error);
    res.status(500).json({ code: 500, msg: '彻底删除失败' });
  }
});

// 清空回收站
app.delete('/trash/clear/all', auth, async (req, res) => {
  try {
    // 彻底删除所有已删除的文件
    const deletedFiles = await UserFile.find({ userId: req.user.id, isDeleted: true });
    for (const uf of deletedFiles) {
      const record = await FileRecord.findById(uf.fileRecordId);
      if (record) {
        record.referenceCount -= 1;
        if (record.referenceCount <= 0) {
          if (fse.existsSync(record.filePath)) {
            await fse.unlink(record.filePath);
          }
          await FileRecord.deleteOne({ _id: record._id });
        } else {
          await record.save();
        }
      }
    }
    await UserFile.deleteMany({ userId: req.user.id, isDeleted: true });

    // 彻底删除所有已删除的文件夹
    const deletedFolders = await Folder.find({ userId: req.user.id, isDeleted: true });
    for (const folder of deletedFolders) {
      // 删除文件夹下可能残留的文件
      const folderFiles = await UserFile.find({ folderId: folder._id, isDeleted: true });
      for (const uf of folderFiles) {
        const record = await FileRecord.findById(uf.fileRecordId);
        if (record) {
          record.referenceCount -= 1;
          if (record.referenceCount <= 0) {
            if (fse.existsSync(record.filePath)) {
              await fse.unlink(record.filePath);
            }
            await FileRecord.deleteOne({ _id: record._id });
          } else {
            await record.save();
          }
        }
      }
      await UserFile.deleteMany({ folderId: folder._id, isDeleted: true });
    }
    await Folder.deleteMany({ userId: req.user.id, isDeleted: true });

    res.json({ code: 200, msg: '回收站已清空' });
  } catch (error) {
    console.error('清空回收站失败:', error);
    res.status(500).json({ code: 500, msg: '清空回收站失败' });
  }
});
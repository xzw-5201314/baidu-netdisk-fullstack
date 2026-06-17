const router = require('express').Router();
const path = require('path');
const fse = require('fs-extra');
const multiparty = require('multiparty');
const auth = require('../middleware/auth');
const { ensureUserDirs, getTargetDir, contentTypeMap } = require('../utils/file');
const UserFile = require('../models/File');
const FileRecord = require('../models/FileRecord');

// ==================== 上传 ====================

// 上传分片
router.post('/upload', auth, (req, res) => {
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

// 合并分片
router.post('/merge', auth, async (req, res) => {
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

// 查询已上传的分片
router.get('/check-chunks/:fileName', auth, async (req, res) => {
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

// 秒传：检查文件 hash 是否已存在
router.post('/check-hash', auth, async (req, res) => {
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

// ==================== 文件列表 ====================

// 获取文件列表
router.get('/files', auth, async (req, res) => {
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

// ==================== 下载 ====================

// 下载文件（支持 Range 断点续传）
router.get('/download/:fileName', auth, async (req, res) => {
  const { fileName } = req.params;
  const decodedName = decodeURIComponent(fileName);

  try {
    const userFile = await UserFile.findOne({ userId: req.user.id, fileName: decodedName });
    if (!userFile) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }
    const record = await FileRecord.findById(userFile.fileRecordId);
    if (!record || !fse.existsSync(record.filePath)) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }
    const filePath = record.filePath;
    const stat = fse.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // 通用响应头
    const baseHeaders = {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
    };

    if (range) {
      // Range 请求：断点续传 / 分段下载
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
      });
      fse.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      // 完整文件请求
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Length': fileSize,
      });
      fse.createReadStream(filePath).pipe(res);
    }

  } catch (error) {
    console.error('下载失败：', error);
    res.status(500).json({ code: 500, msg: '下载失败' });
  }
});

// ==================== 删除 ====================

// 删除文件（软删除 → 回收站）
router.delete('/delete/:fileName', auth, async (req, res) => {
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

// ==================== 重命名 ====================

// 重命名文件
router.patch('/files/:id/rename', auth, async (req, res) => {
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

// ==================== 移动 ====================

// 移动文件到文件夹
router.post('/files/move', auth, async (req, res) => {
  try {
    const { fileId, folderId } = req.body;

    await UserFile.findByIdAndUpdate(fileId, { folderId: folderId || null });
    res.json({ code: 200, msg: '移动成功' });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '移动失败' });
  }
});

// ==================== 预览 ====================

// 动态文件预览接口（通过文件名，支持 Range 流式播放）
router.get('/target/:fileName', auth, async (req, res) => {
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

// 文件预览/下载接口（通过 fileId 查找，支持 Range 流式播放）
router.get('/api/file/preview', auth, async (req, res) => {
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

module.exports = router;

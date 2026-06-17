const router = require('express').Router();
const fse = require('fs-extra');
const auth = require('../middleware/auth');
const UserFile = require('../models/File');
const Folder = require('../models/Folder');

// 搜索文件
router.get('/search', auth, async (req, res) => {
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

module.exports = router;

const router = require('express').Router();
const fse = require('fs-extra');
const auth = require('../middleware/auth');
const UserFile = require('../models/File');
const FileRecord = require('../models/FileRecord');
const Folder = require('../models/Folder');

// 获取回收站列表（只显示最顶层被删除的项，子项隐藏在父文件夹内）
router.get('/trash', auth, async (req, res) => {
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
router.post('/trash/restore/:id', auth, async (req, res) => {
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
router.delete('/trash/:id', auth, async (req, res) => {
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
router.delete('/trash/clear/all', auth, async (req, res) => {
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

module.exports = router;

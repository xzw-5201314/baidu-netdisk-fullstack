const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fse = require('fs-extra');
const archiver = require('archiver');
const auth = require('../middleware/auth');
const User = require('../models/User');
const UserFile = require('../models/File');
const FileRecord = require('../models/FileRecord');
const Folder = require('../models/Folder');
const Share = require('../models/Share');

// 生成唯一短码
function generateShareCode() {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

// ==================== 分享管理（需要登录） ====================

// 创建分享
router.post('/api/share', auth, async (req, res) => {
  try {
    const { targetId, shareType, password, expireDays } = req.body;

    if (!targetId || !shareType) {
      return res.status(400).json({ code: 400, msg: '缺少必要参数' });
    }

    // 验证目标文件/文件夹是否存在且属于当前用户
    let shareName = '';
    if (shareType === 'file') {
      const file = await UserFile.findOne({ _id: targetId, userId: req.user.id, isDeleted: { $ne: true } });
      if (!file) {
        return res.status(404).json({ code: 404, msg: '文件不存在' });
      }
      shareName = file.fileName;
    } else if (shareType === 'folder') {
      const folder = await Folder.findOne({ _id: targetId, userId: req.user.id, isDeleted: { $ne: true } });
      if (!folder) {
        return res.status(404).json({ code: 404, msg: '文件夹不存在' });
      }
      shareName = folder.name;
    } else {
      return res.status(400).json({ code: 400, msg: '无效的 shareType' });
    }

    // 生成唯一短码（确保唯一）
    let shareCode;
    let isUnique = false;
    while (!isUnique) {
      shareCode = generateShareCode();
      const existing = await Share.findOne({ shareCode });
      if (!existing) isUnique = true;
    }

    // 处理密码
    let hashedPassword = null;
    let hasPassword = false;
    if (password && password.trim()) {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
      hasPassword = true;
    }

    // 处理过期时间
    let expireAt = null;
    if (expireDays && expireDays > 0) {
      expireAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);
    }

    const share = await Share.create({
      userId: req.user.id,
      shareType,
      targetId,
      shareName,
      shareCode,
      password: hashedPassword,
      hasPassword,
      expireAt,
      status: 'active'
    });

    res.json({
      code: 200,
      msg: '分享成功',
      data: {
        shareCode: share.shareCode,
        hasPassword: share.hasPassword,
        expireAt: share.expireAt,
        createdAt: share.createdAt
      }
    });
  } catch (error) {
    console.error('创建分享失败:', error);
    res.status(500).json({ code: 500, msg: '创建分享失败' });
  }
});

// 获取我的分享列表
router.get('/api/shares', auth, async (req, res) => {
  try {
    const shares = await Share.find({
      userId: req.user.id,
      status: { $ne: 'revoked' }
    }).sort({ createdAt: -1 });

    const shareList = shares.map(share => ({
      id: share._id.toString(),
      shareType: share.shareType,
      shareName: share.shareName,
      shareCode: share.shareCode,
      hasPassword: share.hasPassword,
      expireAt: share.expireAt,
      viewCount: share.viewCount,
      downloadCount: share.downloadCount,
      status: share.status,
      createdAt: share.createdAt
    }));

    res.json({ code: 200, data: shareList });
  } catch (error) {
    console.error('获取分享列表失败:', error);
    res.status(500).json({ code: 500, msg: '获取分享列表失败' });
  }
});

// 取消分享
router.delete('/api/share/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const share = await Share.findOne({ _id: id, userId: req.user.id });
    if (!share) {
      return res.status(404).json({ code: 404, msg: '分享不存在' });
    }

    share.status = 'revoked';
    await share.save();

    res.json({ code: 200, msg: '已取消分享' });
  } catch (error) {
    console.error('取消分享失败:', error);
    res.status(500).json({ code: 500, msg: '取消分享失败' });
  }
});

// ==================== 分享访问（无需登录） ====================

// 获取分享信息
router.get('/s/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const share = await Share.findOne({ shareCode: code });

    if (!share) {
      return res.status(404).json({ code: 404, msg: '分享链接不存在' });
    }

    // 检查是否已撤销
    if (share.status === 'revoked') {
      return res.status(410).json({ code: 410, msg: '该分享已被取消' });
    }

    // 检查是否过期
    if (share.expireAt && new Date() > share.expireAt) {
      share.status = 'expired';
      await share.save();
      return res.status(410).json({ code: 410, msg: '该分享已过期' });
    }

    // 获取分享者的用户名
    const user = await User.findById(share.userId);
    const sharerName = user ? user.username : '未知用户';

    // 获取文件大小信息
    let fileSize = null;
    let fileCount = null;

    if (share.shareType === 'file') {
      const userFile = await UserFile.findOne({ _id: share.targetId, isDeleted: { $ne: true } }).populate('fileRecordId');
      if (userFile && userFile.fileRecordId) {
        const sizeBytes = userFile.fileRecordId.fileSize;
        if (sizeBytes > 1024 * 1024 * 1024) {
          fileSize = (sizeBytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
        } else {
          fileSize = (sizeBytes / 1024 / 1024).toFixed(2) + ' MB';
        }
      }
    } else {
      // 文件夹：统计文件数量和总大小
      const countFolderFiles = async (folderId) => {
        let count = 0;
        let totalSize = 0;

        const directFiles = await UserFile.find({ folderId, isDeleted: { $ne: true } }).populate('fileRecordId');
        for (const f of directFiles) {
          if (f.fileRecordId) {
            count++;
            totalSize += f.fileRecordId.fileSize;
          }
        }

        const subFolders = await Folder.find({ parentId: folderId, isDeleted: { $ne: true } });
        for (const sub of subFolders) {
          const subResult = await countFolderFiles(sub._id);
          count += subResult.count;
          totalSize += subResult.totalSize;
        }

        return { count, totalSize };
      };

      const result = await countFolderFiles(share.targetId);
      fileCount = result.count;
      if (result.totalSize > 1024 * 1024 * 1024) {
        fileSize = (result.totalSize / 1024 / 1024 / 1024).toFixed(2) + ' GB';
      } else {
        fileSize = (result.totalSize / 1024 / 1024).toFixed(2) + ' MB';
      }
    }

    // 增加访问次数
    share.viewCount += 1;
    await share.save();

    res.json({
      code: 200,
      data: {
        shareName: share.shareName,
        shareType: share.shareType,
        hasPassword: share.hasPassword,
        sharerName,
        fileSize,
        fileCount,
        createdAt: share.createdAt,
        expireAt: share.expireAt,
        downloadCount: share.downloadCount
      }
    });
  } catch (error) {
    console.error('获取分享信息失败:', error);
    res.status(500).json({ code: 500, msg: '获取分享信息失败' });
  }
});

// 验证分享密码
router.post('/s/:code/verify', async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.body;

    const share = await Share.findOne({ shareCode: code });
    if (!share) {
      return res.status(404).json({ code: 404, msg: '分享链接不存在' });
    }

    if (share.status !== 'active') {
      return res.status(410).json({ code: 410, msg: '该分享已失效' });
    }

    if (!share.hasPassword) {
      return res.json({ code: 200, msg: '无需密码', data: { verified: true } });
    }

    if (!password) {
      return res.status(400).json({ code: 400, msg: '请输入提取密码' });
    }

    const isMatch = await bcrypt.compare(password, share.password);
    if (!isMatch) {
      return res.status(403).json({ code: 403, msg: '密码错误' });
    }

    res.json({ code: 200, msg: '验证成功', data: { verified: true } });
  } catch (error) {
    console.error('密码验证失败:', error);
    res.status(500).json({ code: 500, msg: '验证失败' });
  }
});

// 下载分享的文件
router.get('/s/:code/download', async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.query;

    const share = await Share.findOne({ shareCode: code });
    if (!share) {
      return res.status(404).json({ code: 404, msg: '分享链接不存在' });
    }

    if (share.status !== 'active') {
      return res.status(410).json({ code: 410, msg: '该分享已失效' });
    }

    // 检查过期
    if (share.expireAt && new Date() > share.expireAt) {
      share.status = 'expired';
      await share.save();
      return res.status(410).json({ code: 410, msg: '该分享已过期' });
    }

    // 验证密码
    if (share.hasPassword) {
      if (!password) {
        return res.status(403).json({ code: 403, msg: '需要提取密码' });
      }
      const isMatch = await bcrypt.compare(password, share.password);
      if (!isMatch) {
        return res.status(403).json({ code: 403, msg: '密码错误' });
      }
    }

    // 增加下载次数
    share.downloadCount += 1;
    await share.save();

    if (share.shareType === 'file') {
      // 单文件下载
      const userFile = await UserFile.findOne({ _id: share.targetId, isDeleted: { $ne: true } }).populate('fileRecordId');
      if (!userFile || !userFile.fileRecordId) {
        return res.status(404).json({ code: 404, msg: '文件不存在或已被删除' });
      }

      const filePath = userFile.fileRecordId.filePath;
      if (!fse.existsSync(filePath)) {
        return res.status(404).json({ code: 404, msg: '文件不存在' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(userFile.fileName)}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      fse.createReadStream(filePath).pipe(res);
    } else {
      // 文件夹打包下载
      const folder = await Folder.findOne({ _id: share.targetId, isDeleted: { $ne: true } });
      if (!folder) {
        return res.status(404).json({ code: 404, msg: '文件夹不存在或已被删除' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(share.shareName)}.zip"`);
      res.setHeader('Content-Type', 'application/zip');

      const archive = archiver('zip', { zlib: { level: 1 } }); // 低压缩，优先速度
      archive.pipe(res);

      // 递归添加文件夹内容
      const addFolderToArchive = async (folderId, archivePath) => {
        const files = await UserFile.find({ folderId, isDeleted: { $ne: true } }).populate('fileRecordId');
        for (const f of files) {
          if (f.fileRecordId && fse.existsSync(f.fileRecordId.filePath)) {
            archive.file(f.fileRecordId.filePath, { name: archivePath + f.fileName });
          }
        }

        const subFolders = await Folder.find({ parentId: folderId, isDeleted: { $ne: true } });
        for (const sub of subFolders) {
          await addFolderToArchive(sub._id, archivePath + sub.name + '/');
        }
      };

      await addFolderToArchive(share.targetId, share.shareName + '/');

      archive.finalize();
    }
  } catch (error) {
    console.error('分享下载失败:', error);
    res.status(500).json({ code: 500, msg: '下载失败' });
  }
});

module.exports = router;

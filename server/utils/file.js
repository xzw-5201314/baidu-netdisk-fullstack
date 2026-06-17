const path = require('path');
const fse = require('fs-extra');

// 用户隔离的文件目录配置
const getTargetDir = (userId) => path.resolve(__dirname, '..', 'target', userId);
const getUploadDir = (userId) => path.resolve(__dirname, '..', 'uploads', userId);

// 确保用户目录存在
const ensureUserDirs = (userId) => {
  const targetDir = getTargetDir(userId);
  const uploadDir = getUploadDir(userId);
  if (!fse.existsSync(targetDir)) fse.mkdirsSync(targetDir);
  if (!fse.existsSync(uploadDir)) fse.mkdirsSync(uploadDir);
  return { targetDir, uploadDir };
};

// Content-Type 映射（预览/流式播放用）
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

module.exports = {
  getTargetDir,
  getUploadDir,
  ensureUserDirs,
  contentTypeMap
};

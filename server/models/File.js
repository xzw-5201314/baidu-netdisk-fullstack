const mongoose = require('mongoose');

const UserFileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileRecord',
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deleteTime: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 复合索引：加速查询"某用户的未删除文件"
UserFileSchema.index({ userId: 1, isDeleted: 1 });

module.exports = mongoose.model('UserFile', UserFileSchema, 'files');

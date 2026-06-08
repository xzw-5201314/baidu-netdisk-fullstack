const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null // null 表示根目录
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
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 复合索引：加速查询"某用户的未删除文件夹"
FolderSchema.index({ userId: 1, isDeleted: 1 });

module.exports = mongoose.model('Folder', FolderSchema);

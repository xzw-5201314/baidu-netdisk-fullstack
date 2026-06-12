const mongoose = require('mongoose');

const ShareSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 分享目标类型：file 或 folder
  shareType: {
    type: String,
    enum: ['file', 'folder'],
    required: true
  },
  // 分享目标ID（UserFile 或 Folder 的 ObjectId）
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  // 分享时的文件/文件夹名称（冗余存储，方便查询）
  shareName: {
    type: String,
    required: true
  },
  // 唯一短码，用于生成分享链接
  shareCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 提取密码（可选，bcrypt 加密存储）
  password: {
    type: String,
    default: null
  },
  // 是否需要密码
  hasPassword: {
    type: Boolean,
    default: false
  },
  // 过期时间（null = 永久有效）
  expireAt: {
    type: Date,
    default: null
  },
  // 访问次数
  viewCount: {
    type: Number,
    default: 0
  },
  // 下载次数
  downloadCount: {
    type: Number,
    default: 0
  },
  // 状态
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  },
  // 权限
  permissions: {
    type: String,
    enum: ['preview', 'download'],
    default: 'download'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 复合索引：加速查询"某用户的分享列表"
ShareSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Share', ShareSchema);

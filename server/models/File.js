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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('UserFile', UserFileSchema, 'files');

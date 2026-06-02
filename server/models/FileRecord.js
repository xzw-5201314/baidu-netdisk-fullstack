const mongoose = require('mongoose');

const FileRecordSchema = new mongoose.Schema({
  fileHash: {
    type: String,
    default: '',
    index: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  referenceCount: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FileRecord', FileRecordSchema);

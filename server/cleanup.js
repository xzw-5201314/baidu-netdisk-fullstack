// 一次性清理脚本：删除孤立的 UserFile 和 FileRecord
// 运行方式：node cleanup.js

require('dotenv').config();
const mongoose = require('mongoose');
const fse = require('fs-extra');
const connectDB = require('./config/db');
const UserFile = require('./models/File');
const FileRecord = require('./models/FileRecord');

const cleanup = async () => {
  await connectDB();

  const userFiles = await UserFile.find();
  let cleaned = 0;

  for (const uf of userFiles) {
    const record = await FileRecord.findById(uf.fileRecordId);

    if (!record) {
      // FileRecord 已不存在，删除孤立的 UserFile
      await UserFile.deleteOne({ _id: uf._id });
      console.log(`[孤立] 删除 UserFile: ${uf.fileName} (无 FileRecord)`);
      cleaned++;
    } else if (!fse.existsSync(record.filePath)) {
      // 物理文件不存在，清理 FileRecord + UserFile
      await FileRecord.deleteOne({ _id: record._id });
      await UserFile.deleteOne({ _id: uf._id });
      console.log(`[残留] 删除: ${uf.fileName} (物理文件不存在)`);
      cleaned++;
    }
  }

  console.log(`\n清理完成，共清理 ${cleaned} 条残留数据`);
  process.exit(0);
};

cleanup().catch(err => {
  console.error('清理失败:', err);
  process.exit(1);
});

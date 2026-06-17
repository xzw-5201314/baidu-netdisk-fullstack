require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 导入数据库连接
const connectDB = require('./config/db');

const app = express();

// 连接数据库
connectDB();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 挂载路由
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/file'));
app.use('/', require('./routes/folder'));
app.use('/', require('./routes/share'));
app.use('/', require('./routes/trash'));
app.use('/', require('./routes/search'));

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
    🚀  服务器已成功启动！
    📡  监听端口: ${PORT}
    📦  数据库: MongoDB
  `);
});

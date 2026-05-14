# 仿百度网盘 - 个人云存储系统

> 一个基于 Vue 3 + Express + MongoDB 构建的个人云存储服务，提供文件上传、下载、预览、管理等核心功能。

## 📖 项目背景

本项目旨在构建一个类似百度网盘的个人云存储系统，为用户提供安全、便捷的文件管理体验。支持大文件分片上传、断点续传、文件分类管理等功能。

## 🛠️ 技术栈

### 前端技术栈
| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.4+ | 渐进式 JavaScript 框架 |
| TypeScript | 5.4+ | 类型安全的 JavaScript 超集 |
| Vite | 5.2+ | 下一代前端构建工具 |
| Axios | 1.6+ | HTTP 客户端库 |

### 后端技术栈
| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | 20+ | JavaScript 运行时 |
| Express | 4.18+ | Web 应用框架 |
| MongoDB | 7.0+ | NoSQL 数据库 |
| Mongoose | 8.2+ | MongoDB ODM |
| JWT | 9.0+ | 身份认证 |
| bcryptjs | 2.4+ | 密码加密 |

## ✨ 功能特性

### 已实现功能
- ✅ **用户认证** - 注册、登录、JWT 令牌验证
- ✅ **文件上传** - 大文件分片上传、断点续传
- ✅ **文件下载** - 支持任意文件下载
- ✅ **文件预览** - 支持图片、视频、PDF、音频在线预览
- ✅ **文件管理** - 创建、删除、移动文件/文件夹
- ✅ **文件夹树** - 支持多级文件夹结构
- ✅ **文件分类** - 视频、音乐、图片、文档自动分类
- ✅ **空间统计** - 实时显示存储空间使用情况
- ✅ **视图切换** - 列表视图/网格视图切换

### 待实现功能
- 🔄 **回收站** - 文件恢复功能
- 🔄 **分享功能** - 生成分享链接
- 🔄 **传输列表** - 上传/下载进度管理
- 🔄 **搜索功能** - 文件全文搜索

## 🚀 快速开始

### 前置条件
- Node.js >= 20.x
- MongoDB >= 7.0
- npm 或 pnpm

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/xzw-5201314/baidu-netdisk-fullstack.git
cd 仿百度网盘
```

2. **安装后端依赖**
```bash
cd server
pnpm install
```

3. **安装前端依赖**
```bash
cd ../client
pnpm install
```

4. **启动 MongoDB**
```bash
# 确保 MongoDB 服务已启动
mongod --dbpath ./data/db
```

5. **启动后端服务**
```bash
cd server
pnpm start
```
服务将在 http://localhost:3000 启动

6. **启动前端开发服务器**
```bash
cd client
pnpm dev
```
前端将在 http://localhost:5173 启动

## 📁 项目结构

```
仿百度网盘/
├── client/                  # 前端项目
│   ├── src/
│   │   ├── components/      # Vue 组件
│   │   │   ├── Login.vue         # 登录/注册页面
│   │   │   ├── Header.vue        # 顶部导航栏
│   │   │   ├── Sidebar.vue       # 侧边栏文件分类
│   │   │   ├── FileList.vue      # 文件列表/网格展示
│   │   │   ├── Toolbar.vue       # 工具栏（上传、新建文件夹等）
│   │   │   ├── MoveDialog.vue    # 移动文件对话框
│   │   │   ├── FolderTreeItem.vue # 文件夹树节点
│   │   │   └── EmptyState.vue    # 空状态占位组件
│   │   ├── config/          # 配置文件
│   │   ├── App.vue          # 根组件
│   │   ├── main.ts          # 入口文件
│   │   └── style.css        # 全局样式
│   ├── package.json
│   └── vite.config.ts
├── server/                  # 后端项目
│   ├── models/              # MongoDB 数据模型
│   │   ├── User.js              # 用户模型
│   │   ├── File.js              # 文件模型
│   │   └── Folder.js            # 文件夹模型
│   ├── config/
│   │   └── db.js            # 数据库连接配置
│   ├── uploads/             # 文件上传存储目录
│   ├── index.js             # 后端入口文件
│   └── package.json
└── README.md
```

## 📸 界面预览

| 登录页面 | 文件管理 |
|---------|---------|
| 用户注册与登录界面 | 文件上传、下载、预览、移动等操作 |

> 后续将持续补充项目截图

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进本项目。

## 📄 许可证

本项目仅供学习交流使用。


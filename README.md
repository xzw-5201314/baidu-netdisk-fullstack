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
| SparkMD5 | 3.0+ | Web Worker 中计算文件 MD5 哈希 |

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
- ✅ **分片上传** - 大文件按 1MB 分片上传，支持并发控制
- ✅ **断点续传** - 上传前查询已传分片，跳过已上传部分
- ✅ **秒传** - Web Worker 计算文件 MD5，服务端哈希去重，相同文件瞬间完成
- ✅ **文件下载** - 支持任意文件下载，实时进度与速度追踪
- ✅ **传输列表** - 上传/下载进度管理，Tab 分类筛选，暂停/恢复控制
- ✅ **文件预览** - 支持图片、视频、PDF、音频在线预览（Range 流式加载）
- ✅ **文件管理** - 创建、删除、移动、重命名文件/文件夹
- ✅ **文件夹树** - 支持多级文件夹结构
- ✅ **文件分类** - 视频、音乐、图片、文档自动分类
- ✅ **搜索功能** - 按文件名搜索
- ✅ **空间统计** - 实时显示存储空间使用情况
- ✅ **视图切换** - 列表视图/网格视图切换
- ✅ **拖拽上传** - 全局拖拽区域，支持多文件同时拖入

### 待实现功能
- 🔄 **回收站** - 文件恢复与永久删除
- 🔄 **分享功能** - 生成分享链接与提取码
- 🔄 **文件夹下载** - 打包下载整个文件夹
- 🔄 **下载断点续传** - 基于 Range 请求的断点下载

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
│   │   │   ├── Sidebar.vue       # 侧边栏（文件分类 + 传输列表入口）
│   │   │   ├── FileList.vue      # 文件列表/网格展示
│   │   │   ├── Toolbar.vue       # 工具栏（上传、新建文件夹、搜索等）
│   │   │   ├── TransferList.vue  # 传输列表（上传/下载进度管理）
│   │   │   ├── MoveDialog.vue    # 移动文件对话框
│   │   │   ├── FolderTreeItem.vue # 文件夹树节点
│   │   │   └── EmptyState.vue    # 空状态占位组件
│   │   ├── workers/         # Web Worker
│   │   │   └── hash.worker.ts    # 文件 MD5 哈希计算（不阻塞 UI）
│   │   ├── config/          # 配置文件
│   │   │   └── api.ts            # API 地址配置
│   │   ├── App.vue          # 根组件（含上传/下载/传输状态管理）
│   │   ├── main.ts          # 入口文件
│   │   └── style.css        # 全局样式
│   ├── package.json
│   └── vite.config.ts
├── server/                  # 后端项目
│   ├── models/              # MongoDB 数据模型
│   │   ├── User.js              # 用户模型
│   │   ├── File.js              # 用户文件模型（UserFile）
│   │   ├── FileRecord.js        # 物理文件记录模型（哈希去重/秒传）
│   │   └── Folder.js            # 文件夹模型
│   ├── config/
│   │   └── db.js            # 数据库连接配置
│   ├── uploads/             # 文件上传存储目录
│   ├── index.js             # 后端入口文件（API 路由）
│   └── package.json
└── README.md
```

## 🏗️ 核心架构

### 上传流程

```
选择文件 / 拖拽上传
    │
    ▼
Web Worker 计算 MD5（spark-md5，不阻塞 UI）
    │
    ▼
POST /check-hash → 服务端查 FileRecord
    │
    ├── 哈希命中 → 秒传完成（仅创建 UserFile 引用）
    │
    └── 哈希未命中 → 分片上传流程
                        │
                        ▼
                  GET /check-chunks/:fileName → 获取已传分片索引
                        │
                        ▼
                  逐片 POST /upload（跳过已传分片，支持暂停/恢复）
                        │
                        ▼
                  POST /merge → 合并分片，创建 FileRecord + UserFile
```

### 下载流程

```
点击下载
    │
    ▼
GET /download/:fileName（axios + onDownloadProgress 追踪进度）
    │
    ▼
服务端：UserFile → FileRecord → createReadStream → 流式响应
    │
    ▼
客户端：Blob → 创建临时 URL → <a> 标签触发浏览器下载
```

### 数据模型

- **User** — 用户账户（用户名、密码哈希）
- **UserFile** — 用户文件条目（关联 FileRecord，支持软删除）
- **FileRecord** — 物理文件记录（哈希、路径、引用计数，实现秒传去重）
- **Folder** — 文件夹（支持多级嵌套）

## 📸 界面预览

| 登录页面 | 文件管理 |
|---------|---------|
| 用户注册与登录界面 | 文件上传、下载、预览、移动等操作 |

> 后续将持续补充项目截图

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进本项目。

## 📄 许可证

本项目仅供学习交流使用。


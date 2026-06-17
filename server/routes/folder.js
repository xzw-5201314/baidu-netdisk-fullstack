const router = require('express').Router();
const auth = require('../middleware/auth');
const Folder = require('../models/Folder');
const UserFile = require('../models/File');

// 辅助函数：数组转树结构
function arrayToTree(arr, parentId = null) {
  const branch = [];
  arr.forEach(node => {
    if (String(node.parentId) === String(parentId)) {
      const children = arrayToTree(arr, node._id);
      if (children.length > 0) {
        node.children = children;
      }
      branch.push(node);
    }
  });
  return branch;
}

// 辅助函数：判断 targetId 是否是 sourceId 的后代
async function isDescendant(sourceId, targetId) {
  if (!targetId) return false;

  const target = await Folder.findById(targetId);
  if (!target || !target.parentId) return false;

  if (String(target.parentId) === String(sourceId)) return true;

  return isDescendant(sourceId, target.parentId);
}

// 获取文件夹列表（支持树结构和子文件夹列表两种模式）
router.get('/folders', auth, async (req, res) => {
  try {
    const { parentId } = req.query;
    const query = { userId: req.user.id, isDeleted: { $ne: true } };

    // 如果有 parentId 参数，按父文件夹筛选
    if (parentId !== undefined) {
      query.parentId = parentId === 'null' ? null : parentId;
    }

    const folders = await Folder.find(query);

    // 如果没有 parentId 参数，返回树结构和所有文件
    if (parentId === undefined) {
      const files = await UserFile.find({ userId: req.user.id, isDeleted: { $ne: true } }).populate('fileRecordId');

      // 构建树结构
      const buildTree = (pid = null) => {
        const children = folders.filter(f => {
          if (pid === null) {
            return f.parentId === null || f.parentId === undefined;
          }
          return f.parentId?.toString() === pid.toString();
        });
        return children.map(folder => ({
          id: folder._id.toString(),
          name: folder.name,
          type: 'folder',
          children: buildTree(folder._id)
        }));
      };

      res.json({
        code: 200,
        data: {
          tree: buildTree(),
          files: files.map(f => ({
            id: f._id.toString(),
            name: f.fileName,
            size: f.fileRecordId?.fileSize || 0,
            folderId: f.folderId?.toString() || null,
            createdAt: f.createdAt
          }))
        }
      });
    } else {
      // 如果有 parentId 参数，返回该目录下的文件夹列表
      res.json({
        code: 200,
        data: folders.map(folder => ({
          _id: folder._id.toString(),
          name: folder.name,
          parentId: folder.parentId?.toString() || null,
          createdAt: folder.createdAt
        }))
      });
    }
  } catch (error) {
    res.status(500).json({ code: 500, msg: '获取失败' });
  }
});

// 获取文件夹树（MoveDialog 用）
router.get('/api/folders/tree', auth, async (req, res) => {
  try {
    const allFolders = await Folder.find({ userId: req.user.id, isDeleted: { $ne: true } }).lean();
    const tree = arrayToTree(allFolders, null);
    res.json({ code: 200, data: tree });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// 创建文件夹
router.post('/folders', auth, async (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, msg: '请输入文件夹名称' });
    }

    const folder = await Folder.create({
      userId: req.user.id,
      name,
      parentId: parentId || null
    });

    res.json({ code: 200, msg: '创建成功', data: folder });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '创建失败' });
  }
});

// 删除文件夹（递归软删除子文件夹和文件 → 回收站）
router.delete('/folders/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    // 递归软删除所有子文件夹及其下的文件
    const softDeleteFolder = async (folderId) => {
      const subFolders = await Folder.find({ parentId: folderId, isDeleted: { $ne: true } });
      for (const sub of subFolders) {
        await softDeleteFolder(sub._id);
      }

      // 标记文件夹为已删除
      await Folder.updateOne({ _id: folderId }, { isDeleted: true, deleteTime: now });

      // 标记该文件夹下的所有用户文件为已删除
      await UserFile.updateMany({ folderId, isDeleted: { $ne: true } }, { isDeleted: true, deleteTime: now });
    };

    await softDeleteFolder(id);
    res.json({ code: 200, msg: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '删除失败' });
  }
});

// 移动文件夹
router.patch('/api/folders/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    const isIllegal = await isDescendant(id, parentId);
    if (isIllegal) {
      return res.status(400).json({ code: 400, msg: '不能移动到自己的子文件夹中' });
    }

    await Folder.findByIdAndUpdate(id, { parentId: parentId || null });
    res.json({ code: 200, msg: '移动成功' });
  } catch (error) {
    res.status(500).json({ code: 500, msg: '移动失败' });
  }
});

// 重命名文件夹
router.patch('/folders/:id/rename', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ code: 400, msg: '文件夹名称不能为空' });
    }

    const folder = await Folder.findOne({ _id: id, userId: req.user.id });
    if (!folder) {
      return res.status(404).json({ code: 404, msg: '文件夹不存在' });
    }

    // 检查同级目录下是否有同名文件夹
    const existing = await Folder.findOne({
      userId: req.user.id,
      parentId: folder.parentId,
      name: newName.trim(),
      _id: { $ne: id }
    });
    if (existing) {
      return res.status(400).json({ code: 400, msg: '同名文件夹已存在' });
    }

    folder.name = newName.trim();
    await folder.save();

    res.json({ code: 200, msg: '重命名成功' });
  } catch (error) {
    console.error('重命名失败:', error);
    res.status(500).json({ code: 500, msg: '重命名失败' });
  }
});

module.exports = router;

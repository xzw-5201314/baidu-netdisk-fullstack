const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE;

// 注册接口
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查用户是否已存在
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ code: 400, msg: '用户名已存在' });
    }

    // 创建新用户
    user = new User({ username, password });
    await user.save();

    res.json({ code: 200, msg: '注册成功' });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// 登录接口
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查用户是否存在
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ code: 400, msg: '用户名或密码错误' });
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ code: 400, msg: '用户名或密码错误' });
    }

    // 生成JWT Token
    const payload = {
      id: user.id,
      username: user.username
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });

    res.json({
      code: 200,
      msg: '登录成功',
      data: {
        token,
        username: user.username
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// 验证Token接口
router.get('/verify', auth, (req, res) => {
  res.json({
    code: 200,
    msg: 'Token有效',
    data: {
      username: req.user.username
    }
  });
});

module.exports = router;

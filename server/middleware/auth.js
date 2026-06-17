const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// JWT 验证中间件
const auth = (req, res, next) => {
  // 从请求头或 query 参数获取 Token
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;

  if (!token) {
    return res.status(401).json({ code: 401, msg: '未授权，请先登录' });
  }

  try {
    // 验证Token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 将用户信息挂载到req对象
    next();
  } catch (error) {
    res.status(401).json({ code: 401, msg: 'Token无效或已过期' });
  }
};

module.exports = auth;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queryOne, queryAll, run } = require('../database');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'กรุณากรอก username และ password' });

  const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'username หรือ password ไม่ถูกต้อง' });

  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.fullName = user.full_name;
  req.session.role     = user.role;

  res.json({
    success: true,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });
  const user = queryOne('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.session.userId]);
  if (!user) return res.status(401).json({ error: 'ไม่พบผู้ใช้' });

  // Load teacher's subjects & homeroom
  const subjects = queryAll(`
    SELECT ts.id as ts_id, ts.class_id, s.id as subject_id,
           s.subject_code, s.subject_name, s.color, s.icon,
           c.class_code, c.class_name, c.grade, c.room
    FROM teacher_subjects ts
    JOIN subjects s ON ts.subject_id = s.id
    JOIN classes  c ON ts.class_id   = c.id
    WHERE ts.user_id = ?
    ORDER BY s.subject_code, c.grade, CAST(c.room AS INTEGER)
  `, [user.id]);

  const homerooms = queryAll(`
    SELECT th.id as th_id, th.class_id,
           c.class_code, c.class_name, c.grade, c.room
    FROM teacher_homeroom th
    JOIN classes c ON th.class_id = c.id
    WHERE th.user_id = ?
    ORDER BY c.grade, CAST(c.room AS INTEGER)
  `, [user.id]);

  res.json({ ...user, subjects, homerooms });
});

// PUT /api/auth/profile — update own profile
router.put('/profile', requireAuth, (req, res) => {
  const { full_name, current_password, new_password } = req.body;
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

  if (new_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password))
      return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    const hashed = bcrypt.hashSync(new_password, 10);
    run('UPDATE users SET full_name=?, password=? WHERE id=?', [full_name || user.full_name, hashed, user.id]);
  } else {
    run('UPDATE users SET full_name=? WHERE id=?', [full_name || user.full_name, user.id]);
  }
  req.session.fullName = full_name || user.full_name;
  res.json({ success: true, message: 'อัปเดตโปรไฟล์เรียบร้อย' });
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  next();
}

module.exports = router;
module.exports.requireAuth = requireAuth;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queryAll, queryOne, run } = require('../database');
const { requireAuth } = require('./auth');

// All routes require auth
router.use(requireAuth);

// GET all users (admin only)
router.get('/', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  const users = queryAll(`
    SELECT u.id, u.username, u.full_name, u.role, u.created_at,
      COUNT(DISTINCT ts.id) as subject_count,
      COUNT(DISTINCT th.id) as homeroom_count
    FROM users u
    LEFT JOIN teacher_subjects ts ON ts.user_id = u.id
    LEFT JOIN teacher_homeroom th ON th.user_id = u.id
    GROUP BY u.id ORDER BY u.role DESC, u.full_name ASC
  `);
  res.json(users);
});

// POST create user (admin only)
router.post('/', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name)
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  try {
    run('INSERT INTO users (username, password, full_name, role) VALUES (?,?,?,?)',
      [username, bcrypt.hashSync(password, 10), full_name, role || 'teacher']);
    res.json({ success: true, message: 'เพิ่มผู้ใช้เรียบร้อย' });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'username นี้มีอยู่แล้ว' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update user (admin only)
router.put('/:id', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  const { full_name, role, password } = req.body;
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  if (password) {
    run('UPDATE users SET full_name=?, role=?, password=? WHERE id=?',
      [full_name, role, bcrypt.hashSync(password, 10), req.params.id]);
  } else {
    run('UPDATE users SET full_name=?, role=? WHERE id=?', [full_name, role, req.params.id]);
  }
  res.json({ success: true, message: 'อัปเดตผู้ใช้เรียบร้อย' });
});

// DELETE user (admin only)
router.delete('/:id', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  if (String(req.params.id) === String(req.session.userId))
    return res.status(400).json({ error: 'ไม่สามารถลบตัวเองได้' });
  run('DELETE FROM teacher_subjects WHERE user_id = ?', [req.params.id]);
  run('DELETE FROM teacher_homeroom WHERE user_id = ?', [req.params.id]);
  run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'ลบผู้ใช้เรียบร้อย' });
});

// GET teacher assignments (subjects + homerooms)
router.get('/:id/assignments', (req, res) => {
  const uid = req.params.id === 'me' ? req.session.userId : req.params.id;
  if (req.session.role !== 'admin' && String(uid) !== String(req.session.userId))
    return res.status(403).json({ error: 'ไม่มีสิทธิ์' });

  const subjects = queryAll(`
    SELECT ts.id, ts.subject_id, ts.class_id,
           s.subject_code, s.subject_name, s.color, s.icon,
           c.class_code, c.class_name, c.grade, c.room
    FROM teacher_subjects ts
    JOIN subjects s ON ts.subject_id = s.id
    JOIN classes  c ON ts.class_id   = c.id
    WHERE ts.user_id = ?
    ORDER BY s.subject_code, c.grade, CAST(c.room AS INTEGER)
  `, [uid]);

  const homerooms = queryAll(`
    SELECT th.id, th.class_id, c.class_code, c.class_name, c.grade, c.room
    FROM teacher_homeroom th
    JOIN classes c ON th.class_id = c.id
    WHERE th.user_id = ?
    ORDER BY c.grade, CAST(c.room AS INTEGER)
  `, [uid]);

  res.json({ subjects, homerooms });
});

// POST save teacher assignments (subjects + homerooms) — replaces all
router.post('/:id/assignments', (req, res) => {
  const uid = req.params.id === 'me' ? req.session.userId : req.params.id;
  if (req.session.role !== 'admin' && String(uid) !== String(req.session.userId))
    return res.status(403).json({ error: 'ไม่มีสิทธิ์' });

  const { subject_classes, homeroom_class_ids } = req.body;
  // subject_classes: [{ subject_id, class_id }, ...]
  // homeroom_class_ids: [class_id, ...]

  run('DELETE FROM teacher_subjects WHERE user_id = ?', [uid]);
  run('DELETE FROM teacher_homeroom WHERE user_id = ?', [uid]);

  if (Array.isArray(subject_classes)) {
    for (const { subject_id, class_id } of subject_classes) {
      try {
        run('INSERT INTO teacher_subjects (user_id, subject_id, class_id) VALUES (?,?,?)',
          [uid, subject_id, class_id]);
      } catch(e) { /* ignore duplicate */ }
    }
  }
  if (Array.isArray(homeroom_class_ids)) {
    for (const class_id of homeroom_class_ids) {
      try {
        run('INSERT INTO teacher_homeroom (user_id, class_id) VALUES (?,?)', [uid, class_id]);
      } catch(e) {}
    }
  }
  res.json({ success: true, message: 'บันทึกการมอบหมายเรียบร้อย' });
});

module.exports = router;

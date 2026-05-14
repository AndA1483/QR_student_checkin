const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../database');
const { requireAuth } = require('./auth');

router.use(requireAuth);

// GET all subjects
router.get('/', (req, res) => {
  res.json(queryAll('SELECT * FROM subjects ORDER BY subject_code'));
});

// POST create subject (admin)
router.post('/', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  const { subject_code, subject_name, color, icon } = req.body;
  if (!subject_code || !subject_name) return res.status(400).json({ error: 'กรุณากรอกข้อมูล' });
  try {
    run('INSERT INTO subjects (subject_code, subject_name, color, icon) VALUES (?,?,?,?)',
      [subject_code, subject_name, color || '#6366f1', icon || '📚']);
    res.json({ success: true, message: 'เพิ่มรายวิชาเรียบร้อย' });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'รหัสวิชานี้มีอยู่แล้ว' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update subject (admin)
router.put('/:id', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  const { subject_code, subject_name, color, icon } = req.body;
  run('UPDATE subjects SET subject_code=?, subject_name=?, color=?, icon=? WHERE id=?',
    [subject_code, subject_name, color, icon, req.params.id]);
  res.json({ success: true });
});

// DELETE subject (admin) — cascade ลบ attendance และ teacher_subjects ที่เกี่ยวข้อง
router.delete('/:id', (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  run('DELETE FROM attendance WHERE subject_id = ?', [req.params.id]);
  run('DELETE FROM teacher_subjects WHERE subject_id = ?', [req.params.id]);
  run('DELETE FROM subjects WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'ลบรายวิชาและข้อมูลที่เกี่ยวข้องเรียบร้อย' });
});

module.exports = router;

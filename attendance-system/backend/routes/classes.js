const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../database');

// GET all classes (with student count) — optional ?grade=
router.get('/', (req, res) => {
  const { grade } = req.query;
  let sql = `
    SELECT c.*, COUNT(s.id) as student_count
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id
  `;
  const params = [];
  if (grade) { sql += ' WHERE c.grade = ?'; params.push(grade); }
  sql += ' GROUP BY c.id ORDER BY c.grade ASC, CAST(c.room AS INTEGER) ASC';
  res.json(queryAll(sql, params));
});

// GET single class
router.get('/:id', (req, res) => {
  const cls = queryOne('SELECT * FROM classes WHERE id = ?', [req.params.id]);
  if (!cls) return res.status(404).json({ error: 'ไม่พบชั้นเรียน' });
  res.json(cls);
});

// POST create class
router.post('/', (req, res) => {
  const { class_code, class_name, grade, room, teacher, academic_year } = req.body;
  if (!class_code || !class_name) {
    return res.status(400).json({ error: 'กรุณากรอกรหัสและชื่อชั้นเรียน' });
  }
  try {
    run(
      'INSERT INTO classes (class_code, class_name, grade, room, teacher, academic_year) VALUES (?,?,?,?,?,?)',
      [class_code, class_name, grade || '', room || '', teacher || '', academic_year || '']
    );
    const created = queryOne('SELECT * FROM classes WHERE class_code = ?', [class_code]);
    res.json({ success: true, message: 'เพิ่มชั้นเรียนเรียบร้อย', class: created });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'รหัสชั้นเรียนนี้มีอยู่แล้ว' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update class
router.put('/:id', (req, res) => {
  const { class_code, class_name, grade, room, teacher, academic_year } = req.body;
  const existing = queryOne('SELECT * FROM classes WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'ไม่พบชั้นเรียน' });

  try {
    run(
      'UPDATE classes SET class_code=?, class_name=?, grade=?, room=?, teacher=?, academic_year=? WHERE id=?',
      [class_code, class_name, grade || '', room || '', teacher || '', academic_year || '', req.params.id]
    );
    // Sync class text in students table
    run('UPDATE students SET class = ? WHERE class_id = ?', [class_code, req.params.id]);
    res.json({ success: true, message: 'อัปเดตชั้นเรียนเรียบร้อย' });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'รหัสชั้นเรียนนี้มีอยู่แล้ว' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE class — cascade ลบ teacher assignments ที่เกี่ยวข้อง
router.delete('/:id', (req, res) => {
  const count = queryOne('SELECT COUNT(*) as c FROM students WHERE class_id = ?', [req.params.id]).c;
  if (count > 0) {
    return res.status(400).json({ error: `ไม่สามารถลบได้ มีนักเรียน ${count} คนในชั้นนี้` });
  }
  run('DELETE FROM teacher_homeroom WHERE class_id = ?', [req.params.id]);
  run('DELETE FROM teacher_subjects WHERE class_id = ?', [req.params.id]);
  run('DELETE FROM classes WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'ลบชั้นเรียนเรียบร้อย' });
});

// GET students in a class
router.get('/:id/students', (req, res) => {
  const students = queryAll(
    'SELECT * FROM students WHERE class_id = ? ORDER BY number ASC',
    [req.params.id]
  );
  res.json(students);
});

module.exports = router;

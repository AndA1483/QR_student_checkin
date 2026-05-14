const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// Middleware: only admin can mutate student data
function adminOnly(req, res, next) {
  if (req.session.role !== 'admin')
    return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้นที่สามารถแก้ไขข้อมูลนักเรียนได้' });
  next();
}

// Multer setup for photo uploads
const uploadDir = path.join(__dirname, '../../frontend/assets/photos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}${ext}`);
  }
});

// Validate image MIME type
function imageFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (JPEG, PNG, GIF, WEBP) เท่านั้น'), false);
  }
}

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });

// GET all students — optional ?class_id= filter
router.get('/', (req, res) => {
  const { class_id } = req.query;
  let students;
  if (class_id) {
    students = queryAll(
      'SELECT s.*, c.class_name FROM students s LEFT JOIN classes c ON s.class_id=c.id WHERE s.class_id = ? ORDER BY s.number ASC',
      [class_id]
    );
  } else {
    students = queryAll(
      'SELECT s.*, c.class_name FROM students s LEFT JOIN classes c ON s.class_id=c.id ORDER BY s.class ASC, s.number ASC'
    );
  }
  res.json(students);
});

// ── POST import students from CSV ──────────────────────────────────────────
// ต้องอยู่ก่อน /:student_id เพื่อกัน Express match "import" เป็น param
// Body: { class_id, students: [{number, national_id, student_id, name, birthdate, student_status},...] }
router.post('/import', adminOnly, (req, res) => {
  const { class_id, students: rows } = req.body;
  if (!class_id || !Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });

  const cls = queryOne('SELECT * FROM classes WHERE id = ?', [class_id]);
  if (!cls) return res.status(404).json({ error: 'ไม่พบชั้นเรียน' });

  const results = { inserted: 0, updated: 0, errors: [] };

  for (const row of rows) {
    const number     = parseInt(row.number) || 0;
    const nationalId = String(row.national_id || '').trim() || null;
    const sid        = String(row.student_id || '').trim();
    const name       = String(row.name || '').trim();
    const birthdate  = String(row.birthdate || '').trim() || null;
    const status     = String(row.student_status || '').trim() || 'กำลังศึกษา';

    if (!sid || !name || !number) {
      results.errors.push(`แถว "${sid || '?'}" — ข้อมูลไม่ครบ (ต้องมี student_id, name, number)`);
      continue;
    }

    try {
      const existing = queryOne('SELECT * FROM students WHERE student_id = ?', [sid]);
      if (existing) {
        run(`UPDATE students SET national_id=?, name=?, class=?, class_id=?, number=?,
             birthdate=?, student_status=? WHERE student_id=?`,
          [nationalId, name, cls.class_code, class_id, number, birthdate, status, sid]);
        results.updated++;
      } else {
        run(`INSERT INTO students (student_id, national_id, name, class, class_id, number, birthdate, student_status)
             VALUES (?,?,?,?,?,?,?,?)`,
          [sid, nationalId, name, cls.class_code, class_id, number, birthdate, status]);
        results.inserted++;
      }
    } catch (e) {
      results.errors.push(`"${sid}" — ${e.message}`);
    }
  }

  res.json({
    success: true,
    message: `นำเข้าสำเร็จ: เพิ่ม ${results.inserted} คน, อัปเดต ${results.updated} คน${results.errors.length ? `, ข้ามไป ${results.errors.length} แถว` : ''}`,
    ...results
  });
});

// GET single student
router.get('/:student_id', (req, res) => {
  const student = queryOne(
    'SELECT s.*, c.class_name FROM students s LEFT JOIN classes c ON s.class_id=c.id WHERE s.student_id = ?',
    [req.params.student_id]
  );
  if (!student) return res.status(404).json({ error: 'ไม่พบนักเรียน' });
  res.json(student);
});

// POST create student — admin only
router.post('/', adminOnly, upload.single('photo'), (req, res) => {
  const { student_id, name, class: cls, class_id, number, national_id, birthdate, student_status } = req.body;
  if (!student_id || !name || !number) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  let classText = cls || '';
  let resolvedClassId = class_id || null;
  if (class_id) {
    const classRow = queryOne('SELECT class_code FROM classes WHERE id = ?', [class_id]);
    if (classRow) classText = classRow.class_code;
  }

  const photo = req.file ? `/assets/photos/${req.file.filename}` : null;
  try {
    run(
      `INSERT INTO students (student_id, national_id, name, class, class_id, number, birthdate, student_status, photo)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [student_id, national_id || null, name, classText, resolvedClassId, number,
       birthdate || null, student_status || 'กำลังศึกษา', photo]
    );
    res.json({ success: true, message: 'เพิ่มนักเรียนเรียบร้อย' });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'เลขประจำตัวนี้มีอยู่แล้ว' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update student — admin only
router.put('/:student_id', adminOnly, upload.single('photo'), (req, res) => {
  const { name, class: cls, class_id, number, national_id, birthdate, student_status } = req.body;
  const existing = queryOne('SELECT * FROM students WHERE student_id = ?', [req.params.student_id]);
  if (!existing) return res.status(404).json({ error: 'ไม่พบนักเรียน' });

  let classText = cls || existing.class;
  let resolvedClassId = class_id !== undefined ? class_id : existing.class_id;
  if (class_id) {
    const classRow = queryOne('SELECT class_code FROM classes WHERE id = ?', [class_id]);
    if (classRow) classText = classRow.class_code;
  }

  const photo = req.file ? `/assets/photos/${req.file.filename}` : existing.photo;
  run(
    `UPDATE students SET national_id=?, name=?, class=?, class_id=?, number=?,
     birthdate=?, student_status=?, photo=? WHERE student_id=?`,
    [national_id ?? existing.national_id, name, classText, resolvedClassId || null,
     number, birthdate ?? existing.birthdate,
     student_status || existing.student_status || 'กำลังศึกษา',
     photo, req.params.student_id]
  );
  res.json({ success: true, message: 'อัปเดตข้อมูลเรียบร้อย' });
});

// DELETE student — admin only
router.delete('/:student_id', adminOnly, (req, res) => {
  run('DELETE FROM attendance WHERE student_id = ?', [req.params.student_id]);
  run('DELETE FROM students WHERE student_id = ?', [req.params.student_id]);
  res.json({ success: true, message: 'ลบนักเรียนเรียบร้อย' });
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('อนุญาตเฉพาะ')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// GET QR Code for a student
router.get('/:student_id/qr', async (req, res) => {
  const student = queryOne(
    'SELECT s.*, c.class_name FROM students s LEFT JOIN classes c ON s.class_id=c.id WHERE s.student_id = ?',
    [req.params.student_id]
  );
  if (!student) return res.status(404).json({ error: 'ไม่พบนักเรียน' });

  const qrData = JSON.stringify({
    student_id: student.student_id,
    name: student.name,
    class: student.class,
    class_id: student.class_id,
    number: student.number
  });

  try {
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300, margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    res.json({ qr: qrImage, student });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../database');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build WHERE clause fragments for class and subject filters */
function buildFilters({ class_id, subject_id }) {
  const clauses = [];
  const params  = [];
  if (class_id)   { clauses.push('AND s.class_id = ?');    params.push(class_id); }
  if (subject_id) { clauses.push('AND a.subject_id = ?');  params.push(subject_id); }
  return { clause: clauses.join(' '), params };
}

/**
 * For a teacher (non-admin), restrict queries to only the classes/subjects
 * they are assigned to. Returns { classIds, subjectIds, homeroomClassIds, subjectClassIds, classSubjectPairs } or null for admin.
 */
function getTeacherScope(req) {
  if (req.session.role === 'admin') return null; // admin sees everything
  const uid = req.session.userId;

  // Get homeroom classes
  const homeroomRows = queryAll(`SELECT class_id FROM teacher_homeroom WHERE user_id = ?`, [uid]);
  const homeroomClassIds = homeroomRows.map(r => r.class_id);

  // Get subject classes with mapping
  const subjectRows = queryAll(`SELECT class_id, subject_id FROM teacher_subjects WHERE user_id = ?`, [uid]);
  const subjectClassIds = [...new Set(subjectRows.map(r => r.class_id))];
  const subjectIds = [...new Set(subjectRows.map(r => r.subject_id))];
  
  // Create map of class_id -> subject_ids that teacher teaches in that class
  const classSubjectMap = {};
  subjectRows.forEach(row => {
    if (!classSubjectMap[row.class_id]) classSubjectMap[row.class_id] = [];
    classSubjectMap[row.class_id].push(row.subject_id);
  });

  // All classes (homeroom + subject)
  const classIds = [...new Set([...homeroomClassIds, ...subjectClassIds])];

  return { classIds, subjectIds, homeroomClassIds, subjectClassIds, classSubjectMap, uid };
}

/** Build IN clause for teacher's allowed class_ids */
function scopeClause(scope, alias = 's') {
  if (!scope || scope.classIds.length === 0) return { clause: '', params: [] };
  const placeholders = scope.classIds.map(() => '?').join(',');
  return { clause: `AND ${alias}.class_id IN (${placeholders})`, params: scope.classIds };
}

// ── GET attendance by date ─────────────────────────────────────────────────
// ?class_id= ?subject_id=
router.get('/date/:date', (req, res) => {
  const { date } = req.params;
  const { class_id, subject_id } = req.query;
  const scope = getTeacherScope(req);

  // For teacher: validate they have access to the requested subject
  if (scope && subject_id) {
    const hasSubject = scope.subjectIds.includes(Number(subject_id));
    if (!hasSubject) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงวิชานี้' });
  }

  // For teacher: if no class_id given, restrict to their classes
  let classFilter = '';
  let classParams = [];
  if (class_id) {
    classFilter = 'AND s.class_id = ?';
    classParams = [class_id];
  } else if (scope) {
    const { clause, params } = scopeClause(scope);
    classFilter = clause;
    classParams = params;
  }

  const subjectFilter = subject_id ? 'AND a.subject_id = ?' : '';
  const subjectParams = subject_id ? [subject_id] : [];

  const rows = queryAll(`
    SELECT s.student_id, s.name, s.class, s.class_id, s.number, s.photo,
           a.status, a.note, a.subject_id, a.checked_by, a.checked_at
    FROM students s
    LEFT JOIN attendance a
      ON s.student_id = a.student_id
      AND a.date = ?
      ${subjectFilter}
    WHERE 1=1 ${classFilter}
    ORDER BY s.class ASC, s.number ASC
  `, [date, ...subjectParams, ...classParams]);

  res.json(rows);
});

// ── POST save attendance (bulk) ────────────────────────────────────────────
// Body: { date, subject_id (optional), records: [{student_id, status, note}] }
router.post('/save', (req, res) => {
  const { date, records, subject_id } = req.body;
  if (!date || !Array.isArray(records))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });

  const checkedBy  = req.session.userId || null;
  const subjectVal = subject_id || null;
  const checkedAt  = new Date().toISOString();

  try {
    // Wrap in a transaction for atomicity and performance
    const { getDb } = require('../database');
    const db = getDb();
    db.run('BEGIN TRANSACTION');
    try {
      for (const rec of records) {
        // Use COALESCE to handle NULL subject_id correctly
        const existing = queryOne(
          `SELECT id FROM attendance
           WHERE student_id = ? AND date = ?
             AND COALESCE(subject_id, -1) = COALESCE(?, -1)`,
          [rec.student_id, date, subjectVal]
        );
        if (existing) {
          db.run(
            `UPDATE attendance SET status=?, note=?, checked_by=?, checked_at=? WHERE id=?`,
            [rec.status, (rec.note || '').substring(0, 200), checkedBy, checkedAt, existing.id]
          );
        } else {
          db.run(
            `INSERT INTO attendance (student_id, date, status, note, subject_id, checked_by, checked_at)
             VALUES (?,?,?,?,?,?,?)`,
            [rec.student_id, date, rec.status, (rec.note || '').substring(0, 200), subjectVal, checkedBy, checkedAt]
          );
        }
      }
      db.run('COMMIT');
      const { saveDb } = require('../database');
      saveDb();
    } catch (innerErr) {
      db.run('ROLLBACK');
      throw innerErr;
    }

    // Stats scoped to this save batch
    const ids = records.map(r => `'${r.student_id}'`).join(',');
    const subjectWhere = subjectVal !== null ? 'AND COALESCE(subject_id,-1) = COALESCE(?,-1)' : 'AND subject_id IS NULL';
    const subjectParam = subjectVal !== null ? [subjectVal] : [];

    const statsRows = queryAll(
      `SELECT status, COUNT(*) as cnt FROM attendance
       WHERE date = ? AND student_id IN (${ids}) ${subjectWhere}
       GROUP BY status`,
      [date, ...subjectParam]
    );
    const stats = { present: 0, absent: 0, leave: 0, total: records.length };
    statsRows.forEach(r => { stats[r.status] = r.cnt; });
    stats.percent = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : 0;

    res.json({ success: true, message: 'บันทึกข้อมูลเรียบร้อย', stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST QR scan check-in ──────────────────────────────────────────────────
router.post('/qr-checkin', (req, res) => {
  const { student_id, date, subject_id } = req.body;
  if (!student_id || !date) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

  const student = queryOne('SELECT * FROM students WHERE student_id = ?', [student_id]);
  if (!student) return res.status(404).json({ error: 'ไม่พบนักเรียนในระบบ' });

  const checkedBy  = req.session.userId || null;
  const subjectVal = subject_id || null;
  const checkedAt  = new Date().toISOString();

  try {
    const existing = queryOne(
      `SELECT id FROM attendance WHERE student_id=? AND date=? AND COALESCE(subject_id,-1)=COALESCE(?,-1)`,
      [student_id, date, subjectVal]
    );
    if (existing) {
      run(`UPDATE attendance SET status='present', note='เช็กชื่อผ่าน QR Code', checked_by=?, checked_at=? WHERE id=?`,
        [checkedBy, checkedAt, existing.id]);
    } else {
      run(`INSERT INTO attendance (student_id, date, status, note, subject_id, checked_by, checked_at)
           VALUES (?,?,'present','เช็กชื่อผ่าน QR Code',?,?,?)`,
        [student_id, date, subjectVal, checkedBy, checkedAt]);
    }
    res.json({ success: true, student, message: `เช็กชื่อ ${student.name} เรียบร้อย` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET daily report ───────────────────────────────────────────────────────
// ?class_id= ?subject_id= ?homeroom_filter=
router.get('/report/daily/:date', (req, res) => {
  const { date } = req.params;
  const { class_id, subject_id, homeroom_filter } = req.query;
  const scope = getTeacherScope(req);

  console.log('[Daily Report] Request params:', { date, class_id, subject_id, homeroom_filter, role: req.session.role });

  // For teacher: validate access to class + subject combination
  if (scope && class_id && subject_id) {
    const allowedSubjects = scope.classSubjectMap[class_id] || [];
    if (!allowedSubjects.includes(Number(subject_id))) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลวิชานี้ในชั้นเรียนนี้' });
    }
  }

  let classFilter = '';
  let classParams = [];
  
  // Priority: use class_id if provided, otherwise use scope
  if (class_id) {
    // User selected a specific class - use it
    classFilter = 'AND s.class_id = ?';
    classParams = [class_id];
    console.log('[Daily Report] Using specific class_id:', class_id);
  } else if (homeroom_filter === 'homeroom') {
    // Homeroom mode without specific class - use homeroom scope
    if (scope && scope.homeroomClassIds && scope.homeroomClassIds.length > 0) {
      classFilter = `AND s.class_id IN (${scope.homeroomClassIds.map(() => '?').join(',')})`;
      classParams = scope.homeroomClassIds;
      console.log('[Daily Report] Using homeroom scope:', scope.homeroomClassIds);
    }
  } else if (homeroom_filter === 'subject') {
    // Subject mode without specific class - use subject scope
    if (scope && scope.subjectClassIds && scope.subjectClassIds.length > 0) {
      classFilter = `AND s.class_id IN (${scope.subjectClassIds.map(() => '?').join(',')})`;
      classParams = scope.subjectClassIds;
      console.log('[Daily Report] Using subject scope:', scope.subjectClassIds);
    }
  } else if (scope) {
    // No filter specified - use all classes in scope
    const { clause, params } = scopeClause(scope);
    classFilter = clause;
    classParams = params;
    console.log('[Daily Report] Using all classes in scope:', scope.classIds);
  }

  const subjectFilter = subject_id ? 'AND a.subject_id = ?' : (homeroom_filter === 'homeroom' ? 'AND (a.subject_id IS NULL OR a.id IS NULL)' : '');
  const subjectParams = subject_id ? [subject_id] : [];

  const statsRows = queryAll(`
    SELECT a.status, COUNT(*) as cnt FROM attendance a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.date = ? ${subjectFilter} ${classFilter}
    GROUP BY a.status
  `, [date, ...subjectParams, ...classParams]);

  const summary = { present: 0, absent: 0, leave: 0 };
  statsRows.forEach(r => { summary[r.status] = r.cnt; });
  summary.total = queryOne(`SELECT COUNT(*) as c FROM students s WHERE 1=1 ${classFilter}`, classParams).c;
  summary.percent = summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(1) : 0;

  // Build JOIN condition for details query
  let joinCondition = 's.student_id = a.student_id AND a.date = ?';
  const detailParams = [date];
  
  if (subject_id) {
    joinCondition += ' AND a.subject_id = ?';
    detailParams.push(subject_id);
  } else if (homeroom_filter === 'homeroom') {
    joinCondition += ' AND a.subject_id IS NULL';
  }

  const details = queryAll(`
    SELECT s.student_id, s.name, s.class, s.class_id, s.number,
           a.status, a.note, a.subject_id, a.checked_at
    FROM students s
    LEFT JOIN attendance a ON ${joinCondition}
    WHERE 1=1 ${classFilter}
    ORDER BY s.class ASC, s.number ASC
  `, [...detailParams, ...classParams]);

  res.json({ date, summary, details });
});

// ── GET semester summary ───────────────────────────────────────────────────
// ?class_id= ?subject_id= ?start= ?end= ?homeroom_filter=
router.get('/report/semester', (req, res) => {
  const { class_id, subject_id, start, end, homeroom_filter } = req.query;
  const scope = getTeacherScope(req);

  console.log('[Semester Report] Request params:', { class_id, subject_id, start, end, homeroom_filter, role: req.session.role });

  // For teacher: validate access to class + subject combination
  if (scope && class_id && subject_id) {
    const allowedSubjects = scope.classSubjectMap[class_id] || [];
    if (!allowedSubjects.includes(Number(subject_id))) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลวิชานี้ในชั้นเรียนนี้' });
    }
  }

  let classFilter = '';
  let classParams = [];
  
  // Priority: use class_id if provided, otherwise use scope
  if (class_id) {
    // User selected a specific class - use it
    classFilter = 'AND s.class_id = ?';
    classParams = [class_id];
    console.log('[Semester Report] Using specific class_id:', class_id);
  } else if (homeroom_filter === 'homeroom') {
    // Homeroom mode without specific class - use homeroom scope
    if (scope && scope.homeroomClassIds && scope.homeroomClassIds.length > 0) {
      classFilter = `AND s.class_id IN (${scope.homeroomClassIds.map(() => '?').join(',')})`;
      classParams = scope.homeroomClassIds;
      console.log('[Semester Report] Using homeroom scope:', scope.homeroomClassIds);
    }
  } else if (homeroom_filter === 'subject') {
    // Subject mode without specific class - use subject scope
    if (scope && scope.subjectClassIds && scope.subjectClassIds.length > 0) {
      classFilter = `AND s.class_id IN (${scope.subjectClassIds.map(() => '?').join(',')})`;
      classParams = scope.subjectClassIds;
      console.log('[Semester Report] Using subject scope:', scope.subjectClassIds);
    }
  } else if (scope) {
    // No filter specified - use all classes in scope
    const { clause, params } = scopeClause(scope);
    classFilter = clause;
    classParams = params;
    console.log('[Semester Report] Using all classes in scope:', scope.classIds);
  }

  const subjectFilter = subject_id ? 'AND a.subject_id = ?' : (homeroom_filter === 'homeroom' ? 'AND (a.subject_id IS NULL OR a.id IS NULL)' : '');
  const subjectParams = subject_id ? [subject_id] : [];

  let dateFilter = '';
  const dateParams = [];
  if (start && end) { dateFilter = 'AND a.date BETWEEN ? AND ?'; dateParams.push(start, end); }

  // Build JOIN condition
  let joinCondition = 's.student_id = a.student_id';
  const joinParams = [];
  
  if (subject_id) {
    joinCondition += ' AND a.subject_id = ?';
    joinParams.push(subject_id);
  } else if (homeroom_filter === 'homeroom') {
    joinCondition += ' AND a.subject_id IS NULL';
  }
  
  if (start && end) {
    joinCondition += ' AND a.date BETWEEN ? AND ?';
    joinParams.push(start, end);
  }

  const rows = queryAll(`
    SELECT s.student_id, s.name, s.class, s.class_id, s.number, s.photo, c.class_name,
      COUNT(a.id) as total_days,
      SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status='leave'   THEN 1 ELSE 0 END) as leave
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN attendance a ON ${joinCondition}
    WHERE 1=1 ${classFilter}
    GROUP BY s.student_id
    ORDER BY s.class ASC, s.number ASC
  `, [...joinParams, ...classParams]);

  res.json(rows.map(r => ({
    ...r, present: r.present||0, absent: r.absent||0, leave: r.leave||0,
    percent: r.total_days > 0 ? ((r.present / r.total_days) * 100).toFixed(1) : 0
  })));
});

// ── GET dates with attendance ──────────────────────────────────────────────
// ?class_id= ?subject_id= ?homeroom_filter=
router.get('/dates', (req, res) => {
  const { class_id, subject_id, homeroom_filter } = req.query;
  const scope = getTeacherScope(req);

  let classFilter = '';
  let classParams = [];
  
  // Handle homeroom_filter
  if (homeroom_filter === 'homeroom') {
    // Only homeroom classes
    if (scope && scope.homeroomClassIds && scope.homeroomClassIds.length > 0) {
      classFilter = `AND s.class_id IN (${scope.homeroomClassIds.map(() => '?').join(',')})`;
      classParams = scope.homeroomClassIds;
    } else {
      // No homeroom classes - return empty
      res.json([]);
      return;
    }
  } else if (homeroom_filter === 'subject') {
    // Only subject classes (not homeroom)
    if (scope && scope.subjectClassIds && scope.subjectClassIds.length > 0) {
      classFilter = `AND s.class_id IN (${scope.subjectClassIds.map(() => '?').join(',')})`;
      classParams = scope.subjectClassIds;
    } else {
      // No subject classes - return empty
      res.json([]);
      return;
    }
  } else if (class_id) {
    classFilter = 'AND s.class_id = ?';
    classParams = [class_id];
  } else if (scope) {
    const { clause, params } = scopeClause(scope);
    classFilter = clause;
    classParams = params;
  }

  const subjectFilter = subject_id ? 'AND a.subject_id = ?' : '';
  const subjectParams = subject_id ? [subject_id] : [];

  const dates = queryAll(`
    SELECT a.date,
      COUNT(*) as total,
      SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status='leave'   THEN 1 ELSE 0 END) as leave
    FROM attendance a JOIN students s ON a.student_id = s.student_id
    WHERE 1=1 ${subjectFilter} ${classFilter}
    GROUP BY a.date ORDER BY a.date DESC
  `, [...subjectParams, ...classParams]);
  res.json(dates);
});

// ── GET dashboard ──────────────────────────────────────────────────────────
// Admin: sees all. Teacher: sees only their assigned classes/subjects.
// ?class_id= ?subject_id= (override scope)
router.get('/dashboard', (req, res) => {
  const { class_id, subject_id } = req.query;
  const scope = getTeacherScope(req);
  const today = new Date().toISOString().split('T')[0];

  // Build class restriction
  let classFilter = '';
  let classParams = [];
  if (class_id) {
    classFilter = 'AND s.class_id = ?';
    classParams = [class_id];
  } else if (scope && scope.classIds.length > 0) {
    const { clause, params } = scopeClause(scope);
    classFilter = clause;
    classParams = params;
  }

  const subjectFilter = subject_id ? 'AND a.subject_id = ?' : '';
  const subjectParams = subject_id ? [subject_id] : [];

  const totalStudents = queryOne(
    `SELECT COUNT(*) as c FROM students s WHERE 1=1 ${classFilter}`, classParams
  ).c;

  const todayRows = queryAll(`
    SELECT a.status, COUNT(*) as cnt FROM attendance a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.date = ? ${subjectFilter} ${classFilter}
    GROUP BY a.status
  `, [today, ...subjectParams, ...classParams]);
  const todayStats = { present: 0, absent: 0, leave: 0 };
  todayRows.forEach(r => { todayStats[r.status] = r.cnt; });

  const recentDates = queryAll(`
    SELECT a.date,
      SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present,
      COUNT(*) as total
    FROM attendance a JOIN students s ON a.student_id = s.student_id
    WHERE 1=1 ${subjectFilter} ${classFilter}
    GROUP BY a.date ORDER BY a.date DESC LIMIT 7
  `, [...subjectParams, ...classParams]);

  const totalDays = queryOne(
    `SELECT COUNT(DISTINCT a.date) as c FROM attendance a
     JOIN students s ON a.student_id = s.student_id
     WHERE 1=1 ${subjectFilter} ${classFilter}`,
    [...subjectParams, ...classParams]
  ).c;

  // Class breakdown — only classes in scope
  let breakdownFilter = classFilter;
  let breakdownParams = classParams;
  const classBreakdown = queryAll(`
    SELECT c.id, c.class_code, c.class_name, c.grade, c.room, c.teacher,
      COUNT(DISTINCT s.id) as student_count,
      SUM(CASE WHEN a.date=? AND a.status='present' ${subjectFilter} THEN 1 ELSE 0 END) as today_present
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id
    LEFT JOIN attendance a ON a.student_id = s.student_id
    WHERE 1=1 ${breakdownFilter.replace(/AND s\.class_id/g, 'AND c.id')}
    GROUP BY c.id ORDER BY c.grade ASC, CAST(c.room AS INTEGER) ASC
  `, [today, ...subjectParams, ...breakdownParams]);

  // Subject breakdown (for teacher: their subjects; for admin: all)
  let subjectBreakdown = [];
  if (!subject_id) {
    let subjectScope = '';
    let subjectScopeParams = [];
    if (scope && scope.subjectIds.length > 0) {
      const ph = scope.subjectIds.map(() => '?').join(',');
      subjectScope = `AND sub.id IN (${ph})`;
      subjectScopeParams = scope.subjectIds;
    }
    subjectBreakdown = queryAll(`
      SELECT sub.id, sub.subject_code, sub.subject_name, sub.color, sub.icon,
        COUNT(DISTINCT a.id) as total_records,
        SUM(CASE WHEN a.date=? AND a.status='present' THEN 1 ELSE 0 END) as today_present
      FROM subjects sub
      LEFT JOIN attendance a ON a.subject_id = sub.id
      LEFT JOIN students s ON a.student_id = s.student_id
      WHERE 1=1 ${subjectScope} ${classFilter}
      GROUP BY sub.id ORDER BY sub.subject_code
    `, [today, ...subjectScopeParams, ...classParams]);
  }

  res.json({
    totalStudents, today, todayStats, recentDates, totalDays,
    classBreakdown, subjectBreakdown,
    isAdmin: req.session.role === 'admin',
    scope: scope ? { classIds: scope.classIds, subjectIds: scope.subjectIds } : null
  });
});

// ── DELETE attendance for a date ───────────────────────────────────────────
router.delete('/date/:date', (req, res) => {
  const { date } = req.params;
  const { class_id, subject_id } = req.query;
  try {
    if (class_id) {
      const students = queryAll('SELECT student_id FROM students WHERE class_id = ?', [class_id]);
      const ids = students.map(s => `'${s.student_id}'`).join(',');
      if (ids.length > 0) {
        const subWhere = subject_id ? 'AND subject_id = ?' : '';
        run(`DELETE FROM attendance WHERE date=? AND student_id IN (${ids}) ${subWhere}`,
          subject_id ? [date, subject_id] : [date]);
      }
    } else {
      const subWhere = subject_id ? 'AND subject_id = ?' : '';
      run(`DELETE FROM attendance WHERE date=? ${subWhere}`,
        subject_id ? [date, subject_id] : [date]);
    }
    res.json({ success: true, message: `ลบข้อมูลการเช็กชื่อวันที่ ${date} เรียบร้อย` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE single student on a date ───────────────────────────────────────
router.delete('/student/:student_id/date/:date', (req, res) => {
  const { student_id, date } = req.params;
  const { subject_id } = req.query;
  const subWhere = subject_id ? 'AND subject_id = ?' : '';
  run(`DELETE FROM attendance WHERE student_id=? AND date=? ${subWhere}`,
    subject_id ? [student_id, date, subject_id] : [student_id, date]);
  res.json({ success: true, message: 'ลบข้อมูลเรียบร้อย' });
});

// ── DELETE all attendance ──────────────────────────────────────────────────
router.delete('/all', (req, res) => {
  const { class_id, subject_id } = req.query;
  if (class_id) {
    const students = queryAll('SELECT student_id FROM students WHERE class_id = ?', [class_id]);
    const ids = students.map(s => `'${s.student_id}'`).join(',');
    if (ids.length > 0) {
      const subWhere = subject_id ? 'AND subject_id = ?' : '';
      run(`DELETE FROM attendance WHERE student_id IN (${ids}) ${subWhere}`,
        subject_id ? [subject_id] : []);
    }
  } else {
    const subWhere = subject_id ? 'WHERE subject_id = ?' : '';
    run(`DELETE FROM attendance ${subWhere}`, subject_id ? [subject_id] : []);
  }
  res.json({ success: true, message: 'ล้างข้อมูลการเช็กชื่อทั้งหมดเรียบร้อย' });
});

module.exports = router;

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'attendance.db');
let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  // ── Classes ────────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS classes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    class_code    TEXT UNIQUE NOT NULL,
    class_name    TEXT NOT NULL,
    grade         TEXT NOT NULL DEFAULT '',
    room          TEXT NOT NULL DEFAULT '',
    teacher       TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now'))
  )`);

  // ── Students ───────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    TEXT UNIQUE NOT NULL,
    national_id   TEXT DEFAULT NULL,
    name          TEXT NOT NULL,
    class         TEXT NOT NULL,
    class_id      INTEGER REFERENCES classes(id),
    number        INTEGER NOT NULL,
    birthdate     TEXT DEFAULT NULL,
    student_status TEXT DEFAULT 'กำลังศึกษา',
    photo         TEXT DEFAULT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  )`);

  // ── Attendance ─────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  TEXT NOT NULL,
    date        TEXT NOT NULL,
    status      TEXT NOT NULL,
    note        TEXT DEFAULT '',
    subject_id  INTEGER DEFAULT NULL,
    checked_by  INTEGER DEFAULT NULL,
    checked_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, date, subject_id)
  )`);

  // ── Users (ครู) ────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    password     TEXT NOT NULL,
    full_name    TEXT NOT NULL DEFAULT '',
    role         TEXT NOT NULL DEFAULT 'teacher',
    created_at   TEXT DEFAULT (datetime('now'))
  )`);

  // ── Subjects (รายวิชา) ─────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_code TEXT UNIQUE NOT NULL,
    subject_name TEXT NOT NULL,
    color        TEXT NOT NULL DEFAULT '#6366f1',
    icon         TEXT NOT NULL DEFAULT '📚'
  )`);

  // ── Teacher ↔ Subject ↔ Class (สอนวิชาอะไร ห้องไหน) ──────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS teacher_subjects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    class_id   INTEGER NOT NULL REFERENCES classes(id),
    UNIQUE(user_id, subject_id, class_id)
  )`);

  // ── Teacher homeroom (ครูประจำชั้น) ───────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS teacher_homeroom (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    UNIQUE(user_id, class_id)
  )`);

  // ── Migrations ─────────────────────────────────────────────────────────────
  try { db.run('ALTER TABLE students ADD COLUMN class_id INTEGER REFERENCES classes(id)'); } catch(e){}
  try { db.run('ALTER TABLE students ADD COLUMN national_id TEXT DEFAULT NULL'); } catch(e){}
  try { db.run('ALTER TABLE students ADD COLUMN birthdate TEXT DEFAULT NULL'); } catch(e){}
  try { db.run('ALTER TABLE students ADD COLUMN student_status TEXT DEFAULT \'กำลังศึกษา\''); } catch(e){}
  try { db.run('ALTER TABLE attendance ADD COLUMN subject_id INTEGER DEFAULT NULL'); } catch(e){}
  try { db.run('ALTER TABLE attendance ADD COLUMN checked_by INTEGER DEFAULT NULL'); } catch(e){}
  // Fix old UNIQUE constraint: drop & recreate attendance if needed
  try {
    const idx = queryOne("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='attendance' AND sql LIKE '%subject_id%'");
    if (!idx) {
      db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_att_unique ON attendance(student_id, date, COALESCE(subject_id,-1))');
    }
  } catch(e){}

  // ── Seed subjects ──────────────────────────────────────────────────────────
  const subCount = queryOne('SELECT COUNT(*) as c FROM subjects').c;
  if (subCount === 0) {
    const subjects = [
      ['TH01', 'ภาษาไทย',     '#ef4444', '📖'],
      ['MA01', 'คณิตศาสตร์',  '#f59e0b', '🔢'],
      ['SC01', 'วิทยาศาสตร์', '#10b981', '🔬'],
      ['EN01', 'ภาษาอังกฤษ',  '#3b82f6', '🌍'],
      ['SO01', 'สังคมศึกษา',  '#8b5cf6', '🌏'],
    ];
    for (const [code, name, color, icon] of subjects) {
      run('INSERT INTO subjects (subject_code, subject_name, color, icon) VALUES (?,?,?,?)',
        [code, name, color, icon]);
    }
    console.log('✅ Seeded 5 default subjects');
  }

  // ── Seed admin user only (no sample data) ─────────────────────────────────
  const userCount = queryOne('SELECT COUNT(*) as c FROM users').c;
  if (userCount === 0) {
    run('INSERT INTO users (username, password, full_name, role) VALUES (?,?,?,?)',
      ['admin', bcrypt.hashSync('admin1234', 10), 'ผู้ดูแลระบบ', 'admin']);
    console.log('✅ Created admin account (admin / admin1234)');
  }

  // ── Migrate unlinked students (existing DB) ────────────────────────────────
  const unlinked = queryAll('SELECT student_id, class FROM students WHERE class_id IS NULL');
  for (const s of unlinked) {
    const cls = queryOne('SELECT id FROM classes WHERE class_code = ?', [s.class]);
    if (cls) run('UPDATE students SET class_id = ? WHERE student_id = ?', [cls.id, s.student_id]);
  }
  if (unlinked.length > 0) { console.log(`✅ Migrated ${unlinked.length} students`); saveDb(); }

  return db;
}

function getDb() { return db; }

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (e) { throw e; }
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

module.exports = { initDb, getDb, queryAll, queryOne, run, saveDb };

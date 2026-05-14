const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { initDb } = require('./database');
const { requireAuth } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'attendance-secret-key-2567',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Public API routes (no auth needed) ────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── Protected API routes ───────────────────────────────────────────────────
app.use('/api/classes',    requireAuth, require('./routes/classes'));
app.use('/api/students',   requireAuth, require('./routes/students'));
app.use('/api/attendance', requireAuth, require('./routes/attendance'));
app.use('/api/subjects',   requireAuth, require('./routes/subjects'));
app.use('/api/users',      requireAuth, require('./routes/users'));

// ── Serve login page for unauthenticated requests ──────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🏫 ระบบเช็กชื่อนักเรียน`);
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🔑 Login: admin / admin1234\n`);
  });
}).catch(err => {
  console.error('❌ DB init failed:', err);
  process.exit(1);
});

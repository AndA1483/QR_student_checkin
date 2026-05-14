/* ===== Global App Utilities ===== */
const API = '/api';

// ── Current user (loaded on DOMContentLoaded) ──────────────────────────────
let currentUser = null;

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container'; el.className = 'toast-container';
    document.body.appendChild(el); return el;
  })();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

// ── Date helpers ───────────────────────────────────────────────────────────
function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function getTodayISO() { return new Date().toISOString().split('T')[0]; }

// ── API helpers ────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options
  });
  if (res.status === 401) { window.location.href = '/login.html'; return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function loadCurrentUser() {
  try {
    currentUser = await apiFetch('/auth/me');
    return currentUser;
  } catch(e) {
    window.location.href = '/login.html';
    return null;
  }
}

async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

function renderUserInfo() {
  if (!currentUser) return;
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = currentUser.full_name;
  if (roleEl) roleEl.textContent = currentUser.role === 'admin' ? '👑 Admin' : '👩‍🏫 ครู';
  if (avatarEl) avatarEl.textContent = currentUser.full_name?.[0] || '?';
  // Show admin-only nav items
  if (currentUser.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
}

// ── Class selector ─────────────────────────────────────────────────────────
let _classCache = null;

async function loadClasses(grade = '') {
  if (!grade) {
    if (_classCache) return _classCache;
    _classCache = await apiFetch('/classes');
    return _classCache;
  }
  return await apiFetch(`/classes?grade=${encodeURIComponent(grade)}`);
}

async function populateClassSelect(selectId, allLabel = 'ทุกชั้นเรียน', selectedId = null, gradeFilter = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const classes = await loadClasses(gradeFilter);
  sel.innerHTML = '';
  if (allLabel !== null) sel.innerHTML = `<option value="">— ${allLabel} —</option>`;
  const groups = {};
  classes.forEach(c => { if (!groups[c.grade]) groups[c.grade] = []; groups[c.grade].push(c); });
  Object.entries(groups).forEach(([grade, list]) => {
    const grp = document.createElement('optgroup');
    grp.label = grade;
    list.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.class_code} – ${c.class_name}`;
      if (selectedId && String(c.id) === String(selectedId)) opt.selected = true;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}

function getSelectedClassId(selectId) { return document.getElementById(selectId)?.value || ''; }
function classQuery(classId) { return classId ? `?class_id=${classId}` : ''; }

// ── Subject helpers ────────────────────────────────────────────────────────
let _subjectCache = null;
async function loadSubjects() {
  if (_subjectCache) return _subjectCache;
  _subjectCache = await apiFetch('/subjects');
  return _subjectCache;
}

async function populateSubjectSelect(selectId, allLabel = 'ทุกวิชา', selectedId = null) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const subjects = await loadSubjects();
  sel.innerHTML = allLabel !== null ? `<option value="">— ${allLabel} —</option>` : '';
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.icon} ${s.subject_name}`;
    if (selectedId && String(s.id) === String(selectedId)) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Avatar / display helpers ───────────────────────────────────────────────
function getInitials(name) {
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? parts[parts.length-2][0] + parts[parts.length-1][0] : name[0] || '?';
}
function avatarHtml(student) {
  if (student.photo)
    return `<div class="avatar"><img src="${student.photo}" alt="${student.name}" onerror="this.parentElement.innerHTML='${getInitials(student.name)}'"></div>`;
  return `<div class="avatar">${getInitials(student.name)}</div>`;
}
function percentClass(p) {
  p = parseFloat(p);
  return p >= 80 ? 'high' : p >= 60 ? 'medium' : 'low';
}
function statusBadge(status) {
  return { present:'<span class="badge badge-present">✅ มาเรียน</span>',
           absent: '<span class="badge badge-absent">❌ ขาดเรียน</span>',
           leave:  '<span class="badge badge-leave">🟡 ลา</span>' }[status]
    || '<span class="badge badge-none">— ยังไม่เช็ก</span>';
}

// ── Sidebar toggle ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth check — redirect to login if not authenticated
  const isLoginPage = window.location.pathname.endsWith('login.html');
  if (!isLoginPage) {
    await loadCurrentUser();
    renderUserInfo();
  }

  const toggle  = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  toggle?.addEventListener('click', () => { sidebar?.classList.toggle('open'); overlay?.classList.toggle('show'); });
  overlay?.addEventListener('click', () => { sidebar?.classList.remove('open'); overlay?.classList.remove('show'); });

  const dateEl = document.getElementById('header-date');
  if (dateEl) dateEl.textContent = formatThaiDate(getTodayISO());

  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('show'); });
  });
});

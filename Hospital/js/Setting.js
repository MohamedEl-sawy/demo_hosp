'use strict';
/* ═══════════════════════════════════════════════════
   SAFE HEART — SETTINGS JS
═══════════════════════════════════════════════════ */

/* ═══ PAGE LOADER ═══ */
window.addEventListener('load', () => {
  setDateTime();
  setLastUpdate();
  startClock();
  setTimeout(() => document.getElementById('pageLoader').classList.add('hidden'), 800);
});

/* ═══ CLOCK ═══ */
function setDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  document.getElementById('topbarClock').textContent = `${date}  ${time}`;
}
function startClock() { setInterval(setDateTime, 1000); }

function setLastUpdate() {
  const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  document.getElementById('lastUpdate').textContent =
    d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

/* ═══ TOAST ═══ */
let toastTimer = null;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toastMsg');
  m.textContent = msg;
  t.classList.toggle('error', isError);
  t.querySelector('i').className = isError ? 'fas fa-times-circle' : 'fas fa-check-circle';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ═══ SIDEBAR ═══ */
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
document.getElementById('menuBtn').addEventListener('click', () => {
  sidebar.classList.add('active'); overlay.classList.add('active');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('active'); overlay.classList.remove('active');
});

/* ═══ LOCK SCREEN ═══ */
const CORRECT_PIN = '1234';
document.getElementById('lockBtn').addEventListener('click', () => {
  document.getElementById('lockScreen').classList.add('active');
  document.getElementById('lockPin').value = '';
  document.getElementById('lockPin').focus();
});
document.getElementById('unlockBtn').addEventListener('click', tryUnlock);
document.getElementById('lockPin').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
function tryUnlock() {
  const pin = document.getElementById('lockPin');
  if (pin.value === CORRECT_PIN) {
    document.getElementById('lockScreen').classList.remove('active');
  } else {
    pin.style.borderColor = 'var(--red)';
    pin.style.animation   = 'shake .3s ease';
    setTimeout(() => { pin.style.borderColor = ''; pin.style.animation = ''; pin.value = ''; }, 600);
  }
}

/* ═══ AVATAR UPLOAD ═══ */
document.getElementById('avatarInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('File too large. Max 2MB.', true); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('avatarPreview');
    let img = prev.querySelector('img');
    if (!img) { img = document.createElement('img'); prev.appendChild(img); }
    img.src = e.target.result;
    document.getElementById('avatarInitials').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

/* ═══ PROFILE SAVE ═══ */
function saveProfile() {
  const name  = document.getElementById('adminName').value.trim();
  const email = document.getElementById('adminEmail').value.trim();
  if (!name)  { showToast('Name cannot be empty.', true); return; }
  if (!email || !email.includes('@')) { showToast('Enter a valid email.', true); return; }
  // update sidebar initials
  const parts = name.split(' ');
  const initials = (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  document.getElementById('avatarInitials').textContent = initials;
  document.querySelector('.sb-user-info p').textContent = name;
  showToast('Profile saved successfully!');
}

/* ═══ SYSTEM PREFERENCES ═══ */
document.getElementById('darkModeToggle').addEventListener('change', function () {
  document.body.classList.toggle('dark', this.checked);
  showToast(this.checked ? 'Dark mode enabled.' : 'Light mode enabled.');
});

function savePrefs() {
  const lang = document.getElementById('langSelect').value;
  showToast(`Preferences saved. Language: ${lang.toUpperCase()}`);
}

/* ═══ PASSWORD ═══ */
function togglePass(id, btn) {
  const inp = document.getElementById(id);
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.querySelector('i').className = isText ? 'fas fa-eye' : 'fas fa-eye-slash';
}

document.getElementById('newPass').addEventListener('input', function () {
  const v = this.value;
  const bar = document.getElementById('passStrength');
  const fill = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  if (!v) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  const levels = [
    { w:'20%', c:'#e24b4a', l:'Weak' },
    { w:'45%', c:'#f59e0b', l:'Fair' },
    { w:'70%', c:'#378add', l:'Good' },
    { w:'100%',c:'#1d9e75', l:'Strong' }
  ];
  const lv = levels[score - 1] || levels[0];
  fill.style.width = lv.w; fill.style.background = lv.c;
  label.textContent = lv.l; label.style.color = lv.c;
});

function updatePassword() {
  const curr = document.getElementById('currentPass').value;
  const nw   = document.getElementById('newPass').value;
  const conf = document.getElementById('confirmPass').value;
  if (!curr)              { showToast('Enter current password.', true); return; }
  if (nw.length < 8)     { showToast('New password must be at least 8 characters.', true); return; }
  if (nw !== conf)        { showToast('Passwords do not match.', true); return; }
  document.getElementById('currentPass').value = '';
  document.getElementById('newPass').value     = '';
  document.getElementById('confirmPass').value = '';
  document.getElementById('passStrength').style.display = 'none';
  showToast('Password updated successfully!');
}

/* ═══ NOTIFICATION CARD SYNC ═══ */
function syncNotifCard(input, cardId) {
  const card = document.getElementById(cardId);
  card.style.opacity = input.checked ? '1' : '.5';
}

function saveNotif() { showToast('Notification settings saved!'); }

/* ═══ SHAKE ANIMATION ═══ */
const style = document.createElement('style');
style.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`;
document.head.appendChild(style);
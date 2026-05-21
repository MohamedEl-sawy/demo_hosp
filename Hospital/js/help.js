'use strict';
/* ═══════════════════════════════════════════════════
   SAFE HEART — HELP JS
═══════════════════════════════════════════════════ */

/* ═══ PAGE LOADER ═══ */
window.addEventListener('load', () => {
  setDateTime();
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

/* ═══ TOAST ═══ */
let toastTimer = null;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
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
    pin.style.borderColor = '#E24B4A';
    setTimeout(() => { pin.style.borderColor = ''; pin.value = ''; }, 600);
  }
}

/* ═══ FAQ ACCORDION ═══ */
function toggleFAQ(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('faq-open');

  // close all
  document.querySelectorAll('.faq-item.faq-open').forEach(i => i.classList.remove('faq-open'));

  // open if was closed
  if (!isOpen) item.classList.add('faq-open');
}

/* ═══ SEARCH / FILTER ═══ */
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

searchInput.addEventListener('input', filterFAQ);

function filterFAQ() {
  const q = searchInput.value.trim().toLowerCase();
  searchClear.style.display = q ? 'block' : 'none';

  const items = document.querySelectorAll('.faq-item[data-keywords]');
  let visible = 0;

  items.forEach(item => {
    const keywords = item.getAttribute('data-keywords') || '';
    const question = item.querySelector('.faq-q-wrap span')?.textContent.toLowerCase() || '';
    const body     = item.querySelector('.faq-body')?.textContent.toLowerCase() || '';
    const matches  = !q || keywords.includes(q) || question.includes(q) || body.includes(q);

    item.classList.toggle('faq-hidden', !matches);
    if (matches) visible++;
  });

  // update count
  document.getElementById('faqCount').textContent = visible + (visible === 1 ? ' article' : ' articles');

  // no results
  const nr = document.getElementById('noResults');
  if (visible === 0 && q) {
    nr.style.display = 'block';
    document.getElementById('noResultsQuery').textContent = q;
  } else {
    nr.style.display = 'none';
  }
}

function clearSearch() {
  searchInput.value = '';
  filterFAQ();
  searchInput.focus();
}

function quickSearch(term) {
  searchInput.value = term;
  filterFAQ();
  searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ═══ EMERGENCY CALL ═══ */
function callEmergency() {
  if (confirm('Call Safe Heart Emergency Support?\n\n+20 100 861 1382\n\nThis will initiate a phone call.')) {
    window.location.href = 'tel:+201008611382';
  }
}
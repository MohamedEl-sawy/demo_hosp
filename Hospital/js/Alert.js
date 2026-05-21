/* ═══════════════════════════════════════════════════
   SAFE HEART — ALERTS PAGE JS  (Firebase Realtime DB)
   ═══════════════════════════════════════════════════ */

'use strict';

/* ════════ FIREBASE CONFIG ════════ */
const FIREBASE_URL = 'https://safeheart-2d878-default-rtdb.firebaseio.com';

/* ════════ ALERT TYPE MAP ════════ */
const ALERT_TYPES = {
    HIGH_HEART:   { label: 'High Heart Rate',      icon: 'fas fa-heartbeat',        unit: 'BPM',    typeKey: 'heartRate' },
    LOW_HEART:    { label: 'Low Heart Rate',        icon: 'fas fa-heartbeat',        unit: 'BPM',    typeKey: 'heartRate' },
    HIGH_TEMP:    { label: 'Temperature Spike',     icon: 'fas fa-thermometer-full', unit: '°C',     typeKey: 'tempSpike' },
    LOW_TEMP:     { label: 'Low Temperature',       icon: 'fas fa-thermometer-empty',unit: '°C',     typeKey: 'tempSpike' },
    LOW_SPO2:     { label: 'Low SpO₂',              icon: 'fas fa-lungs',            unit: '%',      typeKey: 'lowSpO2'   },
    HIGH_BP:      { label: 'High Blood Pressure',   icon: 'fas fa-tachometer-alt',   unit: 'mmHg',   typeKey: 'highBP'    },
    LOW_BP:       { label: 'Low Blood Pressure',    icon: 'fas fa-tachometer-alt',   unit: 'mmHg',   typeKey: 'lowBP'     },
    ARRHYTHMIA:   { label: 'Arrhythmia Detected',   icon: 'fas fa-wave-square',      unit: '',       typeKey: 'arrhythmia'},
    HIGH_GLUCOSE: { label: 'High Blood Glucose',    icon: 'fas fa-vial',             unit: 'mg/dL',  typeKey: 'highGlucose'},
    LOW_RESP:     { label: 'Low Respiratory Rate',  icon: 'fas fa-wind',             unit: 'br/min', typeKey: 'lowRespRate'},
};

/* fallback for unknown types */
function resolveType(typeStr) {
    if (!typeStr) return { label: 'Alert', icon: 'fas fa-bell', unit: '' };
    // exact match
    if (ALERT_TYPES[typeStr]) return ALERT_TYPES[typeStr];
    // partial match (e.g. "HIGH_HEART_RATE" → HIGH_HEART)
    const key = Object.keys(ALERT_TYPES).find(k => typeStr.toUpperCase().includes(k));
    return key ? ALERT_TYPES[key] : { label: typeStr, icon: 'fas fa-bell', unit: '' };
}

/* ════════ STATE ════════ */
let ALERTS        = [];   // combined & enriched from Firebase
let statusFilter  = 'all';
let timeFilter    = 'today';
let sortBy        = 'severity';
let activeDetailId = null;
let activeNoteId   = null;

/* ════════ DOM ════════ */
const $ = id => document.getElementById(id);
const DOM = {
    loader:        $('pageLoader'),
    sidebar:       $('sidebar'),
    overlay:       $('overlay'),
    menuBtn:       $('menuBtn'),
    lockBtn:       $('lockBtn'),
    logoutBtn:     $('logoutBtn'),
    lockScreen:    $('lockScreen'),
    lockPin:       $('lockPin'),
    unlockBtn:     $('unlockBtn'),
    navAlertCount: $('navAlertCount'),

    statTotal:    $('statTotal'),
    statActive:   $('statActive'),
    statCritical: $('statCritical'),
    statResolved: $('statResolved'),

    statusFilters: document.querySelectorAll('#statusFilters .fpill'),
    timeFilters:   document.querySelectorAll('#timeFilters .fpill'),
    sortSelect:    $('sortSelect'),
    alertCountLabel: $('alertCountLabel'),

    alertsGrid:    $('alertsGrid'),
    emptyState:    $('emptyState'),
    resolveAllBtn: $('resolveAllBtn'),

    detailModal:     $('detailModal'),
    closeDetailBtn:  $('closeDetailBtn'),
    closeDetailBtn2: $('closeDetailBtn2'),
    modalTitle:      $('modalTitle'),
    modalSubtitle:   $('modalSubtitle'),
    dPatientName:    $('dPatientName'),
    dPatientId:      $('dPatientId'),
    dRoom:           $('dRoom'),
    dDept:           $('dDept'),
    dAge:            $('dAge'),
    dBlood:          $('dBlood'),
    dEmName:         $('dEmName'),
    dEmRelation:     $('dEmRelation'),
    dEmPhone:        $('dEmPhone'),
    dCallBtn:        $('dCallBtn'),
    readingsTimeline: $('readingsTimeline'),
    modalNotes:      $('modalNotes'),
    saveNoteBtn:     $('saveNoteBtn'),
    modalResolveBtn: $('modalResolveBtn'),

    noteModal:        $('noteModal'),
    notePatientLabel: $('notePatientLabel'),
    closeNoteBtn:     $('closeNoteBtn'),
    cancelNoteBtn:    $('cancelNoteBtn'),
    saveNoteModalBtn: $('saveNoteModalBtn'),
    noteText:         $('noteText'),

    logoutModal:     $('logoutModal'),
    cancelLogoutBtn: $('cancelLogoutBtn'),
    doLogoutBtn:     $('doLogoutBtn'),

    toast:     $('toast'),
    toastIcon: $('toastIcon'),
    toastMsg:  $('toastMsg'),
};

/* ════════════════════════════════════════════════════
   FIREBASE REST HELPERS
   ════════════════════════════════════════════════════ */

async function fbGet(path) {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`);
    if (!res.ok) throw new Error(`Firebase GET failed: ${path}`);
    return res.json();
}

async function fbPatch(path, data) {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Firebase PATCH failed: ${path}`);
    return res.json();
}

/* ════════════════════════════════════════════════════
   DATA LOADING & ENRICHMENT
   ════════════════════════════════════════════════════ */

async function loadAllData() {
    /* 1. fetch all four nodes in parallel */
    const [inPatientsRaw, usersRaw, alertsRaw, contactsRaw, historyRaw] = await Promise.all([
        fbGet('inPatients'),
        fbGet('users'),
        fbGet('alerts'),
        fbGet('emergency_contacts'),
        fbGet('history'),
    ]);

    const inPatients      = inPatientsRaw      || {};
    const users           = usersRaw           || {};
    const alertsNode      = alertsRaw          || {};
    const contactsNode    = contactsRaw        || {};
    const historyNode     = historyRaw         || {};

    /* 2. build set of admitted user IDs */
    const admittedIds = new Set(Object.keys(inPatients));

    /* 3. flatten alerts for admitted patients only */
    const combined = [];

    for (const userId of admittedIds) {
        const userAlerts = alertsNode[userId];
        if (!userAlerts) continue;

        const userInfo    = users[userId]          || {};
        const inPInfo     = inPatients[userId]     || {};
        const contacts    = contactsNode[userId]   || {};
        const userHistory = historyNode[userId]    || {};

        /* pick first (highest priority) emergency contact */
        const contactList = Object.values(contacts);
        contactList.sort((a, b) => (a.priority || 99) - (b.priority || 99));
        const emergencyContact = contactList[0] || {};

        /* build readings from history (last 4 snapshots, newest first) */
        const histEntries = Object.entries(userHistory)
            .sort(([a], [b]) => Number(b) - Number(a))
            .slice(0, 4);

        for (const [alertId, alertData] of Object.entries(userAlerts)) {
            const typeInfo = resolveType(alertData.type);

            /* derive severity from inPatients status OR resolved flag */
            let severity = 'Warning';
            if (alertData.resolved) {
                severity = 'Resolved';
            } else {
                severity = inPInfo.status || 'Warning';  // "Critical" or "Warning"
            }

            /* time label from timestamp */
            const ts        = alertData.timestamp ? Number(alertData.timestamp) * 1000 : Date.now();
            const timeLabel = relativeTime(ts);
            const timeGroup = timeGroupOf(ts);

            /* readings from history: filter by matching metric */
            const readings = buildReadings(histEntries, alertData.type, typeInfo);

            combined.push({
                id:       `${userId}__${alertId}`,
                fbUserId: userId,
                fbAlertId: alertId,
                typeKey:  alertData.type,
                severity,
                value:    String(alertData.value ?? ''),
                patient: {
                    name:  userInfo.name  || userId,
                    id:    userInfo.idHuman || userId,
                    room:  inPInfo.room   || '—',
                    dept:  userInfo.dept  || 'General',
                    age:   userInfo.age   || '—',
                    blood: userInfo.blood || '—',
                },
                emergency: {
                    name:     emergencyContact.name         || '—',
                    relation: emergencyContact.relationship || '—',
                    phone:    emergencyContact.phone        || '—',
                },
                timeLabel,
                timeGroup,
                resolved: !!alertData.resolved,
                note:     alertData.note || '',
                readings,
                _ts: ts,
            });
        }
    }

    /* 4. sort by timestamp desc by default */
    combined.sort((a, b) => b._ts - a._ts);
    ALERTS = combined;
}

/* ─── helpers ─── */

function relativeTime(ms) {
    const diff = Date.now() - ms;
    const mins = Math.round(diff / 60000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)   return `${hrs} hr ago`;
    const days = Math.round(hrs / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
}

function timeGroupOf(ms) {
    const diff = Date.now() - ms;
    const hrs  = diff / 3600000;
    if (hrs < 12)  return 'today';
    if (hrs < 24)  return '24h';
    return 'week';
}

function buildReadings(histEntries, alertType, typeInfo) {
    /* map alert type → history field */
    const fieldMap = {
        HIGH_HEART: 'heartRate', LOW_HEART: 'heartRate',
        HIGH_TEMP:  'temp',      LOW_TEMP:  'temp',
        LOW_SPO2:   'spo2',
        HIGH_BP:    'bp',        LOW_BP:    'bp',
    };
    const field = fieldMap[alertType] || null;

    return histEntries.map(([ts, snap]) => {
        const val   = field && snap[field] != null ? snap[field] : (snap.heartRate ?? snap.temp ?? snap.spo2 ?? '—');
        const label = typeInfo.label || alertType;
        const time  = new Date(Number(ts) * 1000).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
        const numVal = parseFloat(val);
        let level = 'normal';
        /* simple thresholds for colour coding */
        if (alertType === 'HIGH_HEART' && numVal > 130) level = 'critical';
        else if (alertType === 'HIGH_HEART' && numVal > 100) level = 'warning';
        else if (alertType === 'LOW_SPO2'  && numVal < 90)  level = 'critical';
        else if (alertType === 'LOW_SPO2'  && numVal < 95)  level = 'warning';
        else if (alertType === 'HIGH_TEMP' && numVal > 38.5) level = 'critical';
        else if (alertType === 'HIGH_TEMP' && numVal > 37.5) level = 'warning';

        return { time, label, value: `${val}${typeInfo.unit ? ' ' + typeInfo.unit : ''}`, level };
    });
}

/* ════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════ */

window.addEventListener('load', async () => {
    try {
        await loadAllData();
    } catch (err) {
        console.error('Firebase load error:', err);
        showToast('Failed to load data from Firebase', 'error');
    }
    setTimeout(() => {
        DOM.loader.classList.add('hidden');
        animateStats();
        render();
    }, 900);

    /* live refresh every 30 s */
    setInterval(async () => {
        try {
            await loadAllData();
            render();
            updateStats();
        } catch (e) { /* silent */ }
    }, 30000);
});

/* ════════════════════════════════════════════════════
   STATS
   ════════════════════════════════════════════════════ */

function animateCount(el, target, dur = 800) {
    let start = null;
    const step = ts => {
        if (!start) start = ts;
        const prog = Math.min((ts - start) / dur, 1);
        const ease = 1 - Math.pow(1 - prog, 3);
        el.textContent = Math.round(ease * target);
        if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function animateStats() {
    const t = computeStats();
    animateCount(DOM.statTotal,    t.total);
    animateCount(DOM.statActive,   t.active);
    animateCount(DOM.statCritical, t.critical);
    animateCount(DOM.statResolved, t.resolved);
    DOM.navAlertCount.textContent = t.active;
}

function computeStats() {
    return {
        total:    ALERTS.length,
        active:   ALERTS.filter(a => !a.resolved).length,
        critical: ALERTS.filter(a => a.severity === 'Critical' && !a.resolved).length,
        resolved: ALERTS.filter(a => a.resolved).length,
    };
}

function updateStats() {
    const t = computeStats();
    DOM.statTotal.textContent    = t.total;
    DOM.statActive.textContent   = t.active;
    DOM.statCritical.textContent = t.critical;
    DOM.statResolved.textContent = t.resolved;
    DOM.navAlertCount.textContent = t.active;
}

/* ════════════════════════════════════════════════════
   FILTER + RENDER
   ════════════════════════════════════════════════════ */

function getFiltered() {
    let list = [...ALERTS];

    if (statusFilter !== 'all') {
        if (statusFilter === 'Resolved') {
            list = list.filter(a => a.resolved);
        } else {
            list = list.filter(a => a.severity === statusFilter && !a.resolved);
        }
    }

    if (timeFilter !== 'week') {
        list = list.filter(a => {
            if (timeFilter === 'today') return a.timeGroup === 'today';
            if (timeFilter === '24h')   return a.timeGroup === 'today' || a.timeGroup === '24h';
            return true;
        });
    }

    const severityOrder = { Critical: 0, Warning: 1, Resolved: 2 };
    if (sortBy === 'severity') {
        list.sort((a, b) => {
            if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
            return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
        });
    } else if (sortBy === 'patient') {
        list.sort((a, b) => a.patient.name.localeCompare(b.patient.name));
    } else if (sortBy === 'time') {
        list.sort((a, b) => b._ts - a._ts);
    }

    return list;
}

function render() {
    const list = getFiltered();
    DOM.alertCountLabel.textContent = `Showing ${list.length} alert${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        DOM.alertsGrid.innerHTML = '';
        DOM.emptyState.classList.add('visible');
        return;
    }
    DOM.emptyState.classList.remove('visible');
    DOM.alertsGrid.innerHTML = list.map((a, i) => buildCard(a, i)).join('');
}

/* ════════════════════════════════════════════════════
   BUILD CARD
   ════════════════════════════════════════════════════ */

function buildCard(a, index) {
    const type      = resolveType(a.typeKey);
    const statusCls = a.resolved ? 'resolved' : a.severity.toLowerCase();
    const isLive    = !a.resolved;

    const liveBadge = isLive
        ? `<div class="live-tag"><span class="live-tag-dot"></span>LIVE</div>`
        : '';

    const noteEl = a.note
        ? `<div class="ac-note visible"><i class="fas fa-sticky-note" style="margin-right:5px;color:var(--amber)"></i>${a.note}</div>`
        : `<div class="ac-note" id="note-${a.id}"></div>`;

    const resolvedAction = a.resolved
        ? `<span class="ac-btn resolved-tag"><i class="fas fa-check"></i> Resolved</span>`
        : `<button class="ac-btn resolve" onclick="resolveAlert('${a.id}')"><i class="fas fa-check"></i> Resolve</button>`;

    return `
    <div class="alert-card ${statusCls}" id="card-${CSS.escape(a.id)}" style="animation-delay:${index * 50}ms">
        <div class="ac-header">
            <div class="ac-type-wrap">
                <div class="ac-type-icon"><i class="${type.icon}"></i></div>
                <div class="ac-type-text">
                    <strong>${type.label}</strong>
                    <small>${a.patient.dept} · ${a.timeLabel}</small>
                </div>
            </div>
            <div class="ac-badges">
                <span class="status-badge ${statusCls}">${a.resolved ? 'Resolved' : a.severity}</span>
                ${liveBadge}
            </div>
        </div>

        <div class="ac-body">
            <div class="ac-row">
                <i class="fas fa-user"></i>
                <span>Patient</span>
                <strong>${a.patient.name}</strong>
            </div>
            <div class="ac-row">
                <i class="fas fa-door-open"></i>
                <span>Room</span>
                <strong>Rm ${a.patient.room} — ${a.patient.dept}</strong>
            </div>
        </div>

        <div class="ac-reading">
            <div>
                <div style="font-size:11px;color:var(--text-light);margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;font-weight:700">${type.label}</div>
                <div class="ac-reading-val">${a.value}${type.unit ? '<span style="font-size:14px;margin-left:3px">'+type.unit+'</span>' : ''}</div>
            </div>
            <div class="ac-reading-meta">
                <span>Last reading</span>
                <strong>${a.timeLabel}</strong>
            </div>
        </div>

        ${noteEl}

        <div class="ac-actions">
            <button class="ac-btn view"    onclick="openDetail('${a.id}')"><i class="fas fa-eye"></i> View</button>
            <a      class="ac-btn call"    href="tel:${a.emergency.phone}"><i class="fas fa-phone-alt"></i> Call</a>
            ${resolvedAction}
            <button class="ac-btn note"    onclick="openNote('${a.id}')"><i class="fas fa-sticky-note"></i> Note</button>
        </div>
    </div>`;
}

/* ════════════════════════════════════════════════════
   RESOLVE
   ════════════════════════════════════════════════════ */

async function resolveAlert(id) {
    const alert = ALERTS.find(a => a.id === id);
    if (!alert || alert.resolved) return;

    try {
        await fbPatch(`alerts/${alert.fbUserId}/${alert.fbAlertId}`, { resolved: true });
        alert.resolved = true;
        alert.severity = 'Resolved';
        render();
        updateStats();
        showToast(`Alert for ${alert.patient.name} marked as resolved`, 'success');
    } catch (e) {
        showToast('Failed to resolve alert', 'error');
    }
}

DOM.resolveAllBtn.addEventListener('click', async () => {
    const active = ALERTS.filter(a => !a.resolved);
    if (active.length === 0) { showToast('No active alerts to resolve', 'info'); return; }

    try {
        await Promise.all(active.map(a =>
            fbPatch(`alerts/${a.fbUserId}/${a.fbAlertId}`, { resolved: true })
        ));
        active.forEach(a => { a.resolved = true; a.severity = 'Resolved'; });
        render();
        updateStats();
        showToast(`${active.length} alerts resolved`, 'success');
    } catch (e) {
        showToast('Failed to resolve all alerts', 'error');
    }
});

/* ════════════════════════════════════════════════════
   DETAIL MODAL
   ════════════════════════════════════════════════════ */

function openDetail(id) {
    const a = ALERTS.find(x => x.id === id);
    if (!a) return;
    activeDetailId = id;

    const type = resolveType(a.typeKey);
    DOM.modalTitle.textContent    = type.label;
    DOM.modalSubtitle.textContent = `${a.timeLabel} · ${a.patient.dept}`;

    DOM.dPatientName.textContent = a.patient.name;
    DOM.dPatientId.textContent   = a.patient.id;
    DOM.dRoom.textContent        = `Room ${a.patient.room}`;
    DOM.dDept.textContent        = a.patient.dept;
    DOM.dAge.textContent         = a.patient.age !== '—' ? `${a.patient.age} years` : '—';
    DOM.dBlood.textContent       = a.patient.blood;

    DOM.dEmName.textContent     = a.emergency.name;
    DOM.dEmRelation.textContent = a.emergency.relation;
    DOM.dEmPhone.textContent    = a.emergency.phone;
    DOM.dCallBtn.href           = `tel:${a.emergency.phone}`;

    DOM.readingsTimeline.innerHTML = a.readings.length
        ? a.readings.map(r => `
            <div class="rt-item">
                <div class="rt-dot ${r.level}"></div>
                <div class="rt-body"><strong>${r.label}</strong><span>${r.time}</span></div>
                <div class="rt-val">${r.value}</div>
            </div>`).join('')
        : '<p style="color:var(--text-light);font-size:13px">No history available</p>';

    DOM.modalNotes.value = a.note || '';
    DOM.modalResolveBtn.style.display = a.resolved ? 'none' : 'flex';

    openModal('detailModal');
}

DOM.closeDetailBtn.addEventListener('click',  () => closeModal('detailModal'));
DOM.closeDetailBtn2.addEventListener('click', () => closeModal('detailModal'));

DOM.saveNoteBtn.addEventListener('click', async () => {
    if (!activeDetailId) return;
    const a = ALERTS.find(x => x.id === activeDetailId);
    if (!a) return;
    const note = DOM.modalNotes.value.trim();
    try {
        await fbPatch(`alerts/${a.fbUserId}/${a.fbAlertId}`, { note });
        a.note = note;
        closeModal('detailModal');
        render();
        showToast('Notes saved', 'success');
    } catch (e) {
        showToast('Failed to save notes', 'error');
    }
});

DOM.modalResolveBtn.addEventListener('click', () => {
    if (!activeDetailId) return;
    resolveAlert(activeDetailId);
    closeModal('detailModal');
});

/* ════════════════════════════════════════════════════
   NOTE MODAL
   ════════════════════════════════════════════════════ */

function openNote(id) {
    const a = ALERTS.find(x => x.id === id);
    if (!a) return;
    activeNoteId = id;
    DOM.notePatientLabel.textContent = a.patient.name;
    DOM.noteText.value = a.note || '';
    openModal('noteModal');
}

DOM.closeNoteBtn.addEventListener('click',  () => closeModal('noteModal'));
DOM.cancelNoteBtn.addEventListener('click', () => closeModal('noteModal'));

DOM.saveNoteModalBtn.addEventListener('click', async () => {
    if (!activeNoteId) return;
    const a = ALERTS.find(x => x.id === activeNoteId);
    if (!a) return;
    const note = DOM.noteText.value.trim();
    try {
        await fbPatch(`alerts/${a.fbUserId}/${a.fbAlertId}`, { note });
        a.note = note;
        render();
        showToast('Note saved', 'success');
    } catch (e) {
        showToast('Failed to save note', 'error');
    }
    closeModal('noteModal');
});

/* ════════════════════════════════════════════════════
   FILTERS
   ════════════════════════════════════════════════════ */

DOM.statusFilters.forEach(btn => {
    btn.addEventListener('click', () => {
        DOM.statusFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        statusFilter = btn.dataset.status;
        render();
    });
});

DOM.timeFilters.forEach(btn => {
    btn.addEventListener('click', () => {
        DOM.timeFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        timeFilter = btn.dataset.time;
        render();
    });
});

DOM.sortSelect.addEventListener('change', () => {
    sortBy = DOM.sortSelect.value;
    render();
});

/* ════════════════════════════════════════════════════
   SIDEBAR
   ════════════════════════════════════════════════════ */

DOM.menuBtn.addEventListener('click', () => {
    DOM.sidebar.classList.add('active');
    DOM.overlay.classList.add('active');
});
DOM.overlay.addEventListener('click', closeSidebar);
document.querySelectorAll('.sb-link').forEach(l => {
    l.addEventListener('click', () => { if (window.innerWidth <= 992) closeSidebar(); });
});
function closeSidebar() {
    DOM.sidebar.classList.remove('active');
    DOM.overlay.classList.remove('active');
}

/* ════════════════════════════════════════════════════
   LOCK SCREEN
   ════════════════════════════════════════════════════ */

DOM.lockBtn.addEventListener('click', () => {
    DOM.lockScreen.classList.add('active');
    closeSidebar();
    document.body.style.overflow = 'hidden';
});
DOM.unlockBtn.addEventListener('click', unlock);
DOM.lockPin.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
function unlock() {
    if (DOM.lockPin.value.length > 0) {
        DOM.lockScreen.classList.remove('active');
        DOM.lockPin.value = '';
        document.body.style.overflow = '';
        showToast('Unlocked successfully', 'success');
    } else {
        DOM.lockPin.style.borderColor = '#ef4444';
        setTimeout(() => DOM.lockPin.style.borderColor = '', 700);
    }
}

/* ════════════════════════════════════════════════════
   LOGOUT
   ════════════════════════════════════════════════════ */

DOM.logoutBtn.addEventListener('click', () => openModal('logoutModal'));
DOM.cancelLogoutBtn.addEventListener('click', () => closeModal('logoutModal'));
DOM.doLogoutBtn.addEventListener('click', () => {
    closeModal('logoutModal');
    showToast('Logged out', 'info');
});

/* ════════════════════════════════════════════════════
   MODAL HELPERS
   ════════════════════════════════════════════════════ */

function openModal(id)  { $(id).classList.add('active'); }
function closeModal(id) { $(id).classList.remove('active'); }

document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('active'); });
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        document.querySelectorAll('.modal-bg.active').forEach(m => m.classList.remove('active'));
});

/* ════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════ */

let toastTimer = null;
function showToast(msg, type = 'success') {
    const icons = {
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-circle',
        error:   'fas fa-times-circle',
        info:    'fas fa-info-circle',
    };
    DOM.toastIcon.className  = icons[type] || icons.success;
    DOM.toastMsg.textContent = msg;
    DOM.toast.className      = 'toast show';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 3200);
}
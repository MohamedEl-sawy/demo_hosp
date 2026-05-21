'use strict';

/* ═══════════════════════════════
   FIREBASE
═══════════════════════════════ */
const DB_URL = "https://safeheart-2d878-default-rtdb.firebaseio.com";

/* ═══════════════════════════════
   STATE
═══════════════════════════════ */
let activePatient = null;
let ecgAnimId = null;
let clinicalNotes = null;

/* ═══════════════════════════════
   TIME LABELS
═══════════════════════════════ */
const TIME_LABELS = ['02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','09:44'];

/* ═══════════════════════════════
   FETCH
═══════════════════════════════ */
async function fetchJSON(path) {
    try {
        const res = await fetch(`${DB_URL}/${path}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn(`fetchJSON failed for [${path}]:`, e.message);
        return null;
    }
}

/* ═══════════════════════════════
   LOADER
═══════════════════════════════ */
window.addEventListener("DOMContentLoaded", () => {
    const loader = document.getElementById("pageLoader");
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = "0";
            setTimeout(() => loader.style.display = "none", 400);
        }, 800);
    }
});

/* ═══════════════════════════════
   INIT APP
═══════════════════════════════ */
window.addEventListener("load", () => {
    setDateTime();
    initSearch();
    initSidebar();
    initLock();
    initPrint();
    initPdf();
    initModals();
    showEmptyState();
    loadAlertBadge(); // 🔥 Load alert count for sidebar badge
});

/* ═══════════════════════════════
   DATE
═══════════════════════════════ */
function setDateTime() {
    const el = document.getElementById("reportDateTime");
    if (!el) return;
    const now = new Date();
    el.innerHTML = now.toLocaleString("en-GB", {
        weekday: "short", year: "numeric", month: "short",
        day: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

/* ═══════════════════════════════
   EMPTY STATE
═══════════════════════════════ */
function showEmptyState() {
    const rc = document.getElementById("reportContent");
    if (rc) rc.style.display = "none";
    const empty = document.getElementById("pszEmpty");
    if (empty) empty.style.display = "flex";
    activePatient = null;
}

/* ═══════════════════════════════
   🔥 ALERT BADGE (SIDEBAR)
   Counts unresolved alerts across ALL users
═══════════════════════════════ */
async function loadAlertBadge() {
    const alerts = await fetchJSON("alerts");
    if (!alerts) return;

    let unresolved = 0;
    Object.values(alerts).forEach(userAlerts => {
        if (typeof userAlerts === 'object') {
            Object.values(userAlerts).forEach(alert => {
                if (!alert.resolved) unresolved++;
            });
        }
    });

    // Update ALL nav-dot elements next to the bell icon
    document.querySelectorAll(".sb-link .nav-dot").forEach(dot => {
        dot.textContent = unresolved > 0 ? unresolved : "0";
        dot.style.display = unresolved > 0 ? "flex" : "none";
    });
}

/* ═══════════════════════════════
   BUILD PATIENT FROM FIREBASE
═══════════════════════════════ */
async function buildPatient(id) {
    const [user, inPatient, live, history, alerts, emergency] = await Promise.all([
        fetchJSON(`users/${id}`),
        fetchJSON(`inPatients/${id}`),
        fetchJSON(`live_data/${id}`),
        fetchJSON(`history/${id}`),
        fetchJSON(`alerts/${id}`),
        fetchJSON(`emergency_contacts/${id}`)
    ]);

    if (!user) return null;

    // Build emergency contacts list
    const contacts = emergency
        ? Object.values(emergency).sort((a, b) => (a.priority || 99) - (b.priority || 99))
        : [];

    // Build alert list
    const alertList = alerts ? Object.values(alerts) : [];

    // Determine overall status
    const statusRaw = (inPatient?.status || "stable").toLowerCase();

    return {
        id,

        // USER INFO
        name:   user.name   || "-",
        age:    user.age    || "-",
        gender: user.gender || "-",
        blood:  user.blood  || "-",
        email:  user.email  || "-",
        phone:  user.phone  || "-",

        // HOSPITAL INFO
        status:     statusRaw,
        room:       inPatient?.room     || "-",
        admission:  inPatient?.admitted || "-",
        department: `Cardiology · Room ${inPatient?.room || "-"}`,

        // LIVE DATA
        live,

        // HISTORY (FOR CHARTS)
        history: buildVitals(history),

        // VITALS SUMMARY
        summary: {
            hr:   `${live?.heartRate || 0} BPM`,
            spo2: `${live?.spo2     || 0}%`,
            temp: `${live?.temp     || 0}°C`,
            bp:   live?.bp || "-"
        },

        // ECG
        ecgHR:     `${live?.heartRate || 0} BPM`,
        ecgRhythm: live?.heartRate > 100 ? "Irregular" : "Normal Sinus",

        // REPORT META
        reportId: `MR-${id}-${Date.now()}`,
        doctor:   "Dr. System AI",

        // ALERTS
        alerts: alertList,

        // EMERGENCY CONTACTS
        contacts
    };
}

/* ═══════════════════════════════
   HISTORY → CHART DATA
═══════════════════════════════ */
function buildVitals(history) {
    if (!history) return { heartRate: [], temp: [], spo2: [], sysBP: [], diaBP: [] };

    const entries = Object.values(history);

    return {
        heartRate: entries.map(k => k.heartRate || 0),
        temp:      entries.map(k => k.temp      || 0),
        spo2:      entries.map(k => k.spo2      || 0),
        sysBP:     entries.map(k => k.sysBP     || 0),
        diaBP:     entries.map(k => k.diaBP     || 0)
    };
}

/* ═══════════════════════════════
   SEARCH
═══════════════════════════════ */
function initSearch() {
    const input    = document.getElementById("patientSearchInput");
    const dropdown = document.getElementById("pszDropdown");
    const empty    = document.getElementById("pszEmpty");
    const clearBtn = document.getElementById("pszClear");

    if (!input) return;

    async function search() {
        const q = input.value.trim().toLowerCase();

        if (clearBtn) clearBtn.style.display = q ? "block" : "none";

        if (!q) {
            dropdown.innerHTML = "";
            dropdown.classList.remove("visible");
            return;
        }

        // Search across users AND inPatients
        const [inPatients, users] = await Promise.all([
            fetchJSON("inPatients"),
            fetchJSON("users")
        ]);

        const allIds = new Set([
            ...Object.keys(inPatients || {}),
            // ...Object.keys(users || {})
        ]);

        const results = [...allIds].filter(id => {
            const name = (users?.[id]?.name || "").toLowerCase();
            return id.toLowerCase().includes(q) || name.includes(q);
        });

        if (results.length === 0) {
            dropdown.innerHTML = `<div class="psz-no-result" style="padding:14px 16px;color:#94a3b8;font-size:13px;">No patients found</div>`;
            dropdown.classList.add("visible");
            return;
        }

        if (empty) empty.style.display = "none";

        dropdown.innerHTML = results.map(id => {
            const u   = users?.[id];
            const ip  = inPatients?.[id];
            const status = (ip?.status || "stable").toLowerCase();
            const initials = (u?.name || id).slice(0, 2).toUpperCase();

            return `
                <div class="psz-result-item" onclick="selectPatient('${id}')">
                    <div class="psr-avatar" style="
                        width:40px;height:40px;border-radius:12px;
                        background:linear-gradient(135deg,#0ea5a4,#14b8a6);
                        color:#fff;display:flex;align-items:center;justify-content:center;
                        font-weight:700;font-size:14px;flex-shrink:0;">
                        ${initials}
                    </div>
                    <div class="psr-info" style="flex:1;">
                        <div class="psr-name" style="font-size:13px;font-weight:700;color:#0f172a;">${u?.name || id}</div>
                        <div class="psr-meta" style="font-size:11px;color:#64748b;">ID: ${id} · Room ${ip?.room || "?"}</div>
                    </div>
                    <span style="
                        font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;
                        background:${status === 'critical' ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)'};
                        color:${status === 'critical' ? '#dc2626' : '#16a34a'};
                        border:1px solid ${status === 'critical' ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'};
                        text-transform:uppercase;letter-spacing:.3px;">
                        ${ip?.status || "Stable"}
                    </span>
                </div>
            `;
        }).join("");

        dropdown.classList.add("visible");
    }

    input.addEventListener("input", search);

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            input.value = "";
            dropdown.innerHTML = "";
            dropdown.classList.remove("visible");
            clearBtn.style.display = "none";
            showEmptyState();
        });
    }

    // Close dropdown on outside click
    document.addEventListener("click", e => {
        const zone = document.getElementById("patientSearchZone");
        if (zone && !zone.contains(e.target)) {
            dropdown.classList.remove("visible");
        }
    });
}

/* ═══════════════════════════════
   SELECT PATIENT
═══════════════════════════════ */
window.selectPatient = async function(id) {
    const dropdown = document.getElementById("pszDropdown");
    if (dropdown) dropdown.classList.remove("visible");

    // Show loading state
    showToast("Loading patient data…", "info");

    const p = await buildPatient(id);
    if (!p) {
        showToast("Patient not found", "error");
        return;
    }

    activePatient = p;

    const input = document.getElementById("patientSearchInput");
    if (input) input.value = `${p.name} (${p.id})`;

    const empty = document.getElementById("pszEmpty");
    if (empty) empty.style.display = "none";

    loadReport(p);
    showToast(`Loaded: ${p.name}`, "success");
};

/* ═══════════════════════════════
   LOAD REPORT
═══════════════════════════════ */
function loadReport(p) {
    const rc = document.getElementById("reportContent");
    if (rc) rc.style.display = "block";

    // --- Patient Info ---
    setText("piName",      p.name);
    setText("piAge",       p.age);
    setText("piGender",    p.gender);
    setText("piBlood",     p.blood);
    setText("piDept",      p.department);
    setText("piAdmission", p.admission);
    setText("piPatientId", p.id);
    setText("reportId",    p.reportId);
    setText("piDoctor",    p.doctor);
    setText("piDate",      new Date().toLocaleDateString("en-GB"));
    setText("piDiagnosis", p.status === "critical" ? "Under Critical Observation" : "Stable Monitoring");
    setText("footerDoctor", p.doctor);

    // Avatar
    const avatar = document.getElementById("piAvatar");
    if (avatar) avatar.textContent = p.name.slice(0, 2).toUpperCase();

    // Status badge
    const badge = document.getElementById("piBadge");
    if (badge) {
        badge.className = `status-badge ${p.status === 'critical' ? 'critical-badge' : ''}`;
        badge.innerHTML = `<span class="pulse-dot" style="background:${p.status === 'critical' ? 'var(--red)' : 'var(--green)'}"></span> ${p.status.charAt(0).toUpperCase() + p.status.slice(1)}`;
    }

    // ECG footer
    setText("ecgHR",     p.ecgHR);
    setText("ecgRhythm", p.ecgRhythm);

    // --- Vitals Summary Cards ---
    renderVitalsSummary(p);

    // --- AI Analysis ---
    renderAIAnalysis(p);

    // --- Charts ---
    destroyCharts();
    renderCharts(p);

    // --- ECG ---
    if (ecgAnimId) cancelAnimationFrame(ecgAnimId);
    buildECG(p.live?.heartRate || 75);

    // --- Sections ---
    renderAlerts(p);
    renderTimeline(p);
    renderSummary(p);
    renderEmergencyContacts(p);
}

/* ═══════════════════════════════
   VITALS SUMMARY CARDS
═══════════════════════════════ */
function renderVitalsSummary(p) {
    const box = document.getElementById("vitalsSummary");
    if (!box) return;

    const hr   = p.live?.heartRate || 0;
    const bp   = p.live?.bp        || "—";
    const temp = p.live?.temp      || 0;
    const spo2 = p.live?.spo2      || 0;

    const hrFlag   = hr > 100   ? "critical" : hr < 60 ? "warning" : "normal";
    const tempFlag = temp > 37.5 ? "critical" : "normal";
    const spo2Flag = spo2 < 95  ? "critical" : "normal";

    box.innerHTML = `
        <div class="vsm-card red">
            <div class="vsm-ico"><i class="fas fa-heartbeat"></i></div>
            <div>
                <div class="vsm-val">${hr}</div>
                <div class="vsm-lbl">Heart Rate (BPM)</div>
                <span class="vsm-flag ${hrFlag}">${hrFlag.toUpperCase()}</span>
            </div>
        </div>
        <div class="vsm-card blue">
            <div class="vsm-ico"><i class="fas fa-tachometer-alt"></i></div>
            <div>
                <div class="vsm-val" style="font-size:15px">${bp}</div>
                <div class="vsm-lbl">Blood Pressure</div>
                <span class="vsm-flag normal">MONITOR</span>
            </div>
        </div>
        <div class="vsm-card orange">
            <div class="vsm-ico"><i class="fas fa-thermometer-half"></i></div>
            <div>
                <div class="vsm-val">${temp}°</div>
                <div class="vsm-lbl">Temperature (°C)</div>
                <span class="vsm-flag ${tempFlag}">${tempFlag.toUpperCase()}</span>
            </div>
        </div>
        <div class="vsm-card teal">
            <div class="vsm-ico"><i class="fas fa-lungs"></i></div>
            <div>
                <div class="vsm-val">${spo2}%</div>
                <div class="vsm-lbl">SpO₂ Saturation</div>
                <span class="vsm-flag ${spo2Flag}">${spo2Flag.toUpperCase()}</span>
            </div>
        </div>
    `;

    // Update chart badges
    setbadge("hrBadge",   hrFlag,   hr   + " BPM");
    setbage("bpBadge",   "normal", bp);
    setbage("tempBadge", tempFlag,  temp + "°C");
    setbage("spo2Badge", spo2Flag,  spo2 + "%");
}

function setbadge(id, level, txt) {
    const el = document.getElementById(id);
    if (el) { el.className = `chart-badge ${level}`; el.textContent = txt; }
}
// alias fix
function setbage(id, level, txt) { setbadge(id, level, txt); }
function setbadge(id, level, txt) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `chart-badge ${level}`;
    el.textContent = txt;
}

/* ═══════════════════════════════
   AI ANALYSIS
═══════════════════════════════ */
function renderAIAnalysis(p) {
    const hr   = p.live?.heartRate || 0;
    const spo2 = p.live?.spo2     || 0;
    const temp = p.live?.temp     || 0;

    let overallStatus = "stable";
    let confidence    = 88;
    let desc = "Patient vitals are within acceptable ranges. Continue routine monitoring.";

    const unresolvedAlerts = p.alerts.filter(a => !a.resolved);
    if (unresolvedAlerts.length > 0 || p.status === "critical") {
        overallStatus = "critical";
        confidence = 94;
        desc = "Elevated risk detected. Immediate medical review recommended based on active alerts.";
    } else if (hr > 90 || spo2 < 96 || temp > 37.2) {
        overallStatus = "warning";
        confidence = 78;
        desc = "Minor deviations detected. Close monitoring advised over the next 4 hours.";
    }

    // Status card
    const icon = document.getElementById("aiStatusIcon");
    const val  = document.getElementById("aiStatusVal");
    const des  = document.getElementById("aiStatusDesc");
    const fill = document.getElementById("confidenceFill");
    const conf = document.getElementById("confidenceVal");

    if (icon) {
        icon.className = `ai-status-icon ${overallStatus}`;
        icon.innerHTML = `<i class="fas fa-${overallStatus === 'stable' ? 'check-circle' : overallStatus === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i>`;
    }
    if (val)  { val.className  = `ai-status-val ${overallStatus}`; val.textContent  = overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1); }
    if (des)  des.textContent  = desc;
    if (fill) setTimeout(() => fill.style.width = `${confidence}%`, 300);
    if (conf) conf.textContent = `${confidence}%`;

    // Findings
    const findingsBox = document.getElementById("aiFindings");
    if (!findingsBox) return;

    const findings = [];

    // Heart rate finding
    if (hr > 100) findings.push({ level: "critical", icon: "heart", title: `Tachycardia Detected`, text: `Heart rate ${hr} BPM exceeds normal threshold of 100 BPM. Cardiology review advised.` });
    else if (hr < 60) findings.push({ level: "warning", icon: "heart", title: `Bradycardia Detected`, text: `Heart rate ${hr} BPM is below normal. Monitor for symptoms.` });
    else findings.push({ level: "normal", icon: "heart", title: `Heart Rate Normal`, text: `Heart rate ${hr} BPM is within normal sinus range (60–100 BPM).` });

    // SpO2
    if (spo2 < 92) findings.push({ level: "critical", icon: "lungs", title: "Hypoxemia Alert", text: `SpO₂ at ${spo2}% — critically low oxygen saturation. Supplemental oxygen may be required.` });
    else if (spo2 < 95) findings.push({ level: "warning", icon: "lungs", title: "SpO₂ Below Optimal", text: `SpO₂ ${spo2}% is slightly below optimal range (≥95%). Monitor closely.` });
    else findings.push({ level: "normal", icon: "lungs", title: "Oxygen Saturation Normal", text: `SpO₂ ${spo2}% is within normal range. No respiratory concerns.` });

    // Temperature
    if (temp > 38) findings.push({ level: "critical", icon: "thermometer-full", title: "Fever Detected", text: `Temperature ${temp}°C indicates active fever. Antipyretic treatment may be needed.` });
    else if (temp > 37.5) findings.push({ level: "warning", icon: "thermometer-half", title: "Mild Hyperthermia", text: `Temperature ${temp}°C is slightly elevated. Monitor for progression.` });
    else findings.push({ level: "normal", icon: "thermometer-half", title: "Temperature Normal", text: `Body temperature ${temp}°C is within normal range (36–37.5°C).` });

    findingsBox.innerHTML = findings.map(f => `
        <div class="ai-finding ${f.level}">
            <div class="af-icon"><i class="fas fa-${f.icon}"></i></div>
            <div class="af-body">
                <strong>${f.title}</strong>
                <p>${f.text}</p>
            </div>
        </div>
    `).join("");

    // Risk gauge
    const riskPos = overallStatus === 'critical' ? '85%' : overallStatus === 'warning' ? '55%' : '20%';
    const riskGauge = document.getElementById("riskGauge");
    const riskVal   = document.getElementById("riskVal");
    if (riskGauge) riskGauge.style.setProperty("--risk-pos", riskPos);
    if (riskVal) {
        riskVal.textContent = overallStatus === 'critical' ? "HIGH" : overallStatus === 'warning' ? "MEDIUM" : "LOW";
        riskVal.style.color = overallStatus === 'critical' ? 'var(--red)' : overallStatus === 'warning' ? 'var(--amber)' : 'var(--green)';
    }
}

/* ═══════════════════════════════
   CHARTS
═══════════════════════════════ */
function renderCharts(p) {
    const chartOpts = (color) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: "rgba(0,0,0,.05)" }, ticks: { font: { size: 10 } } },
            y: { grid: { color: "rgba(0,0,0,.05)" }, ticks: { font: { size: 10 } } }
        },
        elements: { point: { radius: 3, hoverRadius: 5 } }
    });

    const hrData = p.history.heartRate.length ? p.history.heartRate : [72, 75, 80, 78, 82, 79, 76, 74, p.live?.heartRate || 75];
    new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: {
            labels: TIME_LABELS.slice(0, hrData.length),
            datasets: [{ data: hrData, borderColor: "#E24B4A", backgroundColor: "rgba(226,75,74,.08)", tension: 0.4, fill: true }]
        },
        options: chartOpts("#E24B4A")
    });

    const sysData = p.history.sysBP.length ? p.history.sysBP : [120,118,125,122,128,124,121,119,120];
    const diaData = p.history.diaBP.length ? p.history.diaBP : [80,78,82,80,85,81,79,78,80];
    new Chart(document.getElementById("bpChart"), {
        type: "line",
        data: {
            labels: TIME_LABELS.slice(0, sysData.length),
            datasets: [
                { label: "Systolic",  data: sysData, borderColor: "#366ca3", backgroundColor: "rgba(54,108,163,.08)", tension: 0.4, fill: true },
                { label: "Diastolic", data: diaData, borderColor: "#0ea5a4", backgroundColor: "rgba(14,165,164,.08)", tension: 0.4, fill: true }
            ]
        },
        options: { ...chartOpts(), plugins: { legend: { display: true, labels: { font: { size: 11 } } } } }
    });

    const tempData = p.history.temp.length ? p.history.temp : [36.8,36.9,37.1,37.0,37.3,37.2,37.0,36.9,p.live?.temp || 37];
    new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: {
            labels: TIME_LABELS.slice(0, tempData.length),
            datasets: [{ data: tempData, borderColor: "#BA7517", backgroundColor: "rgba(186,117,23,.08)", tension: 0.4, fill: true }]
        },
        options: chartOpts("#BA7517")
    });

    const spo2Data = p.history.spo2.length ? p.history.spo2 : [97,96,98,97,96,97,98,97,p.live?.spo2 || 97];
    new Chart(document.getElementById("spo2Chart"), {
        type: "line",
        data: {
            labels: TIME_LABELS.slice(0, spo2Data.length),
            datasets: [{ data: spo2Data, borderColor: "#1D9E75", backgroundColor: "rgba(29,158,117,.08)", tension: 0.4, fill: true }]
        },
        options: chartOpts("#1D9E75")
    });
}

/* ═══════════════════════════════
   ECG
═══════════════════════════════ */
function buildECG(bpm = 75) {
    const canvas = document.getElementById("ecgCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let offset = 0;
    const speed = (bpm / 60) * 0.08;

    function draw() {
        const w = canvas.width  = canvas.parentElement.offsetWidth;
        const h = canvas.height = 120;

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = "rgba(91,180,180,0.1)";
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 20) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // ECG Signal
        ctx.beginPath();
        ctx.strokeStyle = "#E24B4A";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#E24B4A";
        ctx.shadowBlur = 4;

        for (let i = 0; i < w; i++) {
            const t = (i / w) * 6 * Math.PI + offset;
            let y = h / 2;

            // P wave
            y -= Math.sin(t) * 8;
            // QRS complex spike
            const qrs = Math.sin(t * 4) * 35 * Math.exp(-Math.pow((t % (2 * Math.PI)) - Math.PI, 2) * 2);
            y -= qrs;
            // T wave
            y -= Math.sin(t * 0.8 + 1) * 12;

            i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        offset += speed;
        ecgAnimId = requestAnimationFrame(draw);
    }

    draw();
}

/* ═══════════════════════════════
   ALERTS
═══════════════════════════════ */
function renderAlerts(p) {
    const box = document.getElementById("predictiveGrid");
    if (!box) return;

    if (!p.alerts.length) {
        box.innerHTML = `<div style="padding:20px;color:#94a3b8;font-size:13px;grid-column:1/-1;text-align:center;"><i class="fas fa-check-circle" style="color:#1D9E75;margin-right:8px;"></i>No alerts recorded for this patient</div>`;
        return;
    }

    box.innerHTML = p.alerts.map(a => {
        const isHigh  = a.value > a.threshold;
        const level   = a.resolved ? "stable" : isHigh ? "rising" : "falling";
        const color   = a.resolved ? "var(--green)" : isHigh ? "var(--red)" : "var(--amber)";
        const icon    = a.resolved ? "check-circle" : isHigh ? "arrow-up" : "arrow-down";
        const label   = a.resolved ? "Resolved" : "Active";
        const typeLabel = a.type?.replace(/_/g, " ") || "Alert";
        const ts = a.timestamp ? new Date(a.timestamp * 1000).toLocaleString("en-GB") : "—";

        return `
            <div class="predictive-card ${level}">
                <div class="pc-header">
                    <div class="pc-icon"><i class="fas fa-${icon}" style="color:${color}"></i></div>
                    <div class="pc-title">${typeLabel}</div>
                </div>
                <div class="pc-trend">
                    <i class="fas fa-chart-line"></i>
                    Value: <strong>${a.value}</strong> / Threshold: ${a.threshold}
                </div>
                <div class="pc-trend" style="margin-top:-4px;">
                    <i class="fas fa-clock"></i> ${ts}
                </div>
                <span class="pc-risk" style="background:${a.resolved ? 'rgba(29,158,117,.1)' : isHigh ? 'rgba(226,75,74,.1)' : 'rgba(186,117,23,.1)'};color:${color};">
                    ${label}
                </span>
                <div class="pc-rec">${a.resolved ? "Alert has been resolved by medical staff." : "Requires immediate medical attention."}</div>
            </div>
        `;
    }).join("");
}

/* ═══════════════════════════════
   TIMELINE
═══════════════════════════════ */
function renderTimeline(p) {
    const box = document.getElementById("timeline");
    if (!box) return;

    box.innerHTML = `
        <div class="timeline-item info">
            <div class="ti-header">
                <div class="ti-icon"><i class="fas fa-hospital"></i></div>
                <div class="ti-title">Patient Admitted</div>
                <span class="ti-badge">Admission</span>
            </div>
            <div class="ti-time">${p.admission}</div>
            <div class="ti-desc">Admitted to ${p.department}</div>
        </div>
    `;

    p.alerts
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .forEach(a => {
            const level  = a.resolved ? "resolved" : "critical";
            const icon   = a.resolved ? "check" : "exclamation-triangle";
            const ts     = a.timestamp ? new Date(a.timestamp * 1000).toLocaleString("en-GB") : "—";
            const typeLabel = a.type?.replace(/_/g, " ") || "Alert";

            box.innerHTML += `
                <div class="timeline-item ${level}">
                    <div class="ti-header">
                        <div class="ti-icon"><i class="fas fa-${icon}"></i></div>
                        <div class="ti-title">${typeLabel}</div>
                        <span class="ti-badge">${a.resolved ? "Resolved" : "Active"}</span>
                    </div>
                    <div class="ti-time">${ts}</div>
                    <div class="ti-desc">Value: ${a.value} / Threshold: ${a.threshold}</div>
                </div>
            `;
        });
}

/* ═══════════════════════════════
   MEDICAL SUMMARY
═══════════════════════════════ */
function renderSummary(p) {
    const notes = document.getElementById("doctorNotes");
    if (notes) {
        const hr   = p.live?.heartRate || 0;
        const spo2 = p.live?.spo2     || 0;
        const temp = p.live?.temp     || 0;
        notes.textContent =
            `Patient ${p.name}, ${p.age} years old, ${p.gender}, blood type ${p.blood}. ` +
            `Current vitals: Heart Rate ${hr} BPM, SpO₂ ${spo2}%, Temperature ${temp}°C. ` +
            `Status classified as ${p.status.toUpperCase()}. ` +
            `${p.alerts.filter(a => !a.resolved).length} active alert(s) require attention.`;
    }

    const rec = document.getElementById("recommendations");
    if (!rec) return;

    const hr   = p.live?.heartRate || 0;
    const spo2 = p.live?.spo2     || 0;
    const temp = p.live?.temp     || 0;

    rec.innerHTML = "";

    if (hr > 100) {
        rec.innerHTML += `<div class="rec-item urgent"><i class="fas fa-heartbeat rec-ico"></i><span>Tachycardia — Cardiology review needed</span></div>`;
    } else {
        rec.innerHTML += `<div class="rec-item normal"><i class="fas fa-heartbeat rec-ico"></i><span>Heart rate normal — Continue monitoring</span></div>`;
    }

    if (spo2 < 95) {
        rec.innerHTML += `<div class="rec-item urgent"><i class="fas fa-lungs rec-ico"></i><span>Low SpO₂ — Oxygen supplementation recommended</span></div>`;
    } else {
        rec.innerHTML += `<div class="rec-item normal"><i class="fas fa-lungs rec-ico"></i><span>SpO₂ satisfactory — No intervention needed</span></div>`;
    }

    if (temp > 37.5) {
        rec.innerHTML += `<div class="rec-item warn"><i class="fas fa-thermometer-half rec-ico"></i><span>Elevated temperature — Monitor and consider antipyretics</span></div>`;
    } else {
        rec.innerHTML += `<div class="rec-item normal"><i class="fas fa-thermometer-half rec-ico"></i><span>Temperature stable — No fever detected</span></div>`;
    }
}

/* ═══════════════════════════════
   EMERGENCY CONTACTS
═══════════════════════════════ */
function renderEmergencyContacts(p) {
    // Try to inject into clinical notes section or a dedicated area
    const section = document.getElementById("clinicalNotesSection");
    if (!section || !p.contacts.length) return;

    const existing = document.getElementById("emergencyContactsBlock");
    if (existing) existing.remove();

    const block = document.createElement("div");
    block.id = "emergencyContactsBlock";
    block.style.cssText = "background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:24px 28px;margin-bottom:20px;";
    block.innerHTML = `
        <div class="section-title" style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border);">
            <i class="fas fa-phone-alt" style="color:var(--primary);font-size:18px;"></i>
            <h3 style="font-size:16px;font-weight:700;color:var(--text-dark);flex:1;">Emergency Contacts</h3>
        </div>
        ${p.contacts.map(c => `
            <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);">
                <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0;">
                    ${(c.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div style="flex:1;">
                    <div style="font-size:13px;font-weight:700;color:var(--text-dark);">${c.name || "—"}</div>
                    <div style="font-size:11px;color:var(--text-light);">${c.relationship || "—"} · Priority ${c.priority || "?"}</div>
                </div>
                <a href="tel:${c.phone}" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--primary);font-weight:600;text-decoration:none;">
                    <i class="fas fa-phone" style="margin-right:6px;font-size:11px;"></i>${c.phone}
                </a>
            </div>
        `).join("")}
    `;

    section.appendChild(block);
}

/* ═══════════════════════════════
   UTIL
═══════════════════════════════ */
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? "—";
}

function destroyCharts() {
    ["hrChart", "tempChart", "spo2Chart", "bpChart"].forEach(id => {
        const c = Chart.getChart(id);
        if (c) c.destroy();
    });
}

/* ═══════════════════════════════
   TOAST
═══════════════════════════════ */
function showToast(msg, type = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    const icon = document.getElementById("toastIcon");
    if (icon) {
        icon.className = `fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}`;
        icon.style.color = type === 'success' ? '#1D9E75' : type === 'error' ? '#E24B4A' : '#BA7517';
    }

    document.getElementById("toastMsg").textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

/* ═══════════════════════════════
   SIDEBAR
═══════════════════════════════ */
function initSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    const menuBtn = document.getElementById("menuBtn");

    if (!menuBtn) return;

    menuBtn.onclick = () => {
        sidebar?.classList.add("active");
        overlay?.classList.add("active");
    };

    if (overlay) {
        overlay.onclick = () => {
            sidebar?.classList.remove("active");
            overlay.classList.remove("active");
        };
    }
}

/* ═══════════════════════════════
   LOCK
═══════════════════════════════ */
function initLock() {
    const lockBtn = document.getElementById("lockBtn");
    const screen  = document.getElementById("lockScreen");
    const pin     = document.getElementById("lockPin");
    const unlockBtn = document.getElementById("unlockBtn");

    if (!lockBtn) return;

    lockBtn.onclick = () => screen?.classList.add("active");

    window.unlock = () => {
        screen?.classList.remove("active");
        if (pin) pin.value = "";
    };

    if (unlockBtn) unlockBtn.onclick = () => window.unlock();
    if (pin) pin.addEventListener("keydown", e => { if (e.key === "Enter") window.unlock(); });
}

/* ═══════════════════════════════
   PRINT / PDF
═══════════════════════════════ */
function initPrint() {
    const btn = document.getElementById("printBtn");
    if (btn) btn.onclick = () => window.print();
}

function initPdf() {
    const btn = document.getElementById("pdfBtn");
    if (!btn) return;
    btn.onclick = () => {
        if (!activePatient) return showToast("Select a patient first", "warning");
        if (typeof html2pdf === "undefined") return showToast("PDF library not loaded", "error");
        html2pdf()
            .set({ margin: 8, filename: `report_${activePatient.id}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } })
            .from(document.getElementById("reportBody"))
            .save();
    };
}

/* ═══════════════════════════════
   CLINICAL NOTES MODAL
═══════════════════════════════ */
function openModal(id) {
    document.getElementById(id)?.classList.add("open");
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
}

window.openNotesModal = function() {
    if (clinicalNotes) {
        const dn = document.getElementById('noteDoctorName');
        const nh = document.getElementById('noteHospital');
        const nt = document.getElementById('noteText');
        if (dn) dn.value = clinicalNotes.doctor   || "";
        if (nh) nh.value = clinicalNotes.hospital  || "";
        if (nt) nt.value = clinicalNotes.text      || "";
    }
    openModal('notesModal');
};

window.closeNotesModal = function() { closeModal('notesModal'); };

window.saveNotes = function() {
    const doctor   = document.getElementById('noteDoctorName')?.value.trim();
    const hospital = document.getElementById('noteHospital')?.value.trim();
    const text     = document.getElementById('noteText')?.value.trim();

    if (!text) { showToast("Please enter clinical notes", "warning"); return; }

    clinicalNotes = { doctor, hospital, text };

    const section = document.getElementById("clinicalNotesSection");
    if (section) {
        const existing = document.getElementById("clinicalNoteBlock");
        if (existing) existing.remove();

        const block = document.createElement("section");
        block.id = "clinicalNoteBlock";
        block.className = "section slide-up";
        block.innerHTML = `
            <div class="section-title">
                <i class="fas fa-notes-medical"></i>
                <h3>Clinical Notes</h3>
            </div>
            <div class="clinical-notes-section">
                <div class="cn-meta">
                    <strong>${doctor || "Attending Physician"}</strong>
                    ${hospital ? ` · ${hospital}` : ""}
                    · ${new Date().toLocaleString("en-GB")}
                </div>
                <div class="cn-body">${text}</div>
            </div>
        `;
        section.appendChild(block);
    }

    closeModal('notesModal');
    showToast("Clinical notes saved", "success");
};

function initModals() {
    const notesBtn    = document.getElementById('notesBtn');
    const closeNotes  = document.getElementById('closeNotesBtn');
    const cancelNotes = document.getElementById('cancelNotesBtn');
    const saveNotesBtn = document.getElementById('saveNotesBtn');

    if (notesBtn)     notesBtn.addEventListener('click',     window.openNotesModal);
    if (closeNotes)   closeNotes.addEventListener('click',   window.closeNotesModal);
    if (cancelNotes)  cancelNotes.addEventListener('click',  window.closeNotesModal);
    if (saveNotesBtn) saveNotesBtn.addEventListener('click', window.saveNotes);

    const logoutBtn    = document.getElementById('logoutBtn');
    const cancelLogout = document.getElementById('cancelLogoutBtn');
    const doLogout     = document.getElementById('doLogoutBtn');

    if (logoutBtn)    logoutBtn.addEventListener('click',    () => openModal('logoutModal'));
    if (cancelLogout) cancelLogout.addEventListener('click', () => closeModal('logoutModal'));
    if (doLogout)     doLogout.addEventListener('click', () => { closeModal('logoutModal'); showToast("Logged out", "info"); });

    // Backdrop close
    document.querySelectorAll('.modal-overlay').forEach(bg => {
        bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    });
}
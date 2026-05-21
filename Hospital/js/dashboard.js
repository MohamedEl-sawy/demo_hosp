const BASE_URL = "https://safeheart-2d878-default-rtdb.firebaseio.com";

// ================= STATE =================
let users = {};
let inPatients = {};
let alerts = {};
let selectedUserId = null;

// ================= INIT =================
window.addEventListener("DOMContentLoaded", async () => {
    await loadData();

    renderTable();
    renderAlerts();
    updateStats();
    updateNavAlerts();

    bindSearch();
    listenRealtime();

    window.openAdmitModal = openAdmitModal;
    window.openDischargeModal = openDischargeModal;
    window.selectPatient = selectPatient;
});

// ================= LOAD DATA =================
async function loadData() {
    const [u, ip, al] = await Promise.all([
        fetch(`${BASE_URL}/users.json`),
        fetch(`${BASE_URL}/inPatients.json`),
        fetch(`${BASE_URL}/alerts.json`)
    ]);

    users = await u.json() || {};
    inPatients = await ip.json() || {};
    alerts = await al.json() || {};
}

// ================= REALTIME (simple polling) =================
function listenRealtime() {
    setInterval(async () => {
        const [ipRes, alertRes] = await Promise.all([
            fetch(`${BASE_URL}/inPatients.json`),
            fetch(`${BASE_URL}/alerts.json`)
        ]);

        inPatients = await ipRes.json() || {};
        alerts = await alertRes.json() || {};

        renderTable();
        renderAlerts();
        updateStats();
        updateNavAlerts();

    }, 3000);
}

// ================= SEARCH =================
function bindSearch() {
    const input = document.getElementById("patientIdInput");

    input.addEventListener("input", () => {
        showDropdown(input.value.toLowerCase());
    });

    document.getElementById("searchPatientBtn").addEventListener("click", () => {
        showDropdown(input.value.toLowerCase());
    });
}

// ================= DROPDOWN =================
function showDropdown(filter = "") {
    removeDropdown();

    const input = document.getElementById("patientIdInput");
    const rect = input.getBoundingClientRect();

    const box = document.createElement("div");
    box.id = "dropdown";

    let found = false;

    Object.keys(users).forEach(uid => {
        const user = users[uid];
        if (!user) return;

        const name = (user.name || "").toLowerCase();

        if (
            uid.toLowerCase().includes(filter) ||
            name.includes(filter)
        ) {
            found = true;

            const item = document.createElement("div");

            item.innerHTML = `
                <div style="
                    width:32px;height:32px;
                    border-radius:10px;
                    background:#e8f4ff;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-weight:600;
                    color:#185FA5;
                    font-size:12px;
                ">
                    ${getInitials(user.name)}
                </div>

                <div style="display:flex;flex-direction:column">
                    <b>${user.name || "Unknown"}</b>
                    <small>${uid}</small>
                </div>
            `;

            item.onclick = () => {
                selectedUserId = uid;
                input.value = uid;
                removeDropdown();
            };

            box.appendChild(item);
        }
    });

    if (!found) {
        const empty = document.createElement("div");
        empty.innerText = "No patients found";
        empty.style.padding = "12px";
        empty.style.color = "#999";
        box.appendChild(empty);
    }

    box.style.position = "absolute";
    box.style.left = rect.left + "px";
    box.style.top = rect.bottom + "px";
    box.style.width = rect.width + "px";
    box.style.background = "#fff";
    box.style.border = "1px solid #eee";
    box.style.borderRadius = "12px";
    box.style.zIndex = 9999;
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.1)";
    box.style.overflow = "hidden";

    document.body.appendChild(box);
}

function removeDropdown() {
    document.getElementById("dropdown")?.remove();
}

function getInitials(name = "") {
    return name
        .split(" ")
        .map(n => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

// ================= ADMIT =================
async function openAdmitModal() {
    if (!selectedUserId) return alert("Select patient");

    const room = prompt("Room number?");
    const status = prompt("Status? (Stable / Critical)");

    if (!room || !status) return;

    await fetch(`${BASE_URL}/inPatients/${selectedUserId}.json`, {
        method: "PUT",
        body: JSON.stringify({
            room,
            status,
            admitted: new Date().toLocaleString()
        })
    });

    selectedUserId = null;
}

// ================= DISCHARGE =================
async function openDischargeModal() {
    if (!selectedUserId) return alert("Select patient");

    await fetch(`${BASE_URL}/inPatients/${selectedUserId}.json`, {
        method: "DELETE"
    });

    selectedUserId = null;
}

// ================= TABLE =================
function renderTable() {
    const tbody = document.getElementById("pt-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    Object.keys(inPatients).forEach(uid => {
        const p = inPatients[uid] || {};
        const u = users[uid] || {};

        tbody.innerHTML += `
        <tr>
            <td>${u.name || "Unknown"}</td>
            <td>${uid}</td>
            <td>${p.room || "-"}</td>
            <td>${p.status || "-"}</td>
            <td>${p.admitted || "-"}</td>
            <td>
                <button class="row-select-btn ${selectedUserId === uid ? "active" : ""}"
                    onclick="selectPatient('${uid}')">
                    Select
                </button>
            </td>
        </tr>`;
    });

    document.getElementById("pt-count").innerText =
        `${Object.keys(inPatients).length} patients`;
}

// ================= ALERTS =================
function renderAlerts() {
    const container = document.querySelector(".wide-alerts");
    if (!container) return;

    const list = Object.values(alerts || {});
    container.innerHTML = "";

    list.slice(0, 3).forEach(a => {
        const patientId = a.patientId;

        const user = users[patientId] || {};
        const patient = inPatients[patientId] || {};

        const name = user.name || patientId;
        const room = patient.room || "N/A";

        container.innerHTML += `
        <div class="mini-alert">
            <div class="mini-alert-icon ${a.severity || "warn"}">
                <i class="fas fa-heartbeat"></i>
            </div>

            <div class="mini-alert-body">
                <strong>${a.type || "Alert"}</strong>
                <small>${name} · Room ${room}</small>
            </div>

            <span class="mini-alert-val">${a.value || "--"}</span>
        </div>`;
    });
}

// ================= STATS =================
function updateStats() {
    const totalPatients = Object.keys(users || {}).length;
    const admitted = Object.keys(inPatients || {}).length;
    const activeAlerts = Object.keys(alerts || {}).length;

    const critical = Object.values(inPatients || {})
        .filter(p => p.status === "Critical").length;

    const stable = Object.values(inPatients || {})
        .filter(p => p.status === "Stable").length;

    setText(".accent-blue h2", totalPatients);
    setText(".accent-teal h2", admitted);
    setText(".accent-red h2", critical);
    setText(".accent-green h2", stable);
    setText(".accent-amber h2", activeAlerts);
}

function updateNavAlerts() {
    const dot = document.querySelector(".nav-dot");
    if (!dot) return;

    const count = Object.keys(alerts || {}).length;
    dot.innerText = count;
    dot.style.display = count > 0 ? "inline-block" : "none";
}

function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.innerText = value;
}

// ================= SELECT =================
function selectPatient(id) {
    selectedUserId = id;
    const input = document.getElementById("patientIdInput");
    if (input) input.value = id;
}
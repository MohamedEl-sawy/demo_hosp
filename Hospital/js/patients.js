'use strict';

/* ================= BASE ================= */
const BASE_URL = "https://safeheart-2d878-default-rtdb.firebaseio.com";

/* ================= STATE ================= */
let users = {};
let inPatients = {};
let contacts = {};
let selectedEditId = null;

/* ================= LOADER ================= */
window.addEventListener('load', () => {
    const loader = document.getElementById('pageLoader');
    setTimeout(() => loader.classList.add('hidden'), 400);
});

/* ================= INIT ================= */
window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    renderTable();
    updateStats();
    bindEvents();
});

/* ================= FETCH ================= */
async function loadData() {
    const [u, ip, ec] = await Promise.all([
        fetch(`${BASE_URL}/users.json`),
        fetch(`${BASE_URL}/inPatients.json`),
        fetch(`${BASE_URL}/emergency_contacts.json`)
    ]);

    users = await u.json() || {};
    inPatients = await ip.json() || {};
    contacts = await ec.json() || {};
}

/* ================= EVENTS ================= */
function bindEvents() {

    document.getElementById("cancelEditBtn").onclick =
        () => closeModal("editModal");

    document.getElementById("saveEditBtn").onclick = saveEdit;

    document.getElementById("cancelDischargeBtn").onclick =
        () => closeModal("dischargeModal");

    document.getElementById("doDischargeBtn").onclick = dischargePatient;

    document.getElementById("searchInput").addEventListener("input", searchTable);
}

/* ================= TABLE ================= */
function renderTable(list = null) {
    const tbody = document.getElementById("ptBody");
    const empty = document.getElementById("tableEmpty");

    const data = list || Object.keys(inPatients);

    if (data.length === 0) {
        tbody.innerHTML = "";
        empty.classList.add("visible");
        return;
    }

    empty.classList.remove("visible");

    tbody.innerHTML = data.map(uid => {

        const p = inPatients[uid];
        const u = users[uid];

        return `
        <tr>
            <td>${u?.name || uid}</td>
            <td><span class="status-badge ${p.status.toLowerCase()}">${p.status}</span></td>
            <td>Rm ${p.room}</td>
            <td>${p.condition || "-"}</td>
            <td>${p.admitted}</td>
            <td>
                <div class="tbl-actions">
                    <button class="tbl-btn view" onclick="openEdit('${uid}')">
                        <i class="fas fa-eye"></i>
                    </button>

                    <button class="tbl-btn discharge" onclick="openDischarge('${uid}')">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>

                    <button class="tbl-btn report" onclick="goReport('${uid}')">
                        <i class="fas fa-file-medical"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join("");

    document.getElementById("tableCount").innerText =
        `${data.length} patients`;
}

/* ================= SEARCH ================= */
function searchTable(e) {
    const q = e.target.value.toLowerCase();

    const filtered = Object.keys(inPatients).filter(uid => {
        const u = users[uid];
        return (
            uid.toLowerCase().includes(q) ||
            (u?.name || "").toLowerCase().includes(q)
        );
    });

    renderTable(filtered);
}

/* ================= EDIT ================= */
function openEdit(uid) {
    selectedEditId = uid;

    const p = inPatients[uid];
    const u = users[uid];

    document.getElementById("eName").value = u?.name || "";
    document.getElementById("eId").value = uid;
    document.getElementById("eRoom").value = p.room || "";
    document.getElementById("eDept").value = p.dept || "";
    document.getElementById("eStatus").value = p.status || "Stable";
    document.getElementById("eCondition").value = p.condition || "";

    renderContacts(uid);
    styleEditModal();

    openModal("editModal");
}

/* ================= CONTACTS UI ================= */
function renderContacts(uid) {

    const modal = document.querySelector("#editModal .modal-box");

    let old = document.getElementById("contactsBox");
    if (old) old.remove();

    const wrap = document.createElement("div");
    wrap.id = "contactsBox";

    const list = contacts[uid] || {};

    wrap.innerHTML = `
        <h3 style="margin-bottom:10px;">Emergency Contacts</h3>
        <div class="contacts-grid">
            ${
                Object.values(list).map(c => `
                    <div class="contact-card">
                        <strong>${c.name}</strong>
                        <small>${c.relationship}</small>
                        <p>${c.phone}</p>
                        <span class="priority">P${c.priority}</span>
                    </div>
                `).join("") || `<p>No contacts</p>`
            }
        </div>
    `;

    modal.appendChild(wrap);
}

/* ================= STYLE FROM JS 🔥 ================= */
function styleEditModal() {

    const modal = document.querySelector("#editModal .modal-box");

    // ===== MAIN LAYOUT =====
    modal.style.maxWidth = "1100px";
    modal.style.width = "95%";
    modal.style.display = "grid";
    modal.style.gridTemplateColumns = "2fr 1fr";
    modal.style.gap = "20px";
    modal.style.borderRadius = "16px";

    // ===== HEADER تحسين =====
    const header = modal.querySelector(".modal-hdr");
    header.style.gridColumn = "1 / -1";
    header.style.borderBottom = "1px solid #eee";
    header.style.paddingBottom = "10px";

    // ===== FORM =====
    const form = modal.querySelector(".form-grid");
    form.style.gridColumn = "1 / 2";

    // ===== CONTACTS =====
    const contacts = document.getElementById("contactsBox");
    contacts.style.gridColumn = "2 / 3";

    contacts.innerHTML = `
        <h3 style="margin-bottom:15px;">👨‍👩‍👧 Patient Companions</h3>
        <div class="contacts-grid">
            ${contacts.innerHTML}
        </div>
    `;

    contacts.style.background = "#f9fafb";
    contacts.style.padding = "15px";
    contacts.style.borderRadius = "14px";
    contacts.style.border = "1px solid #e5e7eb";

    const grid = contacts.querySelector(".contacts-grid");
    grid.style.display = "flex";
    grid.style.flexDirection = "column";
    grid.style.gap = "12px";

    // ===== CARD STYLE =====
    document.querySelectorAll(".contact-card").forEach(card => {

        card.style.background = "#fff";
        card.style.padding = "12px";
        card.style.borderRadius = "12px";
        card.style.border = "1px solid #ddd";
        card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
        card.style.transition = "0.3s";

        card.onmouseenter = () => {
            card.style.transform = "translateY(-3px)";
            card.style.boxShadow = "0 6px 15px rgba(0,0,0,0.1)";
        };

        card.onmouseleave = () => {
            card.style.transform = "none";
            card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
        };

        const badge = card.querySelector(".priority");
        if (badge) {
            badge.style.position = "absolute";
            badge.style.top = "10px";
            badge.style.right = "10px";
            badge.style.background = "#3b82f6";
            badge.style.color = "#fff";
            badge.style.padding = "3px 7px";
            badge.style.borderRadius = "6px";
            badge.style.fontSize = "11px";
        }
    });

    // ===== BUTTONS 🔥 =====
    const footer = modal.querySelector(".modal-footer");

    footer.style.gridColumn = "1 / -1";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "10px";
    footer.style.marginTop = "10px";

    const buttons = footer.querySelectorAll("button");

    buttons.forEach(btn => {
        btn.style.width = "auto";
        btn.style.padding = "10px 18px";
        btn.style.borderRadius = "8px";
        btn.style.fontSize = "14px";
        btn.style.cursor = "pointer";
        btn.style.transition = "0.3s";
    });

    const cancel = footer.querySelector(".cancel");
    const save = footer.querySelector(".primary");

    if (cancel) {
        cancel.style.background = "#f3f4f6";
        cancel.style.color = "#333";

        cancel.onmouseenter = () => cancel.style.background = "#e5e7eb";
        cancel.onmouseleave = () => cancel.style.background = "#f3f4f6";
    }

    if (save) {
        save.style.background = "#10b981";
        save.style.color = "#fff";

        save.onmouseenter = () => save.style.background = "#059669";
        save.onmouseleave = () => save.style.background = "#10b981";
    }

    // ===== RESPONSIVE =====
    if (window.innerWidth < 900) {
        modal.style.gridTemplateColumns = "1fr";
        contacts.style.gridColumn = "1 / 2";
    }
}
/* ================= SAVE ================= */
async function saveEdit() {

    if (!selectedEditId) return;

    const updated = {
        room: document.getElementById("eRoom").value,
        dept: document.getElementById("eDept").value,
        status: document.getElementById("eStatus").value,
        condition: document.getElementById("eCondition").value,
        admitted: inPatients[selectedEditId].admitted
    };

    await fetch(`${BASE_URL}/inPatients/${selectedEditId}.json`, {
        method: "PUT",
        body: JSON.stringify(updated)
    });

    showToast("Saved Successfully", "success");

    await loadData();
    renderTable();
    closeModal("editModal");
}

/* ================= DISCHARGE ================= */
let dischargeId = null;

function openDischarge(uid) {
    dischargeId = uid;
    document.getElementById("dischargeName").innerText =
        users[uid]?.name || uid;

    openModal("dischargeModal");
}

async function dischargePatient() {

    if (!dischargeId) return;

    await fetch(`${BASE_URL}/inPatients/${dischargeId}.json`, {
        method: "DELETE"
    });

    showToast("Patient Discharged", "info");

    await loadData();
    renderTable();
    closeModal("dischargeModal");
}

/* ================= REPORT ================= */
function goReport(uid) {
    window.location.href = `Report.html?id=${uid}`;
}

/* ================= MODAL ================= */
function openModal(id) {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

/* ================= TOAST ================= */
function showToast(msg, type = "success") {

    const toast = document.getElementById("toast");
    const icon = document.getElementById("toastIcon");
    const text = document.getElementById("toastMsg");

    const icons = {
        success: "fas fa-check-circle",
        error: "fas fa-times-circle",
        info: "fas fa-info-circle"
    };

    icon.className = icons[type] || icons.success;
    text.innerText = msg;   

    toast.classList.add("show");

    setTimeout(() => toast.classList.remove("show"), 3000);
}

/* ================= STATS ================= */
function updateStats() {

    document.getElementById("statTotal").innerText =
        Object.keys(users).length;

    document.getElementById("statActive").innerText =
        Object.keys(inPatients).length;

    document.getElementById("statCritical").innerText =
        Object.values(inPatients).filter(p => p.status === "Critical").length;
}
const API_URL = "https://script.google.com/macros/s/AKfycbynVP5GkoO_oo5Akhl065rKmDufOYYdaBPdThGB23S1-qCTSls-LCeA9SIUqbP3IZ5gJA/exec";

/* ---------- STATE ---------- */
let students = [];
let activeFilter = "All";
let searchText = "";
let pendingDeleteId = null;

/* ---------- ELEMENTS ---------- */
const form = document.getElementById("studentForm");
const message = document.getElementById("message");
const tableBody = document.getElementById("studentTableBody");
const submitBtn = document.getElementById("submitBtn");
const toastEl = document.getElementById("toast");
const modalBack = document.getElementById("modalBack");

const avatarColors = ["#5b6cff", "#8a5bff", "#ff6fb1", "#18b27a", "#f5a623", "#2f8cff", "#ef4f6b"];
const domainIcons = {
  "Java Full Stack": "☕",
  "Data Analytics": "📊",
  "Python": "🐍",
  "Cloud": "☁️",
  "UI/UX": "🎨"
};

/* ---------- HELPERS ---------- */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2)
    .map(w => w[0].toUpperCase()).join("");
}

function colorFor(name) {
  let sum = 0;
  for (const c of String(name)) sum += c.charCodeAt(0);
  return avatarColors[sum % avatarColors.length];
}

function statusClass(status) {
  if (status === "Placed") return "placed";
  if (status === "Interview Ready") return "ready";
  return "learning";
}

function showMessage(text, type) {
  message.innerText = text;
  message.className = type;
}

let toastTimer;
function toast(text) {
  toastEl.innerText = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function celebrate() {
  const icons = ["🎉", "🎊", "⭐", "🏆", "✨"];
  for (let i = 0; i < 24; i++) {
    const el = document.createElement("span");
    el.className = "confetti";
    el.innerText = icons[i % icons.length];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDelay = Math.random() * 0.6 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

/* ---------- TEACHING: highlight CRUD card + inspector ---------- */
function highlightCrud(op) {
  document.querySelectorAll(".crudCard").forEach(c => c.classList.remove("active"));
  const card = document.getElementById("crud-" + op);
  if (card) card.classList.add("active");
}

function updateInspector(op, method, request, response, ms) {
  document.getElementById("inspOp").innerText = op.toUpperCase();
  document.getElementById("inspMethod").innerText = method;
  document.getElementById("inspTime").innerText = ms + " ms";
  document.getElementById("inspReq").innerText =
    typeof request === "string" ? request : JSON.stringify(request, null, 2);

  let resText;
  if (response && Array.isArray(response.data)) {
    resText = JSON.stringify({
      success: response.success,
      message: response.message,
      data: `[ ${response.data.length} student rows ]`
    }, null, 2);
  } else {
    resText = JSON.stringify(response, null, 2);
  }
  document.getElementById("inspRes").innerText = resText;
}

/* ---------- API ---------- */
async function sendRequest(payload) {
  const start = performance.now();
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  updateInspector(payload.action, "POST", payload, result, Math.round(performance.now() - start));
  return result;
}

/* ---------- READ ---------- */
async function loadStudents() {
  highlightCrud("read");
  renderSkeleton();
  const start = performance.now();
  const url = `${API_URL}?action=read`;

  try {
    const response = await fetch(url);
    const result = await response.json();
    updateInspector("read", "GET", url, result, Math.round(performance.now() - start));

    if (!result.success) throw new Error(result.message);

    students = result.data;
    renderTable();
    updateStats();
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty"><span>⚠️</span>Unable to load data: ${escapeHTML(error.message)}</td></tr>`;
    showMessage("Unable to load data: " + error.message, "error");
  }
}

/* ---------- RENDER ---------- */
function renderSkeleton() {
  tableBody.innerHTML = Array.from({ length: 3 }).map(() =>
    `<tr><td colspan="4"><div class="skeleton"></div></td></tr>`
  ).join("");
}

function getVisibleStudents() {
  const q = searchText.toLowerCase();
  return students.filter(s => {
    const matchFilter = activeFilter === "All" || s.status === activeFilter;
    const matchSearch = !q ||
      String(s.name).toLowerCase().includes(q) ||
      String(s.email).toLowerCase().includes(q) ||
      String(s.domain).toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });
}

function renderTable() {
  const list = getVisibleStudents();

  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty"><span>🕵️</span>No student records found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = list.map((s, i) => `
    <tr style="animation-delay:${i * 40}ms">
      <td>
        <div class="person">
          <div class="avatar" style="background:${colorFor(s.name)}">${escapeHTML(initials(s.name))}</div>
          <div>
            <div class="pName">${escapeHTML(s.name)}</div>
            <div class="pEmail">${escapeHTML(s.email)}</div>
          </div>
        </div>
      </td>
      <td>${domainIcons[s.domain] || "💻"} ${escapeHTML(s.domain)}</td>
      <td><span class="pill ${statusClass(s.status)}">${escapeHTML(s.status)}</span></td>
      <td>
        <button class="actionBtn editBtn" data-action="edit" data-id="${escapeHTML(s.id)}">✏️ Edit</button>
        <button class="actionBtn deleteBtn" data-action="delete" data-id="${escapeHTML(s.id)}">🗑️ Delete</button>
      </td>
    </tr>
  `).join("");
}

function updateStats() {
  const count = status => students.filter(s => s.status === status).length;
  document.getElementById("statTotal").innerText = students.length;
  document.getElementById("statLearning").innerText = count("Learning");
  document.getElementById("statReady").innerText = count("Interview Ready");
  document.getElementById("statPlaced").innerText = count("Placed");
}

/* ---------- CREATE + UPDATE ---------- */
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("studentId").value;
  const isUpdate = Boolean(id);

  const payload = {
    action: isUpdate ? "update" : "create",
    id: id,
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    domain: document.getElementById("domain").value,
    status: document.getElementById("status").value
  };

  highlightCrud(payload.action);
  submitBtn.disabled = true;

  try {
    showMessage("⏳ Processing...", "success");
    const result = await sendRequest(payload);

    if (!result.success) throw new Error(result.message);

    showMessage("✅ " + result.message, "success");
    toast(isUpdate ? "✏️ Student updated!" : "➕ Student created!");
    if (payload.status === "Placed") celebrate();

    resetForm(false);
    await loadStudents();
    highlightCrud(payload.action);
  } catch (error) {
    showMessage("❌ " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- EDIT (fills the form, then UPDATE is sent on submit) ---------- */
function editStudent(id) {
  const student = students.find(item => String(item.id) === String(id));
  if (!student) return;

  document.getElementById("studentId").value = student.id;
  document.getElementById("name").value = student.name;
  document.getElementById("email").value = student.email;
  document.getElementById("domain").value = student.domain;
  document.getElementById("status").value = student.status;

  document.getElementById("formTitle").innerText = "Update Student";
  submitBtn.innerText = "Update Student";
  document.getElementById("formCard").classList.add("editing");
  document.getElementById("modeBadge").innerText = "UPDATE MODE";
  document.getElementById("modeHint").innerHTML =
    `You are editing ID <code>${escapeHTML(student.id)}</code>. Pressing Update sends a <b>POST</b> with <code>action: "update"</code> and this ID.`;

  highlightCrud("update");
  window.scrollTo({ top: document.getElementById("formCard").offsetTop - 20, behavior: "smooth" });
}

/* ---------- DELETE (with confirm dialog) ---------- */
function askDelete(id) {
  const student = students.find(item => String(item.id) === String(id));
  pendingDeleteId = id;
  document.getElementById("modalText").innerText =
    `${student ? student.name : "This student"} will be permanently removed from your Google Sheet. This cannot be undone.`;
  modalBack.classList.add("show");
  highlightCrud("delete");
}

function closeModal() {
  modalBack.classList.remove("show");
  pendingDeleteId = null;
}

async function confirmDelete() {
  const id = pendingDeleteId;
  closeModal();
  if (id === null) return;

  try {
    const result = await sendRequest({ action: "delete", id: id });
    if (!result.success) throw new Error(result.message);

    showMessage("✅ " + result.message, "success");
    toast("🗑️ Student deleted");
    await loadStudents();
    highlightCrud("delete");
  } catch (error) {
    showMessage("❌ " + error.message, "error");
  }
}

/* ---------- RESET ---------- */
function resetForm(clearMessage = true) {
  form.reset();
  document.getElementById("studentId").value = "";
  document.getElementById("formTitle").innerText = "Add Student";
  submitBtn.innerText = "Create Student";
  document.getElementById("formCard").classList.remove("editing");
  document.getElementById("modeBadge").innerText = "CREATE MODE";
  document.getElementById("modeHint").innerHTML =
    `Fill the form and press Create. This sends a <b>POST</b> request with <code>action: "create"</code>.`;
  if (clearMessage) showMessage("", "");
}

/* ---------- EVENTS ---------- */
tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "edit") editStudent(id);
  if (btn.dataset.action === "delete") askDelete(id);
});

document.getElementById("cancelBtn").addEventListener("click", () => resetForm());
document.getElementById("refreshBtn").addEventListener("click", loadStudents);
document.getElementById("modalCancel").addEventListener("click", closeModal);
document.getElementById("modalConfirm").addEventListener("click", confirmDelete);
modalBack.addEventListener("click", (e) => { if (e.target === modalBack) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchText = e.target.value.trim();
  renderTable();
});

document.getElementById("chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  activeFilter = chip.dataset.filter;
  renderTable();
});

/* ---------- START ---------- */
loadStudents();

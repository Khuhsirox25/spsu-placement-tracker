const API_URL = "https://script.google.com/macros/s/AKfycbynVP5GkoO_oo5Akhl065rKmDufOYYdaBPdThGB23S1-qCTSls-LCeA9SIUqbP3IZ5gJA/exec";

let students = [], activeFilter = "All", searchText = "", pendingDeleteId = null;

const $ = id => document.getElementById(id);
const form = $("studentForm"), tableBody = $("studentTableBody"), submitBtn = $("submitBtn");
const colors = ["#c62839", "#1b2b5e", "#14a870", "#e69b1e", "#2f7df6", "#8a5bff", "#e8475a"];
const icons = { "Java Full Stack": "☕", "Data Analytics": "📊", "Python": "🐍", "Cloud": "☁️", "UI/UX": "🎨" };

/* ---------- helpers ---------- */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
const colorFor = n => colors[[...String(n)].reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length];
const statusClass = s => s === "Placed" ? "placed" : s === "Interview Ready" ? "ready" : "learning";

function showMessage(text, type) { $("message").innerText = text; $("message").className = type; }

let toastTimer;
function toast(text) {
  $("toast").innerText = text;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}

/* ---------- teaching: highlight CRUD card + inspector ---------- */
function highlightCrud(op) {
  document.querySelectorAll(".crudCard").forEach(c => c.classList.remove("active"));
  $("crud-" + op)?.classList.add("active");
}

function updateInspector(op, method, request, response, ms) {
  $("inspOp").innerText = op.toUpperCase();
  $("inspMethod").innerText = method;
  $("inspTime").innerText = ms + " ms";
  $("inspReq").innerText = typeof request === "string" ? request : JSON.stringify(request, null, 2);
  const shown = Array.isArray(response?.data)
    ? { success: response.success, message: response.message, data: `[ ${response.data.length} student rows ]` }
    : response;
  $("inspRes").innerText = JSON.stringify(shown, null, 2);
}

/* ---------- API ---------- */
async function sendRequest(payload) {
  const t = performance.now();
  const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
  const result = await res.json();
  updateInspector(payload.action, "POST", payload, result, Math.round(performance.now() - t));
  return result;
}

/* ---------- READ ---------- */
async function loadStudents() {
  highlightCrud("read");
  tableBody.innerHTML = Array(3).fill(`<tr><td colspan="4"><div class="skeleton"></div></td></tr>`).join("");
  const t = performance.now(), url = `${API_URL}?action=read`;
  try {
    const result = await (await fetch(url)).json();
    updateInspector("read", "GET", url, result, Math.round(performance.now() - t));
    if (!result.success) throw new Error(result.message);
    students = result.data;
    renderTable();
    updateStats();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty"><span>⚠️</span>Unable to load data: ${esc(err.message)}</td></tr>`;
  }
}

function renderTable() {
  const q = searchText.toLowerCase();
  const list = students.filter(s =>
    (activeFilter === "All" || s.status === activeFilter) &&
    (!q || [s.name, s.email, s.domain].some(v => String(v).toLowerCase().includes(q)))
  );

  if (!list.length) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty"><span>🕵️</span>No student records found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = list.map(s => `
    <tr>
      <td><div class="person">
        <div class="avatar" style="background:${colorFor(s.name)}">${esc(initials(s.name))}</div>
        <div><div class="pName">${esc(s.name)}</div><div class="pEmail">${esc(s.email)}</div></div>
      </div></td>
      <td>${icons[s.domain] || "💻"} ${esc(s.domain)}</td>
      <td><span class="pill ${statusClass(s.status)}">${esc(s.status)}</span></td>
      <td>
        <button class="actionBtn editBtn" data-action="edit" data-id="${esc(s.id)}">✏️ Edit</button>
        <button class="actionBtn deleteBtn" data-action="delete" data-id="${esc(s.id)}">🗑️ Delete</button>
      </td>
    </tr>`).join("");
}

function updateStats() {
  const n = st => students.filter(s => s.status === st).length;
  $("statTotal").innerText = students.length;
  $("statLearning").innerText = n("Learning");
  $("statReady").innerText = n("Interview Ready");
  $("statPlaced").innerText = n("Placed");
}

/* ---------- CREATE + UPDATE ---------- */
form.addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("studentId").value, isUpdate = Boolean(id);
  const payload = {
    action: isUpdate ? "update" : "create",
    id,
    name: $("name").value.trim(),
    email: $("email").value.trim(),
    domain: $("domain").value,
    status: $("status").value
  };

  highlightCrud(payload.action);
  submitBtn.disabled = true;
  try {
    showMessage("⏳ Processing...", "success");
    const result = await sendRequest(payload);
    if (!result.success) throw new Error(result.message);
    showMessage("✅ " + result.message, "success");
    toast(isUpdate ? "✏️ Student updated!" : "➕ Student created!");
    resetForm(false);
    await loadStudents();
    highlightCrud(payload.action);
  } catch (err) {
    showMessage("❌ " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- EDIT: fills the form, UPDATE is sent on submit ---------- */
function editStudent(id) {
  const s = students.find(x => String(x.id) === String(id));
  if (!s) return;
  $("studentId").value = s.id;
  $("name").value = s.name;
  $("email").value = s.email;
  $("domain").value = s.domain;
  $("status").value = s.status;
  $("formTitle").innerText = "Update Student";
  submitBtn.innerText = "Update Student";
  $("formCard").classList.add("editing");
  $("modeBadge").innerText = "UPDATE MODE";
  $("modeHint").innerHTML = `Editing ID <code>${esc(s.id)}</code>. Pressing Update sends a <b>POST</b> with <code>action: "update"</code> and this ID.`;
  highlightCrud("update");
  $("dashboard").scrollIntoView({ behavior: "smooth" });
}

/* ---------- DELETE with confirm dialog ---------- */
function askDelete(id) {
  const s = students.find(x => String(x.id) === String(id));
  pendingDeleteId = id;
  $("modalText").innerText = `${s ? s.name : "This student"} will be permanently removed from your Google Sheet. This cannot be undone.`;
  $("modalBack").classList.add("show");
  highlightCrud("delete");
}

function closeModal() { $("modalBack").classList.remove("show"); pendingDeleteId = null; }

async function confirmDelete() {
  const id = pendingDeleteId;
  closeModal();
  if (id === null) return;
  try {
    const result = await sendRequest({ action: "delete", id });
    if (!result.success) throw new Error(result.message);
    showMessage("✅ " + result.message, "success");
    toast("🗑️ Student deleted");
    await loadStudents();
    highlightCrud("delete");
  } catch (err) {
    showMessage("❌ " + err.message, "error");
  }
}

function resetForm(clearMsg = true) {
  form.reset();
  $("studentId").value = "";
  $("formTitle").innerText = "Add Student";
  submitBtn.innerText = "Create Student";
  $("formCard").classList.remove("editing");
  $("modeBadge").innerText = "CREATE MODE";
  $("modeHint").innerHTML = `Fill the form and press Create. This sends a <b>POST</b> with <code>action: "create"</code>.`;
  if (clearMsg) showMessage("", "");
}

/* ---------- events ---------- */
tableBody.addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  btn.dataset.action === "edit" ? editStudent(btn.dataset.id) : askDelete(btn.dataset.id);
});
$("cancelBtn").addEventListener("click", () => resetForm());
$("refreshBtn").addEventListener("click", loadStudents);
$("modalCancel").addEventListener("click", closeModal);
$("modalConfirm").addEventListener("click", confirmDelete);
$("modalBack").addEventListener("click", e => { if (e.target.id === "modalBack") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
$("searchInput").addEventListener("input", e => { searchText = e.target.value.trim(); renderTable(); });
$("chips").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  activeFilter = chip.dataset.filter;
  renderTable();
});

loadStudents();

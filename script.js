const API_URL = "https://script.google.com/macros/s/AKfycbynVP5GkoO_oo5Akhl065rKmDufOYYdaBPdThGB23S1-qCTSls-LCeA9SIUqbP3IZ5gJA/exec";

let students = [];

const form = document.getElementById("studentForm");
const message = document.getElementById("message");
const tableBody = document.getElementById("studentTableBody");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("studentId").value;

  const payload = {
    action: id ? "update" : "create",
    id: id,
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    domain: document.getElementById("domain").value,
    status: document.getElementById("status").value
  };

  try {
    showMessage("Processing...", "success");
    const result = await sendRequest(payload);

    if (!result.success) {
      throw new Error(result.message);
    }

    showMessage(result.message, "success");
    resetForm();
    loadStudents();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

async function loadStudents() {
  try {
    const response = await fetch(`${API_URL}?action=read`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    students = result.data;
    renderTable();
  } catch (error) {
    showMessage("Unable to load data: " + error.message, "error");
  }
}

function renderTable() {
  tableBody.innerHTML = "";

  if (students.length === 0) {
    tableBody.innerHTML =
      `<tr><td colspan="5">No student records found.</td></tr>`;
    return;
  }

  students.forEach(student => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${student.name}</td>
      <td>${student.email}</td>
      <td>${student.domain}</td>
      <td>${student.status}</td>
      <td>
        <button class="actionBtn editBtn"
          onclick="editStudent('${student.id}')">Edit</button>
        <button class="actionBtn deleteBtn"
          onclick="deleteStudent('${student.id}')">Delete</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function editStudent(id) {
  const student = students.find(item =>
    String(item.id) === String(id)
  );

  if (!student) return;

  document.getElementById("studentId").value = student.id;
  document.getElementById("name").value = student.name;
  document.getElementById("email").value = student.email;
  document.getElementById("domain").value = student.domain;
  document.getElementById("status").value = student.status;

  document.getElementById("formTitle").innerText = "Update Student";
  document.getElementById("submitBtn").innerText = "Update Student";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteStudent(id) {
  const confirmed = confirm(
    "Are you sure you want to delete this student record?"
  );

  if (!confirmed) return;

  try {
    const result = await sendRequest({
      action: "delete",
      id: id
    });

    if (!result.success) {
      throw new Error(result.message);
    }

    showMessage(result.message, "success");
    loadStudents();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function sendRequest(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return await response.json();
}

function resetForm() {
  form.reset();
  document.getElementById("studentId").value = "";
  document.getElementById("formTitle").innerText = "Add Student";
  document.getElementById("submitBtn").innerText = "Create Student";
}

function showMessage(text, type) {
  message.innerText = text;
  message.className = type;
}

loadStudents();
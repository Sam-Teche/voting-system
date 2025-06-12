// API Configuration
const API_BASE_URL = "http://localhost:3000/api";

let currentUser = null;
let selectedCandidate = null;
let adminToken = null;

// Utility
function showMessage(elementId, message, type = "info") {
  const element = document.getElementById(elementId);
  element.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (element.innerHTML = ""), 4000);
}

function showPage(pageId) {
  document
    .querySelectorAll(".page")
    .forEach((page) => page.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

function showAdminSection(sectionId) {
  document
    .querySelectorAll(".admin-section")
    .forEach((section) => (section.style.display = "none"));
  document.getElementById(sectionId).style.display = "block";
  if (sectionId === "candidates") loadCandidatesAdmin();
  if (sectionId === "whitelist") loadWhitelist();
  if (sectionId === "links") loadGeneratedLinks();
  if (sectionId === "admin-results") loadAdminResults();
}

async function apiCall(endpoint, method = "GET", data = null, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth && adminToken) headers["Authorization"] = adminToken;
  const options = { method, headers };
  if (data) options.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const result = await res.json();
  if (!res.ok) throw new Error(result.message);
  return result;
}

// Student
async function studentLogin() {
  const email = document.getElementById("email").value.trim();
  const matric = document.getElementById("matric").value.trim().toUpperCase();
  if (!email || !matric)
    return showMessage("loginMessage", "All fields required", "error");
  if (!matric.startsWith("SVG"))
    return showMessage("loginMessage", "Matric must start with SVG", "error");

  try {
    await apiCall("/student/login", "POST", { email, matric });
    currentUser = { email, matric };
    showMessage("loginMessage", "Login successful", "success");
    setTimeout(() => {
      loadCandidates();
      showPage("voting");
    }, 1000);
  } catch (err) {
    showMessage("loginMessage", err.message, "error");
  }
}

async function loadCandidates() {
  try {
    const candidates = await apiCall("/candidates");
    const list = document.getElementById("candidatesList");
    list.innerHTML = candidates
      .map(
        (c) => `
            <div class="candidate-card" onclick="selectCandidate('${c._id}', this)">
                <div class="candidate-info">
                    <div class="candidate-details">
                        <h3>${c.name}</h3>
                        <p><strong>Post:</strong> ${c.post}</p>
                        <p>${c.description}</p>
                    </div>
                    <button class="vote-button">Select</button>
                </div>
            </div>`
      )
      .join("");
  } catch (err) {
    showMessage("voteMessage", "Error loading candidates", "error");
  }
}

function selectCandidate(candidateId, card) {
  selectedCandidate = candidateId;
  document
    .querySelectorAll(".candidate-card")
    .forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");
  document.getElementById("submitVoteBtn").disabled = false;
}

async function submitVote() {
  if (!selectedCandidate) return;
  try {
    await apiCall("/vote", "POST", {
      matric: currentUser.matric,
      candidateId: selectedCandidate,
    });
    showMessage("voteMessage", "Vote submitted!", "success");
    setTimeout(() => {
      loadResults();
      showPage("results");
    }, 1500);
  } catch (err) {
    showMessage("voteMessage", err.message, "error");
  }
}

// Admin
async function adminSignup() {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const confirm = document.getElementById("adminConfirmPassword").value;
  if (!email || !password || password !== confirm) {
    return showMessage("signupMessage", "Check fields & passwords!", "error");
  }
  try {
    await apiCall("/admin/signup", "POST", { email, password });
    showMessage("signupMessage", "Admin created!", "success");
  } catch (err) {
    showMessage("signupMessage", err.message, "error");
  }
}

async function adminLogin() {
  const email = document.getElementById("adminLoginEmail").value.trim();
  const password = document.getElementById("adminLoginPassword").value;
  if (!email || !password)
    return showMessage("adminLoginMessage", "All fields required", "error");
  try {
    const result = await apiCall("/admin/login", "POST", { email, password });
    adminToken = result.token;
    showMessage("adminLoginMessage", "Login success", "success");
    setTimeout(() => {
      showPage("admin-panel");
      showAdminSection("candidates");
    }, 800);
  } catch (err) {
    showMessage("adminLoginMessage", err.message, "error");
  }
}

function logout() {
  adminToken = null;
  currentUser = null;
  showPage("login");
}

// Admin Candidates
async function addCandidate() {
  const name = document.getElementById("candidateName").value;
  const post = document.getElementById("candidatePost").value;
  const description = document.getElementById("candidateDescription").value;
  if (!name || !post || !description)
    return showMessage("candidatesMessage", "All fields required", "error");
  try {
    await apiCall(
      "/admin/candidates",
      "POST",
      { name, post, description },
      true
    );
    showMessage("candidatesMessage", "Candidate added!", "success");
    document.getElementById("candidateName").value = "";
    document.getElementById("candidatePost").value = "";
    document.getElementById("candidateDescription").value = "";
    loadCandidatesAdmin();
  } catch (err) {
    showMessage("candidatesMessage", err.message, "error");
  }
}

async function loadCandidatesAdmin() {
  try {
    const candidates = await apiCall("/candidates");
    const list = document.getElementById("candidatesList-admin");
    list.innerHTML = candidates
      .map(
        (c) => `
            <div class="candidate-card">
                <div class="candidate-info">
                    <div class="candidate-details">
                        <h3>${c.name}</h3><p><strong>Post:</strong> ${c.post}</p><p>${c.description}</p><p><strong>Votes:</strong> ${c.votes}</p>
                    </div>
                    <button class="remove-btn" onclick="removeCandidate('${c._id}')">Remove</button>
                </div>
            </div>`
      )
      .join("");
  } catch (err) {
    showMessage("candidatesMessage", "Error loading candidates", "error");
  }
}

async function removeCandidate(id) {
  if (!confirm("Delete candidate?")) return;
  try {
    await apiCall(`/admin/candidates/${id}`, "DELETE", null, true);
    loadCandidatesAdmin();
  } catch (err) {
    showMessage("candidatesMessage", err.message, "error");
  }
}

// Whitelist
async function addToWhitelist() {
  const matric = document
    .getElementById("newMatricNumber")
    .value.trim()
    .toUpperCase();
  if (!matric.startsWith("SVG"))
    return showMessage(
      "whitelistMessage",
      "Matric must start with SVG",
      "error"
    );
  try {
    await apiCall("/admin/whitelist", "POST", { matric }, true);
    loadWhitelist();
    document.getElementById("newMatricNumber").value = "";
  } catch (err) {
    showMessage("whitelistMessage", err.message, "error");
  }
}

async function bulkAddToWhitelist() {
  const list = document
    .getElementById("bulkMatricNumbers")
    .value.split("\n")
    .map((m) => m.trim().toUpperCase());
  try {
    await apiCall(
      "/admin/whitelist/bulk",
      "POST",
      { matricNumbers: list },
      true
    );
    loadWhitelist();
    document.getElementById("bulkMatricNumbers").value = "";
  } catch (err) {
    showMessage("whitelistMessage", err.message, "error");
  }
}

async function loadWhitelist() {
  try {
    const list = await apiCall("/admin/whitelist", "GET", null, true);
    document.getElementById("whitelistDisplay").innerHTML = list
      .map(
        (m) => `
            <div class="whitelist-item">
                <span>${m}</span>
                <button class="remove-btn" onclick="removeFromWhitelist('${m}')">Remove</button>
            </div>`
      )
      .join("");
  } catch (err) {
    showMessage("whitelistMessage", "Error loading whitelist", "error");
  }
}

async function removeFromWhitelist(matric) {
  if (!confirm("Remove from whitelist?")) return;
  try {
    await apiCall(`/admin/whitelist/${matric}`, "DELETE", null, true);
    loadWhitelist();
  } catch (err) {
    showMessage("whitelistMessage", err.message, "error");
  }
}

// Voting Links
async function generateVotingLink() {
  try {
    await apiCall("/admin/generate-link", "POST", null, true);
    loadGeneratedLinks();
  } catch (err) {
    showMessage("linkMessage", err.message, "error");
  }
}

async function loadGeneratedLinks() {
  try {
    const links = await apiCall("/admin/links", "GET", null, true);
    document.getElementById("generatedLinks").innerHTML = links
      .map(
        (link) => `
            <div class="login-link"><p>Created: ${new Date(
              link.created
            ).toLocaleString()}</p>
            <code>${link.url}</code></div>`
      )
      .join("");
  } catch (err) {
    showMessage("linkMessage", "Error loading links", "error");
  }
}

// Results
async function loadResults() {
  try {
    const res = await apiCall("/results");
    displayResults(res, "resultsContent");
  } catch (err) {
    showMessage("resultsContent", err.message, "error");
  }
}

async function loadAdminResults() {
  try {
    const res = await apiCall("/admin/results", "GET", null, true);
    displayResults(res, "adminResultsContent");
  } catch (err) {
    showMessage("adminResultsContent", err.message, "error");
  }
}

function displayResults(results, containerId) {
  const container = document.getElementById(containerId);
  const { candidates, totalVotes } = results;
  const rows = candidates
    .map(
      (c) => `
        <tr><td>${c.name}</td><td>${c.post}</td><td>${c.votes}</td><td>${c.percentage}%</td></tr>`
    )
    .join("");

  container.innerHTML = `
        <h3>Total Votes: ${totalVotes}</h3>
        <table class='results-table'><tr><th>Name</th><th>Post</th><th>Votes</th><th>Percent</th></tr>${rows}</table>
        <div class='chart-container'><canvas id="resultChart"></canvas></div>`;

  const chartCtx = document.getElementById("resultChart").getContext("2d");
  new Chart(chartCtx, {
    type: "bar",
    data: {
      labels: candidates.map((c) => c.name),
      datasets: [
        {
          label: "Votes",
          data: candidates.map((c) => c.votes),
          backgroundColor: "#667eea",
        },
      ],
    },
  });
}

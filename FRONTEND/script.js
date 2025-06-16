// API Configuration
const API_BASE_URL = "https://voting-backend-yf6o.onrender.com/api";

let currentUser = null;
let adminToken = null;
let selectedCandidates = {};
let candidateNames = {};
let availablePositions = [];

// Utility
function showMessage(elementId, message, type = "info") {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => (element.innerHTML = ""), 4000);
  }
}

function showPage(pageId) {
  console.log(`Showing page: ${pageId}`);
  document
    .querySelectorAll(".page")
    .forEach((page) => page.classList.remove("active"));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add("active");
  } else {
    console.error(`Page with id '${pageId}' not found`);
  }
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

document.addEventListener("DOMContentLoaded", function () {
  const progressBar = document.getElementById("main-progress");
  let progress = 0;
  const maxProgress = 100;

  // Set initial values
  progressBar.max = maxProgress;
  progressBar.value = progress;

  // Animate progress bar
  function animateProgress() {
    if (progress <= maxProgress) {
      progressBar.value = progress;
      progress += 0.5; // Increase by 0.5% each step
      setTimeout(animateProgress, 50); // Update every 50ms
    } else {
      // Reset and start again
      progress = 0;
      setTimeout(animateProgress, 1000); // Wait 1 second before restarting
    }
  }

  // Start animation
  animateProgress();
});

// Student
async function studentLogin() {
  const email = document.getElementById("email").value.trim();
  const matric = document.getElementById("matric").value.trim().toUpperCase();
  if (!email || !matric)
    return showMessage("loginMessage", "All fields required", "error");
  if (!matric.startsWith("SVG"))
    return showMessage("loginMessage", "Matric must start with SVG", "error");

  try {
    console.log("Attempting student login...", { email, matric });
    await apiCall("/student/login", "POST", { email, matric });
    currentUser = { email, matric };
    showMessage("loginMessage", "Login successful", "success");
    setTimeout(() => {
      console.log("Loading candidates and showing voting page...");
      loadCandidates();
      showPage("voting");
    }, 1000);
  } catch (err) {
    console.error("Login error:", err);
    showMessage("loginMessage", err.message, "error");
  }
}

async function loadCandidates() {
  console.log("Loading candidates...");
  try {
    const response = await apiCall("/candidates");
    console.log("Raw API response:", response);

    // Handle the response structure from your backend
    let candidates = [];
    if (response.candidates && Array.isArray(response.candidates)) {
      candidates = response.candidates;
    } else if (Array.isArray(response)) {
      candidates = response;
    } else {
      throw new Error("Invalid response format");
    }

    console.log("Processed candidates:", candidates);

    if (candidates.length === 0) {
      showMessage(
        "voteMessage",
        "No candidates available at the moment",
        "info"
      );
      return;
    }

    // Group candidates by position
    const grouped = candidates.reduce((acc, curr) => {
      if (!acc[curr.post]) {
        acc[curr.post] = [];
      }
      acc[curr.post].push(curr);
      return acc;
    }, {});

    console.log("Grouped candidates:", grouped);
    availablePositions = Object.keys(grouped);
    console.log("Available positions:", availablePositions);

    const container = document.getElementById("candidatesList");
    if (!container) {
      console.error("candidatesList container not found!");
      return;
    }

    if (availablePositions.length === 0) {
      container.innerHTML = "<p>No positions available for voting.</p>";
      return;
    }

    container.innerHTML = Object.entries(grouped)
      .map(([position, candidates]) => {
        return `
        <div class="position-section">
          <h3 class="position-title">${position}</h3>
          <p class="position-instruction">Select one candidate for ${position}:</p>
          <div class="candidates-grid">
            ${candidates
              .map(
                (c) => `
              <div class="candidate-card" data-position="${position}" data-candidate-id="${
                  c._id
                }" onclick="selectCandidate('${c._id}', '${position}', '${
                  c.name
                }', this)">
                <div class="candidate-info">
                  <div class="candidate-details">
                    <h4>${c.name}</h4>
                    <p class="candidate-description">${
                      c.description || "No description provided"
                    }</p>
                  </div>
                  <div class="vote-indicator">
                    <span class="checkmark">✓</span>
                  </div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
      })
      .join("");

    updateSubmitButtonState();
    updateProgressIndicator();
    console.log("Candidates loaded successfully");
  } catch (error) {
    console.error("Failed to load candidates:", error);
    showMessage(
      "voteMessage",
      `Failed to load candidates: ${error.message}`,
      "error"
    );
  }
}

function selectCandidate(candidateId, position, candidateName, cardElement) {
  console.log("Selecting candidate:", { candidateId, position, candidateName });
  const positionCards = document.querySelectorAll(
    `[data-position="${position}"]`
  );
  positionCards.forEach((card) => card.classList.remove("selected"));
  cardElement.classList.add("selected");
  selectedCandidates[position] = candidateId;
  candidateNames[position] = candidateName;
  updateSubmitButtonState();
  updateProgressIndicator();
  updateSelectionSummary();
}

function updateSubmitButtonState() {
  const submitBtn = document.getElementById("submitVoteBtn");
  if (!submitBtn) return;

  const selectedPositions = Object.keys(selectedCandidates).length;
  const totalPositions = availablePositions.length;

  if (selectedPositions === totalPositions && totalPositions > 0) {
    submitBtn.disabled = false;
    submitBtn.textContent = `Submit All Votes (${selectedPositions}/${totalPositions})`;
    submitBtn.style.background =
      "linear-gradient(135deg, #10b981 0%, #059669 100%)";
  } else {
    submitBtn.disabled = true;
    submitBtn.textContent = `Select Candidates (${selectedPositions}/${totalPositions})`;
    submitBtn.style.background = "#a0aec0";
  }
}

function updateProgressIndicator() {
  const selectedPositions = Object.keys(selectedCandidates).length;
  const totalPositions = availablePositions.length;
  const percentage =
    totalPositions > 0 ? (selectedPositions / totalPositions) * 100 : 0;

  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");

  if (progressText) {
    progressText.textContent = `${selectedPositions}/${totalPositions} positions selected`;
  }
  if (progressFill) {
    progressFill.style.width = `${percentage}%`;
  }
}

function updateSelectionSummary() {
  const summaryDiv = document.getElementById("selectionSummary");
  const selectionsDiv = document.getElementById("selections");

  if (!summaryDiv || !selectionsDiv) return;

  if (Object.keys(selectedCandidates).length > 0) {
    summaryDiv.style.display = "block";
    const selectionItems = Object.keys(selectedCandidates)
      .map(
        (position) => `
      <div class="selection-item">
        <span class="selection-position">${position}:</span>
        <span class="selection-candidate">${candidateNames[position]}</span>
      </div>
    `
      )
      .join("");
    selectionsDiv.innerHTML = selectionItems;
  } else {
    summaryDiv.style.display = "none";
  }
}

async function submitVote() {
  const selectedPositions = Object.keys(selectedCandidates);

  if (selectedPositions.length !== availablePositions.length) {
    showMessage(
      "voteMessage",
      "Please select a candidate for each position",
      "error"
    );
    return;
  }

  try {
    const submitBtn = document.getElementById("submitVoteBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting votes...";
      submitBtn.style.background = "#667eea";
    }

    for (const position of selectedPositions) {
      const candidateId = selectedCandidates[position];
      await apiCall("/vote", "POST", {
        matric: currentUser.matric,
        candidateId,
      });
    }

    showMessage(
      "voteMessage",
      "🎉 All votes submitted successfully!",
      "success"
    );
    selectedCandidates = {};
    candidateNames = {};
    document.querySelectorAll(".candidate-card").forEach((card) => {
      card.classList.remove("selected");
      card.style.pointerEvents = "none";
      card.style.opacity = "0.6";
    });
    updateSubmitButtonState();
    updateProgressIndicator();
    updateSelectionSummary();

    setTimeout(() => {
      loadResults();
      showPage("results");
    }, 1500);
  } catch (err) {
    console.error("Error submitting votes:", err);
    showMessage(
      "voteMessage",
      "Error submitting votes. Please try again.",
      "error"
    );
    updateSubmitButtonState();
  }
}

// Enhanced API call function with better error handling
async function apiCall(endpoint, method = "GET", data = null, auth = false) {
  const headers = { "Content-Type": "application/json" };

  if (auth && adminToken) {
    const cleanToken = adminToken.replace(/^Bearer\s+/i, "");
    headers["Authorization"] = `Bearer ${cleanToken}`;
  }

  const options = { method, headers };
  if (data) options.body = JSON.stringify(data);

  try {
    console.log(`Making API call: ${method} ${API_BASE_URL}${endpoint}`);
    console.log("Headers:", headers);
    if (data) console.log("Data:", data);

    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    console.log("Response status:", res.status);

    if (!res.ok) {
      let errorMessage;
      try {
        const errorData = await res.json();
        console.log("Error response:", errorData);
        errorMessage = errorData.message || `HTTP ${res.status} error`;
      } catch {
        errorMessage = `HTTP ${res.status} error`;
      }
      throw new Error(errorMessage);
    }

    const result = await res.json();
    console.log("API response:", result);
    return result;
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

// Admin functions (keeping existing ones)
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

  if (!email || !password) {
    return showMessage("adminLoginMessage", "All fields required", "error");
  }

  try {
    const result = await apiCall("/admin/login", "POST", { email, password });

    if (!result.token) {
      showMessage(
        "adminLoginMessage",
        "Token not received from server",
        "error"
      );
      return;
    }

    adminToken = result.token;
    localStorage.setItem("adminToken", adminToken);

    console.log("Received token:", adminToken);
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
  localStorage.removeItem("adminToken");
  currentUser = null;
  showPage("login");
}

// Admin Candidates
async function addCandidate() {
  const name = document.getElementById("candidateName").value.trim();
  const post = document.getElementById("candidatePost").value.trim();
  const description = document
    .getElementById("candidateDescription")
    .value.trim();

  if (!name || !post) {
    showMessage(
      "candidatesMessage",
      "Please fill in candidate name and post",
      "error"
    );
    return;
  }

  try {
    const result = await apiCall(
      "/admin/candidates",
      "POST",
      { name, post, description },
      true
    );

    showMessage(
      "candidatesMessage",
      result.message || "Candidate added successfully",
      "success"
    );

    document.getElementById("candidateName").value = "";
    document.getElementById("candidatePost").value = "";
    document.getElementById("candidateDescription").value = "";

    loadCandidatesAdmin();
  } catch (error) {
    console.error("Error adding candidate:", error);
    showMessage(
      "candidatesMessage",
      "Error adding candidate: " + error.message,
      "error"
    );
  }
}

async function loadCandidatesAdmin() {
  try {
    const response = await apiCall("/candidates");
    const candidates = response.candidates || response;

    const list = document.getElementById("candidatesList-admin");
    if (!list) return;

    list.innerHTML = candidates
      .map(
        (c) => `
            <div class="candidate-card">
                <div class="candidate-info">
                    <div class="candidate-details">
                        <h3>${c.name}</h3>
                        <p><strong>Post:</strong> ${c.post}</p>
                        <p>${c.description}</p>
                        <p><strong>Votes:</strong> ${c.votes}</p>
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

// Whitelist functions (keeping existing ones)
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

    const sorted = list.sort((a, b) => {
      if (a.voted === b.voted) return 0;
      return a.voted ? 1 : -1;
    });

    renderWhitelist(sorted);

    const searchInput = document.getElementById("whitelistSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toUpperCase();
        const filtered = sorted.filter((m) => m.matric.includes(keyword));
        renderWhitelist(filtered);
      });
    }
  } catch (err) {
    console.error("Whitelist error:", err);
    showMessage("whitelistMessage", "Error loading whitelist", "error");
  }
}

function renderWhitelist(list) {
  const display = document.getElementById("whitelistDisplay");
  if (!display) return;

  display.innerHTML = list
    .map(
      (m) => `
        <div class="whitelist-item">
          <span>${m.matric}</span>
          <span class="status-label ${m.voted ? "voted" : "pending"}">
            ${m.voted ? "Voted" : "Pending"}
          </span>
          <button class="remove-btn" onclick="removeFromWhitelist('${
            m.matric
          }')">
            Remove
          </button>
        </div>`
    )
    .join("");
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
    const container = document.getElementById("generatedLinks");
    if (!container) return;

    container.innerHTML = links
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
  if (!container) return;

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

  const chartCanvas = document.getElementById("resultChart");
  if (chartCanvas && typeof Chart !== "undefined") {
    const chartCtx = chartCanvas.getContext("2d");
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
}

// Test function to check if candidates endpoint works
async function testCandidatesEndpoint() {
  try {
    console.log("Testing candidates endpoint...");
    const response = await fetch(`${API_BASE_URL}/candidates`);
    console.log("Response status:", response.status);
    const data = await response.json();
    console.log("Response data:", data);
    return data;
  } catch (error) {
    console.error("Test failed:", error);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const savedToken = localStorage.getItem("adminToken");
  if (savedToken && savedToken !== "null") {
    adminToken = savedToken;
    console.log("Admin token loaded from storage:", adminToken);
  } else {
    localStorage.removeItem("adminToken");
  }

  // Test the candidates endpoint on page load
  console.log("Page loaded, testing candidates endpoint...");
  testCandidatesEndpoint();
});

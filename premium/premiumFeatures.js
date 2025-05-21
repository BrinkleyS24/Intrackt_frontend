let isInsightsVisible = false;

export async function fetchData(url, body) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Error fetching data.");
    return data;
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    alert(error.message);
    throw error;
  }
}

export function setupInsightsButton(userPlan, userEmail) {
  const viewInsightsBtn = document.getElementById("view-insights");

  viewInsightsBtn.addEventListener("click", async () => {
    if (userPlan !== "premium") {
      alert("Upgrade to premium to access this feature.");
      return;
    }

    let insightsContainer = document.getElementById("insights-container");
    if (!insightsContainer) {
      insightsContainer = createInsightsContainer();
    }

    if (isInsightsVisible) {
      hideInsightsContainer(insightsContainer);
      isInsightsVisible = false;
    } else {
      await showInsightsContainer(insightsContainer, userEmail);
      isInsightsVisible = true;
    }
  });
}

function createInsightsContainer() {
  const container = document.createElement("div");
  container.id = "insights-container";
  container.className = "card insights-container";
  container.style.display = "none";

  const spinner = document.createElement("div");
  spinner.id = "loading-spinner";
  spinner.className = "spinner";
  spinner.textContent = "Loading insights...";

  container.appendChild(spinner);

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  tabs.innerHTML = `
    <button class="tab-btn active" data-tab="response-rates">Response Rates</button>
    <button class="tab-btn" data-tab="average-response-time">Avg. Response Time</button>
    <button class="tab-btn" data-tab="success-rates">Success Rates</button>
    <button class="tab-btn" data-tab="follow-ups">Follow-Up Reminders</button>
  `;
  container.appendChild(tabs);

  const content = document.createElement("div");
  content.className = "tab-content";
  content.id = "insights-content";
  container.appendChild(content);

  document.body.appendChild(container);
  setupTabListeners();
  return container;
}

function setupTabListeners() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      displayTabContent(btn.getAttribute("data-tab"));
    });
  });
}

async function showInsightsContainer(insightsContainer, userEmail) {
  const spinner = document.getElementById("loading-spinner");
  if (!spinner || !insightsContainer) return;

  spinner.style.display = "block";
  insightsContainer.style.display = "none";

  try {
    const insights = await fetchData("https://localhost:3000/api/analytics", { email: userEmail });
    const followUps = await fetchData("https://localhost:3000/api/follow-up-reminders", { email: userEmail });

    insights.followUpReminders = followUps.reminders || [];
    insightsContainer.dataset.metrics = JSON.stringify(insights);

    displayTabContent("response-rates");
    insightsContainer.style.display = "block";
  } catch (error) {
    console.error("Error fetching insights:", error);
  } finally {
    spinner.style.display = "none";
  }
}

function displayTabContent(tab) {
  const content = document.getElementById("insights-content");
  if (!content) return;
  const metrics = JSON.parse(document.getElementById("insights-container").dataset.metrics || "{}") || {};

  if (tab === "response-rates") {
    content.innerHTML = `<h3>Response Rates</h3>
      <p>${metrics.responseRate ? `${metrics.responseRate}% of applications received a response.` : "No data yet."}</p>`;
  } else if (tab === "average-response-time") {
    content.innerHTML = `<h3>Average Response Time</h3>
      <p>${metrics.averageResponseTime ? `Responses take an average of ${metrics.averageResponseTime} hours.` : "No data yet."}</p>`;
  } else if (tab === "success-rates") {
    content.innerHTML = `<h3>Success Rates</h3>
      <p>${metrics.successRate ? `${metrics.successRate}% of responses resulted in an interview or offer.` : "No data yet."}</p>`;
  } else if (tab === "follow-ups") {
    content.innerHTML = `<h3>Follow-Up Reminders</h3>
      <ul>${metrics.followUpReminders?.map(item => `<li>${item.subject} from ${item.from} (Applied on ${new Date(item.date).toLocaleDateString()})</li>`).join("") || "No pending follow-ups."}</ul>`;
  }
}

function hideInsightsContainer(insightsContainer) {
  if (insightsContainer) insightsContainer.style.display = "none";
}

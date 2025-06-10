export function renderSummaryCard(counts, isPremiumUser = false, emails) {
  const container = document.createElement("div");
  container.className = "mb-4 p-4 bg-white dark:bg-zinc-800 rounded-2xl shadow flex flex-col gap-4 opacity-0 translate-y-2 transition-all duration-500";

  const summaryHTML = `
    <div class="text-lg font-semibold text-zinc-800 dark:text-white">📊 Job Search Summary</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
      ${renderStatCard("📝", "Applied", "blue")}
      ${renderStatCard("🎤", "Interviewed", "indigo")}
      ${renderStatCard("🏆", "Offers", "green")}
      ${renderStatCard("❌", "Rejected", "red")}
    </div>
    ${isPremiumUser ? renderPremiumInsights(emails) : renderFreeTease()}
  `;

  container.innerHTML = summaryHTML;

  const target = document.getElementById("summary-container");
  if (target) {
    target.innerHTML = "";
    target.appendChild(container);

    requestAnimationFrame(() => {
      container.classList.remove("opacity-0", "translate-y-2");
      container.classList.add("opacity-100", "translate-y-0");
    });
  }

  animateCounts(counts);
}

function renderStatCard(icon, category, color) {
  return `
    <div class="bg-zinc-50 dark:bg-zinc-700 p-3 rounded-xl shadow-inner">
      <div class="text-xs text-zinc-500 dark:text-zinc-300">${icon} ${category}</div>
      <div class="text-xl font-bold text-${color}-600 dark:text-${color}-400 count" data-category="${category}">0</div>
    </div>
  `;
}

function renderPremiumInsights(emails) {
  const lastActivity = getLastActivityAge(emails);
  const oldestFollowUp = getOldestFollowUpAge(emails);

  return `
    <hr class="my-2 border-zinc-300 dark:border-zinc-600">
    <div class="text-sm text-zinc-600 dark:text-zinc-300 leading-snug">
      ⏳ <strong>Oldest pending reply:</strong> ${oldestFollowUp}
      <br>
      🧠 <strong>Last activity:</strong> ${lastActivity}
    </div>
  `;
}

function renderFreeTease() {
  return `
    <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400 italic">
      🔒 Upgrade to premium to see response times & follow-up insights.
    </div>
  `;
}

function getLastActivityAge(emails) {
  if (!emails?.length) return "N/A";
  const mostRecent = new Date(Math.max(...emails.map(email => new Date(email.timestamp))));
  const daysAgo = Math.floor((Date.now() - mostRecent) / (1000 * 60 * 60 * 24));
  return daysAgo === 0 ? "Today" : `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`;
}

function getOldestFollowUpAge(emails) {
  if (!emails?.length) return "N/A";
  const pending = emails.filter(email => email.shouldFollowUp && !email.responded);
  if (pending.length === 0) return "N/A";
  const oldest = new Date(Math.min(...pending.map(e => new Date(e.timestamp))));
  const daysAgo = Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24));
  return `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;
}

function animateCounts(counts) {
  const duration = 800;
  const elements = document.querySelectorAll(".count");

  elements.forEach(el => {
    const category = el.dataset.category;
    const target = counts[category] || 0;

    if (target === 0) {
      el.textContent = "0";
      return;
    }

    const startTime = performance.now();

    function update(timestamp) {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const current = Math.floor(progress * target);
      el.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  });
}

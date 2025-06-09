export function renderSummaryCard(counts, isPremiumUser = false, emails) {
    const container = document.createElement("div");
    container.className = "mb-4 p-4 bg-white dark:bg-zinc-800 rounded-2xl shadow flex flex-col gap-2 opacity-0 translate-y-2 transition-all duration-500";

    container.innerHTML = `
    <div class="text-lg font-semibold text-zinc-800 dark:text-white">📊 Job Search Summary</div>
        <div class="grid grid-cols-2 gap-4 text-sm text-zinc-700 dark:text-zinc-200">
            <div><strong>📝 Applied:</strong> <span class="count" data-category="Applied">0</span></div>
            <div><strong>🎤 Interviewed:</strong> <span class="count" data-category="Interviewed">0</span></div>
            <div><strong>🏆 Offers:</strong> <span class="count" data-category="Offers">0</span></div>
            <div><strong>❌ Rejected:</strong> <span class="count" data-category="Rejected">0</span></div>
    </div>

    ${isPremiumUser ? `
      <hr class="my-2 border-zinc-300 dark:border-zinc-600">
      <div class="text-sm text-zinc-600 dark:text-zinc-300">
        🧠 <strong>Last activity:</strong> ${getLastActivityDate(emails)}
        <br>
        ⏳ <strong>Oldest pending reply:</strong> ${getOldestFollowUpAge(emails)} days ago
      </div>
    ` : `
      <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400 italic">
        🔒 Upgrade to premium to see response times & follow-up insights.
      </div>
    `}
  `;

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

function getLastActivityDate(emails) {
  if (!emails?.length) return "N/A";
  const allDates = emails.map(email => new Date(email.timestamp));
  const mostRecent = new Date(Math.max(...allDates));
  return mostRecent.toLocaleDateString();
}

function getOldestFollowUpAge(emails) {
  if (!emails?.length) return "N/A";
  const pendingFollowUps = emails.filter(email => email.shouldFollowUp && !email.responded);
  if (pendingFollowUps.length === 0) return "N/A";
  const oldestDate = new Date(Math.min(...pendingFollowUps.map(e => new Date(e.timestamp))));
  const days = Math.floor((Date.now() - oldestDate) / (1000 * 60 * 60 * 24));
  return days;
}

function animateCounts(counts) {
  const duration = 800;
  const elements = document.querySelectorAll(".count");

  elements.forEach(el => {
    const category = el.dataset.category;
    const target = counts[category] || 0;
    let start = 0;
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

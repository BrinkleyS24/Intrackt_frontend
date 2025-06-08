export function handleQuotaNotification(quota, state, elements) {
  if (state.userPlan === "premium") {
    elements.quotaNotification.style.display = "none";
    return;
  }

  const usagePercentage = Math.round(quota.usagePercentage);
  const isMaxQuota = usagePercentage >= 100;

  if (isMaxQuota) {
    sessionStorage.removeItem("quotaAlertDismissed");
  }

  if (!isMaxQuota && sessionStorage.getItem("quotaAlertDismissed") === "true") {
    elements.quotaNotification.style.display = "none";
    return;
  }

  const urgencyClass = isMaxQuota
    ? "bg-red-100 border border-red-200 text-red-800"
    : "bg-yellow-100 border border-yellow-200 text-yellow-800";

  elements.quotaNotification.className = `
    flex flex-col gap-2 px-3 py-2 rounded shadow-sm
    ${urgencyClass} mb-4
  `;

  const header = "⚠ Quota Warning";
  const message = `You've used ${usagePercentage}% of your ${quota.limit} email limit.`;

  elements.quotaNotification.innerHTML = `
    <div class="flex flex-col items-center gap-2 text-center text-red-800">
      <h3 class="text-xs font-semibold">${header}</h3>
      <p class="text-xs">${message}</p>
    </div>
    <div class="flex justify-center gap-3 mt-2">
      <button id="dismiss-btn" class="border border-gray-300 text-xs text-gray-600 px-3 py-1 rounded hover:text-gray-800 hover:bg-gray-100">Dismiss</button>
    </div>
  `;

  elements.quotaNotification.style.display = "block";

  document.getElementById("upgrade-btn")?.addEventListener("click", () => {
    toggleModal(elements.premiumModal, true);
  });
  document.getElementById("dismiss-btn")?.addEventListener("click", () => {
    elements.quotaNotification.style.display = "none";
    sessionStorage.setItem("quotaAlertDismissed", "true");
  });
}

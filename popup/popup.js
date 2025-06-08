import { handleLogin, handleLogout } from "./services/authService.js";
import { fetchStoredEmails, fetchNewEmails, fetchQuotaData } from "./services/emailService.js";
import { renderEmails } from "./ui/emailRenderer.js";
import { updatePage } from "./ui/pagination.js";
import { toggleModal, toggleMisclassModal, toggleEmailModal } from "./ui/modals.js";
import { updateWelcomeHeader } from "./ui/welcome.js";
import { updateCategoryCounts } from "./ui/emailUI.js";
import { formatFollowUpTime } from "./utils/time.js";
import { initializeEventListeners } from "./ui/eventListeners.js";
import { toggleUI, updatePremiumButton, adjustTimeRangeOptions } from "./ui/uiState.js";
import { state, elements, CONFIG, resetAppState, fetchUserPlan } from "./utils/appGlobals.js";
import { initializeApp } from "./app/init.js";
import { applyFilters, clearFilters } from "./app/filters.js";

// TODO: Backend doesnt catch plan upgrade
// TODO: Make sure emails are tracked properly across categories
// TODO: Fix refresh button

let undoTimeoutId = null;
let undoIntervalId = null;


function setLoadingState(isLoading) {
  if (isLoading) {
    elements.loginBtn.disabled = true;
    elements.loginBtn.innerHTML = `<span class="loader-spinner"></span> Loading...`;
  } else {
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = "Sign in with Gmail";
  }
}

function differenceInDays(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

document.addEventListener("DOMContentLoaded", () => {

  chrome.storage.local.get(["userName"], (data) => {
    if (data.userName) {
      updateWelcomeHeader(data.userName);
    }
  });

  initializeEventListeners(state, elements, {
    handleLogin,
    handleLogout,
    toggleUI,
    updatePremiumButton,
    fetchUserPlan,
    loadFollowUpSuggestions,
    fetchStoredEmails,
    fetchNewEmails,
    updateWelcomeHeader,
    setLoadingState,
    applyFilters,
    clearFilters,
    updateCategoryCounts,
    CONFIG,
    resetAppState
  });

  initializeApp({
    state,
    elements,
    CONFIG,
    updateWelcomeHeader,
    fetchUserPlan,
    fetchQuotaData,
    toggleUI,
    updatePremiumButton,
    adjustTimeRangeOptions,
    fetchStoredEmails,
    fetchNewEmails,
    loadFollowUpSuggestions,
    renderEmails,
    differenceInDays,
    setLoadingState,
    applyFilters
  });

  function clearFollowupSkeleton() {
    const list = document.getElementById("followup-list");
    if (!list) return;
    list.querySelectorAll(".skeleton-followup").forEach(el => el.remove());
    document.getElementById("show-more-followups")?.classList.add("hidden");
  }

  // ======================
  // UTILITIES
  // ======================
  elements.closeEmailModal.addEventListener("click", () => toggleEmailModal(false, elements));

  // ======================
  // UI UPDATES
  // ======================

  elements.closeEmailModal?.addEventListener("click", () => toggleModal(elements.emailModal, false));
  elements.modalBackdrop?.addEventListener("click", () => {
    toggleModal(elements.emailModal, false);
    toggleModal(elements.premiumModal, false);
  });
  elements.premiumBtn?.addEventListener("click", () =>
    toggleModal(elements.premiumModal, true)
  );
  elements.closePremiumModal?.addEventListener("click", () => toggleModal(elements.premiumModal, false));
  window.addEventListener("click", (event) => {
    if (event.target === elements.premiumModal) toggleModal(elements.premiumModal, false);
  });
  elements.jobTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const category = tab.dataset.category;
      state.newEmailsCounts[category] = 0;

      elements.jobTabs.forEach(t => t.classList.remove("active-tab"));
      tab.classList.add("active-tab");

      state.currentCategory = category;
      state.currentPage = 1;
      chrome.storage.local.set({ currentCategory: state.currentCategory });


      const searchText = elements.searchBar.value.trim();
      const timeRangeValue = elements.timeRangeFilter.value;

      if (searchText !== "" || timeRangeValue !== "week") {
        state.isFilteredView = true;
        applyFilters(state, elements, CONFIG);
      } else {
        state.isFilteredView = false;
        updatePage(1, state, elements, CONFIG);
      }

      updateCategoryCounts(state, elements);
      ;
    });
  });

  elements.misclassCancelBtn.addEventListener('click', () => toggleMisclassModal(false, elements));
  window.addEventListener('click', e => {
    if (e.target === elements.misclassModal) toggleMisclassModal(false, elements);
  });

  function startUndoCountdown(duration = 5000) {
    const circle = document.getElementById('undo-timer-circle');
    const totalLength = 88;
    let start = Date.now();

    circle.style.strokeDashoffset = '0';

    undoIntervalId = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      circle.style.strokeDashoffset = totalLength * progress;
      if (progress === 1) {
        clearInterval(undoIntervalId);
      }
    }, 100);
  }


  elements.misclassForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correctedCategory = e.target.correctCategory.value;
    if (!correctedCategory) return alert("Please select a category.");
    toggleMisclassModal(false, elements);

    if (!state.currentReportEmail) {
      alert("❌ No email selected to report.");
      return;
    }

    if (correctedCategory === "Irrelevant") {
      const toast = document.getElementById("undo-toast");
      toast.style.display = "flex";

      clearTimeout(undoTimeoutId);
      clearInterval(undoIntervalId);
      startUndoCountdown();

      undoTimeoutId = setTimeout(async () => {
        toast.style.display = "none";
        console.log("Reporting email as Irrelevant:", state.currentReportEmail);
        try {
          const { emailId, threadId, category: originalCategory, subject, body } = state.currentReportEmail
            ;
          const payload = {
            emailId,
            threadId,
            originalCategory,
            correctedCategory: "Irrelevant",
            emailSubject: subject,
            emailBody: body,
            userEmail: state.userEmail
          };
          console.log("Sending misclassification payload:", {
            emailId,
            threadId,
            originalCategory,
            correctedCategory: "Irrelevant",
            emailSubject: subject,
            emailBody: body,
            userEmail: state.userEmail
          });
          const resp = await fetch(
            `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.REPORT_MISCLASS}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            }
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          console.log("Report sent successfully");
          fetchStoredEmails(state, elements, setLoadingState, CONFIG);
        } catch (err) {
          console.error("Deferred report failed:", err);
        }
      }, 5000);

    } else {
      try {
        const { emailId, threadId, category: originalCategory, subject, body } = state.currentReportEmail
          ;
        console.log("Sending misclassification payload:", {
          emailId,
          threadId,
          originalCategory,
          correctedCategory: correctedCategory,
          emailSubject: subject,
          emailBody: body,
          userEmail: state.userEmail
        });
        const resp = await fetch(
          `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.REPORT_MISCLASS}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              emailId,
              threadId,
              originalCategory,
              correctedCategory,
              emailSubject: subject,
              emailBody: body,
              userEmail: state.userEmail
            })
          }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        alert("✅ Correction submitted! Thank you.");
      } catch (err) {
        console.error("Report failed:", err);
        alert(`Error: ${err.message}`);
      }
    }
  });

  document.getElementById("undo-btn").addEventListener("click", () => {
    clearTimeout(undoTimeoutId);
    clearInterval(undoIntervalId);

    const circle = document.getElementById('undo-timer-circle');
    circle.style.strokeDashoffset = '0';

    const toast = document.getElementById("undo-toast");
    toast.style.display = "none";
  });

  async function loadFollowUpSuggestions() {
    const container = document.getElementById("followup-section");
    const listEl = document.getElementById("followup-list");
    const showMore = document.getElementById("show-more-followups");
    const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.FOLLOWUP_NEEDED}`;

    // Gate behind premium
    if (state.userPlan !== "premium") {
      container.classList.remove("hidden");
      listEl.innerHTML = `
      <li class="text-center text-sm text-gray-600 mb-2">
        Unlock Suggested Follow-Ups with <strong>Premium</strong>.
      </li>
      <li class="text-center">
        <button id="upgrade-followups" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Upgrade Now
        </button>
      </li>
    `;
      showMore?.classList.add("hidden");
      document.getElementById("upgrade-followups")
        .addEventListener("click", () => toggleModal(elements.premiumModal, true));
      return;
    }

    // Premium users: show skeleton + fetch
    container.classList.remove("hidden");
    listEl.innerHTML = `
    <li class="skeleton-followup"></li>
    <li class="skeleton-followup"></li>
    <li class="skeleton-followup"></li>
  `;
    if (!state.userEmail) {
      console.error("❌ Cannot load follow-up suggestions: userEmail missing from state.");
      return;
    }

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.userEmail })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      clearFollowupSkeleton();

      if (!data.success || !data.suggestions.length) {
        listEl.innerHTML = `
        <li class="text-center text-sm text-gray-600">
          No follow-up suggestions found.
        </li>`;
        return;
      }

      const { followedUpMap = {} } = await new Promise(resolve =>
        chrome.storage.local.get({ followedUpMap: {} }, resolve)
      );

      state.followUpSuggestions = data.suggestions.map(s => ({
        threadId: s.threadId,
        subject: s.subject,
        daysSince: s.daysSince,
        followedUp: s.threadId in followedUpMap,
        followedUpAt: followedUpMap[s.threadId] || null
      }));

      renderFollowUpSuggestions(state.followUpSuggestions);
    } catch (err) {
      console.error("Error loading follow-ups:", err);
      clearFollowupSkeleton();
      listEl.innerHTML = `
      <li class="text-center text-sm text-red-500">
        Failed to load follow-ups
      </li>`;
    }
  }

  function renderFollowUpSuggestions(list) {
    const listEl = document.getElementById("followup-list");
    const showBtn = document.getElementById("show-more-followups");
    if (!listEl) return;

    // 🧹 Clear skeletons or old cards
    listEl.innerHTML = "";

    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

    const filteredList = list.filter(item => {
      if (!item.followedUp) return true;
      return Date.now() - item.followedUpAt < TWO_DAYS;
    });

    const sortedList = filteredList.sort((a, b) => {
      if (a.followedUp !== b.followedUp) return a.followedUp ? 1 : -1;
      return a.daysSince - b.daysSince;
    });

    const displayLimit = 5;
    const hidden = sortedList.slice(displayLimit);
    const visible = sortedList.slice(0, displayLimit);

    const renderCard = item => `
      <li class="followup-card border rounded-lg px-4 py-3 bg-white shadow-sm hover:bg-gray-50 transition duration-150 group ${item.followedUp ? 'opacity-60' : ''}"
          data-thread-id="${item.threadId}">
        <div class="flex justify-between items-center">
          <div class="flex items-start gap-2">
            ${item.followedUp ? '' : '<div class="pt-0.5 text-xs text-yellow-500 followup-dot">🟠</div>'}
            <div>
              <div class="font-medium text-sm text-gray-800 mb-1">${item.subject}</div>
              <div class="text-xs text-gray-500">
                ${item.followedUp
        ? formatFollowUpTime(item.followedUpAt)
        : `Sent ${item.daysSince} days ago`}
              </div>
            </div>
          </div>
          <a href="https://mail.google.com/mail/u/0/#inbox/${item.threadId}"
            target="_blank"
            class="view-followup text-xs text-blue-500 group-hover:opacity-100 opacity-0 transition-opacity duration-150 ml-2"
            data-thread-id="${item.threadId}">
            View →
          </a>
        </div>
      </li>
    `;

    listEl.innerHTML = visible.map(renderCard).join("");

    listEl.querySelectorAll(".view-followup").forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault();
        const threadId = event.currentTarget.dataset.threadId;
        markFollowedUp(threadId);
        window.open(event.currentTarget.href, "_blank");
      });
    });

    if (hidden.length > 0) {
      showBtn.textContent = `Show ${hidden.length} more`;
      showBtn.classList.remove("hidden");
      showBtn.onclick = () => {
        hidden.forEach(item => listEl.insertAdjacentHTML("beforeend", renderCard(item)));
        showBtn.classList.add("hidden");
      };
    } else {
      showBtn.classList.add("hidden");
    }

    function markFollowedUp(threadId) {
      const suggestion = state.followUpSuggestions.find(item => item.threadId === threadId);
      if (suggestion) {
        suggestion.followedUp = true;
        suggestion.followedUpAt = Date.now();
      }

      chrome.storage.local.get({ followedUpMap: {} }, ({ followedUpMap }) => {
        followedUpMap[threadId] = Date.now();
        chrome.storage.local.set({ followedUpMap });
      });

      renderFollowUpSuggestions(state.followUpSuggestions);
    }
  }



  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "NEW_EMAILS_UPDATED") {
      console.log("🔄 New emails detected. Refreshing stored emails...");
      fetchStoredEmails(state, elements, setLoadingState, CONFIG);
      fetchNewEmails(state, elements, applyFilters, CONFIG);
      ;
    }
  });

});
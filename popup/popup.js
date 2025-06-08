import { fetchData } from "./api.js";
import {
  handleLogin,
  handleLogout,
  getUserInfo
} from "./services/authService.js";
import { fetchStoredEmails, fetchNewEmails, fetchQuotaData } from "./services/emailService.js";
import { renderEmails } from "./ui/emailRenderer.js";
import { updatePage } from "./ui/pagination.js";
import { toggleModal, toggleMisclassModal, toggleEmailModal } from "./ui/modals.js";
import { updateWelcomeHeader } from "./ui/welcome.js";
import { getElement } from "./utils/dom.js";
import { updateCategoryCounts } from "./ui/emailUI.js";
import { formatFollowUpTime } from "./utils/time.js";


// TODO: Backend doesnt catch plan upgrade
// TODO: Make sure emails are tracked properly across categories

function toggleUI(isLoggedIn) {
  const show = el => el?.classList.remove("hidden");
  const hide = el => el?.classList.add("hidden");

  if (isLoggedIn) {
    show(elements.filterSection);
    show(elements.jobList);
    show(elements.signoutBtn);
    hide(elements.loginBtn);

    if (state.userPlan === "premium") {
      show(getElement("followup-section"));
    } else {
      hide(getElement("followup-section"));
    }

    show(getElement("tabs"));
    elements.followupBtn?.classList.remove("hidden");
  } else {
    hide(elements.filterSection);
    hide(elements.jobList);
    hide(elements.signoutBtn);
    show(elements.loginBtn);
    hide(getElement("followup-section"));
    hide(getElement("tabs"));
    elements.followupBtn?.classList.add("hidden");
  }
}

function updatePremiumButton(isLoggedIn) {
  if (!elements.premiumBtn) return;
  const shouldShow = isLoggedIn && state.userPlan === "free";
  elements.premiumBtn.style.display = shouldShow ? "inline-block" : "none";
}


const elements = {
  filterSection: getElement("filter-section"),
  jobList: getElement("job-list"),
  loginBtn: getElement("login-btn"),
  signoutBtn: getElement("signout-btn"),
  searchBar: getElement("search-bar"),
  timeRangeFilter: getElement("time-range-filter"),
  applyFiltersBtn: getElement("apply-filters"),
  clearFiltersBtn: getElement("clear-filters"),
  jobTabs: document.querySelectorAll(".tab-btn"),
  jobsContainer: getElement("jobs"),
  prevButton: getElement("prev-button"),
  nextButton: getElement("next-button"),
  premiumBtn: getElement("premium-btn"),
  premiumModal: getElement("premium-modal"),
  closePremiumModal: getElement("close-premium-modal"),
  modalBackdrop: getElement("modal-backdrop"),
  quotaNotification: getElement("quota-notification"),
  emailModal: document.getElementById("email-modal"),
  modalSubject: document.getElementById("modal-subject"),
  modalFrom: document.getElementById("modal-from"),
  modalBody: document.getElementById("modal-body"),
  closeEmailModal: document.getElementById("close-email-modal"),
  misclassModal: document.getElementById('misclass-modal'),
  misclassForm: document.getElementById('misclass-form'),
  misclassCloseBtn: document.getElementById('misclass-close'),
  misclassCancelBtn: document.getElementById('misclass-cancel'),
  followupContainer: document.getElementById("followup-section"),
  toastSuccess: document.getElementById("toast-success")

};

const state = {
  userEmail: null,
  currentCategory: "Applied",
  currentPage: 1,
  categorizedEmails: {
    Applied: [],
    Interviewed: [],
    Offers: [],
    Rejected: []
  },
  newEmailsCounts: { Applied: 0, Interviewed: 0, Offers: 0, Rejected: 0 },
  isFilteredView: false,
  userPlan: "free",
  activeLabel: null
};

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

const CONFIG = {
  API_BASE: "http://localhost:3000/api",
  ENDPOINTS: {
    STORED_EMAILS: "/emails/stored-emails",
    REPORT_MISCLASS: "/emails/report-misclassification",
    USER: "/user",
    EMAILS: "/emails",
    FOLLOWUP_NEEDED: "/emails/followup-needed",

  },
  PAGINATION: {
    PAGE_SIZE: 10,
    INITIAL_PAGE: 1
  }
};

chrome.storage.local.get(["userName"], (data) => {
  if (data.userName) {
    updateWelcomeHeader(data.userName);
  }
});

document.addEventListener("DOMContentLoaded", () => {

  initializeEventListeners();
  initializeApp();

  function initializeEventListeners() {
    elements.loginBtn?.addEventListener("click", () =>
      handleLogin(
        state,
        elements,
        toggleUI,
        updatePremiumButton,
        fetchUserPlan,
        loadFollowUpSuggestions,
        fetchStoredEmails,
        fetchNewEmails,
        updateWelcomeHeader,
        setLoadingState,
        CONFIG
      )
    );

    elements.signoutBtn?.addEventListener("click", () =>
      handleLogout(
        state,
        elements,
        toggleUI,
        updatePremiumButton,
        updateWelcomeHeader,
        resetAppState
      )
    );

    elements.applyFiltersBtn?.addEventListener("click", applyFilters);
    elements.clearFiltersBtn?.addEventListener("click", clearFilters);
    elements.searchBar?.addEventListener("input", debounce(applyFilters, 300));

    elements.prevButton?.addEventListener("click", () => updatePage(state.currentPage - 1, state, elements, CONFIG));
    elements.nextButton?.addEventListener("click", () => updatePage(state.currentPage + 1, state, elements, CONFIG));

    elements.closeEmailModal?.addEventListener("click", () => toggleModal(elements.emailModal, false));
    elements.closePremiumModal?.addEventListener("click", () => toggleModal(elements.premiumModal, false));

    getElement("refresh-btn")?.addEventListener("click", async () => {
      console.log("Refresh button clicked");
      await fetchNewEmails(state, elements, applyFilters, CONFIG);
      await fetchStoredEmails(state, elements, setLoadingState, CONFIG);;
      state.isFilteredView = false;
      updatePage(1, state, elements, CONFIG);
      updateCategoryCounts(state, elements);
      ;
    });

  }
  console.log("✅ setLoadingState is", typeof setLoadingState);

  async function initializeApp() {
    const {
      gmail_token,
      userEmail,
      categorizedEmails = {},
      followedUpThreadIds = [],
      currentCategory = "Applied",
      currentPage = 1
    } = await new Promise(resolve =>
      chrome.storage.local.get(
        ["gmail_token", "userEmail", "categorizedEmails", "followedUpThreadIds", "currentCategory", "currentPage"],
        resolve
      )
    );

    state.token = gmail_token;
    state.userEmail = userEmail;
    state.categorizedEmails = categorizedEmails;
    state.currentCategory = currentCategory;
    state.currentPage = currentPage;

    if (state.token && state.userEmail) {
      await fetchUserPlan();
      await fetchQuotaData(state);
      updatePremiumButton(true);
      adjustTimeRangeOptions();
      toggleUI(true);

      renderEmails(state.categorizedEmails[state.currentCategory] || [], state.currentPage, state, elements, CONFIG);

      const allEmails = Object.values(state.categorizedEmails).flat();
      const followedUp = followedUpThreadIds.map(id =>
        allEmails.find(email => email.threadId === id)
      ).filter(Boolean);

      state.followUpSuggestions = followedUp
        .filter(email => email?.threadId && email?.subject && email?.date)
        .map(email => ({
          threadId: email.threadId,
          subject: email.subject,
          daysSince: differenceInDays(new Date(), new Date(email.date)),
          followedUp: true
        }));

      await fetchStoredEmails(state, elements, setLoadingState, CONFIG);;
      await fetchNewEmails(state, elements, applyFilters, CONFIG);
      await loadFollowUpSuggestions();
      getUserInfo(state.token).then(profile => {
        if (profile?.name) updateWelcomeHeader(profile.name);
      }).catch(console.error);

      // Poll for new emails
      setInterval(() => {
        if (state.token && state.userEmail) fetchNewEmails(state, elements, applyFilters, CONFIG);
      }, 60_000);
    } else {
      toggleUI(false);
    }
  }

  // ======================
  // AUTH & USER MANAGEMENT
  // ======================
  function resetAppState() {
    state.userEmail = null;
    state.categorizedEmails = {};
    state.currentCategory = "Applied";
    state.currentPage = 1;

    if (elements.jobsContainer) {
      elements.jobsContainer.innerHTML = "<p>Fetching emails...</p>";
    }

    if (elements.quotaNotification) {
      elements.quotaNotification.style.display = "none";
    }

    const followupSection = getElement("followup-section");
    if (followupSection) {
      followupSection.classList.add("hidden");

      const followupList = document.getElementById("followup-list");
      if (followupList) followupList.innerHTML = "";

      const showMore = document.getElementById("show-more-followups");
      if (showMore) showMore.classList.add("hidden");
    }

    const toast = document.getElementById("undo-toast");
    if (toast) toast.style.display = "none";
    clearTimeout(undoTimeoutId);
    clearInterval(undoIntervalId);

    const modalBackdrop = getElement("modal-backdrop");
    if (modalBackdrop) {
      modalBackdrop.style.display = "none";
      modalBackdrop.classList.remove("show");
    }

    const modals = ["email-modal", "premium-modal", "misclass-modal"];
    modals.forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.remove("show");
        modal.style.display = "none";
      }
    });
  }


  function differenceInDays(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  function clearFollowupSkeleton() {
    const list = document.getElementById("followup-list");
    if (!list) return;
    list.querySelectorAll(".skeleton-followup").forEach(el => el.remove());
    document.getElementById("show-more-followups")?.classList.add("hidden");
  }

  // ======================
  // UTILITIES
  // ======================
  function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  }

  async function fetchUserPlan() {
    try {
      const response = await fetchData("http://localhost:3000/api/user", { email: state.userEmail });
      state.userPlan = response.plan || "free";
      console.log("Fetched and updated state.userPlan:", state.userPlan);
      return state.userPlan;
    } catch (error) {
      console.error("Error fetching user plan:", error);
      state.userPlan = "free";
      return state.userPlan;
    }
  }

  function adjustTimeRangeOptions() {
    const timeRangeFilter = document.getElementById("time-range-filter");
    if (!timeRangeFilter) return;

    const optionValue = "90";
    const yearOptionExists = Array.from(timeRangeFilter.options)
      .some(opt => opt.value === optionValue);

    if (state.userPlan === "premium" && !yearOptionExists) {
      const opt = new Option("Last 90 days", optionValue);
      timeRangeFilter.add(opt);
    } else if (state.userPlan === "free" && yearOptionExists) {
      // remove it
      Array.from(timeRangeFilter.options).forEach((opt, idx) => {
        if (opt.value === optionValue) {
          timeRangeFilter.remove(idx);
        }
      });
    }
  }

  elements.closeEmailModal.addEventListener("click", () => toggleEmailModal(false, elements));

  // ======================
  // UI UPDATES
  // ======================
  function applyFilters() {
    const searchQuery = elements.searchBar.value.toLowerCase();
    const timeRange = elements.timeRangeFilter.value;
    if (state.userPlan === "free" && timeRange === "90") {
      alert("Free plan allows filtering only within the last 30 days.");
      return;
    }

    // compute thresholdDate based on dropdown
    const now = new Date();
    let thresholdDate = null;
    if (timeRange === "week") {
      thresholdDate = new Date(now);
      thresholdDate.setDate(thresholdDate.getDate() - 7);
    } else if (timeRange === "month") {
      thresholdDate = new Date(now);
      thresholdDate.setMonth(thresholdDate.getMonth() - 1);
    } else if (timeRange === "90") {
      thresholdDate = new Date(now);
      thresholdDate.setDate(thresholdDate.getDate() - 90);
    }

    const category = state.currentCategory;
    const emailsInCategory = state.categorizedEmails[category] || [];
    const filteredEmails = emailsInCategory
      .filter(email => {
        // combine subject/from/body/snippet into one lowercase string
        const text = `${email.subject || ""} ${email.from || ""} ${email.body || ""} ${email.snippet || ""}`.toLowerCase();
        const matchesSearchQuery = !searchQuery || text.includes(searchQuery);
        // only keep if no thresholdDate or email.date ≥ thresholdDate
        const matchesTimeRange = !thresholdDate || (new Date(email.date) >= thresholdDate);
        return matchesSearchQuery && matchesTimeRange;
      })
      .map(email => ({ ...email, category }));

    // sort newest→oldest
    filteredEmails.sort((a, b) => new Date(b.date) - new Date(a.date));

    state.isFilteredView = true;
    state.filteredEmails = filteredEmails;
    state.currentPage = 1;
    updatePage(1, state, elements, CONFIG);
    updateCategoryCounts(state, elements);
    ;
  }

  function restoreTabHighlighting() {
    elements.jobTabs.forEach((tab) => {
      if (tab.dataset.category === state.currentCategory) {
        tab.classList.add("active-tab");
      } else {
        tab.classList.remove("active-tab");
      }
    });
  }

  function clearFilters() {
    state.isFilteredView = false;
    state.currentPage = 1;
    elements.searchBar.value = "";
    elements.timeRangeFilter.value = "week";
    restoreTabHighlighting();
    updatePage(1, state, elements, CONFIG);
    updateCategoryCounts(state, elements);
  }

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
        applyFilters();
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

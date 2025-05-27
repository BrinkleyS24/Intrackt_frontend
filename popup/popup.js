import { fetchData } from "./api.js";

/**
 * Utility: Get an element by ID and log an error if missing.
 * @param {string} id - The element's ID.
 * @returns {HTMLElement|null}
 */
function getElement(id) {
  const el = document.getElementById(id);
  if (!el) console.error(`Element with id "${id}" not found.`);
  return el;
}

/**
 * Update the welcome header text.
 * If the element is missing, log an error instead of throwing.
 * @param {string|null} userName
 */

function updateWelcomeHeader(userName) {
  const welcomeHeader = getElement("welcome-header");
  if (welcomeHeader) {
    welcomeHeader.textContent = userName
      ? `Welcome, ${userName}!`
      : "Welcome to Gmail Job Tracker!";
  }
}

/**
 * Toggle modal display.
 * @param {HTMLElement} modal - The modal element.
 * @param {boolean} show - Whether to show or hide.
 */

function toggleModal(modal, show) {
  const modalBackdrop = getElement("modal-backdrop");
  if (!modal || !modalBackdrop) return;

  if (show) {
    modal.style.display = "block";
    modalBackdrop.style.display = "block";
    requestAnimationFrame(() => {
      modal.classList.add("show");
      modalBackdrop.classList.add("show");
    });
  } else {
    modal.classList.remove("show");
    modalBackdrop.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
      modalBackdrop.style.display = "none";
    }, 300);
  }
}

/**
 * Show or hide the email-view modal.
 * @param {boolean} show  true to open, false to close
 */
function toggleEmailModal(show) {
  const modal = elements.emailModal;
  if (!modal) return;
  toggleModal(modal, show);
}

function toggleMisclassModal(show) {
  const modalBackdrop = getElement("modal-backdrop");
  if (show) {
    elements.misclassModal.style.display = "flex";
    modalBackdrop.style.display = "block";
    requestAnimationFrame(() => {
      elements.misclassModal.classList.add("show");
      modalBackdrop.classList.add("show");
    });
  } else {
    elements.misclassModal.classList.remove("show");
    modalBackdrop.classList.remove("show");
    setTimeout(() => {
      elements.misclassModal.style.display = "none";
      modalBackdrop.style.display = "none";
    }, 300);
  }
}

function toggleUI(isLoggedIn) {
  const show = el => el?.classList.remove("hidden");
  const hide = el => el?.classList.add("hidden");

  if (isLoggedIn) {
    show(elements.filterSection);
    show(elements.jobList);
    show(elements.signoutBtn);
    hide(elements.loginBtn);
    show(getElement("followup-section"));
    show(getElement("tabs"));

    if (elements.viewInsightsBtn)
      elements.viewInsightsBtn.classList.remove("hidden");

    if (elements.followupBtn)
      elements.followupBtn.classList.remove("hidden");

  } else {
    hide(elements.filterSection);
    hide(elements.jobList);
    hide(elements.signoutBtn);
    show(elements.loginBtn);
    hide(getElement("followup-section"));
    hide(getElement("tabs"));

    if (elements.viewInsightsBtn)
      elements.viewInsightsBtn.classList.add("hidden");

    if (elements.followupBtn)
      elements.followupBtn.classList.add("hidden");
  }
}

function showNotification(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 5000);
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
  misclassCancelBtn: document.getElementById('misclass-cancel')
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

let currentReportEmail = null;
let undoTimeoutId = null;
let undoIntervalId = null;

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

document.getElementById("followup-section").classList.add("hidden");

chrome.storage.local.get(["userName"], (data) => {
  if (data.userName) {
    updateWelcomeHeader(data.userName);
  }
});

document.addEventListener("DOMContentLoaded", () => {

  initializeEventListeners();
  initializeApp();

  function initializeEventListeners() {
    elements.loginBtn?.addEventListener("click", handleLogin);
    elements.signoutBtn?.addEventListener("click", handleLogout);
    elements.applyFiltersBtn?.addEventListener("click", applyFilters);
    elements.clearFiltersBtn?.addEventListener("click", clearFilters);
    elements.searchBar?.addEventListener("input", debounce(applyFilters, 300));

    elements.prevButton?.addEventListener("click", () => updatePage(state.currentPage - 1));
    elements.nextButton?.addEventListener("click", () => updatePage(state.currentPage + 1));

    elements.closeEmailModal?.addEventListener("click", () => toggleModal(elements.emailModal, false));
    elements.closePremiumModal?.addEventListener("click", () => toggleModal(elements.premiumModal, false));

    getElement("refresh-btn")?.addEventListener("click", async () => {
      console.log("Refresh button clicked");
      await fetchNewEmails(state.token, state.userEmail);
      await fetchStoredEmails();
      state.isFilteredView = false;
      updatePage(1);
      updateCategoryCounts();
    });

  }

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
      toggleUI(true);
      updatePremiumButton(true);

      renderEmails(state.categorizedEmails[state.currentCategory] || [], state.currentPage);
      state.followUpSuggestions = (await new Promise(r =>
        chrome.storage.local.get({ followedUpThreadIds: [] }, r)
      )).followedUpThreadIds
        .map(id => state.categorizedEmails[state.currentCategory]
          .find(email => email.threadId === id))
        .filter(Boolean)
        .map(email => ({
          threadId: email.threadId,
          subject: email.subject,
          company: extractCompanyName(email.subject),
          daysSince: differenceInDays(new Date(), new Date(email.date)),
          followedUp: true
        }));

      console.log("Follow-up suggestions:", state.followUpSuggestions);
      renderFollowUpSuggestions(state.followUpSuggestions);
    } else {
      toggleUI(false);
    }

    if (state.token && state.userEmail) {
      fetchUserPlan().then(() => {
        updatePremiumButton(true);
        adjustTimeRangeOptions();
      });

      loadFollowUpSuggestions();
      fetchStoredEmails();
      fetchNewEmails(state.token, state.userEmail);
      getUserInfo(state.token).catch(console.error);
      setInterval(() => {
        if (state.token && state.userEmail) fetchNewEmails(state.token, state.userEmail);
      }, 60_000);
    }
  }



  // ======================
  // AUTH & USER MANAGEMENT
  // ======================
  async function handleLogin() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "LOGIN" });
      if (!response.success) throw new Error(response.error);

      state.userEmail = response.email;
      state.token = response.token;

      await chrome.storage.local.set({
        gmail_token: response.token,
        userEmail: response.email
      });
      state.token = response.token;
      state.userEmail = response.email;
      toggleUI(true);
      updatePremiumButton(true);
      await fetchUserPlan();
      await loadFollowUpSuggestions();
      await fetchStoredEmails();
      await fetchNewEmails(state.token, state.userEmail);
      const profile = await getUserInfo(state.token);
      updateWelcomeHeader(profile.name);
    } catch (err) {
      showNotification(`Login failed: ${err.message}`, "error");
    }
  }


  async function handleLogout() {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    resetAppState();
    toggleUI(false);
    updatePremiumButton(false);
    updateWelcomeHeader(null);
    clearStoredUserData();
    showNotification("Successfully logged out", "success");
  }

  function clearStoredUserData() {
    chrome.storage.local.remove([
      'userEmail',
      'gmail_token',
      'currentPage',
      'currentCategory',
      'userName'
    ]);
  }


  function resetAppState() {
    state.userEmail = null;
    state.categorizedEmails = {};
    state.currentCategory = "Applied";
    state.currentPage = 1;

    if (elements.jobsContainer) elements.jobsContainer.innerHTML = "<p>Fetching emails...</p>";
    if (elements.quotaNotification) elements.quotaNotification.style.display = "none";

    const followupSection = getElement("followup-section");
    if (followupSection) {
      followupSection.classList.add("hidden");
      followupSection.innerHTML = "";
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

  function getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
          console.error("Error fetching auth token:", chrome.runtime.lastError?.message);
          reject(new Error("Failed to get auth token."));
          return;
        }
        resolve(token);
      });
    });
  }

  function clearFollowupSkeleton() {
    const list = document.getElementById("followup-list");
    if (!list) return;
    list.querySelectorAll(".skeleton-followup").forEach(el => el.remove());
    document.getElementById("show-more-followups")?.classList.add("hidden");
  }

  async function fetchStoredEmails() {
    setLoadingState(true);
    try {
      const response = await fetch(
        `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.STORED_EMAILS}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: state.userEmail })
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

      const data = await response.json();
      state.categorizedEmails = { Applied: [], Interviewed: [], Offers: [], Rejected: [] };

      data.categorizedEmails.forEach(serverEmail => {
        const normalizedEmail = normalizeEmailData(serverEmail);
        if (state.categorizedEmails[normalizedEmail.category]) {
          state.categorizedEmails[normalizedEmail.category].push(normalizedEmail);
        }
      });

      Object.values(state.categorizedEmails).forEach(category =>
        category.sort((a, b) => new Date(b.date) - new Date(a.date))
      );

      chrome.storage.local.set({ categorizedEmails: state.categorizedEmails });
      state.currentPage = 1;
      updatePage(1);
      updateCategoryCounts();

    } catch (error) {
      showNotification("Failed to load emails", "error");
      console.error("Fetch stored emails error:", error);
    } finally {
      setLoadingState(false);
    }
  }

  function normalizeEmailData(email) {
    return {
      ...email,
      emailId: email.emailId || email.email_id,
      threadId: email.threadId || email.thread_id,
      date: new Date(email.date).toISOString()
    };
  }

  async function fetchNewEmails(token, email) {
    if (!token || !email) {
      console.error("❌ Cannot fetch new emails without token and user email.");
      return;
    }

    console.log("📌 Fetching new emails...");
    try {
      const data = await fetchData(
        `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.EMAILS}`,
        { token, email }
      );

      if (!data.success || !data.categorizedEmails) {
        if (data.quota?.usagePercentage >= 100) {
          showNotification("🚫 You've reached your quota. Upgrade for more access.", "warning");
        } else {
          console.warn("⚠️ No new emails found.");
        }
        return;
      }

      const defaultCategories = {
        Applied: [],
        Interviewed: [],
        Offers: [],
        Rejected: []
      };

      const storedEmails = await new Promise((resolve) => {
        chrome.storage.local.get(["categorizedEmails"], (res) => {
          const emails = res.categorizedEmails || defaultCategories;
          for (const category in defaultCategories) {
            if (!emails.hasOwnProperty(category)) {
              emails[category] = [];
            }
          }
          resolve(emails);
        });
      });

      const updatedEmails = { ...storedEmails };
      let newEmailFound = false;

      Object.entries(data.categorizedEmails).forEach(([category, newEmails]) => {
        const normalizedNew = newEmails.map(email => ({
          ...email,
          emailId: email.emailId || email.email_id,
          threadId: email.ThreadId || email.thread_id,
        }));

        if (!updatedEmails[category]) {
          updatedEmails[category] = [];
        }

        const existingIds = new Set(updatedEmails[category].map(e => e.emailId));
        const emailsToAdd = normalizedNew.filter(e => !existingIds.has(e.emailId));

        if (emailsToAdd.length > 0) newEmailFound = true;

        state.newEmailsCounts[category] += emailsToAdd.length;

        updatedEmails[category] = [
          ...updatedEmails[category],
          ...emailsToAdd
        ];
      });

      chrome.storage.local.set({ categorizedEmails: updatedEmails }, () => {
        console.log("✅ New emails merged successfully.");
        state.categorizedEmails = updatedEmails;

        if (newEmailFound) {
          showNotification("📥 New job emails received!", "success");
        }

        state.currentPage = 1;
        if (state.isFilteredView) {
          applyFilters();
        } else {
          updatePage(1);
        }

        updateCategoryCounts();
      });

      if (data.quota) {
        handleQuotaNotification(data.quota);
      }
    } catch (error) {
      console.error("❌ Error fetching new emails:", error.message);
      showNotification("Failed to fetch new emails", "error");
    }
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

  function setLoadingState(isLoading) {
    if (isLoading) {
      elements.loginBtn.disabled = true;
      elements.loginBtn.innerHTML = `<span class="loader-spinner"></span> Loading...`;
    } else {
      elements.loginBtn.disabled = false;
      elements.loginBtn.textContent = "Sign in with Gmail";
    }
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


  function updatePage(newPage) {
    const { PAGE_SIZE } = CONFIG.PAGINATION;
    const emails = state.isFilteredView
      ? state.filteredEmails
      : state.categorizedEmails[state.currentCategory] || [];
    const totalEmails = emails.length;
    const totalPages = Math.ceil(totalEmails / PAGE_SIZE);
    newPage = Math.max(1, Math.min(newPage, totalPages || 1));
    state.currentPage = newPage;

    renderEmails(emails, newPage);

    elements.prevButton.style.display = (newPage > 1 ? "inline-block" : "none");
    elements.nextButton.style.display = (newPage < totalPages ? "inline-block" : "none");

    updatePaginationInfo(totalEmails, newPage);
    chrome.storage.local.set({ currentPage: state.currentPage });
  }

  function updatePaginationInfo(totalEmails, page) {
    const pageSize = CONFIG.PAGINATION.PAGE_SIZE;
    const paginationInfo = getElement("pagination-info");
    if (paginationInfo) {
      if (totalEmails === 0) {
        paginationInfo.textContent = "";
      } else {
        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, totalEmails);
        paginationInfo.textContent = `${start}-${end} out of ${totalEmails}`;
      }
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

  function getFilteredCounts() {
    const counts = {};
    const searchQuery = elements.searchBar.value.toLowerCase();
    const timeRange = elements.timeRangeFilter.value;
    let thresholdDate = null;

    if (timeRange === "week") {
      thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 7);
    } else if (timeRange === "month") {
      thresholdDate = new Date();
      thresholdDate.setMonth(thresholdDate.getMonth() - 1);
    } else if (timeRange === "year") {
      thresholdDate = new Date();
      thresholdDate.setFullYear(thresholdDate.getFullYear() - 1);
    }

    Object.keys(state.categorizedEmails).forEach(category => {
      const filtered = state.categorizedEmails[category].filter(email => {
        const text = `${email.subject || ""} ${email.from || ""} ${email.body || ""} ${email.snippet || ""}`.toLowerCase();
        const matchesQuery = !searchQuery || text.includes(searchQuery);
        const matchesTime = !thresholdDate || new Date(email.date) >= thresholdDate;
        return matchesQuery && matchesTime;
      });
      counts[category] = filtered.length;
    });

    return counts;
  }

  function updateCategoryCounts() {
    let counts = {};
    if (state.isFilteredView) {
      counts = getFilteredCounts();
    }

    elements.jobTabs.forEach((tab) => {
      const category = tab.dataset.category;
      const totalCount = state.isFilteredView
        ? (counts[category] || 0)
        : (state.categorizedEmails[category]?.length || 0);

      const newCount =
        !state.isFilteredView && state.newEmailsCounts[category]
          ? state.newEmailsCounts[category]
          : 0;

      let label = category;
      if (newCount > 0) {
        label += ` (+${newCount}/${totalCount})`;
      } else {
        label += ` (${totalCount})`;
      }
      tab.textContent = label;
    });
  }

  function handleQuotaNotification(quota) {
    if (state.userPlan === "premium" || !elements.quotaNotification) {
      elements.quotaNotification.style.display = "none";
      return;
    }
    const { usagePercentage } = quota;
    if (usagePercentage >= 100) {
      elements.quotaNotification.style.display = "block";
      elements.quotaNotification.innerHTML = `
        <strong>You've reached your quota limit!</strong><br>
        <a href="#" id="upgrade-link" class="text-blue-600 hover:underline" text-decoration: underline;">Upgrade to Premium Plan</a>
        for unlimited access, or
        <a href="#" id="purchase-quota-link" class="text-blue-600 hover:underline" text-decoration: underline;">Purchase 25 more emails for $2</a>.
      `;
      getElement("upgrade-link")?.addEventListener("click", () => {
        alert("Redirecting to Premium Plan payment page...");
      });
      getElement("purchase-quota-link")?.addEventListener("click", () => {
        alert("Redirecting to additional quota payment page...");
      });
    } else if (usagePercentage >= 1) {
      elements.quotaNotification.style.display = "block";
      elements.quotaNotification.textContent = `Warning: You've used ${usagePercentage}% of your monthly quota.`;
    } else {
      elements.quotaNotification.style.display = "none";
    }
  }

  // ======================
  // EVENT HANDLERS
  // ======================
  function attachEmailEventListeners() {
    document.querySelectorAll(".email-item").forEach(item => {
      item.addEventListener("click", (event) => {
        if (!event.target.classList.contains("correction-btn")) {
          const emailId = item.dataset.emailId;
          const emailData = Object.values(state.categorizedEmails)
            .flat()
            .find(e => e.emailId === emailId);

          if (emailData) {
            displayEmailModal(emailData, item.dataset.threadId);
          }
        }
      });
    });

    document.querySelectorAll('.correction-btn').forEach(btn => {
      btn.addEventListener('click', event => {
        event.stopPropagation();
        const emailId = btn.dataset.emailId;
        const emailData = state.categorizedEmails[state.currentCategory]
          .find(e => e.emailId === emailId);
        if (!emailData) return console.error('No email data for', emailId);
        reportMisclassification(emailData);
      });
    });

  }

  elements.closeEmailModal.addEventListener("click", () => toggleEmailModal(false));

  // ======================
  // UI UPDATES
  // ======================
  function renderEmails(emails, page) {
    const { PAGE_SIZE } = CONFIG.PAGINATION;
    const start = (page - 1) * PAGE_SIZE;
    const pageSlice = emails.slice(start, start + PAGE_SIZE);

    if (emails.length) {
      elements.jobsContainer.innerHTML = `
      <div class="">
        <ul class="list-none divide-y divide-gray-200 p-0 m-0 mr-2 pr-6">
          ${pageSlice.map(createEmailHTML).join("")}
        </ul>
      </div>`;
    } else {
      elements.jobsContainer.innerHTML = `
      <div class="empty-state text-center text-sm text-gray-500">
        No emails${state.isFilteredView ? ' match your filters' : ''}
      </div>`;
    }

    attachEmailEventListeners();
    updatePaginationInfo(emails.length, page);
  }


  function createEmailHTML(email) {
    return `
    <li class="email-item w-full bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md cursor-pointer"
        data-email-id="${email.emailId}" data-thread-id="${email.threadId}">
      <div class="flex justify-between items-start space-x-4">
        <!-- Left Content: Sender, Snippet, Subject -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-500 truncate">From: ${email.from}</p>
          <p class="text-sm text-gray-600 truncate">${email.snippet || ""}</p>
          <p class="font-medium text-gray-800 truncate">${email.subject || "No Subject"}</p>
        </div>
        <!-- Right Content: Date-Time and Report Button -->
        <div class="flex flex-col items-end space-y-2">
          <div class="text-sm text-gray-500 whitespace-nowrap">
            ${new Date(email.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · 
            ${new Date(email.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
            <button
              class="correction-btn px-2 py-1 border border-red-300 text-red-500 hover:bg-red-50 rounded focus:outline-none"
              data-email-id="${email.emailId}"
              data-category="${email.category}"
              aria-label="Report incorrect classification"
            >
              ⚠
            </button>
        </div>
      </div>
    </li>
  `;
  }


  function applyFilters() {
    const searchQuery = elements.searchBar.value.toLowerCase();
    const timeRange = elements.timeRangeFilter.value;
    if (state.userPlan === "free" && timeRange === "90") {
      alert("Free plan allows filtering only within the last 30 days.");
      return;
    }
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
        const text = `${email.subject || ""} ${email.from || ""} ${email.body || ""} ${email.snippet || ""}`.toLowerCase();
        const matchesSearchQuery = !searchQuery || text.includes(searchQuery);
        const matchesTimeRange = !thresholdDate || new Date(email.date) >= thresholdDate;
        return matchesSearchQuery && matchesTimeRange;
      })
      .map(email => ({ ...email, category }));

    filteredEmails.sort((a, b) => new Date(b.date) - new Date(a.date));

    state.isFilteredView = true;
    state.filteredEmails = filteredEmails;
    state.currentPage = 1;
    updatePage(1);
    updateCategoryCounts();
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
    elements.jobTabs.forEach((tab) => {
      if (tab.dataset.category === state.currentCategory) {
        tab.classList.add("active-tab");
      }
    });
    state.isFilteredView = false;
    state.currentPage = 1;
    elements.searchBar.value = "";
    elements.timeRangeFilter.value = "week";
    restoreTabHighlighting();
    renderEmails(state.categorizedEmails[state.currentCategory], state.currentPage);
    updateCategoryCounts();
  }

  async function getUserInfo(token) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["userName"], async (data) => {
        if (data.userName) {
          console.log("✅ Loaded cached name:", data.userName);
          updateWelcomeHeader(data.userName);
          return resolve({ name: data.userName });
        }
        try {
          const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!response.ok) {
            if (response.status === 401) {
              showNotification("Session expired. Please click the Sign In button to reauthenticate.", "error");
              return reject(new Error("Unauthorized: Your token might be expired. Please reauthenticate via the Sign In button."));
            }
            throw new Error(`Profile fetch HTTP ${response.status}`);
          }
          const profile = await response.json();
          if (profile.name) {
            chrome.storage.local.set({ userName: profile.name });
            updateWelcomeHeader(profile.name);
          }
          resolve(profile);
        } catch (err) {
          console.error("❌ Failed to get user info:", err);
          reject(err);
        }
      });
    });
  }


  async function displayEmailModal(emailData, threadId) {
    const { subject, from, date, body } = emailData;

    const subjEl = document.getElementById("modal-subject");
    const dateEl = document.getElementById("modal-date");
    const fromEl = document.getElementById("modal-from");
    const bodyEl = document.getElementById("modal-body");

    if (subjEl) subjEl.textContent = subject || "(No Subject)";
    if (dateEl) {
      dateEl.textContent = new Date(date).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    }
    if (fromEl) fromEl.innerHTML = `<strong>From:</strong> ${from}`;
    if (bodyEl) bodyEl.innerHTML = body || "";

    const openLink = document.getElementById("open-in-gmail");
    if (openLink) {
      openLink.href = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
      openLink.target = "_blank";
    }

    const replyBtn = document.getElementById("reply-button");
    const replySection = document.getElementById("reply-section");
    const replyTextarea = document.getElementById("reply-body");

    if (replyBtn && replySection && replyTextarea) {
      replySection.classList.add("hidden");
      replyTextarea.value = "";
      replyBtn.textContent = "Reply";

      replyBtn.onclick = async () => {
        if (replySection.classList.contains("hidden")) {
          replySection.classList.remove("hidden");
          replyBtn.textContent = "Send";
        }
        else {
          const replyText = replyTextarea.value.trim();
          if (!replyText) {
            alert("Reply cannot be empty.");
            return;
          }
          try {
            const replySubject = `Re: ${subject || ""}`;
            await sendReply(threadId, from, replyText, replySubject);
            alert("Reply sent!");
            toggleModal(elements.emailModal, false);
          } catch (err) {
            console.error(err);
            alert("Failed to send reply.");
          }
        }
      };
    }

    toggleModal(elements.emailModal, true);
  }


  function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function sendReply(threadId, to, message) {
    const authToken = await getAuthToken();
    const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    const subject = document.querySelector("#email-content h3")?.textContent || "Re: (no subject)";
    const emailContent = `To: ${to}\r\nSubject: Re: ${subject}\r\nIn-Reply-To: ${threadId}\r\nReferences: ${threadId}\r\n\r\n${message}`;

    const encodedMessage = base64Encode(emailContent);
    const payload = { raw: encodedMessage };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error("❌ Gmail API Error:", errorDetails);
      throw new Error(`Failed to send reply. Status: ${response.status}`);
    }

    console.log("✅ Reply sent successfully.");
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
      updateCategoryCounts();
      elements.jobTabs.forEach(t => t.classList.remove("active-tab"));
      tab.classList.add("active-tab");

      state.currentCategory = category;
      state.currentPage = 1;
      chrome.storage.local.set({ currentCategory: state.currentCategory });
      if (state.isFilteredView) {
        applyFilters();
      } else {
        updatePage(1);
      }
    });
  });

  function reportMisclassification(emailData) {
    currentReportEmail = emailData;

    [...elements.misclassForm.correctCategory].forEach(radio => {
      radio.checked = (radio.value === emailData.category);
    });

    toggleMisclassModal(true);
  }

  elements.misclassCancelBtn.addEventListener('click', () => toggleMisclassModal(false));
  window.addEventListener('click', e => {
    if (e.target === elements.misclassModal) toggleMisclassModal(false);
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
    toggleMisclassModal(false);

    if (correctedCategory === "Irrelevant") {
      const toast = document.getElementById("undo-toast");
      toast.style.display = "flex";

      clearTimeout(undoTimeoutId);
      clearInterval(undoIntervalId);
      startUndoCountdown();

      undoTimeoutId = setTimeout(async () => {
        toast.style.display = "none";
        console.log("Reporting email as Irrelevant:", currentReportEmail);
        try {
          const { emailId, threadId, category: originalCategory, subject, body } = currentReportEmail;
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
          fetchStoredEmails();
        } catch (err) {
          console.error("Deferred report failed:", err);
        }
      }, 5000);

    } else {
      try {
        const { emailId, threadId, category: originalCategory, subject, body } = currentReportEmail;
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
    const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.FOLLOWUP_NEEDED}`;

    // Show the container
    container.classList.remove("hidden");

    // Insert skeleton placeholders
    listEl.innerHTML = `
    <li class="skeleton-followup"></li>
    <li class="skeleton-followup"></li>
    <li class="skeleton-followup"></li>
  `;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.userEmail })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!data.success || !data.suggestions.length) {
        clearFollowupSkeleton();
        listEl.innerHTML = `
        <li class="text-center text-sm text-gray-600">
          No follow-up suggestions found.
        </li>`;
        return;
      }

      // Retrieve followedUpThreadIds from chrome.storage.local
      const { followedUpThreadIds = [] } = await new Promise(resolve =>
        chrome.storage.local.get({ followedUpThreadIds: [] }, resolve)
      );

      // Map suggestions with followedUp status
      state.followUpSuggestions = data.suggestions.map(s => ({
        threadId: s.threadId,
        subject: s.subject,
        company: s.company,
        daysSince: s.daysSince,
        followedUp: followedUpThreadIds.includes(s.threadId)
      }));

      console.log("Follow-up suggestions:", state.followUpSuggestions);

      // Clear skeletons and render actual suggestions
      clearFollowupSkeleton();
      renderFollowUpSuggestions(state.followUpSuggestions);
    } catch (err) {
      console.error("Error loading follow-ups:", err);
      clearFollowupSkeleton();
      listEl.innerHTML = `
      <li class="text-center text-sm text-red-500">
        Failed to load follow‑ups
      </li>`;
    }
  }


  function renderFollowUpSuggestions(list) {
    const listEl = document.getElementById("followup-list");
    const showBtn = document.getElementById("show-more-followups");
    if (!listEl) return;

    const displayLimit = 5;
    const hidden = list.slice(displayLimit);
    const visible = list.slice(0, displayLimit);

    const renderCard = item => `
      <li class="followup-card border rounded-lg px-4 py-3 bg-white shadow-sm hover:bg-gray-50 transition duration-150 group"
          data-thread-id="${item.threadId}">
        <div class="flex justify-between items-center">
          <div class="flex items-start gap-2">
            ${item.followedUp ? '' : '<div class="pt-0.5 text-xs text-yellow-500 followup-dot">🟠</div>'}
            <div>
              <div class="font-medium text-sm text-gray-800 mb-1">${item.subject}</div>
              <div class="text-xs text-gray-500">Sent ${item.daysSince} days ago • ${item.company}</div>
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

      if (suggestion) suggestion.followedUp = true;

      chrome.storage.local.get({ followedUpThreadIds: [] }, ({ followedUpThreadIds }) => {
        if (!followedUpThreadIds.includes(threadId)) {
          followedUpThreadIds.push(threadId);
          chrome.storage.local.set({ followedUpThreadIds });
        }
      });



      renderFollowUpSuggestions(state.followUpSuggestions);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "NEW_EMAILS_UPDATED") {
      console.log("🔄 New emails detected. Refreshing stored emails...");
      fetchStoredEmails();
    }
  });

});

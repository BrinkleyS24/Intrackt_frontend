import { getElement } from "../utils/dom.js";

// --- App State ---
// Manages the dynamic data and current status of the extension's UI.
export const state = {
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
  userPlan: "free", // Default plan
  activeLabel: null
};

// --- UI Elements ---
// A collection of references to key DOM elements used throughout the popup script.
// Using getElement for robustness against elements not being immediately available.
export const elements = {
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
  misclassModal: document.getElementById("misclass-modal"),
  misclassForm: document.getElementById("misclass-form"),
  misclassCloseBtn: document.getElementById("misclass-close"),
  misclassCancelBtn: document.getElementById("misclass-cancel"),
  followupContainer: document.getElementById("followup-section"),
  toastSuccess: document.getElementById("toast-success"),
};

// --- Config ---
// Centralized configuration settings for API endpoints and pagination.
export const CONFIG = {
  API_BASE: "http://localhost:3000/api", // Base URL for backend API. REMINDER: Change for production!
  ENDPOINTS: {
    STORED_EMAILS: "/emails/stored-emails", // Endpoint for fetching stored emails
    REPORT_MISCLASS: "/emails/report-misclassification", // Endpoint for reporting misclassifications
    USER: "/user", // Endpoint for user-related data (e.g., plan, quota)
    EMAILS: "/emails", // Endpoint for fetching new emails
    FOLLOWUP_NEEDED: "/emails/followup-needed" // Endpoint for followup emails
  },
  PAGINATION: {
    PAGE_SIZE: 10, // Number of items per page
    INITIAL_PAGE: 1 // Starting page number
  }
};

// --- Helpers ---
/**
 * Resets the application's UI and state to a default, logged-out condition.
 * Useful during logout or initial load.
 */
export function resetAppState() {
  state.userEmail = null;
  state.categorizedEmails = {
    Applied: [],
    Interviewed: [],
    Offers: [],
    Rejected: []
  }; // Reset to empty categorized emails
  state.currentCategory = "Applied";
  state.currentPage = 1;
  state.userPlan = "free"; // Reset user plan on logout/reset
  state.newEmailsCounts = { Applied: 0, Interviewed: 0, Offers: 0, Rejected: 0 };
  state.isFilteredView = false;
  state.activeLabel = null;

  // Clear job list content
  if (elements.jobsContainer) {
    elements.jobsContainer.innerHTML = "<p>Loading emails...</p>"; // Initial loading message
  }

  // Hide quota notification
  if (elements.quotaNotification) {
    elements.quotaNotification.style.display = "none";
  }

  // Hide and clear followup section
  const followupSection = getElement("followup-section");
  if (followupSection) {
    followupSection.classList.add("hidden");
    const followupList = document.getElementById("followup-list");
    if (followupList) followupList.innerHTML = "";
    const showMore = document.getElementById("show-more-followups");
    if (showMore) showMore.classList.add("hidden");
  }

  // Hide undo toast
  const toast = document.getElementById("undo-toast");
  if (toast) toast.style.display = "none";

  // Hide all modals
  const modals = ["email-modal", "premium-modal", "misclass-modal"];
  modals.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("show");
      modal.style.display = "none";
    }
  });

  // Hide modal backdrop
  const modalBackdrop = getElement("modal-backdrop");
  if (modalBackdrop) {
    modalBackdrop.style.display = "none";
    modalBackdrop.classList.remove("show");
  }
}

/**
 * Fetches the current user's plan from the backend via the background script.
 * Updates the global state with the fetched plan.
 * @returns {Promise<string>} The fetched user plan ('free' or 'premium').
 * @async
 */
export async function fetchUserPlan() {
  if (!state.userEmail) {
    console.warn("Intrackt: Cannot fetch user plan - no user email in state.");
    state.userPlan = "free"; // Default to free if no user logged in
    return state.userPlan;
  }

  try {
    // Send a message to the background script to fetch the user plan.
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_USER_PLAN',
      userEmail: state.userEmail
    });

    if (!response.success) {
      console.error("❌ Intrackt: Failed to fetch user plan from background:", response.error);
      state.userPlan = "free"; // Default to free on error
    } else {
      state.userPlan = response.plan || "free"; // Update state with fetched plan
      console.log("✅ Intrackt: User plan fetched:", state.userPlan);
    }
    return state.userPlan;
  } catch (error) {
    console.error("❌ Intrackt: Error in fetchUserPlan:", error);
    state.userPlan = "free"; // Default to free on network/message error
    return state.userPlan;
  }
}

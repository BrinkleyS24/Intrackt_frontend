import { getElement } from "../utils/dom.js";
import { fetchData } from "../api.js";

// --- App State ---
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
  userPlan: "free",
  activeLabel: null
};

// --- UI Elements ---
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
export const CONFIG = {
  API_BASE: "http://localhost:3000/api",
  ENDPOINTS: {
    STORED_EMAILS: "/emails/stored-emails",
    REPORT_MISCLASS: "/emails/report-misclassification",
    USER: "/user",
    EMAILS: "/emails",
    FOLLOWUP_NEEDED: "/emails/followup-needed"
  },
  PAGINATION: {
    PAGE_SIZE: 10,
    INITIAL_PAGE: 1
  }
};

// --- Helpers ---
export function resetAppState() {
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

  const modals = ["email-modal", "premium-modal", "misclass-modal"];
  modals.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("show");
      modal.style.display = "none";
    }
  });

  const modalBackdrop = getElement("modal-backdrop");
  if (modalBackdrop) {
    modalBackdrop.style.display = "none";
    modalBackdrop.classList.remove("show");
  }
}

export async function fetchUserPlan() {
  try {
    const response = await fetchData(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USER}`, {
      email: state.userEmail
    });
    state.userPlan = response.plan || "free";
    return state.userPlan;
  } catch (error) {
    console.error("Error fetching user plan:", error);
    state.userPlan = "free";
    return state.userPlan;
  }
}

import { handleLogin, handleLogout } from "./services/authService.js";
import { fetchStoredEmails, fetchNewEmails, fetchQuotaData } from "./services/emailService.js";
import { renderEmails } from "./ui/emailRenderer.js";
import { updatePage } from "./ui/pagination.js";
import { toggleModal, toggleMisclassModal, toggleEmailModal } from "./ui/modals.js";
import { updateWelcomeHeader } from "./ui/welcome.js";
import { updateCategoryCounts } from "./ui/emailUI.js";
import { initializeEventListeners } from "./ui/eventListeners.js";
import { toggleUI, updatePremiumButton, adjustTimeRangeOptions } from "./ui/uiState.js";
import { state, elements, CONFIG, resetAppState, fetchUserPlan } from "./utils/appGlobals.js";
import { initializeApp } from "./app/init.js";
import { applyFilters, clearFilters } from "./app/filters.js";
import { submitMisclassificationForm, undoMisclassificationToast } from "./ui/misclassification.js";
import { loadFollowUpSuggestions } from "./app/followups.js";

// TODO: Backend doesnt catch plan upgrade
// TODO: Make sure emails are tracked properly across categories
// TODO: Fix refresh button

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
    applyFilters,
    loadFollowUpSuggestions
  });

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

  elements.misclassForm.addEventListener("submit", e =>
    submitMisclassificationForm(e, state, elements, CONFIG, setLoadingState, fetchStoredEmails)
  );

  document.getElementById("undo-btn").addEventListener("click", () =>
    undoMisclassificationToast()
  );

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "NEW_EMAILS_UPDATED") {
      console.log("🔄 New emails detected. Refreshing stored emails...");
      fetchStoredEmails(state, elements, setLoadingState, CONFIG);
      fetchNewEmails(state, elements, applyFilters, CONFIG);
      ;
    }
  });

});
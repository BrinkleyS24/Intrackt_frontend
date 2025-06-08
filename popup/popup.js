import { handleLogin, handleLogout } from "./services/authService.js";
import { fetchStoredEmails, fetchNewEmails, fetchQuotaData } from "./services/emailService.js";
import { renderEmails } from "./ui/emailRenderer.js";
import { updateWelcomeHeader } from "./ui/welcome.js";
import { updateCategoryCounts } from "./ui/emailUI.js";
import { initializeEventListeners } from "./ui/eventListeners.js";
import { toggleUI, updatePremiumButton, adjustTimeRangeOptions } from "./ui/uiState.js";
import { state, elements, CONFIG, resetAppState, fetchUserPlan } from "./utils/appGlobals.js";
import { initializeApp } from "./app/init.js";
import { applyFilters, clearFilters } from "./app/filters.js";
import { loadFollowUpSuggestions } from "./app/followups.js";
import { initializeDOMListeners } from "./ui/domListeners.js";

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

  initializeDOMListeners(
    state,
    elements,
    CONFIG,
    setLoadingState,
    fetchStoredEmails,
    fetchNewEmails,
    applyFilters
  );
});
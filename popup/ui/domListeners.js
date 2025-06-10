import { toggleModal, toggleMisclassModal } from "./modals.js";
import { updateCategoryCounts } from "./emailUI.js";
import { updatePage } from "./pagination.js";
import { submitMisclassificationForm, undoMisclassificationToast } from "./misclassification.js";
import { shouldIncludeEmail, calculateThresholdDate } from "../app/filters.js";

function handleTabSwitch(tab, state, elements, CONFIG, applyFilters) {
  const category = tab.dataset.category;
  state.newEmailsCounts[category] = 0;

  elements.jobTabs.forEach(t => t.classList.remove("active-tab"));
  tab.classList.add("active-tab");

  state.currentCategory = category;
  state.currentPage = 1;
  chrome.storage.local.set({ currentCategory: category });

  const { searchQuery, timeRange } = state.appliedFilters || {
    searchQuery: "",
    timeRange: "week",
  };

  const thresholdDate = calculateThresholdDate(timeRange);

  if (state.isFilteredView) {
    const filtered = state.categorizedEmails[category].filter(email =>
      shouldIncludeEmail(email, searchQuery, thresholdDate)
    );
    state.filteredEmails = filtered;
    updatePage(1, state, elements, CONFIG);
    updateCategoryCounts(state, elements, searchQuery, thresholdDate);
  } else {
    updatePage(1, state, elements, CONFIG);
    updateCategoryCounts(state, elements);
  }
}


export function initializeDOMListeners(state, elements, CONFIG, setLoadingState, fetchStoredEmails, fetchNewEmails, applyFilters) {
  // Close email modal
  elements.closeEmailModal?.addEventListener("click", () => toggleModal(elements.emailModal, false));

  // Close modals on backdrop click
  elements.modalBackdrop?.addEventListener("click", () => {
    toggleModal(elements.emailModal, false);
    toggleModal(elements.premiumModal, false);
  });

  // Open premium modal
  elements.premiumBtn?.addEventListener("click", () => toggleModal(elements.premiumModal, true));

  // Close premium modal
  elements.closePremiumModal?.addEventListener("click", () => toggleModal(elements.premiumModal, false));

  // Also close premium modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === elements.premiumModal) toggleModal(elements.premiumModal, false);
  });

  // Handle job tab switching
  elements.jobTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      handleTabSwitch(tab, state, elements, CONFIG, applyFilters);
    });
  });

  // Misclassification cancel
  elements.misclassCancelBtn?.addEventListener('click', () => toggleMisclassModal(false, elements));
  window.addEventListener('click', e => {
    if (e.target === elements.misclassModal) toggleMisclassModal(false, elements);
  });

  // Misclassification form submit
  elements.misclassForm?.addEventListener("submit", e =>
    submitMisclassificationForm(e, state, elements, CONFIG, setLoadingState, fetchStoredEmails)
  );

  // Undo toast button
  document.getElementById("undo-btn")?.addEventListener("click", () =>
    undoMisclassificationToast()
  );

  elements.timeRangeFilter.addEventListener("change", () => {
    timeRangeWasChanged = true;
  });

  // Refresh stored & new emails when notified
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "NEW_EMAILS_UPDATED") {
      console.log("🔄 New emails detected. Refreshing stored emails...");
      fetchStoredEmails(state, elements, setLoadingState, CONFIG);
      fetchNewEmails(state, elements, applyFilters, CONFIG);
    }
  });
}

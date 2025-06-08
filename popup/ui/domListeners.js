import { toggleModal, toggleMisclassModal, toggleEmailModal } from "./modals.js";
import { updateCategoryCounts } from "./emailUI.js";
import { updatePage } from "./pagination.js";
import { submitMisclassificationForm, undoMisclassificationToast } from "./misclassification.js";

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
      const category = tab.dataset.category;
      state.newEmailsCounts[category] = 0;

      elements.jobTabs.forEach(t => t.classList.remove("active-tab"));
      tab.classList.add("active-tab");

      state.currentCategory = category;
      state.currentPage = 1;
      chrome.storage.local.set({ currentCategory: category });

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

  // Refresh stored & new emails when notified
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "NEW_EMAILS_UPDATED") {
      console.log("🔄 New emails detected. Refreshing stored emails...");
      fetchStoredEmails(state, elements, setLoadingState, CONFIG);
      fetchNewEmails(state, elements, applyFilters, CONFIG);
    }
  });
}

import { updatePage } from "./pagination.js";
import { toggleModal } from "./modals.js";
import { getElement } from "../utils/dom.js";

export function initializeEventListeners(state, elements, {
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
}) {
  let timeRangeWasChanged = false;

  elements.timeRangeFilter?.addEventListener("change", () => {
    timeRangeWasChanged = true;
  });

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

  elements.applyFiltersBtn?.addEventListener("click", () =>
    applyFilters(state, elements, CONFIG)
  );

  elements.clearFiltersBtn?.addEventListener("click", () => {
    clearFilters(state, elements, CONFIG, () => timeRangeWasChanged = false);
  });

  elements.prevButton?.addEventListener("click", () =>
    updatePage(state.currentPage - 1, state, elements, CONFIG)
  );

  elements.nextButton?.addEventListener("click", () =>
    updatePage(state.currentPage + 1, state, elements, CONFIG)
  );

  elements.closeEmailModal?.addEventListener("click", () =>
    toggleModal(elements.emailModal, false)
  );

  elements.closePremiumModal?.addEventListener("click", () =>
    toggleModal(elements.premiumModal, false)
  );

  getElement("refresh-btn")?.addEventListener("click", async () => {
    console.log("Refresh button clicked");
    await fetchNewEmails(state, elements, applyFilters, CONFIG);
    await fetchStoredEmails(state, elements, setLoadingState, CONFIG);
    state.isFilteredView = false;
    updatePage(1, state, elements, CONFIG);
    updateCategoryCounts(state, elements);
  });
}

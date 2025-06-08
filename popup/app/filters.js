import { updatePage } from "../ui/pagination.js";
import { updateCategoryCounts } from "../ui/emailUI.js";

export function applyFilters(state, elements, CONFIG) {
  const searchQuery = elements.searchBar.value.toLowerCase();
  const timeRange = elements.timeRangeFilter.value;

  if (state.userPlan === "free" && timeRange === "90") {
    alert("Free plan allows filtering only within the last 30 days.");
    return;
  }

  let thresholdDate = null;
  const now = new Date();

  if (timeRange === "week") {
    thresholdDate = new Date(now);
    thresholdDate.setDate(now.getDate() - 7);
  } else if (timeRange === "month") {
    thresholdDate = new Date(now);
    thresholdDate.setMonth(now.getMonth() - 1);
  } else if (timeRange === "90") {
    thresholdDate = new Date(now);
    thresholdDate.setDate(now.getDate() - 90);
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

  updatePage(1, state, elements, CONFIG);
  updateCategoryCounts(state, elements);
}

export function clearFilters(state, elements, CONFIG) {
  state.isFilteredView = false;
  state.currentPage = 1;
  elements.searchBar.value = "";
  elements.timeRangeFilter.value = "week";

  restoreTabHighlighting(state, elements);
  updatePage(1, state, elements, CONFIG);
  updateCategoryCounts(state, elements);
}

function restoreTabHighlighting(state, elements) {
  elements.jobTabs.forEach((tab) => {
    if (tab.dataset.category === state.currentCategory) {
      tab.classList.add("active-tab");
    } else {
      tab.classList.remove("active-tab");
    }
  });
}

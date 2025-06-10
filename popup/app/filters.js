import { updatePage } from "../ui/pagination.js";
import { updateCategoryCounts } from "../ui/emailUI.js";

export function shouldIncludeEmail(email, searchQuery, thresholdDate) {

  if (typeof email.from !== 'string' || typeof email.subject !== 'string') {
    console.warn("❌ Email field not string", {
      from: email.from,
      subject: email.subject,
      body: email.body,
      raw: email
    });
  }
  const extractPureEmail = (str) => {
    const emailMatch = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return emailMatch ? emailMatch[0] : str;
  };

  const safeString = (value) => typeof value === 'string' ? value.toLowerCase() : '';
  const pureFrom = extractPureEmail(email.from || '').toLowerCase();
  const subject = safeString(email.subject);
  const body = safeString(email.body);


  const rawFrom = (email.from || '').toLowerCase();
  const matches =
    rawFrom.includes(searchQuery) ||
    pureFrom.includes(searchQuery) ||
    subject.includes(searchQuery) ||
    body.includes(searchQuery);
    
  return (!searchQuery || matches) &&
    (!thresholdDate || new Date(email.date) >= thresholdDate);
}


export function applyFilters(state, elements, CONFIG) {
  const searchQuery = elements.searchBar.value.trim().toLowerCase();
  const timeRange = elements.timeRangeFilter.value;

  const thresholdDate = calculateThresholdDate(timeRange);

  state.appliedFilters = {
    searchQuery: searchQuery || "",
    timeRange: timeRange || "week"
  };

  const filtered = state.categorizedEmails[state.currentCategory].filter(email =>
    shouldIncludeEmail(email, searchQuery, thresholdDate)
  );

  state.filteredEmails = filtered;
  state.isFilteredView = searchQuery !== "" || timeRange && timeRange !== "week";

  updatePage(1, state, elements, CONFIG);
  updateCategoryCounts(state, elements, searchQuery, thresholdDate);
}



// Helper functions
export function calculateThresholdDate(timeRange) {
  const now = new Date();
  const date = new Date(now);

  switch (timeRange) {
    case "week":
      date.setDate(now.getDate() - 7);
      break;
    case "month":
      date.setMonth(now.getMonth() - 1);
      break;
    case "90":
      date.setDate(now.getDate() - 90);
      break;
    default:
      return null;
  }
  return date;
}


export function clearFilters(state, elements, CONFIG, resetTimeRangeChanged) {
  state.isFilteredView = false;
  state.currentPage = 1;
  elements.searchBar.value = "";
  elements.timeRangeFilter.value = "week";

  if (resetTimeRangeChanged) resetTimeRangeChanged();

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

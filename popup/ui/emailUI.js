import { shouldIncludeEmail } from "../app/filters.js";

export function updateCategoryCounts(state, elements, searchQuery = null, thresholdDate = null) {
  let counts = {};
  if (state.isFilteredView && searchQuery !== null && thresholdDate !== null) {
    counts = getFilteredCounts(state, searchQuery, thresholdDate);
  }

  elements.jobTabs.forEach(tab => {
    const category = tab.dataset.category;
    const totalCount = state.isFilteredView
      ? (counts[category] || 0)
      : (state.categorizedEmails[category]?.length || 0);

    const newCount = (!state.isFilteredView && state.newEmailsCounts[category])
      ? state.newEmailsCounts[category]
      : 0;

    let label = category;
    if (newCount > 0) {
      label += ` (+${newCount}/${totalCount})`;
    } else {
      label += ` (${totalCount})`;
    }
    tab.textContent = label;
    counts[category] = totalCount;
  });
}

export function getFilteredCounts(state, searchQuery, thresholdDate) {
  const counts = {};

  for (const category of Object.keys(state.categorizedEmails)) {
    const filtered = state.categorizedEmails[category].filter(email =>
      shouldIncludeEmail(email, searchQuery, thresholdDate)
    );
    counts[category] = filtered.length;
  }

  return counts;
}

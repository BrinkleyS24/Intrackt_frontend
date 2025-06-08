export function updateCategoryCounts(state, elements) {
  let counts = {};
  if (state.isFilteredView) {
    counts = getFilteredCounts(state, elements); // pass state and elements down
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
  });
}

function getFilteredCounts(state, elements) {
  const counts = {};
  const searchQuery = elements.searchBar.value.toLowerCase();
  const timeRange = elements.timeRangeFilter.value;
  let thresholdDate = null;

  if (timeRange === "week") {
    thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 7);
  } else if (timeRange === "month") {
    thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - 1);
  } else if (timeRange === "90") {
    thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 90);
  }

  Object.keys(state.categorizedEmails).forEach(category => {
    const filtered = state.categorizedEmails[category].filter(email => {
      const text = `${email.subject || ""} ${email.from || ""} ${email.body || ""} ${email.snippet || ""}`.toLowerCase();
      const matchesSearch = !searchQuery || text.includes(searchQuery);
      const matchesTime = !thresholdDate || new Date(email.date) >= thresholdDate;
      return matchesSearch && matchesTime;
    });
    counts[category] = filtered.length;
  });

  return counts;
}

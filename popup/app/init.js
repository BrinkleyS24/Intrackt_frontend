import { getUserInfo } from "../services/authService.js";

export async function initializeApp({
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
  applyFilters
}) {
  const {
    gmail_token,
    userEmail,
    categorizedEmails = {},
    followedUpThreadIds = [],
    currentCategory = "Applied",
    currentPage = 1
  } = await new Promise(resolve =>
    chrome.storage.local.get(
      ["gmail_token", "userEmail", "categorizedEmails", "followedUpThreadIds", "currentCategory", "currentPage"],
      resolve
    )
  );

  state.token = gmail_token;
  state.userEmail = userEmail;
  state.categorizedEmails = categorizedEmails;
  state.currentCategory = currentCategory;
  state.currentPage = currentPage;

  if (state.token && state.userEmail) {
    await fetchUserPlan();
    await fetchQuotaData(state);
    updatePremiumButton(true, state, elements);
    adjustTimeRangeOptions(state);
    toggleUI(true, state, elements);

    renderEmails(state.categorizedEmails[state.currentCategory] || [], state.currentPage, state, elements, CONFIG);

    const allEmails = Object.values(state.categorizedEmails).flat();
    const followedUp = followedUpThreadIds.map(id =>
      allEmails.find(email => email.threadId === id)
    ).filter(Boolean);

    state.followUpSuggestions = followedUp
      .filter(email => email?.threadId && email?.subject && email?.date)
      .map(email => ({
        threadId: email.threadId,
        subject: email.subject,
        daysSince: differenceInDays(new Date(), new Date(email.date)),
        followedUp: true
      }));

    await fetchStoredEmails(state, elements, setLoadingState, CONFIG);
    await fetchNewEmails(state, elements, applyFilters, CONFIG);
    await loadFollowUpSuggestions(state, elements, CONFIG);

    getUserInfo(state.token).then(profile => {
      if (profile?.name) updateWelcomeHeader(profile.name);
    }).catch(console.error);

    setInterval(() => {
      if (state.token && state.userEmail) {
        fetchNewEmails(state, elements, applyFilters, CONFIG);
      }
    }, 60_000);
  } else {
    toggleUI(false, state, elements);
  }
}

import { toggleModal } from "../ui/modals.js";
import { renderSummaryCard } from "../ui/summaryCard.js";
import { getFollowUpState, markFollowedUp as markFollowUpInStorage, updateRespondedState as updateRespondedInStorage } from "../services/followUpService.js";
import { renderFollowUpSuggestions, clearFollowupSkeleton } from "../ui/followUpRenderer.js";

export async function loadFollowUpSuggestions(state, elements, CONFIG) {
  const container = document.getElementById("followup-section");
  const listEl = document.getElementById("followup-list");
  const showMore = document.getElementById("show-more-followups");
  const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.FOLLOWUP_NEEDED}`;

  if (state.userPlan !== "premium") {
    container.classList.remove("hidden");
    listEl.innerHTML = `
      <li class="text-center text-sm text-gray-600 mb-2">
        Unlock Suggested Follow-Ups with <strong>Premium</strong>.
      </li>
      <li class="text-center">
        <button id="upgrade-followups" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Upgrade Now
        </button>
      </li>
    `;
    showMore?.classList.add("hidden");
    document.getElementById("upgrade-followups")?.addEventListener("click", () => toggleModal(elements.premiumModal, true));
    return;
  }

  container.classList.remove("hidden");
  listEl.innerHTML = `
    <li class="skeleton-followup"></li>
    <li class="skeleton-followup"></li>
    <li class="skeleton-followup"></li>
  `;

  if (!state.userEmail) {
    console.error("❌ Cannot load follow-up suggestions: userEmail missing from state.");
    return;
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: state.userEmail })
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    clearFollowupSkeleton();

    if (!data.success || !data.suggestions.length) {
      listEl.innerHTML = `
        <li class="text-center text-sm text-gray-600">
          No follow-up suggestions found.
        </li>`;
      return;
    }

    const { followedUpMap = {}, respondedMap = {} } = await getFollowUpState();

    state.followUpSuggestions = data.suggestions.map(s => ({
      threadId: s.threadId,
      subject: s.subject,
      timestamp: s.timestamp,
      daysSince: s.daysSince,
      followedUp: s.threadId in followedUpMap,
      followedUpAt: followedUpMap[s.threadId] || null,
      responded: respondedMap[s.threadId] || false,
      shouldFollowUp: true
    }));

    console.log("🔁 Follow-up suggestions threadIds:", data.suggestions.map(s => s.threadId));

    renderSummaryCard(
      {
        Applied: state.categorizedEmails.Applied?.length || 0,
        Interviewed: state.categorizedEmails.Interviewed?.length || 0,
        Offers: state.categorizedEmails.Offers?.length || 0,
        Rejected: state.categorizedEmails.Rejected?.length || 0,
      },
      true,
      state.followUpSuggestions
    );
    console.log("📂 Applied threadIds:", state.categorizedEmails.Applied?.map(e => e.threadId));
    console.log("📂 Interviewed threadIds:", state.categorizedEmails.Interviewed?.map(e => e.threadId));
    console.log("📂 Offers threadIds:", state.categorizedEmails.Offers?.map(e => e.threadId));
    console.log("📂 Rejected threadIds:", state.categorizedEmails.Rejected?.map(e => e.threadId));

    state.onMarkFollowedUp = threadId => markFollowedUp(threadId, state);
    state.onUpdateResponded = (threadId, isChecked) => updateRespondedState(threadId, state, isChecked);

    renderFollowUpSuggestions(state.followUpSuggestions, state);
  } catch (err) {
    console.error("Error loading follow-ups:", err);
    clearFollowupSkeleton();
    listEl.innerHTML = `
      <li class="text-center text-sm text-red-500">
        Failed to load follow-ups
      </li>`;
  }
}

async function markFollowedUp(threadId, state) {
  const suggestion = state.followUpSuggestions.find(item => item.threadId === threadId);
  if (!suggestion) return;

  const now = await markFollowUpInStorage(threadId);
  suggestion.followedUp = true;
  suggestion.followedUpAt = now;

  renderFollowUpSuggestions(state.followUpSuggestions, state);
}

async function updateRespondedState(threadId, state, isChecked) {
  const suggestion = state.followUpSuggestions.find(item => item.threadId === threadId);
  if (!suggestion) return;

  suggestion.responded = isChecked;
  const { followedUpAt } = await updateRespondedInStorage(threadId, isChecked, suggestion.followedUpAt);

  suggestion.followedUp = !!followedUpAt;
  suggestion.followedUpAt = followedUpAt;

  renderFollowUpSuggestions(state.followUpSuggestions, state);
}

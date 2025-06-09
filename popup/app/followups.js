import { formatFollowUpTime } from "../utils/time.js";
import { toggleModal } from "../ui/modals.js";
import { renderSummaryCard } from "../ui/summaryCard.js";

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

        const { followedUpMap = {}, respondedMap = {} } = await new Promise(resolve =>
            chrome.storage.local.get({ followedUpMap: {}, respondedMap: {} }, resolve)
        );

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

function clearFollowupSkeleton() {
    const list = document.getElementById("followup-list");
    if (!list) return;
    list.querySelectorAll(".skeleton-followup").forEach(el => el.remove());
    document.getElementById("show-more-followups")?.classList.add("hidden");
}

function renderFollowUpSuggestions(list, state) {
    const listEl = document.getElementById("followup-list");
    const showBtn = document.getElementById("show-more-followups");
    if (!listEl) return;

    listEl.innerHTML = "";

    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

    const filteredList = list.filter(item =>
        !item.followedUp || Date.now() - item.followedUpAt < TWO_DAYS
    );

    const sortedList = filteredList.sort((a, b) => {
        if (a.followedUp !== b.followedUp) return a.followedUp ? 1 : -1;
        return a.daysSince - b.daysSince;
    });

    const displayLimit = 5;
    const hidden = sortedList.slice(displayLimit);
    const visible = sortedList.slice(0, displayLimit);

    const renderCard = item => `
    <li class="followup-card border rounded-lg px-4 py-3 bg-white shadow-sm hover:bg-gray-50 transition duration-150 group ${item.followedUp ? 'opacity-60' : ''}"
        data-thread-id="${item.threadId}">
      <div class="flex justify-between items-center">
        <div class="flex items-start gap-2">
          ${item.followedUp ? '' : '<div class="pt-0.5 text-xs text-yellow-500 followup-dot">🟠</div>'}
          <div>
            <div class="font-medium text-sm text-gray-800 mb-1">${item.subject}</div>
            <div class="text-xs text-gray-500 mb-1">
              ${item.followedUp
            ? formatFollowUpTime(item.followedUpAt)
            : `Sent ${item.daysSince} days ago`}
            </div>
            <label class="text-xs text-green-600 inline-flex items-center gap-1">
              <input type="checkbox" class="mark-responded-checkbox" data-thread-id="${item.threadId}" ${item.responded ? "checked" : ""}>
              ${item.responded ? "Responded" : "Mark as Responded"}
            </label>
          </div>
        </div>
        <a href="https://mail.google.com/mail/u/0/#inbox/${item.threadId}"
          target="_blank"
          class="view-followup text-xs text-blue-500 group-hover:opacity-100 opacity-0 transition-opacity duration-150 ml-2"
          data-thread-id="${item.threadId}">
          View →
        </a>
      </div>
    </li>
  `;

    listEl.innerHTML = visible.map(renderCard).join("");

    listEl.querySelectorAll(".view-followup").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            const threadId = event.currentTarget.dataset.threadId;
            markFollowedUp(threadId, state);
            window.open(event.currentTarget.href, "_blank");
        });
    });

    listEl.querySelectorAll(".mark-responded-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", event => {
            const threadId = event.currentTarget.dataset.threadId;
            const isChecked = event.currentTarget.checked;
            updateRespondedState(threadId, state, isChecked);
        });
    });

    if (hidden.length > 0) {
        showBtn.textContent = `Show ${hidden.length} more`;
        showBtn.classList.remove("hidden");
        showBtn.onclick = () => {
            hidden.forEach(item => listEl.insertAdjacentHTML("beforeend", renderCard(item)));
            showBtn.classList.add("hidden");
        };
    } else {
        showBtn.classList.add("hidden");
    }
}

function markFollowedUp(threadId, state) {
    const suggestion = state.followUpSuggestions.find(item => item.threadId === threadId);
    if (suggestion) {
        suggestion.followedUp = true;
        suggestion.followedUpAt = Date.now();
    }

    chrome.storage.local.get({ followedUpMap: {} }, ({ followedUpMap }) => {
        followedUpMap[threadId] = Date.now();
        chrome.storage.local.set({ followedUpMap });
    });

    renderFollowUpSuggestions(state.followUpSuggestions, state);
}

function updateRespondedState(threadId, state, isChecked) {
  const suggestion = state.followUpSuggestions.find(item => item.threadId === threadId);
  if (!suggestion) return;

  suggestion.responded = isChecked;

  chrome.storage.local.get({ respondedMap: {}, followedUpMap: {} }, ({ respondedMap, followedUpMap }) => {
    if (isChecked) {
      // Mark as responded
      respondedMap[threadId] = true;

      if (!suggestion.followedUpAt) {
        const now = Date.now();
        suggestion.followedUp = true;
        suggestion.followedUpAt = now;
        followedUpMap[threadId] = now;
      }
    } else {
      // Unmark as responded
      delete respondedMap[threadId];

      // Reset followed-up status if it was only marked due to "responded"
      if (followedUpMap[threadId] === suggestion.followedUpAt) {
        delete followedUpMap[threadId];
        suggestion.followedUp = false;
        suggestion.followedUpAt = null;
      }
    }

    chrome.storage.local.set({ respondedMap, followedUpMap });
    renderFollowUpSuggestions(state.followUpSuggestions, state);
  });
}



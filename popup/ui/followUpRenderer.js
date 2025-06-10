import { formatFollowUpTime } from "../utils/time.js";

export function renderFollowUpSuggestions(list, state) {
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
        <li class="followup-card flex flex-col gap-2 border border-gray-200 rounded-2xl px-4 py-4 bg-white shadow-md hover:shadow-lg transition-shadow duration-200 group ${item.followedUp ? 'opacity-60' : ''}" data-thread-id="${item.threadId}">
            <div class="flex justify-between items-start">
            <div class="flex items-start gap-2">
                ${item.followedUp ? '' : '<div class="h-2 w-2 bg-yellow-400 rounded-full mt-1"></div>'}
                <div>
                <div class="text-base font-semibold text-gray-900 truncate max-w-[90%]" title="${item.subject}">
                    📬 ${item.subject}
                </div>
                <div class="text-sm text-gray-500 italic">
                    ${item.followedUp
                    ? formatFollowUpTime(item.followedUpAt)
                    : `Sent ${item.daysSince} days ago`}
                </div>
                <label class="text-sm text-green-600 inline-flex items-center gap-1 mt-1">
                    <input type="checkbox" class="mark-responded-checkbox" data-thread-id="${item.threadId}" ${item.responded ? "checked" : ""}>
                    ${item.responded ? "Responded" : "Mark as Responded"}
                </label>
                </div>
            </div>
            <a href="https://mail.google.com/mail/u/0/#inbox/${item.threadId}"
                target="_blank"
                class="view-followup text-sm text-blue-600 group-hover:underline opacity-80 transition-opacity duration-150 ml-2"
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
            state.onMarkFollowedUp(threadId);
            window.open(event.currentTarget.href, "_blank");
        });
    });

    listEl.querySelectorAll(".mark-responded-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", event => {
            const threadId = event.currentTarget.dataset.threadId;
            const isChecked = event.currentTarget.checked;
            state.onUpdateResponded(threadId, isChecked);
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

export function clearFollowupSkeleton() {
    const list = document.getElementById("followup-list");
    if (!list) return;
    list.querySelectorAll(".skeleton-followup").forEach(el => el.remove());
    document.getElementById("show-more-followups")?.classList.add("hidden");
}

import { toggleModal, reportMisclassification, displayEmailModal } from "./modals.js";
import { updatePaginationInfo } from "./pagination.js";

export function renderEmails(emails, page, state, elements, CONFIG) {
    const { PAGE_SIZE } = CONFIG.PAGINATION;
    const start = (page - 1) * PAGE_SIZE;
    const pageSlice = emails.slice(start, start + PAGE_SIZE);

    if (emails.length) {
        elements.jobsContainer.innerHTML = `
      <div>
        <ul class="list-none divide-y divide-gray-200 p-0 m-0 mr-2 pr-6">
          ${pageSlice.map(createEmailHTML).join("")}
        </ul>
      </div>`;
    } else {
        elements.jobsContainer.innerHTML = `
      <div class="empty-state text-center text-sm text-gray-500">
        No emails${state.isFilteredView ? ' match your filters' : ''}
      </div>`;
    }

    attachEmailEventListeners(state, elements);
    updatePaginationInfo(emails.length, page, CONFIG);

    if (state.isMaxQuota) {
        const warningBanner = `
      <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="..." clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-red-700">
              You've reached your quota limit. New emails won't be processed until you 
              <a href="#" class="font-medium text-red-700 underline hover:text-red-600" id="inline-upgrade-link">
                upgrade your plan
              </a>.
            </p>
          </div>
        </div>
      </div>`;
        elements.jobsContainer.insertAdjacentHTML('afterbegin', warningBanner);
        document.getElementById('inline-upgrade-link')?.addEventListener('click', e => {
            e.preventDefault();
            toggleModal(elements.premiumModal, true);
        });
    }
}

function createEmailHTML(email) {
  return `
    <li class="email-item group w-full bg-white border border-gray-200 dark:border-zinc-600 rounded-2xl p-4 mb-3 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
      data-email-id="${email.emailId}" 
      data-thread-id="${email.threadId}" 
      data-email='${JSON.stringify(email).replace(/'/g, "&apos;")}'>
      <div class="flex justify-between items-start gap-4">
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
            From: ${email.from}
          </p>
          <p class="font-semibold text-sm text-gray-800 dark:text-white truncate" title="${email.subject}">
            ${email.subject || "No Subject"}
          </p>
        </div>
        <div class="flex flex-col items-end justify-between gap-2">
          <div class="text-xs text-gray-400 dark:text-zinc-400 whitespace-nowrap">
            ${formatEmailDate(email.date)}
          </div>
          <button
            class="correction-btn px-2 py-1 border border-red-300 text-red-500 hover:bg-red-50 rounded focus:outline-none transition-colors duration-150"
            data-email-id="${email.emailId}" data-category="${email.category}" aria-label="Report incorrect classification">
            ⚠
          </button>
        </div>
      </div>
    </li>
  `;
}

function formatEmailDate(rawDate) {
  const date = new Date(rawDate);
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

function attachEmailEventListeners(state, elements) {
    document.querySelectorAll(".email-item").forEach(item => {
        item.addEventListener("click", (event) => {
            if (!event.target.classList.contains("correction-btn")) {
                const emailData = JSON.parse(item.dataset.email.replace(/&apos;/g, "'"));
                if (emailData) {
                    displayEmailModal(emailData, item.dataset.threadId, elements);
                }
            }
        });
    });

    document.querySelectorAll('.correction-btn').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const emailData = JSON.parse(btn.closest(".email-item")?.dataset.email.replace(/&apos;/g, "'"));
            if (!emailData) return console.error('No email data for', emailId);
            reportMisclassification(emailData, elements, state);
        });
    });
}

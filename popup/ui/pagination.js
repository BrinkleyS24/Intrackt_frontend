import { renderEmails } from "./emailRenderer.js";
import { getElement } from "../utils/dom.js"; 

export function updatePage(newPage, state, elements, CONFIG) {
  const { PAGE_SIZE } = CONFIG.PAGINATION;
  const emails = state.isFilteredView
    ? state.filteredEmails
    : state.categorizedEmails[state.currentCategory] || [];

  const totalEmails = emails.length;
  const totalPages = Math.ceil(totalEmails / PAGE_SIZE);
  newPage = Math.max(1, Math.min(newPage, totalPages || 1));
  state.currentPage = newPage;

  renderEmails(emails, newPage, state, elements, CONFIG);

  elements.prevButton.style.display = (newPage > 1 ? "inline-block" : "none");
  elements.nextButton.style.display = (newPage < totalPages ? "inline-block" : "none");

  updatePaginationInfo(totalEmails, newPage, CONFIG);
  chrome.storage.local.set({ currentPage: state.currentPage });
}

export function updatePaginationInfo(totalEmails, page, CONFIG) {
  const pageSize = CONFIG.PAGINATION.PAGE_SIZE;
  const paginationInfo = getElement("pagination-info");

  if (paginationInfo) {
    if (totalEmails === 0) {
      paginationInfo.textContent = "";
    } else {
      const start = (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, totalEmails);
      paginationInfo.textContent = `${start}-${end} out of ${totalEmails}`;
    }
  }
}

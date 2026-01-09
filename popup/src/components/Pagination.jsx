/**
 * @file popup/src/components/Pagination.jsx
 * @description React component for pagination controls.
 * Implemented with Tailwind CSS for styling.
 */

import React from 'react';

function Pagination({ currentPage, totalPages, onPageChange, totalEmails, pageSize, itemLabel }) {
  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalEmails);

  const singular = itemLabel?.singular || 'conversation';
  const plural = itemLabel?.plural || 'conversations';
  const zero = itemLabel?.zero || 'No conversations';

  return (
    <footer className="border-t border-gray-200 dark:border-zinc-700 px-6 py-4 bg-white dark:bg-zinc-800 flex items-center justify-between text-sm">
      <button
        id="prev-button"
        className="px-4 py-2 rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span id="pagination-info" className="text-gray-600 dark:text-zinc-400">
        {totalEmails === 0
          ? zero
          : `${startRange}-${endRange} of ${totalEmails} ${totalEmails === 1 ? singular : plural}`
        }
      </span>
      <button
        id="next-button"
        className="px-4 py-2 rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </footer>
  );
}

export default Pagination;

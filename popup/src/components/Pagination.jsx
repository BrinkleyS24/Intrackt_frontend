/**
 * @file popup/src/components/Pagination.jsx
 * @description React component for pagination controls.
 */

import React from 'react';

function Pagination({ currentPage, totalPages, onPageChange, totalEmails, pageSize }) {
  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalEmails);

  return (
    <footer className="border-t border-gray-200 dark:border-zinc-700 px-6 py-4 bg-white dark:bg-zinc-800 flex items-center justify-between text-sm">
      <button
        id="prev-button"
        className="btn btn-outline"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span id="pagination-info" className="text-gray-600 dark:text-zinc-400">
        {totalEmails === 0
          ? "No emails"
          : `${startRange}-${endRange} of ${totalEmails}`
        }
      </span>
      <button
        id="next-button"
        className="btn btn-outline"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </footer>
  );
}

export default Pagination;

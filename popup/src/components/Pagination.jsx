/**
 * @file popup/src/components/Pagination.jsx
 * @description Pagination controls for thread lists.
 */

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function Pagination({ currentPage, totalPages, onPageChange, totalEmails, pageSize, itemLabel, compact = false }) {
  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalEmails);
  const singular = itemLabel?.singular || 'conversation';
  const plural = itemLabel?.plural || 'conversations';
  const zero = itemLabel?.zero || 'No conversations';

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [currentPage, totalPages]);

  return (
    <footer className="border-t border-border bg-card px-3 py-3">
      {!compact && (
        <div className="mb-2 text-center text-xs text-muted-foreground">
          {totalEmails === 0
            ? zero
            : `${startRange}-${endRange} of ${totalEmails} ${totalEmails === 1 ? singular : plural}`}
        </div>
      )}

      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {visiblePages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[11px] font-medium transition-colors ${
              currentPage === page
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            type="button"
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </footer>
  );
}

export default Pagination;

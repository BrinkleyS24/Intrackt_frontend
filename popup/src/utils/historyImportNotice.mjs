// Copy for the history-coverage note's import states. Kept dependency-free so it runs under
// `node --test` (popup/src/utils/historyImportNotice.test.mjs).

// Coverage dates arrive as UTC without a zone marker; read them as UTC like uiHelpers.js
// parseEmailDate (2026-10-05: evening times showed the next day).
function parseUtc(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const naiveIso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) && !hasZone;
  const date = new Date(naiveIso ? `${raw.replace(' ', 'T')}Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "May 2, 2026", or null when the value is not a usable date (never invent one). */
export function formatImportStart(isoDate) {
  const parsed = parseUtc(isoDate);
  if (!parsed) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * When older history is not fully in, say that instead of the plan boundary. The backend decides
 * the state (describeHistoryImport); nothing is shown for an older backend that does not send it.
 *
 * A retry date that has already passed is never shown: the popup said "We'll try again
 * automatically on Oct 10, 2026" on Oct 14 (persona report 2026-10-14). An overdue retry reads
 * like the fallback, with no date.
 */
export function describeImportGap(historyImport, now = new Date()) {
  const state = historyImport?.state;
  if (state === 'importing') {
    return 'Still importing your older email. Earlier applications will appear over the next few hours.';
  }
  if (state === 'retrying') {
    const retryAt = parseUtc(historyImport?.nextRetryAt);
    const next = retryAt && retryAt.getTime() > now.getTime() ? formatImportStart(historyImport.nextRetryAt) : null;
    return next
      ? `Importing your older email hit a problem, so earlier applications may be missing. We'll try again automatically on ${next}.`
      : "Importing your older email hit a problem, so earlier applications may be missing. We'll try again automatically soon.";
  }
  if (state === 'stopped') {
    return "We couldn't import your older email, so earlier applications may be missing. We've been alerted and are looking into it.";
  }
  return null;
}

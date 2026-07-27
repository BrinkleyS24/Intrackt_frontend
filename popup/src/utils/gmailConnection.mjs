/**
 * @file popup/src/utils/gmailConnection.mjs
 * @description Derives the popup's Gmail-connection state from the `gmailAuth`
 * block on /api/emails/sync-status.
 *
 * A dead Google refresh token is invisible in every other field the popup reads:
 * sync simply stops, the pipeline keeps rendering the emails it already had, and
 * "synced" ages quietly in the header. Users went as long as 102 days without
 * learning their tracker had stopped working, because the only signal was a
 * 15-second toast that fired on a manual sync failure they never triggered.
 *
 * Kept as a pure module so the copy and the day math are testable without a
 * DOM — the banner component only renders what this returns.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between `failedAt` and now, or null when that cannot be trusted.
 *
 * Returns null rather than 0 for a missing/unparseable/future timestamp so the
 * caller can drop the duration clause entirely instead of claiming the
 * connection broke today, which is the one thing we know it did not do.
 */
function daysSince(failedAt, now) {
  if (!failedAt) return null;
  const then = new Date(failedAt).getTime();
  if (Number.isNaN(then)) return null;
  const elapsed = now - then;
  if (elapsed < 0) return null;
  return Math.floor(elapsed / MS_PER_DAY);
}

function describeDuration(days) {
  if (days === null) return "New application emails aren't being tracked.";
  if (days < 1) return "New application emails stopped being tracked today.";
  if (days === 1) return "New application emails haven't been tracked for 1 day.";
  return `New application emails haven't been tracked for ${days} days.`;
}

/**
 * INSUFFICIENT_SCOPES means the grant survived but no longer covers Gmail, so
 * "revoked" would be wrong and the fix framing differs. Everything else is
 * treated as a revocation, which is what INVALID_GRANT and an unknown permanent
 * failure both amount to from the user's side.
 */
function describeCause(errorCode) {
  if (errorCode === 'INSUFFICIENT_SCOPES') {
    return 'Applendium no longer has permission to read your Gmail.';
  }
  return 'Google revoked our access to your Gmail, usually after a password change or a permissions cleanup.';
}

export function deriveGmailConnectionState(gmailAuth, now = Date.now()) {
  if (!gmailAuth?.requiresReconnect) {
    return { requiresReconnect: false, daysDark: null, headline: null, detail: null, cause: null };
  }

  const daysDark = daysSince(gmailAuth.failedAt, now);

  return {
    requiresReconnect: true,
    daysDark,
    headline: "Applendium can't see your inbox",
    detail: describeDuration(daysDark),
    cause: describeCause(gmailAuth.errorCode),
  };
}

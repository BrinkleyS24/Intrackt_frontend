// What a Refresh found. Kept dependency-free so it runs under `node --test`.
//
// After a refresh the popup said "synced" / "Up to date." and nothing about what happened, so a
// user could not tell a sync that found two replies from one that found nothing (persona report
// 2026-10-15). The count compares the job emails on hand before and after the refresh.

const RELEVANT = ['applied', 'interviewed', 'offers', 'rejected'];

/** Ids of the job emails in a categorized snapshot ({ applied: [...], ... }). */
export function relevantEmailIds(categorized) {
  const ids = new Set();
  for (const key of RELEVANT) {
    for (const email of categorized?.[key] || []) {
      if (email?.id != null) ids.add(String(email.id));
    }
  }
  return ids;
}

/** How many job emails are in `after` that were not in the `before` id set. */
export function countNewEmails(beforeIds, afterCategorized) {
  let count = 0;
  for (const id of relevantEmailIds(afterCategorized)) {
    if (!beforeIds.has(id)) count += 1;
  }
  return count;
}

/**
 * @param {number|null} count new job emails, or null when the inbox check is still running
 * @returns {{ short: string, sentence: string }} header label and the toast
 */
export function describeSyncResult(count) {
  if (count == null || !Number.isFinite(count)) {
    return { short: 'checking', sentence: 'Still checking your inbox. New emails appear here as they are found.' };
  }
  if (count === 0) return { short: '0 new', sentence: 'Up to date. No new job emails.' };
  return { short: `${count} new`, sentence: `Up to date. ${count} new job email${count === 1 ? '' : 's'}.` };
}

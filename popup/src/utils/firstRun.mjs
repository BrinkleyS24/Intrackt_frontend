// Copy for the popup's empty list. Kept dependency-free so it runs under `node --test`.
//
// A brand-new user saw only "No emails found in this category." under four zero tiles: no word on
// what happens next, how long it takes, or what to do now (persona report 2026-10-15, graded D+).
// A search or date filter with no matches is a different situation and says so.

/**
 * @param {{ syncing?: boolean, coverage?: object|null, filtered?: boolean, hasApplications?: boolean }} input
 * @returns {{ kind: 'first_run'|'no_matches'|'none', title: string, lines: string[] }}
 */
export function describeEmptyList({ syncing = false, coverage = null, filtered = false, hasApplications = false } = {}) {
  if (filtered || hasApplications) {
    return {
      kind: 'no_matches',
      title: 'No applications match',
      lines: ['Try another company or role, or clear the search and date filter.'],
    };
  }
  const windowDays = Number(coverage?.historyWindowDays);
  const reach = Number.isFinite(windowDays) && windowDays > 0 ? `Older email, up to ${windowDays} days back,` : 'Older email';
  const importState = coverage?.historyImport?.state;
  // The backend reports syncComplete once the first import is done; with nothing found by then, the
  // honest message is that there were no job emails, not that they are on their way.
  const finished = coverage?.syncComplete === true && !syncing && importState !== 'importing';
  if (finished) {
    return {
      kind: 'first_run',
      title: 'No job applications found yet',
      lines: [
        Number.isFinite(windowDays) && windowDays > 0
          ? `Applendium checked the last ${windowDays} days of your inbox and found no application emails.`
          : 'Applendium checked your inbox and found no application emails.',
        'New confirmations, interviews, offers and rejections show up here as they arrive.',
        'Applied somewhere without an email? Use + Add to track it now.',
      ],
    };
  }
  return {
    kind: 'first_run',
    title: 'Your applications will show up here',
    lines: [
      syncing
        ? 'Applendium is reading your inbox for job emails now. Applications appear here as they are found.'
        : 'Applendium reads your inbox for job emails: confirmations, interviews, offers and rejections.',
      // Same timing the history notice already gives (historyImportNotice.mjs).
      `Recent email comes first. ${reach} comes in over the next few hours. You can close this popup.`,
      'Applied somewhere without an email? Use + Add to track it now.',
    ],
  };
}

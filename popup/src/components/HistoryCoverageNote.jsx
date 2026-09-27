/**
 * @file popup/src/components/HistoryCoverageNote.jsx
 * @description A quiet footnote under the application list stating how far back the
 * user's plan actually imports.
 *
 * Why this exists: a sync only ever reaches back the plan's window (90 days free, 180
 * premium since 2026-09-26; the backend sends the numbers), and the history backfill does
 * not go deeper — it is the window back from *today*, not gap-filling.
 * Applications older than that line are simply invisible, and until now nothing said so.
 * One real premium user has ~196 of them. A truncated list with no explanation does not
 * read as "outside my plan's window", it reads as "this tracker missed my applications",
 * which is a far worse thing for someone to believe about a job tracker than a stated
 * limit. For free users the same sentence is also the most honest upgrade prompt we have.
 *
 * Note this owns its own outer spacing (mx/mb) rather than taking it from a caller's
 * wrapper. It self-suppresses in several cases, and a padded wrapper around a null render
 * leaves a strip of dead space at the bottom of the popup.
 */

import React, { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';

/**
 * Dismissal is remembered per plan and window, so the note comes back only when what it says
 * changes (an upgrade to Premium, or the plan's window itself changing). The popup is small and
 * the founder found a permanent note too big for what it says (2026-09-27).
 */
const DISMISS_KEY = 'applendium:historyNoteDismissedFor';

function readDismissed() {
  try {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) return Promise.resolve(null);
    return storage.get([DISMISS_KEY]).then((result) => result?.[DISMISS_KEY] ?? null).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

function writeDismissed(value) {
  try {
    globalThis.chrome?.storage?.local?.set({ [DISMISS_KEY]: value })?.catch?.(() => {});
  } catch {
    // Not remembered this time; the note simply reappears next open.
  }
}

/**
 * Formats an ISO date as "May 2, 2026", or returns null if it isn't a usable date.
 * Returning null (rather than a placeholder) matters: the fallback copy below is written
 * to work with no date at all, because inventing one would be the same class of bug this
 * component exists to fix.
 */
function formatImportStart(isoDate) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HistoryCoverageNote({ coverage, userPlan, onUpgrade }) {
  // undefined = still reading storage; render nothing rather than flash the note.
  const [dismissedFor, setDismissedFor] = useState(undefined);
  useEffect(() => {
    let active = true;
    readDismissed().then((value) => { if (active) setDismissedFor(value); });
    return () => { active = false; };
  }, []);

  const windowDays = Number(coverage?.historyWindowDays);
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null;
  const noteKey = `${userPlan || 'free'}:${windowDays}`;
  if (dismissedFor === undefined || dismissedFor === noteKey) return null;

  // Mid-import the list is short for a completely different reason. Asserting a history
  // boundary while we are still filling it in would explain the wrong absence, so stay
  // silent until the import has actually finished and the boundary is the real cause.
  if (!coverage?.syncComplete) return null;

  // `visibleSinceDate`, not `oldestSyncedDate`. The two differ after a premium -> free
  // downgrade: rows are hidden rather than deleted, so the synced date keeps its
  // premium-era value while reads snap back to 30 days. The backend derives this one from
  // the same helper that enforces the clamp, so the sentence can't outrun the query.
  const importStart = formatImportStart(coverage?.visibleSinceDate);
  // The upgrade line states the real difference, from the backend. It used to hard-code
  // "Premium imports 90 days", which became no difference at all once free reached 90.
  // With no Premium number (an older backend) or no gain, it says nothing.
  const premiumDays = Number(coverage?.premiumHistoryWindowDays);
  const showUpgrade = userPlan !== 'premium' && Number.isFinite(premiumDays) && premiumDays > windowDays;

  return (
    <div
      data-testid="history-coverage-note"
      className="mx-3 mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5"
    >
      <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="text-[11px] leading-4 text-muted-foreground">
        <span>
          {importStart
            ? `Tracking your email from ${importStart} — your plan imports the last ${windowDays} days.`
            : `Your plan imports the last ${windowDays} days of email.`}
        </span>{' '}
        <span>Applications older than that aren&apos;t here.</span>
        {showUpgrade && (
          <>
            {' '}
            <button
              type="button"
              onClick={onUpgrade}
              className="font-medium text-foreground underline underline-offset-2 transition hover:opacity-80"
            >
              Premium imports {premiumDays} days
            </button>
            <span>.</span>
          </>
        )}
      </div>
      <button
        type="button"
        data-testid="history-coverage-dismiss"
        aria-label="Hide this note"
        onClick={() => {
          setDismissedFor(noteKey);
          writeDismissed(noteKey);
        }}
        className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default HistoryCoverageNote;

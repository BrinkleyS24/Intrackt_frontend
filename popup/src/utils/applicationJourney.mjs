// Mirrors REAPPLICATION_GAP_DAYS in the backend linker (services/applicationService.js).
// Below this an out-of-order outcome is just sync jitter; above it the stages belong to
// separate application cycles.
export const REAPPLICATION_GAP_DAYS = 30;

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TERMINAL_CATEGORIES = new Set(['offers', 'rejected']);

// A plain Date is enough here: the threshold is 30 days, so the sub-day drift from
// parsing a timezone-less timestamp as local time cannot change the outcome.
const toStageTime = (stage) => {
  if (!stage?.date) return null;
  const time = new Date(stage.date).getTime();
  return Number.isNaN(time) ? null : time;
};

/**
 * True when a terminal stage predates the application's own applied stage by more than
 * the re-application gap — the shape a backward-merged journey has: an outcome from an
 * earlier cycle sitting on a newer application and closing it.
 *
 * The Repair action used to stay hidden for exactly the bug it fixes. A journey of one
 * applied stage plus one older rejection trips neither of the other conditions (a second
 * applied stage, or eight stages), so a brand-new application could show as REJECTED with
 * no way for the user to undo it.
 *
 * Stage categories must already be normalized by the caller — this module stays free of
 * the shared display-state import so it can be unit tested under node.
 */
export function hasBackwardMergedOutcome(stages = []) {
  const list = Array.isArray(stages) ? stages : [];

  const appliedTimes = list
    .filter((stage) => stage?.category === 'applied')
    .map(toStageTime)
    .filter((time) => time != null);
  if (appliedTimes.length === 0) return false;

  const earliestApplied = Math.min(...appliedTimes);
  return list.some((stage) => {
    if (!TERMINAL_CATEGORIES.has(stage?.category)) return false;
    const time = toStageTime(stage);
    if (time == null) return false;
    return (earliestApplied - time) / MS_PER_DAY > REAPPLICATION_GAP_DAYS;
  });
}

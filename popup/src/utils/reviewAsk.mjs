// Review ask — pure eligibility logic. One ask, ever: the card appears once a
// user has real tenure and value (7+ days since first seen with 10+ tracked
// applications), never during sync or error states, and any answer (review or
// dismiss) retires it permanently. Kept dependency-free for `node --test`.

export const REVIEW_ASK_STORAGE_KEY = 'reviewAskState';
export const REVIEW_ASK_MIN_TENURE_MS = 7 * 24 * 60 * 60 * 1000;
export const REVIEW_ASK_MIN_TRACKED = 10;

/**
 * @param {object} params
 * @param {{eligibleSince?: number, answeredAt?: number}|null} params.state — persisted state
 * @param {number|null} params.trackedCount — tracked applications (quota.used)
 * @param {boolean} params.isBusy — syncing, stuck, or error state visible
 * @param {number} params.now
 * @returns {{show: boolean, initialize: boolean}} — `initialize` means the
 *   tenure clock should be persisted now (first time we saw this user).
 */
export function evaluateReviewAsk({ state, trackedCount, isBusy, now }) {
  if (state?.answeredAt) return { show: false, initialize: false };
  if (!state?.eligibleSince) return { show: false, initialize: true };
  if (isBusy) return { show: false, initialize: false };
  if (now - state.eligibleSince < REVIEW_ASK_MIN_TENURE_MS) return { show: false, initialize: false };
  if (!Number.isFinite(trackedCount) || trackedCount < REVIEW_ASK_MIN_TRACKED) {
    return { show: false, initialize: false };
  }
  return { show: true, initialize: false };
}

export function reviewUrlForExtension(extensionId) {
  return `https://chromewebstore.google.com/detail/${extensionId}/reviews`;
}

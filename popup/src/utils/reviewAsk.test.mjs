import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReviewAsk, REVIEW_ASK_MIN_TENURE_MS } from './reviewAsk.mjs';

const NOW = 1_800_000_000_000;
const eligible = { eligibleSince: NOW - REVIEW_ASK_MIN_TENURE_MS - 1000 };

test('shows after 7 days tenure with 10+ tracked applications', () => {
  const result = evaluateReviewAsk({ state: eligible, trackedCount: 12, isBusy: false, now: NOW });
  assert.deepEqual(result, { show: true, initialize: false });
});

test('first sighting initializes the tenure clock and does not show', () => {
  const result = evaluateReviewAsk({ state: null, trackedCount: 50, isBusy: false, now: NOW });
  assert.deepEqual(result, { show: false, initialize: true });
});

test('stays hidden inside the 7-day tenure window', () => {
  const state = { eligibleSince: NOW - REVIEW_ASK_MIN_TENURE_MS + 60_000 };
  assert.equal(evaluateReviewAsk({ state, trackedCount: 50, isBusy: false, now: NOW }).show, false);
});

test('stays hidden below 10 tracked applications', () => {
  assert.equal(evaluateReviewAsk({ state: eligible, trackedCount: 9, isBusy: false, now: NOW }).show, false);
  assert.equal(evaluateReviewAsk({ state: eligible, trackedCount: null, isBusy: false, now: NOW }).show, false);
});

test('never shows during sync or error states', () => {
  assert.equal(evaluateReviewAsk({ state: eligible, trackedCount: 50, isBusy: true, now: NOW }).show, false);
});

test('an answer retires the ask forever, regardless of everything else', () => {
  const state = { ...eligible, answeredAt: NOW - 1000 };
  const result = evaluateReviewAsk({ state, trackedCount: 500, isBusy: false, now: NOW });
  assert.deepEqual(result, { show: false, initialize: false });
});

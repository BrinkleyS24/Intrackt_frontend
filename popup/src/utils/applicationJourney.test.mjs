import test from 'node:test';
import assert from 'node:assert/strict';
import { hasBackwardMergedOutcome } from './applicationJourney.mjs';

// Categories arrive already normalized from normalizeApplicationStatusKey.
const stage = (category, date) => ({ category, date });

test('detects the backward-merged shape that closed a brand-new application', () => {
  // The reported case: applied 2026-07-26, rejected 2025-12-02 from an earlier cycle.
  assert.equal(hasBackwardMergedOutcome([
    stage('rejected', '2025-12-02T17:00:00Z'),
    stage('applied', '2026-07-26T16:46:00Z'),
  ]), true);
});

test('a normal journey with outcomes after the application is not flagged', () => {
  assert.equal(hasBackwardMergedOutcome([
    stage('applied', '2026-01-05T09:00:00Z'),
    stage('interviewed', '2026-02-11T09:00:00Z'),
    stage('rejected', '2026-06-30T09:00:00Z'),
  ]), false);
});

test('an outcome slightly before the applied stage is sync jitter, not a merge', () => {
  assert.equal(hasBackwardMergedOutcome([
    stage('rejected', '2026-02-05T09:00:00Z'),
    stage('applied', '2026-02-10T09:00:00Z'),
  ]), false);
});

test('an interview stage before the application does not trip it (terminal stages only)', () => {
  assert.equal(hasBackwardMergedOutcome([
    stage('interviewed', '2025-11-01T09:00:00Z'),
    stage('applied', '2026-07-26T09:00:00Z'),
  ]), false);
});

test('an offer from an earlier cycle is flagged the same as a rejection', () => {
  assert.equal(hasBackwardMergedOutcome([
    stage('offers', '2025-10-01T09:00:00Z'),
    stage('applied', '2026-07-26T09:00:00Z'),
  ]), true);
});

test('the earliest applied stage anchors the comparison', () => {
  // A genuine re-application journey: the old rejection sits between two applied stages,
  // so it postdates the cycle it belongs to and must not be flagged.
  assert.equal(hasBackwardMergedOutcome([
    stage('applied', '2025-11-01T09:00:00Z'),
    stage('rejected', '2025-12-02T09:00:00Z'),
    stage('applied', '2026-07-26T09:00:00Z'),
  ]), false);
});

test('exactly at the gap is tolerated; beyond it is flagged', () => {
  assert.equal(hasBackwardMergedOutcome([
    stage('rejected', '2026-01-01T00:00:00Z'),
    stage('applied', '2026-01-31T00:00:00Z'),
  ]), false);
  assert.equal(hasBackwardMergedOutcome([
    stage('rejected', '2026-01-01T00:00:00Z'),
    stage('applied', '2026-02-01T00:00:00Z'),
  ]), true);
});

test('returns false without an applied stage or with unusable input', () => {
  assert.equal(hasBackwardMergedOutcome([stage('rejected', '2025-12-02T09:00:00Z')]), false);
  assert.equal(hasBackwardMergedOutcome([]), false);
  assert.equal(hasBackwardMergedOutcome(), false);
  assert.equal(hasBackwardMergedOutcome([
    stage('applied', 'not-a-date'),
    stage('rejected', 'also-bad'),
  ]), false);
});

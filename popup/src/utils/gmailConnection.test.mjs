import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGmailConnectionState } from './gmailConnection.mjs';

const NOW = new Date('2026-07-27T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

test('a healthy connection renders nothing', () => {
  const state = deriveGmailConnectionState({ requiresReconnect: false, errorCode: null, failedAt: null }, NOW);
  assert.equal(state.requiresReconnect, false);
  assert.equal(state.headline, null);
});

test('a missing gmailAuth block renders nothing', () => {
  // Older backend revisions and the /sync-status failure path both omit it.
  // Absence must never be read as "broken" or every user sees the banner.
  assert.equal(deriveGmailConnectionState(undefined, NOW).requiresReconnect, false);
  assert.equal(deriveGmailConnectionState(null, NOW).requiresReconnect, false);
  assert.equal(deriveGmailConnectionState({}, NOW).requiresReconnect, false);
});

test('states how long the inbox has been dark', () => {
  // The real prod case: a free user 102 days without a single tracked email.
  const state = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INVALID_GRANT', failedAt: daysAgo(102) },
    NOW
  );
  assert.equal(state.requiresReconnect, true);
  assert.equal(state.daysDark, 102);
  assert.match(state.detail, /102 days/);
});

test('says "1 day" rather than "1 days"', () => {
  const state = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INVALID_GRANT', failedAt: daysAgo(1) },
    NOW
  );
  assert.match(state.detail, /1 day\./);
});

test('drops the duration claim when the failure time is unknown', () => {
  // A user flagged by the live sync path before the column was backfilled has
  // no failedAt. Better to say nothing than to imply it broke just now.
  const state = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INVALID_GRANT', failedAt: null },
    NOW
  );
  assert.equal(state.daysDark, null);
  assert.doesNotMatch(state.detail, /\d/);
});

test('ignores an unparseable or future failure timestamp', () => {
  const garbage = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INVALID_GRANT', failedAt: 'not-a-date' },
    NOW
  );
  assert.equal(garbage.daysDark, null);

  // Clock skew between the backend and the user's machine must not produce
  // "broken for -1 days".
  const future = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INVALID_GRANT', failedAt: daysAgo(-3) },
    NOW
  );
  assert.equal(future.daysDark, null);
});

test('distinguishes a narrowed permission grant from a full revocation', () => {
  // INSUFFICIENT_SCOPES still has a live grant, so "revoked" would be false.
  const scopes = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INSUFFICIENT_SCOPES', failedAt: daysAgo(5) },
    NOW
  );
  assert.match(scopes.cause, /permission/i);
  assert.doesNotMatch(scopes.cause, /revoked/i);

  const revoked = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INVALID_GRANT', failedAt: daysAgo(5) },
    NOW
  );
  assert.match(revoked.cause, /revoked/i);
});

test('never implies the user lost tracked data', () => {
  // Same rail as the reconnect email: nothing was deleted, and a user who
  // thinks their pipeline was wiped uninstalls instead of reconnecting.
  const state = deriveGmailConnectionState(
    { requiresReconnect: true, errorCode: 'INVALID_GRANT', failedAt: daysAgo(63) },
    NOW
  );
  const copy = `${state.headline} ${state.detail} ${state.cause}`.toLowerCase();
  for (const alarming of ['deleted', 'lost', 'erased', 'expired account', 'suspended']) {
    assert.ok(!copy.includes(alarming), `copy should not contain "${alarming}": ${copy}`);
  }
});

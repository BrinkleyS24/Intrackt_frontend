import test from 'node:test';
import assert from 'node:assert/strict';
import { describeImportGap, formatImportStart } from './historyImportNotice.mjs';

const now = new Date('2026-10-14T15:00:00Z');

test('a retry date in the past is never shown (2026-10-14 persona report)', () => {
  const copy = describeImportGap({ state: 'retrying', nextRetryAt: '2026-10-10T06:00:00Z' }, now);
  assert.doesNotMatch(copy, /Oct 10/);
  assert.match(copy, /try again automatically soon/);
});

test('a future retry date is shown', () => {
  const copy = describeImportGap({ state: 'retrying', nextRetryAt: '2026-10-16T06:00:00Z' }, now);
  assert.match(copy, /on Oct 16, 2026\./);
});

test('naive UTC dates are read as UTC', () => {
  assert.equal(formatImportStart('2026-01-05 03:00:00'), new Date('2026-01-05T03:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  assert.equal(formatImportStart('nope'), null);
  assert.equal(describeImportGap({ state: 'done' }, now), null);
});

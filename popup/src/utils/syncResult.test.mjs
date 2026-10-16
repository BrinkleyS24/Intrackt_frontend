import test from 'node:test';
import assert from 'node:assert/strict';
import { countNewEmails, describeSyncResult, relevantEmailIds } from './syncResult.mjs';

test('a refresh says how many new job emails it found', () => {
  const before = relevantEmailIds({ applied: [{ id: 1 }], interviewed: [{ id: 2 }], irrelevant: [{ id: 9 }] });
  assert.deepEqual([...before].sort(), ['1', '2']);
  const after = { applied: [{ id: 1 }, { id: 3 }], interviewed: [{ id: 2 }], rejected: [{ id: 4 }], irrelevant: [{ id: 10 }] };
  assert.equal(countNewEmails(before, after), 2);
  assert.deepEqual(describeSyncResult(2), { short: '2 new', sentence: 'Up to date. 2 new job emails.' });
  assert.equal(describeSyncResult(1).sentence, 'Up to date. 1 new job email.');
  assert.deepEqual(describeSyncResult(0), { short: '0 new', sentence: 'Up to date. No new job emails.' });
  // A background import still running is not reported as "nothing new".
  assert.match(describeSyncResult(null).sentence, /Still checking/);
});

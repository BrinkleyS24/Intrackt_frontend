import test from 'node:test';
import assert from 'node:assert/strict';
import { describeEmptyList } from './firstRun.mjs';

test('a brand-new inbox says what happens next, how long it takes and what to do now', () => {
  const state = describeEmptyList({ syncing: true, coverage: { historyWindowDays: 90, syncComplete: false } });
  assert.equal(state.kind, 'first_run');
  const text = [state.title, ...state.lines].join(' ');
  assert.match(text, /reading your inbox/);
  assert.match(text, /up to 90 days back/);
  assert.match(text, /next few hours/);
  assert.match(text, /\+ Add/);
  assert.doesNotMatch(text, /No emails found in this category/);
});

test('a finished import with nothing found says so instead of promising more', () => {
  const state = describeEmptyList({ coverage: { historyWindowDays: 90, syncComplete: true } });
  assert.equal(state.title, 'No job applications found yet');
  assert.match(state.lines[0], /last 90 days/);
});

test('a search with no matches is not a first-run screen', () => {
  const state = describeEmptyList({ filtered: true });
  assert.equal(state.kind, 'no_matches');
  assert.equal(state.title, 'No applications match');
  assert.equal(describeEmptyList({ hasApplications: true }).kind, 'no_matches');
});

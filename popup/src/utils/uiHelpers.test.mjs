// node --test popup/src/utils/uiHelpers.test.mjs
// uiHelpers.js is an ESM `.js` file in a CommonJS package with no imports, so it is loaded through
// a data: URL (same trick as shared/applyGateCheck.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'uiHelpers.js'), 'utf8');
const { formatDate, parseCalendarDay, parseEmailDate } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

// 2026-10-14 persona report: the manual card showed "2026-10-13" beside email cards' "9/27/2026".
test('a manual applied day formats like email card dates, on the day the user picked', () => {
  const day = parseCalendarDay('2026-09-27T12:00:00Z');
  assert.equal(day.getFullYear(), 2026);
  assert.equal(day.getMonth(), 8);
  assert.equal(day.getDate(), 27);
  const formatted = formatDate(day);
  assert.equal(formatted, formatDate(parseEmailDate('2026-09-27 12:00:00')));
  assert.doesNotMatch(formatted, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(parseCalendarDay('not a date'), null);
});

test('a manual day picked today reads "Today"', () => {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T12:00:00Z`;
  assert.equal(formatDate(parseCalendarDay(iso)), 'Today');
});

// 2026-10-15 persona reports: card dates read "9/27/2026" beside "2 days ago" and the thread's "Apr 4".
test('older dates read "Sep 27" like the web, with the year only outside this year', async () => {
  const mod = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), 0, 1, 12);
  if (now - thisYear > 8 * 86_400_000) assert.equal(formatDate(thisYear), 'Jan 1');
  assert.equal(formatDate(new Date(now.getFullYear() - 1, 8, 27, 12)), `Sep 27, ${now.getFullYear() - 1}`);
  assert.doesNotMatch(formatDate(new Date(now.getFullYear() - 1, 8, 27, 12)), /\//);
  assert.equal(mod.getStageBadgeLabel('interviewed'), 'Interview');
  assert.equal(mod.getStageBadgeLabel('offers'), 'Offer');
});

// 2026-10-16 persona review: "Yesterday" and "3 days ago" beside "Sep 27" was two styles on one list.
test('after yesterday, a card date is a calendar date', async () => {
  const now = new Date();
  const threeDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 12);
  assert.doesNotMatch(formatDate(threeDaysAgo), /ago/);
  assert.match(formatDate(threeDaysAgo), /^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/);
});

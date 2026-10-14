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

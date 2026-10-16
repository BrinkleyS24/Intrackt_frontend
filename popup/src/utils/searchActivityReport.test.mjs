import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivityRows,
  filterRowsByRange,
  summarizeRows,
  weeklyActivity,
} from './searchActivityReport.mjs';

const email = (overrides = {}) => ({
  id: `e-${Math.random()}`,
  date: '2026-06-03T12:00:00Z',
  company_name: 'Acme Corp',
  position: 'Content Manager',
  thread_id: 't-1',
  ...overrides,
});

test('groups a thread across categories into one row with latest status', () => {
  const rows = buildActivityRows({
    applied: [email({ date: '2026-06-03T12:00:00Z' })],
    interviewed: [email({ date: '2026-06-10T12:00:00Z' })],
    offers: [],
    rejected: [email({ date: '2026-06-20T12:00:00Z' })],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestStatusLabel, 'Rejected');
  assert.equal(rows[0].everInterviewed, true);
  assert.equal(rows[0].appliedDate.toISOString().slice(0, 10), '2026-06-03');
});

test('separates different applications by thread and by company+position', () => {
  const rows = buildActivityRows({
    applied: [
      email({ thread_id: 't-1' }),
      email({ thread_id: 't-2', company_name: 'Northwind', position: 'QA Analyst' }),
      email({ thread_id: null, id: 'x1', company_name: 'Contoso', position: 'Ops' }),
      email({ thread_id: null, id: 'x2', company_name: 'Contoso', position: 'Ops' }),
    ],
    interviewed: [], offers: [], rejected: [],
  });
  assert.equal(rows.length, 3);
});

test('applicationId beats thread as the grouping key', () => {
  const rows = buildActivityRows({
    applied: [email({ thread_id: 't-1', applicationId: 'a-9' })],
    rejected: [email({ thread_id: 't-99', applicationId: 'a-9', date: '2026-06-21T09:00:00Z' })],
    interviewed: [], offers: [],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestStatusLabel, 'Rejected');
});

test('rows with no dated email are excluded (counts stay a floor)', () => {
  const rows = buildActivityRows({
    applied: [email({ date: null })],
    interviewed: [], offers: [], rejected: [],
  });
  assert.equal(rows.length, 0);
});

test('filterRowsByRange is inclusive at day granularity', () => {
  const rows = buildActivityRows({
    applied: [
      email({ thread_id: 'a', date: '2026-06-01T23:30:00' }),
      email({ thread_id: 'b', date: '2026-06-15T00:10:00' }),
      email({ thread_id: 'c', date: '2026-07-02T10:00:00' }),
    ],
    interviewed: [], offers: [], rejected: [],
  });
  const filtered = filterRowsByRange(rows, new Date('2026-06-01T12:00:00'), new Date('2026-06-30T12:00:00'));
  assert.equal(filtered.length, 2);
});

test('summarizeRows counts interviews ever reached and latest statuses', () => {
  const rows = buildActivityRows({
    applied: [
      email({ thread_id: 'a' }),
      email({ thread_id: 'b', date: '2026-06-04T12:00:00Z' }),
    ],
    interviewed: [email({ thread_id: 'b', date: '2026-06-09T12:00:00Z' })],
    offers: [],
    rejected: [],
  });
  const summary = summarizeRows(rows);
  assert.deepEqual(summary, {
    applications: 2,
    interviews: 1,
    offers: 0,
    rejections: 0,
    awaitingReply: 1,
    now: { applied: 1, interviewed: 1, offers: 0, closed: 0, closedByYou: 0 },
  });
});

test('weekly buckets do not drift across a DST change (Mar 2026)', () => {
  const rows = buildActivityRows({
    applied: [email({ thread_id: 'a', date: '2026-03-10T12:00:00' })],
    interviewed: [], offers: [], rejected: [],
  });
  const weeks = weeklyActivity(rows, new Date('2026-03-01T00:00:00'), new Date('2026-03-28T00:00:00'));
  assert.deepEqual(weeks.map((w) => w.label), [
    'Mar 1 - Mar 7',
    'Mar 8 - Mar 14',
    'Mar 15 - Mar 21',
    'Mar 22 - Mar 28',
  ]);
  assert.equal(weeks[1].count, 1);
});

test('weeklyActivity buckets anchored at the chosen start date', () => {
  const rows = buildActivityRows({
    applied: [
      email({ thread_id: 'a', date: '2026-06-02T12:00:00' }),
      email({ thread_id: 'b', date: '2026-06-05T12:00:00' }),
      email({ thread_id: 'c', date: '2026-06-09T12:00:00' }),
    ],
    interviewed: [], offers: [], rejected: [],
  });
  const weeks = weeklyActivity(rows, new Date('2026-06-01T00:00:00'), new Date('2026-06-14T00:00:00'));
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].count, 2);
  assert.equal(weeks[1].count, 1);
  assert.match(weeks[0].label, /Jun 1 - Jun 7/);
});

// 2026-10-14 persona report: a manual application dated 10/14 was missing from
// a 9/15-10/14 report ("0 applications").
const manualApp = (overrides = {}) => ({
  id: 'm-1',
  normalized_company_name: 'Cedar Health',
  position: 'Operations Coordinator',
  current_status: 'applied',
  user_closed_at: null,
  application_source: 'manual',
  manual_applied_at: '2026-10-14T12:00:00Z',
  first_email_date: '2026-10-14T12:00:00Z',
  ...overrides,
});

test('manual applications are included in the report on the day the user picked', () => {
  const rows = buildActivityRows({ applied: [], interviewed: [], offers: [], rejected: [] }, [manualApp()]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, 'Cedar Health');
  assert.equal(rows[0].source, 'manual');
  assert.equal(rows[0].latestStatusLabel, 'Awaiting reply');
  const inRange = filterRowsByRange(rows, new Date(2026, 8, 15), new Date(2026, 9, 14));
  assert.equal(summarizeRows(inRange).applications, 1);
  assert.equal(summarizeRows(inRange).awaitingReply, 1);
});

test('a manual application linked to emails is counted once, with the earlier applied day', () => {
  const rows = buildActivityRows({
    applied: [email({ applicationId: 'm-1', date: '2026-10-16T12:00:00Z' })],
    interviewed: [], offers: [], rejected: [],
  }, [manualApp()]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'email');
  assert.equal(rows[0].appliedDate.getDate(), 14);
});

test('manual statuses map to report categories; closed-by-user is not a rejection', () => {
  const rows = buildActivityRows({}, [
    manualApp({ id: 'a', current_status: 'offered' }),
    manualApp({ id: 'b', current_status: 'rejected' }),
    manualApp({ id: 'c', user_closed_at: '2026-10-15T00:00:00Z' }),
  ]);
  const summary = summarizeRows(rows);
  assert.equal(summary.applications, 3);
  assert.equal(summary.offers, 1);
  assert.equal(summary.rejections, 1);
  assert.equal(rows.find((r) => r.latestCategory === 'closed').latestStatusLabel, 'Closed');
});

test('naive UTC email dates are read as UTC, not local time', () => {
  const rows = buildActivityRows({
    applied: [email({ date: '2026-10-14 23:30:00' })],
    interviewed: [], offers: [], rejected: [],
  });
  assert.equal(rows[0].appliedDate.toISOString(), '2026-10-14T23:30:00.000Z');
});

// 2026-10-15 persona report: the report said "2 interviews · 1 rejection" while the tiles read
// 1 in interviews / 2 closed, and nothing said why. With the popup's own stage rules injected, the
// report's "now" counts are the tiles' counts, and "reached an interview" is labelled as ever.
test('with the popup stage rules, "now" counts match the tiles and the counting rule is stated', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const src = readFileSync(fileURLToPath(new URL('../../../shared/applicationDisplayState.js', import.meta.url)), 'utf8');
  const rules = await import(`data:text/javascript,${encodeURIComponent(src)}`);
  const { REPORT_COUNTING_RULE } = await import('./searchActivityReport.mjs');
  const rows = buildActivityRows({
    applied: [
      email({ thread_id: 'r', applicationId: 1, date: '2026-06-01T12:00:00Z' }),
      // Closed for no response: a Closed tile entry, not a rejection email.
      email({ thread_id: 's', applicationId: 2, applicationStatus: 'applied', isClosed: true, isUserClosed: true, manualCloseKind: 'silence', date: '2026-06-02T12:00:00Z' }),
      email({ thread_id: 'i', applicationId: 3, date: '2026-06-03T12:00:00Z' }),
    ],
    interviewed: [
      email({ thread_id: 'r', applicationId: 1, date: '2026-06-05T12:00:00Z' }),
      email({ thread_id: 'i', applicationId: 3, applicationStatus: 'interviewed', date: '2026-06-06T12:00:00Z' }),
    ],
    offers: [],
    rejected: [email({ thread_id: 'r', applicationId: 1, applicationStatus: 'rejected', date: '2026-06-09T12:00:00Z' })],
  }, [], rules);
  const summary = summarizeRows(rows);
  assert.equal(summary.applications, 3);
  assert.equal(summary.interviews, 2, 'reached an interview (ever)');
  assert.deepEqual(summary.now, { applied: 0, interviewed: 1, offers: 0, closed: 2, closedByYou: 0 });
  assert.deepEqual(rows.map((row) => row.latestStatusLabel), ['Rejected', 'Closed', 'In interviews']);
  assert.match(REPORT_COUNTING_RULE, /Reached an interview/);
  assert.match(REPORT_COUNTING_RULE, /same way as the Applendium extension's tiles/);
});

test('a range longer than the chart charts its most recent weeks, not its first ones', () => {
  const rows = buildActivityRows({
    applied: [email({ thread_id: 'late', date: '2026-08-03T12:00:00Z' })],
    interviewed: [], offers: [], rejected: [],
  });
  const weeks = weeklyActivity(rows, new Date('2025-01-01T00:00:00'), new Date('2026-10-15T00:00:00'));
  assert.equal(weeks.length, 27);
  assert.equal(weeks.reduce((sum, week) => sum + week.count, 0), 1);
  assert.match(weeks[weeks.length - 1].label, /Oct 15$/);
});

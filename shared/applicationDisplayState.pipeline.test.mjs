// Unit tests for the pipeline (one-card-per-role) helpers.
//
// The extension has no unit-test runner, and applicationDisplayState.js is an
// ESM `.js` in a CommonJS package, so Node won't import it directly. It has zero
// imports, though, so we load it through a data: URL (always parsed as ESM) and
// exercise the pure functions with the built-in `node --test` runner:
//
//   node --test shared/applicationDisplayState.pipeline.test.mjs
//
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'applicationDisplayState.js'), 'utf8');
const mod = await import('data:text/javascript,' + encodeURIComponent(src));
const {
  derivePipelineStatus,
  deriveGroupPipelineStatus,
  mergeGroupsByApplication,
  PIPELINE_STATUS_RANK,
} = mod;

// Mirror of popup getApplicationKey (app_id > company+position > thread > email).
const norm = (v) => (v || '').toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
function getApplicationKey(email) {
  if (!email) return 'unknown';
  const appId = (email.application_id || email.applicationId || '').toString().trim();
  if (appId) return `app_${appId}`;
  const company = norm(email.company_name || email.company);
  const position = norm(email.position || email.job_title);
  if (company && position) return `cp_${company}_${position}`;
  const threadId = (email.thread_id || email.threadId || '').toString().trim();
  if (threadId) return `thread_${threadId}`;
  const id = (email.id || '').toString().trim();
  if (id) return `email_${id}`;
  return 'unknown';
}

test('derivePipelineStatus: manual "rejected verbally" counts as a rejection', () => {
  // Applied-category email whose application is still "applied" but was closed as
  // a verbal rejection -> belongs in Rejected.
  assert.equal(
    derivePipelineStatus({ category: 'Applied', applicationStatus: 'applied', isUserRejected: true }),
    'rejected',
  );
});

test('derivePipelineStatus: neutral close (no response) keeps its active stage', () => {
  // isUserClosed but NOT a rejection -> stays Applied (dimmed in place elsewhere).
  assert.equal(
    derivePipelineStatus({ category: 'Applied', applicationStatus: 'applied', isUserClosed: true, isClosed: true }),
    'applied',
  );
});

test('derivePipelineStatus: role status wins over the email\'s own category', () => {
  // The application-confirmation email of a role that reached interview belongs
  // in Interviewed, not Applied.
  assert.equal(
    derivePipelineStatus({ category: 'Applied', applicationStatus: 'interviewed' }),
    'interviewed',
  );
});

test('derivePipelineStatus: unlinked email falls back to its own category', () => {
  assert.equal(derivePipelineStatus({ category: 'Rejected', applicationStatus: null }), 'rejected');
  assert.equal(derivePipelineStatus({ category: 'Offers' }), 'offers');
  assert.equal(derivePipelineStatus({ category: 'weird-unknown' }), 'applied');
});

test('deriveGroupPipelineStatus: terminal outcome wins across a role\'s emails', () => {
  // applied thread + rejection thread -> the role is Rejected.
  assert.equal(
    deriveGroupPipelineStatus([
      { category: 'Applied', applicationStatus: 'applied' },
      { category: 'Rejected', applicationStatus: 'rejected' },
    ]),
    'rejected',
  );
  // offer beats a stray rejection.
  assert.equal(
    deriveGroupPipelineStatus([
      { category: 'Rejected', applicationStatus: 'rejected' },
      { category: 'Offers', applicationStatus: 'offers' },
    ]),
    'offers',
  );
  // active role: applied + interviewed -> Interviewed (furthest active).
  assert.equal(
    deriveGroupPipelineStatus([
      { category: 'Applied', applicationStatus: 'interviewed' },
      { category: 'Interviewed', applicationStatus: 'interviewed' },
    ]),
    'interviewed',
  );
});

test('PIPELINE_STATUS_RANK orders offers > rejected > interviewed > applied', () => {
  assert.ok(PIPELINE_STATUS_RANK.offers > PIPELINE_STATUS_RANK.rejected);
  assert.ok(PIPELINE_STATUS_RANK.rejected > PIPELINE_STATUS_RANK.interviewed);
  assert.ok(PIPELINE_STATUS_RANK.interviewed > PIPELINE_STATUS_RANK.applied);
});

test('mergeGroupsByApplication: collapses two threads of one linked role into one card', () => {
  const appliedThread = {
    id: 'thread-t1', threadId: 't1', subject: 'Application received',
    emails: [{ id: 1, application_id: 'A1', category: 'Applied', subject: 'Application received', date: '2026-01-01', is_read: true }],
    latestEmail: { id: 1, subject: 'Application received', date: '2026-01-01' },
  };
  const rejectionThread = {
    id: 'thread-t2', threadId: 't2', subject: 'Update on your application',
    emails: [{ id: 2, application_id: 'A1', category: 'Rejected', subject: 'Update on your application', date: '2026-01-10', is_read: false }],
    latestEmail: { id: 2, subject: 'Update on your application', date: '2026-01-10' },
  };
  const merged = mergeGroupsByApplication([appliedThread, rejectionThread], getApplicationKey);
  assert.equal(merged.length, 1, 'two threads of application A1 collapse to one card');
  assert.equal(merged[0].emails.length, 2);
  assert.equal(merged[0].messageCount, 2);
  assert.equal(merged[0].unreadCount, 1);
  assert.equal(merged[0].subject, 'Update on your application', 'representative = latest email');
  assert.equal(deriveGroupPipelineStatus(merged[0].emails), 'rejected');
});

test('mergeGroupsByApplication: never merges unlinked (thread-only) roles', () => {
  const a = { id: 'thread-x', threadId: 'x', emails: [{ id: 1, thread_id: 'x', category: 'Applied', date: '2026-01-01' }] };
  const b = { id: 'thread-y', threadId: 'y', emails: [{ id: 2, thread_id: 'y', category: 'Applied', date: '2026-01-02' }] };
  const merged = mergeGroupsByApplication([a, b], getApplicationKey);
  assert.equal(merged.length, 2, 'distinct threads with no app link stay separate');
});

test('mergeGroupsByApplication: passes a single group through untouched', () => {
  const only = { id: 'thread-t1', threadId: 't1', emails: [{ id: 1, application_id: 'A1', category: 'Applied', date: '2026-01-01' }] };
  const merged = mergeGroupsByApplication([only], getApplicationKey);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].threadId, 't1', 'unmerged group keeps its original threadId');
});

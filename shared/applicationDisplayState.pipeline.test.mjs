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
  deriveGroupClosedByChoice,
  mergeGroupsByApplication,
  classifyManualCloseKind,
  deriveManualPipelineState,
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
  assert.equal(
    derivePipelineStatus({ category: 'Applied', applicationStatus: 'applied', isUserRejected: true }),
    'rejected',
  );
});

test('derivePipelineStatus: a silence close-out displays as a rejection', () => {
  // "No response" / ghosted / DAQ close-outs = rejected in silence -> Rejected tab.
  assert.equal(
    derivePipelineStatus({
      category: 'Applied', applicationStatus: 'applied',
      isUserClosed: true, isClosed: true, manualCloseKind: 'silence',
    }),
    'rejected',
  );
});

test('derivePipelineStatus: a user-choice close keeps its stage (routes to Closed sub-filter)', () => {
  // Withdrew / accepted elsewhere: not a rejection, not active; tab stays,
  // visibility is handled by deriveGroupClosedByChoice.
  assert.equal(
    derivePipelineStatus({
      category: 'Interviewed', applicationStatus: 'interviewed',
      isUserClosed: true, isClosed: true, manualCloseKind: 'user_choice',
    }),
    'interviewed',
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

test('deriveGroupPipelineStatus: a terminal update pulls the role out of the active tabs', () => {
  // applied thread + rejection thread -> the role is Rejected.
  assert.equal(
    deriveGroupPipelineStatus([
      { category: 'Applied', applicationStatus: 'applied', date: '2026-01-01' },
      { category: 'Rejected', applicationStatus: 'rejected', date: '2026-01-10' },
    ]),
    'rejected',
  );
});

test('deriveGroupPipelineStatus: between offer and rejection, the NEWER update wins', () => {
  // Offer then rescinded -> Rejected.
  assert.equal(
    deriveGroupPipelineStatus([
      { category: 'Offers', applicationStatus: null, date: '2026-01-05' },
      { category: 'Rejected', applicationStatus: null, date: '2026-01-12' },
    ]),
    'rejected',
  );
  // Rejection then a re-offer -> Offers.
  assert.equal(
    deriveGroupPipelineStatus([
      { category: 'Rejected', applicationStatus: null, date: '2026-01-05' },
      { category: 'Offers', applicationStatus: null, date: '2026-01-12' },
    ]),
    'offers',
  );
});

test('deriveGroupPipelineStatus: stage never regresses on a late lower-stage email', () => {
  // Interview invite, then a late automated "thanks for applying" -> stays Interviewed.
  assert.equal(
    deriveGroupPipelineStatus([
      { category: 'Interviewed', applicationStatus: null, date: '2026-01-05' },
      { category: 'Applied', applicationStatus: null, date: '2026-01-09' },
    ]),
    'interviewed',
  );
});

test('deriveGroupClosedByChoice: flags withdrew/accepted-elsewhere roles, not silence closes', () => {
  assert.equal(
    deriveGroupClosedByChoice([{ category: 'Applied', manualCloseKind: 'user_choice' }]),
    true,
  );
  assert.equal(
    deriveGroupClosedByChoice([{ category: 'Applied', manualCloseKind: 'silence' }]),
    false,
  );
  assert.equal(deriveGroupClosedByChoice([{ category: 'Applied' }]), false);
});

test('classifyManualCloseKind mirror matches the backend taxonomy', () => {
  assert.equal(classifyManualCloseKind('Rejected verbally'), 'rejection');
  assert.equal(classifyManualCloseKind('Position filled'), 'rejection');
  assert.equal(classifyManualCloseKind(''), 'rejection');
  assert.equal(classifyManualCloseKind('No response'), 'silence');
  assert.equal(classifyManualCloseKind('Closed from Daily Action Queue ghosting signal: Move SDET out of active focus'), 'silence');
  assert.equal(classifyManualCloseKind('Withdrew - took another role'), 'user_choice');
  assert.equal(classifyManualCloseKind('Accepted elsewhere'), 'user_choice');
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

// 2026-10-14 persona report: Atlas showed a CLOSED badge but was counted under Applied and was
// missing from the Closed tile. A closed role with no close kind now lands in Closed.
test('a closed role without a close kind is counted under Closed, matching its badge', () => {
  const userClosedNoReason = { applicationId: 9002, category: 'applied', applicationStatus: 'applied', isClosed: true, isUserClosed: true };
  assert.equal(derivePipelineStatus(userClosedNoReason), 'rejected');
  const systemClosed = { applicationId: 9004, category: 'interviewed', applicationStatus: 'interviewed', isClosed: true, isUserClosed: false };
  assert.equal(derivePipelineStatus(systemClosed), 'rejected');
  // Candidate choices (withdrew / accepted elsewhere) are not rejections: they keep their stage.
  const acceptedElsewhere = { applicationId: 9005, category: 'interviewed', applicationStatus: 'interviewed', isClosed: true, isUserClosed: true, manualCloseKind: classifyManualCloseKind('Accepted elsewhere') };
  assert.equal(acceptedElsewhere.manualCloseKind, 'user_choice');
  assert.equal(derivePipelineStatus(acceptedElsewhere), 'interviewed');
  assert.equal(deriveGroupClosedByChoice([acceptedElsewhere]), true);
  // An offer stays an offer even though the backend marks it closed.
  assert.equal(derivePipelineStatus({ applicationId: 1, applicationStatus: 'offers', isClosed: true }), 'offers');
  // Unlinked mail is never treated as closed.
  assert.equal(derivePipelineStatus({ category: 'applied', isClosed: true }), 'applied');
});

// 2026-10-15 persona report: a manual application could not be moved, and every close counted as
// the user's own choice. Manual closes now follow the email cards' rules.
test('a closed manual application lands where an email card with the same close would', () => {
  const base = { id: 1, current_status: 'applied', is_closed: false, user_closed_at: null, user_closed_reason: null };
  assert.deepEqual(deriveManualPipelineState(base), { pipelineStatus: 'applied', closedByChoice: false, closeKind: null });
  const closed = (reason) => deriveManualPipelineState({ ...base, user_closed_at: '2026-10-15T12:00:00Z', user_closed_reason: reason });
  assert.equal(closed('Rejected verbally').pipelineStatus, 'rejected');
  assert.equal(closed('No response').pipelineStatus, 'rejected');
  assert.equal(closed('No response').closeKind, 'silence');
  assert.deepEqual(closed('Withdrew'), { pipelineStatus: 'applied', closedByChoice: true, closeKind: 'user_choice' });
  assert.equal(deriveManualPipelineState({ ...base, current_status: 'offered' }).pipelineStatus, 'offers');
  assert.equal(deriveManualPipelineState({ ...base, current_status: 'interviewed' }).pipelineStatus, 'interviewed');
});

// Unit tests for the popup's Apply Gate helpers.
//
// Same loading trick as applicationDisplayState.pipeline.test.mjs: applyGateCheck.js is an ESM
// `.js` in a CommonJS package with zero imports, so it is loaded through a data: URL.
//
//   node --test shared/applyGateCheck.test.mjs
//
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'applyGateCheck.js'), 'utf8');
const {
  summarizeApplyGateResult,
  describeRecordedAction,
  DECISION_QUESTION,
  samePostingUrl,
  describeNextFreeCheck,
  describeCheckedResume,
  scopedCachedCheck,
  createCheckCoordinator,
} = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const displayResult = (action, overrides = {}) => ({
  success: true,
  id: 'verdict-1',
  verdict: 'risky',
  reasons: ['Fix the headline', 'Add Playwright proof', 'Name the CI tool', 'A fourth reason'],
  explanation: {
    display_decision: { action, headline: `Headline for ${action}`, subtext: 'Why, in one line.' },
    decision: 'fix_first',
  },
  resumeDocument: { variantId: 'v1', source: 'default', fingerprint: 'abc', characters: 2400 },
  ...overrides,
});

test('the popup shows the same call and buttons the web page shows', () => {
  const summary = summarizeApplyGateResult(displayResult('FIX_THEN_APPLY'));
  assert.equal(summary.kind, 'verdict');
  assert.equal(summary.decision.label, 'Fix first');
  assert.equal(summary.headline, 'Headline for FIX_THEN_APPLY');
  assert.equal(summary.subtext, 'Why, in one line.');
  assert.deepEqual(summary.actions.map((a) => a.label), ['Fixing resume first', 'Applying anyway', 'Not applying']);
  assert.equal(summary.reasons.length, 3, 'a popup holds three reasons, not a wall');
  assert.equal(summary.usedDefaultResume, true);

  assert.deepEqual(summarizeApplyGateResult(displayResult('SKIP')).actions.map((a) => a.label), ['Not applying', 'Applying anyway']);
  assert.deepEqual(summarizeApplyGateResult(displayResult('APPLY')).actions.map((a) => a.label), ["I'm applying", 'Not applying']);
});

test('a reason that repeats the subtext is not shown twice', () => {
  const summary = summarizeApplyGateResult(displayResult('APPLY', { reasons: ['Why, in one line.', 'Something else'] }));
  assert.deepEqual(summary.reasons, ['Something else']);
});

test('an older response with no display decision falls back to the stored decision', () => {
  const summary = summarizeApplyGateResult({ verdict: 'not_recommended', reasons: [], explanation: {} });
  assert.equal(summary.decision.label, 'Skip');
  assert.equal(summary.headline, 'Skip');
});

test('no resume means asking for one, never a made-up call', () => {
  const summary = summarizeApplyGateResult({ insufficientProfile: true, insufficientProfileMessage: 'Add your resume first.' });
  assert.deepEqual(summary, { kind: 'needs_resume', message: 'Add your resume first.' });
  assert.equal(summarizeApplyGateResult({ success: true, reasons: [] }).kind, 'unavailable');
  assert.equal(summarizeApplyGateResult(null), null);
});

test('recorded decisions say what happens next', () => {
  assert.match(describeRecordedAction('applied'), /match the reply from your inbox/);
  assert.match(describeRecordedAction('skipped'), /not applying/);
});

test('resume attribution comes from the recorded source, never a guessed default', () => {
  for (const source of ['chosen', 'legacy', 'seeded_from_legacy', null]) {
    const summary = summarizeApplyGateResult(displayResult('APPLY', { resumeDocument: { source, variantId: 'v1' } }));
    assert.equal(summary.usedDefaultResume, false);
    assert.doesNotMatch(describeCheckedResume(summary), /default resume/);
  }
  const stored = summarizeApplyGateResult(displayResult('APPLY', {
    resumeDocument: null,
    explanation: { resume_document: { source: 'legacy', variantId: null } },
  }));
  assert.match(describeCheckedResume(stored), /saved on your profile/);
  assert.match(describeCheckedResume({ usedDefaultResume: true }), /not identified/);
  assert.match(describeCheckedResume(summarizeApplyGateResult(displayResult('APPLY'))), /default resume at the time/);
});

test('a missing default asks for a choice without inventing a verdict', () => {
  const summary = summarizeApplyGateResult({ insufficientProfile: true, resumeSelectionRequired: true,
    insufficientProfileMessage: 'Choose a resume. This check was not used.' });
  assert.equal(summary.kind, 'needs_resume_selection');
  assert.equal(summary.message, 'Choose a resume. This check was not used.');
  assert.equal(summary.decision, undefined);
});

test('the same posting is recognised through tracking parameters, a different job is not', () => {
  assert.equal(samePostingUrl('https://boards.greenhouse.io/acme/jobs/123?gh_src=abc#app', 'https://boards.greenhouse.io/acme/jobs/123'), true);
  assert.equal(samePostingUrl('https://www.linkedin.com/jobs/view/1?trk=x&refId=y', 'https://www.linkedin.com/jobs/view/1/'), true);
  assert.equal(samePostingUrl('https://www.linkedin.com/jobs/search/?currentJobId=1', 'https://www.linkedin.com/jobs/search/?currentJobId=2'), false);
  assert.equal(samePostingUrl('', ''), false);
});

test("says when the next free check opens in words, not a timestamp", () => {
  const now = new Date(2026, 8, 26, 10, 0);
  assert.equal(describeNextFreeCheck(new Date(2026, 8, 26, 18, 0).toISOString(), now), "later today");
  assert.equal(describeNextFreeCheck(new Date(2026, 8, 27, 9, 0).toISOString(), now), "tomorrow");
  assert.match(describeNextFreeCheck(new Date(2026, 9, 1, 9, 0).toISOString(), now), /Oct 1/);
  assert.equal(describeNextFreeCheck(null, now), "next week");
});

test('cached checks are isolated by account and become stale when the document changes', () => {
  const doc = { variantId: 'v1', fingerprint: 'abc123def456' };
  const cached = { accountId: 'u1', url: 'https://example.com/jobs/1', at: 1000, summary: { kind: 'verdict', resumeDocument: doc } };
  const context = { accountId: 'u1', url: cached.url, resumeDocument: doc, now: 2000 };
  assert.equal(scopedCachedCheck(cached, context).stale, false);
  assert.equal(scopedCachedCheck(cached, { ...context, accountId: 'u2' }), null);
  assert.equal(scopedCachedCheck({ ...cached, accountId: undefined }, context), null);
  for (const changed of [null, { ...doc, variantId: 'v2' }, { ...doc, fingerprint: 'edited' }]) {
    assert.equal(scopedCachedCheck(cached, { ...context, resumeDocument: changed }).stale, true);
  }
  assert.equal(scopedCachedCheck(cached, { ...context, now: 100000000 }), null);
  assert.equal(scopedCachedCheck(cached, { ...context, now: 500 }), null);
});

test('duplicate running checks share a call, failures release the slot, accounts remain separate', async () => {
  const run = createCheckCoordinator();
  let count = 0;
  let release;
  const task = () => { count++; return new Promise(resolve => { release = resolve; }); };
  const first = run('u1/job/v1', task);
  const second = run('u1/job/v1', task);
  await Promise.resolve();
  assert.equal(first, second);
  assert.equal(count, 1);
  assert.equal(await run('u2/job/v1', () => 'separate'), 'separate');
  release('done');
  assert.equal(await first, 'done');
  await assert.rejects(run('u1/job/v1', () => { throw new Error('timeout'); }), /timeout/);
  assert.equal(await run('u1/job/v1', () => 'retry'), 'retry');
});

test('the buttons read as answers to "Are you applying?", never as commands', () => {
  // "Apply now" on a posting read like a button that applies for you; nobody pressed it.
  for (const key of ['APPLY', 'APPLY_WITH_STRATEGY', 'FIX_THEN_APPLY', 'SKIP']) {
    const labels = summarizeApplyGateResult(displayResult(key)).actions.map((a) => a.label);
    for (const label of labels) assert.doesNotMatch(label, /^(Apply now|Apply anyway|Skip)/);
    assert.equal(labels.filter(Boolean).length, labels.length);
  }
  assert.match(DECISION_QUESTION, /^Are you applying\?/);
});

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
  samePostingUrl,
  describeNextFreeCheck,
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
  assert.deepEqual(summary.actions.map((a) => a.label), ["I'll fix first", 'Apply anyway', 'Skip role']);
  assert.equal(summary.reasons.length, 3, 'a popup holds three reasons, not a wall');
  assert.equal(summary.usedDefaultResume, true);

  assert.deepEqual(summarizeApplyGateResult(displayResult('SKIP')).actions.map((a) => a.label), ['Skip this role', 'Apply anyway']);
  assert.deepEqual(summarizeApplyGateResult(displayResult('APPLY')).actions.map((a) => a.label), ['Apply now', 'Skip anyway']);
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

test('no résumé means asking for one, never a made-up call', () => {
  const summary = summarizeApplyGateResult({ insufficientProfile: true, insufficientProfileMessage: 'Add your résumé first.' });
  assert.deepEqual(summary, { kind: 'needs_resume', message: 'Add your résumé first.' });
  assert.equal(summarizeApplyGateResult({ success: true, reasons: [] }).kind, 'unavailable');
  assert.equal(summarizeApplyGateResult(null), null);
});

test('recorded decisions say what happens next', () => {
  assert.match(describeRecordedAction('applied'), /match the reply from your inbox/);
  assert.match(describeRecordedAction('skipped'), /skipped/);
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

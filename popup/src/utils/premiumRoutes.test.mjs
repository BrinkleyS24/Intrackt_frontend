import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMovePath, premiumLinkPath } from './premiumRoutes.mjs';

test('a Premium member\'s "next move" opens Interview Prep or Next Actions, never pricing', () => {
  assert.equal(nextMovePath('interviewed'), '/interview-prep');
  assert.equal(nextMovePath('applied'), '/next-actions');
  for (const stage of ['interviewed', 'applied']) assert.doesNotMatch(nextMovePath(stage), /upgrade/);
});

test('only free users are sent to the pricing page', () => {
  assert.equal(premiumLinkPath('premium', 'ext_email_preview'), '/dashboard');
  assert.equal(premiumLinkPath('free', 'ext_email_preview'), '/upgrade?source=ext_email_preview');
  // A click event (not a source tag) is never forwarded into the URL.
  assert.equal(premiumLinkPath('free', { type: 'click' }), '/upgrade');
  assert.equal(premiumLinkPath(undefined, 'Bad Tag!'), '/upgrade');
});

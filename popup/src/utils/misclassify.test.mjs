import test from 'node:test';
import assert from 'node:assert/strict';
import { canSubmitMisclassify, currentMisclassifyStage, misclassifyStageLabel } from './misclassify.mjs';

test('the correction dialog starts on the email\'s current stage, not "Irrelevant"', () => {
  assert.equal(currentMisclassifyStage({ category: 'interviewed' }), 'interviewed');
  assert.equal(currentMisclassifyStage({ category: 'Interview' }), 'interviewed');
  assert.equal(currentMisclassifyStage({ category: 'offer' }), 'offers');
  assert.equal(currentMisclassifyStage({}), null);
  assert.equal(misclassifyStageLabel('interviewed'), 'Interview');
});

test('nothing is saved until the user picks a different stage', () => {
  // Opening the dialog and clicking save straight away cannot hide an interview email.
  assert.equal(canSubmitMisclassify('interviewed', 'interviewed'), false);
  assert.equal(canSubmitMisclassify('interviewed', ''), false);
  assert.equal(canSubmitMisclassify('interviewed', 'bogus'), false);
  assert.equal(canSubmitMisclassify('interviewed', 'irrelevant'), true);
  assert.equal(canSubmitMisclassify(null, 'applied'), true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePostingUrl } from './postingUrl.mjs';

test('adds https:// to a link typed without it', () => {
  assert.equal(normalizePostingUrl('lever.co/acme/123'), 'https://lever.co/acme/123');
  assert.equal(normalizePostingUrl('  jobs.example.com/posting?id=4 '), 'https://jobs.example.com/posting?id=4');
});

test('keeps a full link as it is', () => {
  assert.equal(normalizePostingUrl('https://boards.greenhouse.io/acme/jobs/1'), 'https://boards.greenhouse.io/acme/jobs/1');
});

test('an empty field is fine; text that is not an address is not', () => {
  assert.equal(normalizePostingUrl(''), '');
  assert.equal(normalizePostingUrl('acme'), null);
  assert.equal(normalizePostingUrl('not a link'), null);
  assert.equal(normalizePostingUrl('javascript://alert(1)'), null);
});

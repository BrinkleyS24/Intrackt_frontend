// Unit tests for the usage-event and uninstall-page helpers.
//
// Same loading trick as applyGateCheck.test.mjs: activity.js is an ESM `.js` in a CommonJS
// package with zero imports, so it is loaded through a data: URL.
//
//   node --test shared/activity.test.mjs
//
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'activity.js'), 'utf8');
const { activityUserKey, buildUninstallUrl, syncSource } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('the account key matches the backend (sha256 of the uid, first 16 hex characters)', async () => {
  const expected = createHash('sha256').update('firebase-uid-123').digest('hex').slice(0, 16);
  assert.equal(await activityUserKey('firebase-uid-123', webcrypto.subtle), expected);
});

test('no account, no key', async () => {
  assert.equal(await activityUserKey('', webcrypto.subtle), null);
  assert.equal(await activityUserKey(null, webcrypto.subtle), null);
});

test('the uninstall link carries the version, the sign-in flag and the key, and nothing else', () => {
  const url = new URL(buildUninstallUrl({ siteUrl: 'https://applendium.com', version: '2.1.7', userKey: '0123456789abcdef' }));
  assert.equal(url.origin + url.pathname, 'https://applendium.com/goodbye');
  assert.deepEqual(Object.fromEntries(url.searchParams), { v: '2.1.7', si: '1', uk: '0123456789abcdef' });
});

test('someone who never signed in gets the page without a key', () => {
  const url = new URL(buildUninstallUrl({ siteUrl: 'https://applendium.com/', version: '2.1.7', userKey: null }));
  assert.deepEqual(Object.fromEntries(url.searchParams), { v: '2.1.7', si: '0' });
  assert.ok(url.toString().length < 1023, 'Chrome rejects uninstall URLs over 1023 characters');
});

test('a sync is labelled by who started it; anything unrecognised counts as the popup', () => {
  assert.equal(syncSource('alarm'), 'alarm');
  assert.equal(syncSource('background'), 'background');
  assert.equal(syncSource('popup'), 'popup');
  assert.equal(syncSource(undefined), 'popup');
  assert.equal(syncSource('anything'), 'popup');
});

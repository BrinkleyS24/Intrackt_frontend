/**
 * @file shared/activity.js
 * @description Usage events and the uninstall page (ext 2.1.7, backend services/activityLog.js).
 *
 * The backend logs one line per sync and per popup open against a one-way account key, so the
 * founder can tell "installed but not opened" from "removed" in the first week. When the extension
 * is removed, Chrome opens applendium.com/goodbye with the version, whether someone was signed in,
 * and the same key, so an answer there can be matched to the usage lines (never to a name).
 *
 * No imports: background.js bundles it, and the unit test loads it through a data: URL.
 */

// Who started a sync. "alarm" is the 5-minute timer; "background" is a sync the extension starts
// itself on startup or sign-in; "popup" is anything the person did in the popup.
export const SYNC_SOURCES = Object.freeze(['alarm', 'background', 'popup']);

export function syncSource(source) {
  return SYNC_SOURCES.includes(source) ? source : 'popup';
}

/** sha256(uid) as hex, first 16 characters: the same key the backend computes (activityUserKey). */
export async function activityUserKey(userId, subtle = globalThis.crypto?.subtle) {
  if (!userId || !subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(String(userId)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** The page Chrome opens on removal. Chrome caps the URL at 1023 characters; this stays near 80. */
export function buildUninstallUrl({ siteUrl, version, userKey }) {
  const url = new URL('/goodbye', siteUrl);
  if (version) url.searchParams.set('v', String(version));
  url.searchParams.set('si', userKey ? '1' : '0');
  if (userKey) url.searchParams.set('uk', userKey);
  return url.toString();
}

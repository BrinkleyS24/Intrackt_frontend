/**
 * @file shared/bridgePaths.js
 * @description Single source of truth for the web <-> extension bridge surface:
 * which applendium.com origins and routes are allowed to talk to the extension
 * (request auth state, mint a web auth token, log out).
 *
 * background.js imports this module directly (it is bundled by Parcel).
 *
 * content.js is a classic content script copied verbatim into the build, so it
 * CANNOT import this module. It keeps an inline copy of the same path list, kept
 * honest by scripts/check_bridge_paths_parity.mjs (run via `npm run check:bridge-paths`).
 * If you change BRIDGE_PATHS here, update the inline list in content.js to match —
 * the parity check will fail the build/CI otherwise.
 */

export const BRIDGE_TRUSTED_ORIGINS = [
  'https://applendium.com',
  'https://www.applendium.com',
];

// Base route prefixes the bridge is allowed on. A path matches if it equals the
// base exactly or starts with `${base}/` (so "/app" and "/app/anything" match,
// but "/applesauce" does not).
export const BRIDGE_PATHS = [
  '/app',
  '/dashboard',
  '/upgrade',
  '/apply-gate',
  '/fix-suggestions',
  '/outcome-memory',
  '/strategy-alerts',
  '/weekly-summary',
  '/settings',
  '/admin',
];

export function isAllowedBridgePath(pathname) {
  const path = typeof pathname === 'string' ? pathname : '';
  return BRIDGE_PATHS.some((base) => path === base || path.startsWith(`${base}/`));
}

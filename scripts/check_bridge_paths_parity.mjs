/**
 * @file scripts/check_bridge_paths_parity.mjs
 * @description Guards against drift between the canonical bridge path allowlist
 * (shared/bridgePaths.js, used by background.js) and the inline copy in content.js
 * (a classic content script that cannot import the shared module).
 *
 * A mismatch is a real security/correctness risk: if the two diverge, the bridge
 * either silently breaks on a route or hands the auth token to a wider surface
 * than intended. Run via `npm run check:bridge-paths` (wire into build/CI).
 *
 * Exits 0 if the lists match, 1 otherwise.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.resolve(scriptDir, '..', 'content.js');
const sharedPath = path.resolve(scriptDir, '..', 'shared', 'bridgePaths.js');

// Parse both files textually rather than importing shared/bridgePaths.js: the
// package has no "type":"module", so a .mjs script can't reliably import a .js
// ES module. Textual parsing also keeps this guard symmetric for both files.
function extractContentBridgePaths(source) {
  const fnMatch = source.match(/function isAllowedBridgePath[\s\S]*?\n}/);
  const body = fnMatch ? fnMatch[0] : source;
  const literals = [...body.matchAll(/["'](\/[a-zA-Z0-9_-]+)\/?["']/g)].map((m) => m[1]);
  return [...new Set(literals)].sort();
}

function extractCanonicalBridgePaths(source) {
  const arrMatch = source.match(/BRIDGE_PATHS\s*=\s*\[([\s\S]*?)\]/);
  if (!arrMatch) return [];
  const literals = [...arrMatch[1].matchAll(/["'](\/[a-zA-Z0-9_-]+)\/?["']/g)].map((m) => m[1]);
  return [...new Set(literals)].sort();
}

function main() {
  for (const [label, p] of [['content.js', contentPath], ['shared/bridgePaths.js', sharedPath]]) {
    if (!fs.existsSync(p)) {
      console.error(`[bridge-paths] ${label} not found at ${p}`);
      process.exit(1);
    }
  }

  const canonical = extractCanonicalBridgePaths(fs.readFileSync(sharedPath, 'utf8'));
  if (canonical.length === 0) {
    console.error('[bridge-paths] Could not parse BRIDGE_PATHS from shared/bridgePaths.js');
    process.exit(1);
  }
  const fromContent = extractContentBridgePaths(fs.readFileSync(contentPath, 'utf8'));

  const missingInContent = canonical.filter((p) => !fromContent.includes(p));
  const extraInContent = fromContent.filter((p) => !canonical.includes(p));

  if (missingInContent.length === 0 && extraInContent.length === 0) {
    console.log(`[bridge-paths] OK — content.js matches shared/bridgePaths.js (${canonical.length} paths).`);
    process.exit(0);
  }

  console.error('[bridge-paths] MISMATCH between content.js and shared/bridgePaths.js:');
  if (missingInContent.length) console.error(`  missing in content.js: ${missingInContent.join(', ')}`);
  if (extraInContent.length) console.error(`  extra in content.js (not canonical): ${extraInContent.join(', ')}`);
  console.error('  Update content.js isAllowedBridgePath to match shared/bridgePaths.js BRIDGE_PATHS.');
  process.exit(1);
}

main();

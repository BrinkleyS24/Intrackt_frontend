import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.resolve(projectRoot, process.env.DIST_DIR || 'popup/dist');

function readJson(relativePath) {
  const filePath = path.resolve(projectRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function containsLocalhost(value) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(String(value || ''));
}

function assertNoLocalhostEntries(entries, label) {
  for (const entry of entries || []) {
    assert(!containsLocalhost(entry), `${label} contains localhost-only entry: ${entry}`);
  }
}

function assertNoLocalhostInCsp(csp, label) {
  assert(!containsLocalhost(csp), `${label} contains localhost-only origins.`);
}

function assertFileMissing(filePath, label) {
  assert(!fs.existsSync(filePath), `${label} should not exist in the production bundle.`);
}

function assertFileExists(filePath, label) {
  assert(fs.existsSync(filePath), `${label} is missing.`);
}

const packageJson = readJson('package.json');
const devManifest = readJson('manifest.json');
const prodManifest = readJson('manifest.prod.json');
const builtManifestPath = path.join(distDir, 'manifest.json');

assert(packageJson.version === devManifest.version, `package.json version (${packageJson.version}) does not match manifest.json (${devManifest.version}).`);
assert(packageJson.version === prodManifest.version, `package.json version (${packageJson.version}) does not match manifest.prod.json (${prodManifest.version}).`);

assertNoLocalhostEntries(prodManifest.host_permissions, 'manifest.prod.json host_permissions');
assertNoLocalhostEntries((prodManifest.content_scripts || []).flatMap((item) => item.matches || []), 'manifest.prod.json content_scripts');
assertNoLocalhostInCsp(prodManifest.content_security_policy?.extension_pages || '', 'manifest.prod.json CSP');

assertFileExists(distDir, `Build output directory ${distDir}`);
assertFileExists(builtManifestPath, `Built manifest ${builtManifestPath}`);
assertFileMissing(path.join(distDir, 'testing', 'public', 'index.html'), 'Testing lab page');

const builtManifest = JSON.parse(fs.readFileSync(builtManifestPath, 'utf8'));

assert(builtManifest.version === prodManifest.version, `Built manifest version (${builtManifest.version}) does not match production manifest (${prodManifest.version}).`);
assertNoLocalhostEntries(builtManifest.host_permissions, 'built manifest host_permissions');
assertNoLocalhostEntries((builtManifest.content_scripts || []).flatMap((item) => item.matches || []), 'built manifest content_scripts');
assertNoLocalhostInCsp(builtManifest.content_security_policy?.extension_pages || '', 'built manifest CSP');

console.log('Production extension bundle verified successfully.');
console.log(`Version: ${builtManifest.version}`);
console.log(`Output: ${distDir}`);

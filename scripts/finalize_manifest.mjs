import fs from 'node:fs';
import path from 'node:path';
import { getExtensionConfigValue, normalizeExtensionConfigValue } from './lib/extensionEnv.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeManifestKey(rawValue) {
  const normalized = normalizeExtensionConfigValue(rawValue);
  if (!normalized) return '';

  const withoutPemMarkers = normalized
    .replace(/-----BEGIN PUBLIC KEY-----/gi, '')
    .replace(/-----END PUBLIC KEY-----/gi, '')
    .replace(/\s+/g, '');

  const remainder = withoutPemMarkers.length % 4;
  if (remainder === 1) {
    throw new Error('EXTENSION_MANIFEST_KEY is not valid base64. Recopy the public key from the Chrome Developer Dashboard.');
  }

  return remainder === 0
    ? withoutPemMarkers
    : `${withoutPemMarkers}${'='.repeat(4 - remainder)}`;
}

const [sourceManifestPath, destinationManifestPath] = process.argv.slice(2);

if (!sourceManifestPath || !destinationManifestPath) {
  throw new Error('Usage: node scripts/finalize_manifest.mjs <source-manifest> <destination-manifest>');
}

const sourcePath = path.resolve(process.cwd(), sourceManifestPath);
const destinationPath = path.resolve(process.cwd(), destinationManifestPath);
const buildTarget = normalizeExtensionConfigValue(process.env.EXTENSION_BUILD_TARGET) || 'local';
const manifest = readJson(sourcePath);
const manifestKey = normalizeManifestKey(getExtensionConfigValue('EXTENSION_MANIFEST_KEY', { buildTarget }));

if (manifestKey) {
  manifest.key = manifestKey;
} else {
  delete manifest.key;
}

fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
writeJson(destinationPath, manifest);

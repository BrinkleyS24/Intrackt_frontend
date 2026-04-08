import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const ENV_FILES = ['.env', '.env.local'];

function stripOuterQuotes(value) {
  if (value.length >= 2 && (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  )) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const parsed = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = stripOuterQuotes(line.slice(separatorIndex + 1).trim());
    parsed[key] = value;
  }

  return parsed;
}

let cachedExtensionEnv = null;

export function loadExtensionEnv() {
  if (cachedExtensionEnv) return cachedExtensionEnv;

  const envFromFiles = {};
  for (const relativeFilePath of ENV_FILES) {
    Object.assign(envFromFiles, parseEnvFile(path.join(projectRoot, relativeFilePath)));
  }

  cachedExtensionEnv = {
    ...envFromFiles,
    ...process.env,
  };

  return cachedExtensionEnv;
}

export function normalizeExtensionConfigValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getBuildTargetHint(distDir = '') {
  const normalized = String(distDir || '').replace(/\\/g, '/').toLowerCase();
  return normalized.endsWith('/dist_prod') || normalized.endsWith('dist_prod')
    ? 'production'
    : 'local';
}

export function getExtensionConfigValue(baseName, { buildTarget = 'local' } = {}) {
  const env = loadExtensionEnv();
  const candidates = buildTarget === 'production'
    ? [`${baseName}_PROD`, baseName]
    : [`${baseName}_LOCAL`, baseName];

  for (const candidate of candidates) {
    const normalized = normalizeExtensionConfigValue(env[candidate]);
    if (normalized) return normalized;
  }

  return '';
}

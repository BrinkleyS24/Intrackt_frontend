import {
  CONFIG,
  LOCAL_BACKEND_BASE_URL,
  PRODUCTION_BACKEND_BASE_URL,
} from './constants';

const BACKEND_KEY = 'backendBaseUrlOverride';
const PREMIUM_KEY = 'premiumDashboardUrlOverride';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function normalizeUrl(url) {
  const v = (url || '').toString().trim();
  return v.endsWith('/') ? v.slice(0, -1) : v;
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (_) {
    return null;
  }
}

function manifestAllowsUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) return false;

  const manifest = chrome.runtime.getManifest?.() || {};
  const hostPermissions = Array.isArray(manifest?.host_permissions) ? manifest.host_permissions : [];
  const extensionPageCsp = manifest?.content_security_policy?.extension_pages || '';
  const normalizedOrigin = parsed.origin.replace(/\/$/, '');
  const normalizedBaseUrl = normalizeUrl(parsed.href);

  const hostPermissionAllowed = hostPermissions.some((pattern) => {
    const normalizedPattern = String(pattern || '').trim();
    return (
      normalizedPattern === `${normalizedOrigin}/*` ||
      normalizedPattern === `${normalizedBaseUrl}/*` ||
      normalizedPattern.includes(normalizedOrigin)
    );
  });

  return hostPermissionAllowed && extensionPageCsp.includes(normalizedOrigin);
}

function isLocalUrl(url) {
  const parsed = parseUrl(url);
  return Boolean(parsed && LOCAL_HOSTS.has(parsed.hostname));
}

function isAllowedBackendBaseUrlOverride(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  if (!manifestAllowsUrl(normalized)) return false;
  if (isLocalUrl(normalized)) return true;

  return [
    normalizeUrl(PRODUCTION_BACKEND_BASE_URL),
    normalizeUrl(CONFIG?.ENDPOINTS?.BACKEND_BASE_URL),
  ].includes(normalized);
}

function isAllowedPremiumDashboardUrlOverride(url) {
  if (!url || typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol !== 'http:') return false;
  return LOCAL_HOSTS.has(parsed.hostname);
}

async function trySendToBackground(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (_) {
    return null;
  }
}

export function getBackendTarget(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return 'unknown';
  if (normalized === normalizeUrl(LOCAL_BACKEND_BASE_URL)) return 'local';
  if (normalized === normalizeUrl(PRODUCTION_BACKEND_BASE_URL)) return 'production';
  return 'custom';
}

export function getBackendTargetLabel(url) {
  const target = getBackendTarget(url);
  if (target === 'local') return 'Local';
  if (target === 'production') return 'Deployed';

  const parsed = parseUrl(url);
  return parsed?.host || 'Unknown';
}

function buildBackendRuntimeConfig(currentUrl, defaultUrl, overridden = false) {
  const normalizedCurrent = normalizeUrl(currentUrl);
  const normalizedDefault = normalizeUrl(defaultUrl) || normalizeUrl(CONFIG?.ENDPOINTS?.BACKEND_BASE_URL);
  const availableTargets = {
    local: isAllowedBackendBaseUrlOverride(LOCAL_BACKEND_BASE_URL),
    production: isAllowedBackendBaseUrlOverride(PRODUCTION_BACKEND_BASE_URL),
  };

  return {
    backendBaseUrl: normalizedCurrent,
    backendBaseUrlDefault: normalizedDefault,
    backendBaseUrlOverridden: Boolean(overridden),
    availableTargets,
    canShowSwitcher: availableTargets.local && availableTargets.production,
  };
}

export async function getBackendRuntimeConfig() {
  const buildInfo = await trySendToBackground({ type: 'GET_BUILD_INFO' });
  if (buildInfo?.success) {
    return buildBackendRuntimeConfig(
      buildInfo?.runtime?.backendBaseUrl,
      buildInfo?.runtime?.backendBaseUrlDefault,
      buildInfo?.runtime?.backendBaseUrlOverridden
    );
  }

  const backendResp = await trySendToBackground({ type: 'GET_BACKEND_BASE_URL' });
  const currentUrl = normalizeUrl(backendResp?.backendBaseUrl);
  if (backendResp?.success && currentUrl) {
    const defaultUrl = normalizeUrl(CONFIG?.ENDPOINTS?.BACKEND_BASE_URL);
    return buildBackendRuntimeConfig(currentUrl, defaultUrl, currentUrl !== defaultUrl);
  }

  try {
    const stored = await chrome.storage.local.get([BACKEND_KEY]);
    const currentStoredUrl = normalizeUrl(stored?.[BACKEND_KEY]) || normalizeUrl(CONFIG?.ENDPOINTS?.BACKEND_BASE_URL);
    const defaultUrl = normalizeUrl(CONFIG?.ENDPOINTS?.BACKEND_BASE_URL);
    return buildBackendRuntimeConfig(currentStoredUrl, defaultUrl, currentStoredUrl !== defaultUrl);
  } catch (_) {
    return buildBackendRuntimeConfig(CONFIG?.ENDPOINTS?.BACKEND_BASE_URL, CONFIG?.ENDPOINTS?.BACKEND_BASE_URL, false);
  }
}

export async function setBackendBaseUrl(url) {
  const normalized = url == null ? null : normalizeUrl(url);
  if (normalized && !isAllowedBackendBaseUrlOverride(normalized)) {
    throw new Error('That backend URL is not allowed by this extension build.');
  }

  const response = await trySendToBackground({
    type: 'SET_BACKEND_BASE_URL',
    backendBaseUrl: normalized,
  });

  if (response?.success) {
    return getBackendRuntimeConfig();
  }

  if (normalized == null) {
    await chrome.storage.local.remove([BACKEND_KEY]);
    return getBackendRuntimeConfig();
  }

  await chrome.storage.local.set({ [BACKEND_KEY]: normalized });
  return getBackendRuntimeConfig();
}

export async function switchBackendTarget(target) {
  if (target === 'local') {
    return setBackendBaseUrl(LOCAL_BACKEND_BASE_URL);
  }
  if (target === 'production') {
    return setBackendBaseUrl(PRODUCTION_BACKEND_BASE_URL);
  }
  throw new Error(`Unsupported backend target: ${String(target)}`);
}

export async function getPremiumDashboardUrl() {
  // 1) Background (preferred; future-proof if we ever move keys)
  const resp = await trySendToBackground({ type: 'GET_PREMIUM_DASHBOARD_URL' });
  const candidate = normalizeUrl(resp?.premiumDashboardUrl);
  if (resp?.success && candidate) return candidate;

  // 2) Direct storage fallback (works even if background script is an older build)
  try {
    const stored = await chrome.storage.local.get([PREMIUM_KEY]);
    const override = normalizeUrl(stored?.[PREMIUM_KEY]);
    if (override && isAllowedPremiumDashboardUrlOverride(override)) return override;
  } catch (_) {
    // ignore
  }

  // 3) Build-time default (Parcel env)
  const buildDefault = normalizeUrl(CONFIG?.PREMIUM_DASHBOARD_URL);
  return isAllowedPremiumDashboardUrlOverride(buildDefault) ? buildDefault : '';
}

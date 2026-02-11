import { CONFIG } from './constants';

const PREMIUM_KEY = 'premiumDashboardUrlOverride';

function normalizeUrl(url) {
  const v = (url || '').toString().trim();
  return v.endsWith('/') ? v.slice(0, -1) : v;
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
  const host = parsed.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]';
}

async function tryGetFromBackground(type) {
  try {
    const resp = await chrome.runtime.sendMessage({ type });
    return resp;
  } catch (_) {
    return null;
  }
}

export async function getPremiumDashboardUrl() {
  // 1) Background (preferred; future-proof if we ever move keys)
  const resp = await tryGetFromBackground('GET_PREMIUM_DASHBOARD_URL');
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

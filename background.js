/**
 * @file background.js
 * @description This script handles background tasks for the Applendium extension,
 * including email synchronization, user authentication, and misclassification reporting.
 * It operates as a service worker, listening for alarms and messages from the popup.
 */

// Import necessary Firebase modules.
import { initializeApp } from 'firebase/app';
// CORRECTED: Added setPersistence, indexedDBLocalPersistence for auth state persistence
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';

import { firebaseConfig } from './firebaseConfig';
import {
  deriveApplicationStatusFromLifecycle,
  deriveDisplayCategory,
  isTerminalApplicationStatus,
  normalizeApplicationStatusKey,
} from './shared/applicationDisplayState.js';

// Initialize Firebase App in the background script.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Constants ---
const SYNC_INTERVAL_MINUTES = 5; // How often to sync emails
const UNDO_TIMEOUT_MS = 10000; // 10 seconds for undo toast
// Watchdog to detect unusually long-running sync locks
const STUCK_LOCK_THRESHOLD_MIN = 15; // minutes a sync may run before considered stuck
const WATCHDOG_INTERVAL_MIN = 5; // how often to check for stuck syncs
const EMAILS_CACHE_META_KEY = 'emailsCacheMetaV1';
const STORED_EMAILS_CACHE_MAX_AGE_MS = 15 * 1000;
const APP_LINK_BACKFILL_STATE_KEY = 'appLinksBackfillStateV2';
const APP_LINK_BACKFILL_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const IS_PRODUCTION_EXTENSION_BUILD = process.env.EXTENSION_BUILD_TARGET === 'production';
const FALLBACK_BACKEND_BASE_URL = 'https://gmail-tracker-backend-674309673051.us-central1.run.app';
const BUNDLED_BACKEND_BASE_URL = (
  IS_PRODUCTION_EXTENSION_BUILD
    ? (process.env.BACKEND_BASE_URL_PROD || FALLBACK_BACKEND_BASE_URL)
    : (process.env.BACKEND_BASE_URL || FALLBACK_BACKEND_BASE_URL)
).replace(/\/$/, '');
const BUNDLED_PREMIUM_DASHBOARD_URL = (
  IS_PRODUCTION_EXTENSION_BUILD
    ? (process.env.PREMIUM_DASHBOARD_URL_PROD || 'https://applendium.com')
    : (process.env.PREMIUM_DASHBOARD_URL || 'https://applendium.com')
).toString().trim();

// In MV3, `chrome.runtime.sendMessage()` returns a Promise if no callback is provided.
// If the popup is closed there may be no listeners, which can otherwise cause
// an unhandled rejection ("Receiving end does not exist") in the service worker console.
function safeRuntimeSendMessage(message) {
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {
    // ignore
  }
}

function notifyAuthFlowStage(stage, details = {}) {
  safeRuntimeSendMessage({
    type: 'AUTH_FLOW_STAGE',
    stage,
    ...details,
  });
}

function buildGoogleOAuthUrl(redirectUri) {
  const manifest = chrome.runtime.getManifest?.() || {};
  const clientId = manifest?.oauth2?.client_id;
  const scopes = Array.isArray(manifest?.oauth2?.scopes) ? manifest.oauth2.scopes : [];

  if (!clientId || scopes.length === 0) {
    throw new Error('Missing oauth2 client configuration in extension manifest.');
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', scopes.join(' '));
  return url.toString();
}

// Broadcast auth state to all content scripts so the web app stays in sync.
function broadcastAuthStateToContentScripts(loggedIn, email) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'AUTH_STATE_CHANGED', loggedIn, email }, () => {
          void chrome.runtime.lastError; // suppress "no receiver" errors
        });
      } catch (_) {
        // tab may not have content script
      }
    }
  });
}

// --- OS Notifications (service worker) ---
// These notifications show even when the popup UI is closed, as long as Chrome is running.
const NOTIFICATIONS_ENABLED_KEY = 'applendiumNotificationsEnabledV1';
const NOTIFICATIONS_INITIALIZED_KEY = 'applendiumNotificationsInitializedV1';
const LEGACY_NOTIFICATIONS_ENABLED_KEYS = [
  ['morrow', 'foldNotificationsEnabledV1'].join(''),
  ['app', 'mailiaNotificationsEnabledV1'].join(''),
];
const LEGACY_NOTIFICATIONS_INITIALIZED_KEYS = [
  ['morrow', 'foldNotificationsInitializedV1'].join(''),
  ['app', 'mailiaNotificationsInitializedV1'].join(''),
];

const CATEGORY_NOTIFICATION_META = {
  applied: { title: 'Application tracked', plural: 'applications', badgeColor: [37, 99, 235, 255] },
  interviewed: { title: 'Interview detected', plural: 'interviews', badgeColor: [202, 138, 4, 255] },
  offers: { title: 'Offer detected', plural: 'offers', badgeColor: [22, 163, 74, 255] },
  rejected: { title: 'Rejection detected', plural: 'rejections', badgeColor: [220, 38, 38, 255] },
};

function normalizeCategoryKey(value) {
  return (value || '').toString().trim().toLowerCase();
}

function flattenCategorizedEmails(categorizedEmails) {
  if (!categorizedEmails) return [];
  return [
    ...(categorizedEmails.applied || []),
    ...(categorizedEmails.interviewed || []),
    ...(categorizedEmails.offers || []),
    ...(categorizedEmails.rejected || []),
  ];
}

function mergeCategorizedEmails(existingCategorizedEmails, incomingCategorizedEmails) {
  const categories = ['applied', 'interviewed', 'offers', 'rejected', 'irrelevant'];
  const merged = {};

  for (const category of categories) {
    const existing = existingCategorizedEmails?.[category] || [];
    const incoming = incomingCategorizedEmails?.[category] || [];
    const byId = new Map();

    for (const email of existing) {
      if (!email?.id) continue;
      byId.set(Number(email.id), email);
    }

    for (const email of incoming) {
      if (!email?.id) continue;
      const existingEmail = byId.get(Number(email.id));
      byId.set(Number(email.id), existingEmail ? { ...existingEmail, ...email } : email);
    }

    merged[category] = Array.from(byId.values()).sort((a, b) => {
      const aTime = new Date(a?.date || 0).getTime();
      const bTime = new Date(b?.date || 0).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
  }

  return merged;
}

async function updateCachedEmails(mutator) {
  const stored = await chrome.storage.local.get([
    'appliedEmails',
    'interviewedEmails',
    'offersEmails',
    'rejectedEmails',
    'irrelevantEmails',
    'categoryTotals',
  ]);

  const categorizedEmails = {
    applied: stored.appliedEmails || [],
    interviewed: stored.interviewedEmails || [],
    offers: stored.offersEmails || [],
    rejected: stored.rejectedEmails || [],
    irrelevant: stored.irrelevantEmails || [],
  };

  const nextCategorizedEmails = mutator(categorizedEmails);
  if (!nextCategorizedEmails) return categorizedEmails;

  await chrome.storage.local.set({
    appliedEmails: nextCategorizedEmails.applied || [],
    interviewedEmails: nextCategorizedEmails.interviewed || [],
    offersEmails: nextCategorizedEmails.offers || [],
    rejectedEmails: nextCategorizedEmails.rejected || [],
    irrelevantEmails: nextCategorizedEmails.irrelevant || [],
    [EMAILS_CACHE_META_KEY]: {
      updatedAt: Date.now(),
      syncInProgress: false,
      totalRelevantCount: countRelevantCategorizedEmails(nextCategorizedEmails),
    },
  });

  safeRuntimeSendMessage({
    type: 'EMAILS_SYNCED',
    success: true,
    categorizedEmails: nextCategorizedEmails,
    categoryTotals: stored.categoryTotals || null,
    syncInProgress: false,
  });

  return nextCategorizedEmails;
}

function applyResolvedStateToEmail(email, state) {
  if (!email || !state) return email;
  const isClosed = Boolean(state.isClosed);
  const isUserClosed = Boolean(state.isUserClosed);
  const applicationStatus = normalizeApplicationStatusKey(state.applicationStatus);
  return {
    ...email,
    applicationId: state.applicationId ?? email.applicationId ?? null,
    isClosed,
    isUserClosed,
    isOutcomeClosed: Boolean(state.isOutcomeClosed),
    applicationStatus: applicationStatus || email.applicationStatus || null,
    displayCategory: state.displayCategory || deriveDisplayCategory(email.category, applicationStatus, isClosed),
  };
}

async function patchCachedEmailsFromResolvedUpdates(emailUpdates = []) {
  const updatesByEmailId = new Map(
    (emailUpdates || [])
      .filter((item) => item && item.emailId != null)
      .map((item) => [Number(item.emailId), item])
  );
  if (updatesByEmailId.size === 0) return null;

  return updateCachedEmails((categorizedEmails) => {
    const next = {};
    for (const [key, emails] of Object.entries(categorizedEmails)) {
      next[key] = (emails || []).map((email) => {
        const update = updatesByEmailId.get(Number(email?.id));
        return update ? applyResolvedStateToEmail(email, update) : email;
      });
    }
    return next;
  });
}

async function patchCachedEmailsForApplication(applicationId, application) {
  if (!applicationId || !application) return null;

  const applicationStatus = normalizeApplicationStatusKey(application.current_status);
  const isOutcomeClosed = isTerminalApplicationStatus(applicationStatus);
  const isClosed = Boolean(application.is_closed || application.user_closed_at || isOutcomeClosed);
  const isUserClosed = Boolean(application.user_closed_at);

  return updateCachedEmails((categorizedEmails) => {
    const next = {};
    for (const [key, emails] of Object.entries(categorizedEmails)) {
      next[key] = (emails || []).map((email) => {
        if (String(email?.applicationId || '') !== String(applicationId)) return email;
        return applyResolvedStateToEmail(email, {
          applicationId,
          applicationStatus,
          isClosed,
          isUserClosed,
          isOutcomeClosed,
          displayCategory: deriveDisplayCategory(email.category, applicationStatus, isClosed),
        });
      });
    }
    return next;
  });
}

async function patchCachedEmailsFromLifecycle(applicationId, application, lifecycle = []) {
  if (!applicationId || !application || !Array.isArray(lifecycle) || lifecycle.length === 0) return null;

  const applicationStatus = deriveApplicationStatusFromLifecycle(application.current_status, lifecycle);
  const isOutcomeClosed = isTerminalApplicationStatus(applicationStatus);
  const isClosed = Boolean(application.is_closed || application.user_closed_at || isOutcomeClosed);
  const isUserClosed = Boolean(application.user_closed_at);
  const lifecycleIds = new Set(
    lifecycle
      .map((item) => Number(item?.emailId))
      .filter(Number.isFinite)
  );

  if (lifecycleIds.size === 0) return null;

  return updateCachedEmails((categorizedEmails) => {
    const next = {};
    for (const [key, emails] of Object.entries(categorizedEmails)) {
      next[key] = (emails || []).map((email) => {
        if (!lifecycleIds.has(Number(email?.id))) return email;
        return applyResolvedStateToEmail(email, {
          applicationId,
          applicationStatus,
          isClosed,
          isUserClosed,
          isOutcomeClosed,
          displayCategory: deriveDisplayCategory(email.category, applicationStatus, isClosed),
        });
      });
    }
    return next;
  });
}

function countRelevantCategorizedEmails(categorizedEmails) {
  return (
    (categorizedEmails?.applied || []).length +
    (categorizedEmails?.interviewed || []).length +
    (categorizedEmails?.offers || []).length +
    (categorizedEmails?.rejected || []).length
  );
}

function getStructuredField(value) {
  const normalized = (value || '').toString().trim();
  if (!normalized) return '';
  const lower = normalized.toLowerCase();
  if (lower === 'unknown company' || lower === 'unknown role') return '';
  return normalized;
}

function formatNotificationTarget(email) {
  const company = getStructuredField(email?.company_name || email?.company);
  const position = getStructuredField(email?.position || email?.job_title);

  if (company && position) return `${company} - ${position}`;
  if (company) return company;
  if (position) return position;
  return '';
}

async function isStoredEmailsCacheStale(maxAgeMs = STORED_EMAILS_CACHE_MAX_AGE_MS) {
  try {
    const state = await chrome.storage.local.get([EMAILS_CACHE_META_KEY]);
    const updatedAt = Number(state?.[EMAILS_CACHE_META_KEY]?.updatedAt || 0);
    if (!updatedAt) return true;
    return (Date.now() - updatedAt) > maxAgeMs;
  } catch (_) {
    return true;
  }
}

function buildApplicationBackfillSignature(categorizedEmails) {
  const relevant = [
    ...(categorizedEmails?.applied || []),
    ...(categorizedEmails?.interviewed || []),
    ...(categorizedEmails?.offers || []),
    ...(categorizedEmails?.rejected || []),
  ];

  const candidateIds = relevant
    .filter((email) => {
      if (email?.applicationId || email?.application_id) return false;
      const company = getStructuredField(email?.company_name);
      const position = getStructuredField(email?.position);
      return Boolean(company && position);
    })
    .map((email) => String(email.id || email.email_id || email.thread_id || ''))
    .filter(Boolean)
    .sort();

  return {
    count: candidateIds.length,
    signature: candidateIds.join('|'),
  };
}

async function maybeNotifyNewEmails(prevCategorizedEmails, nextCategorizedEmails, syncInProgress) {
  // Avoid spamming while a long sync is still running; notify only on completion/manual refresh.
  if (syncInProgress === true) return;

  let enabled = true;
  let initialized = false;
  try {
    const state = await chrome.storage.local.get([
      NOTIFICATIONS_ENABLED_KEY,
      NOTIFICATIONS_INITIALIZED_KEY,
      ...LEGACY_NOTIFICATIONS_ENABLED_KEYS,
      ...LEGACY_NOTIFICATIONS_INITIALIZED_KEYS,
    ]);
    if (typeof state?.[NOTIFICATIONS_ENABLED_KEY] === 'boolean') {
      enabled = state[NOTIFICATIONS_ENABLED_KEY];
    } else {
      const legacyEnabledKey = LEGACY_NOTIFICATIONS_ENABLED_KEYS.find(
        (key) => typeof state?.[key] === 'boolean'
      );
      if (legacyEnabledKey) {
        enabled = state[legacyEnabledKey];
        await chrome.storage.local.set({ [NOTIFICATIONS_ENABLED_KEY]: enabled });
        await chrome.storage.local.remove(legacyEnabledKey);
      }
    }

    initialized = !!state?.[NOTIFICATIONS_INITIALIZED_KEY];
    if (!initialized) {
      const legacyInitializedKey = LEGACY_NOTIFICATIONS_INITIALIZED_KEYS.find(
        (key) => Boolean(state?.[key])
      );
      if (legacyInitializedKey) {
        initialized = true;
        await chrome.storage.local.set({ [NOTIFICATIONS_INITIALIZED_KEY]: true });
        await chrome.storage.local.remove(legacyInitializedKey);
      }
    }
  } catch (_) {
    // ignore
  }
  if (!enabled) return;

  // One-time initialization: establish a baseline so existing stored emails don't trigger a burst of notifications.
  if (!initialized) {
    try {
      await chrome.storage.local.set({ [NOTIFICATIONS_INITIALIZED_KEY]: true });
    } catch (_) {
      // ignore
    }
    return;
  }

  const prevIds = new Set(flattenCategorizedEmails(prevCategorizedEmails).map((e) => e?.id).filter(Boolean));
  const nextAll = flattenCategorizedEmails(nextCategorizedEmails);
  const brandNew = nextAll.filter((e) => e?.id && !prevIds.has(e.id));
  if (brandNew.length === 0) return;

  const byCategory = { applied: [], interviewed: [], offers: [], rejected: [] };
  for (const email of brandNew) {
    const cat = normalizeCategoryKey(email.category);
    if (byCategory[cat]) byCategory[cat].push(email);
  }

  // Determine the "highest" severity category for badge coloring.
  const severity = { applied: 1, interviewed: 2, offers: 3, rejected: 3 };
  let topCategory = 'applied';
  for (const [cat, list] of Object.entries(byCategory)) {
    if (list.length === 0) continue;
    if ((severity[cat] || 0) > (severity[topCategory] || 0)) topCategory = cat;
  }

  for (const [cat, list] of Object.entries(byCategory)) {
    if (!list || list.length === 0) continue;
    const meta = CATEGORY_NOTIFICATION_META[cat] || { title: 'Update detected', plural: 'updates' };
    const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const sample = sorted[0] || {};
    const targetLabel = formatNotificationTarget(sample);

    const title = meta.title;
    const message =
      list.length === 1
        ? (targetLabel || meta.title)
        : (targetLabel ? `${list.length} new ${meta.plural}. Latest: ${targetLabel}` : `${list.length} new ${meta.plural}.`);

    try {
      chrome.notifications.create(`applendium_${cat}_${sample.id || Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title,
        message,
        priority: 1,
      });
    } catch (e) {
      bgLogger.warn('Failed to create notification:', e?.message);
    }
  }

  // Optional: show a small badge count as a secondary, color-coded signal.
  try {
    if (chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: String(brandNew.length) });
      const color = CATEGORY_NOTIFICATION_META[topCategory]?.badgeColor;
      if (color && chrome.action?.setBadgeBackgroundColor) {
        chrome.action.setBadgeBackgroundColor({ color });
      }
    }
  } catch (_) {
    // ignore
  }
}

// Define your backend endpoints.
const CONFIG_ENDPOINTS = {
  BACKEND_BASE_URL: BUNDLED_BACKEND_BASE_URL,
  AUTH_URL: '/api/auth/auth-url',
  AUTH_TOKEN: '/api/auth/token',
  SYNC_EMAILS: '/api/emails',
  FETCH_STORED_EMAILS: '/api/emails/stored-emails', // This endpoint is not used by background script directly for fetching
  REPAIR_APPLICATION_LINKS: '/api/emails/applications/:applicationId/repair-links',
  FOLLOWUP_NEEDED: '/api/emails/followup-needed',
  SYNC_STATUS: '/api/emails/sync-status',
  // Backfill endpoints removed
  // CORRECTED: Changed endpoint to match backend route /misclassification
  REPORT_MISCLASSIFICATION: '/api/emails/misclassification',
  // CORRECTED: Changed endpoint to match backend route /undo-misclassification
  UNDO_MISCLASSIFICATION: '/api/emails/undo-misclassification',
  FETCH_USER_PLAN: '/api/user',
  UPDATE_USER_PLAN: '/api/user/update-plan',
  SEND_REPLY: '/api/emails/send-reply', // Legacy backend stub (kept for fallback / logging)
  ARCHIVE_EMAIL: '/api/emails/archive', // Ensure this matches your backend's archive endpoint
  UPDATE_COMPANY_NAME: '/api/emails/:emailId/company', // PATCH endpoint for company name correction
  CORRECTION_ANALYTICS: '/api/emails/analytics/corrections', // GET endpoint for correction analytics
  APPLICATION_STATS: '/api/emails/applications/stats', // GET endpoint for application lifecycle statistics
  CLOSE_APPLICATION: '/api/emails/applications/:applicationId/close',
  REOPEN_APPLICATION: '/api/emails/applications/:applicationId/reopen',
};

// --- Authentication Readiness Promise ---
// This promise will resolve once Firebase Auth has initialized and determined
// the user's state (logged in or logged out).
const AUTH_READY_TIMEOUT_MS = 5000;
let authReadyResolve;
let authReadyResolved = false;
const authReadyPromise = new Promise(resolve => {
  authReadyResolve = resolve;
});

function resolveAuthReady(reason = 'unspecified') {
  if (authReadyResolved) return;
  authReadyResolved = true;
  try {
    console.log(`[bg] Auth ready resolved via ${reason}.`);
  } catch (_) {
    // ignore
  }
  authReadyResolve();
}

async function waitForAuthReady(timeoutMs = AUTH_READY_TIMEOUT_MS) {
  if (authReadyResolved) return;

  let timeoutId;
  try {
    await Promise.race([
      authReadyPromise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          try {
            console.warn(`[bg] Auth readiness timed out after ${timeoutMs}ms; continuing with current auth state.`);
          } catch (_) {
            // ignore
          }
          resolve();
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// --- Backend base URL override (dev-only) ---
// We intentionally restrict overrides to localhost to avoid malicious redirects.
const BACKEND_BASE_URL_STORAGE_KEY = 'backendBaseUrlOverride';
const DEFAULT_BACKEND_BASE_URL = CONFIG_ENDPOINTS.BACKEND_BASE_URL;
let backendBaseUrl = DEFAULT_BACKEND_BASE_URL;

// --- Premium dashboard URL override (dev-only) ---
// This lets you test the premium web app locally without rebuilding the extension.
// Allowed:
// - https://... anywhere
// - http://localhost / http://127.0.0.1 (dev only)
const PREMIUM_DASHBOARD_URL_STORAGE_KEY = 'premiumDashboardUrlOverride';
const DEFAULT_PREMIUM_DASHBOARD_URL = BUNDLED_PREMIUM_DASHBOARD_URL;
let premiumDashboardUrl = DEFAULT_PREMIUM_DASHBOARD_URL;

function isAllowedBackendBaseUrlOverride(url) {
  if (!url || typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]';
  if (!isLocal) return false;

  const manifest = chrome.runtime.getManifest?.() || {};
  const hostPermissions = Array.isArray(manifest?.host_permissions) ? manifest.host_permissions : [];
  const extensionPageCsp = manifest?.content_security_policy?.extension_pages || '';
  const normalizedOrigin = parsed.origin.replace(/\/$/, '');
  const normalizedBaseUrl = normalizeBaseUrl(parsed.href);

  const hostPermissionAllowed = hostPermissions.some((pattern) => {
    const normalizedPattern = String(pattern || '').trim();
    return (
      normalizedPattern === `${normalizedOrigin}/*` ||
      normalizedPattern === `${normalizedBaseUrl}/*` ||
      normalizedPattern.includes(normalizedOrigin)
    );
  });

  const cspAllowed = extensionPageCsp.includes(normalizedOrigin);
  return hostPermissionAllowed && cspAllowed;
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
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]';
  return isLocal;
}

function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

let backendBaseUrlReadyResolve;
const backendBaseUrlReadyPromise = new Promise((resolve) => {
  backendBaseUrlReadyResolve = resolve;
});

(async () => {
  try {
    const stored = await chrome.storage?.local?.get([BACKEND_BASE_URL_STORAGE_KEY]);
    const override = stored?.[BACKEND_BASE_URL_STORAGE_KEY];
    if (isAllowedBackendBaseUrlOverride(override)) {
      backendBaseUrl = normalizeBaseUrl(override);
      try { console.log('[bg][info]', `Using backend base URL override: ${backendBaseUrl}`); } catch (_) {}
    } else if (override) {
      try { console.warn('[bg][warn]', `Ignoring unsafe backend base URL override: ${String(override)}`); } catch (_) {}
      try { await chrome.storage.local.remove([BACKEND_BASE_URL_STORAGE_KEY]); } catch (_) {}
    }
  } catch (e) {
    try { console.warn('[bg][warn]', 'Failed to load backend base URL override:', e?.message || e); } catch (_) {}
  } finally {
    backendBaseUrlReadyResolve();
  }
})();

let premiumDashboardUrlReadyResolve;
const premiumDashboardUrlReadyPromise = new Promise((resolve) => {
  premiumDashboardUrlReadyResolve = resolve;
});

(async () => {
  try {
    const stored = await chrome.storage?.local?.get([PREMIUM_DASHBOARD_URL_STORAGE_KEY]);
    const override = stored?.[PREMIUM_DASHBOARD_URL_STORAGE_KEY];
    if (isAllowedPremiumDashboardUrlOverride(override)) {
      premiumDashboardUrl = normalizeBaseUrl(override);
      try { console.log('[bg][info]', `Using premium dashboard URL override: ${premiumDashboardUrl}`); } catch (_) {}
    } else if (override) {
      try { console.warn('[bg][warn]', `Ignoring unsafe premium dashboard URL override: ${String(override)}`); } catch (_) {}
    }
  } catch (e) {
    try { console.warn('[bg][warn]', 'Failed to load premium dashboard URL override:', e?.message || e); } catch (_) {}
  } finally {
    premiumDashboardUrlReadyResolve();
  }
})();

// --- Sync de-duplication state ---
let syncInFlight = false;
let lastSyncStartTs = 0;

// --- Token refresh de-duplication ---
let tokenRefreshPromise = null;

async function getFreshToken(user) {
  if (!tokenRefreshPromise) {
    // Avoid forcing refresh on every request; Firebase refreshes tokens automatically.
    // If we hit a rare edge-case where the cached token is invalid, fall back to a forced refresh once.
    tokenRefreshPromise = user
      .getIdToken()
      .catch(() => user.getIdToken(true))
      .finally(() => {
        tokenRefreshPromise = null;
      });
  }
  return tokenRefreshPromise;
}

// --- Helper Functions ---

function capitalizeFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Minimal background logger to centralize and tag messages; easy to disable later
const bgLogger = {
  info: (...args) => {
    try { console.log('[bg][info]', ...args); } catch (_) {}
  },
  warn: (...args) => {
    try { console.warn('[bg][warn]', ...args); } catch (_) {}
  },
  error: (...args) => {
    try { console.error('[bg][error]', ...args); } catch (_) {}
  }
};

/**
 * Generic fetch wrapper for backend API calls.
 * Automatically adds authorization header if a Firebase user is logged in.
 * Ensures a fresh ID token is obtained.
 * @param {string} endpoint - The API endpoint (e.g., '/api/emails').
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @returns {Promise<object>} The JSON response from the backend.
 */
async function apiFetch(endpoint, options = {}) {
  const { skipAuthReady = false, ...fetchOptions } = options;

  // Do not block pre-login OAuth bootstrap/exchange calls on Firebase auth initialization.
  if (!skipAuthReady) {
    await waitForAuthReady();
  }
  await backendBaseUrlReadyPromise;

  const user = auth.currentUser;
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

    if (user && !user.isAnonymous) { // Only attempt to get ID token for non-anonymous users
    try {
      const idToken = await getFreshToken(user); // Use deduplicated token refresh
      headers['Authorization'] = `Bearer ${idToken}`;
      bgLogger.info(`Attached fresh ID token for user: ${user.uid}`);
    } catch (error) {
      bgLogger.error("Failed to get fresh Firebase ID token:", error);
      
      if (error.code === 'auth/user-token-expired' || error.code === 'auth/invalid-user-token') {
        console.warn("Applendium: Unrecoverable auth token error. Forcing user logout.");

        await signOut(auth);

        safeRuntimeSendMessage({
          type: 'FORCE_LOGOUT',
          reason: 'Your session has expired. Please log in again.'
        });

        throw new Error("User session expired and was forcefully terminated.");
      }
    }
  } else if (user && user.isAnonymous) {
    bgLogger.info("Anonymous user, skipping ID token attachment.");
  } else {
    bgLogger.info("No authenticated user, skipping ID token attachment.");
  }


  // Build URL with optional query params support
  let url = `${backendBaseUrl}${endpoint}`;
  if (fetchOptions.query && typeof fetchOptions.query === 'object') {
    const qs = new URLSearchParams(fetchOptions.query).toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }
  bgLogger.info(`API call: ${url} method=${fetchOptions.method || 'GET'}`);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: headers,
      // Ensure body is stringified only if it's an object and not already a string
      body: fetchOptions.body && typeof fetchOptions.body === 'object' ? JSON.stringify(fetchOptions.body) : fetchOptions.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Applendium: API Error ${response.status} from ${url}:`, errorText);
      
      // Try to parse error as JSON to preserve errorCode and other fields
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errorCode || errorJson.requiresReauth) {
          // Return the structured error response instead of throwing
          // This allows the caller to handle auth errors properly
          return {
            success: false,
            error: errorJson.error || errorJson.message || `Backend error: ${response.status}`,
            errorCode: errorJson.errorCode,
            requiresReauth: errorJson.requiresReauth
          };
        }
      } catch (parseError) {
        // Not JSON, continue with default error handling
      }
      
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
  bgLogger.info(`API success: ${url}`, data);
    return data;
  } catch (error) {
    // Check if this is already a structured response (from our error handling above)
    if (error.errorCode || error.requiresReauth) {
      return error;
    }
    console.error(`❌ Applendium: Network or parsing error for ${url}:`, error);
    throw new Error(`Network or server error: ${error.message}`);
  }
}

function startPostLoginBackgroundWork(user) {
  if (!user || user.isAnonymous) return;

  refreshStoredEmailsCache(true, { skipNotify: true, skipBackfill: true }).catch((e) => {
    bgLogger.warn?.('Failed to prefetch stored emails after auth:', e?.message);
  });

  (async () => {
    try {
      const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
        method: 'POST',
        body: { email: user.email, userId: user.uid }
      });
      if (response.success) {
        await chrome.storage.local.set({ userPlan: response.plan });
        console.log('✅ Applendium Background: User plan fetched and stored:', response.plan);
      } else {
        console.error('❌ Applendium Background: Failed to fetch user plan during auth state change:', response.error);
      }
    } catch (error) {
      console.error('❌ Applendium Background: Network/communication error fetching user plan during auth state change:', error);
    }
  })();

  (async () => {
    let shouldFull = true;
    try {
      const status = await apiFetch(CONFIG_ENDPOINTS.SYNC_STATUS, { method: 'GET' });
      const last = status?.sync?.lastSyncAt ? new Date(status.sync.lastSyncAt) : null;
      if (last && (Date.now() - last.getTime()) < 24 * 60 * 60 * 1000) {
        shouldFull = false;
      }
    } catch (_) {
      shouldFull = true;
    }

    try {
      await triggerEmailSync(user.email, user.uid, shouldFull);
    } catch (e) {
      console.error('Applendium Background: triggerEmailSync failed after auth state change:', e);
    }
  })();
}

/**
 * Fetch stored emails from backend and update local cache, then notify popup.
 */
async function refreshStoredEmailsCache(syncInProgress = undefined, options = {}) {
  const { skipBackfill = false, skipNotify = false } = options || {};
  try {
    // Snapshot prior cache before fetching so we can detect newly-added emails.
    let previousCache = null;
    try {
      const prev = await chrome.storage.local.get([
        'appliedEmails',
        'interviewedEmails',
        'offersEmails',
        'rejectedEmails',
        'irrelevantEmails',
      ]);
      previousCache = {
        applied: prev.appliedEmails || [],
        interviewed: prev.interviewedEmails || [],
        offers: prev.offersEmails || [],
        rejected: prev.rejectedEmails || [],
        irrelevant: prev.irrelevantEmails || [],
      };
    } catch (_) {
      previousCache = null;
    }

    // While a sync is in progress, keep these refreshes lightweight to avoid hammering the backend.
    // We'll do one full refresh once the sync completes.
    const isSyncing = syncInProgress === true;
    const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_STORED_EMAILS, {
      method: 'POST',
      body: { limit: isSyncing ? 200 : 5000 }, // backend clamps per-plan
    });
    if (response.success && response.categorizedEmails) {
      const responseCategorizedEmails = response.categorizedEmails;
      const previousRelevantCount = countRelevantCategorizedEmails(previousCache);
      const responseRelevantCount = countRelevantCategorizedEmails(responseCategorizedEmails);
      const shouldPreservePreviousCache =
        isSyncing &&
        previousRelevantCount > 0 &&
        responseRelevantCount > 0 &&
        responseRelevantCount < previousRelevantCount;

      // During sync we intentionally fetch a smaller slice to reduce backend load.
      // Do not let that partial slice replace a fuller cache already shown in the popup.
      const nextCategorizedEmails = shouldPreservePreviousCache
        ? {
            applied: previousCache.applied || [],
            interviewed: previousCache.interviewed || [],
            offers: previousCache.offers || [],
            rejected: previousCache.rejected || [],
            irrelevant: previousCache.irrelevant || [],
          }
        : responseCategorizedEmails;
      const nextRelevantCount = countRelevantCategorizedEmails(nextCategorizedEmails);

      // Update cache + UI immediately. Any optional backfill happens asynchronously after users see emails.
      await chrome.storage.local.set({
        appliedEmails: nextCategorizedEmails.applied || [],
        interviewedEmails: nextCategorizedEmails.interviewed || [],
        offersEmails: nextCategorizedEmails.offers || [],
        rejectedEmails: nextCategorizedEmails.rejected || [],
        irrelevantEmails: nextCategorizedEmails.irrelevant || [],
        [EMAILS_CACHE_META_KEY]: {
          updatedAt: Date.now(),
          syncInProgress: isSyncing,
          totalRelevantCount: nextRelevantCount,
        },
        // Keep totals in sync with DB so the dashboard doesn't depend on local array size.
        ...(response.categoryTotals ? { categoryTotals: response.categoryTotals } : {}),
      });

      safeRuntimeSendMessage({
        type: 'EMAILS_SYNCED',
        success: true,
        categorizedEmails: nextCategorizedEmails,
        ...(response.categoryTotals ? { categoryTotals: response.categoryTotals } : {}),
        syncInProgress,
      });

      // Best-effort notifications (never block the UI update).
      if (!isSyncing && !skipNotify) {
        try {
          await maybeNotifyNewEmails(previousCache, nextCategorizedEmails, syncInProgress);
        } catch (e) {
          bgLogger.warn('Notification check failed:', e?.message);
        }
      }

      // Optional relink backfill: do not block initial render.
      if (!isSyncing && !skipBackfill) {
        (async () => {
          const backfillState = await chrome.storage.local.get([APP_LINK_BACKFILL_STATE_KEY]).catch(() => ({}));
          const state = backfillState?.[APP_LINK_BACKFILL_STATE_KEY] || {};
          const signatureState = buildApplicationBackfillSignature(response.categorizedEmails);
          const shouldSkip =
            signatureState.count === 0 ||
            (
              state.signature === signatureState.signature &&
              state.lastRunAt &&
              (Date.now() - Number(state.lastRunAt)) < APP_LINK_BACKFILL_MIN_INTERVAL_MS
            );

          if (shouldSkip) {
            if (signatureState.count === 0) {
              await chrome.storage.local.set({
                [APP_LINK_BACKFILL_STATE_KEY]: {
                  signature: '',
                  count: 0,
                  lastRunAt: Date.now(),
                }
              }).catch(() => {});
            }
            return;
          }

          try {
            bgLogger.info('[backfill] Running application linking backfill...');
            const backfillRes = await apiFetch('/api/emails/applications/backfill', {
              method: 'POST',
              body: { limit: 5000 },
            });
            if (!backfillRes || !backfillRes.success) return;

            await chrome.storage.local.set({
              [APP_LINK_BACKFILL_STATE_KEY]: {
                signature: signatureState.signature,
                count: signatureState.count,
                lastRunAt: Date.now(),
              }
            }).catch(() => {});

            // Refetch once so cached emails include `applicationId` and updated `isClosed`.
            const refreshed = await apiFetch(CONFIG_ENDPOINTS.FETCH_STORED_EMAILS, {
              method: 'POST',
              body: { limit: 5000 },
            });
            if (refreshed.success && refreshed.categorizedEmails) {
              await chrome.storage.local.set({
                appliedEmails: refreshed.categorizedEmails.applied || [],
                interviewedEmails: refreshed.categorizedEmails.interviewed || [],
                offersEmails: refreshed.categorizedEmails.offers || [],
                rejectedEmails: refreshed.categorizedEmails.rejected || [],
                irrelevantEmails: refreshed.categorizedEmails.irrelevant || [],
                [EMAILS_CACHE_META_KEY]: {
                  updatedAt: Date.now(),
                  syncInProgress: false,
                  totalRelevantCount:
                    (refreshed.categorizedEmails.applied || []).length +
                    (refreshed.categorizedEmails.interviewed || []).length +
                    (refreshed.categorizedEmails.offers || []).length +
                    (refreshed.categorizedEmails.rejected || []).length,
                },
              });
              safeRuntimeSendMessage({
                type: 'EMAILS_SYNCED',
                success: true,
                categorizedEmails: refreshed.categorizedEmails,
                syncInProgress: false,
              });
            }
          } catch (e) {
            bgLogger.warn?.('[backfill] Backfill failed:', e?.message || e);
          }
        })();
      }

      const totalRelevantCount =
        typeof response.totalRelevantCount === 'number'
          ? Math.max(response.totalRelevantCount, nextRelevantCount)
          : typeof response.totalCount === 'number'
            ? Math.max(response.totalCount, nextRelevantCount)
            : nextRelevantCount;

      return { success: true, totalRelevantCount };
    }
  } catch (e) {
    console.warn('Applendium Background: refreshStoredEmailsCache failed:', e?.message);
  }
  return { success: false, totalRelevantCount: 0 };
}

/**
 * Poll the sync status and periodically refresh stored emails until complete or timeout.
 * FIXED: Reduced polling from 2s to 10s to avoid exhausting Gmail API quota
 */
async function pollSyncStatusAndRefresh(maxSeconds = 15 * 60, intervalMs = 10000, options = {}) {
  const { waitForStart = false, waitForStartMs = 60_000 } = options || {};
  const start = Date.now();
  let lastRefreshAt = 0;
  let hasAnyStoredEmails = false;
  let sawInProgress = false;
  const EARLY_REFRESH_MS = 10_000; // fast updates so users see their first emails quickly
  const STEADY_REFRESH_MS = 60_000; // reduce backend load once we have any results
  while (Date.now() - start < maxSeconds * 1000) {
    try {
    const status = await apiFetch(CONFIG_ENDPOINTS.SYNC_STATUS, { method: 'GET' });
      if (status?.success) {
        if (status.sync?.inProgress) {
          sawInProgress = true;
          // While syncing, refresh cached emails sparingly to reduce backend load.
          // This prevents production-only stalls caused by repeated heavy /stored-emails queries.
          const now = Date.now();
          const refreshInterval = hasAnyStoredEmails ? STEADY_REFRESH_MS : EARLY_REFRESH_MS;
          if (now - lastRefreshAt >= refreshInterval) {
            lastRefreshAt = now;
            const refreshed = await refreshStoredEmailsCache(true);
            if ((refreshed?.totalRelevantCount || 0) > 0) {
              hasAnyStoredEmails = true;
            }
          }
        } else {
          // If we're waiting for a sync to *start*, do not treat an early "false" as terminal.
          // This avoids a race where we poll before the backend acquires the sync lock.
          if (waitForStart && !sawInProgress && (Date.now() - start) < waitForStartMs) {
            // keep polling
          } else {
            // One final refresh at completion
            await refreshStoredEmailsCache(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Applendium Background: sync-status polling error:', e?.message);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

/**
 * Watchdog: checks whether a sync has been in-progress for too long and notifies UI.
 * Non-fatal: best-effort and silent on errors.
 */
async function checkSyncWatchdog() {
  try {
    const status = await apiFetch(CONFIG_ENDPOINTS.SYNC_STATUS, { method: 'GET' });
    if (!status?.success || !status?.sync?.inProgress) return;

    // Try several possible timestamp fields for when the sync/lock started
    const startedIso = status.sync.startedAt
      || status.sync.lockAcquiredAt
      || status.sync.lock?.acquiredAt
      || status.sync.lock?.since
      || status.sync.started
      || status.sync.started_at
      || status.sync.lastSyncAt; // fallback if nothing else

    const startedMs = startedIso ? new Date(startedIso).getTime() : Date.now();
    const mins = (Date.now() - startedMs) / 60000;

    if (mins >= STUCK_LOCK_THRESHOLD_MIN) {
      // Let the UI know the sync might be stuck; include snapshot for context
      safeRuntimeSendMessage({
        type: 'SYNC_STUCK',
        minutesInProgress: Math.round(mins),
        thresholdMinutes: STUCK_LOCK_THRESHOLD_MIN,
        sync: status.sync,
      });
    }
  } catch (e) {
    console.warn('Applendium Background: watchdog check failed:', e?.message);
  }
}

/**
 * Sends an email reply using the Gmail API (via backend).
 * @param {string} threadId - The ID of the email thread to reply to.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Subject of the reply.
 * @param {string} body - Body of the reply.
 * @param {string} userEmail - The email of the authenticated user (sender).
 * @param {string} userId - The Firebase UID of the user.
 * @returns {Promise<object>} Result of the send operation.
 */
async function sendGmailReply(threadId, to, subject, body, userEmail, userId) { // Now always use backend implementation
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated for sending email.');
  // Call backend route which handles refresh token + Gmail API; keeps logic centralized
  const resp = await apiFetch(CONFIG_ENDPOINTS.SEND_REPLY, {
    method: 'POST',
    body: { threadId, to, subject, body, userEmail, userId }
  });
  return resp; // { success, gmailMessageId?, threadId?, needsReauth? }
}

/**
 * Helper function to trigger email synchronization with the backend and cache results locally.
 * This is called by alarms and explicit FETCH_NEW_EMAILS messages.
 * @param {string} userEmail - The email of the authenticated user.
 * @param {string} userId - The Firebase UID of the user.
 * @param {boolean} fullRefresh - If true, requests a full re-sync from Gmail.
 * @returns {Promise<Object>} An object containing success status, updated categorized emails, and quota.
 */
async function triggerEmailSync(userEmail, userId, fullRefresh = false) {
  // Ensure userEmail and userId are provided before making the API call
  if (!userEmail || !userId) {
    console.error('❌ Applendium Background: Cannot trigger email sync, userEmail or userId is missing.');
    return { success: false, error: 'User email or ID missing for sync.' };
  }

  // Coalesce duplicate sync triggers
  if (syncInFlight) {
    // Return current cached emails immediately instead of hitting backend again
    const cached = await chrome.storage.local.get([
      'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails', 'quotaData'
    ]);
    return {
      success: true,
      categorizedEmails: {
        applied: cached.appliedEmails || [],
        interviewed: cached.interviewedEmails || [],
        offers: cached.offersEmails || [],
        rejected: cached.rejectedEmails || [],
        irrelevant: cached.irrelevantEmails || [],
      },
      quota: cached.quotaData || null,
      sync: { inProgress: true }
    };
  }

  syncInFlight = true;
  lastSyncStartTs = Date.now();

  try {
    // Sidecar polling: improves "time to first emails" during long-running sync calls.
    // In Cloud Run, /api/emails often performs an inline sync that can take minutes; while
    // that request is in-flight, we can poll /sync-status + refresh /stored-emails to
    // progressively populate the popup.
    pollSyncStatusAndRefresh(15 * 60, 10_000, { waitForStart: true, waitForStartMs: 60_000 })
      .catch((e) => bgLogger.warn?.('Applendium Background: sidecar polling failed:', e?.message || e));

    // Snapshot prior cache before syncing so we can detect newly-added emails and notify on completion.
    let previousCache = null;
    try {
      const prev = await chrome.storage.local.get([
        'appliedEmails',
        'interviewedEmails',
        'offersEmails',
        'rejectedEmails',
      ]);
      previousCache = {
        applied: prev.appliedEmails || [],
        interviewed: prev.interviewedEmails || [],
        offers: prev.offersEmails || [],
        rejected: prev.rejectedEmails || [],
      };
    } catch (_) {
      previousCache = null;
    }

    const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
      method: 'POST',
    body: { userEmail, userId, fullRefresh, email: userEmail }
    });

    // Fetch application stats without blocking initial email visibility.
    // On cold Cloud Run instances, this endpoint can add noticeable latency.
    let applicationStats = null;
    const applicationStatsPromise = (async () => {
      try {
        const statsResponse = await apiFetch(CONFIG_ENDPOINTS.APPLICATION_STATS, { method: 'GET' });
        if (statsResponse.success && statsResponse.stats) {
          return statsResponse.stats;
        }
      } catch (error) {
        bgLogger.warn?.('Failed to fetch application stats (non-fatal):', error?.message || error);
      }
      return null;
    })();

    if (response.success && response.categorizedEmails) {
      // CRITICAL FIX: Only update chrome.storage if sync is NOT in progress
      // This prevents overwriting fresh local data with stale database data
      if (!response.sync?.inProgress) {
        try {
          await maybeNotifyNewEmails(previousCache, response.categorizedEmails, false);
        } catch (e) {
          bgLogger.warn('Notification check failed:', e?.message);
        }
        
        // Save categorized emails to chrome.storage.local
        await chrome.storage.local.set({
          appliedEmails: response.categorizedEmails.applied || [],
          interviewedEmails: response.categorizedEmails.interviewed || [],
          offersEmails: response.categorizedEmails.offers || [],
          rejectedEmails: response.categorizedEmails.rejected || [],
          quotaData: response.quota || null, // Also cache quota data
          categoryTotals: response.categoryTotals || null, // NEW: Cache accurate category counts
          applicationStats: applicationStats || null // NEW: Cache application statistics
        });
        bgLogger.info('Emails and quota cached successfully in local storage.');

        // Notify the popup that emails have been synced and cached
        safeRuntimeSendMessage({
          type: 'EMAILS_SYNCED',
          success: true,
          categorizedEmails: response.categorizedEmails,
          categoryTotals: response.categoryTotals, // NEW: Pass category totals to popup
          applicationStats: applicationStats, // NEW: Pass application stats to popup
          quota: response.quota,
          userEmail: userEmail, // Include userEmail for targeted updates in popup
          syncInProgress: false
        });
      } else {
        // Sync in progress - don't overwrite storage, just update quota and category totals
        const currentCache = await chrome.storage.local.get([
          'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
        ]);
        const cachedEmails = {
          applied: currentCache.appliedEmails || [],
          interviewed: currentCache.interviewedEmails || [],
          offers: currentCache.offersEmails || [],
          rejected: currentCache.rejectedEmails || [],
          irrelevant: currentCache.irrelevantEmails || [],
        };
        const mergedEmails = mergeCategorizedEmails(cachedEmails, response.categorizedEmails || {});

        await chrome.storage.local.set({
          appliedEmails: mergedEmails.applied || [],
          interviewedEmails: mergedEmails.interviewed || [],
          offersEmails: mergedEmails.offers || [],
          rejectedEmails: mergedEmails.rejected || [],
          irrelevantEmails: mergedEmails.irrelevant || [],
          quotaData: response.quota || null,
          categoryTotals: response.categoryTotals || null, // NEW: Update category totals even during sync
          applicationStats: applicationStats || null // NEW: Update application stats even during sync
        });
        bgLogger.info('Sync in progress - merged backend emails into cache and updated quota/category totals.');

        const emailsForUi = mergedEmails;
        const cachedCount =
          (mergedEmails.applied || []).length +
          (mergedEmails.interviewed || []).length +
          (mergedEmails.offers || []).length +
          (mergedEmails.rejected || []).length +
          (mergedEmails.irrelevant || []).length;

        // Notify UI with current cached data (or primed response data) without blocking sync.
        safeRuntimeSendMessage({
          type: 'EMAILS_SYNCED',
          success: true,
          categorizedEmails: emailsForUi,
          categoryTotals: response.categoryTotals, // NEW: Pass category totals to popup
          applicationStats: applicationStats, // NEW: Pass application stats to popup
          quota: response.quota,
          userEmail: userEmail,
          syncInProgress: true
        });

        // If the cache is empty (common right after a fresh login) but the backend is already
        // counting quota/totals, fetch stored emails immediately so the user sees results fast.
        // This is best-effort and should never block the sync response.
        const shouldKickStoredRefresh =
          cachedCount === 0 &&
          (Number(response?.quota?.usage || response?.quota?.totalProcessed || 0) > 0 ||
            (response?.categoryTotals &&
              Object.values(response.categoryTotals).some((v) => Number(v || 0) > 0)));
        if (shouldKickStoredRefresh) {
          refreshStoredEmailsCache(true, { skipNotify: true, skipBackfill: true }).catch(() => {});
        }
      }

      // If backend indicates a background sync is in progress, start polling without blocking
      if (response.sync?.inProgress) {
        pollSyncStatusAndRefresh().catch(e => console.warn('Applendium Background: polling failed:', e?.message));
      }

      // Publish application stats once available (do not block the main sync response).
      applicationStatsPromise
        .then(async (stats) => {
          if (!stats) return;
          applicationStats = stats;
          try {
            await chrome.storage.local.set({ applicationStats });
            const cached = await chrome.storage.local.get([
              'appliedEmails',
              'interviewedEmails',
              'offersEmails',
              'rejectedEmails',
              'irrelevantEmails',
              'quotaData',
              'categoryTotals',
            ]);
            safeRuntimeSendMessage({
              type: 'EMAILS_SYNCED',
              success: true,
              categorizedEmails: {
                applied: cached.appliedEmails || [],
                interviewed: cached.interviewedEmails || [],
                offers: cached.offersEmails || [],
                rejected: cached.rejectedEmails || [],
                irrelevant: cached.irrelevantEmails || [],
              },
              ...(cached.categoryTotals ? { categoryTotals: cached.categoryTotals } : {}),
              applicationStats,
              quota: cached.quotaData || null,
              userEmail,
              syncInProgress: Boolean(response.sync?.inProgress),
            });
          } catch (e) {
            bgLogger.warn?.('Failed to persist/publish application stats:', e?.message || e);
          }
        })
        .catch(() => {});
      return { success: true, categorizedEmails: response.categorizedEmails, quota: response.quota };
    } else {
      // Check if this is a scope or auth error requiring re-authentication
      if (response.errorCode === 'INSUFFICIENT_SCOPES' || response.errorCode === 'INVALID_GRANT' || response.requiresReauth) {
        console.error('❌ Applendium Background: Auth error - user needs to re-authenticate:', response.errorCode);
        
        // Send appropriate message type based on error
        const messageType = response.errorCode === 'INVALID_GRANT' ? 'AUTH_ERROR' : 'SCOPE_ERROR';
        const errorMessage = response.errorCode === 'INVALID_GRANT' 
          ? 'Your Google session has expired. Please sign out and sign back in.'
          : 'Your Gmail permissions are incomplete. Please sign out and sign in again.';
        
        // Notify popup about auth error
        safeRuntimeSendMessage({
          type: messageType,
          errorCode: response.errorCode,
          error: response.error || errorMessage,
          requiresReauth: true
        });
        
        return { success: false, error: response.error, errorCode: response.errorCode || 'INSUFFICIENT_SCOPES', requiresReauth: true };
      }
      
      console.error('❌ Applendium Background: Backend sync failed or returned no emails:', response.error);
      return { success: false, error: response.error || "Backend sync failed or returned no emails." };
    }
  } catch (error) {
    console.error('❌ Applendium Background: Error during email sync:', error);
    
    // Check if the error response has scope/auth error information
    if (error.errorCode === 'INSUFFICIENT_SCOPES' || error.errorCode === 'INVALID_GRANT' || error.requiresReauth) {
      // Send appropriate message type based on error
      const messageType = error.errorCode === 'INVALID_GRANT' ? 'AUTH_ERROR' : 'SCOPE_ERROR';
      const errorMessage = error.errorCode === 'INVALID_GRANT' 
        ? 'Your Google session has expired. Please sign out and sign back in.'
        : 'Your Gmail permissions are incomplete. Please sign out and sign in again.';
      
      safeRuntimeSendMessage({
        type: messageType,
        errorCode: error.errorCode,
        error: error.message || errorMessage,
        requiresReauth: true
      });
      return { success: false, error: error.message, errorCode: error.errorCode || 'INSUFFICIENT_SCOPES', requiresReauth: true };
    }
    
    return { success: false, error: error.message };
  } finally {
    syncInFlight = false;
  }
}


/**
 * Monitor a payment tab for completion or cancellation
 * @param {number} tabId - The ID of the payment tab to monitor
 * @param {string} userEmail - User's email for status checking
 * @param {string} userId - User's ID for status checking
 * @returns {Promise<object>} Payment result with completion status
 */
async function monitorPaymentFlow(tabId, userEmail, userId) {
  return new Promise((resolve) => {
    let pollInterval;
    let timeoutId;
    
    const cleanup = () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutId) clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      chrome.tabs.onRemoved.removeListener(tabRemovedListener);
    };

    const tabUpdateListener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.url) {
  bgLogger.info('Payment tab URL changed to:', changeInfo.url);
        
        // Check if we've returned to success or cancel URLs
        if (changeInfo.url.includes('success') || changeInfo.url.includes('dashboard.stripe.com/success')) {
          bgLogger.info('Payment completed successfully');
          cleanup();
          chrome.tabs.remove(tabId);
          resolve({ success: true, sessionCompleted: true, plan: 'premium' });
        } else if (changeInfo.url.includes('cancel') || changeInfo.url.includes('dashboard.stripe.com/cancel')) {
          bgLogger.info('Payment cancelled');
          cleanup();
          chrome.tabs.remove(tabId);
          resolve({ success: true, cancelled: true });
        }
      }
    };

    const tabRemovedListener = (removedTabId) => {
      if (removedTabId === tabId) {
  bgLogger.info('Payment tab was closed');
        cleanup();
        resolve({ success: true, cancelled: true });
      }
    };

    // Listen for tab updates and removals
    chrome.tabs.onUpdated.addListener(tabUpdateListener);
    chrome.tabs.onRemoved.addListener(tabRemovedListener);

    // Poll for payment status updates by checking subscription status
    pollInterval = setInterval(async () => {
      try {
        const statusResponse = await apiFetch('/api/subscriptions/status', {
          method: 'GET'
        });
        
        if (statusResponse?.success && statusResponse.subscription?.status === 'active') {
      bgLogger.info('Subscription detected as active during payment flow');
          cleanup();
          chrome.tabs.remove(tabId).catch(() => {}); // Tab might already be closed
          resolve({ success: true, sessionCompleted: true, plan: 'premium' });
        }
      } catch (error) {
        console.warn('⚠️ Applendium Background: Error checking subscription status during payment flow:', error);
      }
    }, 3000); // Check every 3 seconds

    // Timeout after 10 minutes
    timeoutId = setTimeout(() => {
  bgLogger.info('Payment flow timed out after 10 minutes');
      cleanup();
      chrome.tabs.remove(tabId).catch(() => {}); // Tab might already be closed
      resolve({ success: true, cancelled: true });
    }, 600000);
  });
}

/**
 * Refresh subscription status and update local storage
 * @param {string} userEmail - User's email
 * @param {string} userId - User's ID
 */
async function refreshSubscriptionStatus(userEmail, userId) {
  try {
    const statusResponse = await apiFetch('/api/subscriptions/status', {
      method: 'GET'
    });
    
    if (statusResponse?.success && statusResponse.subscription) {
      const subscription = statusResponse.subscription;
  bgLogger.info('Subscription status updated:', subscription);
      
      // Update local storage with new subscription info
      await chrome.storage.local.set({
        userPlan: subscription.plan,
        subscriptionStatus: subscription.status,
        subscriptionDetails: subscription
      });
      
      // Notify popup of subscription changes
      safeRuntimeSendMessage({
        type: 'SUBSCRIPTION_UPDATED',
        subscription: subscription
      });
    }
  } catch (error) {
    console.error('❌ Applendium Background: Error refreshing subscription status:', error);
  }
}

// --- Chrome Runtime Message Listener (for popup/content script communication) ---
// Registered immediately upon activation.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  bgLogger.info(`Received message type: ${msg.type}`);

  // Use an async IIFE to allow await inside the listener
  (async () => {
    // Get current user info from local storage for API calls if available
    // This is important because auth.currentUser might not be immediately available
    // when a message comes in, but local storage should hold the last known state.
    const currentUserInfo = await chrome.storage.local.get(['userEmail', 'userId']);
    const currentUserId = currentUserInfo.userId;
    const currentUserEmail = currentUserInfo.userEmail;

	    // Check if user info is available for operations requiring it
	    const isUserAuthenticated = !!auth.currentUser && !auth.currentUser.isAnonymous;
	    const hasCachedUserInfo = !!currentUserEmail && !!currentUserId;

    // For any message type *other than* the allowlisted unauthenticated calls, we expect user info to be present.
    // If not, we respond with an error.
    const unauthAllowed = new Set([
      'LOGIN_GOOGLE_OAUTH',
      'GET_BACKEND_BASE_URL',
      'SET_BACKEND_BASE_URL',
      'GET_PREMIUM_DASHBOARD_URL',
      'SET_PREMIUM_DASHBOARD_URL',
      'GET_BUILD_INFO',
      'GET_ID_TOKEN',
    ]);
    if (!isUserAuthenticated && !hasCachedUserInfo && !unauthAllowed.has(msg.type)) {
      console.warn(`Applendium Background: User not authenticated or user info not cached for message type: ${msg.type}.`);
      sendResponse({ success: false, error: "User not authenticated or user info not available." });
      return;
    }

    switch (msg.type) {
      case 'GET_BUILD_INFO': {
        const manifest = chrome.runtime.getManifest?.() || {};
        sendResponse({
          success: true,
          build: {
            id: chrome.runtime.id,
            name: manifest.name,
            version: manifest.version,
            version_name: manifest.version_name,
          },
          runtime: {
            backendBaseUrl,
            backendBaseUrlDefault: DEFAULT_BACKEND_BASE_URL,
            backendBaseUrlOverridden: backendBaseUrl !== DEFAULT_BACKEND_BASE_URL,
            premiumDashboardUrl,
            premiumDashboardUrlDefault: DEFAULT_PREMIUM_DASHBOARD_URL,
            premiumDashboardUrlOverridden: premiumDashboardUrl !== DEFAULT_PREMIUM_DASHBOARD_URL,
          },
        });
        break;
      }
      case 'GET_BACKEND_BASE_URL':
        sendResponse({ success: true, backendBaseUrl });
        break;

      case 'GET_PREMIUM_DASHBOARD_URL':
        await premiumDashboardUrlReadyPromise;
        sendResponse({ success: true, premiumDashboardUrl });
        break;

      case 'SET_BACKEND_BASE_URL':
        try {
          // Only allow extension pages (popup/options) to set this.
          // Content scripts run on web pages and should not be able to redirect the backend.
          const senderUrl = sender?.url || '';
          const isExtensionPage = typeof senderUrl === 'string' && senderUrl.startsWith(`chrome-extension://${chrome.runtime.id}/`);
          const isServiceWorkerContext = !senderUrl; // some Chrome contexts omit sender.url
          const allowedSender = isExtensionPage || isServiceWorkerContext;
          if (!allowedSender) {
            sendResponse({ success: false, error: 'Not allowed from this sender context.' });
            break;
          }

          const requested = msg?.backendBaseUrl;
          if (!requested) {
            await chrome.storage.local.remove([BACKEND_BASE_URL_STORAGE_KEY]);
            backendBaseUrl = DEFAULT_BACKEND_BASE_URL;
            sendResponse({ success: true, backendBaseUrl, resetToDefault: true });
            break;
          }

          if (!isAllowedBackendBaseUrlOverride(requested)) {
            sendResponse({
              success: false,
              error: 'Backend override must be a localhost URL allowed by the current extension manifest and CSP.',
            });
            break;
          }

          backendBaseUrl = normalizeBaseUrl(requested);
          await chrome.storage.local.set({ [BACKEND_BASE_URL_STORAGE_KEY]: backendBaseUrl });
          sendResponse({ success: true, backendBaseUrl });
        } catch (e) {
          sendResponse({ success: false, error: e?.message || String(e) });
        }
        break;

      case 'SET_PREMIUM_DASHBOARD_URL':
        try {
          const senderUrl = sender?.url || '';
          const isExtensionPage = typeof senderUrl === 'string' && senderUrl.startsWith(`chrome-extension://${chrome.runtime.id}/`);
          const isServiceWorkerContext = !senderUrl;
          const allowedSender = isExtensionPage || isServiceWorkerContext;
          if (!allowedSender) {
            sendResponse({ success: false, error: 'Not allowed from this sender context.' });
            break;
          }

          const requested = msg?.premiumDashboardUrl;
          if (!requested) {
            await chrome.storage.local.remove([PREMIUM_DASHBOARD_URL_STORAGE_KEY]);
            premiumDashboardUrl = DEFAULT_PREMIUM_DASHBOARD_URL;
            sendResponse({ success: true, premiumDashboardUrl, resetToDefault: true });
            break;
          }

          if (!isAllowedPremiumDashboardUrlOverride(requested)) {
            sendResponse({ success: false, error: 'Premium URL override must be https://... or localhost http://...' });
            break;
          }

          premiumDashboardUrl = normalizeBaseUrl(requested);
          await chrome.storage.local.set({ [PREMIUM_DASHBOARD_URL_STORAGE_KEY]: premiumDashboardUrl });
          sendResponse({ success: true, premiumDashboardUrl });
        } catch (e) {
          sendResponse({ success: false, error: e?.message || String(e) });
        }
        break;

      case 'LOGIN_GOOGLE_OAUTH':
        try {
          const redirectUriForBackend = chrome.identity.getRedirectURL();
          let finalAuthUrl = null;

          notifyAuthFlowStage('building_auth_url', { redirectUri: redirectUriForBackend });
          try {
            finalAuthUrl = buildGoogleOAuthUrl(redirectUriForBackend);
          } catch (buildError) {
            notifyAuthFlowStage('building_auth_url_failed', { error: buildError.message });
            const authUrlResponse = await apiFetch(CONFIG_ENDPOINTS.AUTH_URL, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              query: { redirect_uri: redirectUriForBackend },
              skipAuthReady: true
            });
            if (!authUrlResponse.success || !authUrlResponse.url) {
              throw new Error(authUrlResponse.error || 'Failed to get auth URL from backend.');
            }
            finalAuthUrl = authUrlResponse.url;
          }

          notifyAuthFlowStage('launching_web_auth_flow');
          bgLogger.info(`Attempting to launch Web Auth Flow with URL: ${finalAuthUrl}`);
          const authRedirectUrl = await chrome.identity.launchWebAuthFlow({
            url: finalAuthUrl,
            interactive: true
          });
          if (!authRedirectUrl) {
            throw new Error('OAuth flow cancelled or failed.');
          }
          notifyAuthFlowStage('received_auth_redirect');

          // Step 2: Extract authorization code
          const urlParams = new URLSearchParams(new URL(authRedirectUrl).search);
          const code = urlParams.get('code');
          if (!code) {
            throw new Error('Authorization code not found in redirect URL.');
          }

          // Step 3: Exchange code for tokens
          const tokenResponse = await apiFetch(CONFIG_ENDPOINTS.AUTH_TOKEN, {
            method: 'POST',
            body: { code, redirect_uri: redirectUriForBackend },
            skipAuthReady: true
          });
          if (!tokenResponse.success || !tokenResponse.firebaseToken) {
            throw new Error(tokenResponse.error || 'Failed to exchange code for Firebase token.');
          }

          // Step 4: Sign in to Firebase with custom token
          const userCredential = await signInWithCustomToken(auth, tokenResponse.firebaseToken);
          const user = userCredential.user;
          resolveAuthReady('custom-token-login');
          bgLogger.info('Successfully signed in to Firebase with custom token.');

          await chrome.storage.local.set({
            userEmail: user.email,
            userName: tokenResponse.userName || user.email,
            userId: user.uid,
            userPlan: tokenResponse.userPlan || 'free'
          });

          startPostLoginBackgroundWork(user);

          sendResponse({ success: true, userEmail: user.email, userName: tokenResponse.userName, userPlan: tokenResponse.userPlan, userId: user.uid });
        } catch (error) {
          notifyAuthFlowStage('login_error', { error: error.message });
	          console.error('Applendium Background: Error during Google OAuth login:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'LOGOUT':
        try {
          await signOut(auth);
          bgLogger.info("User signed out from Firebase.");
          // onAuthStateChanged listener will handle clearing storage.
          sendResponse({ success: true });
        } catch (error) {
          console.error("❌ Applendium Background: Error during logout:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_USER_PLAN':
        try {
          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: currentUserEmail, userEmail: currentUserEmail, userId: currentUserId }
          });
          if (response.success) {
            await chrome.storage.local.set({ userPlan: response.plan });
            sendResponse({ success: true, plan: response.plan });
          } else {
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error fetching user plan:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UPDATE_USER_PLAN':
        try {
          const { newPlan } = msg;
          const response = await apiFetch(CONFIG_ENDPOINTS.UPDATE_USER_PLAN, {
            method: 'POST',
            body: { newPlan, userEmail: currentUserEmail, email: currentUserEmail, userId: currentUserId }
          });
          if (response.success) {
            await chrome.storage.local.set({ userPlan: newPlan });
          }
          // Refresh cached emails so application linking (applicationId/isClosed) is reflected in the UI.
          // The backend may have re-linked this email to an existing application.
          try {
            await refreshStoredEmailsCache();
          } catch (e) {
            bgLogger.warn?.('Failed to refresh stored emails after company correction:', e?.message);
          }

          sendResponse(response);
        } catch (error) {
          console.error('❌ Applendium Background: Error updating user plan:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_STORED_EMAILS':
        // This message is now primarily handled by the popup reading directly from chrome.storage.local.
        console.warn("Applendium Background: Received FETCH_STORED_EMAILS, but popup should read directly from local storage.");
        sendResponse({ success: true, message: "Handled by popup's direct storage access." });
        break;

      case 'REFRESH_STORED_EMAILS_CACHE':
        try {
          const staleOnly = msg?.staleOnly !== false;
          if (staleOnly) {
            const stale = await isStoredEmailsCacheStale();
            if (!stale) {
              sendResponse({ success: true, skipped: true, reason: 'cache_fresh' });
              break;
            }
          }

          const refreshed = await refreshStoredEmailsCache(undefined, { skipNotify: true });
          sendResponse(refreshed);
        } catch (error) {
          console.error('❌ Applendium Background: Error refreshing stored email cache:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_NEW_EMAILS':
        try {
          // Use current cached info for sync
          const syncResult = await triggerEmailSync(currentUserEmail, currentUserId, msg.fullRefresh);
          sendResponse(syncResult); // Send back { success: true, categorizedEmails: {...}, quota: {...} }
        } catch (error) {
          console.error("❌ Applendium Background: Error fetching new emails:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

  // Backfill handlers removed

      case 'FETCH_QUOTA_DATA':
        try {
          // Quota polling must not trigger sync/classification work. Use /sync-status.
          if (!currentUserId || !currentUserEmail) {
            sendResponse({ success: false, error: 'Not authenticated' });
            break;
          }

          const status = await apiFetch(CONFIG_ENDPOINTS.SYNC_STATUS, { method: 'GET' });
          if (status?.success && status?.quota) {
            await chrome.storage.local.set({ quotaData: status.quota });
            // If quota indicates activity but the email cache is empty, try a lightweight
            // stored-emails refresh so users don't see "quota used" with no emails.
            try {
              const cached = await chrome.storage.local.get([
                'appliedEmails',
                'interviewedEmails',
                'offersEmails',
                'rejectedEmails',
              ]);
              const cachedCount =
                (cached.appliedEmails || []).length +
                (cached.interviewedEmails || []).length +
                (cached.offersEmails || []).length +
                (cached.rejectedEmails || []).length;
              const quotaUsage = Number(status?.quota?.usage || status?.quota?.totalProcessed || 0);
              if (cachedCount === 0 && quotaUsage > 0) {
                refreshStoredEmailsCache(Boolean(status?.sync?.inProgress), { skipNotify: true, skipBackfill: true }).catch(() => {});
              }
            } catch (_) {
              // ignore
            }
            sendResponse({
              success: true,
              quota: status.quota,
              sync: status.sync,
              dataCompleteness: status.dataCompleteness,
            });
          } else {
            sendResponse({ success: false, error: status?.error || 'Quota data not found in response.' });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error fetching quota data:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_FOLLOWUP_SUGGESTIONS':
        try {
          const response = await apiFetch(CONFIG_ENDPOINTS.FOLLOWUP_NEEDED, {
            method: 'POST',
            body: { userEmail: currentUserEmail, email: currentUserEmail, userId: currentUserId }
          });
          if (response.success && response.suggestions) {
            await chrome.storage.local.set({ followUpSuggestions: response.suggestions });
            sendResponse({ success: true, suggestions: response.suggestions });
          } else {
            sendResponse({ success: false, error: response.error || 'Follow-up suggestions not found.' });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error fetching follow-up suggestions:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SUGGESTION_ACTION':
        try {
          const response = await apiFetch('/api/suggestions/action', {
            method: 'POST',
            body: { 
              threadId: msg.threadId, 
              actionType: msg.actionType,
              userEmail: currentUserEmail, 
              userId: currentUserId 
            }
          });
          // Refresh cached emails so application linking (applicationId/isClosed) is reflected in the UI.
          // This enables the Application Journey to appear and ensures "Active" reflects closure.
          try {
            await refreshStoredEmailsCache();
          } catch (e) {
            bgLogger.warn?.('Failed to refresh stored emails after position correction:', e?.message);
          }

          sendResponse(response);
        } catch (error) {
          console.error('❌ Applendium Background: Error marking suggestion action:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SUGGESTION_SNOOZE':
        try {
          const response = await apiFetch('/api/suggestions/snooze', {
            method: 'POST',
            body: { 
              threadId: msg.threadId, 
              actionType: msg.actionType,
              snoozeDuration: msg.snoozeDuration,
              userEmail: currentUserEmail, 
              userId: currentUserId 
            }
          });
          sendResponse(response);
        } catch (error) {
          console.error('❌ Applendium Background: Error snoozing suggestion:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UNDO_SUGGESTION_ACTION':
        try {
          const response = await apiFetch('/api/suggestions/action', {
            method: 'DELETE',
            body: { 
              threadId: msg.threadId, 
              actionType: msg.actionType,
              userEmail: currentUserEmail, 
              userId: currentUserId 
            }
          });
          sendResponse(response);
        } catch (error) {
          console.error('❌ Applendium Background: Error undoing suggestion action:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SEND_EMAIL_REPLY':
        try {
          const { threadId, recipient, subject, body } = msg;
          const sendResult = await sendGmailReply(threadId, recipient, subject, body, currentUserEmail, currentUserId);
          if (sendResult.success) {
            await triggerEmailSync(currentUserEmail, currentUserId, false);
            sendResponse({ success: true, gmailMessageId: sendResult.gmailMessageId, threadId: sendResult.threadId });
          } else {
            sendResponse({ success: false, error: sendResult.error, needsReauth: sendResult.needsReauth });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error sending email reply:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'ARCHIVE_EMAIL':
        try {
          const response = await apiFetch(CONFIG_ENDPOINTS.ARCHIVE_EMAIL, {
            method: 'POST',
            body: { threadId: msg.threadId, userEmail: currentUserEmail, email: currentUserEmail, userId: currentUserId }
          });
          if (response.success) {
            await triggerEmailSync(currentUserEmail, currentUserId, false); // Trigger sync after archive
          }
          sendResponse(response);
        } catch (error) {
          console.error("❌ Applendium Background: Error archiving email:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'REPORT_MISCLASSIFICATION':
        try {
          const reportData = {
            ...msg.emailData, // Contains emailId, threadId, originalCategory, correctedCategory, emailSubject, emailBody
            userEmail: currentUserEmail, // Override with cached info
            email: currentUserEmail, // Legacy field for backward compatibility
            userId: currentUserId // Override with cached info
          };
          const response = await apiFetch(CONFIG_ENDPOINTS.REPORT_MISCLASSIFICATION, {
            method: 'POST',
            body: reportData
          });
          if (response.success) {
            // Apply the user's correction locally immediately so the UI updates without waiting for a sync.
            // - If corrected to Irrelevant (or backend deleted), remove from cache.
            // - Otherwise, move the email into the corrected category.
            const correctedKey = normalizeCategoryKey(reportData?.correctedCategory);
            const shouldRemoveLocally = correctedKey === 'irrelevant' || response.removed === true;
            const storageKeyByCategory = {
              applied: 'appliedEmails',
              interviewed: 'interviewedEmails',
              offers: 'offersEmails',
              rejected: 'rejectedEmails',
              irrelevant: 'irrelevantEmails',
            };

            const targetStorageKey = storageKeyByCategory[correctedKey];

            if ((shouldRemoveLocally || targetStorageKey) && reportData?.emailId) {
              try {
                const currentEmails = await chrome.storage.local.get([
                  'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
                ]);
	                const categories = ['appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'];
	                const next = {};
	                let movedEmail = null;
	                const targetId = String(reportData.emailId);
	                for (const key of categories) {
	                  const list = currentEmails[key] || [];
	                  const found = list.find((e) => String(e?.id) === targetId);
	                  if (!movedEmail && found) movedEmail = found;
	                  next[key] = list.filter((e) => String(e?.id) !== targetId);
	                }

                if (!shouldRemoveLocally && movedEmail && targetStorageKey) {
                  const updatedEmail = {
                    ...movedEmail,
                    category: capitalizeFirst(correctedKey),
                  };
                  // Put it at the top of the destination category for visibility.
                  next[targetStorageKey] = [updatedEmail, ...(next[targetStorageKey] || [])];
                }

                await chrome.storage.local.set(next);
                safeRuntimeSendMessage({
                  type: 'EMAILS_SYNCED',
                  success: true,
                  categorizedEmails: {
                    applied: next.appliedEmails || [],
                    interviewed: next.interviewedEmails || [],
                    offers: next.offersEmails || [],
                    rejected: next.rejectedEmails || [],
                    irrelevant: next.irrelevantEmails || [],
                  },
                  syncInProgress: false,
                });
              } catch (e) {
                console.warn('Applendium Background: Failed to apply local cache update after misclassification:', e?.message || e);
              }
            }

            // Trigger a sync after misclassification to refresh counts/quota and ensure consistency.
            // Do not await here so the popup gets a fast response and the service worker isn't held open.
            triggerEmailSync(currentUserEmail, currentUserId, false).catch((e) => {
              console.error('Applendium Background: triggerEmailSync failed after misclassification:', e);
            });
            // Notify popup of success
            safeRuntimeSendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: 'Email misclassification reported successfully!',
              msgType: 'success'
            });
          } else {
            // Notify popup of error
            safeRuntimeSendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: `Failed to report misclassification: ${response.error}`,
              msgType: 'error'
            });
          }
          sendResponse(response);
        } catch (error) {
          console.error("❌ Applendium Background: Error reporting misclassification:", error);
          // Notify popup of network/communication error
          safeRuntimeSendMessage({
            type: 'SHOW_NOTIFICATION',
            msg: `Error reporting misclassification: ${error.message}`,
            msgType: 'error'
          });
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UNDO_MISCLASSIFICATION':
        try {
          const undoData = {
            ...msg.undoData, // Contains emailId, threadId, originalCategory, misclassifiedIntoCategory
            userEmail: currentUserEmail, // Override with cached info
            email: currentUserEmail, // Legacy field for backward compatibility
            userId: currentUserId // Override with cached info
          };
          const response = await apiFetch(CONFIG_ENDPOINTS.UNDO_MISCLASSIFICATION, {
            method: 'POST',
            body: undoData
          });
          if (response.success) {
            await triggerEmailSync(currentUserEmail, currentUserId, false); // Trigger sync after undo
            // Notify popup of success
            safeRuntimeSendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: 'Misclassification undone successfully!',
              msgType: 'success'
            });
          } else {
            // Notify popup of error
            safeRuntimeSendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: `Failed to undo misclassification: ${response.error}`,
              msgType: 'error'
            });
          }
          sendResponse(response);
        } catch (error) {
          console.error("❌ Applendium Background: Error undoing misclassification:", error);
          // Notify popup of network/communication error
          safeRuntimeSendMessage({
            type: 'SHOW_NOTIFICATION',
            msg: `Error undoing misclassification: ${error.message}`,
            msgType: 'error'
          });
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'MARK_SINGLE_EMAIL_AS_READ':
        try {
          const { emailId } = msg.payload;

          // Wait for auth to initialize before checking user/token state
          await waitForAuthReady();

          if (!emailId) {
            throw new Error("Email ID was not provided.");
          }

          // Call the backend; apiFetch will attach a fresh ID token if the user is logged in.
          // The backend derives the user from the token, so userId in the body is not required.
          const response = await apiFetch('/api/emails/mark-as-read', {
            method: 'POST',
            body: { emailId }
          });

          sendResponse(response);

        } catch (error) {
          console.error("❌ Applendium Background: Error in MARK_SINGLE_EMAIL_AS_READ:", error);
          const message = error?.message || 'Unknown error';
          // Provide a clearer signal for auth issues so UI can prompt login
          if (message.includes('401') || message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('session expired')) {
            sendResponse({ success: false, error: 'auth-required' });
          } else {
            sendResponse({ success: false, error: message });
          }
        }
        break;

      case 'MARK_AS_READ':
        try {
          const { category, userId: targetUserId } = msg.payload;
          // Ensure we have a user and it matches the targetUserId for security
          const user = auth.currentUser;
          if (!user || user.uid !== targetUserId) {
            sendResponse({ success: false, error: "Unauthorized or user mismatch for marking as read." });
            return;
          }

          // First persist change on backend (new batch endpoint)
          try {
            await apiFetch(`/api/emails/mark-as-read-category`, {
              method: 'POST',
              body: { category: capitalizeFirst(category) }
            });
          } catch (persistErr) {
            console.warn('Applendium Background: Backend mark-as-read-category failed, aborting local update:', persistErr?.message);
            sendResponse({ success: false, error: persistErr.message });
            return;
          }

          // Fetch current emails from local storage to update their read status
          const currentEmails = await chrome.storage.local.get([
            'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
          ]);

          // Normalize incoming category key to expected storage suffix
          const storageKey = `${category}Emails`;

          const updatedCategoryEmails = (currentEmails[storageKey] || []).map(email => ({
            ...email,
            // Align with UI state which uses `is_read`
            is_read: true
          }));

          // Save updated emails back to local storage
          await chrome.storage.local.set({ [`${category}Emails`]: updatedCategoryEmails });
          console.log(`✅ Applendium Background: Marked emails in category '${category}' as read in local storage.`);

          sendResponse({ success: true, message: `Emails in ${category} marked as read.` });
        } catch (error) {
          console.error("❌ Applendium Background: Error marking emails as read:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UPDATE_COMPANY_NAME':
        try {
          const { emailId, companyName } = msg;
          
          if (!emailId || !companyName) {
            sendResponse({ success: false, error: 'Missing required parameters (emailId or companyName).' });
            return;
          }

          // Call backend PATCH /emails/:emailId/company endpoint
          const response = await apiFetch(`/api/emails/${emailId}/company`, {
            method: 'PATCH',
            body: { companyName: companyName.trim() }
          });

          if (response.success && response.email) {
            // Update local storage with the corrected company name
            const currentEmails = await chrome.storage.local.get([
              'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
            ]);

            // Find and update the email in the appropriate category
            const categories = ['appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'];
            for (const categoryKey of categories) {
              const emails = currentEmails[categoryKey] || [];
              const emailIndex = emails.findIndex(e => e.id === emailId);
              if (emailIndex !== -1) {
                emails[emailIndex] = {
                  ...emails[emailIndex],
                  company_name: response.email.company_name,
                  company_name_corrected: response.email.company_name_corrected,
                  extraction_method: response.email.extraction_method
                };
                await chrome.storage.local.set({ [categoryKey]: emails });
                bgLogger.info(`Updated company name for email ${emailId} in ${categoryKey}`);
                break;
              }
            }
          }

          sendResponse(response);
        } catch (error) {
          console.error("❌ Applendium Background: Error updating company name:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GET_CORRECTION_ANALYTICS':
        try {
          const { since } = msg;
          
          // Build query params
          const queryParams = since ? { since } : {};

          // Call backend GET /analytics/corrections endpoint
          const response = await apiFetch('/api/emails/analytics/corrections', {
            method: 'GET',
            query: queryParams
          });

          sendResponse(response);
        } catch (error) {
          console.error("❌ Applendium Background: Error fetching correction analytics:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UPDATE_POSITION':
        try {
          const { emailId, position } = msg;
          
          if (!emailId || !position) {
            sendResponse({ success: false, error: 'Missing required parameters (emailId or position).' });
            return;
          }

          // Call backend PATCH /emails/:emailId/position endpoint
          const response = await apiFetch(`/api/emails/${emailId}/position`, {
            method: 'PATCH',
            body: { position: position.trim() }
          });

          if (response.success && response.email) {
            // Update local storage with the corrected position
            const currentEmails = await chrome.storage.local.get([
              'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
            ]);

            // Find and update the email in the appropriate category
            const categories = ['appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'];
            for (const categoryKey of categories) {
              const emails = currentEmails[categoryKey] || [];
              const emailIndex = emails.findIndex(e => e.id === emailId);
              if (emailIndex !== -1) {
                emails[emailIndex] = {
                  ...emails[emailIndex],
                  position: response.email.position,
                  position_corrected: response.email.position_corrected,
                  extraction_method: response.email.extraction_method
                };
                await chrome.storage.local.set({ [categoryKey]: emails });
                bgLogger.info(`Updated position for email ${emailId} in ${categoryKey}`);
                break;
              }
            }
          }

          sendResponse(response);
        } catch (error) {
          console.error("❌ Applendium Background: Error updating position:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GET_CURRENT_USER':
        try {
          const user = auth.currentUser;
          if (user && !user.isAnonymous) {
            sendResponse({ 
              success: true, 
              user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName
              }
            });
          } else {
            sendResponse({ success: false, user: null });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error getting current user:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_APPLICATION_LIFECYCLE':
        try {
          const { applicationId } = msg;
          if (!applicationId) {
            sendResponse({ success: false, error: 'Application ID is required' });
            break;
          }

          const response = await apiFetch(`/api/emails/applications/${applicationId}/lifecycle`, {
            method: 'GET'
          });

          if (response.success) {
            try {
              await patchCachedEmailsFromLifecycle(applicationId, response.application, response.lifecycle);
            } catch (e) {
              bgLogger.warn?.('Failed to patch cached emails from lifecycle:', e?.message);
            }
            sendResponse({ 
              success: true, 
              application: response.application,
              lifecycle: response.lifecycle 
            });
          } else {
            sendResponse({ success: false, error: response.error || 'Failed to fetch lifecycle' });
          }
        } catch (error) {
          bgLogger.error('Error fetching application lifecycle:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'LINK_APPLICATION_ROLE':
        try {
          const { emailId } = msg;
          if (!emailId) {
            sendResponse({ success: false, error: 'Email ID is required' });
            break;
          }

          const response = await apiFetch('/api/emails/applications/link-role', {
            method: 'POST',
            body: { emailId }
          });

          if (response?.success) {
            if (Array.isArray(response.emailUpdates) && response.emailUpdates.length > 0) {
              await patchCachedEmailsFromResolvedUpdates(response.emailUpdates);
            }
            try {
              await refreshStoredEmailsCache();
            } catch (e) {
              bgLogger.warn?.('Failed to refresh stored emails after role-link:', e?.message);
            }
          }

          sendResponse(response);
        } catch (error) {
          bgLogger.error('Error linking role emails:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'CLOSE_APPLICATION':
        try {
          const { applicationId, emailId, reason } = msg || {};
          if (!applicationId) {
            sendResponse({ success: false, error: 'Application ID is required' });
            break;
          }

          const endpoint = CONFIG_ENDPOINTS.CLOSE_APPLICATION.replace(':applicationId', encodeURIComponent(applicationId));
          const response = await apiFetch(endpoint, {
            method: 'POST',
            body: { reason, emailId }
          });

          if (response?.success && response?.application) {
            await patchCachedEmailsForApplication(response.application.id || applicationId, response.application);
            try {
              await refreshStoredEmailsCache();
            } catch (e) {
              bgLogger.warn?.('Failed to refresh stored emails after close-application:', e?.message);
            }
          }

          sendResponse(response);
        } catch (error) {
          bgLogger.error('Error closing application:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'REOPEN_APPLICATION':
        try {
          const { applicationId, emailId } = msg || {};
          if (!applicationId) {
            sendResponse({ success: false, error: 'Application ID is required' });
            break;
          }

          const endpoint = CONFIG_ENDPOINTS.REOPEN_APPLICATION.replace(':applicationId', encodeURIComponent(applicationId));
          const response = await apiFetch(endpoint, {
            method: 'POST',
            body: { emailId }
          });

          if (response?.success && response?.application) {
            await patchCachedEmailsForApplication(response.application.id || applicationId, response.application);
            try {
              await refreshStoredEmailsCache();
            } catch (e) {
              bgLogger.warn?.('Failed to refresh stored emails after reopen-application:', e?.message);
            }
          }

          sendResponse(response);
        } catch (error) {
          bgLogger.error('Error reopening application:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'REPAIR_APPLICATION_LINKS':
        try {
          const { applicationId, emailId } = msg || {};
          if (!applicationId) {
            sendResponse({ success: false, error: 'Application ID is required' });
            break;
          }

          const endpoint = CONFIG_ENDPOINTS.REPAIR_APPLICATION_LINKS.replace(':applicationId', encodeURIComponent(applicationId));
          const response = await apiFetch(endpoint, {
            method: 'POST',
            body: emailId ? { emailId } : {},
          });

          if (response?.success) {
            if (Array.isArray(response.emailUpdates) && response.emailUpdates.length > 0) {
              await patchCachedEmailsFromResolvedUpdates(response.emailUpdates);
            }
            try {
              await refreshStoredEmailsCache();
            } catch (e) {
              bgLogger.warn?.('Failed to refresh stored emails after repair-links:', e?.message);
            }
          }

          sendResponse(response);
        } catch (error) {
          bgLogger.error('Error repairing application links:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GET_ID_TOKEN':
        try {
          // Wait for Firebase Auth to finish loading from IndexedDB
          // (critical on service-worker cold start)
          await waitForAuthReady();
          const user = auth.currentUser;
          if (user && !user.isAnonymous) {
            const token = await user.getIdToken();
            sendResponse({ success: true, token });
          } else {
            sendResponse({ success: false, error: 'User not authenticated' });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error getting ID token:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_PAYMENT_SUCCESS__':
        try {
          // Add a delay to allow webhook processing to complete
          console.log('🔄 Applendium Background: Waiting 3 seconds for webhook processing...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Refresh user plan data after successful payment
          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: currentUserEmail, userEmail: currentUserEmail, userId: currentUserId }
          });
          
          if (response.success) {
            await chrome.storage.local.set({ userPlan: response.plan });
            console.log('✅ Applendium Background: User plan refreshed after payment:', response.plan);
            sendResponse({ success: true, plan: response.plan });
          } else {
            console.error('❌ Applendium Background: Failed to refresh user plan after payment:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error refreshing user plan after payment:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_CHECK_PAYMENT_STATUS__':
        try {
          // Check current user payment status from backend
          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: msg.userEmail, userEmail: msg.userEmail, userId: msg.userId }
          });
          
          if (response.success) {
            console.log('✅ Applendium Background: Payment status checked:', response.plan);
            sendResponse({ success: true, plan: response.plan });
          } else {
            console.error('❌ Applendium Background: Failed to check payment status:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error checking payment status:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_CHECK_SUBSCRIPTION_STATUS__':
        try {
          // Check subscription status using authenticated endpoint
          const response = await apiFetch('/api/subscriptions/status', {
            method: 'GET'
          });
          
          if (response.success) {
            console.log('✅ Applendium Background: Subscription status checked:', response.subscription);
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ Applendium Background: Failed to check subscription status:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error checking subscription status:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_CREATE_CHECKOUT_SESSION__':
        try {
          // Create Stripe checkout session using authenticated endpoint
          const response = await apiFetch('/api/subscriptions/create-checkout-session', {
            method: 'POST',
            body: { priceId: msg.priceId }
          });
          
          if (response.success) {
            console.log('✅ Applendium Background: Checkout session created:', response.url);
            sendResponse({ success: true, url: response.url });
          } else {
            console.error('❌ Applendium Background: Failed to create checkout session:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error creating checkout session:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_CREATE_SETUP_INTENT__':
        try {
          // Create setup intent for payment method update
          const response = await apiFetch('/api/subscriptions/create-setup-intent', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ Applendium Background: Setup intent created:', response.client_secret);
            sendResponse({ success: true, client_secret: response.client_secret });
          } else {
            console.error('❌ Applendium Background: Failed to create setup intent:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error creating setup intent:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_OPEN_CUSTOMER_PORTAL__':
        try {
          const { return_url } = msg;
          console.log('🎫 Applendium Background: Creating customer portal session');
          
          const response = await apiFetch('/api/subscriptions/create-portal-session', {
            method: 'POST',
            body: JSON.stringify({ 
              return_url: return_url || chrome.runtime.getURL('popup/index.html')
            })
          });
          
          if (response.success && response.url) {
            console.log('✅ Applendium Background: Portal session created');
            
            // Open portal in new tab
            const tab = await chrome.tabs.create({
              url: response.url,
              active: true
            });
            
            console.log('🪟 Applendium Background: Portal opened in tab:', tab.id);
            sendResponse({ success: true, tabId: tab.id });
          } else {
            console.error('❌ Applendium Background: Failed to create portal session:', response.error);
            sendResponse({ success: false, error: response.error || 'Failed to create portal session' });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error creating portal session:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_OPEN_PAYMENT_WINDOW__':
        try {
          const { url } = msg;
          console.log('🪟 Applendium Background: Opening payment window:', url);
          
          // Open Stripe checkout in a new tab
          const tab = await chrome.tabs.create({
            url: url,
            active: true
          });

          // Monitor payment flow and respond when complete
          const paymentResult = await monitorPaymentFlow(tab.id, currentUserEmail, currentUserId);
          sendResponse(paymentResult);
        } catch (error) {
          console.error('❌ Applendium Background: Error opening payment window:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_OPEN_PORTAL_WINDOW__':
        // Portal functionality removed - using fully in-extension approach
        console.log('⚠️ Applendium Background: Portal window opening removed - using in-extension approach');
        sendResponse({ success: false, error: 'Portal functionality removed for fully in-extension approach' });
        break;

      case '__DISABLED_CANCEL_SUBSCRIPTION__':
        try {
          console.log('🗑️ Applendium Background: Canceling subscription');
          
          const response = await apiFetch('/api/subscriptions/cancel', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ Applendium Background: Subscription canceled successfully');
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ Applendium Background: Failed to cancel subscription:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error canceling subscription:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_RESUME_SUBSCRIPTION__':
        try {
          console.log('🔄 Applendium Background: Resuming subscription');
          
          const response = await apiFetch('/api/subscriptions/resume', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ Applendium Background: Subscription resumed successfully');
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ Applendium Background: Failed to resume subscription:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error resuming subscription:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SEARCH_EMAILS':
        try {
          const { query } = msg;
          
          if (!query || query.trim().length === 0) {
            sendResponse({ success: true, applications: [], totalResults: 0, query: '' });
            return;
          }

          console.log('🔍 Applendium Background: Searching emails with query:', query);
          
          const response = await apiFetch('/api/emails/search', {
            method: 'GET',
            query: { q: query }
          });
          
          if (response.success) {
            console.log('✅ Applendium Background: Search completed, found', response.totalResults, 'results');
            sendResponse({ 
              success: true, 
              applications: response.applications,
              totalResults: response.totalResults,
              query: response.query
            });
          } else {
            console.error('❌ Applendium Background: Search failed:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error searching emails:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'TOGGLE_STAR':
        try {
          const { emailId, isStarred } = msg;
          
          if (!emailId) {
            sendResponse({ success: false, error: 'Email ID is required' });
            return;
          }

          console.log(`⭐ Applendium Background: ${isStarred ? 'Starring' : 'Unstarring'} email ${emailId}`);
          
          const response = await apiFetch(`/api/emails/${emailId}/star`, {
            method: 'POST',
            body: { isStarred: isStarred }
          });
          
          if (response.success) {
            console.log(`✅ Applendium Background: Email ${isStarred ? 'starred' : 'unstarred'} successfully`);
            
            // Update local storage to reflect star change
            const storage = await chrome.storage.local.get([
              'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
            ]);
            
            for (const key of ['appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails']) {
              const emails = storage[key] || [];
              const emailIndex = emails.findIndex(e => e.id === emailId);
              
              if (emailIndex !== -1) {
                emails[emailIndex] = {
                  ...emails[emailIndex],
                  is_starred: isStarred
                };
                await chrome.storage.local.set({ [key]: emails });
                console.log(`Updated star status for email ${emailId} in ${key}`);
                break;
              }
            }
            
            // Broadcast update to popup
            safeRuntimeSendMessage({
              type: 'EMAIL_STARRED_UPDATED',
              emailId: emailId,
              isStarred: isStarred
            });
            
            sendResponse({ 
              success: true, 
              isStarred: response.isStarred,
              emailId: response.emailId
            });
          } else if (response.premiumOnly) {
            console.log('⚠️ Applendium Background: Premium subscription required to star emails');
            sendResponse({ success: false, error: response.error, premiumOnly: true });
          } else {
            console.error('❌ Applendium Background: Star toggle failed:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ Applendium Background: Error toggling star:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        console.warn('Applendium: Unhandled message type:', msg.type);
        sendResponse({ success: false, error: 'Unhandled message type.' });
    }
  })(); // End of async IIFE

  // Return true to indicate that sendResponse will be called asynchronously.
  return true;
});


// --- Configure Firebase Auth Persistence ---
setPersistence(auth, indexedDBLocalPersistence)
  .then(() => {
    console.log("✅ Applendium Background: Firebase Auth persistence set to IndexedDB.");
	    onAuthStateChanged(auth, async (user) => {
	      // Resolve the authReadyPromise once the initial auth state is determined
	      resolveAuthReady('auth-state-change');

	      if (user) {
	        console.log("✅ Applendium Background: Auth State Changed - User logged in:", user.email, "UID:", user.uid);
	        // Ensure userEmail and userId are immediately available in local storage
	        await chrome.storage.local.set({
	          userEmail: user.email,
	          userName: user.displayName || user.email,
	          userId: user.uid,
	        });

	        // Notify the popup immediately so it can render and load cached data.
	        safeRuntimeSendMessage({ type: 'AUTH_READY', success: true, loggedOut: false });
	        broadcastAuthStateToContentScripts(true, user.email);

	        if (!user.isAnonymous) {
	          // Best-effort: refresh stored emails immediately after login so the popup can show
	          // existing DB data while a potentially long sync is running (Cloud Run / classifier cold starts).
	          refreshStoredEmailsCache(true, { skipNotify: true, skipBackfill: true }).catch((e) => {
	            bgLogger.warn?.('Failed to prefetch stored emails after auth:', e?.message);
	          });

	          // Fetch user plan in the background (do not block UI readiness).
	          (async () => {
	            try {
	              const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
	                method: 'POST',
	                body: { email: user.email, userId: user.uid }
	              });
	              if (response.success) {
	                await chrome.storage.local.set({ userPlan: response.plan });
	                console.log("✅ Applendium Background: User plan fetched and stored:", response.plan);
	              } else {
	                console.error("❌ Applendium Background: Failed to fetch user plan during auth state change:", response.error);
	              }
	            } catch (error) {
	              console.error("❌ Applendium Background: Network/communication error fetching user plan during auth state change:", error);
	            }
	          })();

	          // Start syncing in the background (do not await).
	          (async () => {
	            // After a user logs in (or re-authenticates), decide whether to do a full refresh.
	            // If last sync is stale (> 24h) or unknown, force full refresh to catch up.
	            let shouldFull = true;
	            try {
	              const status = await apiFetch(CONFIG_ENDPOINTS.SYNC_STATUS, { method: 'GET' });
	              const last = status?.sync?.lastSyncAt ? new Date(status.sync.lastSyncAt) : null;
	              if (last && (Date.now() - last.getTime()) < 24 * 60 * 60 * 1000) {
	                shouldFull = false;
	              }
	            } catch (_) {
	              shouldFull = true;
	            }

	            try {
	              await triggerEmailSync(user.email, user.uid, shouldFull);
	            } catch (e) {
	              console.error('Applendium Background: triggerEmailSync failed after auth state change:', e);
	            }
	          })();
	        } else {
	          console.log("Applendium Background: Anonymous user detected. Not fetching plan or syncing emails.");
	        }
	      } else {
	        console.log("✅ Applendium Background: Auth State Changed - User logged out.");
	        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan', 'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'quotaData', 'followUpSuggestions']); // Clear all cached data on logout
	        safeRuntimeSendMessage({ type: 'AUTH_READY', success: true, loggedOut: true });
	        broadcastAuthStateToContentScripts(false, null);
	      }
	    });
  })
  .catch((error) => {
    console.error("❌ Applendium Background: Error setting Firebase Auth persistence:", error);
    // Even if persistence fails, still listen for auth state changes
	    onAuthStateChanged(auth, async (user) => {
      // Resolve the authReadyPromise even if persistence setup failed
      resolveAuthReady('auth-state-change-without-persistence');

	      if (user) {
	        console.log("Applendium Background: Auth State Changed (without persistence) - User logged in:", user.email);
	        await chrome.storage.local.set({ userEmail: user.email, userName: user.displayName || user.email, userId: user.uid });
	        safeRuntimeSendMessage({ type: 'AUTH_READY', success: true, loggedOut: false });
	        broadcastAuthStateToContentScripts(true, user.email);
	        // Still try to sync emails even if persistence failed
	        if (!user.isAnonymous) {
	          triggerEmailSync(user.email, user.uid, false).catch((e) => {
	            console.error('Applendium Background: triggerEmailSync failed after auth state change (no persistence):', e);
	          });
	        }
	      } else {
	        console.log("Applendium Background: Auth State Changed (without persistence) - User logged out.");
	        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan', 'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'quotaData', 'followUpSuggestions']);
	        safeRuntimeSendMessage({ type: 'AUTH_READY', success: true, loggedOut: true });
	        broadcastAuthStateToContentScripts(false, null);
	      }
	    });
	  });


// --- Chrome Alarms (for scheduled sync) ---
chrome.alarms.create('syncEmails', { periodInMinutes: SYNC_INTERVAL_MINUTES });
chrome.alarms.create('syncWatchdog', { periodInMinutes: WATCHDOG_INTERVAL_MIN });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncEmails') {
    console.log('⏰ Applendium: Syncing emails via alarm...');
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      try {
        const result = await chrome.storage.local.get(['userEmail', 'userId']);
        if (result.userEmail && result.userId) {
          await triggerEmailSync(result.userEmail, result.userId, false); // No full refresh on alarm
        } else {
          console.warn('Applendium: User not logged in or user info missing for alarm sync.');
        }
      } catch (error) {
        console.error('❌ Applendium: Error during alarm-triggered email sync:', error);
        safeRuntimeSendMessage({ type: 'EMAILS_SYNCED', success: false, error: error.message });
      }
    } else {
      console.log('Applendium: Skipping email sync for unauthenticated or anonymous user.');
    }
  } else if (alarm.name === 'syncWatchdog') {
    // Periodic stuck-lock check
    await checkSyncWatchdog();
  }
});


/**
 * @file background.js
 * @description This script handles background tasks for the ThreadHQ extension,
 * including email synchronization, user authentication, and misclassification reporting.
 * It operates as a service worker, listening for alarms and messages from the popup.
 */

// Import necessary Firebase modules.
import { initializeApp } from 'firebase/app';
// CORRECTED: Added setPersistence, indexedDBLocalPersistence for auth state persistence
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';

import { firebaseConfig } from './firebaseConfig';

// Initialize Firebase App in the background script.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Constants ---
const SYNC_INTERVAL_MINUTES = 5; // How often to sync emails
const UNDO_TIMEOUT_MS = 10000; // 10 seconds for undo toast
// Watchdog to detect unusually long-running sync locks
const STUCK_LOCK_THRESHOLD_MIN = 15; // minutes a sync may run before considered stuck
const WATCHDOG_INTERVAL_MIN = 5; // how often to check for stuck syncs

// --- OS Notifications (service worker) ---
// These notifications show even when the popup UI is closed, as long as Chrome is running.
const NOTIFICATIONS_ENABLED_KEY = 'appmailiaNotificationsEnabledV1';
const NOTIFICATIONS_INITIALIZED_KEY = 'appmailiaNotificationsInitializedV1';

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

async function maybeNotifyNewEmails(prevCategorizedEmails, nextCategorizedEmails, syncInProgress) {
  // Avoid spamming while a long sync is still running; notify only on completion/manual refresh.
  if (syncInProgress === true) return;

  let enabled = true;
  let initialized = false;
  try {
    const state = await chrome.storage.local.get([NOTIFICATIONS_ENABLED_KEY, NOTIFICATIONS_INITIALIZED_KEY]);
    if (typeof state?.[NOTIFICATIONS_ENABLED_KEY] === 'boolean') enabled = state[NOTIFICATIONS_ENABLED_KEY];
    initialized = !!state?.[NOTIFICATIONS_INITIALIZED_KEY];
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
    const company = (sample.company_name || sample.company || 'Unknown company').toString();
    const position = (sample.position || sample.job_title || 'Unknown role').toString();

    const title = meta.title;
    const message =
      list.length === 1
        ? `${company} — ${position}`
        : `${list.length} new ${meta.plural}. Latest: ${company} — ${position}`;

    try {
      chrome.notifications.create(`appmailia_${cat}_${sample.id || Date.now()}`, {
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
  BACKEND_BASE_URL: 'http://localhost:3000', // Development backend URL
  // To switch to production, set to: 'https://gmail-tracker-backend-215378038667.us-central1.run.app'
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
let authReadyResolve;
const authReadyPromise = new Promise(resolve => {
  authReadyResolve = resolve;
});

// --- Sync de-duplication state ---
let syncInFlight = false;
let lastSyncStartTs = 0;

// --- Token refresh de-duplication ---
let tokenRefreshPromise = null;

async function getFreshToken(user) {
  if (!tokenRefreshPromise) {
    tokenRefreshPromise = user.getIdToken(true)
      .finally(() => { tokenRefreshPromise = null; });
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
  // Wait for authentication to be ready before proceeding
  await authReadyPromise;

  // SECURITY: DEV_BACKEND override removed to prevent malicious redirect attacks
  // For local development, modify CONFIG_ENDPOINTS.BACKEND_BASE_URL directly in code
  
  const user = auth.currentUser;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

    if (user && !user.isAnonymous) { // Only attempt to get ID token for non-anonymous users
    try {
      const idToken = await getFreshToken(user); // Use deduplicated token refresh
      headers['Authorization'] = `Bearer ${idToken}`;
      bgLogger.info(`Attached fresh ID token for user: ${user.uid}`);
    } catch (error) {
      bgLogger.error("Failed to get fresh Firebase ID token:", error);
      
      if (error.code === 'auth/user-token-expired' || error.code === 'auth/invalid-user-token') {
        console.warn("ThreadHQ: Unrecoverable auth token error. Forcing user logout.");

        await signOut(auth);

        chrome.runtime.sendMessage({
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
  let url = `${CONFIG_ENDPOINTS.BACKEND_BASE_URL}${endpoint}`;
  if (options.query && typeof options.query === 'object') {
    const qs = new URLSearchParams(options.query).toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }
  bgLogger.info(`API call: ${url} method=${options.method || 'GET'}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: headers,
      // Ensure body is stringified only if it's an object and not already a string
      body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ThreadHQ: API Error ${response.status} from ${url}:`, errorText);
      
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
    console.error(`❌ ThreadHQ: Network or parsing error for ${url}:`, error);
    throw new Error(`Network or server error: ${error.message}`);
  }
}

/**
 * Fetch stored emails from backend and update local cache, then notify popup.
 */
async function refreshStoredEmailsCache(syncInProgress = undefined) {
  try {
    // Snapshot prior cache before fetching so we can detect newly-added emails.
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

    const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_STORED_EMAILS, { 
      method: 'POST',
      body: { limit: 5000 } // Premium users may have deeper history; backend clamps per-plan.
    });
    if (response.success && response.categorizedEmails) {
      // One-time backfill: older stored emails may not have been linked into `email_applications` yet,
      // which prevents Application Journey timelines and can cause incorrect "Active" labeling.
      const APP_LINK_BACKFILL_KEY = 'appLinksBackfilledV1';
      const tryBackfill = async () => {
        try {
          const state = await chrome.storage.local.get([APP_LINK_BACKFILL_KEY]);
          if (state && state[APP_LINK_BACKFILL_KEY]) return false;
        } catch (_) {
          // ignore
        }

        const allRelevant = [
          ...(response.categorizedEmails.applied || []),
          ...(response.categorizedEmails.interviewed || []),
          ...(response.categorizedEmails.offers || []),
          ...(response.categorizedEmails.rejected || []),
        ];

        const needsLinking = allRelevant.some(e => {
          if (e?.applicationId) return false;
          const company = e?.company_name;
          const position = e?.position;
          return !!(company && position);
        });
        if (!needsLinking) {
          try {
            await chrome.storage.local.set({ [APP_LINK_BACKFILL_KEY]: true });
          } catch (_) {
            // ignore
          }
          return false;
        }

        try {
          bgLogger.info('[backfill] Running one-time application linking backfill...');
          const backfillRes = await apiFetch('/api/emails/applications/backfill', {
            method: 'POST',
            body: { limit: 5000 }
          });
          if (backfillRes && backfillRes.success) {
            try {
              await chrome.storage.local.set({ [APP_LINK_BACKFILL_KEY]: true });
            } catch (_) {
              // ignore
            }
            return true;
          }
        } catch (e) {
          bgLogger.warn?.('[backfill] Backfill failed:', e?.message);
        }
        return false;
      };

      const didBackfill = await tryBackfill();
      if (didBackfill) {
        // Refetch once so cached emails include `applicationId` and updated `isClosed`.
        const refreshed = await apiFetch(CONFIG_ENDPOINTS.FETCH_STORED_EMAILS, {
          method: 'POST',
          body: { limit: 5000 }
        });
        if (refreshed.success && refreshed.categorizedEmails) {
          response.categorizedEmails = refreshed.categorizedEmails;
        }
      }

      try {
        await maybeNotifyNewEmails(previousCache, response.categorizedEmails, syncInProgress);
      } catch (e) {
        bgLogger.warn('Notification check failed:', e?.message);
      }

      await chrome.storage.local.set({
        appliedEmails: response.categorizedEmails.applied || [],
        interviewedEmails: response.categorizedEmails.interviewed || [],
        offersEmails: response.categorizedEmails.offers || [],
        rejectedEmails: response.categorizedEmails.rejected || [],
        irrelevantEmails: response.categorizedEmails.irrelevant || [],
      });
      chrome.runtime.sendMessage({
        type: 'EMAILS_SYNCED',
        success: true,
        categorizedEmails: response.categorizedEmails,
  syncInProgress,
      });
    }
  } catch (e) {
    console.warn('ThreadHQ Background: refreshStoredEmailsCache failed:', e?.message);
  }
}

/**
 * Poll the sync status and periodically refresh stored emails until complete or timeout.
 * FIXED: Reduced polling from 2s to 10s to avoid exhausting Gmail API quota
 */
async function pollSyncStatusAndRefresh(maxSeconds = 60, intervalMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    try {
    const status = await apiFetch(CONFIG_ENDPOINTS.SYNC_STATUS, { method: 'GET' });
      if (status?.success) {
        if (status.sync?.inProgress) {
          // Pull latest stored emails incrementally
      await refreshStoredEmailsCache(true);
        } else {
          // One final refresh at completion
      await refreshStoredEmailsCache(false);
          return;
        }
      }
    } catch (e) {
      console.warn('ThreadHQ Background: sync-status polling error:', e?.message);
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
      chrome.runtime.sendMessage({
        type: 'SYNC_STUCK',
        minutesInProgress: Math.round(mins),
        thresholdMinutes: STUCK_LOCK_THRESHOLD_MIN,
        sync: status.sync,
      });
    }
  } catch (e) {
    console.warn('ThreadHQ Background: watchdog check failed:', e?.message);
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
    console.error('❌ ThreadHQ Background: Cannot trigger email sync, userEmail or userId is missing.');
    return { success: false, error: 'User email or ID missing for sync.' };
  }

  // Coalesce duplicate sync triggers
  if (syncInFlight) {
    // Return current cached emails immediately instead of hitting backend again
    const cached = await chrome.storage.local.get([
      'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'quotaData'
    ]);
    return {
      success: true,
      categorizedEmails: {
        applied: cached.appliedEmails || [],
        interviewed: cached.interviewedEmails || [],
        offers: cached.offersEmails || [],
        rejected: cached.rejectedEmails || [],
      },
      quota: cached.quotaData || null,
      sync: { inProgress: true }
    };
  }

  syncInFlight = true;
  lastSyncStartTs = Date.now();

  try {
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

    // NEW: Fetch application statistics in parallel
    let applicationStats = null;
    try {
      const statsResponse = await apiFetch(CONFIG_ENDPOINTS.APPLICATION_STATS, {
        method: 'GET'
      });
      if (statsResponse.success && statsResponse.stats) {
        applicationStats = statsResponse.stats;
        bgLogger.info('Application stats fetched:', applicationStats);
      }
    } catch (error) {
      bgLogger.error('Failed to fetch application stats:', error);
      // Continue without stats - this is not critical
    }

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
        chrome.runtime.sendMessage({
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
        await chrome.storage.local.set({
          quotaData: response.quota || null,
          categoryTotals: response.categoryTotals || null, // NEW: Update category totals even during sync
          applicationStats: applicationStats || null // NEW: Update application stats even during sync
        });
        bgLogger.info('Sync in progress - updated quota and category totals only, preserving existing emails in storage.');
        
        // Read current emails from chrome.storage to send to UI
        const cached = await chrome.storage.local.get([
          'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
        ]);
        
        // Notify UI with current cached data (not stale backend data)
        chrome.runtime.sendMessage({
          type: 'EMAILS_SYNCED',
          success: true,
          categorizedEmails: {
            applied: cached.appliedEmails || [],
            interviewed: cached.interviewedEmails || [],
            offers: cached.offersEmails || [],
            rejected: cached.rejectedEmails || [],
            irrelevant: cached.irrelevantEmails || []
          },
          categoryTotals: response.categoryTotals, // NEW: Pass category totals to popup
          applicationStats: applicationStats, // NEW: Pass application stats to popup
          quota: response.quota,
          userEmail: userEmail,
          syncInProgress: true
        });
      }

      // If backend indicates a background sync is in progress, start polling without blocking
      if (response.sync?.inProgress) {
        pollSyncStatusAndRefresh().catch(e => console.warn('ThreadHQ Background: polling failed:', e?.message));
      }
      return { success: true, categorizedEmails: response.categorizedEmails, quota: response.quota };
    } else {
      // Check if this is a scope or auth error requiring re-authentication
      if (response.errorCode === 'INSUFFICIENT_SCOPES' || response.errorCode === 'INVALID_GRANT' || response.requiresReauth) {
        console.error('❌ ThreadHQ Background: Auth error - user needs to re-authenticate:', response.errorCode);
        
        // Send appropriate message type based on error
        const messageType = response.errorCode === 'INVALID_GRANT' ? 'AUTH_ERROR' : 'SCOPE_ERROR';
        const errorMessage = response.errorCode === 'INVALID_GRANT' 
          ? 'Your Google session has expired. Please sign out and sign back in.'
          : 'Your Gmail permissions are incomplete. Please sign out and sign in again.';
        
        // Notify popup about auth error
        chrome.runtime.sendMessage({
          type: messageType,
          errorCode: response.errorCode,
          error: response.error || errorMessage,
          requiresReauth: true
        });
        
        return { success: false, error: response.error, errorCode: response.errorCode || 'INSUFFICIENT_SCOPES', requiresReauth: true };
      }
      
      console.error('❌ ThreadHQ Background: Backend sync failed or returned no emails:', response.error);
      return { success: false, error: response.error || "Backend sync failed or returned no emails." };
    }
  } catch (error) {
    console.error('❌ ThreadHQ Background: Error during email sync:', error);
    
    // Check if the error response has scope/auth error information
    if (error.errorCode === 'INSUFFICIENT_SCOPES' || error.errorCode === 'INVALID_GRANT' || error.requiresReauth) {
      // Send appropriate message type based on error
      const messageType = error.errorCode === 'INVALID_GRANT' ? 'AUTH_ERROR' : 'SCOPE_ERROR';
      const errorMessage = error.errorCode === 'INVALID_GRANT' 
        ? 'Your Google session has expired. Please sign out and sign back in.'
        : 'Your Gmail permissions are incomplete. Please sign out and sign in again.';
      
      chrome.runtime.sendMessage({
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
        console.warn('⚠️ ThreadHQ Background: Error checking subscription status during payment flow:', error);
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
      chrome.runtime.sendMessage({
        type: 'SUBSCRIPTION_UPDATED',
        subscription: subscription
      });
    }
  } catch (error) {
    console.error('❌ ThreadHQ Background: Error refreshing subscription status:', error);
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
    // [Inference] This check is to prevent API calls when user is not authenticated or info is not cached.
    // [Unverified] This might need refinement based on exact backend requirements for each endpoint.
    const isUserAuthenticated = !!auth.currentUser && !auth.currentUser.isAnonymous;
    const hasCachedUserInfo = !!currentUserEmail && !!currentUserId;

    // For any message type *other than* LOGIN_GOOGLE_OAUTH, we expect user info to be present.
    // If not, we respond with an error.
    if (!isUserAuthenticated && !hasCachedUserInfo && msg.type !== 'LOGIN_GOOGLE_OAUTH') {
      console.warn(`ThreadHQ Background: User not authenticated or user info not cached for message type: ${msg.type}.`);
      sendResponse({ success: false, error: "User not authenticated or user info not available." });
      return;
    }

    switch (msg.type) {
      case 'LOGIN_GOOGLE_OAUTH':
        try {
          const redirectUriForBackend = chrome.identity.getRedirectURL();

          // Step 1: Get auth URL from backend
          const authUrlResponse = await apiFetch(CONFIG_ENDPOINTS.AUTH_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            query: { redirect_uri: redirectUriForBackend }
          });
          if (!authUrlResponse.success || !authUrlResponse.url) {
            throw new Error(authUrlResponse.error || 'Failed to get auth URL from backend.');
          }

            const finalAuthUrl = authUrlResponse.url;
          bgLogger.info(`Attempting to launch Web Auth Flow with URL: ${finalAuthUrl}`);
          const authRedirectUrl = await new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow({
              url: finalAuthUrl,
              interactive: true
            }, (responseUrl) => {
              if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
              }
              if (!responseUrl) {
                return reject(new Error('OAuth flow cancelled or failed.'));
              }
              resolve(responseUrl);
            });
          });

          // Step 2: Extract authorization code
          const urlParams = new URLSearchParams(new URL(authRedirectUrl).search);
          const code = urlParams.get('code');
          if (!code) {
            throw new Error('Authorization code not found in redirect URL.');
          }

          // Step 3: Exchange code for tokens
          const tokenResponse = await apiFetch(CONFIG_ENDPOINTS.AUTH_TOKEN, {
            method: 'POST',
            body: { code, redirect_uri: redirectUriForBackend }
          });
          if (!tokenResponse.success || !tokenResponse.firebaseToken) {
            throw new Error(tokenResponse.error || 'Failed to exchange code for Firebase token.');
          }

          // Step 4: Sign in to Firebase with custom token
          const userCredential = await signInWithCustomToken(auth, tokenResponse.firebaseToken);
          const user = userCredential.user;
          bgLogger.info('Successfully signed in to Firebase with custom token.');

          await chrome.storage.local.set({
            userEmail: user.email,
            userName: tokenResponse.userName || user.email,
            userId: user.uid,
            userPlan: tokenResponse.userPlan || 'free'
          });

          // Force full refresh on login
          await triggerEmailSync(user.email, user.uid, true);

          sendResponse({ success: true, userEmail: user.email, userName: tokenResponse.userName, userPlan: tokenResponse.userPlan, userId: user.uid });
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error during Google OAuth login:', error);
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
          console.error("❌ ThreadHQ Background: Error during logout:", error);
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
          console.error('❌ ThreadHQ Background: Error fetching user plan:', error);
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
          console.error('❌ ThreadHQ Background: Error updating user plan:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_STORED_EMAILS':
        // This message is now primarily handled by the popup reading directly from chrome.storage.local.
        console.warn("ThreadHQ Background: Received FETCH_STORED_EMAILS, but popup should read directly from local storage.");
        sendResponse({ success: true, message: "Handled by popup's direct storage access." });
        break;

      case 'FETCH_NEW_EMAILS':
        try {
          // Use current cached info for sync
          const syncResult = await triggerEmailSync(currentUserEmail, currentUserId, msg.fullRefresh);
          sendResponse(syncResult); // Send back { success: true, categorizedEmails: {...}, quota: {...} }
        } catch (error) {
          console.error("❌ ThreadHQ Background: Error fetching new emails:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

  // Backfill handlers removed

      case 'FETCH_QUOTA_DATA':
        try {
          const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
            method: 'POST',
            body: { userEmail: currentUserEmail, email: currentUserEmail, userId: currentUserId, fetchOnlyQuota: true }
          });
          if (response.success && response.quota) {
            await chrome.storage.local.set({ quotaData: response.quota });
            sendResponse({ success: true, quota: response.quota });
          } else {
            sendResponse({ success: false, error: response.error || 'Quota data not found in response.' });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error fetching quota data:', error);
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
          console.error('❌ ThreadHQ Background: Error fetching follow-up suggestions:', error);
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
          console.error('❌ ThreadHQ Background: Error marking suggestion action:', error);
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
          console.error('❌ ThreadHQ Background: Error snoozing suggestion:', error);
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
          console.error('❌ ThreadHQ Background: Error undoing suggestion action:', error);
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
          console.error('❌ ThreadHQ Background: Error sending email reply:', error);
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
          console.error("❌ ThreadHQ Background: Error archiving email:", error);
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
            await triggerEmailSync(currentUserEmail, currentUserId, false); // Trigger sync after misclassification
            // Notify popup of success
            chrome.runtime.sendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: 'Email misclassification reported successfully!',
              msgType: 'success'
            });
          } else {
            // Notify popup of error
            chrome.runtime.sendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: `Failed to report misclassification: ${response.error}`,
              msgType: 'error'
            });
          }
          sendResponse(response);
        } catch (error) {
          console.error("❌ ThreadHQ Background: Error reporting misclassification:", error);
          // Notify popup of network/communication error
          chrome.runtime.sendMessage({
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
            chrome.runtime.sendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: 'Misclassification undone successfully!',
              msgType: 'success'
            });
          } else {
            // Notify popup of error
            chrome.runtime.sendMessage({
              type: 'SHOW_NOTIFICATION',
              msg: `Failed to undo misclassification: ${response.error}`,
              msgType: 'error'
            });
          }
          sendResponse(response);
        } catch (error) {
          console.error("❌ ThreadHQ Background: Error undoing misclassification:", error);
          // Notify popup of network/communication error
          chrome.runtime.sendMessage({
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
          await authReadyPromise;

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
          console.error("❌ ThreadHQ Background: Error in MARK_SINGLE_EMAIL_AS_READ:", error);
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
            console.warn('ThreadHQ Background: Backend mark-as-read-category failed, aborting local update:', persistErr?.message);
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
          console.log(`✅ ThreadHQ Background: Marked emails in category '${category}' as read in local storage.`);

          sendResponse({ success: true, message: `Emails in ${category} marked as read.` });
        } catch (error) {
          console.error("❌ ThreadHQ Background: Error marking emails as read:", error);
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
          console.error("❌ ThreadHQ Background: Error updating company name:", error);
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
          console.error("❌ ThreadHQ Background: Error fetching correction analytics:", error);
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
          console.error("❌ ThreadHQ Background: Error updating position:", error);
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
          console.error('❌ ThreadHQ Background: Error getting current user:', error);
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

          // Always refresh the cache so UI picks up new applicationId/isClosed values.
          try {
            await refreshStoredEmailsCache();
          } catch (e) {
            bgLogger.warn?.('Failed to refresh stored emails after role-link:', e?.message);
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

          try {
            await refreshStoredEmailsCache();
          } catch (e) {
            bgLogger.warn?.('Failed to refresh stored emails after close-application:', e?.message);
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

          try {
            await refreshStoredEmailsCache();
          } catch (e) {
            bgLogger.warn?.('Failed to refresh stored emails after reopen-application:', e?.message);
          }

          sendResponse(response);
        } catch (error) {
          bgLogger.error('Error reopening application:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'REPAIR_APPLICATION_LINKS':
        try {
          const { applicationId } = msg || {};
          if (!applicationId) {
            sendResponse({ success: false, error: 'Application ID is required' });
            break;
          }

          const endpoint = CONFIG_ENDPOINTS.REPAIR_APPLICATION_LINKS.replace(':applicationId', encodeURIComponent(applicationId));
          const response = await apiFetch(endpoint, { method: 'POST' });

          try {
            await refreshStoredEmailsCache();
          } catch (e) {
            bgLogger.warn?.('Failed to refresh stored emails after repair-links:', e?.message);
          }

          sendResponse(response);
        } catch (error) {
          bgLogger.error('Error repairing application links:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GET_ID_TOKEN':
        try {
          const user = auth.currentUser;
          if (user && !user.isAnonymous) {
            const token = await user.getIdToken();
            sendResponse({ success: true, token });
          } else {
            sendResponse({ success: false, error: 'User not authenticated' });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error getting ID token:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_PAYMENT_SUCCESS__':
        try {
          // Add a delay to allow webhook processing to complete
          console.log('🔄 ThreadHQ Background: Waiting 3 seconds for webhook processing...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Refresh user plan data after successful payment
          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: currentUserEmail, userEmail: currentUserEmail, userId: currentUserId }
          });
          
          if (response.success) {
            await chrome.storage.local.set({ userPlan: response.plan });
            console.log('✅ ThreadHQ Background: User plan refreshed after payment:', response.plan);
            sendResponse({ success: true, plan: response.plan });
          } else {
            console.error('❌ ThreadHQ Background: Failed to refresh user plan after payment:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error refreshing user plan after payment:', error);
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
            console.log('✅ ThreadHQ Background: Payment status checked:', response.plan);
            sendResponse({ success: true, plan: response.plan });
          } else {
            console.error('❌ ThreadHQ Background: Failed to check payment status:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error checking payment status:', error);
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
            console.log('✅ ThreadHQ Background: Subscription status checked:', response.subscription);
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ ThreadHQ Background: Failed to check subscription status:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error checking subscription status:', error);
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
            console.log('✅ ThreadHQ Background: Checkout session created:', response.url);
            sendResponse({ success: true, url: response.url });
          } else {
            console.error('❌ ThreadHQ Background: Failed to create checkout session:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error creating checkout session:', error);
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
            console.log('✅ ThreadHQ Background: Setup intent created:', response.client_secret);
            sendResponse({ success: true, client_secret: response.client_secret });
          } else {
            console.error('❌ ThreadHQ Background: Failed to create setup intent:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error creating setup intent:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_OPEN_CUSTOMER_PORTAL__':
        try {
          const { return_url } = msg;
          console.log('🎫 ThreadHQ Background: Creating customer portal session');
          
          const response = await apiFetch('/api/subscriptions/create-portal-session', {
            method: 'POST',
            body: JSON.stringify({ 
              return_url: return_url || chrome.runtime.getURL('popup/index.html')
            })
          });
          
          if (response.success && response.url) {
            console.log('✅ ThreadHQ Background: Portal session created');
            
            // Open portal in new tab
            const tab = await chrome.tabs.create({
              url: response.url,
              active: true
            });
            
            console.log('🪟 ThreadHQ Background: Portal opened in tab:', tab.id);
            sendResponse({ success: true, tabId: tab.id });
          } else {
            console.error('❌ ThreadHQ Background: Failed to create portal session:', response.error);
            sendResponse({ success: false, error: response.error || 'Failed to create portal session' });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error creating portal session:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_OPEN_PAYMENT_WINDOW__':
        try {
          const { url } = msg;
          console.log('🪟 ThreadHQ Background: Opening payment window:', url);
          
          // Open Stripe checkout in a new tab
          const tab = await chrome.tabs.create({
            url: url,
            active: true
          });

          // Monitor payment flow and respond when complete
          const paymentResult = await monitorPaymentFlow(tab.id, currentUserEmail, currentUserId);
          sendResponse(paymentResult);
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error opening payment window:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_OPEN_PORTAL_WINDOW__':
        // Portal functionality removed - using fully in-extension approach
        console.log('⚠️ ThreadHQ Background: Portal window opening removed - using in-extension approach');
        sendResponse({ success: false, error: 'Portal functionality removed for fully in-extension approach' });
        break;

      case '__DISABLED_CANCEL_SUBSCRIPTION__':
        try {
          console.log('🗑️ ThreadHQ Background: Canceling subscription');
          
          const response = await apiFetch('/api/subscriptions/cancel', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ ThreadHQ Background: Subscription canceled successfully');
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ ThreadHQ Background: Failed to cancel subscription:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error canceling subscription:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case '__DISABLED_RESUME_SUBSCRIPTION__':
        try {
          console.log('🔄 ThreadHQ Background: Resuming subscription');
          
          const response = await apiFetch('/api/subscriptions/resume', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ ThreadHQ Background: Subscription resumed successfully');
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ ThreadHQ Background: Failed to resume subscription:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error resuming subscription:', error);
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

          console.log('🔍 ThreadHQ Background: Searching emails with query:', query);
          
          const response = await apiFetch('/api/emails/search', {
            method: 'GET',
            query: { q: query }
          });
          
          if (response.success) {
            console.log('✅ ThreadHQ Background: Search completed, found', response.totalResults, 'results');
            sendResponse({ 
              success: true, 
              applications: response.applications,
              totalResults: response.totalResults,
              query: response.query
            });
          } else {
            console.error('❌ ThreadHQ Background: Search failed:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error searching emails:', error);
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

          console.log(`⭐ ThreadHQ Background: ${isStarred ? 'Starring' : 'Unstarring'} email ${emailId}`);
          
          const response = await apiFetch(`/api/emails/${emailId}/star`, {
            method: 'POST',
            body: { isStarred: isStarred }
          });
          
          if (response.success) {
            console.log(`✅ ThreadHQ Background: Email ${isStarred ? 'starred' : 'unstarred'} successfully`);
            
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
            chrome.runtime.sendMessage({
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
            console.log('⚠️ ThreadHQ Background: Premium subscription required to star emails');
            sendResponse({ success: false, error: response.error, premiumOnly: true });
          } else {
            console.error('❌ ThreadHQ Background: Star toggle failed:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ ThreadHQ Background: Error toggling star:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        console.warn('ThreadHQ: Unhandled message type:', msg.type);
        sendResponse({ success: false, error: 'Unhandled message type.' });
    }
  })(); // End of async IIFE

  // Return true to indicate that sendResponse will be called asynchronously.
  return true;
});


// --- Configure Firebase Auth Persistence ---
setPersistence(auth, indexedDBLocalPersistence)
  .then(() => {
    console.log("✅ ThreadHQ Background: Firebase Auth persistence set to IndexedDB.");
    onAuthStateChanged(auth, async (user) => {
      // Resolve the authReadyPromise once the initial auth state is determined
      authReadyResolve();

      if (user) {
        console.log("✅ ThreadHQ Background: Auth State Changed - User logged in:", user.email, "UID:", user.uid);
        // Ensure userEmail and userId are immediately available in local storage
        await chrome.storage.local.set({
          userEmail: user.email,
          userName: user.displayName || user.email,
          userId: user.uid,
        });

        if (!user.isAnonymous) {
          try {
            // Fetch user plan, ensuring email and userId are sent in the body
            const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
              method: 'POST',
              body: { email: user.email, userId: user.uid } // Explicitly send email and userId
            });
            if (response.success) {
              await chrome.storage.local.set({ userPlan: response.plan });
              console.log("✅ ThreadHQ Background: User plan fetched and stored:", response.plan);
            } else {
              console.error("❌ ThreadHQ Background: Failed to fetch user plan during auth state change:", response.error);
            }
          } catch (error) {
            console.error("❌ ThreadHQ Background: Network/communication error fetching user plan during auth state change:", error);
          }
          // After a user logs in (or re-authenticates), decide whether to do a full refresh
          // If last sync is stale (> 24h) or unknown, force full refresh to catch up
          let shouldFull = true;
          try {
            const status = await apiFetch(CONFIG_ENDPOINTS.SYNC_STATUS, { method: 'GET' });
            const last = status?.sync?.lastSyncAt ? new Date(status.sync.lastSyncAt) : null;
            if (last && (Date.now() - last.getTime()) < 24 * 60 * 60 * 1000) {
              shouldFull = false;
            }
          } catch (e) {
            // If status fetch fails, err on the side of full refresh
            shouldFull = true;
          }
          await triggerEmailSync(user.email, user.uid, shouldFull);
        } else {
          console.log("ThreadHQ Background: Anonymous user detected. Not fetching plan or syncing emails.");
        }
      } else {
        console.log("✅ ThreadHQ Background: Auth State Changed - User logged out.");
        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan', 'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'quotaData', 'followUpSuggestions']); // Clear all cached data on logout
      }
      // Notify the popup that auth state is ready (after all initial processing)
      chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true, loggedOut: !user });
    });
  })
  .catch((error) => {
    console.error("❌ ThreadHQ Background: Error setting Firebase Auth persistence:", error);
    // Even if persistence fails, still listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
      // Resolve the authReadyPromise even if persistence setup failed
      authReadyResolve();

      if (user) {
        console.log("ThreadHQ Background: Auth State Changed (without persistence) - User logged in:", user.email);
        await chrome.storage.local.set({ userEmail: user.email, userName: user.displayName || user.email, userId: user.uid });
        // Still try to sync emails even if persistence failed
        if (!user.isAnonymous) {
          await triggerEmailSync(user.email, user.uid, false);
        }
      } else {
        console.log("ThreadHQ Background: Auth State Changed (without persistence) - User logged out.");
        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan', 'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'quotaData', 'followUpSuggestions']);
      }
      chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true, loggedOut: !user });
    });
  });


// --- Chrome Alarms (for scheduled sync) ---
chrome.alarms.create('syncEmails', { periodInMinutes: SYNC_INTERVAL_MINUTES });
chrome.alarms.create('syncWatchdog', { periodInMinutes: WATCHDOG_INTERVAL_MIN });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncEmails') {
    console.log('⏰ ThreadHQ: Syncing emails via alarm...');
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      try {
        const result = await chrome.storage.local.get(['userEmail', 'userId']);
        if (result.userEmail && result.userId) {
          await triggerEmailSync(result.userEmail, result.userId, false); // No full refresh on alarm
        } else {
          console.warn('ThreadHQ: User not logged in or user info missing for alarm sync.');
        }
      } catch (error) {
        console.error('❌ ThreadHQ: Error during alarm-triggered email sync:', error);
        chrome.runtime.sendMessage({ type: 'EMAILS_SYNCED', success: false, error: error.message });
      }
    } else {
      console.log('ThreadHQ: Skipping email sync for unauthenticated or anonymous user.');
    }
  } else if (alarm.name === 'syncWatchdog') {
    // Periodic stuck-lock check
    await checkSyncWatchdog();
  }
});

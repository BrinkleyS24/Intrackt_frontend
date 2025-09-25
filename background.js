/**
 * @file background.js
 * @description This script handles background tasks for the AppMailia AI extension,
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
const SYNC_INTERVAL_MINUTES = 15; // How often to sync emails
const UNDO_TIMEOUT_MS = 10000; // 10 seconds for undo toast
// Watchdog to detect unusually long-running sync locks
const STUCK_LOCK_THRESHOLD_MIN = 15; // minutes a sync may run before considered stuck
const WATCHDOG_INTERVAL_MIN = 5; // how often to check for stuck syncs

// Define your backend endpoints.
const CONFIG_ENDPOINTS = {
  BACKEND_BASE_URL: 'http://localhost:3000', // Production backend URL (default)
  // To develop locally, temporarily replace with: 'http://localhost:3000'
  AUTH_URL: '/api/auth/auth-url',
  AUTH_TOKEN: '/api/auth/token',
  SYNC_EMAILS: '/api/emails',
  FETCH_STORED_EMAILS: '/api/emails/stored-emails', // This endpoint is not used by background script directly for fetching
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

  // Dynamic backend override (development aid): if chrome.storage.local has DEV_BACKEND, use it.
  try {
    const { DEV_BACKEND } = await chrome.storage.local.get(['DEV_BACKEND']);
    if (DEV_BACKEND && typeof DEV_BACKEND === 'string') {
      CONFIG_ENDPOINTS.BACKEND_BASE_URL = DEV_BACKEND;
    }
  } catch (_) {
    // Non-fatal; ignore storage errors.
  }

  const user = auth.currentUser;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

    if (user && !user.isAnonymous) { // Only attempt to get ID token for non-anonymous users
    try {
      const idToken = await user.getIdToken(true); // Pass true to force refresh
      headers['Authorization'] = `Bearer ${idToken}`;
      bgLogger.info(`Attached fresh ID token for user: ${user.uid}`);
    } catch (error) {
      bgLogger.error("Failed to get fresh Firebase ID token:", error);
      
      if (error.code === 'auth/user-token-expired' || error.code === 'auth/invalid-user-token') {
        console.warn("AppMailia AI: Unrecoverable auth token error. Forcing user logout.");

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
      console.error(`❌ AppMailia AI: API Error ${response.status} from ${url}:`, errorText);
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
  bgLogger.info(`API success: ${url}`, data);
    return data;
  } catch (error) {
    console.error(`❌ AppMailia AI: Network or parsing error for ${url}:`, error);
    throw new Error(`Network or server error: ${error.message}`);
  }
}

/**
 * Fetch stored emails from backend and update local cache, then notify popup.
 */
async function refreshStoredEmailsCache(syncInProgress = undefined) {
  try {
    const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_STORED_EMAILS, { method: 'POST' });
    if (response.success && response.categorizedEmails) {
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
    console.warn('AppMailia AI Background: refreshStoredEmailsCache failed:', e?.message);
  }
}

/**
 * Poll the sync status and periodically refresh stored emails until complete or timeout.
 */
async function pollSyncStatusAndRefresh(maxSeconds = 60, intervalMs = 2000) {
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
      console.warn('AppMailia AI Background: sync-status polling error:', e?.message);
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
    console.warn('AppMailia AI Background: watchdog check failed:', e?.message);
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
    console.error('❌ AppMailia AI Background: Cannot trigger email sync, userEmail or userId is missing.');
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
    const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
      method: 'POST',
    body: { userEmail, userId, fullRefresh, email: userEmail }
    });

    if (response.success && response.categorizedEmails) {
      // Save categorized emails to chrome.storage.local
      await chrome.storage.local.set({
        appliedEmails: response.categorizedEmails.applied || [],
        interviewedEmails: response.categorizedEmails.interviewed || [],
        offersEmails: response.categorizedEmails.offers || [],
        rejectedEmails: response.categorizedEmails.rejected || [],
        quotaData: response.quota || null // Also cache quota data
      });
  bgLogger.info('Emails and quota cached successfully in local storage.');

      // Notify the popup that emails have been synced and cached
      chrome.runtime.sendMessage({
        type: 'EMAILS_SYNCED',
        success: true,
        categorizedEmails: response.categorizedEmails,
        quota: response.quota,
  userEmail: userEmail, // Include userEmail for targeted updates in popup
  syncInProgress: !!response.sync?.inProgress
      });

      // If backend indicates a background sync is in progress, start polling without blocking
      if (response.sync?.inProgress) {
        pollSyncStatusAndRefresh().catch(e => console.warn('AppMailia AI Background: polling failed:', e?.message));
      }
      return { success: true, categorizedEmails: response.categorizedEmails, quota: response.quota };
    } else {
      console.error('❌ AppMailia AI Background: Backend sync failed or returned no emails:', response.error);
      return { success: false, error: response.error || "Backend sync failed or returned no emails." };
    }
  } catch (error) {
    console.error('❌ AppMailia AI Background: Error during email sync:', error);
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
        console.warn('⚠️ AppMailia AI Background: Error checking subscription status during payment flow:', error);
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
    console.error('❌ AppMailia AI Background: Error refreshing subscription status:', error);
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
      console.warn(`AppMailia AI Background: User not authenticated or user info not cached for message type: ${msg.type}.`);
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
          console.error('❌ AppMailia AI Background: Error during Google OAuth login:', error);
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
          console.error("❌ AppMailia AI Background: Error during logout:", error);
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
          console.error('❌ AppMailia AI Background: Error fetching user plan:', error);
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
          sendResponse(response);
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error updating user plan:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_STORED_EMAILS':
        // This message is now primarily handled by the popup reading directly from chrome.storage.local.
        console.warn("AppMailia AI Background: Received FETCH_STORED_EMAILS, but popup should read directly from local storage.");
        sendResponse({ success: true, message: "Handled by popup's direct storage access." });
        break;

      case 'FETCH_NEW_EMAILS':
        try {
          // Use current cached info for sync
          const syncResult = await triggerEmailSync(currentUserEmail, currentUserId, msg.fullRefresh);
          sendResponse(syncResult); // Send back { success: true, categorizedEmails: {...}, quota: {...} }
        } catch (error) {
          console.error("❌ AppMailia AI Background: Error fetching new emails:", error);
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
          console.error('❌ AppMailia AI Background: Error fetching quota data:', error);
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
          console.error('❌ AppMailia AI Background: Error fetching follow-up suggestions:', error);
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
          console.error('❌ AppMailia AI Background: Error sending email reply:', error);
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
          console.error("❌ AppMailia AI Background: Error archiving email:", error);
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
          console.error("❌ AppMailia AI Background: Error reporting misclassification:", error);
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
          console.error("❌ AppMailia AI Background: Error undoing misclassification:", error);
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
          console.error("❌ AppMailia AI Background: Error in MARK_SINGLE_EMAIL_AS_READ:", error);
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
            console.warn('AppMailia AI Background: Backend mark-as-read-category failed, aborting local update:', persistErr?.message);
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
          console.log(`✅ AppMailia AI Background: Marked emails in category '${category}' as read in local storage.`);

          sendResponse({ success: true, message: `Emails in ${category} marked as read.` });
        } catch (error) {
          console.error("❌ AppMailia AI Background: Error marking emails as read:", error);
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
          console.error('❌ AppMailia AI Background: Error getting current user:', error);
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
          console.error('❌ AppMailia AI Background: Error getting ID token:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'PAYMENT_SUCCESS':
        try {
          // Add a delay to allow webhook processing to complete
          console.log('🔄 AppMailia AI Background: Waiting 3 seconds for webhook processing...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Refresh user plan data after successful payment
          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: currentUserEmail, userEmail: currentUserEmail, userId: currentUserId }
          });
          
          if (response.success) {
            await chrome.storage.local.set({ userPlan: response.plan });
            console.log('✅ AppMailia AI Background: User plan refreshed after payment:', response.plan);
            sendResponse({ success: true, plan: response.plan });
          } else {
            console.error('❌ AppMailia AI Background: Failed to refresh user plan after payment:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error refreshing user plan after payment:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'CHECK_PAYMENT_STATUS':
        try {
          // Check current user payment status from backend
          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: msg.userEmail, userEmail: msg.userEmail, userId: msg.userId }
          });
          
          if (response.success) {
            console.log('✅ AppMailia AI Background: Payment status checked:', response.plan);
            sendResponse({ success: true, plan: response.plan });
          } else {
            console.error('❌ AppMailia AI Background: Failed to check payment status:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error checking payment status:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'CHECK_SUBSCRIPTION_STATUS':
        try {
          // Check subscription status using authenticated endpoint
          const response = await apiFetch('/api/subscriptions/status', {
            method: 'GET'
          });
          
          if (response.success) {
            console.log('✅ AppMailia AI Background: Subscription status checked:', response.subscription);
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ AppMailia AI Background: Failed to check subscription status:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error checking subscription status:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'CREATE_CHECKOUT_SESSION':
        try {
          // Create Stripe checkout session using authenticated endpoint
          const response = await apiFetch('/api/subscriptions/create-checkout-session', {
            method: 'POST',
            body: { priceId: msg.priceId }
          });
          
          if (response.success) {
            console.log('✅ AppMailia AI Background: Checkout session created:', response.url);
            sendResponse({ success: true, url: response.url });
          } else {
            console.error('❌ AppMailia AI Background: Failed to create checkout session:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error creating checkout session:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'CREATE_SETUP_INTENT':
        try {
          // Create setup intent for payment method update
          const response = await apiFetch('/api/subscriptions/create-setup-intent', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ AppMailia AI Background: Setup intent created:', response.client_secret);
            sendResponse({ success: true, client_secret: response.client_secret });
          } else {
            console.error('❌ AppMailia AI Background: Failed to create setup intent:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error creating setup intent:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'CREATE_PORTAL_SESSION':
        // Portal functionality removed - using fully in-extension approach
        console.log('⚠️ AppMailia AI Background: Portal session creation removed - using in-extension approach');
        sendResponse({ success: false, error: 'Portal functionality removed for fully in-extension approach' });
        break;

      case 'OPEN_PAYMENT_WINDOW':
        try {
          const { url } = msg;
          console.log('🪟 AppMailia AI Background: Opening payment window:', url);
          
          // Open Stripe checkout in a new tab
          const tab = await chrome.tabs.create({
            url: url,
            active: true
          });

          // Monitor payment flow and respond when complete
          const paymentResult = await monitorPaymentFlow(tab.id, currentUserEmail, currentUserId);
          sendResponse(paymentResult);
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error opening payment window:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'OPEN_PORTAL_WINDOW':
        // Portal functionality removed - using fully in-extension approach
        console.log('⚠️ AppMailia AI Background: Portal window opening removed - using in-extension approach');
        sendResponse({ success: false, error: 'Portal functionality removed for fully in-extension approach' });
        break;

      case 'CANCEL_SUBSCRIPTION':
        try {
          console.log('🗑️ AppMailia AI Background: Canceling subscription');
          
          const response = await apiFetch('/api/subscriptions/cancel', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ AppMailia AI Background: Subscription canceled successfully');
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ AppMailia AI Background: Failed to cancel subscription:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error canceling subscription:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'RESUME_SUBSCRIPTION':
        try {
          console.log('🔄 AppMailia AI Background: Resuming subscription');
          
          const response = await apiFetch('/api/subscriptions/resume', {
            method: 'POST'
          });
          
          if (response.success) {
            console.log('✅ AppMailia AI Background: Subscription resumed successfully');
            sendResponse({ success: true, subscription: response.subscription });
          } else {
            console.error('❌ AppMailia AI Background: Failed to resume subscription:', response.error);
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error('❌ AppMailia AI Background: Error resuming subscription:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        console.warn('AppMailia AI: Unhandled message type:', msg.type);
        sendResponse({ success: false, error: 'Unhandled message type.' });
    }
  })(); // End of async IIFE

  // Return true to indicate that sendResponse will be called asynchronously.
  return true;
});


// --- Configure Firebase Auth Persistence ---
setPersistence(auth, indexedDBLocalPersistence)
  .then(() => {
    console.log("✅ AppMailia AI Background: Firebase Auth persistence set to IndexedDB.");
    onAuthStateChanged(auth, async (user) => {
      // Resolve the authReadyPromise once the initial auth state is determined
      authReadyResolve();

      if (user) {
        console.log("✅ AppMailia AI Background: Auth State Changed - User logged in:", user.email, "UID:", user.uid);
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
              console.log("✅ AppMailia AI Background: User plan fetched and stored:", response.plan);
            } else {
              console.error("❌ AppMailia AI Background: Failed to fetch user plan during auth state change:", response.error);
            }
          } catch (error) {
            console.error("❌ AppMailia AI Background: Network/communication error fetching user plan during auth state change:", error);
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
          console.log("AppMailia AI Background: Anonymous user detected. Not fetching plan or syncing emails.");
        }
      } else {
        console.log("✅ AppMailia AI Background: Auth State Changed - User logged out.");
        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan', 'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'quotaData', 'followUpSuggestions']); // Clear all cached data on logout
      }
      // Notify the popup that auth state is ready (after all initial processing)
      chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true, loggedOut: !user });
    });
  })
  .catch((error) => {
    console.error("❌ AppMailia AI Background: Error setting Firebase Auth persistence:", error);
    // Even if persistence fails, still listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
      // Resolve the authReadyPromise even if persistence setup failed
      authReadyResolve();

      if (user) {
        console.log("AppMailia AI Background: Auth State Changed (without persistence) - User logged in:", user.email);
        await chrome.storage.local.set({ userEmail: user.email, userName: user.displayName || user.email, userId: user.uid });
        // Still try to sync emails even if persistence failed
        if (!user.isAnonymous) {
          await triggerEmailSync(user.email, user.uid, false);
        }
      } else {
        console.log("AppMailia AI Background: Auth State Changed (without persistence) - User logged out.");
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
    console.log('⏰ AppMailia AI: Syncing emails via alarm...');
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      try {
        const result = await chrome.storage.local.get(['userEmail', 'userId']);
        if (result.userEmail && result.userId) {
          await triggerEmailSync(result.userEmail, result.userId, false); // No full refresh on alarm
        } else {
          console.warn('AppMailia AI: User not logged in or user info missing for alarm sync.');
        }
      } catch (error) {
        console.error('❌ AppMailia AI: Error during alarm-triggered email sync:', error);
        chrome.runtime.sendMessage({ type: 'EMAILS_SYNCED', success: false, error: error.message });
      }
    } else {
      console.log('AppMailia AI: Skipping email sync for unauthenticated or anonymous user.');
    }
  } else if (alarm.name === 'syncWatchdog') {
    // Periodic stuck-lock check
    await checkSyncWatchdog();
  }
});

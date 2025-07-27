/**
 * @file background.js
 * @description This script handles background tasks for the Intrackt extension,
 * including email synchronization, user authentication, and misclassification reporting.
 * It operates as a service worker, listening for alarms and messages from the popup.
 */

// Import necessary Firebase modules.
import { initializeApp } from 'firebase/app';
// CORRECTED: Added setPersistence, indexedDBLocalPersistence for auth state persistence
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';

import { firebaseConfig } from './firebaseConfig';

// --- Chrome Runtime Message Listener (for popup/content script communication) ---
// This listener MUST be at the top level of the service worker script
// to ensure it's registered immediately upon activation.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log(`📩 Intrackt Background: Received message type: ${msg.type}`);

  // Use an async IIFE to allow await inside the listener
  (async () => {
    switch (msg.type) {
      case 'LOGIN_GOOGLE_OAUTH':
        try {
          // Step 1: Get the authorization URL from your backend
          // The backend's /api/auth/auth-url should already include the redirect_uri
          // based on the configured GOOGLE_REDIRECT_URI.
          // We are passing chrome.identity.getRedirectURL() to the backend
          // so it can construct the correct redirect_uri for the Chrome extension.
          const redirectUriForBackend = chrome.identity.getRedirectURL();

          const authUrlResponse = await apiFetch(CONFIG_ENDPOINTS.AUTH_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            // Pass the redirect_uri as a query parameter to the backend
            // so it can correctly generate the Google OAuth URL.
            // The backend needs to use this `redirect_uri` when calling `oauth2Client.generateAuthUrl`.
            query: { redirect_uri: redirectUriForBackend } // Pass as query param
          });

          if (!authUrlResponse.success || !authUrlResponse.url) {
            throw new Error(authUrlResponse.error || "Failed to get auth URL from backend.");
          }

          // Step 2: Launch Chrome's interactive web auth flow
          // The URL received from the backend (authUrlResponse.url) should ALREADY contain
          // the correct 'redirect_uri' parameter. We should NOT append it again.
          const finalAuthUrl = authUrlResponse.url; // Use the URL as is from the backend

          // Use chrome.identity.launchWebAuthFlow for the OAuth dance
          const authRedirectUrl = await new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
              {
                url: finalAuthUrl,
                interactive: true
              },
              (responseUrl) => {
                if (chrome.runtime.lastError) {
                  return reject(new Error(chrome.runtime.lastError.message));
                }
                if (!responseUrl) {
                  return reject(new Error("OAuth flow cancelled or failed."));
                }
                resolve(responseUrl);
              }
            );
          });

          // Extract the authorization code from the response URL
          const urlParams = new URLSearchParams(new URL(authRedirectUrl).search);
          const code = urlParams.get('code');

          if (!code) {
            throw new Error("Authorization code not found in redirect URL.");
          }

          // Step 3: Exchange the code for tokens via your backend
          const tokenResponse = await apiFetch(CONFIG_ENDPOINTS.AUTH_TOKEN, {
            method: 'POST',
            body: {
              code: code,
              // IMPORTANT: The redirect_uri sent here must EXACTLY match the one
              // used to generate the authorization URL in Step 1.
              redirect_uri: redirectUriForBackend
            }
          });

          if (tokenResponse.success && tokenResponse.firebaseToken) {
            // Step 4: Sign in to Firebase with the custom token from your backend
            const userCredential = await signInWithCustomToken(auth, tokenResponse.firebaseToken);
            const user = userCredential.user;
            console.log("✅ Intrackt Background: Successfully signed in to Firebase with custom token.");

            // The onAuthStateChanged listener below will handle storing user info and sending AUTH_READY.
            // Just send a success response back to the popup.
            sendResponse({ success: true, userEmail: user.email, userName: tokenResponse.userName, userPlan: tokenResponse.userPlan, userId: user.uid });
          } else {
            throw new Error(tokenResponse.error || "Failed to exchange code for Firebase token.");
          }
        } catch (error) {
          console.error("❌ Intrackt Background: Error during Google OAuth login:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'LOGOUT':
        try {
          await signOut(auth);
          console.log("✅ Intrackt Background: User signed out from Firebase.");
          // onAuthStateChanged listener will handle clearing storage.
          sendResponse({ success: true });
        } catch (error) {
          console.error("❌ Intrackt Background: Error during logout:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_USER_PLAN':
        try {
          const user = auth.currentUser;
          if (!user) {
            sendResponse({ success: false, error: "User not authenticated." });
            return;
          }
          // Use the userEmail from the message if available, otherwise from auth.currentUser
          const userEmailToFetch = msg.userEmail || user.email;
          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: userEmailToFetch } // Pass email to backend
          });
          if (response.success) {
            sendResponse({ success: true, plan: response.plan });
          } else {
            sendResponse({ success: false, error: response.error });
          }
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching user plan:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UPDATE_USER_PLAN':
        try {
          const user = auth.currentUser;
          if (!user) {
            sendResponse({ success: false, error: "User not authenticated." });
            return;
          }
          const { newPlan, userEmail: emailForUpdate } = msg; // Get userEmail from message
          const response = await apiFetch(CONFIG_ENDPOINTS.UPDATE_USER_PLAN, {
            method: 'POST',
            body: { newPlan, userEmail: emailForUpdate } // Pass userEmail to backend for update
          });
          sendResponse(response);
        } catch (error) {
          console.error("❌ Intrackt Background: Error updating user plan:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_STORED_EMAILS':
        try {
          // Pass userEmail from the message to the service

          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_STORED_EMAILS, {
            method: 'POST',
            body: { userEmail: msg.userEmail } // Ensure userEmail is passed to the backend
          });
          sendResponse(response);
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching stored emails:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_NEW_EMAILS':
        try {
          const user = auth.currentUser;
          if (!user) {
            sendResponse({ success: false, error: "User not authenticated for email sync." });
            return;
          }
          // Pass user email and userId from the message to the backend
          const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
            method: 'POST',
            body: { userEmail: msg.userEmail, userId: msg.userId, fullRefresh: msg.fullRefresh }
          });
          // IMPORTANT: The backend's /api/emails endpoint MUST return 'categorizedEmails' and 'quota'
          // in its response, not just a message like '{success: true, message: "Email sync process started."}'.
          // The frontend (useEmails and useAuth) expects these fields.
          sendResponse(response); // Send back { success: true, categorizedEmails: {...}, quota: {...} }
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching new emails:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_QUOTA_DATA': // NEW CASE for fetching only quota data
        try {
          const user = auth.currentUser;
          if (!user) {
            sendResponse({ success: false, error: "User not authenticated for quota data." });
            return;
          }
          // Call the SYNC_EMAILS endpoint with fetchOnlyQuota flag
          const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
            method: 'POST',
            body: { userEmail: msg.userEmail, userId: msg.userId, fetchOnlyQuota: true } // Explicitly request only quota
          });
          if (response.success && response.quota) {
            sendResponse({ success: true, quota: response.quota });
          } else {
            // If backend doesn't return quota, handle it as an error
            sendResponse({ success: false, error: response.error || "Quota data not found in response." });
          }
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching quota data:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_FOLLOWUP_SUGGESTIONS':
        try {
          const user = auth.currentUser;
          if (!user) {
            sendResponse({ success: false, error: "User not authenticated for follow-up suggestions." });
            return;
          }
          // Pass user email and userId from the message to the backend
          const response = await apiFetch(CONFIG_ENDPOINTS.FOLLOWUP_NEEDED, {
            method: 'POST',
            body: { userEmail: msg.userEmail, userId: msg.userId }
          });
          sendResponse(response);
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching follow-up suggestions:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SEND_EMAIL_REPLY':
        try {
          const { threadId, to, subject, body } = msg.replyData;
          // Call the helper function to send the reply
          const result = await sendGmailReply(threadId, to, subject, body);
          sendResponse({ success: true, message: "Email sent successfully!", result });
        } catch (error) {
          console.error("❌ Intrackt Background: Error sending email reply:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'ARCHIVE_EMAIL':
        try {
          // This message type implies archiving an email.
          // If your backend has an archive endpoint, call it.
          // Otherwise, this might be a direct Gmail API call (less common from background for archive).
          // Assuming a backend endpoint for archiving.
          const response = await apiFetch(CONFIG_ENDPOINTS.ARCHIVE_EMAIL, { // Assuming an ARCHIVE_EMAIL endpoint in CONFIG_ENDPOINTS
            method: 'POST',
            body: { emailId: msg.emailId, threadId: msg.threadId, userEmail: msg.userEmail }
          });
          sendResponse(response);
        } catch (error) {
          console.error("❌ Intrackt Background: Error archiving email:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'REFRESH_ALL_EMAILS':
        try {
          const user = auth.currentUser;
          if (!user) {
            sendResponse({ success: false, error: "User not authenticated for full refresh." });
            return;
          }
          // Fetch user email and userId from storage to pass to backend
          const result = await chrome.storage.local.get(['userEmail', 'userId']);
          if (!result.userEmail || !result.userId) {
            sendResponse({ success: false, error: "User email or ID not found in storage for refresh." });
            return;
          }

          const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
            method: 'POST',
            body: { userEmail: result.userEmail, userId: result.userId, fullRefresh: true }
          });
          // IMPORTANT: Similar to FETCH_NEW_EMAILS, the backend's /api/emails endpoint
          // should return 'categorizedEmails' and 'quota' here for the frontend to update.
          sendResponse(response); // Send back { success: true, message: "..." }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'REPORT_MISCLASSIFICATION':
        try {
          const response = await apiFetch(CONFIG_ENDPOINTS.REPORT_MISCLASSIFICATION, {
            method: 'POST',
            body: msg.reportData
          });
          sendResponse(response);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UNDO_MISCLASSIFICATION':
        try {
          const response = await apiFetch(CONFIG_ENDPOINTS.UNDO_MISCLASSIFICATION, {
            method: 'POST',
            body: msg.undoData
          });
          sendResponse(response);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      // Add other cases like FETCH_USER_PLAN, UPDATE_USER_PLAN etc. if they exist
      // and ensure they use apiFetch.

      default:
        console.warn('Intrackt: Unhandled message type:', msg.type);
        sendResponse({ success: false, error: 'Unhandled message type.' });
    }
  })(); // End of async IIFE

  // Return true to indicate that sendResponse will be called asynchronously.
  return true;
});


// Initialize Firebase App in the background script.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Configure Firebase Auth Persistence ---
// This ensures the user's login session persists across service worker
// restarts and browser closures. indexedDBLocalPersistence is recommended for
// service workers.
setPersistence(auth, indexedDBLocalPersistence)
  .then(() => {
    console.log("✅ Intrackt Background: Firebase Auth persistence set to IndexedDB.");
    // After persistence is set, attach the auth state listener.
    // This listener will fire immediately if a persisted user exists.
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("✅ Intrackt Background: Auth State Changed - User logged in:", user.email, "UID:", user.uid);
        // Store essential user info in chrome.storage.local for popup to access
        await chrome.storage.local.set({
          userEmail: user.email,
          userName: user.displayName || user.email,
          userId: user.uid,
          // Optionally, store the current ID token if needed by other parts of the extension
          // lastFirebaseIdToken: await user.getIdToken()
        });

        // Fetch user plan from backend when auth state changes (if not anonymous)
        // This ensures the popup gets the correct plan status upon loading.
        if (!user.isAnonymous) {
          try {
            // Ensure apiFetch is defined or imported. Assuming it's defined globally or imported.
            // If not, you'll need to define it here or import it from a utility file.
            const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
              method: 'POST',
              // Pass the ID token for authentication with your backend
              headers: { 'Authorization': `Bearer ${await user.getIdToken()}` }
            });
            if (response.success) {
              await chrome.storage.local.set({ userPlan: response.plan });
              console.log("✅ Intrackt Background: User plan fetched and stored:", response.plan);
              // Notify the popup that auth state is ready and successful
              chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true });
            } else {
              console.error("❌ Intrackt Background: Failed to fetch user plan during auth state change:", response.error);
              chrome.runtime.sendMessage({ type: 'AUTH_READY', success: false, error: "Failed to fetch user plan." });
            }
          } catch (error) {
            console.error("❌ Intrackt Background: Network/communication error fetching user plan during auth state change:", error);
            chrome.runtime.sendMessage({ type: 'AUTH_READY', success: false, error: `Network error fetching plan: ${error.message}` });
          }
        } else {
          console.log("Intrackt Background: Anonymous user detected. Not fetching plan.");
          // For anonymous users, still signal auth ready
          chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true });
        }
      } else {
        console.log("✅ Intrackt Background: Auth State Changed - User logged out.");
        // Clear user info from chrome.storage.local upon logout
        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan']);
        // Notify the popup that the user is logged out
        chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true, loggedOut: true });
      }
    });
  })
  .catch((error) => {
    console.error("❌ Intrackt Background: Error setting Firebase Auth persistence:", error);
    // Even if persistence fails, still listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Intrackt Background: Auth State Changed (without persistence) - User logged in:", user.email);
      } else {
        console.log("Intrackt Background: Auth State Changed (without persistence) - User logged out.");
      }
    });
  });


// --- Constants ---
const SYNC_INTERVAL_MINUTES = 15; // How often to sync emails
const UNDO_TIMEOUT_MS = 10000; // 10 seconds for undo toast

// Define your backend endpoints.
// This should match the CONFIG.ENDPOINTS from popup/src/utils/constants.js
// It's crucial that these are consistent.
const CONFIG_ENDPOINTS = {
  // BACKEND_BASE_URL: 'https://gmail-tracker-backend-215378038667.us-central1.run.app', // Your production backend URL
  BACKEND_BASE_URL: 'http://localhost:3000', // Your local development backend URL
  AUTH_URL: '/api/auth/auth-url', // Corrected: Moved to its own line
  AUTH_TOKEN: '/api/auth/token',
  SYNC_EMAILS: '/api/emails',
  FETCH_STORED_EMAILS: '/api/emails/stored-emails',
  FOLLOWUP_NEEDED: '/api/emails/followup-needed',
  REPORT_MISCLASSIFICATION: '/api/emails/report-misclassification',
  UNDO_MISCLASSIFICATION: '/api/emails/undo-misclassification',
  FETCH_USER_PLAN: '/api/user', // Endpoint for fetching user plan and status
  UPDATE_USER_PLAN: '/api/user/update-plan', // Endpoint for updating user plan
  // Note: SEND_EMAIL_REPLY is handled by the background script directly with Gmail API, not via a specific backend endpoint.
  // Note: QUOTA data is returned as part of the SYNC_EMAILS response, not a separate endpoint.
};

// --- Helper Functions ---

/**
 * Generic fetch wrapper for backend API calls.
 * Automatically adds authorization header if a Firebase user is logged in.
 * @param {string} endpoint - The API endpoint (e.g., '/api/emails').
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @returns {Promise<object>} The JSON response from the backend.
 */
async function apiFetch(endpoint, options = {}) {
  const user = auth.currentUser;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (user) {
    try {
      const idToken = await user.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch (error) {
      console.error("❌ Intrackt: Failed to get Firebase ID token:", error);
      // If token acquisition fails, proceed without auth header, backend will handle 401
    }
  }

  const url = `${CONFIG_ENDPOINTS.BACKEND_BASE_URL}${endpoint}`;
  console.log(`📡 Intrackt: Making API call to: ${url} with method: ${options.method || 'GET'}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined, // Ensure body is stringified if present
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Intrackt: API Error ${response.status} from ${url}:`, errorText);
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Intrackt: API call to ${url} successful. Response:`, data);
    return data;
  } catch (error) {
    console.error(`❌ Intrackt: Network or parsing error for ${url}:`, error);
    throw new Error(`Network or server error: ${error.message}`);
  }
}

/**
 * Sends an email reply using the Gmail API.
 * @param {string} threadId - The ID of the email thread to reply to.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Subject of the reply.
 * @param {string} body - Body of the reply.
 * @returns {Promise<object>} Result of the send operation.
 */
async function sendGmailReply(threadId, to, subject, body) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated for sending email.");
  }

  try {
    // ALTERNATIVE: Send message to backend to send email (more common for complex logic)
    // This assumes you have a backend endpoint like /api/emails/send-reply
    const response = await apiFetch('/api/emails/send-reply', {
      method: 'POST',
      body: { threadId, to, subject, body }
    });
    return response;

  } catch (error) {
    console.error("❌ Intrackt: Error sending Gmail reply:", error);
    throw error;
  }
}


// --- Chrome Alarms (for scheduled sync) ---
chrome.alarms.create('syncEmails', { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncEmails') {
    console.log('⏰ Intrackt: Syncing emails via alarm...');
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      try {
        // Fetch user email from storage to pass to backend
        const result = await chrome.storage.local.get(['userEmail', 'userId']);
        if (result.userEmail && result.userId) {
          const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
            method: 'POST',
            body: { userEmail: result.userEmail, userId: result.userId, fullRefresh: false }
          });
          if (response.success) {
            console.log('✅ Intrackt: Emails synced successfully via alarm.');
            // Notify the popup if it's open
            chrome.runtime.sendMessage({ type: 'EMAILS_SYNCED', success: true, categorizedEmails: response.categorizedEmails, quota: response.quota });
          } else {
            console.error('❌ Intrackt: Failed to sync emails via alarm:', response.error);
            chrome.runtime.sendMessage({ type: 'EMAILS_SYNCED', success: false, error: response.error });
          }
        } else {
          console.warn('Intrackt: User not logged in or user info missing for alarm sync.');
        }
      } catch (error) {
        console.error('❌ Intrackt: Error during alarm-triggered email sync:', error);
        chrome.runtime.sendMessage({ type: 'EMAILS_SYNCED', success: false, error: error.message });
      }
    } else {
      console.log('Intrackt: Skipping email sync for unauthenticated or anonymous user.');
    }
  }
});

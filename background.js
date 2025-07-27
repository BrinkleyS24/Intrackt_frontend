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

// Initialize Firebase App in the background script.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Constants ---
const SYNC_INTERVAL_MINUTES = 15; // How often to sync emails
const UNDO_TIMEOUT_MS = 10000; // 10 seconds for undo toast

// Define your backend endpoints.
const CONFIG_ENDPOINTS = {
  // BACKEND_BASE_URL: 'https://gmail-tracker-backend-215378038667.us-central1.run.app', // Your production backend URL
  BACKEND_BASE_URL: 'http://localhost:3000', // Your local development backend URL
  AUTH_URL: '/api/auth/auth-url',
  AUTH_TOKEN: '/api/auth/token',
  SYNC_EMAILS: '/api/emails',
  FETCH_STORED_EMAILS: '/api/emails/stored-emails', // This endpoint is not used by background script directly for fetching
  FOLLOWUP_NEEDED: '/api/emails/followup-needed',
  REPORT_MISCLASSIFICATION: '/api/emails/report-misclassification',
  UNDO_MISCLASSIFICATION: '/api/emails/undo-misclassification',
  FETCH_USER_PLAN: '/api/user',
  UPDATE_USER_PLAN: '/api/user/update-plan',
  // Assuming a backend endpoint for sending replies
  SEND_REPLY: '/api/emails/send-reply',
  // Assuming a backend endpoint for archiving
  ARCHIVE_EMAIL: '/api/emails/archive', // Ensure this matches your backend's archive endpoint
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
    }
  }

  const url = `${CONFIG_ENDPOINTS.BACKEND_BASE_URL}${endpoint}`;
  console.log(`📡 Intrackt: Making API call to: ${url} with method: ${options.method || 'GET'}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: headers,
      // Ensure body is stringified only if it's an object and not already a string
      body: options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
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
 * Sends an email reply using the Gmail API (via backend).
 * @param {string} threadId - The ID of the email thread to reply to.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Subject of the reply.
 * @param {string} body - Body of the reply.
 * @param {string} userEmail - The email of the authenticated user (sender).
 * @param {string} userId - The Firebase UID of the user.
 * @returns {Promise<object>} Result of the send operation.
 */
async function sendGmailReply(threadId, to, subject, body, userEmail, userId) { // Added userId param
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated for sending email.");
  }
  try {
    const response = await apiFetch(CONFIG_ENDPOINTS.SEND_REPLY, { // Use configured endpoint
      method: 'POST',
      body: { threadId, to, subject, body, userEmail, userId } // Pass userId to backend
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending Gmail reply via backend:", error);
    throw error;
  }
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
    console.error('❌ Intrackt Background: Cannot trigger email sync, userEmail or userId is missing.');
    return { success: false, error: 'User email or ID missing for sync.' };
  }

  try {
    const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
      method: 'POST',
      body: { userEmail, userId, fullRefresh }
    });

    if (response.success && response.categorizedEmails) {
      // Save categorized emails to chrome.storage.local
      await chrome.storage.local.set({
        appliedEmails: response.categorizedEmails.applied || [],
        interviewedEmails: response.categorizedEmails.interviewed || [],
        offersEmails: response.categorizedEmails.offers || [],
        rejectedEmails: response.categorizedEmails.rejected || [],
        irrelevantEmails: response.categorizedEmails.irrelevant || [],
        quotaData: response.quota || null // Also cache quota data
      });
      console.log('✅ Intrackt Background: Emails and quota cached successfully in local storage.');

      // Notify the popup that emails have been synced and cached
      chrome.runtime.sendMessage({
        type: 'EMAILS_SYNCED',
        success: true,
        categorizedEmails: response.categorizedEmails,
        quota: response.quota,
        userEmail: userEmail // Include userEmail for targeted updates in popup
      });
      return { success: true, categorizedEmails: response.categorizedEmails, quota: response.quota };
    } else {
      console.error('❌ Intrackt Background: Backend sync failed or returned no emails:', response.error);
      return { success: false, error: response.error || "Backend sync failed or returned no emails." };
    }
  } catch (error) {
    console.error('❌ Intrackt Background: Error during email sync:', error);
    return { success: false, error: error.message };
  }
}


// --- Chrome Runtime Message Listener (for popup/content script communication) ---
// This listener MUST be at the top level of the service worker script
// to ensure it's registered immediately upon activation.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log(`📩 Intrackt Background: Received message type: ${msg.type}`);

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

    if (!isUserAuthenticated && !hasCachedUserInfo && msg.type !== 'LOGIN_GOOGLE_OAUTH') {
      console.warn(`Intrackt Background: User not authenticated or user info not cached for message type: ${msg.type}.`);
      sendResponse({ success: false, error: "User not authenticated or user info not available." });
      return;
    }

    switch (msg.type) {
      case 'LOGIN_GOOGLE_OAUTH':
        try {
          // Step 1: Get the authorization URL from your backend
          const redirectUriForBackend = chrome.identity.getRedirectURL();

          const authUrlResponse = await apiFetch(CONFIG_ENDPOINTS.AUTH_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            query: { redirect_uri: redirectUriForBackend }
          });

          if (!authUrlResponse.success || !authUrlResponse.url) {
            throw new Error(authUrlResponse.error || "Failed to get auth URL from backend.");
          }

          // Step 2: Launch Chrome's interactive web auth flow
          const finalAuthUrl = authUrlResponse.url;
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
              redirect_uri: redirectUriForBackend
            }
          });

          if (tokenResponse.success && tokenResponse.firebaseToken) {
            // Step 4: Sign in to Firebase with the custom token from your backend
            const userCredential = await signInWithCustomToken(auth, tokenResponse.firebaseToken);
            const user = userCredential.user;
            console.log("✅ Intrackt Background: Successfully signed in to Firebase with custom token.");

            // Store user info and plan in local storage
            await chrome.storage.local.set({
              userEmail: user.email,
              userName: tokenResponse.userName || user.email, // Use userName from backend if available
              userId: user.uid,
              userPlan: tokenResponse.userPlan || 'free' // Use userPlan from backend if available
            });

            // Trigger an immediate email sync after successful login
            // This will fetch and cache emails, and notify the popup
            await triggerEmailSync(user.email, user.uid, true); // Force full refresh on login

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
          const userEmailToFetch = msg.userEmail || currentUserEmail;
          const userIdToFetch = msg.userId || currentUserId;

          if (!userEmailToFetch || !userIdToFetch) {
            sendResponse({ success: false, error: "User email or ID not available for fetching plan." });
            return;
          }

          const response = await apiFetch(CONFIG_ENDPOINTS.FETCH_USER_PLAN, {
            method: 'POST',
            body: { email: userEmailToFetch, userId: userIdToFetch } // Explicitly send email and userId
          });
          if (response.success) {
            await chrome.storage.local.set({ userPlan: response.plan }); // Cache the plan
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
          const { newPlan, userEmail: emailForUpdate } = msg;
          const userIdForUpdate = currentUserId; // Use currentUserId from storage

          if (!emailForUpdate || !userIdForUpdate) {
            sendResponse({ success: false, error: "User email or ID not available for updating plan." });
            return;
          }

          const response = await apiFetch(CONFIG_ENDPOINTS.UPDATE_USER_PLAN, {
            method: 'POST',
            body: { newPlan, userEmail: emailForUpdate, userId: userIdForUpdate } // Ensure userId is sent
          });
          if (response.success) {
            await chrome.storage.local.set({ userPlan: newPlan }); // Cache the updated plan
          }
          sendResponse(response);
        } catch (error) {
          console.error("❌ Intrackt Background: Error updating user plan:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_STORED_EMAILS':
        // This message is now primarily handled by the popup reading directly from chrome.storage.local.
        console.warn("Intrackt Background: Received FETCH_STORED_EMAILS, but popup should read directly from local storage.");
        sendResponse({ success: true, message: "Handled by popup's direct storage access." });
        break;

      case 'FETCH_NEW_EMAILS':
        try {
          // Use msg.userEmail and msg.userId as they are explicitly passed from the popup for this action
          const syncResult = await triggerEmailSync(msg.userEmail, msg.userId, msg.fullRefresh);
          sendResponse(syncResult); // Send back { success: true, categorizedEmails: {...}, quota: {...} }
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching new emails:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_QUOTA_DATA':
        try {
          const userEmailForQuota = msg.userEmail || currentUserEmail;
          const userIdForQuota = msg.userId || currentUserId;

          if (!userEmailForQuota || !userIdForQuota) {
            sendResponse({ success: false, error: "User email or ID not available for fetching quota." });
            return;
          }

          const response = await apiFetch(CONFIG_ENDPOINTS.SYNC_EMAILS, {
            method: 'POST',
            body: { userEmail: userEmailForQuota, userId: userIdForQuota, fetchOnlyQuota: true }
          });
          if (response.success && response.quota) {
            await chrome.storage.local.set({ quotaData: response.quota }); // Cache the quota data
            sendResponse({ success: true, quota: response.quota });
          } else {
            sendResponse({ success: false, error: response.error || "Quota data not found in response." });
          }
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching quota data:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'FETCH_FOLLOWUP_SUGGESTIONS':
        try {
          const userEmailForFollowup = msg.userEmail || currentUserEmail;
          const userIdForFollowup = msg.userId || currentUserId;

          if (!userEmailForFollowup || !userIdForFollowup) {
            sendResponse({ success: false, error: "User email or ID not available for follow-up suggestions." });
            return;
          }

          const response = await apiFetch(CONFIG_ENDPOINTS.FOLLOWUP_NEEDED, {
            method: 'POST',
            body: { userEmail: userEmailForFollowup, userId: userIdForFollowup }
          });
          if (response.success && response.suggestions) {
            await chrome.storage.local.set({ followUpSuggestions: response.suggestions }); // Cache suggestions
            sendResponse({ success: true, suggestions: response.suggestions });
          } else {
            sendResponse({ success: false, error: response.error || "Follow-up suggestions not found." });
          }
        } catch (error) {
          console.error("❌ Intrackt Background: Error fetching follow-up suggestions:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'SEND_EMAIL_REPLY':
        try {
          const { threadId, recipient, subject, body, userEmail: senderEmail } = msg;
          // Ensure userId is passed for sendGmailReply
          const result = await sendGmailReply(threadId, recipient, subject, body, senderEmail, currentUserId);
          // After sending a reply, trigger a sync to update the email status in the UI
          await triggerEmailSync(senderEmail, currentUserId, false); // No full refresh needed, just update
          sendResponse({ success: true, message: "Email sent successfully!", result });
        } catch (error) {
          console.error("❌ Intrackt Background: Error sending email reply:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'ARCHIVE_EMAIL':
        try {
          // Ensure userId is sent in the body
          const response = await apiFetch(CONFIG_ENDPOINTS.ARCHIVE_EMAIL, {
            method: 'POST',
            body: { threadId: msg.threadId, userEmail: msg.userEmail, userId: currentUserId }
          });
          if (response.success) {
            // After archiving, trigger a sync to update the email list
            await triggerEmailSync(msg.userEmail, currentUserId, false);
          }
          sendResponse(response);
        } catch (error) {
          console.error("❌ Intrackt Background: Error archiving email:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'REPORT_MISCLASSIFICATION':
        try {
          const reportData = {
            ...msg.emailData, // Contains emailId, threadId, originalCategory, correctedCategory, emailSubject, emailBody
            userEmail: msg.emailData.userEmail || currentUserEmail, // Ensure userEmail is present
            userId: currentUserInfo.userId // Ensure userId is present
          };
          const response = await apiFetch(CONFIG_ENDPOINTS.REPORT_MISCLASSIFICATION, {
            method: 'POST',
            body: reportData
          });
          if (response.success) {
            // After misclassification, trigger a sync to update the email list
            await triggerEmailSync(reportData.userEmail, reportData.userId, false);
          }
          sendResponse(response);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'UNDO_MISCLASSIFICATION':
        try {
          const undoData = {
            ...msg.undoData, // Contains emailId, threadId, originalCategory, misclassifiedIntoCategory
            userEmail: msg.userEmail || currentUserEmail, // Ensure userEmail is present
            userId: currentUserInfo.userId // Ensure userId is present
          };
          const response = await apiFetch(CONFIG_ENDPOINTS.UNDO_MISCLASSIFICATION, {
            method: 'POST',
            body: undoData
          });
          if (response.success) {
            // After undoing, trigger a sync to update the email list
            await triggerEmailSync(undoData.userEmail, undoData.userId, false);
          }
          sendResponse(response);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'MARK_AS_READ': // NEW CASE for marking emails as read
        try {
          const { category, userId: targetUserId } = msg.payload;
          // Ensure we have a user and it matches the targetUserId for security
          const user = auth.currentUser;
          if (!user || user.uid !== targetUserId) {
            sendResponse({ success: false, error: "Unauthorized or user mismatch for marking as read." });
            return;
          }

          // Fetch current emails from local storage to update their read status
          const currentEmails = await chrome.storage.local.get([
            'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails'
          ]);

          const updatedCategoryEmails = (currentEmails[`${category}Emails`] || []).map(email => ({
            ...email,
            isRead: true // Mark all emails in this category as read
          }));

          // Save updated emails back to local storage
          await chrome.storage.local.set({ [`${category}Emails`]: updatedCategoryEmails });
          console.log(`✅ Intrackt Background: Marked emails in category '${category}' as read in local storage.`);

          // Optionally, notify backend about read status if it needs to be persisted there
          // For now, assuming local storage update is sufficient for this action.
          // If backend needs to know, you'd make an apiFetch call here.
          // Example: await apiFetch(CONFIG_ENDPOINTS.MARK_READ_ON_BACKEND, { method: 'POST', body: { category, userId: targetUserId, userEmail: currentUserEmail } });

          sendResponse({ success: true, message: `Emails in ${category} marked as read.` });
        } catch (error) {
          console.error("❌ Intrackt Background: Error marking emails as read:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        console.warn('Intrackt: Unhandled message type:', msg.type);
        sendResponse({ success: false, error: 'Unhandled message type.' });
    }
  })(); // End of async IIFE

  // Return true to indicate that sendResponse will be called asynchronously.
  return true;
});


// --- Configure Firebase Auth Persistence ---
setPersistence(auth, indexedDBLocalPersistence)
  .then(() => {
    console.log("✅ Intrackt Background: Firebase Auth persistence set to IndexedDB.");
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("✅ Intrackt Background: Auth State Changed - User logged in:", user.email, "UID:", user.uid);
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
              console.log("✅ Intrackt Background: User plan fetched and stored:", response.plan);
            } else {
              console.error("❌ Intrackt Background: Failed to fetch user plan during auth state change:", response.error);
            }
          } catch (error) {
            console.error("❌ Intrackt Background: Network/communication error fetching user plan during auth state change:", error);
          }
          // After a user logs in (or re-authenticates), trigger an initial email sync
          // This ensures the cache is populated immediately.
          await triggerEmailSync(user.email, user.uid, false); // No full refresh needed, just update
        } else {
          console.log("Intrackt Background: Anonymous user detected. Not fetching plan or syncing emails.");
        }
      } else {
        console.log("✅ Intrackt Background: Auth State Changed - User logged out.");
        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan', 'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails', 'quotaData', 'followUpSuggestions']); // Clear all cached data on logout
      }
      // Notify the popup that auth state is ready (after all initial processing)
      chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true, loggedOut: !user });
    });
  })
  .catch((error) => {
    console.error("❌ Intrackt Background: Error setting Firebase Auth persistence:", error);
    // Even if persistence fails, still listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("Intrackt Background: Auth State Changed (without persistence) - User logged in:", user.email);
        await chrome.storage.local.set({ userEmail: user.email, userName: user.displayName || user.email, userId: user.uid });
        // Still try to sync emails even if persistence failed
        if (!user.isAnonymous) {
          await triggerEmailSync(user.email, user.uid, false);
        }
      } else {
        console.log("Intrackt Background: Auth State Changed (without persistence) - User logged out.");
        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan', 'appliedEmails', 'interviewedEmails', 'offersEmails', 'rejectedEmails', 'irrelevantEmails', 'quotaData', 'followUpSuggestions']);
      }
      chrome.runtime.sendMessage({ type: 'AUTH_READY', success: true, loggedOut: !user });
    });
  });


// --- Chrome Alarms (for scheduled sync) ---
chrome.alarms.create('syncEmails', { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncEmails') {
    console.log('⏰ Intrackt: Syncing emails via alarm...');
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      try {
        const result = await chrome.storage.local.get(['userEmail', 'userId']);
        if (result.userEmail && result.userId) {
          await triggerEmailSync(result.userEmail, result.userId, false); // No full refresh on alarm
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

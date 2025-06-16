/**
 * @file background.js
 * @description This script handles background tasks for the Intrackt extension,
 * including email synchronization, user authentication, and misclassification reporting.
 * It operates as a service worker, listening for alarms and messages from the popup.
 */

// --- Constants ---
// Define constants for easier management and clarity.
// IMPORTANT: For production, 'http://localhost:3000' should be replaced with your actual backend URL.
// Consider using environment variables or a configuration file for different environments (dev/prod).
const SYNC_INTERVAL_MINUTES = 15;
const SYNC_COOLDOWN_MILLISECONDS = (SYNC_INTERVAL_MINUTES * 60 * 1000) / 2; // Prevents syncing too frequently
const BACKEND_BASE_URL = 'http://localhost:3000'; // Placeholder - CHANGE FOR PRODUCTION!

// --- Global State ---
// These variables hold the current user's email, plan, and last sync timestamp.
// They are initialized from chrome.storage.local on startup and updated consistently.
let userEmail = null;
let userPlan = 'free';
let lastSyncTimestamp = 0; // Renamed for consistency with storage key

// --- Initialization Logic ---

/**
 * Initializes the extension upon installation.
 * Sets up an alarm for periodic email synchronization.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('emailSync', { periodInMinutes: SYNC_INTERVAL_MINUTES });
});

/**
 * Listener for alarms. Triggers email synchronization when the 'emailSync' alarm fires.
 */
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'emailSync') {
    // We don't await this here, as alarms don't need a direct response.
    // The internal logic of fetchEmailsInBackground will handle updates and notifications.
    fetchEmailsInBackground();
  }
});

/**
 * Restores user session data from local storage when the background script starts.
 * Also attempts to update the user's plan from the backend if an email is found.
 */
chrome.storage.local.get(
  ['userEmail', 'userPlan', 'lastSyncTimestamp'],
  data => {
    userEmail = data.userEmail || null;
    userPlan = data.userPlan || 'free';
    lastSyncTimestamp = data.lastSyncTimestamp || 0; // Use consistent name
    if (userEmail) {
      updateUserPlanFromBackend(); // Attempt to get the latest plan
    } else {
    }
  }
);

// --- API Utility Function ---
/**
 * Generic function to make authenticated fetch requests to the backend.
 * @param {string} endpoint - The API endpoint relative to BACKEND_BASE_URL.
 * @param {object} options - Fetch options (method, headers, body).
 * @returns {Promise<any>} The parsed JSON data from the response.
 * @throws {Error} If the network request fails or the response status is not OK.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${BACKEND_BASE_URL}/api/${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText || response.statusText}`);
    }
    return await response.json(); // Always parse JSON on success
  } catch (error) {
    console.error(`❌ Intrackt: API fetch to ${url} failed:`, error);
    throw error; // Re-throw to be handled by the caller
  }
}

// --- Core Logic Functions ---

/**
 * Fetches the latest user plan from the backend and updates local storage.
 * @async
 */
async function updateUserPlanFromBackend() {
  if (!userEmail) {
    console.warn('Intrackt: Cannot update user plan - no userEmail available.');
    return;
  }
  try {
    const data = await apiFetch('user', {
      method: 'POST',
      body: JSON.stringify({ email: userEmail }),
    });
    const { plan } = data;
    if (plan && plan !== userPlan) { // Only update if plan has changed
      userPlan = plan;
      await chrome.storage.local.set({ userPlan: plan });
      // Notify popup if plan changes while it's open
      chrome.runtime.sendMessage({ type: 'USER_PLAN_UPDATED', userPlan: plan });
    } else {
    }
  } catch (err) {
    console.error('❌ Intrackt: Failed to update userPlan from backend:', err);
    // Do not re-throw, as this is a background update, not critical path.
  }
}

/**
 * Attempts to get an OAuth2 authentication token.
 * Tries non-interactive first, then interactive if necessary.
 * @returns {Promise<string|null>} The auth token or null if unavailable.
 * @async
 */
async function getAuthToken() {
  try {
    // Try silent token acquisition first
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, t => {
        if (chrome.runtime.lastError) {
          // If there's an error, it might just mean no cached token, so we'll try interactive.
          console.warn('Intrackt: Non-interactive auth token failed:', chrome.runtime.lastError.message);
          resolve(null); // Resolve with null to trigger interactive attempt
        } else {
          resolve(t);
        }
      });
    });

    if (token) return token;

    // If silent failed or returned no token, try interactive
    return await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, t => {
        if (chrome.runtime.lastError) {
          console.error('❌ Intrackt: Interactive auth token failed:', chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
        } else {
          resolve(t);
        }
      });
    });
  } catch (error) {
    console.error('❌ Intrackt: Error getting auth token:', error);
    return null; // Return null on complete failure
  }
}

/**
 * Fetches categorized emails from the backend in the background.
 * Prevents syncing if already synced recently or if no user is logged in.
 * This function now returns its result to the caller (e.g., message listener).
 * @returns {Promise<{success: boolean, categorizedEmails?: object, userPlan?: string, quota?: object, error?: string}>}
 * @async
 */
async function fetchEmailsInBackground() {
  const now = Date.now();
  if (now - lastSyncTimestamp < SYNC_COOLDOWN_MILLISECONDS) {
    // Return a success response indicating no action needed due to cooldown
    return { success: true, categorizedEmails: {}, userPlan: userPlan, message: "Skipping sync due to cooldown." };
  }
  if (!userEmail) {
    console.warn('Intrackt: Cannot sync emails - no userEmail available.');
    return { success: false, error: 'No user email available for sync.' };
  }

  let token = await getAuthToken();
  if (!token) {
    console.error('❌ Intrackt: No auth token available for email sync.');
    // Optionally, notify the user that they might need to re-authenticate
    chrome.runtime.sendMessage({ type: 'AUTH_REQUIRED' });
    return { success: false, error: 'Authentication required. Please log in.' };
  }

  try {
    const data = await apiFetch('emails', { // Renamed 'resp' to 'data' for clarity
      method: 'POST',
      body: JSON.stringify({ token, email: userEmail }),
    });

    if (!data.success) { // Backend explicitly indicates failure
      console.error('❌ Intrackt: Email sync failed according to backend response.');
      return { success: false, error: data.error || 'Backend reported an error during email sync.', quota: data.quota };
    }

    // Update categorizedEmails in local storage
    await chrome.storage.local.set({ categorizedEmails: data.categorizedEmails });

    // Update userPlan if provided and changed
    if (data.userPlan && data.userPlan !== userPlan) {
      userPlan = data.userPlan;
      await chrome.storage.local.set({ userPlan: data.userPlan });
      chrome.runtime.sendMessage({ type: 'USER_PLAN_UPDATED', userPlan: data.userPlan });
    }

    // Update last sync timestamp
    lastSyncTimestamp = now;
    await chrome.storage.local.set({ lastSyncTimestamp: lastSyncTimestamp });

    // Broadcast a general update message, in addition to returning the data.
    chrome.runtime.sendMessage({ type: 'NEW_EMAILS_UPDATED' });

    return { success: true, categorizedEmails: data.categorizedEmails, userPlan: userPlan, quota: data.quota };
  } catch (err) {
    console.error('❌ Intrackt: fetchEmailsInBackground failed:', err);
    // If it's an authorization error, remove the cached token to force re-login next time
    if (/(401|Invalid)/.test(err.message)) {
      console.warn('Intrackt: Invalid auth token detected. Removing cached token.');
      chrome.identity.removeCachedAuthToken({ token }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error removing cached Google auth token:', chrome.runtime.lastError);
        }
      });
      chrome.runtime.sendMessage({ type: 'AUTH_REQUIRED' }); // Prompt user to re-authenticate
    }
    return { success: false, error: err.message };
  }
}

/**
 * Handles misclassification reports from the UI.
 * Saves the misclassified email to the backend and performs email archiving/deletion.
 * @param {object} emailData - Data about the misclassified email.
 * @param {string} emailData.emailId - The ID of the misclassified email.
 * @param {string} emailData.correctCategory - The correct category (e.g., "Irrelevant").
 * @param {string} [emailData.userId] - The user ID associated with the email (optional, derived from userEmail).
 * @returns {Promise<{success: boolean, error?: string}>}
 * @async
 */
async function handleMisclassification(emailData) {

  // Ensure userEmail is available for backend calls that require it
  if (!userEmail) {
    console.error("❌ Intrackt: Cannot handle misclassification, user email not available.");
    return { success: false, error: "User not authenticated." };
  }

  try {
    // 1. Save misclassified email for retraining
    await apiFetch('emails/save-misclassified', {
      method: 'POST',
      body: JSON.stringify({ ...emailData, userId: userEmail }), // Ensure userId is passed, using userEmail
    });

    // 2. Perform action based on correctCategory
    if (emailData.correctCategory === "Irrelevant") {
      await apiFetch('emails/archive', {
        method: 'POST',
        body: JSON.stringify({
          userId: userEmail, // Use userEmail for consistency
          emailId: emailData.emailId
        }),
      });
    } else {
      // Assuming 'delete' means remove from Intrackt's tracking, not necessarily Gmail deletion
      // If it implies deleting from Gmail, you'd need the Gmail API to move it to trash.
      await apiFetch('emails/delete', {
        method: 'POST',
        body: JSON.stringify({ emailId: emailData.emailId, userId: userEmail }), // Pass userId for context
      });
    }
    return { success: true };
  } catch (error) {
    console.error("❌ Intrackt: Error handling misclassified email:", error);
    return { success: false, error: error.message };
  }
}

// --- Login/Authentication Flow ---

/**
 * Handles the full login process, including Google OAuth and backend token exchange.
 * @param {function} sendResponse - Callback to send response back to the message sender.
 * @async
 * @returns {boolean} True to indicate sendResponse will be called asynchronously.
 */
function handleLogin(sendResponse) {
  // Use a IIFE (Immediately Invoked Function Expression) to allow async/await inside onMessage listener.
  (async () => {
    let token = null;
    let profile = null;

    try {
      // Step 1: Get initial Google OAuth token
      token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, t => {
          if (chrome.runtime.lastError || !t) {
            reject(new Error(chrome.runtime.lastError?.message || 'Failed to get initial auth token.'));
          } else {
            resolve(t);
          }
        });
      });

      // Step 2: Fetch user profile using the token
      profile = await apiFetchFromGoogle('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      }); // Using a dedicated fetch for Google APIs for clarity

      userEmail = profile.email;

      if (!userEmail) {
        throw new Error('No email found in Google profile.');
      }
      // Save initial userEmail and set plan to free locally
      await chrome.storage.local.set({ userEmail, userPlan: 'free' });

      // Step 3: Get backend-specific auth URL (e.g., for consent)
      const authUrlResp = await apiFetch(`auth/auth-url?email=${encodeURIComponent(userEmail)}`);
      const { url } = authUrlResp; // apiFetch now returns parsed JSON

      const authUrl = new URL(url);
      authUrl.searchParams.set('redirect_uri', chrome.identity.getRedirectURL('oauth2'));

      // Step 4: Launch web auth flow for backend consent
      const redirectUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true }, rUrl => {
          if (chrome.runtime.lastError || !rUrl) {
            reject(new Error(chrome.runtime.lastError?.message || 'Consent flow cancelled or failed.'));
          } else {
            resolve(rUrl);
          }
        });
      });

      const parsedRedirect = new URL(redirectUrl);
      const code = parsedRedirect.searchParams.get('code');
      const state = parsedRedirect.searchParams.get('state');

      if (!code || !state) {
        throw new Error('Missing code or state in backend redirect.');
      }

      // Step 5: Exchange code for backend token
      const tokenExchangeResp = await apiFetch('auth/token', {
        method: 'POST',
        body: JSON.stringify({ code, state })
      });

      if (!tokenExchangeResp.success) {
        throw new Error(tokenExchangeResp.error || 'Backend token exchange failed.');
      }

      // All steps successful, send success response
      sendResponse({ success: true, token, email: userEmail });

      // After successful login, initiate email fetch (this is a separate background task)
      fetchEmailsInBackground();
    } catch (err) {
      console.error('❌ Intrackt: Login process failed:', err);
      // Ensure cached token is removed if something went wrong after initial acquisition
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => { });
      }
      sendResponse({ success: false, error: err.message || 'An unknown error occurred during login.' });
    }
  })();

  // Return true to indicate that sendResponse will be called asynchronously.
  return true;
}

/**
 * Helper for fetching directly from Google APIs (like userinfo).
 * Separated from apiFetch to clarify it's not going to YOUR backend.
 * @param {string} url - The full URL to the Google API endpoint.
 * @param {object} options - Fetch options.
 * @returns {Promise<any>} Parsed JSON data.
 * @throws {Error} If the fetch fails.
 */
async function apiFetchFromGoogle(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API HTTP Error ${response.status}: ${errorText || response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Intrackt: Google API fetch to ${url} failed:`, error);
    throw error;
  }
}


// --- Message Listener ---

/**
 * Listens for messages from other parts of the extension (e.g., popup script).
 * Handles various commands like LOGIN, LOGOUT, CHECK_LOGIN_STATUS, FETCH_EMAILS, REPORT_MISCLASSIFICATION.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'LOGIN':
      return handleLogin(sendResponse); // handleLogin asynchronously calls sendResponse

    case 'CHECK_LOGIN_STATUS':
      sendResponse({ userEmail, userPlan });
      return true; // Synchronous response

    case 'LOGOUT':
      userEmail = null;
      userPlan = 'free';
      // Clear all local storage related to the user session
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing local storage:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      // Also remove cached Google auth tokens
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          chrome.identity.removeCachedAuthToken({ token }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error removing cached Google auth token:', chrome.runtime.lastError);
            } else {
            }
          });
        }
      });
      return true; // Asynchronous response due to chrome.storage.local.clear and chrome.identity.removeCachedAuthToken

    case 'FETCH_NEW_EMAILS': // Renamed from 'FETCH_EMAILS' for consistency
      // Execute fetchEmailsInBackground and send its result back
      (async () => {
        const result = await fetchEmailsInBackground();
        sendResponse(result);
      })();
      return true; // Indicate that sendResponse will be called asynchronously

    case 'FETCH_STORED_EMAILS':
      (async () => {
        if (!msg.userEmail) {
          sendResponse({ success: false, error: 'User email not provided for FETCH_STORED_EMAILS.' });
          return;
        }
        try {
          const data = await apiFetch('emails/stored-emails', { // Corrected endpoint for stored emails
            method: 'POST',
            body: JSON.stringify({ email: msg.userEmail })
          });
          sendResponse({ success: true, categorizedEmails: data.categorizedEmails });
        } catch (error) {
          console.error('❌ Intrackt: Error handling FETCH_STORED_EMAILS message:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Indicate that sendResponse will be called asynchronously

    case 'FETCH_QUOTA_DATA':
      (async () => {
        if (!msg.userEmail) {
          sendResponse({ success: false, error: 'User email not provided for FETCH_QUOTA_DATA.' });
          return;
        }
        try {
          const data = await apiFetch('user', {
            method: 'POST',
            body: JSON.stringify({ email: msg.userEmail })
          });
          sendResponse({ success: true, quota: data.quota });
        } catch (error) {
          console.error('❌ Intrackt: Error handling FETCH_QUOTA_DATA message:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Indicate that sendResponse will be called asynchronously

    case 'FETCH_USER_PLAN': // NEW: Handle requests to fetch user plan
      (async () => {
        if (!msg.userEmail) {
          sendResponse({ success: false, error: 'User email not provided for FETCH_USER_PLAN.' });
          return;
        }
        try {
          const data = await apiFetch('user', { // Re-using the 'user' endpoint
            method: 'POST',
            body: JSON.stringify({ email: msg.userEmail })
          });
          sendResponse({ success: true, plan: data.plan }); // Send back the plan
        } catch (error) {
          console.error('❌ Intrackt: Error handling FETCH_USER_PLAN message:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Indicate that sendResponse will be called asynchronously

    case 'REPORT_MISCLASSIFICATION':
      // The `handleMisclassification` function is async and returns a promise.
      // We need to wait for it and then send the response.
      (async () => {
        const result = await handleMisclassification(msg);
        sendResponse(result);
      })();
      return true; // Indicate that sendResponse will be called asynchronously

    default:
      console.warn('Intrackt: Unhandled message type:', msg.type);
      sendResponse({ success: false, error: 'Unknown message type.' }); // Provide a default error response
      return false; // No async response expected for unhandled types
  }
});

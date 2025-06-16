// --- Constants ---
const SYNC_INTERVAL_MINUTES = 15;
const SYNC_COOLDOWN_MILLISECONDS = (SYNC_INTERVAL_MINUTES * 60 * 1000) / 2; 
const BACKEND_BASE_URL = 'http://localhost:3000';

// --- Global State ---
let userEmail = null;
let userPlan = 'free';
let lastSyncTimestamp = 0; 
// --- Initialization Logic ---

/**
 * Initializes the extension upon installation.
 * Sets up an alarm for periodic email synchronization.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Intrackt: Extension installed. Setting up emailSync alarm.');
  chrome.alarms.create('emailSync', { periodInMinutes: SYNC_INTERVAL_MINUTES });
});

/**
 * Listener for alarms. Triggers email synchronization when the 'emailSync' alarm fires.
 */
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'emailSync') {
    console.log('Intrackt: emailSync alarm triggered.');
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
      console.log('✅ Intrackt: Session restored for', userEmail);
      updateUserPlanFromBackend(); // Attempt to get the latest plan
    } else {
      console.log('ℹ️ Intrackt: No active session found.');
    }
  }
);

// --- API Utility Function ---
/**
 * Generic function to make authenticated fetch requests to the backend.
 * @param {string} endpoint - The API endpoint relative to BACKEND_BASE_URL.
 * @param {object} options - Fetch options (method, headers, body).
 * @returns {Promise<Response>} The fetch response object.
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
    return response;
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
    const resp = await apiFetch('user', {
      method: 'POST',
      body: JSON.stringify({ email: userEmail }),
    });
    const { plan } = await resp.json();
    if (plan && plan !== userPlan) { // Only update if plan has changed
      userPlan = plan;
      await chrome.storage.local.set({ userPlan: plan });
      console.log('✅ Intrackt: userPlan updated to:', plan);
      // Notify popup if plan changes while it's open
      chrome.runtime.sendMessage({ type: 'USER_PLAN_UPDATED', userPlan: plan });
    } else {
      console.log('ℹ️ Intrackt: User plan is already up to date or not provided by backend.');
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
          resolve(null); 
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
 * @async
 */
async function fetchEmailsInBackground() {
  const now = Date.now();
  if (now - lastSyncTimestamp < SYNC_COOLDOWN_MILLISECONDS) {
    console.log('ℹ️ Intrackt: Skipping email sync - too soon since last sync.');
    return;
  }
  if (!userEmail) {
    console.warn('Intrackt: Cannot sync emails - no userEmail available.');
    return;
  }

  let token = await getAuthToken();
  if (!token) {
    console.error('❌ Intrackt: No auth token available for email sync.');
    // Optionally, notify the user that they might need to re-authenticate
    chrome.runtime.sendMessage({ type: 'AUTH_REQUIRED' });
    return;
  }

  try {
    const resp = await apiFetch('emails', {
      method: 'POST',
      body: JSON.stringify({ token, email: userEmail }),
    });

    const { success, categorizedEmails, userPlan: updatedUserPlan } = await resp.json();

    if (success) {
      await chrome.storage.local.set({ categorizedEmails }); // Use await for storage operations

      if (updatedUserPlan && updatedUserPlan !== userPlan) { // Only update if plan changes
        userPlan = updatedUserPlan;
        await chrome.storage.local.set({ userPlan: updatedUserPlan });
        console.log('✅ Intrackt: User plan updated during email sync:', updatedUserPlan);
        chrome.runtime.sendMessage({ type: 'USER_PLAN_UPDATED', userPlan: updatedUserPlan });
      }

      lastSyncTimestamp = now;
      await chrome.storage.local.set({ lastSyncTimestamp: lastSyncTimestamp }); // Use await
      console.log('✅ Intrackt: Emails synced successfully.');
      chrome.runtime.sendMessage({ type: 'NEW_EMAILS_UPDATED' }); // Notify popup
    } else {
      console.error('❌ Intrackt: Email sync failed according to backend response.');
    }
  } catch (err) {
    console.error('❌ Intrackt: fetchEmailsInBackground failed:', err);
    // If it's an authorization error, remove the cached token to force re-login next time
    if (/(401|Invalid)/.test(err.message)) {
      console.warn('Intrackt: Invalid auth token detected. Removing cached token.');
      chrome.identity.removeCachedAuthToken({ token }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error removing cached auth token:', chrome.runtime.lastError);
        }
      });
      chrome.runtime.sendMessage({ type: 'AUTH_REQUIRED' }); // Prompt user to re-authenticate
    }
  }
}

/**
 * Handles misclassification reports from the UI.
 * Saves the misclassified email to the backend and performs email archiving/deletion.
 * @param {object} emailData - Data about the misclassified email.
 * @param {string} emailData.emailId - The ID of the misclassified email.
 * @param {string} emailData.correctCategory - The correct category (e.g., "Irrelevant").
 * @param {string} [emailData.userId] - The user ID associated with the email (optional, derived from userEmail).
 * @async
 */
async function handleMisclassification(emailData) {
  console.log("📌 Intrackt: Misclassified Email Reported:", emailData);

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
    console.log("✅ Intrackt: Misclassification saved for retraining.");

    // 2. Perform action based on correctCategory
    if (emailData.correctCategory === "Irrelevant") {
      console.log(`📦 Intrackt: Archiving email ${emailData.emailId} as Irrelevant`);
      await apiFetch('emails/archive', {
        method: 'POST',
        body: JSON.stringify({
          userId: userEmail,
          emailId: emailData.emailId
        }),
      });
      console.log("✅ Intrackt: Email archived successfully.");
    } else {
      await apiFetch('emails/delete', {
        method: 'POST',
        body: JSON.stringify({ emailId: emailData.emailId, userId: userEmail }), // Pass userId for context
      });
      console.log(`🗑️ Intrackt: Removed misclassified email: ${emailData.emailId}`);
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
      console.log('✅ Intrackt: Google auth token acquired.');

      // Step 2: Fetch user profile using the token
      const profileResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!profileResp.ok) throw new Error(`Profile fetch HTTP ${profileResp.status}`);
      profile = await profileResp.json();
      userEmail = profile.email;

      if (!userEmail) {
        throw new Error('No email found in Google profile.');
      }
      console.log('✅ Intrackt: Logged in as', userEmail);
      // Save initial userEmail and set plan to free locally
      await chrome.storage.local.set({ userEmail, userPlan: 'free' });

      // Step 3: Get backend-specific auth URL (e.g., for consent)
      const authUrlResp = await apiFetch(`auth/auth-url?email=${encodeURIComponent(userEmail)}`);
      const { url } = await authUrlResp.json();

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
      console.log('✅ Intrackt: Backend consent flow completed.');

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
      const tokenRespData = await tokenExchangeResp.json();

      if (!tokenRespData.success) {
        throw new Error(tokenRespData.error || 'Backend token exchange failed.');
      }
      console.log('✅ Intrackt: Backend token exchange successful.');

      sendResponse({ success: true, token, email: userEmail });

      fetchEmailsInBackground();
    } catch (err) {
      console.error('❌ Intrackt: Login process failed:', err);
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => { });
      }
      sendResponse({ success: false, error: err.message || 'An unknown error occurred during login.' });
    }
  })();

  return true;
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log(`Intrackt: Received message type: ${msg.type}`);
  switch (msg.type) {
    case 'LOGIN':
      return handleLogin(sendResponse); 

    case 'CHECK_LOGIN_STATUS':
      sendResponse({ userEmail, userPlan });
      return true; 

    case 'LOGOUT':
      userEmail = null;
      userPlan = 'free';
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing local storage:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('✅ Intrackt: User logged out and local storage cleared.');
          sendResponse({ success: true });
        }
      });
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          chrome.identity.removeCachedAuthToken({ token }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error removing cached Google auth token:', chrome.runtime.lastError);
            } else {
              console.log('✅ Intrackt: Cached Google auth token removed.');
            }
          });
        }
      });
      return true; 
    case 'FETCH_EMAILS':
      fetchEmailsInBackground();
      sendResponse({ success: true }); 
      return true;

    case 'REPORT_MISCLASSIFICATION':
      (async () => {
        const result = await handleMisclassification(msg);
        sendResponse(result);
      })();
      return true; 

    default:
      console.warn('Intrackt: Unhandled message type:', msg.type);
      sendResponse({ success: false, error: 'Unknown message type.' }); 
      return false;
  }
});

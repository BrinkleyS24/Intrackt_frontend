// background.js (Manifest V3 service worker)

const SYNC_INTERVAL_MINUTES = 15;
const BACKEND = 'http://localhost:3000';

// ── Initialization ───────────────────────────────────────────────────────────

// 1. On install, schedule a recurring alarm (won’t auto-run until login)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('emailSync', { periodInMinutes: SYNC_INTERVAL_MINUTES });
});

// 2. On each alarm, attempt a sync
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'emailSync') fetchEmailsInBackground();
});

// ── State ───────────────────────────────────────────────────────────────────────

let userEmail = null;
let userPlan = 'free';
let lastSync = 0;

// Restore from storage (but don’t auto-sync here)
chrome.storage.local.get(
  ['userEmail', 'userPlan', 'lastSyncTimestamp'],
  data => {
    userEmail = data.userEmail || null;
    userPlan = data.userPlan || 'free';
    lastSync = data.lastSyncTimestamp || 0;
    if (userEmail) {
      console.log('✅ Session restored for', userEmail);
      updateUserPlanFromBackend(); // Fetch latest plan
    }
  }
);

// ── Core Logic ─────────────────────────────────────────────────────────────────

async function updateUserPlanFromBackend() {
  if (!userEmail) return;
  try {
    const resp = await fetch(`${BACKEND}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const { plan } = await resp.json();
    if (plan) {
      userPlan = plan;
      chrome.storage.local.set({ userPlan: plan });
      console.log('✅ userPlan updated to:', plan);
    }
  } catch (err) {
    console.error('Failed to update userPlan from backend:', err);
  }
}

async function fetchEmailsInBackground() {
  const now = Date.now();
  // avoid double sync within half the interval
  if (now - lastSync < (SYNC_INTERVAL_MINUTES * 60e3) / 2) return;
  if (!userEmail) {
    return console.warn('Cannot sync: no userEmail');
  }

  let token;
  try {
    // 1) Try non-interactive token fetch
    token = await new Promise((res, rej) => {
      chrome.identity.getAuthToken({ interactive: false }, t =>
        chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(t)
      );
    });
  } catch {
    // 2) Fallback to interactive
    token = await new Promise((res, rej) => {
      chrome.identity.getAuthToken({ interactive: true }, t =>
        chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(t)
      );
    });
  }

  if (!token) return console.error('No auth token available');

  try {
    const resp = await fetch(`${BACKEND}/api/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email: userEmail })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${txt}`);
    }

    const { success, categorizedEmails, userPlan: updatedUserPlan } = await resp.json();

    if (success) {
      chrome.storage.local.set({ categorizedEmails });

      if (updatedUserPlan) {
        chrome.storage.local.set({ userPlan: updatedUserPlan });
        userPlan = updatedUserPlan;
      }

      chrome.runtime.sendMessage({ type: 'NEW_EMAILS_UPDATED' });
      lastSync = now;
      chrome.storage.local.set({ lastSyncTimestamp: lastSync });
      console.log('✅ Emails synced');
    }
  } catch (err) {
    console.error('fetchEmailsInBackground failed:', err);
    if (/(401|Invalid)/.test(err.message)) {
      chrome.identity.removeCachedAuthToken({ token }, () => { });
    }
  }
}

// ── Misclassification Handler ────────────────────────────────────────────────

async function handleMisclassification(emailData) {
  console.log("📌 Misclassified Email Reported:", emailData);

  try {
    // 1) Save the misclassification for retraining
    const saveResponse = await fetch(`${BACKEND}/api/emails/save-misclassified`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData),
    });
    if (!saveResponse.ok) {
      console.error("❌ Error saving misclassified email:", await saveResponse.text());
      return;
    }
    console.log("✅ Misclassification saved for retraining.");

    // 2) If user said “Irrelevant”, soft-delete (archive) it in the emails table
    if (emailData.correctCategory === "Irrelevant") {
      console.log(`📦 Archiving email ${emailData.emailId} as Irrelevant`);
      const archiveResp = await fetch(`${BACKEND}/api/emails/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: emailData.userId,
          emailId: emailData.emailId
        }),
      });
      if (!archiveResp.ok) {
        console.error("❌ Error archiving email:", await archiveResp.text());
      } else {
        console.log("✅ Email archived successfully.");
      }
    } else {
      // 3) Otherwise delete it as before (for other corrections)
      await fetch(`${BACKEND}/api/emails/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: emailData.emailId }),
      });
      console.log(`🗑️ Removed misclassified email: ${emailData.emailId}`);
    }

  } catch (error) {
    console.error("❌ Error handling misclassified email:", error);
  }
}




// ── Login Flow ────────────────────────────────────────────────────────────────

function handleLogin(sendResponse) {
  // Step 1: get a Google OAuth2 access token via chrome.identity
  chrome.identity.getAuthToken({ interactive: true }, async (token) => {
    if (chrome.runtime.lastError || !token) {
      return sendResponse({
        success: false,
        error: chrome.runtime.lastError?.message || 'Failed to get auth token'
      });
    }

    let profile;
    try {
      // Step 2: fetch the user’s Google profile to get their email
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error(`Profile fetch HTTP ${resp.status}`);
      profile = await resp.json();
    } catch (err) {
      // clear bad token so next time they’ll re-auth
      chrome.identity.removeCachedAuthToken({ token }, () => { });
      return sendResponse({ success: false, error: 'Failed to fetch Google profile' });
    }

    const userEmail = profile.email;
    if (!userEmail) {
      return sendResponse({ success: false, error: 'No email in profile response' });
    }

    // persist locally
    chrome.storage.local.set({ userEmail, userPlan: 'free' });
    console.log('✅ Logged in as', userEmail);

    try {
      // Step 3: request your backend for a Google consent URL, passing state=userEmail
      const { url } = await fetch(
        `${BACKEND}/api/auth/auth-url?email=${encodeURIComponent(userEmail)}`
      ).then(r => r.json());

      // override the redirect_uri so it returns to this extension
      const authUrl = new URL(url);
      authUrl.searchParams.set(
        'redirect_uri',
        chrome.identity.getRedirectURL('oauth2')
      );

      // Step 4: open Google’s consent screen
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        async (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            console.error('❌ Consent cancelled or failed', chrome.runtime.lastError);
            return sendResponse({ success: false, error: 'Consent failed or cancelled' });
          }

          // Parse out the code & the state (the email) from the redirect
          const parsed = new URL(redirectUrl);
          const code = parsed.searchParams.get('code');
          const state = parsed.searchParams.get('state');
          if (!code || !state) {
            return sendResponse({ success: false, error: 'Missing code or state in redirect' });
          }

          // Step 5: exchange code+state with your backend to store refresh_token
          const tokenResp = await fetch(`${BACKEND}/api/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state })
          }).then(r => r.json());

          if (!tokenResp.success) {
            return sendResponse({ success: false, error: tokenResp.error || 'Token exchange failed' });
          }

          sendResponse({ success: true, token, email: userEmail });

          // kick off initial sync now that refresh_token exists
          fetchEmailsInBackground();
        }
      );
    } catch (err) {
      console.error('❌ handleLogin backend error:', err);
      sendResponse({ success: false, error: err.message });
    }
  });

  // return true to keep the message channel open for the async response
  return true;
}

// ── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'LOGIN':
      return handleLogin(sendResponse);

    case 'CHECK_LOGIN_STATUS':
      sendResponse({ userEmail, userPlan });
      return true;

    case 'LOGOUT':
      userEmail = null;
      userPlan = 'free';
      chrome.storage.local.clear();
      sendResponse({ success: true });
      return true;

    case 'FETCH_EMAILS':
      fetchEmailsInBackground();
      sendResponse({ success: true });
      return true;

    case 'REPORT_MISCLASSIFICATION':
      handleMisclassification(msg);
      sendResponse({ success: true });
      return true;
    default:
      // If we don't handle this message type, do nothing.
      return false;
  }
});

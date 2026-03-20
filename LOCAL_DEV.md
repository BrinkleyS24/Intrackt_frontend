# MorrowFold local dev (no constant URL switching)

## What this solves
The popup UI reads email lists from `chrome.storage.local` (not directly from the backend). The background service worker populates that cache by calling the backend. By default the extension points at the **production** Cloud Run backend. For local dev, configure it to use `localhost:3000` instead.

## Preferred: set backend URL at build time (`.env` method)

Set `BACKEND_BASE_URL` in `frontend/job_sort/.env` **before building**:

```
BACKEND_BASE_URL=http://localhost:3000
```

Then rebuild and reload the extension in Chrome. This bakes the URL directly into
the bundled `background.js` — no DevTools commands needed.

To go back to production: remove (or comment out) the line and rebuild.

## Prereqs
- Run the backend locally (default port `3000`).
- Build the extension once and load it as an unpacked extension.

### Recommended (Windows / OneDrive-safe) build flow
Parcel can fail on Windows when building into a folder Chrome (or OneDrive/AV) is actively touching. Use this script to build **outside OneDrive** and keep a stable `current` folder you load into Chrome once:

```powershell
cd frontend\job_sort
.\scripts\build_extension_dev.ps1
```

Then in `chrome://extensions` click **Load unpacked** and select:

```text
%LOCALAPPDATA%\MorrowFold\extension-dev\current
```

After you make code changes, rerun the script and click the extension **Reload** icon.

## Alternative: set backend to localhost at runtime (one-time)
1. Open `chrome://extensions`
2. Find **MorrowFold** → click **Inspect views** → **popup** (or right-click the extension icon → **Inspect popup**)
3. In the popup DevTools console, run:

```js
chrome.runtime.sendMessage({
  type: 'SET_BACKEND_BASE_URL',
  backendBaseUrl: 'http://localhost:3000',
}).then(console.log);
```

4. Reload the extension (or just retry a sync).

## Verify what backend the extension is using
Run:

```js
chrome.runtime.sendMessage({ type: 'GET_BACKEND_BASE_URL' }).then(console.log);
```

## If you see “Could not establish connection. Receiving end does not exist.”
That usually means you ran `chrome.runtime.sendMessage(...)` from a context that has no receiver.

Common case: running the snippet in the **service worker DevTools**. A service worker sending a message doesn’t deliver to itself; it delivers to other extension pages (popup/options). If none are open (or if you’re in the wrong DevTools), Chrome reports “Receiving end does not exist.”

Fix: run the snippet from the **popup DevTools** (steps above), or open the popup first and try again.

## Verify you’re on the right extension build
If message types are "Unhandled" or settings don’t seem to stick, confirm what build Chrome is running:

```js
chrome.runtime.sendMessage({ type: 'GET_BUILD_INFO' }).then(console.log);
```

### Alternative (works from service worker DevTools)
If you want to set it directly from the service worker console without messaging:

```js
chrome.storage.local.set({ backendBaseUrlOverride: 'http://localhost:3000' }).then(() => {
  console.log('Saved override; reload the extension.');
});
```

## Reset back to production Cloud Run
Run:

```js
chrome.runtime.sendMessage({
  type: 'SET_BACKEND_BASE_URL',
  backendBaseUrl: null,
}).then(console.log);
```

## Point the Upgrade button at your premium web app (optional)
The **Upgrade** button opens `PREMIUM_DASHBOARD_URL`.

For local development, your new premium web app runs on `http://localhost:5173` by default (Vite).

### Set premium URL to localhost
From the **popup DevTools** console, run:

```js
chrome.runtime.sendMessage({
  type: 'SET_PREMIUM_DASHBOARD_URL',
  premiumDashboardUrl: 'http://localhost:5173/pricing',
}).then(console.log);
```

Verify:

```js
chrome.runtime.sendMessage({ type: 'GET_PREMIUM_DASHBOARD_URL' }).then(console.log);
```

### Alternative (works even if the background script is an older build)
If you see `{ success: false, error: 'Unhandled message type.' }`, set it directly in storage and reload:

```js
chrome.storage.local.set({ premiumDashboardUrlOverride: 'http://localhost:5173/pricing' }).then(() => {
  console.log('Saved override; reload the extension.');
});
```

### Reset back to the build-time default

```js
chrome.runtime.sendMessage({
  type: 'SET_PREMIUM_DASHBOARD_URL',
  premiumDashboardUrl: null,
}).then(console.log);
```

## Safety notes
- The override only accepts `http://localhost:*` or `http://127.0.0.1:*` by design.
- Do **not** ship `frontend/job_sort/manifest.json` to the Chrome Web Store as-is if you want to avoid localhost permissions in production. Use your production manifest/build.


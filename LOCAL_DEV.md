# Applendium local dev (no constant URL switching)

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

## Stable OAuth identity for unpacked smoke/dev builds

If you need Google OAuth to work in an unpacked build, the build must include a stable
extension public key. Otherwise Chrome assigns a random extension ID and the redirect URI
changes on every load.

Set one of these in `frontend/job_sort/.env` before building:

```text
EXTENSION_MANIFEST_KEY_LOCAL=<base64 public key>
```

or the generic fallback:

```text
EXTENSION_MANIFEST_KEY=<base64 public key>
```

Optional:

```text
EXTENSION_EXPECTED_ID_LOCAL=<expected extension id>
```

That lets `npm run smoke:local` fail fast if the unpacked build does not match the intended OAuth identity.

## Prereqs
- Run the backend locally (default port `3000`).
- Build the extension once and load it as an unpacked extension.

### Recommended build flow
If you load the unpacked extension from `frontend/job_sort/popup/dist`, use:

```powershell
cd frontend\job_sort
npm run use:local
```

Then in `chrome://extensions` click **Load unpacked** and select:

```text
frontend/job_sort/popup/dist
```

After you make code changes, rerun the command and click the extension **Reload** icon.

### Alternative: external build folder
If you want the Windows / OneDrive-safe external build flow instead, use:

```powershell
cd frontend\job_sort
npm run use:local:external
```

Then load:

```text
%LOCALAPPDATA%\Applendium\extension-dev\current
```

## Alternative: set backend to localhost at runtime (one-time)
1. Open `chrome://extensions`
2. Find **Applendium** → click **Inspect views** → **popup** (or right-click the extension icon → **Inspect popup**)
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
If you load from `frontend/job_sort/dist`, rebuild the prod bundle:

```powershell
npm run use:prod
```

If you load from `%LOCALAPPDATA%\Applendium\extension-dev\current`, use:

```powershell
npm run use:prod:external
```

Or run:

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

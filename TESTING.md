# Extension Testing Lab

This extension now ships with a fixture-backed testing surface for the popup UI.

## What it gives you

- A manual lab page inside the unpacked extension.
- Scenario switching for logged-out, free, premium, empty, quota-limit, and stuck-sync states.
- A live state inspector for auth, plan, quota, sync, and category counts.
- Safe restoration back to live mode after fixture testing.
- Playwright coverage for the lab and popup rendering.

## Manual workflow

1. Build the extension:

```powershell
cd frontend\job_sort
npm run build
```

2. Load the unpacked extension from:

```text
frontend/job_sort/popup/dist
```

3. Open the lab page:

```text
chrome-extension://<your-extension-id>/testing/public/index.html
```

4. Pick a scenario in the left panel. The iframe renders the real popup page, not a mocked clone.

5. Use the state inspector in the left panel to confirm which auth, plan, quota, and sync inputs are active before validating the popup UI.

6. Use **Restore Live Mode** before going back to normal extension use.

## Automated checks

Run the Playwright suite from `frontend/job_sort`:

```powershell
npm run test:e2e
```

The suite covers:

- Logged-out to signed-in login transition
- Free-plan inbox and preview flow
- Free-plan limit reached premium-status state
- Stuck sync warning state
- Premium-state footer behavior

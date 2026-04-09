# Extension Release

## Primary command

Build, verify, and package the Chrome Web Store bundle:

```powershell
cd frontend\job_sort
npm run release:prod
```

That command:
- builds with `manifest.prod.json`
- forces production backend and premium URLs
- verifies the output bundle is version-aligned and excludes localhost/testing-only entries
- writes `applendium-extension-v<version>.zip`

Current launch shape:
- free-core extension is live
- premium CTA points to the public `/upgrade` holding page
- no live premium checkout or dashboard promise is made from the popup

## Manual checkpoints

Before uploading the zip:

1. Run the extension lab regression suite:

```powershell
npm run test:e2e
```

2. Confirm the generated zip version matches:
- `package.json`
- `manifest.json`
- `manifest.prod.json`

3. For a real OAuth smoke, set a stable manifest key before building:
- `EXTENSION_MANIFEST_KEY_PROD` or `EXTENSION_MANIFEST_KEY`
- optionally `EXTENSION_EXPECTED_ID_PROD` to assert the exact extension ID during smoke

4. Run both smoke passes:

```powershell
npm run test:e2e
npm run smoke:prod
npm run smoke:prod:chrome
```

5. Smoke the production popup copy:
- free users should see `Premium coming soon`, not `Upgrade to Premium`
- quota-limit users should open the premium holding page, not a live checkout flow
- reply is not exposed in the email preview
- a manual refresh under degraded/offline network should show a visible error and preserve cached emails

6. Confirm backend monitoring is still ready:

```powershell
cd backend\gmail-job-tracker-be
npm run monitoring:status
```

If the notification channel still reports an indeterminate verification state, confirm the verification email manually in `applendium@gmail.com` before launch.

7. Upload the zip created in:

```text
frontend/job_sort/applendium-extension-v<version>.zip
```

## Rollback

If a bad package is submitted or published, use the runbook in:

```text
frontend/job_sort/ROLLBACK.md
```

## Verification command only

If you already built the production bundle and only want to validate it:

```powershell
npm run verify:prod
```

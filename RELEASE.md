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

3. Smoke the production popup copy:
- free users should see `Premium coming soon`, not `Upgrade to Premium`
- quota-limit users should open the premium holding page, not a live checkout flow
- reply is not exposed in the email preview

4. Upload the zip created in:

```text
frontend/job_sort/applendium-extension-v<version>.zip
```

## Verification command only

If you already built the production bundle and only want to validate it:

```powershell
npm run verify:prod
```

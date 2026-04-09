# Chrome Release Smoke Checklist

Run this before every Chrome Store submission or resubmission.

## Required command

```powershell
npm run smoke:prod
npm run test:e2e
```

This command:

- builds the production extension bundle into `popup/dist_prod`
- launches the production bundle in a fresh temporary Chrome for Testing profile
- loads the unpacked extension exactly as the smoke run target
- saves screenshots and a JSON report into a temporary artifact directory

## Required Google auth check

Because Google may block sign-in inside Chrome for Testing, the real OAuth login check must also be run in Chrome stable:

```powershell
npm run smoke:prod:chrome
```

That command launches a fresh Chrome stable profile at `chrome://extensions`. In current Chrome stable, `--load-extension` is not reliable for this path, so use `Load unpacked` and select `popup/dist_prod`, then open Applendium from the extension toolbar or puzzle menu for the manual sign-in / refresh / logout pass.

## Preconditions

- Production backend is reachable.
- Production Firebase / Google OAuth config is valid for the bundle being tested.
- The production smoke build includes a stable `manifest.key`.
  - Set `EXTENSION_MANIFEST_KEY_PROD` or `EXTENSION_MANIFEST_KEY` in `frontend/job_sort/.env` or your shell env before running the smoke.
- If you want the smoke to assert the exact Chrome identity, also set `EXTENSION_EXPECTED_ID_PROD`.
- A real smoke-test Google account is ready for sign-in.
- The smoke account is allowed to complete Gmail readonly consent.

## Pass criteria

The smoke run is only a pass if all of these happen in one run:

1. Chrome stable opens to `chrome://extensions` on a fresh profile.
2. `Load unpacked` succeeds for `popup/dist_prod`.
3. Opening the popup from the toolbar or puzzle menu shows a logged-out state.
4. No cached user state is present before login.
5. Google sign-in completes successfully.
6. The popup reaches the signed-in state and shows the plan badge.
7. Refresh does not surface an error toast or failure sync label.
8. Sign out returns the popup to the logged-out state.
9. Reopening the popup after logout still shows the logged-out state.
10. The popup does not emit console errors or page errors during the run.

## Required degraded-network pass

Before submission, also prove the popup handles a refresh failure without feeling broken:

1. Sign in successfully in the Chrome stable smoke profile.
2. Open DevTools for the popup and simulate `Offline`, or temporarily disconnect the machine from the network.
3. Click `Refresh`.
4. Confirm the popup shows a visible failure toast instead of a false success state.
5. Confirm the existing tracked-email list stays visible and usable.
6. Restore the network.
7. Click `Refresh` again and confirm the popup recovers cleanly.

The lab suite now covers this path in development:

```powershell
npm run test:e2e
```

But the release gate still requires one real Chrome-stable degraded-network pass before store submission.

## Monitoring preflight

Before submission, confirm monitoring is still intact:

```powershell
cd backend\gmail-job-tracker-be
npm run monitoring:status
```

If the email notification channel is present but still shows an indeterminate or unverified state, confirm the Google Cloud notification-channel verification email manually in `applendium@gmail.com` before launch.

## Failure handling

If the smoke run fails:

- do not submit the extension
- inspect the printed artifact directory
- review:
  - `smoke-report.json`
  - `debug-snapshot.json`
  - captured screenshots

## Notes

- The smoke script defaults to the production bundle at `popup/dist_prod`.
- `npm run smoke:prod` is still useful for extension-load and popup-state validation, but the authoritative Google login check is `npm run smoke:prod:chrome`.
- For local backend testing, use:

```powershell
npm run smoke:local
```

- Set `PW_HEADLESS=true` only if the OAuth flow can complete unattended.
- Set `KEEP_SMOKE_PROFILE=1` if you need to preserve the temporary browser profile for debugging after the run.

# Applendium Chrome Extension Rollback

This is the Chrome Web Store rollback runbook for the extension launch path.

## If The Update Is Still Pending Review Or Staged

If the package is submitted but not yet live:

- use `Cancel publish` in the Chrome Developer Dashboard to revert the staged submission back to a draft
- make the fix
- rebuild a fresh zip
- resubmit

Keep the current production zip as the known-good rollback package:

- `frontend/job_sort/applendium-extension-v1.0.0.zip`

## If A Bad Version Is Already Live

Use the Chrome Web Store rollback feature in the Developer Dashboard for the existing item.

Why:

- the Chrome Web Store can switch back to the previous published version quickly
- this does not require a new review
- the rollback republishes the previous package under a new version number
- pending staged or in-review submissions are discarded when the rollback completes

If dashboard rollback is unavailable or you need a deliberate re-release:

1. rebuild or recover the last known-good extension package
2. upload that package as a new version
3. submit and publish it through the normal update flow

## Before You Trigger A Rollback

Confirm:

1. the issue is really in the extension package, not the backend
2. the current production backend is healthy
3. the prior package is still compatible with the production backend and OAuth config

## After Rollback

1. Install/update the rolled-back version from the Web Store
2. Verify:
   - popup opens
   - Google login works
   - sync completes
   - refresh works
   - sign out works
3. Update the incident note with:
   - bad version
   - restored version
   - root cause
   - follow-up fix

## References

- Chrome Web Store update flow: https://developer.chrome.com/docs/webstore/update/
- Chrome Web Store rollback feature: https://developer.chrome.com/docs/webstore/rollback

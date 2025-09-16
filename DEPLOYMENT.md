# Chrome Web Store Deployment Guide

## 1. Prep
- Ensure `manifest.json` is production-safe (no dev URLs, minimal permissions).
- Version bumped each release (current: 1.0.1).
- Single OAuth2 client_id present and consent screen configured with matching scopes.

## 2. Manifest Highlights
- Permissions kept: identity, storage, alarms.
- Removed: activeTab (unused).
- Gmail scope minimized to readonly.
- Host permissions narrowed to production backend + Google auth endpoints.

## 3. Build & Package
PowerShell (set version for zip naming):
```
$env:EXT_VERSION=1.0.1
npm run package
```
Result: `intrackt-extension-v1.0.1.zip` containing:
- manifest.json
- icons/
- background.js (built bundle referenced in dist too if needed)
- popup/dist/* (index.html + hashed assets)

## 4. Store Listing Assets
Prepare:
- Icon 128x128 (already present).
- At least one 1280x800 (or 1280x720) screenshot of popup UI.
- Short description (<132 chars) and detailed description (explain data usage & privacy).
- Privacy Policy URL (must mention Gmail data handling + user data deletion path).

## 5. OAuth & Sensitive Scopes
- Only `gmail.readonly` reduces verification friction.
- If send functionality needed later, add `gmail.send` in a future version + reverify.
- Ensure Google Cloud Console OAuth consent screen: production, scopes listed, branding approved.

## 6. Data & Privacy Requirements
Include in privacy policy:
- Data collected: email metadata + categorized labels (no content stored long-term beyond classification cache if applicable).
- Purpose: classification & tracking application status.
- Retention: describe retention window / deletion policy.
- User deletion method: in‑extension action or support email.
- No sale/transfer to third parties.

## 7. Manual QA Checklist
- Fresh install: triggers login flow correctly.
- OAuth popup returns and user stored in local storage.
- Sync completes; categories populate.
- Logout clears local storage and prevents API calls.
- No console errors (chrome://extensions → Inspect views).

## 8. Submission Flow
1. Build & zip.
2. Go to Developer Dashboard → New Item.
3. Upload zip.
4. Fill metadata, attach screenshots, privacy policy URL.
5. Save draft, run automatic review suggestions.
6. Publish for trusted testers (optional) then public.

## 9. Post-Release
- Track error logs (backend) for auth failures.
- Increment version per change; never reuse version numbers.
- Maintain CHANGELOG (future improvement).

## 10. Future Enhancements
- Add performance instrumentation (optional).
- Add gmail.send when reply workflow finalized.
- Introduce feature flag system for experimental sync strategies.

(End)

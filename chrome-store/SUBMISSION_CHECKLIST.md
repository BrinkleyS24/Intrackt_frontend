# Applendium Chrome Store Submission Checklist

## Verified Locally

- Production manifest version is `1.0.0`.
- Production OAuth scope is read-only Gmail only.
- `gmail.send` is absent from the production manifest and backend auth route.
- `npm run build` passes for the extension.
- `npm run test:e2e` passes for the extension harness.
- `npm run release:prod` passes and produces `applendium-extension-v1.0.0.zip`.
- Store asset generator is wired through `npm run assets:store`.

## Submission Assets To Upload

- Zip package:
  - `applendium-extension-v1.0.0.zip`
- Screenshots:
  - `chrome-store/assets/screenshots/01-login.png`
  - `chrome-store/assets/screenshots/02-overview.png`
  - `chrome-store/assets/screenshots/03-interviews.png`
  - `chrome-store/assets/screenshots/04-thread-preview.png`
  - `chrome-store/assets/screenshots/05-free-limit.png`
- Promo images:
  - `chrome-store/assets/promo/small-promo-tile.png`
  - `chrome-store/assets/promo/marquee-promo-tile.png`
- Listing copy:
  - `chrome-store/LISTING_COPY.md`
- Reviewer notes:
  - `chrome-store/REVIEWER_NOTES.md`
- Privacy declaration reference:
  - `chrome-store/PRIVACY_DECLARATIONS.md`

## Must Verify Before Clicking Submit

- `https://applendium.com/privacy` is live and matches the extension behavior.
- `https://applendium.com/support` is live and monitored.
- `https://applendium.com/upgrade` is live and clearly states premium is closed.
- Real production-bundle smoke test passes:
  - fresh install
  - Google login
  - popup load after login
  - Gmail sync
  - logout
- Chrome Web Store privacy fields match:
  - manifest permissions
  - OAuth scopes
  - public privacy policy
- Google OAuth / Gmail scope verification status is clear for this app.
- Reviewer-facing contact email is monitored during review.

## Do Not Claim In The Listing

- Reply-from-extension
- Open premium checkout
- Cross-browser support
- Capabilities that depend on an unfinished premium dashboard

## Official Requirement Notes

- Chrome requires at least one screenshot and rejects listings with missing screenshots or blank descriptions.
- Chrome listing guidance recommends up to five screenshots and specifies `1280x800` or `640x400` full-bleed screenshots.
- Chrome image guidance states the extension icon, a small promo image, and at least one screenshot are mandatory.

## Official References

- Listing requirements: https://developer.chrome.com/docs/webstore/program-policies/listing-requirements
- Listing best practices: https://developer.chrome.com/docs/webstore/best-listing
- Image requirements: https://developer.chrome.com/webstore/images?csw=1

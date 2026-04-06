# Applendium Chrome Web Store Reviewer Notes

## What This Submission Is

Applendium is a Chrome extension that uses read-only Gmail access to group job-application emails by stage and present them inside the extension popup.

This launch is intentionally scoped as a free-core extension release.

- Premium billing is closed.
- The public `/upgrade` page is a status page, not an active checkout flow.
- The extension does not request `gmail.send`.

## Core Reviewer Flow

1. Install the extension package.
2. Pin Applendium or open it from the Chrome extensions menu.
3. Click `Sign in with Google` in the popup.
4. Complete Google sign-in and consent for read-only Gmail access.
5. Re-open the popup.
6. Confirm the popup shows grouped job-application conversations by stage.
7. Open a thread to review the application history view.
8. Use the footer link to confirm the public premium status page is a holding page rather than a live billing flow.

## Expected Behavior

- The popup is the primary product surface.
- The extension groups job-application conversations into `Applied`, `Interviews`, `Offers`, and `Rejected`.
- The popup supports search and manual refresh.
- The extension requests read-only Gmail access only.
- The popup does not offer reply-from-extension in this launch build.

## Public URLs

- Privacy policy: `https://applendium.com/privacy`
- Support: `https://applendium.com/support`
- Premium status page: `https://applendium.com/upgrade`

## Notes For Review

- The extension is most meaningful when the signed-in Gmail account already contains job-application emails.
- The content script is limited to Applendium app routes on `applendium.com` and is not injected across arbitrary sites.
- If premium language appears in the popup, it should point to the public status page rather than a live checkout.

# Applendium Chrome Web Store Reviewer Notes

## What This Submission Is

Applendium is a Chrome extension that uses read-only Gmail access to group job-application emails by stage and present them inside the extension popup.

The extension is free to install and use.

- The core tracking workflow (sync, group by stage, search, review threads) is entirely free.
- An optional Premium plan is purchased separately on the Applendium web app. The extension itself does not process payments and contains no checkout flow.
- The extension does not request `gmail.send`.

## Core Reviewer Flow

1. Install the extension package.
2. Pin Applendium or open it from the Chrome extensions menu.
3. Click `Sign in with Google` in the popup.
4. Sign in with the reviewer Gmail account provided in the Chrome Web Store review notes field.
5. Complete Google consent for read-only Gmail access.
6. Click `Refresh` if sync does not begin automatically.
7. Wait up to 2 minutes for the initial Gmail sync to populate the popup.
8. Confirm the popup shows grouped job-application conversations by stage.
9. Open a thread to review the application history view.
10. Use the footer link to confirm it opens the Applendium web app; any premium purchase happens there, not inside the extension.

## Reviewer Test Account

Provide these values directly in the Chrome Web Store dashboard review notes. Do not commit the password.

- Email: `[REVIEWER_GMAIL]`
- Password: `[REVIEWER_PASSWORD]`

The reviewer Gmail inbox should be seeded immediately before resubmission with the messages in `chrome-store/reviewer-seed-emails.json`.

Seed setup instructions:

1. Create a dedicated Gmail account that Chrome review can access without 2FA or recovery prompts.
2. If the Google OAuth consent screen is still in testing mode, add the reviewer Gmail as a test user.
3. Set `REVIEWER_GMAIL` locally.
4. Run `npm run review:seed-drafts`.
5. Open `chrome-store/reviewer-seed-mailto.html`.
6. Send each generated Gmail compose draft from a sender Gmail account that is not the reviewer account.
7. Confirm all eight messages are in the reviewer inbox.

## Reviewer Notes Text To Paste

```text
Applendium tracks job-application emails from Gmail using read-only Gmail access.

Reviewer test account:
Email: [REVIEWER_GMAIL]
Password: [REVIEWER_PASSWORD]

This Gmail inbox has been seeded with recent job-application emails dated within the last 30 days. The seeded messages include application confirmations, interview invitations, offer letters, and rejection updates.

Steps to reproduce:
1. Install/open Applendium.
2. Click "Sign in with Google".
3. Sign in with the reviewer Gmail account above.
4. Approve read-only Gmail access.
5. Re-open the popup.
6. Click "Refresh".
7. Wait up to 2 minutes for the initial sync.
8. The popup should show grouped job-application threads under Applied, Interviews, Offers, and Rejected.
9. Open any thread to see the application journey/details view.

Applendium does not request gmail.send and does not send email. It only reads Gmail messages to identify and group job-application related threads.
```

## Expected Behavior

- The popup is the primary product surface.
- The extension groups job-application conversations into `Applied`, `Interviews`, `Offers`, and `Rejected`.
- The popup supports search and manual refresh.
- The extension requests read-only Gmail access only.
- The popup does not offer reply-from-extension in this launch build.

## Public URLs

- Privacy policy: `https://applendium.com/privacy`
- Support: `https://applendium.com/support`
- Premium plan (optional, web): `https://applendium.com/upgrade`

## Notes For Review

- The extension requires the signed-in Gmail account to contain job-application emails. Use the seeded reviewer account above for deterministic review.
- The content script is limited to Applendium app routes on `applendium.com` and is not injected across arbitrary sites.
- Any premium language in the popup links out to the Applendium web app; the extension itself contains no checkout flow.

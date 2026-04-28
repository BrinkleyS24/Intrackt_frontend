# Reviewer Account Setup

Chrome rejected the listing because Gmail job-application tracking was not reproducible during review. Screenshots alone are not enough; the reviewer needs a live Gmail account containing recent job-application messages.

## Create The Reviewer Inbox

1. Create or choose a dedicated Gmail account for Chrome review.
2. Make sure the account is allowed to use Applendium's Google OAuth app. If the OAuth consent screen is still in testing mode, add this Gmail address as a test user in Google Cloud.
3. Make sure the Chrome reviewer can sign in without being blocked by 2FA, recovery, or suspicious-login challenges.
4. Generate the seed draft page:

```powershell
$env:REVIEWER_GMAIL = "your-reviewer-account@gmail.com"
node scripts/generate_chrome_review_seed_mailto.mjs
```

5. Open `chrome-store/reviewer-seed-mailto.html` in a browser while signed into a sender Gmail account that is not the reviewer account.
6. Click each Gmail compose link and send all eight messages to the reviewer account.
7. Sign into the reviewer Gmail account and confirm the seed messages are in the inbox.
8. Install the production extension package, sign in with the reviewer account, click Refresh, and confirm Applendium shows Applied, Interviews, Offers, and Rejected items.

## Important

- Do not send seed messages from the reviewer account to itself. The backend excludes messages from the signed-in Gmail user.
- Keep the seed messages recent. Send them the same day as resubmission, or at least within 30 days.
- Do not commit the reviewer account password. Put credentials only in the Chrome Web Store review notes field.

## Review Notes Template

Use this text in the Chrome Web Store review notes and replace the placeholders.

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
5. Re-open the extension popup if needed.
6. Click "Refresh".
7. Wait up to 2 minutes for the initial sync.
8. The popup should show grouped job-application threads under Applied, Interviews, Offers, and Rejected.
9. Open any thread to see the application journey/details view.

Applendium does not request gmail.send and does not send email. It only reads Gmail messages to identify and group job-application related threads.
```

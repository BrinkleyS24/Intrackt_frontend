# Applendium Chrome Web Store Listing Copy

## Listing Basics

- Name: `Applendium: Job Application Tracker for Gmail` (45/75 chars; keyword-bearing title, changed for v2.0.4 store search visibility)
- Current manifest description (CWS summary, 130/132 chars): `Automatic job application tracker for Gmail. Sorts applied, interview, offer, and rejected emails. No spreadsheets, no data entry.`
- Rule: descriptive keywords only, never keyword stuffing (CWS spam policy can reject or delist the listing). Title format is `Brand: what it does`, same pattern as every ranking competitor.
- Recommended category: `Productivity`
- Recommended language: `English`

## Detailed Description

(Hook-driven rewrite 2026-07-08. Honesty rails still apply: no fake match scores, no ATS claims, no testimonials/metrics. The unverified-app note stays.)

Your job search already lives in your inbox. Applendium reads the Gmail threads you already have and turns them into a live application tracker, automatically. Every application confirmation, interview invite, offer, and rejection gets sorted into a clean pipeline. No spreadsheet. No manual logging. No write access, ever.

How it works:
- Connect Gmail once (read-only). Applendium finds the job emails already in your inbox.
- It sorts them by stage: applied, interview, offer, rejected.
- New emails get added automatically as they arrive.
- Open any application to read its full conversation history in one place.
- Download a one-page activity report (PDF) of your applications and weekly counts, for a career coach, a workforce program, or an unemployment work-search requirement.

Built to be honest: most job tools slap a fake "92% match" on everything. Applendium won't. The optional Premium plan (on the Applendium web app) adds Apply Gate, an honest pre-apply verdict (apply, fix your resume first, or skip) based on a posting's real requirements and your own history, plus follow-up reminders that draft the email for you based on where each conversation left off. When there isn't enough data to say something, it says so.

Free forever: the automatic tracker and the activity report. Premium is optional, purchased separately on the web, and never required to use the extension. Works for any profession, not just tech.

Privacy: Gmail access is read-only and used only for the tracking features you see. Never sold, never used for ads. Revoke anytime.

Heads up: connecting Gmail triggers Google's "unverified app" notice. Applendium has passed every step of Google's verification except the final independent security audit, in progress with TAC Security. Read-only and revocable anytime.

Support: https://applendium.com/support

Privacy policy: https://applendium.com/privacy

Premium plan (optional, web): https://applendium.com/upgrade

## What's New (v2.0.3)

New: download a one-page PDF report of your job-search activity — every application, weekly counts, and current status — for a career coach, a workforce program, or an unemployment work-search record. Plus reliability fixes to email classification.

## Short Reviewer-Safe Summary

Read-only Gmail extension for tracking job-application threads by stage inside a Chrome popup.

## Copy Constraints

- Do not mention reply-from-extension.
- Do not present in-extension checkout or payments (Premium is purchased separately on the web).
- Do not claim cross-browser support.
- Do not claim automated actions that are not visible in the shipped popup.
- Do not include performance metrics or testimonials.

## Screenshot Order

Value-first order (regenerated 2026-07-08 with the `free-healthy` fixture: no scarcity bar, sign-in moved last, free-limit shot dropped):

1. `chrome-store/assets/screenshots/01-pipeline.png` — the organized pipeline (lead / money shot)
2. `chrome-store/assets/screenshots/02-interviews.png` — stage filter
3. `chrome-store/assets/screenshots/03-thread.png` — thread detail
4. `chrome-store/assets/screenshots/05-apply-gate.png` — real Apply Gate verdict (premium teaser; composed 2026-07-09 from a live prod verdict via PIL, not the harness generator)
5. `chrome-store/assets/screenshots/04-signin.png` — read-only Gmail sign-in (context, last)

Rule: never lead with the sign-in shot; never end on a quota/limit shot. Regenerate via `npm run assets:store`.

## Official References

- Listing requirements: https://developer.chrome.com/docs/webstore/program-policies/listing-requirements
- Listing best practices: https://developer.chrome.com/docs/webstore/best-listing
- Store listing fields: https://developer.chrome.com/docs/webstore/cws-dashboard-listing/

# Free reliability follow-up 2.2.3

October 16, 2026, America/New_York. This follows the committed/pushed 2.2.2 candidate (`206555f`), not a Chrome Web Store deployment. The original [acceptance rubric](FREE_A_ACCEPTANCE_2026-10-16.md) remains unchanged.

## Real integration findings

Manual Google consent succeeded in an ordinary Chrome-stable profile. The dedicated `applendiumreview@gmail.com` account is Premium; its plan was not changed. The backend grant successfully refreshed, read the actual mailbox, and returned Gmail read-only, identity, email and profile scopes with no mailbox write scope. These are shared authentication-path observations; they are not represented as a separate Free account's manual consent.

Real browser offline emulation produced `net::ERR_INTERNET_DISCONNECTED` for the background worker's backend requests. The popup displayed a sync-failure toast, retained every cached email ID and recovered after connectivity returned. An initial screenshot taken after five seconds missed the 3.2-second toast; an observer and immediate capture confirmed the visible failure. That initial screenshot was not evidence that the toast never appeared.

An actual user toolbar click on the live Upgrade posting granted access: the reader changed from no posting to the exact posting URL, Senior QA Automation Engineer (HELOC), employer Upgrade, and its source description. The production manifest and page reader are unchanged in 2.2.3; the new product delta is reconnect sequencing only.

Notification tests distinguish three levels of evidence. A simple replay of an already-stored offer produced no notification; queued cache hydration can restore that record before the completion comparison. A controlled predecessor snapshot excluding approved offer 22472 then drove the actual background code, actual server response and real Chrome notification API. Chrome created `applendium_offers_22472`, and the user confirmed seeing “Offer detected — Audit Pine Logistics - Warehouse Associate” in Windows. The test did not call `notifications.create` directly or insert/send mail. This establishes controlled delivery, not a genuinely new Gmail arrival's complete notification timing. That natural-arrival behavior remains outside this delivery control.

With explicit user approval, the dedicated test mailbox's real Gmail grant was revoked. The production service recorded `INVALID_GRANT`; the popup showed “not syncing” and a persistent Reconnect banner. Its account identity, Premium plan and all cached email IDs were retained. Reconsenting restored a usable read-only grant and completed catch-up, but exposed the defect below.

## Confirmed defect and smallest fix

In 2.2.2 the popup immediately queried `/sync-status` after OAuth success and rejected a still-set broken-auth flag before starting catch-up. That endpoint reads saved health; it does not validate the new grant. The backend clears the flag only after a sync's Gmail preflight succeeds (`emailRoutes.js` and `clearUserGmailAuthBroken`). Post-login background work started asynchronously, so the popup briefly told a successfully reconnected user to reconnect again. Exact response, notice history, records and capture are retained.

2.2.3 requests catch-up after successful OAuth, then confirms Gmail health. If a concurrent post-login sync coalesces the request, the popup makes a bounded number of health checks while that work runs. It still requires explicit healthy status before a success message. A genuinely rejected validation retains the warning and tracked data. Unconfirmed status gives truthful uncertainty and a Refresh recovery path instead of asking for unnecessary consent again. Cancellation still starts no catch-up.

This is shared correctness code. Premium's faulty reconnect ordering intentionally changes too; its features, prices, limits, permissions and normal layout are preserved. No backend runtime or web-app code was changed. The backend's earlier qualification work remains outside the release; the only pushed backend change is regression test `2208d70`.

## Acceptance and release state

- The three new reconnect regressions fail against unmodified 2.2.2; all **47** browser regressions pass after the fix, with no skipped or flaky tests.
- The production 2.2.3 build, bundle verifier and popup preflight pass with the expected extension ID and production backend. Both manifests change only their version.
- A fresh Premium comparison passes normal layout, complete report text and lazy-list behavior. The historical PNG differs from the new capture. Rerendering the untouched baseline in the same current environment produces a PNG byte-identical to the candidate. The precise historical rendering difference remains unadjudicated; it is not presented as a product change or hidden by replacing the old image.
- Additional real application-service/SQL fixtures cross both DST transitions. New York's calendar-30-day spans are 719 and 721 hours, UTC's are 720. In each case, cutoff-minus-one-millisecond is excluded and equality/plus-one are included. The earlier SQL history and live Gmail-at-500 checks remain retained separately.
- Independent cleanup passes **153** checks for all **nine** temporary identities across 16 user-owned database tables plus Firebase Auth.
- Existing external GitHub uptime monitoring and backend transaction CI pass on `2208d70`. The separate Cloud Monitoring script finds none of its expected resources in the current project; its old default project returns 403. Do not claim that preflight passed or that all monitoring is absent.

The fixed candidate's real revocation/reconnect retest passed on October 16 (00:14-00:17 UTC October 17). Google accepted the restored grant, catch-up completed, every cached email ID and the Premium plan remained, the warning disappeared, and the notice was "Gmail reconnected. Catching up on what we missed..." No false reconnect-again notice appeared. A separate provider read at 00:28 UTC confirmed the mailbox and read-only scopes. Real sign-out cleared identity and cached records; a newly opened popup remained signed out.

**Release-candidate judgment: A for the tested existing Free promises, within the frozen task scope. This is not a deployed-product grade or a complete accessibility certification.** Functional correctness and usability pass the specified controlled cases and the critical integration observations. Accessibility evidence covers the changed disclosure's naming, keyboard activation, focus, contrast and the report dialog at the supported 400-pixel popup width. Broad assistive-technology testing and narrower embedded layouts remain unverified. The unchanged popup has a fixed 400-pixel width; no responsive redesign is claimed.

| Rubric row | Result and evidence boundary |
| --- | --- |
| F1 | Pass in rich, at-cap, disconnected and review fixtures at 400 x 600. Existing Free tools remain reachable. Geometry and captures are retained in the original acceptance archive; current browser regressions pass. |
| F2 | Pass for complete source traversal, manual entries, source-to-preview/PDF reconciliation, deduplication, range/status cases and failure blocking. The retained 500-application ledger and downloaded PDF establish completeness for that controlled input. |
| F3 | Pass in cancellation, denial, failed status, rejected validation and catch-up failures; the real revoked-grant retest now passes the exact changed handler. OAuth alone never establishes recovery. |
| F4 | Pass for correction/retry/Undo and controlled idempotency. Real production Free ingestion updates an existing application at 500; a 501st manual application is rejected after both workers finish. Exact SQL, Gmail-query and DST boundary receipts are retained. |
| F5 | Targeted controls and report keyboard/focus/contrast checks pass. Overall accessibility remains partially verified; no WCAG or screen-reader certification. |
| F6 | Actual manual consent/cancellation, real revoke/reconnect, real toolbar click and visible OS notification delivery observed. Auth uses the dedicated Premium identity through shared code; production Free ingestion/cap tests use separate temporary Free identities. Notification delivery uses a controlled predecessor cache, not a new natural arrival. These distinctions are not counted as separate end-to-end observations. |
| P1 | Pass for tested normal Premium layout, report, lazy pagination and existing regression journeys. Prices, paid features, permissions, entitlements and limits are unchanged. Shared failure handling intentionally improves. |

A+ additionally needs independent task-based human review and post-release confirmation. No independent reviewer is available, and the owner's participation is not counted as independent review. Genuine new-arrival notification timing, very large Premium report performance and broad assistive-technology use remain unknown. Google still shows its unverified-app consent warning; successful consent is not verification/CASA approval. The original 2.2.2 receipts and evidence archive remain historical, not certificates for newly changed reconnect code. Chrome Web Store upload, review and publication are recorded separately; Git pushes are not deployment.

## Artifacts

The 2.2.3 ZIP is `applendium-extension-v2.2.3.zip`, SHA-256 `7beda56a7c08e31eb6c3e14bb4d7924efb6225a922c6d829029af70ff055ea36`. It is built from the isolated `dist_prod_fixed` directory. The installed test copy's folder still ends in `LOAD-APPLENDIUM-2.2.2`; its manifest and all 17 files were deliberately updated and verified against 2.2.3, then Chrome reloaded it. The original 2.2.2 build and ZIP are preserved.

Workspace evidence: `.codex_tmp/free-release-20261016/`, including `real-revoked-state.json`, `real-reconnected-state.json`, `reconnect-before.json`, `e2e-final-fixed.json`, `current-gmail-grant.json`, `toolbar-real-result.json`, notification diagnostics/control, DST fixtures and cleanup, production build verification and Premium comparisons. No credentials or browser profiles belong in the shareable archive.

Reproduce the local regression suite with `npm run test:e2e`. For production preparation use `npm run release:prod`, then follow `CHROME_RELEASE_SMOKE_CHECKLIST.md` in Chrome stable. Packaging and Git pushes do not publish the extension. Chrome Web Store submission and actual publication are separate states.

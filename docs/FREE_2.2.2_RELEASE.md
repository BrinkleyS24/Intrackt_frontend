# Free reliability release 2.2.2

Prepared October 16, 2026 from extension commit `2550f4987e0711c998f81a23ab548cdbb6bd5e23`. The user subsequently authorized committing, pushing and deploying this work. That authorization supersedes the original implementation-only scope in the unchanged [frozen acceptance protocol](FREE_A_ACCEPTANCE_2026-10-16.md).

## Changes

- Free's existing job check and search insight sit in a keyboard-accessible disclosure, leaving applications visible on popup open.
- Free loads all pages of its manual application ledger. Reports on either plan require a complete manual source, block incomplete downloads, and offer retry after failure. Traversal commits atomically, rejects repeated cursors, deduplicates IDs and guards against account changes.
- Reconnect requires successful authorization, explicit usable Gmail status and a successful catch-up request before announcing success.
- Failed corrections retain the review item or selected correction and provide retry. Undo is visible within the popup, lasts ten seconds and retains its retry opportunity after a failed undo.
- The report dialog has an accessible name, initial focus, keyboard containment, Escape dismissal, focus return and vertical scrolling.

No new paid features, pricing, limits or permissions are introduced. Both manifests change only their version from 2.2.1 to 2.2.2. Premium retains its existing layout and lazy normal manual list. Shared report, reconnect, correction and Undo failure handling intentionally improves Premium too; claiming that every failure behavior is unchanged would be inaccurate. Earlier uncommitted backend qualification changes remain outside this release.

## Validation

Fresh 2.2.2 builds pass 44 browser regressions with zero skipped/flaky tests, 86 pure extension checks, production bundle verification, and production popup preflight. Preflight confirms extension ID `aaalkagnioipinkfogjlgkdoacebaoji`, the production backend, a logged-out popup and no observed popup CSP/runtime errors. A separate backend test commit verifies linking an interview to an existing application at 500/500; its three targeted suites pass 64 tests. No backend runtime deployment is needed for these extension fixes.

The preceding controlled acceptance run passed 27 focused scenarios, including a 500-application tracker/preview/PDF reconciliation, later-page failure, correction/Undo failure, and reconnect counterexamples. Premium's ordinary popup PNG was byte-identical and its report text identical before and after those changes. Source has since changed only to bump the package/manifest version. This is bounded regression evidence, not proof about every possible Premium workflow.

Real production checks on temporary dedicated audit identities establish inclusive SQL selection immediately before/at/after 90- and 180-day cutoffs, and real application-service SQL counting immediately before/at/after rolling-30-day cutoffs under UTC and New York time. These execute actual predicates at explicitly recorded instants; they do not freeze the deployed HTTP endpoint's clock. Actual Gmail search around one existing approved test message was recorded separately; its second-resolution inclusion behavior must not be presented as millisecond precision or a complete import-boundary proof.

Actual production Gmail ingestion links the existing Cedar QA application to Applied, Interviewed and Rejected messages at 500 tracked applications. After both the foreground sync and its automatically launched history backfill finish, the count remains 500 and an attempted 501st entry returns HTTP 403, code `quota`. Earlier attempts stopped waiting after the foreground sync and observed a legitimate `sync_busy` result; those attempts do not establish a quota-response failure. An independent follow-up checks Firebase and every schema-discovered user-owned table for all eight temporary identities used across the four attempts; its result is in the verification receipt.

## Release and grade gates

The candidate remains **B+ provisional** under the frozen rubric. It has not earned an unqualified A. Real Chrome-stable consent/reconnect/revocation, toolbar-granted posting access, desktop notification delivery and degraded-network recovery remain unsigned off. The automated Chrome-stable attempt opened actual Google authorization and cancellation returned to signed out without false success. The user reported being unable to sign in; the exact rejection message was not preserved. Ordinary Chrome is prepared for a manual retry. No automation security restrictions have been bypassed.

Store publication is pending those required release smoke checks and authenticated store-owner access. A built ZIP or a Git push is not a Chrome Web Store deployment. A+ additionally requires independent task-based human review and post-release confirmation; no independent reviewer is available. No AI reviewer is counted as a human participant.

## Evidence and reproduction

The unchanged protocol SHA-256 is `37b278d738d5c95e4e9709432f59414edcf12d3cad12debb3f9ddf18a60c69b6`. Original audit inputs, before/after browser traces, complete PDFs and source snapshots are retained in the workspace evidence archive `docs/FREE_A_IMPROVEMENTS_2026-10-16_EVIDENCE.zip` (SHA-256 `eb72a9b7d26a6f8082fc616d60c7d9ee29b8ffcd9a48b873c36f62393489cdec`). That archive predates the version bump and new live checks. Its driver verifies the historical run, not a subsequent release.

New release evidence is under workspace `.codex_tmp/free-release-20261016/`: `e2e.json`, `unit-tests.log`, `backend-tests.json`, `build-verification.log`, `production-preauth.log`, real-consent cancellation captures, and live boundary/cap results. Authentication profiles and secrets are excluded from shareable evidence. The accompanying verification receipt records artifact hashes and the final state of the new live checks.

Rebuild and run from this repository:

```powershell
npm run test:e2e
node --test shared/*.test.mjs popup/src/utils/*.test.mjs
npm run release:prod
npm run smoke:prod:preauth
npm run smoke:prod:chrome
```

Use the explicit test-file list when a shell does not expand globs. The real Chrome-stable pass must follow `CHROME_RELEASE_SMOKE_CHECKLIST.md`, including refresh failure/recovery and logout/reopen. `release:prod` packages and verifies; it does not upload or publish. Live-account fixture scripts need the existing authorized test credentials, refuse mutations outside their temporary identities, send no mail and make no purchases.

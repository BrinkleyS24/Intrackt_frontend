# Applendium Extension Roadmap

## Release Focus
- Ship the Chrome extension production bundle from `manifest.prod.json`.
- Keep premium web work deferred until after the extension deploys.
- Launch the extension as a free-core product with premium clearly marked closed or coming soon.
- Use the extension lab and Playwright suite as the release confidence layer for auth, free, premium-state messaging, quota, and sync states.

## Reply Feature Status
Reply is deferred for the Chrome Store launch:
- The extension no longer requests the `gmail.send` OAuth scope.
- The live popup does not expose reply-from-extension UI.
- Backend reply plumbing can stay dormant until the post-launch premium/web pass.

## Reply Enhancements (Future)
- Prefill the reply editor with quoted original message content.
- Add optional CC / BCC fields with validation.
- Support `Ctrl+Enter` / `Cmd+Enter` to send from the reply form.
- Persist reply drafts per thread in `chrome.storage.local`.

## Extension Follow-Ups (After Deploy)
- Improve release automation and store submission assets.
- Expand fixture coverage for more recovery and correction flows.
- Revisit premium dashboard, billing UX, and reply-from-extension after the extension release is stable.

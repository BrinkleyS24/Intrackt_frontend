# Intrackt Extension Roadmap

## Reply Feature Enhancements (Planned)
These items are deferred for a future update:
- Prefill reply editor with quoted original message (formatted > lines / HTML blockquote) below cursor.
- CC / BCC expansion panel (collapsed by default) with validation and chip-style multi-address UI.
- Keyboard shortcut: Ctrl+Enter (Windows/Linux) / Cmd+Enter (macOS) to send while form focused.
- Auto-save draft per `threadId` into `chrome.storage.local` (e.g., key: `draft_reply_<threadId>`); restore when reopening thread; clear on successful send.

## Implementation Notes (for future work)
- Draft Persistence: use debounced save (500ms) to reduce write frequency; cleanup on logout.
- Quoted Original: for HTML use sanitized trimmed newest message body; for plain text prefix each line with `>`.
- Shortcut: attach keydown listener on form root; guard against sending while `sending || loadingEmails`.
- CC/BCC: only include fields in payload if non-empty to keep backend simple.

## Backend Work Needed for Real Sending
Currently `/api/emails/send-reply` is a stub returning success. Real sending will require:
1. Restoring `gmail.send` scope (and possibly `gmail.modify`) to the OAuth flow & manifest permissions.
2. Storing and refreshing OAuth tokens server-side (or using user-authorized tokens in extension background page) — move away from only Firebase auth for this endpoint.
3. Constructing RFC 2822 MIME message (Base64url encoded) and calling Gmail API `users.messages.send` with `threadId` to keep thread continuity.
4. Optionally appending `In-Reply-To` and `References` headers for threading accuracy.
5. Error handling & quota / rate limit surfaces back to UI.

## Tracking
Move completed items into CHANGELOG and update this file incrementally.


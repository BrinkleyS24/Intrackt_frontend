import React from 'react';

// Phase 1 "Needs Review" lane. Low-confidence emails the classifier flagged for the
// user to confirm instead of silently dropping. One tap classifies them; the choice
// promotes the email out of review and becomes a training label (active learning).

const RELEVANT_CHOICES = [
  { key: 'Applied', label: 'Applied' },
  { key: 'Interviewed', label: 'Interviewed' },
  { key: 'Offers', label: 'Offer' },
  { key: 'Rejected', label: 'Rejected' },
];

function safeText(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

export default function ReviewLane({ emails = [], onClassify, busyIds }) {
  const pending = busyIds instanceof Set ? busyIds : new Set(busyIds || []);

  if (!emails.length) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">You're all caught up</p>
        <p className="mt-1 text-xs text-muted-foreground">Nothing needs your review right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-3 py-3">
      <div className="px-1">
        <h2 className="text-sm font-semibold text-foreground">Needs review</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The classifier wasn't sure about these. Confirm where each belongs — your choice teaches it.
        </p>
      </div>

      {emails.map((email) => {
        const tentative = safeText(email.category, 'unsure');
        const isBusy = pending.has(String(email.id));
        return (
          <div
            key={email.id}
            data-testid="review-lane-item"
            className={`rounded-xl border border-border bg-background/70 p-3 transition ${isBusy ? 'opacity-50' : ''}`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{safeText(email.from, 'Unknown sender')}</span>
              <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                guess: {tentative}
              </span>
            </div>
            <p className="mb-2 line-clamp-2 text-sm font-medium text-foreground">{safeText(email.subject, '(no subject)')}</p>
            <div className="flex flex-wrap gap-1.5">
              {RELEVANT_CHOICES.map((choice) => (
                <button
                  key={choice.key}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onClassify(email, choice.key)}
                  className="rounded-md border border-border bg-white/[0.03] px-2 py-1 text-xs text-foreground transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {choice.label}
                </button>
              ))}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onClassify(email, 'Irrelevant')}
                className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Not relevant
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

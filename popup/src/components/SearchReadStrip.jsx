import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

// Dismissal is remembered per read kind: hiding "rejected too fast" does not hide a different
// read that appears later, and the same read comes back after a week.
const DISMISS_KEY = 'applendiumSearchReadDismissed';
const REDISPLAY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The free user's one read, at the top of the list. It lived in the list footer first, and
 * measured 2026-09-25 it started ~1,100px below a 236px viewport for anyone with a full page of
 * applications — the users who get a read are exactly the ones who never scrolled that far.
 * Collapsed it costs about one row: headline + the way forward. The evidence is one tap away.
 */
export default function SearchReadStrip({ read, onOpenPremiumPage }) {
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setExpanded(false);
    (async () => {
      try {
        const stored = (await chrome.storage?.local?.get([DISMISS_KEY]))?.[DISMISS_KEY];
        const stillDismissed = stored?.kind === read?.kind && Date.now() - (stored?.at || 0) < REDISPLAY_MS;
        if (!cancelled) setDismissed(Boolean(stillDismissed));
      } catch (_) {
        if (!cancelled) setDismissed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [read?.kind]);

  if (!read || dismissed) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await chrome.storage.local.set({ [DISMISS_KEY]: { kind: read.kind, at: Date.now() } });
    } catch (_) {}
  };

  return (
    <div data-testid="search-read" className="mb-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          <Sparkles className="h-3 w-3" />
          From your inbox · {read.timeframe.replace(/^In the /, '')}
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground transition hover:text-foreground"
          type="button"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="popup-line-clamp-2 mt-1 text-[12px] font-semibold leading-4 text-foreground">{read.title}</div>

      {expanded && (
        <div data-testid="search-read-detail" className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
          {read.description}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((open) => !open)}
          data-testid="search-read-why"
          className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          type="button"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'How we know'}
        </button>
        <button
          onClick={() => onOpenPremiumPage('ext_search_read')}
          data-testid="search-read-cta"
          className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90"
          type="button"
        >
          See what to do about it →
        </button>
      </div>
    </div>
  );
}

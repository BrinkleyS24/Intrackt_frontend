import React, { useEffect, useState } from 'react';
import { Lock, Sparkles, X } from 'lucide-react';

const DISMISS_KEY = 'applendiumPremiumTeaserDismissedAt';
const REDISPLAY_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_TRACKED = 3;

export default function PremiumTeaserCard({ userPlan, stats, onOpenPremiumPage }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (userPlan === 'premium') return;

    const check = async () => {
      try {
        const storage = await chrome.storage?.local?.get([DISMISS_KEY]) || {};
        const dismissedAt = storage[DISMISS_KEY];
        if (!dismissedAt || Date.now() - dismissedAt > REDISPLAY_MS) {
          setVisible(true);
        }
      } catch (_) {
        setVisible(true);
      }
    };

    check();
  }, [userPlan]);

  const handleDismiss = async () => {
    setVisible(false);
    try {
      await chrome.storage.local.set({ [DISMISS_KEY]: Date.now() });
    } catch (_) {}
  };

  if (!visible || userPlan === 'premium') return null;

  const applied = stats?.applied || 0;
  const interviewed = stats?.interviewed || 0;
  const total = applied + interviewed + (stats?.offers || 0) + (stats?.rejected || 0);

  if (total < MIN_TRACKED) return null;

  // A grounded, personalized hook framed as a question the user can't yet
  // answer — the readable headline opens the loop, the blurred rows below
  // keep the specific finding behind the paywall (curiosity gap).
  const heroInsight = (() => {
    if ((stats?.rejected || 0) >= 2) {
      return `Why ${stats.rejected} applications didn't move forward`;
    }
    if (interviewed >= 1) {
      return 'Your strongest response pattern so far';
    }
    if (applied >= 1) {
      return applied === 1
        ? 'What this application needs next'
        : `What your ${applied} applications need next`;
    }
    return `The pattern across your ${total} tracked applications`;
  })();

  const features = [
    {
      label: 'Apply Gate',
      detail: 'Vet your next role before you apply — apply, tailor first, or skip',
    },
    {
      label: 'Strategy Alerts',
      detail: `Spot what's working across your ${total} tracked application${total === 1 ? '' : 's'}`,
    },
    {
      label: 'Weekly Brief',
      detail: interviewed > 0
        ? `${interviewed} active thread${interviewed === 1 ? '' : 's'} to review this week`
        : 'Your weekly search health summary',
    },
  ];

  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/5 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          Premium insights ready
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

      <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-border bg-card/80 px-3 py-2.5">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold leading-4 text-foreground">{heroInsight}</div>
          <div className="mt-1.5 h-2.5 w-5/6 rounded bg-muted-foreground/20" />
          <div className="mt-1.5 h-2 w-2/3 rounded bg-muted-foreground/15" />
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        {features.map(({ label, detail }) => (
          <div key={label} className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted">
              <Lock className="h-2.5 w-2.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 text-[11px] leading-4">
              <span className="font-semibold text-foreground">{label}</span>
              <span className="ml-1 text-muted-foreground">{detail}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onOpenPremiumPage}
        className="mt-3 w-full rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90"
        type="button"
      >
        Unlock Premium →
      </button>
    </div>
  );
}

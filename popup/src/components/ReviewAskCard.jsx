/**
 * @file popup/src/components/ReviewAskCard.jsx
 * @description One-time review ask. Appears once a user has 7+ days of tenure
 * and 10+ tracked applications, never during sync/error states. Either answer
 * (leave a review or dismiss) retires it permanently. Chrome policy compliant:
 * no incentive, no gating, no repeat asks.
 */

import React, { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import {
  evaluateReviewAsk,
  reviewUrlForExtension,
  REVIEW_ASK_STORAGE_KEY,
} from '../utils/reviewAsk.mjs';

async function readState() {
  try {
    const stored = await chrome.storage?.local?.get([REVIEW_ASK_STORAGE_KEY]);
    return stored?.[REVIEW_ASK_STORAGE_KEY] || null;
  } catch (_) {
    return null;
  }
}

async function writeState(patch) {
  try {
    const current = await readState();
    await chrome.storage?.local?.set({
      [REVIEW_ASK_STORAGE_KEY]: { ...(current || {}), ...patch },
    });
  } catch (_) {
    /* storage unavailable (lab harness) — the card simply won't persist */
  }
}

export default function ReviewAskCard({ trackedCount, isBusy }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await readState();
      const result = evaluateReviewAsk({
        state,
        trackedCount: Number(trackedCount),
        isBusy: Boolean(isBusy),
        now: Date.now(),
      });
      if (result.initialize) {
        await writeState({ eligibleSince: Date.now() });
        return;
      }
      if (!cancelled) setVisible(result.show);
    })();
    return () => {
      cancelled = true;
    };
  }, [trackedCount, isBusy]);

  if (!visible) return null;

  const answer = async (kind) => {
    setVisible(false);
    await writeState({ answeredAt: Date.now(), answer: kind });
  };

  const handleReview = async () => {
    try {
      const url = reviewUrlForExtension(chrome.runtime?.id || '');
      await chrome.tabs?.create?.({ url });
    } catch (_) {
      /* tab creation unavailable — still retire the ask below */
    }
    await answer('review');
  };

  return (
    <div
      data-testid="review-ask-card"
      className="mx-3 mb-2 rounded-xl border border-border bg-white/[0.03] px-3.5 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">Is Applendium earning its keep?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            If it&rsquo;s caught something your inbox would have buried, a short review helps other job seekers find it.
          </p>
        </div>
        <button
          onClick={() => answer('dismissed')}
          data-testid="review-ask-dismiss-x"
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={handleReview}
          data-testid="review-ask-accept"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90"
          type="button"
        >
          <Star className="h-3 w-3" />
          Leave a review
        </button>
        <button
          onClick={() => answer('dismissed')}
          data-testid="review-ask-dismiss"
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          type="button"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}

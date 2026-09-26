import React from 'react';
import { Loader2, ScanSearch } from 'lucide-react';
import { describeNextFreeCheck, describeRecordedAction } from '../../../shared/applyGateCheck.js';

const TONE_CHIP = {
  positive: 'bg-success/10 text-success',
  brand: 'bg-accent/10 text-accent',
  attention: 'bg-warning/10 text-warning',
  risk: 'bg-destructive/10 text-destructive',
};

function Eyebrow({ children }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
      <ScanSearch className="h-3 w-3 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function roleLine(posting) {
  return [posting?.title, posting?.company].filter(Boolean).join(' · ');
}

const PRIMARY_BUTTON = 'shrink-0 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90';

/**
 * Apply Gate on the posting in the current tab. Same slot and size as the free SearchReadStrip: one
 * row until the user asks for the check, then the call, the reasons and the decision buttons the web
 * page would show — so deciding happens where the job is. Premium checks any posting; a free user
 * gets one check per rolling week, and the strip says so plainly before and after it is used.
 */
export default function ApplyGateStrip({ check, onOpenWebPath, onOpenPremiumPage }) {
  const { phase, posting, summary, error, recorded, recording, premium, allowance } = check;
  if (phase === 'hidden') return null;

  const shell = 'mb-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2.5';
  const nextFree = describeNextFreeCheck(allowance?.nextAvailableAt);
  const seePremium = (
    <button type="button" onClick={() => onOpenPremiumPage?.('ext_apply_gate')} data-testid="apply-gate-see-premium" className={PRIMARY_BUTTON}>
      See Premium →
    </button>
  );

  if (phase === 'ready') {
    return (
      <div data-testid="apply-gate-strip" className={shell}>
        <Eyebrow>{premium ? 'Apply Gate · this page' : 'Apply Gate · your free check this week'}</Eyebrow>
        <div className="popup-line-clamp-2 mt-1 text-[12px] font-semibold leading-4 text-foreground">{roleLine(posting)}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] leading-4 text-muted-foreground">
            {premium
              ? 'Check it against your résumé before you spend the time.'
              : 'One free check a week, against your résumé. Premium checks every job.'}
          </span>
          <button type="button" onClick={check.check} data-testid="apply-gate-check" className={PRIMARY_BUTTON}>
            {premium ? 'Check this job' : 'Use my free check'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'used') {
    return (
      <div data-testid="apply-gate-strip" className={shell}>
        <Eyebrow>Apply Gate · this page</Eyebrow>
        <div className="popup-line-clamp-2 mt-1 text-[12px] font-semibold leading-4 text-foreground">{roleLine(posting)}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span data-testid="apply-gate-used" className="text-[11px] leading-4 text-muted-foreground">
            You've used this week's free check. The next one opens {nextFree}. Premium checks every job you look at.
          </span>
          {seePremium}
        </div>
      </div>
    );
  }

  if (phase === 'checking') {
    return (
      <div data-testid="apply-gate-strip" className={shell} aria-busy="true">
        <Eyebrow>Apply Gate · this page</Eyebrow>
        <div className="mt-1.5 flex items-center gap-2 text-[12px] font-semibold text-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          Checking {posting?.title || 'this role'} against your résumé…
        </div>
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
          Usually under half a minute. You can close this; the call will be here when you reopen it.
        </div>
      </div>
    );
  }

  if (phase === 'error' || summary?.kind === 'unavailable') {
    return (
      <div data-testid="apply-gate-strip" className={shell}>
        <Eyebrow>Apply Gate · this page</Eyebrow>
        <div className="mt-1 text-[12px] font-semibold leading-4 text-foreground">This page could not be checked here.</div>
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
          {error ? `${error} ` : ''}{premium ? 'Paste the description into Apply Gate on the web instead.' : 'Your free check was not used.'}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={check.check} className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
            Try again
          </button>
          {premium ? (
            <button
              type="button"
              onClick={() => onOpenWebPath('/apply-gate')}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-muted"
            >
              Open Apply Gate →
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (summary?.kind === 'needs_resume') {
    return (
      <div data-testid="apply-gate-strip" className={shell}>
        <Eyebrow>Apply Gate · this page</Eyebrow>
        <div className="mt-1 text-[12px] font-semibold leading-4 text-foreground">Add your résumé to check this role</div>
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{summary.message}</div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenWebPath(premium ? '/resumes' : '/settings#resume')}
            data-testid="apply-gate-add-resume"
            className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90"
          >
            Add your résumé →
          </button>
        </div>
      </div>
    );
  }

  if (summary?.kind !== 'verdict') return null;

  return (
    <div data-testid="apply-gate-strip" className={shell}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Apply Gate · {roleLine(posting) || 'this page'}</Eyebrow>
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        <span
          data-testid="apply-gate-decision"
          className={`mt-px shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CHIP[summary.decision.tone] || TONE_CHIP.brand}`}
        >
          {summary.decision.label}
        </span>
        <div className="min-w-0 text-[12px] font-semibold leading-4 text-foreground">{summary.headline}</div>
      </div>
      {summary.subtext ? (
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{summary.subtext}</div>
      ) : null}
      {summary.reasons.length ? (
        <ul className="mt-1.5 space-y-0.5 text-[11px] leading-4 text-foreground/85">
          {summary.reasons.map((reason) => (
            <li key={reason} className="popup-line-clamp-2 pl-2.5 -indent-2.5">• {reason}</li>
          ))}
        </ul>
      ) : null}

      {recorded ? (
        <div data-testid="apply-gate-recorded" className="mt-2 text-[11px] font-medium leading-4 text-accent">
          {describeRecordedAction(recorded)}
        </div>
      ) : summary.id ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {summary.actions.map((option) => (
            <button
              key={option.action}
              type="button"
              disabled={recording}
              onClick={() => check.record(option.action)}
              data-testid={`apply-gate-action-${option.action}`}
              className={option.primary
                ? 'rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-60'
                : 'rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted disabled:opacity-60'}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <div className="mt-1.5 text-[11px] text-destructive">{error}</div> : null}

      {premium ? (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-accent/15 pt-1.5">
          <span className="text-[11px] text-muted-foreground">
            {summary.usedDefaultResume ? 'Checked against your default résumé' : 'Checked against your saved résumé'}
          </span>
          <button
            type="button"
            onClick={() => onOpenWebPath('/apply-gate')}
            data-testid="apply-gate-full-read"
            className="text-[11px] font-semibold text-accent transition hover:text-accent/80"
          >
            Full read →
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-accent/15 pt-1.5">
          <span data-testid="apply-gate-free-used-note" className="text-[11px] leading-4 text-muted-foreground">
            That was this week's free check. The next one opens {nextFree}.
          </span>
          {seePremium}
        </div>
      )}
    </div>
  );
}

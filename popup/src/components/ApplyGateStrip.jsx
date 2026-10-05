import React from 'react';
import { Loader2, ScanSearch } from 'lucide-react';
import { describeNextFreeCheck, describeRecordedAction, describeCheckedResume, DECISION_QUESTION } from '../../../shared/applyGateCheck.js';

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

const NUDGE_DISMISS_KEY = 'applendium.resumeNudgeDismissedAt';
const NUDGE_QUIET_MS = 14 * 24 * 60 * 60 * 1000;

function readNudgeDismissed() {
  try {
    const at = Number(window.localStorage.getItem(NUDGE_DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < NUDGE_QUIET_MS;
  } catch (_) {
    return false;
  }
}

/** One line for users with no resume, shown when the popup is not on a job page. */
function ResumeNudge({ selection, onOpenWebPath }) {
  const [dismissed, setDismissed] = React.useState(readNudgeDismissed);
  if (dismissed) return null;
  const needsChoice = Boolean(selection?.selectionRequired);
  const dismiss = () => {
    try { window.localStorage.setItem(NUDGE_DISMISS_KEY, String(Date.now())); } catch (_) { /* hide for this visit only */ }
    setDismissed(true);
  };
  return (
    <div data-testid="apply-gate-resume-nudge" className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2">
      <span className="min-w-0 text-[11px] leading-4 text-foreground">
        {needsChoice ? 'Choose a default resume so Apply Gate can check jobs.' : 'Add your resume so Apply Gate can check jobs.'}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={dismiss} data-testid="apply-gate-resume-nudge-dismiss" className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
          Not now
        </button>
        <button type="button" onClick={() => onOpenWebPath('/resumes')} data-testid="apply-gate-resume-nudge-add" className="text-[11px] font-semibold text-accent transition hover:text-accent/80">
          {needsChoice ? 'Choose →' : 'Add →'}
        </button>
      </span>
    </div>
  );
}

const PRIMARY_BUTTON ='shrink-0 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90';

/**
 * Apply Gate on the posting in the current tab. Same slot and size as the free SearchReadStrip: one
 * row until the user asks for the check, then the call, the reasons and the decision buttons the web
 * page would show — so deciding happens where the job is. Premium checks any posting; a free user
 * gets one check per rolling week, and the strip says so plainly before and after it is used.
 */
export default function ApplyGateStrip({ check, onOpenWebPath, onOpenPremiumPage, onTrackApplication }) {
  const { phase, posting, summary, error, recorded, recording, premium, allowance, selection, stale } = check;
  if (phase === 'hidden') return null;
  if (phase === 'nudge') return <ResumeNudge selection={selection} onOpenWebPath={onOpenWebPath} />;

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
        <p className="mt-1 text-[11px] text-muted-foreground">Resume: {selection?.resumeDocument?.name || 'Your selected default'}</p>
        {error ? <p role="status" className="text-[11px] text-muted-foreground">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] leading-4 text-muted-foreground">
            {premium
              ? 'Check it against your resume before you spend the time.'
              : 'One free check a week, against your resume. Premium checks every job.'}
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
          Checking {posting?.title || 'this role'} against your resume…
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

  if (summary?.kind === 'needs_resume' || summary?.kind === 'needs_resume_selection') {
    const needsSelection = summary.kind === 'needs_resume_selection';
    return (
      <div data-testid="apply-gate-strip" className={shell}>
        <Eyebrow>Apply Gate · this page</Eyebrow>
        <div className="mt-1 text-[12px] font-semibold leading-4 text-foreground">{needsSelection ? 'Choose a resume to check this role' : 'Add your resume to check this role'}</div>
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{summary.message}</div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={check.check} className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
            Try again
          </button>
          <button
            type="button"
            onClick={() => onOpenWebPath('/resumes')}
            data-testid="apply-gate-add-resume"
            className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90"
          >
            {needsSelection ? 'Choose a resume →' : 'Add your resume →'}
          </button>
        </div>
      </div>
    );
  }

  if (summary?.kind !== 'verdict') return null;

  return (
    <div data-testid="apply-gate-strip" className={shell}>
      {stale ? <div role="status" className="mb-2 text-[11px] text-muted-foreground">
        Previous check. Your default resume has changed or is unavailable.
        {selection?.resumeDocument?.name ? ` Current default: ${selection.resumeDocument.name}.` : ' Choose a default in Resumes.'}
        <button type="button" onClick={check.check} className="ml-2 underline">Review and re-check</button>
      </div> : null}
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
            <li key={reason} className="pl-2.5 -indent-2.5">• {reason}</li>
          ))}
        </ul>
      ) : null}

      {summary.warning ? (
        <div data-testid="apply-gate-warning" className="mt-2 rounded-lg border border-warning/25 bg-warning/5 px-2 py-1.5 text-[11px] leading-4 text-foreground">
          <span className="font-semibold">{summary.warning.label}: </span>{summary.warning.text}
        </div>
      ) : null}

      {recorded ? (
        <div className="mt-2">
          <div data-testid="apply-gate-recorded" className="text-[11px] font-medium leading-4 text-accent">
            {describeRecordedAction(recorded)}
          </div>
          {/* Applying is the moment to track it: no confirmation email may ever arrive, and the
              posting already names the company, role and link. Opens the normal Add form, so
              the user still reviews and saves it, and duplicates are caught there. */}
          {recorded === 'applied' && onTrackApplication ? (
            <button
              type="button"
              data-testid="apply-gate-track-application"
              onClick={() => onTrackApplication({
                company: summary.companyName || posting?.company || '',
                position: summary.jobTitle || posting?.title || '',
                jobUrl: posting?.url || '',
              })}
              className="mt-1 text-[11px] font-semibold text-foreground underline underline-offset-2 transition hover:opacity-80"
            >
              Track this application →
            </button>
          ) : null}
        </div>
      ) : summary.id ? (
        <div className="mt-2">
        <p data-testid="apply-gate-question" className="mb-1.5 text-[11px] leading-4 text-muted-foreground">{DECISION_QUESTION}</p>
        <div className="flex flex-wrap items-center gap-1.5">
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
        </div>
      ) : null}
      {error ? <div className="mt-1.5 text-[11px] text-destructive">{error}</div> : null}

      {premium ? (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-accent/15 pt-1.5">
          <span className="text-[11px] text-muted-foreground">
            {describeCheckedResume(summary)}
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
          <span className="text-[11px] leading-4 text-muted-foreground">
            <span data-testid="apply-gate-checked-resume" className="block">{describeCheckedResume(summary)}</span>
            <span data-testid="apply-gate-free-used-note">That was this week's free check. The next one opens {nextFree}.</span>
          </span>
          {seePremium}
        </div>
      )}
    </div>
  );
}

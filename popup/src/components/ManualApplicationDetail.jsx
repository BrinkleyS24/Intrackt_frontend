import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Trash2, TrendingUp, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { sendMessageToBackground } from '../utils/chromeMessaging';
import { classifyManualCloseKind, deriveManualPipelineState } from '../../../shared/applicationDisplayState.js';
import { manualAppliedLabel, manualStageLabel } from './ManualApplicationCard';
import { showNotification } from './Notification';

const BUTTON = {
  outline: 'border border-white/10 bg-white/[0.03] text-foreground hover:border-white/20 hover:bg-white/[0.06]',
  danger: 'border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15',
};
const buttonClass = (variant) => cn(
  'inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  BUTTON[variant],
);

// Same reasons, wording and stored labels as the email thread's close panel (EmailPreview), so the
// backend classifies a manual close exactly like an email one (utils/applicationCloseOutcome.js).
const CLOSE_REASONS = [
  { value: 'Rejected verbally', label: 'Rejected verbally' },
  { value: 'No response', label: 'No response' },
  { value: 'Withdrew', label: 'Withdrew' },
  { value: 'Accepted elsewhere', label: 'Accepted elsewhere' },
  { value: 'Position filled', label: 'Position filled' },
  { value: 'Other', label: 'Other' },
];

function closeExplainer(reason) {
  const kind = classifyManualCloseKind(reason);
  if (kind === 'rejection') return 'Counts as a rejection and moves this application to your Closed tab. Nothing is deleted, and you can reopen it anytime.';
  if (kind === 'silence') return 'Moves this application to your Closed tab as no response. It does not count as a rejection in your stats. You can reopen it anytime.';
  return 'Your decision, not a rejection. It moves to "Closed by you" and does not count as a rejection. You can reopen it anytime.';
}

/**
 * One manually added application, opened from its card. Manual entries could not be opened, moved or
 * closed from the popup (persona reports 2026-10-15). Close and reopen use the same application
 * endpoints as email threads (POST /api/emails/applications/:id/close and /reopen), which work by
 * application id without an email. Moving one to Interview or Offer by hand has no endpoint yet, so
 * the screen says how that happens instead of offering a control that cannot save.
 */
export default function ManualApplicationDetail({ application, onChanged, onRemove, onBack }) {
  const [showClose, setShowClose] = useState(false);
  const [reason, setReason] = useState('Rejected verbally');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  if (!application) return null;
  const { pipelineStatus, closedByChoice } = deriveManualPipelineState(application);
  const isTerminal = ['offered', 'rejected'].includes(String(application.current_status || '').toLowerCase());
  const userClosed = Boolean(application.user_closed_at) && !isTerminal;
  const canClose = !application.user_closed_at && !application.is_closed && !isTerminal;
  let safeUrl = null;
  try {
    const parsed = new URL(application.job_url);
    if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) safeUrl = parsed.href;
  } catch (_) { /* no posting link */ }

  const run = async (message, success) => {
    setBusy(true);
    setError('');
    try {
      const response = await sendMessageToBackground(message);
      if (!response?.success) throw new Error(response?.error || 'That did not save. Try again.');
      showNotification(success, 'success');
      setShowClose(false);
      await onChanged?.();
    } catch (failure) {
      if (mounted.current) setError(failure?.message || 'That did not save. Try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const confirmClose = () => {
    const kind = classifyManualCloseKind(reason);
    run(
      { type: 'CLOSE_APPLICATION', applicationId: application.id, reason: [reason, note.trim()].filter(Boolean).join(' - ') },
      kind === 'user_choice' ? 'Closed. Find it under "Closed by you".' : 'Moved to your Closed tab.',
    );
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await onRemove(application.id);
      showNotification('Application removed.', 'success');
      onBack?.();
    } catch (failure) {
      if (mounted.current) setError(failure?.message || 'Removal could not be confirmed. Refresh before trying again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div data-testid="manual-application-detail" className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-semibold leading-snug text-foreground">{application.normalized_company_name}</h2>
          {application.position ? <p className="truncate text-[13px] text-muted-foreground">{application.position}</p> : null}
        </div>
        <span data-testid="manual-detail-stage" className={cn('status-badge mt-1 shrink-0', pipelineStatus === 'rejected' || closedByChoice ? 'status-closed' : `status-${pipelineStatus}`)}>
          {manualStageLabel(pipelineStatus, closedByChoice)}
        </span>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-[12px] leading-5 text-muted-foreground">
        <p>Added by you · Applied {manualAppliedLabel(application)}</p>
        <p className="mt-1">
          {application.linkedEmailCount
            ? 'Emails are linked to this application. Open it from those emails to see its history.'
            : 'No email from this employer yet. Applendium links the first reply to this application on its own.'}
        </p>
        {safeUrl ? (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-8 items-center gap-1 font-medium text-accent-text">
            <ExternalLink className="h-3.5 w-3.5" /> View posting
          </a>
        ) : null}
      </div>

      <section aria-labelledby="manual-stage-heading" className="space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
        <h3 id="manual-stage-heading" className="text-sm font-semibold text-foreground">Change its stage</h3>
        {pipelineStatus === 'applied' || pipelineStatus === 'interviewed' ? (
          <p className="text-[12px] leading-5 text-muted-foreground">
            It moves to Interview or Offer on its own when that email arrives. Heard back another way? Close it below with the reason.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canClose ? (
            <button type="button" className={buttonClass('outline')} onClick={() => setShowClose((open) => !open)} disabled={busy} data-testid="manual-close-open">
              <X className="h-3.5 w-3.5" /> Close application
            </button>
          ) : null}
          {userClosed ? (
            <button
              type="button"
              className={buttonClass('outline')}
              disabled={busy}
              data-testid="manual-reopen"
              onClick={() => run({ type: 'REOPEN_APPLICATION', applicationId: application.id }, 'Application reopened.')}
            >
              <TrendingUp className="h-3.5 w-3.5" /> {busy ? 'Reopening...' : 'Reopen'}
            </button>
          ) : null}
          {!application.linkedEmailCount && onRemove ? (
            <button type="button" className={buttonClass('outline')} disabled={busy} onClick={() => setConfirmRemove(true)} data-testid="manual-remove-open">
              <Trash2 className="h-3.5 w-3.5" /> Remove entry
            </button>
          ) : null}
        </div>

        {showClose ? (
          <div className="space-y-2 pt-1" data-testid="manual-close-panel">
            <label className="block text-[12px] text-muted-foreground" htmlFor="manual-close-reason">What happened?</label>
            <select
              id="manual-close-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            >
              {CLOSE_REASONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add context (optional)"
              aria-label="Add context (optional)"
              maxLength={300}
              disabled={busy}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            />
            <p className="text-[12px] leading-5 text-muted-foreground">{closeExplainer(reason)}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonClass('outline')} onClick={() => setShowClose(false)} disabled={busy}>Cancel</button>
              <button type="button" className={buttonClass('danger')} onClick={confirmClose} disabled={busy} data-testid="manual-close-confirm">
                {busy ? 'Closing...' : 'Confirm close'}
              </button>
            </div>
          </div>
        ) : null}

        {confirmRemove ? (
          <div className="space-y-2 pt-1 text-[12px] text-foreground">
            <p>Remove this application you added? Use this for an entry made by mistake. To record an outcome, close it instead.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonClass('outline')} onClick={() => setConfirmRemove(false)} disabled={busy}>Keep it</button>
              <button type="button" className={buttonClass('danger')} onClick={remove} disabled={busy} data-testid="manual-remove-confirm">
                {busy ? 'Removing...' : 'Confirm removal'}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p role="alert" className="text-[12px] text-destructive">{error}</p> : null}
      </section>
    </div>
  );
}

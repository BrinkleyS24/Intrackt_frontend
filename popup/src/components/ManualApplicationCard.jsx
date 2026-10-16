import React from 'react';
import { cn } from '../utils/cn';
import { formatDate, getStageBadgeLabel, parseCalendarDay } from '../utils/uiHelpers';

const BADGE = {
  applied: 'status-badge status-applied',
  interviewed: 'status-badge status-interviewed',
  offers: 'status-badge status-offers',
  rejected: 'status-badge status-closed',
};

/** "today", "3 days ago" or "Sep 27": the applied day the user picked, in the email cards' format. */
export function manualAppliedLabel(application) {
  // The applied day is a calendar day the user picked, so it is not shifted by the UTC rule email
  // timestamps follow.
  const formatted = application?.manual_applied_at
    ? formatDate(parseCalendarDay(application.manual_applied_at))
    : formatDate(application?.first_email_date);
  return formatted === 'Today' || formatted === 'Yesterday' ? formatted.toLowerCase() : formatted;
}

/** The chip text for a manual application in this pipeline position. */
export function manualStageLabel(pipelineStatus, closedByChoice) {
  if (closedByChoice) return 'Closed by you';
  return getStageBadgeLabel(pipelineStatus === 'rejected' ? 'closed' : pipelineStatus);
}

/**
 * A manually added application in the list, with the same anatomy as an email card (title, role,
 * date, stage chip) so the list reads as one kind of thing. It used to be a taller block of its own
 * with inline "View posting" / "Remove entry" links and no way to open it (persona reports
 * 2026-10-15); opening it now leads to the detail view where it can be closed, reopened or removed.
 */
export default function ManualApplicationCard({ application, pipelineStatus = 'applied', closedByChoice = false, onOpen }) {
  const isClosed = pipelineStatus === 'rejected' || closedByChoice;
  const badgeKey = isClosed ? 'rejected' : pipelineStatus;
  return (
    <button
      type="button"
      data-testid="manual-application-card"
      onClick={() => onOpen?.(application)}
      className={cn(
        'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
        isClosed
          ? 'border border-dashed border-muted-foreground/25 bg-muted/30 opacity-70'
          : 'border border-white/[0.07] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="popup-line-clamp-1 text-sm font-medium text-foreground/90">{application.normalized_company_name}</div>
          {application.position ? <div className="popup-line-clamp-1 mt-0.5 text-[12px] text-muted-foreground">{application.position}</div> : null}
        </div>
        <span data-testid="manual-application-date" className="shrink-0 text-[12px] text-muted-foreground">Applied {manualAppliedLabel(application)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 overflow-hidden">
        <span className={BADGE[badgeKey] || BADGE.applied}>{manualStageLabel(pipelineStatus, closedByChoice)}</span>
        <span className="truncate text-[12px] text-muted-foreground">Added by you</span>
      </div>
    </button>
  );
}

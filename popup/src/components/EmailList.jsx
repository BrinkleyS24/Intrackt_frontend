/**
 * @file popup/src/components/EmailList.jsx
 * @description Thread list for the popup's main and category views.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDate, getCategoryTitle } from '../utils/uiHelpers';
import { countUniqueThreads, getApplicationKey, groupEmailsByThread } from '../utils/grouping';
import Pagination from './Pagination';
import { CONFIG } from '../utils/constants';
import {
  deriveEmailPresentationState,
  normalizeApplicationPresentationStatusKey,
  normalizeApplicationStatusKey,
} from '../../../shared/applicationDisplayState.js';
import {
  collapseJourneyStages,
  deriveConversationCurrentStatus,
  deriveConversationPresentationState,
} from '../utils/applicationPresentation';
import { safeTextValue } from '../utils/sensitiveContent';

const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  try {
    doc.querySelectorAll('style,script,noscript').forEach((el) => el.remove());
  } catch (_) {}
  const text = doc.body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
};

const STATUS_STYLES = {
  applied: {
    badgeClassName: 'status-badge status-applied',
    pillClassName: 'bg-secondary text-foreground border border-border',
  },
  interviewed: {
    badgeClassName: 'status-badge status-interviewed',
    pillClassName: 'bg-warning/15 text-warning border border-warning/20',
  },
  offers: {
    badgeClassName: 'status-badge status-offers',
    pillClassName: 'bg-success/10 text-success border border-success/20',
  },
  rejected: {
    badgeClassName: 'status-badge status-closed',
    pillClassName: 'bg-muted text-muted-foreground border border-border',
  },
  processing: {
    badgeClassName: 'status-badge bg-muted text-muted-foreground border border-border',
    pillClassName: 'bg-muted text-muted-foreground border border-border',
  },
  closed: {
    badgeClassName: 'status-badge status-closed',
    pillClassName: 'bg-muted text-muted-foreground border border-border',
  },
  irrelevant: {
    badgeClassName: 'status-badge bg-muted text-muted-foreground',
    pillClassName: 'bg-muted text-muted-foreground border border-border',
  },
};

const LIFECYCLE_STAGES = [
  {
    key: 'applied',
    label: 'Applied',
    dotClassName: 'border-muted-foreground/60 bg-muted-foreground/60',
    textClassName: 'text-muted-foreground',
    lineClassName: 'bg-muted-foreground/25',
  },
  {
    key: 'interviewed',
    label: 'Interview',
    dotClassName: 'border-warning bg-warning',
    textClassName: 'text-warning',
    lineClassName: 'bg-warning',
  },
  {
    key: 'offers',
    label: 'Offer',
    dotClassName: 'border-success bg-success',
    textClassName: 'text-success',
    lineClassName: 'bg-success',
  },
];

const TERMINAL_STAGE_META = {
  rejected: {
    label: 'Rejected',
    dotClassName: 'border-destructive bg-destructive',
    textClassName: 'text-destructive',
    lineClassName: 'bg-destructive',
  },
  closed: {
    label: 'Closed',
    dotClassName: 'border-muted-foreground/60 bg-muted-foreground/60',
    textClassName: 'text-muted-foreground',
    lineClassName: 'bg-muted-foreground/25',
  },
};

const isPreviewCandidateEmail = (email) => {
  const resolutionState = (email?.resolution_state || '').toString().toLowerCase();
  const syncSource = (email?.sync_source || '').toString().toLowerCase();
  return (
    resolutionState === 'provisional' ||
    resolutionState === 'processing' ||
    syncSource === 'interactive_preview' ||
    email?.classification_meta?.provisional === true
  );
};

function buildObservedLifecycle(group) {
  const emails = group?.emails || [];
  const rawStages = emails.map((email) => ({
    emailId: email?.id,
    subject: safeTextValue(email?.subject, ''),
    category: normalizeApplicationStatusKey(email?.category),
    current_status: email?.applicationStatus,
    date: email?.date,
  }));

  const collapsed = collapseJourneyStages(rawStages);
  const observed = new Set(
    collapsed
      .map((stage) => normalizeApplicationStatusKey(stage?.category || stage?.current_status))
      .filter(Boolean)
  );

  // Manual rejections carry no 'rejected' email category, but the backend resolves
  // them to a rejected display state. Surface that as a terminal rejection so the
  // stepper shows the red "Rejected" bubble (and not the neutral "Closed").
  const hasManualRejection = emails.some((email) => (
    Boolean(email?.isUserRejected) ||
    normalizeApplicationStatusKey(email?.displayCategory) === 'rejected'
  ));
  if (hasManualRejection) observed.add('rejected');

  return observed;
}

function LifecycleStepper({ group, currentStatus }) {
  const observedStages = useMemo(() => buildObservedLifecycle(group), [group]);
  const presentationStatus = normalizeApplicationPresentationStatusKey(currentStatus);
  // The presentation key collapses `rejected` into `closed`. Re-derive the genuine
  // rejection from observed (non-collapsed) stages so non-rejection closes
  // (withdrew / no-response / accepted-elsewhere) keep the neutral "Closed" label.
  const hasGenuineRejection = observedStages.has('rejected');
  const terminalStatus = presentationStatus === 'closed' ? (hasGenuineRejection ? 'rejected' : 'closed') : null;
  const terminalMeta = terminalStatus ? TERMINAL_STAGE_META[terminalStatus] : null;
  const lastReachedBaseIndex = useMemo(() => {
    let lastIndex = -1;
    LIFECYCLE_STAGES.forEach((stage, index) => {
      if (observedStages.has(stage.key)) {
        lastIndex = index;
      }
    });
    return lastIndex;
  }, [observedStages]);

  return (
    <div className="mt-2 flex items-center gap-1 overflow-hidden">
      {LIFECYCLE_STAGES.map((stage, index) => {
        const isObserved = observedStages.has(stage.key);
        const isCurrent = currentStatus === stage.key;
        const nextStage = LIFECYCLE_STAGES[index + 1];
        const connectorActive = isObserved && nextStage && observedStages.has(nextStage.key);

        return (
          <React.Fragment key={stage.key}>
            {index > 0 && (
              <span className={cn('h-px w-3.5 shrink-0 rounded-full', connectorActive ? stage.lineClassName : 'bg-muted-foreground/20')} />
            )}
            <span
              title={stage.label}
              className={cn(
                'h-2 w-2 shrink-0 rounded-full border-2 transition-colors',
                isObserved ? stage.dotClassName : 'border-muted-foreground/30 bg-transparent',
                isCurrent && 'ring-2 ring-background'
              )}
            />
          </React.Fragment>
        );
      })}

      {terminalMeta && (
        <>
          <span
            className={cn(
              'h-px w-3.5 shrink-0 rounded-full',
              lastReachedBaseIndex >= 0 ? terminalMeta.lineClassName : 'bg-muted-foreground/20'
            )}
          />
          <span title={terminalMeta.label} className={cn('h-2 w-2 shrink-0 rounded-full border-2 ring-2 ring-background', terminalMeta.dotClassName)} />
        </>
      )}
    </div>
  );
}

function EmailList({
  emails,
  category,
  selectedEmail,
  onEmailSelect,
  preGroupedThreads,
  totalEmails,
  totalMessages,
  onMarkAllAsRead,
  isMarkingAllAsRead,
  compact = false,
  footerSlot = null,
  newSinceTimestamp = null,
}) {
  const normalizedCategoryKey = (category || '').toString().toLowerCase();
  const supportsActiveFilter = !compact && (normalizedCategoryKey === 'applied' || normalizedCategoryKey === 'interviewed');
  // Pipeline model: Applied/Interviews default to live leads only; roles the user
  // closed by choice (withdrew / accepted elsewhere) live under the Closed filter.
  const [activeFilter, setActiveFilter] = useState(supportsActiveFilter ? 'active' : 'all');
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = CONFIG.PAGINATION.PAGE_SIZE;

  useEffect(() => {
    // Reset to the category's default view whenever the category changes.
    setActiveFilter(supportsActiveFilter ? 'active' : 'all');
    setShowMarkAllConfirm(false);
    setCurrentPage(1);
  }, [category, supportsActiveFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [emails, activeFilter]);

  const threadGroups = useMemo(() => {
    if (Array.isArray(preGroupedThreads)) {
      return preGroupedThreads;
    }
    return groupEmailsByThread(emails);
  }, [emails, preGroupedThreads]);

  const filteredThreadGroups = useMemo(() => {
    if (activeFilter === 'all') return threadGroups;

    return threadGroups.filter((group) => {
      // Pipeline groups carry an explicit closed-by-choice flag (withdrew /
      // accepted elsewhere). Anything else in an active bucket is a live lead —
      // rejections and silence close-outs were already routed to Rejected.
      if (typeof group.closedByChoice === 'boolean') {
        return activeFilter === 'active' ? !group.closedByChoice : group.closedByChoice;
      }

      const email = group.latestEmail || {};
      const normalizedCategory = normalizeApplicationStatusKey(category);
      const presentation = category === 'all'
        ? deriveConversationPresentationState(group)
        : deriveEmailPresentationState(email, {
            fallbackCategory: normalizedCategory,
          });
      const { isEffectivelyClosed } = presentation;
      const isActive = !isEffectivelyClosed && (normalizedCategory === 'applied' || normalizedCategory === 'interviewed');
      if (activeFilter === 'active') return isActive;
      if (activeFilter === 'inactive') return !isActive;
      return true;
    });
  }, [activeFilter, category, threadGroups]);

  const filteredTotalMessages = useMemo(
    () => filteredThreadGroups.reduce((sum, group) => sum + (group.emails?.length || 0), 0),
    [filteredThreadGroups]
  );

  const totalPages = Math.max(1, Math.ceil(filteredThreadGroups.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedThreadGroups = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredThreadGroups.slice(start, start + pageSize);
  }, [filteredThreadGroups, pageSize, safeCurrentPage]);

  const displayCount = activeFilter === 'all'
    ? (totalEmails !== undefined ? totalEmails : countUniqueThreads(emails))
    : filteredThreadGroups.length;

  const displayTotalMessages = activeFilter === 'all'
    ? (typeof totalMessages === 'number' ? totalMessages : emails.length)
    : filteredTotalMessages;

  const visibleUnreadEmailIds = useMemo(() => {
    const ids = new Set();
    filteredThreadGroups.forEach((group) => {
      (group.emails || []).forEach((email) => {
        if (!email?.is_read && email?.id != null) {
          ids.add(email.id);
        }
      });
    });
    return Array.from(ids);
  }, [filteredThreadGroups]);

  const hasUnreadEmails = visibleUnreadEmailIds.length > 0;
  const canShowMarkAllButton = !compact && !!onMarkAllAsRead && displayCount > 0;

  const confirmMarkAllAsRead = () => {
    setShowMarkAllConfirm(false);
    onMarkAllAsRead(category, visibleUnreadEmailIds);
  };

  const groupTimestamp = (group) => {
    const raw = group?.date || group?.latestEmail?.date;
    if (!raw) return 0;
    const ts = new Date(raw).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  };

  const isNewSinceLastVisit = (group) =>
    Boolean(newSinceTimestamp) && groupTimestamp(group) > newSinceTimestamp;

  const renderHeader = () => {
    if (compact) return null;

    return (
      <div className="space-y-3 border-b border-border bg-card px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{getCategoryTitle(category)}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {displayCount} conversation{displayCount === 1 ? '' : 's'} | {displayTotalMessages} message{displayTotalMessages === 1 ? '' : 's'}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {displayCount}
          </span>
        </div>

        {(category === 'applied' || category === 'interviewed') && (
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Closed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                  activeFilter === tab.id
                    ? 'border-transparent bg-accent text-accent-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                )}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {canShowMarkAllButton && (
          <div className="space-y-2">
            <button
              onClick={() => setShowMarkAllConfirm(true)}
              disabled={isMarkingAllAsRead || !hasUnreadEmails}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <CheckCheck className="h-4 w-4" />
              <span>{isMarkingAllAsRead ? 'Marking...' : 'Mark all as read'}</span>
            </button>

            {showMarkAllConfirm && (
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="text-xs text-foreground">
                  Mark all visible threads in <span className="font-semibold">{getCategoryTitle(category)}</span> as read?
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={confirmMarkAllAsRead}
                    disabled={isMarkingAllAsRead}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-60"
                    type="button"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowMarkAllConfirm(false)}
                    disabled={isMarkingAllAsRead}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className={cn('px-4 py-10 text-center text-sm text-muted-foreground', compact && 'py-16')}>
      {activeFilter === 'all'
        ? 'No emails found in this category.'
        : activeFilter === 'active'
          ? 'No active applications in this category.'
          : 'No closed applications in this category.'}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {renderHeader()}

      {filteredThreadGroups.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="flex-1 overflow-y-auto popup-scrollbar px-3 py-3">
          <div key={`${category}-${activeFilter}`} className="space-y-2">
            {paginatedThreadGroups.map((group, index) => {
              const email = (group.latestEmail || group.earliestEmail) || {};
              const conversationPresentation = compact
                ? deriveConversationPresentationState(group)
                : null;
              const rawStatusKey = normalizeApplicationStatusKey(
                category === 'all'
                  ? (conversationPresentation?.displayStatusKey || email.category)
                  : category
              ) || 'applied';
              const presentationState = category === 'all' && conversationPresentation
                ? conversationPresentation
                : deriveEmailPresentationState(email, {
                    fallbackCategory: rawStatusKey,
                  });
              const {
                displayStatusKey,
                shouldDisplayClosed,
                isEffectivelyClosed,
              } = presentationState;
              const isPreviewCandidate = isPreviewCandidateEmail(email);
              const presentationStatusKey = normalizeApplicationPresentationStatusKey(displayStatusKey);
              const effectiveDisplayStatusKey = isPreviewCandidate ? 'processing' : presentationStatusKey;
              const isVisuallyClosed = !isPreviewCandidate && Boolean(
                shouldDisplayClosed ||
                presentationStatusKey === 'closed' ||
                (displayStatusKey === 'closed' && isEffectivelyClosed)
              );
              const statusStyle = STATUS_STYLES[effectiveDisplayStatusKey] || STATUS_STYLES.applied;
              const rawPreview = safeTextValue(group.preview || email.preview || email.html_body || email.body || '', '');
              const cleanPreview = stripHtml(rawPreview);
              const truncatedPreview = cleanPreview.length > 180 ? `${cleanPreview.slice(0, 180)}...` : cleanPreview;
              const selectedApplicationKey = selectedEmail ? getApplicationKey(selectedEmail) : null;
              const isSelected = selectedEmail && (
                selectedEmail.thread_id === group.threadId ||
                selectedEmail.threadId === group.threadId ||
                selectedApplicationKey === group.threadId
              );
              const isUnread = group.unreadCount > 0;
              const displayDate = group.date || email.date;
              const displaySubject = safeTextValue(email.subject || group.subject, '(No subject)');
              const rawSender = safeTextValue(email.sender || email.from || group.from, '');
              // Show just the display name; drop the "<addr@domain>" tail for a cleaner row (matches the hero).
              const displaySender = rawSender.replace(/\s*<[^>]*>\s*/g, '').replace(/^"|"$/g, '').trim() || rawSender;

              const rawPosition = (email.position || '').trim();
              const safePosition = (
                rawPosition &&
                rawPosition.length <= 80 &&
                /^[A-Z0-9(]/.test(rawPosition) &&
                !/[.!?]\s+\S/.test(rawPosition)
              ) ? rawPosition : null;

              // Boundary between "arrived since your last visit" and everything
              // older — only meaningful in the compact home inbox, where groups
              // are sorted newest-first.
              const showNewBoundary =
                compact &&
                index > 0 &&
                isNewSinceLastVisit(paginatedThreadGroups[index - 1]) &&
                !isNewSinceLastVisit(group);

              return (
                <React.Fragment key={group.threadId}>
                {showNewBoundary && (
                  <div
                    data-testid="new-since-divider"
                    className="flex items-center gap-2 px-1 pt-1"
                    aria-label="Conversations above this line arrived since your last visit"
                  >
                    <span className="h-px flex-1 bg-accent/30" />
                    <span className="shrink-0 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-accent/80">
                      new above · since last visit
                    </span>
                    <span className="h-px flex-1 bg-accent/30" />
                  </div>
                )}
                <button
                  onClick={() => onEmailSelect(email, group)}
                  data-testid="email-thread-card"
                  data-thread-id={group.threadId}
                  style={compact ? { animationDelay: `${Math.min(index, 12) * 35}ms` } : undefined}
                  className={cn(
                    'w-full text-left transition-colors',
                    compact && 'popup-row-in',
                    isVisuallyClosed
                      ? compact
                        ? 'rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2.5 opacity-60'
                        : 'rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 shadow-sm opacity-60'
                      : compact
                        ? 'rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 hover:border-white/20 hover:bg-white/[0.04]'
                        : 'rounded-2xl border border-border bg-card p-4 shadow-sm hover:bg-muted/40',
                    isSelected && (compact ? 'border-accent/50 ring-1 ring-accent/25' : 'ring-2 ring-accent/25')
                  )}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'popup-line-clamp-1 text-sm',
                          isVisuallyClosed
                            ? 'font-medium text-muted-foreground line-through'
                            : isUnread
                              ? 'font-semibold text-foreground'
                              : 'font-medium text-foreground/90'
                        )}
                      >
                        {displaySubject}
                      </div>
                      <div className="popup-line-clamp-1 mt-1 text-[11px] text-muted-foreground">
                        {displaySender}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isUnread && <span className="h-2 w-2 rounded-full bg-accent" />}
                      <span className="text-[10px] text-muted-foreground">{formatDate(displayDate)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2 overflow-hidden">
                    <span className={statusStyle.badgeClassName}>
                      {isPreviewCandidate ? 'Scanning' : getCategoryTitle(effectiveDisplayStatusKey)}
                    </span>
                    {email.company_name && (
                      <span className="max-w-[96px] truncate text-[10px] text-muted-foreground">{email.company_name}</span>
                    )}
                    {email.company_name && safePosition && (
                      <span className="text-[10px] text-muted-foreground">|</span>
                    )}
                    {safePosition && (
                      <span className="truncate text-[10px] text-muted-foreground">{safePosition}</span>
                    )}
                    {!compact && (
                      <>
                        <span className="text-[10px] text-muted-foreground">|</span>
                        <span className="text-[10px] text-muted-foreground">{group.messageCount} messages</span>
                      </>
                    )}
                  </div>

                  {compact && !isPreviewCandidate && (
                    <LifecycleStepper group={group} currentStatus={effectiveDisplayStatusKey} />
                  )}

                  {isUnread && !compact && (
                    <div className="mt-2">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', statusStyle.pillClassName)}>
                        {group.unreadCount} unread
                      </span>
                    </div>
                  )}

                  {!compact && (
                    <p className="popup-line-clamp-2 mt-2 text-[11px] text-muted-foreground">
                      {truncatedPreview || 'No preview available.'}
                    </p>
                  )}
                </button>
                </React.Fragment>
              );
            })}
          </div>
          {footerSlot}
        </div>
      )}

      {filteredThreadGroups.length > pageSize && (
        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
          totalEmails={filteredThreadGroups.length}
          pageSize={pageSize}
          compact={compact}
          itemLabel={{
            singular: 'conversation',
            plural: 'conversations',
            zero: 'No conversations',
          }}
        />
      )}
    </div>
  );
}

export default EmailList;

/**
 * @file popup/src/components/EmailList.jsx
 * @description Thread list for the popup's main and category views.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDate, getCategoryTitle } from '../utils/uiHelpers';
import { countUniqueThreads, groupEmailsByThread } from '../utils/grouping';
import Pagination from './Pagination';
import { CONFIG } from '../utils/constants';
import { deriveEmailPresentationState, normalizeApplicationStatusKey } from '../../../shared/applicationDisplayState.js';

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
    pillClassName: 'bg-success/10 text-success border border-success/20',
  },
  interviewed: {
    badgeClassName: 'status-badge status-interviewed',
    pillClassName: 'bg-warning/15 text-warning-foreground border border-warning/20',
  },
  offers: {
    badgeClassName: 'status-badge status-offers',
    pillClassName: 'bg-success/10 text-success border border-success/20',
  },
  rejected: {
    badgeClassName: 'status-badge status-rejected',
    pillClassName: 'bg-destructive/10 text-destructive border border-destructive/20',
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

function EmailList({
  emails,
  category,
  selectedEmail,
  onEmailSelect,
  totalEmails,
  totalMessages,
  onMarkAllAsRead,
  isMarkingAllAsRead,
  compact = false,
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = CONFIG.PAGINATION.PAGE_SIZE;

  useEffect(() => {
    const normalizedCategory = (category || '').toString().toLowerCase();
    const supportsActiveFilter = !compact && (normalizedCategory === 'applied' || normalizedCategory === 'interviewed');
    if (!supportsActiveFilter && activeFilter !== 'all') {
      setActiveFilter('all');
    }
    setShowMarkAllConfirm(false);
    setCurrentPage(1);
  }, [activeFilter, category, compact]);

  useEffect(() => {
    setCurrentPage(1);
  }, [emails, activeFilter]);

  const threadGroups = useMemo(() => groupEmailsByThread(emails), [emails]);

  const filteredThreadGroups = useMemo(() => {
    if (activeFilter === 'all') return threadGroups;

    return threadGroups.filter((group) => {
      const email = group.latestEmail || {};
      const normalizedCategory = normalizeApplicationStatusKey(category);
      const { isEffectivelyClosed } = deriveEmailPresentationState(email, {
        fallbackCategory: normalizedCategory,
      });
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
        <div className={cn('flex-1 overflow-y-auto popup-scrollbar', compact ? 'bg-card' : 'px-3 py-3')}>
          <div className={cn(compact ? 'divide-y divide-border' : 'space-y-2')}>
            {paginatedThreadGroups.map((group) => {
              const email = group.latestEmail || {};
              const rawStatusKey = normalizeApplicationStatusKey(category === 'all' ? email.category : category) || 'applied';
              const { displayStatusKey } = deriveEmailPresentationState(email, {
                fallbackCategory: rawStatusKey,
              });
              const isManuallyClosed = displayStatusKey === 'closed';
              const statusStyle = STATUS_STYLES[displayStatusKey] || STATUS_STYLES.applied;
              const rawPreview = group.preview || email.preview || email.body || '';
              const cleanPreview = stripHtml(rawPreview);
              const truncatedPreview = cleanPreview.length > 180 ? `${cleanPreview.slice(0, 180)}...` : cleanPreview;
              const isSelected = selectedEmail && (selectedEmail.thread_id === group.threadId || selectedEmail.threadId === group.threadId);
              const isUnread = group.unreadCount > 0;

              const rawPosition = (email.position || '').trim();
              const safePosition = (
                rawPosition &&
                rawPosition.length <= 80 &&
                /^[A-Z0-9(]/.test(rawPosition) &&
                !/[.!?]\s+\S/.test(rawPosition)
              ) ? rawPosition : null;

              return (
                <button
                  key={group.threadId}
                  onClick={() => onEmailSelect(email, group)}
                  className={cn(
                    'w-full text-left transition-colors',
                    isManuallyClosed
                      ? compact
                        ? 'rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-3 opacity-60'
                        : 'rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 shadow-sm opacity-60'
                      : compact
                        ? 'px-3 py-3 hover:bg-muted/60'
                        : 'rounded-2xl border border-border bg-card p-4 shadow-sm hover:bg-muted/40',
                    isSelected && (compact ? 'bg-muted/70' : 'ring-2 ring-accent/25')
                  )}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'popup-line-clamp-1 text-sm',
                          isManuallyClosed
                            ? 'font-medium text-muted-foreground line-through'
                            : isUnread
                              ? 'font-semibold text-foreground'
                              : 'font-medium text-foreground/90'
                        )}
                      >
                        {group.subject}
                      </div>
                      <div className="popup-line-clamp-1 mt-1 text-[11px] text-muted-foreground">
                        {email.sender || email.from}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isUnread && <span className="h-2 w-2 rounded-full bg-accent" />}
                      <span className="text-[10px] text-muted-foreground">{formatDate(group.date)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2 overflow-hidden">
                    <span className={statusStyle.badgeClassName}>{getCategoryTitle(displayStatusKey)}</span>
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

                  {isUnread && !compact && (
                    <div className="mt-2">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', statusStyle.pillClassName)}>
                        {group.unreadCount} unread
                      </span>
                    </div>
                  )}

                  <p className={cn('popup-line-clamp-1 mt-2 text-[11px] text-muted-foreground', !compact && 'popup-line-clamp-2')}>
                    {truncatedPreview || 'No preview available.'}
                  </p>
                </button>
              );
            })}
          </div>
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

/**
 * @file popup/src/components/EmailList.jsx
 * @description React component for displaying a list of emails within a category.
 * Mirrors the provided UI design.
 */

import React, { useMemo } from 'react';
import { CheckCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDate, getCategoryTitle } from '../utils/uiHelpers';
import { groupEmailsByThread, countUniqueThreads } from '../utils/grouping';

/**
 * Strips HTML tags from a string to return plain text.
 * This is a robust method using the browser's DOM parser.
 * @param {string | undefined | null} html The input string containing HTML.
 * @returns {string} The plain text content.
 */
const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.body.textContent || "";
  // Collapse multiple whitespace characters (including newlines) into a single space for a clean preview
  return text.replace(/\s+/g, ' ').trim();
};


function EmailList({ 
  emails, 
  category, 
  selectedEmail, 
  onEmailSelect, 
  totalEmails,
  onMarkAllAsRead,
  isMarkingAllAsRead,
  // Optional prop: parent can signal if the entire category has unread threads
  hasUnreadCategory
}) {
  const categoryTitle = getCategoryTitle(category);
  // Category color mapping for badges and accents
  const CATEGORY_STYLES = {
    applied: {
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      borderLeft: "border-l-4 border-l-blue-500",
      dot: "bg-blue-500",
      pill: "bg-blue-100 text-blue-700"
    },
    interviewed: {
      badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      borderLeft: "border-l-4 border-l-yellow-400",
      dot: "bg-yellow-400",
      pill: "bg-yellow-100 text-yellow-800"
    },
    offers: {
      badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      borderLeft: "border-l-4 border-l-green-500",
      dot: "bg-green-500",
      pill: "bg-green-100 text-green-800"
    },
    rejected: {
      badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      borderLeft: "border-l-4 border-l-red-500",
      dot: "bg-red-500",
      pill: "bg-red-100 text-red-800"
    }
  };
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.applied;
  const threadGroups = useMemo(() => groupEmailsByThread(emails), [emails]);
  const displayCount = totalEmails !== undefined ? totalEmails : countUniqueThreads(emails);
  // If parent supplies `hasUnreadCategory` use it (covers unread threads outside pagination),
  // otherwise fall back to inspecting the currently-paginated thread groups.
  const hasUnreadEmails = typeof hasUnreadCategory === 'boolean' ? hasUnreadCategory : threadGroups.some(group => group.unreadCount > 0);

  // Show the Mark All button whenever the category/page has at least one thread (so users can discover it),
  // but disable it when there are no unread threads or when a marking operation is in progress.
  const canShowMarkAllButton = (typeof displayCount === 'number' ? displayCount > 0 : threadGroups.length > 0) && !!onMarkAllAsRead;

  const handleMarkAllAsRead = () => {
    if (!onMarkAllAsRead) return;
    // Ask for explicit confirmation to avoid accidental bulk actions
    try {
      const confirmed = window.confirm(`Mark all emails in '${categoryTitle}' as read? This will mark every message in this category as read.`);
      if (!confirmed) return;
    } catch (e) {
      // Window.confirm might be unavailable in some extension contexts; fallback to immediate action
    }
    if (hasUnreadEmails) {
      onMarkAllAsRead(category);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 min-w-0"> {/* Added min-w-0 */}
      {/* Header - redesigned */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {categoryTitle}
          </h2>
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
            style.badge
          )}>
            {displayCount} {displayCount === 1 ? 'conversation' : 'conversations'}
          </span>
        </div>
        {canShowMarkAllButton && (
          <div>
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAllAsRead || !hasUnreadEmails}
              aria-disabled={isMarkingAllAsRead || !hasUnreadEmails}
              title={!hasUnreadEmails ? 'No unread threads in this category' : ''}
              className={cn(
                "w-full inline-flex items-center justify-center space-x-2 px-4 py-2 text-sm rounded-lg",
                "border border-gray-200 dark:border-zinc-700",
                "text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800",
                "hover:shadow-sm transition-shadow duration-150",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <CheckCheck className="h-4 w-4" />
              <span>{isMarkingAllAsRead ? 'Marking...' : 'Mark all as read'}</span>
            </button>
          </div>
        )}
      </div>
      {threadGroups.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-zinc-400 py-8">
          No emails found in this category.
        </div>
      ) : (
        <div className="p-2 space-y-2">
          {threadGroups.map(group => {
            const email = group.latestEmail || {};
            const rawPreview = group.preview || email.preview || email.body || '';
            const cleanPreview = stripHtml(rawPreview);
            const truncatedPreview = cleanPreview.length > 150 
              ? `${cleanPreview.substring(0, 150)}...`
              : cleanPreview;

            const isSelected = selectedEmail && (selectedEmail.thread_id === group.threadId || selectedEmail.threadId === group.threadId);
            const isUnread = group.unreadCount > 0;

            return (
              <div
                key={group.threadId}
                onClick={() => onEmailSelect(email, group)}
                className={cn(
                  "cursor-pointer transition-all duration-150",
                  isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "",
                )}
              >
                <div className={cn(
                  "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4 flex items-start",
                    isUnread ? style.borderLeft : ""
                )}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn("text-sm truncate", isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                          {group.subject}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 truncate">{email.sender || email.from}</p>
                      </div>
                      <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                        {isUnread && (<div className={cn("w-2 h-2 rounded-full", style.dot)}></div>)}
                        <span className="text-xs text-gray-400">{formatDate(group.date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-xs mt-2">
                      <span className="text-gray-600">{group.messageCount} messages</span>
                      {isUnread && (
                        <span className={cn("ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px]", style.pill)}>
                          {group.unreadCount} unread
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2 mt-2">{truncatedPreview || 'No preview available.'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EmailList;
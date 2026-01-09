/**
 * @file popup/src/components/EmailList.jsx
 * @description React component for displaying a list of emails within a category.
 * Mirrors the provided UI design.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Building2, Briefcase, TrendingUp } from 'lucide-react';
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
  // Remove non-content elements that often contain large blocks of CSS/JS in email HTML
  try {
    doc.querySelectorAll('style,script,noscript').forEach((el) => el.remove());
  } catch (_) {
    // ignore
  }
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
  totalMessages,
  onMarkAllAsRead,
  isMarkingAllAsRead,
  // Optional prop: parent can signal if the entire category has unread threads
  hasUnreadCategory
}) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);

  // Prevent filter state from "sticking" when switching to categories that don't expose the filter UI.
  useEffect(() => {
    const c = (category || '').toString().toLowerCase();
    const supportsActiveFilter = c === 'applied' || c === 'interviewed';
    if (!supportsActiveFilter && activeFilter !== 'all') {
      setActiveFilter('all');
    }
    // Also close any open confirmations when navigating between categories.
    setShowMarkAllConfirm(false);
  }, [category]);
  
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
  
  // Apply active/inactive filter
  const filteredThreadGroups = useMemo(() => {
    if (activeFilter === 'all') return threadGroups;
    
    return threadGroups.filter(group => {
      const email = group.latestEmail || {};
      const isActive = !email.isClosed && (category === 'applied' || category === 'interviewed');
      
      if (activeFilter === 'active') return isActive;
      if (activeFilter === 'inactive') return !isActive;
      return true;
    });
  }, [threadGroups, activeFilter, category]);
  
  const displayCount = totalEmails !== undefined ? totalEmails : countUniqueThreads(emails);
  const displayTotalMessages = typeof totalMessages === 'number' ? totalMessages : emails.length;
  
  // Get the appropriate label based on category
  const getCategoryLabel = (count) => {
    const labels = {
      applied: count === 1 ? 'application' : 'applications',
      interviewed: count === 1 ? 'application' : 'applications',
      offers: count === 1 ? 'offer' : 'offers',
      rejected: count === 1 ? 'rejection' : 'rejections'
    };
    return labels[category] || (count === 1 ? 'conversation' : 'conversations');
  };
  
  // If parent supplies `hasUnreadCategory` use it (covers unread threads outside pagination),
  // otherwise fall back to inspecting the currently-paginated thread groups.
  const hasUnreadEmails = typeof hasUnreadCategory === 'boolean' ? hasUnreadCategory : threadGroups.some(group => group.unreadCount > 0);

  // Show the Mark All button whenever the category/page has at least one thread (so users can discover it),
  // but disable it when there are no unread threads or when a marking operation is in progress.
  const canShowMarkAllButton = (typeof displayCount === 'number' ? displayCount > 0 : threadGroups.length > 0) && !!onMarkAllAsRead;

  const handleMarkAllAsRead = () => {
    if (!onMarkAllAsRead) return;
    if (!hasUnreadEmails) return;
    setShowMarkAllConfirm(true);
  };

  const confirmMarkAllAsRead = () => {
    setShowMarkAllConfirm(false);
    onMarkAllAsRead(category);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 min-w-0"> {/* Added min-w-0 */}
      {/* Header - redesigned */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {categoryTitle}
          </h2>
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
            style.badge
          )}>
            {category === 'interviewed'
              ? (displayCount > 0
                  ? `${displayCount} ${getCategoryLabel(displayCount)}, ${displayTotalMessages} email${displayTotalMessages !== 1 ? 's' : ''}`
                  : `0 ${getCategoryLabel(0)}`)
              : `${displayCount} ${getCategoryLabel(displayCount)}`}
          </span>
        </div>
        {/* Explanatory subtext to clarify what the count represents */}
        <div className="mb-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {category === 'interviewed'
              ? 'Interview emails grouped by application. Uses linking when available; otherwise groups by company + role.'
              : 'Email threads grouped by conversation. May include multiple emails per application.'}
          </p>
        </div>
        
        {/* Active/Inactive Filter - Only show for Applied and Interviewed categories */}
        {(category === 'applied' || category === 'interviewed') && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeFilter === 'all'
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              )}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('active')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeFilter === 'active'
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              )}
            >
              Active
            </button>
            <button
              onClick={() => setActiveFilter('inactive')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeFilter === 'inactive'
                  ? "bg-gray-200 text-gray-700 dark:bg-zinc-600 dark:text-zinc-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              )}
            >
              Closed
            </button>
          </div>
        )}
        
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

            {showMarkAllConfirm && (
              <div className="mt-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/40 p-3">
                <div className="text-xs text-gray-700 dark:text-zinc-200">
                  Mark all threads in <span className="font-semibold">{categoryTitle}</span> as read?
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmMarkAllAsRead}
                    disabled={isMarkingAllAsRead}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold",
                      "bg-blue-600 hover:bg-blue-700 text-white",
                      "disabled:opacity-60 disabled:cursor-not-allowed"
                    )}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMarkAllConfirm(false)}
                    disabled={isMarkingAllAsRead}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium",
                      "border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800",
                      "text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700/50",
                      "disabled:opacity-60 disabled:cursor-not-allowed"
                    )}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {filteredThreadGroups.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-zinc-400 py-8">
          {activeFilter === 'all' 
            ? 'No emails found in this category.'
            : activeFilter === 'active'
            ? 'No active applications in this category.'
            : 'No closed applications in this category.'}
        </div>
      ) : (
        <div className="p-2 space-y-2">
          {filteredThreadGroups.map(group => {
            const email = group.latestEmail || {};
            const rawPreview = group.preview || email.preview || email.body || '';
            const cleanPreview = stripHtml(rawPreview);
            const truncatedPreview = cleanPreview.length > 150 
              ? `${cleanPreview.substring(0, 150)}...`
              : cleanPreview;

            const isSelected = selectedEmail && (selectedEmail.thread_id === group.threadId || selectedEmail.threadId === group.threadId);
            const isUnread = group.unreadCount > 0;
            
            // An application is "active" if it's not closed and is in Applied or Interviewed categories
            const isActive = !email.isClosed && (category === 'applied' || category === 'interviewed');

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

                    {/* Read-only Company | Position | Lifecycle | Active Status display */}
                    {(email.company_name || email.position || (email.lifecycleStageCount && email.lifecycleStageCount > 1) || isActive) && (
                      <div className="flex items-center space-x-2 text-xs mt-2 text-gray-600">
                        {isActive && (
                          <div className="flex items-center space-x-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                              Active
                            </span>
                          </div>
                        )}
                        {isActive && (email.company_name || email.position || (email.lifecycleStageCount && email.lifecycleStageCount > 1)) && (
                          <span>|</span>
                        )}
                        {email.company_name && (
                          <div className="flex items-center space-x-1">
                            <Building2 className="h-3 w-3 text-gray-400" />
                            <span>{email.company_name}</span>
                          </div>
                        )}
                        {email.company_name && email.position && (
                          <span>|</span>
                        )}
                        {email.position && (
                          <div className="flex items-center space-x-1">
                            <Briefcase className="h-3 w-3 text-gray-400" />
                            <span>{email.position}</span>
                          </div>
                        )}
                        {email.lifecycleStageCount && email.lifecycleStageCount > 1 && (
                          <>
                            {(email.company_name || email.position) && <span>|</span>}
                            <div className="flex items-center space-x-1 text-purple-600">
                              <TrendingUp className="h-3 w-3" />
                              <span className="font-medium">{email.lifecycleStageCount} stages</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

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

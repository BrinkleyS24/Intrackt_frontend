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
  isMarkingAllAsRead 
}) {
  const categoryTitle = getCategoryTitle(category);
  const threadGroups = useMemo(() => groupEmailsByThread(emails), [emails]);
  const displayCount = totalEmails !== undefined ? totalEmails : countUniqueThreads(emails);
  const hasUnreadEmails = threadGroups.some(group => group.unreadCount > 0);

  const handleMarkAllAsRead = () => {
    if (onMarkAllAsRead && hasUnreadEmails) {
      onMarkAllAsRead(category);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 min-w-0"> {/* Added min-w-0 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {categoryTitle} Emails ({displayCount})
        </h2>
        {hasUnreadEmails && onMarkAllAsRead && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllAsRead}
            className={cn(
              "inline-flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md",
              "border border-gray-300 dark:border-zinc-600",
              "text-gray-700 dark:text-zinc-300",
              "hover:bg-gray-100 dark:hover:bg-zinc-700",
              "transition-colors duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <CheckCheck className="h-4 w-4" />
            <span>{isMarkingAllAsRead ? 'Marking...' : 'Mark All Ready'}</span>
          </button>
        )}
      </div>
      {threadGroups.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-zinc-400 py-8">
          No emails found in this category.
        </div>
      ) : (
        <div className="space-y-4">
          {threadGroups.map(group => {
            const email = group.latestEmail || {};
            // Process the preview text here for cleaner JSX from latest message in thread
            const rawPreview = group.preview || email.preview || email.body || '';
            const cleanPreview = stripHtml(rawPreview);
            const truncatedPreview = cleanPreview.length > 150 
              ? `${cleanPreview.substring(0, 150)}...`
              : cleanPreview;

            return (
              <div
                key={group.threadId}
                className={cn(
                  "card p-4 flex items-start space-x-4 cursor-pointer transition-all duration-200",
                  "hover:bg-gray-100 dark:hover:bg-zinc-700",
                  selectedEmail && (selectedEmail.thread_id === group.threadId || selectedEmail.threadId === group.threadId)
                    ? "border-2 border-blue-500 dark:border-blue-400 shadow-md"
                    : "border border-gray-200 dark:border-zinc-700"
                )}
                onClick={() => onEmailSelect(email)}
              >
                <div className="flex-1 min-w-0">
                  {/* Sender, Subject, and Date */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate flex-1 pr-2">
                      {group.subject}
                    </h3>
                    <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                      {group.unreadCount > 0 && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                      <span className="text-xs text-gray-400 dark:text-zinc-500">
                        {formatDate(group.date)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 truncate">{email.sender || email.from}</p>

                  {/* Thread meta */}
                  <div className="flex items-center space-x-4 text-xs mt-2">
                    <span className="text-gray-600 dark:text-zinc-300">{group.messageCount} messages</span>
                    {group.unreadCount > 0 && (
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                        {group.unreadCount} unread
                      </span>
                    )}
                  </div>

                  {/* Preview -- MODIFIED LINE */}
                  <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mt-2">
                    {truncatedPreview || 'No preview available.'}
                  </p>
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
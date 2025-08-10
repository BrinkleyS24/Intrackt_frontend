/**
 * @file popup/src/components/EmailList.jsx
 * @description React component for displaying a list of emails within a category.
 * Mirrors the provided UI design.
 */

import React from 'react';
import { cn } from '../utils/cn';
import { formatDate, getCategoryBadgeColor, getCategoryTitle } from '../utils/uiHelpers';

// Import Lucide React Icons directly
import { Calendar, Building2 } from 'lucide-react'; // Ensure Building2 is imported

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


function EmailList({ emails, category, selectedEmail, onEmailSelect, totalEmails  }) {
  const categoryTitle = getCategoryTitle(category);

   const displayCount = totalEmails !== undefined ? totalEmails : emails.length;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 min-w-0"> {/* Added min-w-0 */}
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        {categoryTitle} Emails ({displayCount})
      </h2>
      {emails.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-zinc-400 py-8">
          No emails found in this category.
        </div>
      ) : (
        <div className="space-y-4">
          {emails.map(email => {
            // Process the preview text here for cleaner JSX
            const rawPreview = email.preview || email.body || '';
            const cleanPreview = stripHtml(rawPreview);
            const truncatedPreview = cleanPreview.length > 150 
              ? `${cleanPreview.substring(0, 150)}...`
              : cleanPreview;

            return (
              <div
                key={email.id}
                className={cn(
                  "card p-4 flex items-start space-x-4 cursor-pointer transition-all duration-200",
                  "hover:bg-gray-100 dark:hover:bg-zinc-700",
                  selectedEmail && selectedEmail.id === email.id
                    ? "border-2 border-blue-500 dark:border-blue-400 shadow-md"
                    : "border border-gray-200 dark:border-zinc-700"
                )}
                onClick={() => onEmailSelect(email)}
              >
                <div className="flex-1 min-w-0">
                  {/* Sender, Subject, and Date */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate flex-1 pr-2">
                      {email.subject}
                    </h3>
                    <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                      {!email.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                      <span className="text-xs text-gray-400 dark:text-zinc-500">
                        {formatDate(email.date)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 truncate">{email.sender || email.from}</p> {/* Use email.from as fallback */}

                  {/* Company & Position */}
                  <div className="flex items-center space-x-4 text-xs mt-2">
                    <div className="flex items-center space-x-1 text-gray-600 dark:text-zinc-300">
                      <Building2 className="h-3 w-3" /> {/* Use Lucide Building2 icon */}
                      <span>{email.company || 'N/A'}</span> {/* Use N/A for missing data */}
                    </div>
                    <span className="text-gray-400 dark:text-zinc-500">•</span>
                    <span className="text-gray-600 dark:text-zinc-300">{email.position || 'N/A'}</span> {/* Use N/A for missing data */}
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
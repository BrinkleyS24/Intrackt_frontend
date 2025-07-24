/**
 * @file popup/src/components/EmailPreview.jsx
 * @description React component for displaying the detailed preview of a selected email.
 * Mirrors the provided UI design.
 */

import React, { useState } from 'react';
import { getCategoryColor } from '../utils/uiHelpers';
import { sendEmailReplyService } from '../services/emailService'; // To send email reply
import { showNotification } from './Notification';
import { cn } from '../utils/cn';
// Icons for the email preview, mimicking Lucide React icons
const Icons = {
  Calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  Building2: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-building-2"><path d="M6 22V7H4a2 2 0 0 1-2-2V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-2v15z"/><path d="M10 22V7H8a2 2 0 0 1-2-2V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-2v15z"/><path d="M14 22V7H12a2 2 0 0 1-2-2V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-2v15z"/><path d="M18 22V7H16a2 2 0 0 1-2-2V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-2v15z"/></svg>`,
  Clock: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  Reply: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-reply"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`,
  Star: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  ExternalLink: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>`,
  ArrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`
};

/**
 * Formats a date string into a long, readable format.
 * Matches the formatting used in the React EmailPreview.
 * @param {string} dateStr - The date string to format.
 * @returns {string} Formatted date string.
 */
function formatLongDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Provides mock email content based on email ID, mimicking the React EmailPreview.
 * @param {string} emailId - The ID of the email.
 * @param {string} defaultPreview - The default preview text if full content not found.
 * @returns {string} The full email content.
 */
function getEmailContent(emailId, defaultPreview) {
  const contents = {
    "1": `Dear Candidate,

Thank you for applying to the Software Engineer position at TechCorp. We have received your application and our hiring team is currently reviewing all submissions.

We will be in touch within the next 2-3 weeks regarding the next steps in our hiring process. If you have any questions in the meantime, please don't hesitate to reach out.

Best regards,
TechCorp Talent Acquisition Team`,

    "2": `Hi there,

We were impressed with your application for the Frontend Developer position at Innovate Inc. We would like to invite you to participate in our interview process.

The interview will consist of:
- Technical coding challenge (45 minutes)
- Team culture fit discussion (30 minutes)
- Q&A session (15 minutes)

Please reply with your availability for next week, and we'll send you the interview details.

Looking forward to meeting you!

Sarah Johnson
Senior Technical Recruiter
Innovate Inc`,

    "3": `Congratulations!

We are thrilled to extend an offer for the Senior React Developer position at Startup.io. After careful consideration of all candidates, we believe you would be an excellent addition to our engineering team.

Offer Details:
- Position: Senior React Developer
- Salary: $95,000 annually
- Benefits: Health, dental, vision insurance, 401k matching
- Start Date: July 15, 2024
- Equity: 0.25% stock options

Please review the attached offer letter and let us know your decision by June 25th. We're excited about the possibility of working with you!

Best,
Alex Chen
CTO, Startup.io`,

    "4": `Thank you for your interest in BigCorp.

After careful consideration of your application for the Full Stack Developer position, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.

We were impressed with your background and encourage you to apply for future opportunities that match your skillset. We will keep your resume on file for six months.

Thank you again for considering BigCorp as your next career opportunity.

Regards,
BigCorp Hiring Team`
  };

  return contents[emailId] || defaultPreview;
}


function EmailPreview({ email, onToggleReply, onOpenInGmail, onBack }) {
  const [showReplySection, setShowReplySection] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  const handleToggleReply = () => {
    setShowReplySection(prev => !prev);
    // Also call the prop function if it exists
    if (onToggleReply) onToggleReply();
  };

  const handleSendReply = async () => {
    if (!email || !replyBody.trim()) {
      showNotification("Reply body cannot be empty.", "warning");
      return;
    }

    const recipient = email.sender.match(/<([^>]+)>/)?.[1] || email.sender; // Extract email from "Name <email>"
    const subject = `Re: ${email.subject}`; // Simple reply subject

    try {
      const response = await sendEmailReplyService(email.threadId, recipient, subject, replyBody);
      if (response.success) {
        showNotification("Email reply sent successfully!", "success");
        setReplyBody(''); // Clear reply box
        setShowReplySection(false); // Hide reply section
      } else {
        showNotification(`Failed to send reply: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error sending email reply:", error);
      showNotification(`Error sending reply: ${error.message}`, "error");
    }
  };


  if (!email) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white dark:bg-zinc-800">
        <div className="text-center text-gray-500 dark:text-zinc-400 p-4">
          <span className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-zinc-600 block" dangerouslySetInnerHTML={{ __html: Icons.Calendar }} />
          <h3 className="text-lg font-medium mb-2">Select an email</h3>
          <p className="text-sm">Choose an email from the list to view its content</p>
        </div>
      </div>
    );
  }

  const categoryColorClass = getCategoryColor(email.category);
  const gmailLink = `https://mail.google.com/mail/u/0/#all/${email.threadId}`;

  return (
    <div className="flex-1 h-full flex flex-col bg-white dark:bg-zinc-800">
      {/* Back Button */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex items-center bg-white dark:bg-zinc-800">
        <button
          className="btn btn-ghost btn-sm flex items-center text-gray-700 dark:text-gray-300"
          onClick={onBack}
        >
          <span className="h-5 w-5 mr-1" dangerouslySetInnerHTML={{ __html: Icons.ArrowLeft }} />
          Back to List
        </button>
      </div>

      {/* Email Header */}
      <div className="border-b border-gray-200 dark:border-zinc-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {email.subject}
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-zinc-300">
              <div className="flex items-center space-x-1">
                <span className="font-medium">From:</span>
                <span>{email.sender}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="h-4 w-4" dangerouslySetInnerHTML={{ __html: Icons.Clock }} />
                <span>{formatLongDate(email.date)}</span>
              </div>
            </div>
          </div>
          <span className={cn("badge", categoryColorClass)}>
            {email.category}
          </span>
        </div>

        {/* Job Details Card */}
        <div className="card bg-gray-50 dark:bg-zinc-700 shadow-sm">
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <span className="h-4 w-4 text-gray-500 dark:text-zinc-400" dangerouslySetInnerHTML={{ __html: Icons.Building2 }} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Company</p>
                  <p className="font-medium text-gray-900 dark:text-white">{email.company}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-4 w-4 text-gray-500 dark:text-zinc-400" dangerouslySetInnerHTML={{ __html: Icons.Calendar }} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Position</p>
                  <p className="font-medium text-gray-900 dark:text-white">{email.position}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 mt-4">
          <button id="reply-button" className="btn btn-sm btn-primary flex items-center space-x-1" onClick={handleToggleReply}>
            <span className="h-4 w-4" dangerouslySetInnerHTML={{ __html: Icons.Reply }} />
            <span>Reply</span>
          </button>
          <button className="btn btn-sm btn-outline flex items-center space-x-1">
            <span className="h-4 w-4" dangerouslySetInnerHTML={{ __html: Icons.Star }} />
            <span>Star</span>
          </button>
          <button
            id="open-in-gmail-btn"
            className="btn btn-sm btn-outline flex items-center space-x-1"
            onClick={() => onOpenInGmail(gmailLink)}
          >
            <span className="h-4 w-4" dangerouslySetInnerHTML={{ __html: Icons.ExternalLink }} />
            <span>Open in Gmail</span>
          </button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="prose max-w-none">
          <div className="whitespace-pre-line text-gray-700 dark:text-zinc-200 leading-relaxed">
            {getEmailContent(email.id, email.preview)}
          </div>
        </div>
      </div>

      {/* Reply Section */}
      {showReplySection && (
        <div className="border-t border-gray-200 dark:border-zinc-700 px-6 py-4 bg-white dark:bg-zinc-800">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Reply to Email</h3>
          <textarea
            id="reply-body"
            rows="5"
            className="border border-gray-300 dark:border-zinc-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full bg-white dark:bg-zinc-900 text-sm dark:text-white"
            placeholder="Type your reply here..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          ></textarea>
          <div className="mt-3 flex justify-between">
            <button id="send-reply" className="btn-primary" onClick={handleSendReply}>Send</button>
            <a href={gmailLink} id="open-in-gmail-footer"
              className="secondary-btn border border-gray-400 dark:border-zinc-500 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
              target="_blank" rel="noopener noreferrer">
              Open in Gmail
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailPreview;

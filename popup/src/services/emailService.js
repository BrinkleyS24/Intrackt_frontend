/**
 * @file popup/src/services/emailService.js
 * @description Centralized service for interacting with email data,
 * primarily through the background script to fetch from the backend.
 */

import { sendMessageToBackground } from '../utils/chromeMessaging';

export async function fetchStoredEmailsService(userEmail) {
  try {
    if (!userEmail) {
      console.error('❌ Intrackt: User email not provided for fetchStoredEmailsService.');
      return { applied: [], interviewed: [], offers: [], rejected: [], irrelevant: [] };
    }
    const response = await sendMessageToBackground({
      type: 'FETCH_STORED_EMAILS',
      userEmail: userEmail
    });
    if (response.success && response.categorizedEmails) {
      return response.categorizedEmails;
    } else {
      console.error("❌ Intrackt: Failed to retrieve stored emails from background:", response.error);
      return { applied: [], interviewed: [], offers: [], rejected: [], irrelevant: [] };
    }
  } catch (error) {
    console.error("❌ Intrackt: Error sending FETCH_STORED_EMAILS message to background:", error);
    return { applied: [], interviewed: [], offers: [], rejected: [], irrelevant: [] };
  }
}

export async function fetchNewEmailsService(userEmail, userId, fullRefresh = false) {
  try {
    const response = await sendMessageToBackground({
      type: 'FETCH_NEW_EMAILS',
      userEmail: userEmail,
      userId: userId,
      fullRefresh: fullRefresh
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending FETCH_NEW_EMAILS message to background:", error);
    return { success: false, error: error.message };
  }
}

export async function reportMisclassificationService(reportData) {
  try {
    const response = await sendMessageToBackground({
      type: 'REPORT_MISCLASSIFICATION',
      reportData: reportData,
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending REPORT_MISCLASSIFICATION message to background:", error);
    return { success: false, error: error.message };
  }
}

export async function undoMisclassificationService(undoData) {
    try {
        const response = await sendMessageToBackground({
            type: 'UNDO_MISCLASSIFICATION',
            undoData: undoData,
        });
        return response;
    } catch (error) {
        console.error("❌ Intrackt: Error sending UNDO_MISCLASSIFICATION message to background:", error);
        return { success: false, error: error.message };
    }
}

export async function sendEmailReplyService(threadId, to, subject, message, userEmail) {
  try {
    if (!userEmail) {
      return { success: false, error: 'User email not provided for sending reply.' };
    }
    const response = await sendMessageToBackground({
      type: 'SEND_EMAIL_REPLY',
      threadId,
      to,
      subject,
      message,
      userEmail,
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending SEND_EMAIL_REPLY message to background:", error);
    return { success: false, error: error.message };
  }
}

export async function archiveEmailService(threadId, userEmail) {
  try {
    if (!userEmail) {
      return { success: false, error: 'User email not provided for archiving.' };
    }
    const response = await sendMessageToBackground({
      type: 'ARCHIVE_EMAIL',
      threadId: threadId,
      userEmail: userEmail
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending ARCHIVE_EMAIL message to background:", error);
    return { success: false, error: error.message };
  }
}

// NEW: Service function to tell the background to mark emails as read
/**
 * Sends a request to the background script to mark all unread emails in a category as read.
 * @param {string} category - The category to update (e.g., 'applied').
 * @param {string} userId - The Firebase UID of the user.
 * @returns {Promise<Object>} A success/error object from the background script.
 */
export async function markEmailsAsReadService(category, userId) {
  try {
    const response = await sendMessageToBackground({
      type: 'MARK_AS_READ', // A new message type for the background script
      payload: {
        category,
        userId,
      },
    });
    return response;
  } catch (error) {
    console.error(`Error sending MARK_AS_READ message for category ${category}:`, error);
    return { success: false, error: error.message };
  }
}

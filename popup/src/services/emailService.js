/**
 * @file popup/src/services/emailService.js
 * @description Centralized service for interacting with email data,
 * primarily through the background script to fetch from the backend
 * and manage local storage caching.
 */

import { sendMessageToBackground } from '../utils/chromeMessaging';

/**
 * Fetches stored emails from chrome.storage.local.
 * This function is now the primary way the UI gets email data for quick display.
 * @returns {Promise<Object>} An object containing categorized emails from local storage.
 */
export async function fetchStoredEmailsService() {
  try {
    // Retrieve all categorized emails from local storage.
    // Default to empty arrays if no data is found for a category.
    const result = await chrome.storage.local.get([
      'appliedEmails',
      'interviewedEmails',
      'offersEmails',
      'rejectedEmails',
    ]);

    const categorizedEmails = {
      applied: result.appliedEmails || [],
      interviewed: result.interviewedEmails || [],
      offers: result.offersEmails || [],
      rejected: result.rejectedEmails || [],
    };

    console.log("✅ Intrackt: Fetched stored emails from local storage:", categorizedEmails);
    return categorizedEmails;
  } catch (error) {
    console.error("❌ Intrackt: Error fetching stored emails from local storage:", error);
    // Return empty categories on error to prevent UI breakage
    return { applied: [], interviewed: [], offers: [], rejected: [], irrelevant: [] };
  }
}

/**
 * Sends a request to the background script to fetch new emails from the backend (Gmail API)
 * and update the local storage. This function also receives quota data.
 * @param {string} userEmail - The email of the authenticated user.
 * @param {string} userId - The Firebase UID of the user.
 * @param {boolean} fullRefresh - If true, requests a full re-sync from Gmail.
 * @returns {Promise<Object>} An object containing success status, updated categorized emails, and quota.
 */
export async function fetchNewEmailsService(userEmail, userId, fullRefresh = false) {
  try {
    if (!userEmail || !userId) {
      console.error('❌ Intrackt: User email or ID not provided for fetchNewEmailsService.');
      return { success: false, error: 'User email or ID missing.' };
    }

    console.log(`DEBUG emailService: Requesting new emails from background (fullRefresh: ${fullRefresh}).`);
    const response = await sendMessageToBackground({
      type: 'FETCH_NEW_EMAILS', // Message type for background script
      userEmail: userEmail,
      userId: userId,
      fullRefresh: fullRefresh // Pass the fullRefresh flag
    });

    if (response.success) {
      // The background script is responsible for saving to chrome.storage.local.
      // We just return the response here, which should contain the updated data.
      console.log("✅ Intrackt: New emails fetched and local storage updated by background.", response);
      return {
        success: true,
        categorizedEmails: response.categorizedEmails, // Updated emails from backend
        quota: response.quota // Quota data from backend
      };
    } else {
      console.error("❌ Intrackt: Failed to retrieve new emails from background:", response.error);
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error("❌ Intrackt: Error sending FETCH_NEW_EMAILS message to background:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a request to the background script to send an email reply.
 * @param {string} threadId - The ID of the email thread.
 * @param {string} recipient - The recipient's email address.
 * @param {string} subject - The subject of the reply.
 * @param {string} body - The body of the reply.
 * @param {string} userEmail - The email of the authenticated user.
 * @returns {Promise<Object>} A success/error object from the background script.
 */
export async function sendEmailReplyService(threadId, recipient, subject, body, userEmail) {
  try {
    if (!userEmail) {
      return { success: false, error: 'User email not provided for sending reply.' };
    }
    const response = await sendMessageToBackground({
      type: 'SEND_EMAIL_REPLY',
      threadId: threadId,
      recipient: recipient,
      subject: subject,
      body: body,
      userEmail: userEmail
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending SEND_EMAIL_REPLY message to background:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a request to the background script to report an email misclassification.
 * @param {object} reportPayload - The complete report payload containing all necessary data.
 * @returns {Promise<Object>} A success/error object from the background script.
 */

export async function reportMisclassificationService(reportPayload) {
  try {
    // The reportPayload should contain all necessary data including emailId, threadId, etc.
    // userEmail and userId will be added by background.js from chrome.storage.local
    const response = await sendMessageToBackground({
      type: 'REPORT_MISCLASSIFICATION',
      emailData: reportPayload, // Pass the entire payload as emailData
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending REPORT_MISCLASSIFICATION message to background:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a request to the background script to undo a previous misclassification.
 * @param {object} undoData - The undo data containing emailId, threadId, originalCategory, etc.
 * @returns {Promise<Object>} A success/error object from the background script.
 */
export async function undoMisclassificationService(undoData) {
  try {
    // The undoData should contain emailId, threadId, originalCategory, etc.
    // userEmail and userId will be added by background.js from chrome.storage.local
    const response = await sendMessageToBackground({
      type: 'UNDO_MISCLASSIFICATION',
      undoData: undoData, // Pass the entire undo data object
    });
    return response;
  } catch (error) {
    console.error("❌ Intrackt: Error sending UNDO_MISCLASSIFICATION message to background:", error);
    return { success: false, error: error.message };
  }
}
/**
 * Sends a request to the background script to archive an email thread.
 * @param {string} threadId - The ID of the thread to archive.
 * @param {string} userEmail - The email of the authenticated user.
 * @returns {Promise<Object>} A success/error object from the background script.
 */
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
    console.error("❌ Intrackt: Error sending MARK_AS_READ message to background:", error);
    return { success: false, error: error.message };
  }
}

export async function markEmailAsReadService(emailId) {
  try {
    const response = await sendMessageToBackground({
      type: 'MARK_SINGLE_EMAIL_AS_READ',
      payload: {
        emailId,
      },
    });

    // **FIX**: Check for a failure response from the background script.
    // If the operation was not successful, throw an error to be caught by the calling hook.
    if (!response || !response.success) {
      throw new Error(response.error || 'Failed to mark email as read in background script.');
    }

    return response;
  } catch (error) {
    // Log the error and re-throw it so the UI layer can handle it (e.g., show a notification).
    console.error("❌ Intrackt: Error in markEmailAsReadService:", error);
    throw error;
  }
}
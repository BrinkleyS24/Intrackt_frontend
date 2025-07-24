/**
 * @file popup/src/hooks/useEmails.js
 * @description Custom React hook for managing email data, including fetching,
 * filtering, and handling actions like misclassification and replies.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchStoredEmailsService,
  fetchNewEmailsService,
  archiveEmailService,
  reportMisclassificationService,
  undoMisclassificationService,
  sendEmailReplyService,
  markEmailsAsReadService // NEW: Import the service to mark emails as read
} from '../services/emailService';
import { showNotification } from '../components/Notification';
import { getCategoryTitle } from '../utils/uiHelpers';

export function useEmails(userEmail, userId, CONFIG) {
  const [categorizedEmails, setCategorizedEmails] = useState({
    applied: [],
    interviewed: [],
    offers: [],
    rejected: [],
    irrelevant: [],
  });
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [isFilteredView, setIsFilteredView] = useState(false);
  const [filteredEmails, setFilteredEmails] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({ searchQuery: '', timeRange: 'all' });
  const [lastMisclassifiedEmail, setLastMisclassifiedEmail] = useState(null);
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const misclassificationTimerRef = useRef(null);

  // NEW: State to explicitly track unread counts for the UI
  const [unreadCounts, setUnreadCounts] = useState({});

  // NEW: Function to calculate unread counts from the main email list
  const calculateUnreadCounts = useCallback((emails) => {
    const counts = {};
    for (const category in emails) {
      if (Object.prototype.hasOwnProperty.call(emails, category)) {
        counts[category] = emails[category].filter(email => !email.isRead).length;
      }
    }
    setUnreadCounts(counts);
  }, []);

  const fetchStoredEmails = useCallback(async (email, id) => {
    setLoadingEmails(true);
    try {
      if (!email || !id) {
        console.warn("useEmails.js: Skipping fetchStoredEmails, userEmail or userId is missing.");
        return;
      }
      const fetchedEmails = await fetchStoredEmailsService(email);
      setCategorizedEmails(fetchedEmails);
      calculateUnreadCounts(fetchedEmails); // UPDATED: Calculate counts after fetching
    } catch (error) {
      console.error("❌ Intrackt: Error fetching stored emails:", error);
      showNotification("Failed to load stored emails.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [calculateUnreadCounts]);

  // NEW: Function to mark emails in a category as read
  const markEmailsAsReadForCategory = useCallback(async (category) => {
    if (!userId || !category || !unreadCounts[category] || unreadCounts[category] === 0) {
      return; // No user, no category, or nothing to mark
    }

    // 1. Optimistic UI Update: Update local state immediately for a responsive feel
    const originalEmails = categorizedEmails;
    const updatedEmails = {
        ...originalEmails,
        [category]: originalEmails[category].map(email => ({ ...email, isRead: true }))
    };
    setCategorizedEmails(updatedEmails);
    calculateUnreadCounts(updatedEmails); // This will set the count to 0 for the UI

    // 2. Backend Update: Send request to the server to persist the change
    try {
      await markEmailsAsReadService(category, userId);
      // Success! The UI is already updated.
    } catch (error) {
      console.error(`Failed to mark emails as read for ${category}:`, error);
      showNotification(`Could not update read status.`, 'error');
      // On error, revert the optimistic update
      setCategorizedEmails(originalEmails);
      calculateUnreadCounts(originalEmails);
    }
  }, [userId, categorizedEmails, unreadCounts, calculateUnreadCounts]);

  const fetchNewEmails = useCallback(async (email, id, fullRefresh = false) => {
    setLoadingEmails(true);
    try {
      if (!email || !id) {
        console.warn("useEmails.js: Skipping fetchNewEmails, userEmail or userId is missing.");
        return { success: false, error: "User email or ID missing." };
      }
      const response = await fetchNewEmailsService(email, id, fullRefresh);
      if (response.success) {
        showNotification("Emails synced successfully!", "success");
      } else {
        showNotification(`Failed to sync emails: ${response.error}`, "error");
      }
      return response;
    } catch (error) {
      console.error("❌ Intrackt: Error fetching new emails:", error);
      showNotification("Error syncing new emails.", "error");
      return { success: false, error: error.message };
    } finally {
      setLoadingEmails(false);
    }
  }, []);

  const handleReportMisclassification = useCallback(async (emailData, newCategory) => {
    if (!emailData || !emailData.email_id) {
      console.error("ERROR: Cannot report misclassification, emailData or emailData.email_id is missing.");
      showNotification("Error: Email data missing for misclassification.", "error");
      return;
    }

    const emailToReport = { ...emailData, correctedCategory: newCategory };
    setLastMisclassifiedEmail(emailToReport);
    setUndoToastVisible(true);

    if (misclassificationTimerRef.current) {
      clearTimeout(misclassificationTimerRef.current);
    }
    misclassificationTimerRef.current = setTimeout(async () => {
      setUndoToastVisible(false);
      try {
        const reportData = {
          userEmail: userEmail,
          emailId: emailToReport.email_id,
          threadId: emailToReport.threadId,
          originalCategory: emailToReport.category,
          correctedCategory: newCategory,
          emailSubject: emailToReport.subject,
          emailBody: emailToReport.body,
        };
        const result = await reportMisclassificationService(reportData);
        if (result.success) {
          showNotification(`Email moved to ${getCategoryTitle(newCategory)}!`, "success");
          await fetchStoredEmails(userEmail, userId);
        } else {
          showNotification(`Failed to report misclassification: ${result.error}`, "error");
        }
      } catch (error) {
        console.error("❌ Intrackt: Error reporting misclassification:", error);
        showNotification("Error reporting misclassification.", "error");
      } finally {
        setLastMisclassifiedEmail(null);
      }
    }, CONFIG.UNDO_TIMEOUT_MS);
  }, [userEmail, userId, fetchStoredEmails, CONFIG.UNDO_TIMEOUT_MS]);

  const undoMisclassification = useCallback(async (emailToUndo) => {
    if (misclassificationTimerRef.current) {
      clearTimeout(misclassificationTimerRef.current);
      misclassificationTimerRef.current = null;
    }
    setUndoToastVisible(false);

    if (!emailToUndo || !emailToUndo.email_id) {
      console.error("ERROR: No email ID (email_id) provided to undo misclassification.");
      showNotification("No recent misclassification to undo.", "warning");
      return;
    }

    try {
      const undoData = {
        userEmail: userEmail,
        emailId: emailToUndo.email_id,
        threadId: emailToUndo.threadId,
        originalCategory: emailToUndo.category,
        misclassifiedIntoCategory: emailToUndo.correctedCategory
      };
      const result = await undoMisclassificationService(undoData);
      if (result.success) {
        showNotification("Misclassification undone!", "info");
        await fetchStoredEmails(userEmail, userId);
      } else {
        showNotification(`Failed to undo misclassification: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error undoing misclassification:", error);
      showNotification("Error undoing misclassification.", "error");
    } finally {
      setLastMisclassifiedEmail(null);
    }
  }, [userEmail, userId, fetchStoredEmails]);

  const applyFilters = useCallback((filters) => {
    setAppliedFilters(filters);
    if (filters.category || filters.searchQuery || filters.timeRange !== 'all') {
      setIsFilteredView(true);
      let tempEmails = [];
      if (filters.category) {
        tempEmails = categorizedEmails[filters.category] || [];
      } else {
        tempEmails = Object.values(categorizedEmails).flat();
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        tempEmails = tempEmails.filter(email =>
          email.subject.toLowerCase().includes(query) ||
          email.from.toLowerCase().includes(query) ||
          email.body.toLowerCase().includes(query) ||
          email.company?.toLowerCase().includes(query) ||
          email.position?.toLowerCase().includes(query)
        );
      }
      setFilteredEmails(tempEmails);
    } else {
      setIsFilteredView(false);
      setFilteredEmails([]);
    }
  }, [categorizedEmails]);

  const clearFilters = useCallback(() => {
    setAppliedFilters({ searchQuery: '', timeRange: 'all' });
    setIsFilteredView(false);
    setFilteredEmails([]);
  }, []);

  const handleSendEmailReply = useCallback(async (threadId, recipient, subject, body) => {
    setLoadingEmails(true);
    try {
      const result = await sendEmailReplyService(threadId, recipient, subject, body, userEmail);
      if (result.success) {
        showNotification("Reply sent successfully!", "success");
        await fetchStoredEmails(userEmail, userId);
      } else {
        showNotification(`Failed to send reply: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error sending email reply:", error);
      showNotification("Error sending email reply.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [userEmail, userId, fetchStoredEmails]);

  const handleArchiveEmail = useCallback(async (threadId) => {
    setLoadingEmails(true);
    try {
      const result = await archiveEmailService(threadId, userEmail);
      if (result.success) {
        showNotification("Email archived!", "success");
        await fetchStoredEmails(userEmail, userId);
      } else {
        showNotification(`Failed to archive email: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error archiving email:", error);
      showNotification("Error archiving email.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [userEmail, userId, fetchStoredEmails]);

  useEffect(() => {
    if (userEmail && userId) {
      fetchStoredEmails(userEmail, userId);
    }
  }, [userEmail, userId, fetchStoredEmails]);

  return {
    categorizedEmails,
    fetchStoredEmails,
    fetchNewEmails,
    loadingEmails,
    isFilteredView,
    filteredEmails,
    appliedFilters,
    applyFilters,
    clearFilters,
    handleReportMisclassification,
    handleSendEmailReply,
    handleArchiveEmail,
    lastMisclassifiedEmail,
    undoMisclassification,
    undoToastVisible,
    setUndoToastVisible,
    unreadCounts, // NEW: Export the unread counts
    markEmailsAsReadForCategory, // NEW: Export the function to mark emails as read
  };
}

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
  markEmailsAsReadService
} from '../services/emailService';
import { showNotification } from '../components/Notification';
import { getCategoryTitle } from '../utils/uiHelpers';

export function useEmails(userEmail, userId, CONFIG) {
  // State to hold emails categorized by their job application status
  const [categorizedEmails, setCategorizedEmails] = useState({
    applied: [],
    interviewed: [],
    offers: [],
    rejected: [],
    irrelevant: [],
  });
  // State to indicate if email operations are in progress (e.g., fetching, sending)
  const [loadingEmails, setLoadingEmails] = useState(false);
  // State to determine if the current view is a filtered view of emails
  const [isFilteredView, setIsFilteredView] = useState(false);
  // State to hold emails after applying search and time range filters
  const [filteredEmails, setFilteredEmails] = useState([]);
  // State to store the currently applied filters (search query and time range)
  const [appliedFilters, setAppliedFilters] = useState({ searchQuery: '', timeRange: 'all' });
  // State to temporarily store the last misclassified email for the undo feature
  const [lastMisclassifiedEmail, setLastMisclassifiedEmail] = useState(null);
  // State to control the visibility of the undo toast notification
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  // Ref to store the timeout ID for the misclassification undo toast
  const misclassificationTimerRef = useRef(null);

  // State to store unread counts for each email category
  const [unreadCounts, setUnreadCounts] = useState({
    applied: 0,
    interviewed: 0,
    offers: 0,
    rejected: 0,
    irrelevant: 0,
  });

  /**
   * Calculates and updates the unread counts for all email categories.
   */
  const calculateUnreadCounts = useCallback((emails) => {
    const counts = {
      applied: 0,
      interviewed: 0,
      offers: 0,
      rejected: 0,
      irrelevant: 0,
    };
    Object.keys(emails).forEach(category => {
      counts[category] = emails[category].filter(email => !email.is_read).length;
    });
    setUnreadCounts(counts);
  }, []);

  // Use a ref to store the latest categorizedEmails for background sync
  // This ensures the chrome.runtime.onMessage listener always has the most current state
  const categorizedEmailsRef = useRef(categorizedEmails);
  useEffect(() => {
    categorizedEmailsRef.current = categorizedEmails;
  }, [categorizedEmails]);

  /**
   * Effect hook to listen for 'EMAILS_SYNCED' messages from the background script.
   * Updates the categorized emails and unread counts in the UI.
   */
  useEffect(() => {
    const handleEmailsSynced = (msg) => {
      if (msg.type === 'EMAILS_SYNCED' && msg.success) {
        console.log("✅ Intrackt: EMAILS_SYNCED message received in useEmails hook.");
        setCategorizedEmails(msg.categorizedEmails);
        calculateUnreadCounts(msg.categorizedEmails);
        setLoadingEmails(false);
        if (msg.quota) {
          // Additional quota handling if needed, though useAuth already handles this
        }
      } else if (msg.type === 'EMAILS_SYNCED' && !msg.success) {
        console.error("❌ Intrackt: Email sync failed:", msg.error);
        showNotification(`Email sync failed: ${msg.error}`, 'error');
        setLoadingEmails(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleEmailsSynced);

    return () => {
      chrome.runtime.onMessage.removeListener(handleEmailsSynced);
    };
  }, [calculateUnreadCounts]);

  /**
   * Fetches previously stored emails from chrome.storage.local.
   * This is used for initial loading to quickly display cached data.
   */
  const fetchStoredEmails = useCallback(async () => {
    setLoadingEmails(true);
    try {
      const stored = await fetchStoredEmailsService();
      setCategorizedEmails(stored);
      calculateUnreadCounts(stored);
    } catch (error) {
      console.error("❌ Intrackt: Error fetching stored emails:", error);
      showNotification("Failed to load stored emails.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [calculateUnreadCounts]);


  /**
   * Requests the background script to initiate a new email synchronization with the backend.
   */
  const fetchNewEmails = useCallback(async (fullRefresh = false) => {
    setLoadingEmails(true);
    try {
      const response = await fetchNewEmailsService(userEmail, userId, fullRefresh);
      if (!response.success) {
        showNotification(`Failed to sync emails: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error requesting new email sync:", error);
      showNotification(`Failed to request email sync: ${error.message}`, "error");
    } finally {
      // Loading state will be set to false by the EMAILS_SYNCED message listener
    }
  }, [userEmail, userId]);

  /**
   * Applies search and time range filters to the currently categorized emails.
   * Updates `filteredEmails` and `isFilteredView` states.
   */
  const applyFilters = useCallback((filters) => {
    setAppliedFilters(filters);
    const { searchQuery, timeRange } = filters;
    let filtered = [];

    if (!searchQuery && timeRange === 'all') {
      setIsFilteredView(false);
      setFilteredEmails([]);
      return;
    }

    setIsFilteredView(true);

    const allEmails = Object.values(categorizedEmails).flat();

    filtered = allEmails.filter(email => {
      const matchesSearch = searchQuery
        ? (email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.from?.toLowerCase().includes(searchQuery.toLowerCase()))
        : true;

      const emailDate = new Date(email.date);
      const now = new Date();
      let matchesTimeRange = true;

      switch (timeRange) {
        case 'last7days':
          matchesTimeRange = (now.getTime() - emailDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
          break;
        case 'last30days':
          matchesTimeRange = (now.getTime() - emailDate.getTime()) < 30 * 24 * 60 * 60 * 1000;
          break;
        case 'older':
          matchesTimeRange = (now.getTime() - emailDate.getTime()) >= 30 * 24 * 60 * 60 * 1000;
          break;
        case 'all':
        default:
          matchesTimeRange = true;
          break;
      }
      return matchesSearch && matchesTimeRange;
    });
    setFilteredEmails(filtered);
  }, [categorizedEmails]);

  /**
   * Clears all applied filters and reverts to showing all categorized emails.
   */
  const clearFilters = useCallback(() => {
    setAppliedFilters({ searchQuery: '', timeRange: 'all' });
    setIsFilteredView(false);
    setFilteredEmails([]);
  }, []);

  /**
   * Helper function to transform frontend category names (lowercase) to backend
   * expected format (capitalized).
   */
  const transformCategoryForBackend = (category) => {
    const categoryMap = {
      'applied': 'Applied',
      'interviewed': 'Interviewed',
      'offers': 'Offers',
      'rejected': 'Rejected',
      'irrelevant': 'Irrelevant'
    };
    return categoryMap[category] || category;
  };

  /**
   * Handles reporting an email misclassification to the backend.
   * Triggers a notification and an undo toast.
   */
  const handleReportMisclassification = useCallback(async (emailData, correctedCategory) => {
    const reportPayload = {
      emailId: emailData.id,
      threadId: emailData.thread_id,
      originalCategory: transformCategoryForBackend(emailData.category),
      correctedCategory: transformCategoryForBackend(correctedCategory),
      emailSubject: emailData.subject || 'No Subject',
      emailBody: emailData.body || 'No Body',
    };

    if (!reportPayload.emailId || !reportPayload.threadId || !reportPayload.originalCategory || !reportPayload.correctedCategory) {
      showNotification("Missing critical email data for misclassification report.", "error");
      console.error("❌ Intrackt: Missing critical email data for misclassification report:", reportPayload);
      return;
    }

    setLoadingEmails(true);
    try {
      const result = await reportMisclassificationService(reportPayload);
      if (result.success) {
        showNotification("Email reported as misclassified!", "success");
        setLastMisclassifiedEmail({
          emailId: reportPayload.emailId,
          threadId: reportPayload.threadId,
          originalCategory: reportPayload.originalCategory,
          misclassifiedIntoCategory: reportPayload.correctedCategory, // Store the category it was moved INTO
        });
        setUndoToastVisible(true);
        misclassificationTimerRef.current = setTimeout(() => {
          setUndoToastVisible(false);
          setLastMisclassifiedEmail(null);
        }, 10000); // Undo toast visible for 10 seconds

        await fetchStoredEmails(); // Re-fetch emails to reflect the category change
      } else {
        showNotification(`Failed to report misclassification: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error reporting misclassification:", error);
      showNotification("Error reporting misclassification.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [fetchStoredEmails]);

  /**
   * Handles undoing a previously reported misclassification.
   * Clears the undo toast and re-fetches emails.
   */
  const undoMisclassification = useCallback(async () => {
    if (!lastMisclassifiedEmail) {
      showNotification("No recent misclassification to undo.", "info");
      return;
    }

    setLoadingEmails(true);
    try {
      // Clear any existing undo timer and hide toast immediately
      if (misclassificationTimerRef.current) {
        clearTimeout(misclassificationTimerRef.current);
        misclassificationTimerRef.current = null;
      }
      setUndoToastVisible(false);

      const result = await undoMisclassificationService(lastMisclassifiedEmail); 
      if (result.success) {
        showNotification("Misclassification undone!", "success");
        setLastMisclassifiedEmail(null); 
        await fetchStoredEmails(); 
      } else {
        showNotification(`Failed to undo misclassification: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error undoing misclassification:", error);
      showNotification("Error undoing misclassification.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [lastMisclassifiedEmail, fetchStoredEmails]);

  /**
   * Handles sending an email reply via the background script.
   */
  const handleSendEmailReply = useCallback(async (threadId, recipient, subject, body) => {
    setLoadingEmails(true);
    try {
      const result = await sendEmailReplyService(threadId, recipient, subject, body, userEmail, userId);
      if (result.success) {
        showNotification("Email reply sent successfully!", "success");
        await fetchStoredEmails(); 
      } else {
        showNotification(`Failed to send email reply: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error sending email reply:", error);
      showNotification("Error sending email reply.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [userEmail, userId, fetchStoredEmails]);

  /**
   * Handles archiving an email via the background script.
   */
  const handleArchiveEmail = useCallback(async (threadId) => {
    setLoadingEmails(true);
    try {
      const result = await archiveEmailService(threadId, userEmail);
      if (result.success) {
        showNotification("Email archived!", "success");
        await fetchStoredEmails();
      } else {
        showNotification(`Failed to archive email: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error archiving email:", error);
      showNotification("Error archiving email.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [userEmail, fetchStoredEmails]);

  /**
   * Effect hook to fetch stored emails when `userEmail` or `userId` changes.
   * This ensures data is loaded once the user is authenticated.
   */
  useEffect(() => {
    if (userEmail && userId) {
      fetchStoredEmails();
    }
  }, [userEmail, userId, fetchStoredEmails]);

  // Returns all states and functions provided by this hook
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
    unreadCounts,
  };
}

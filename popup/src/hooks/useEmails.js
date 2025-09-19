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
  markEmailAsReadService,
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
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

  // Generic loading flag replacing prior undefined setLoadingEmails usage
  const [loadingEmails, setLoadingEmails] = useState(false);

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
   * Counts unread threads instead of individual unread emails for consistency.
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
      // Group emails by thread and count threads that have at least one unread email
      const threadsWithUnread = new Set();
      emails[category].forEach(email => {
        if (!email.is_read) {
          const threadId = email.thread_id || email.threadId || email.thread || email.id;
          threadsWithUnread.add(threadId);
        }
      });
      counts[category] = threadsWithUnread.size;
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
      if (msg.type === 'EMAILS_SYNCED') { 
  const stillSyncing = typeof msg.syncInProgress === 'boolean' ? msg.syncInProgress : false;
  console.log("✅ AppMailia AI: EMAILS_SYNCED message received.", { stillSyncing });
  setIsSyncing(stillSyncing);
        if (msg.success) {
          setCategorizedEmails(msg.categorizedEmails);
          calculateUnreadCounts(msg.categorizedEmails);
        } else {
          console.error("❌ AppMailia AI: Email sync failed:", msg.error);
          showNotification(`Email sync failed: ${msg.error}`, 'error');
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleEmailsSynced);
    return () => chrome.runtime.onMessage.removeListener(handleEmailsSynced);
  }, [calculateUnreadCounts]);

  useEffect(() => {
    const counts = {
      applied: 0,
      interviewed: 0,
      offers: 0,
      rejected: 0,
      irrelevant: 0,
    };
    if (categorizedEmails) {
      for (const category in categorizedEmails) {
        if (Array.isArray(categorizedEmails[category])) {
          counts[category] = categorizedEmails[category].filter(email => !email.is_read).length;
        }
      }
    }
    setUnreadCounts(counts);
  }, [categorizedEmails]); // This now correctly depends on the source state.

  const markEmailAsRead = useCallback(async (emailId) => {
    let originalEmails = JSON.parse(JSON.stringify(categorizedEmails));
    let targetEmail = null;
    let categoryKey = null;

    for (const category in categorizedEmails) {
      const email = categorizedEmails[category].find(e => e.id === emailId);
      if (email) {
        targetEmail = email;
        categoryKey = category;
        break;
      }
    }

    if (!targetEmail || targetEmail.is_read) {
      return;
    }

    // Optimistic UI Update: Just update the emails. The useEffect above will handle counts.
    const newCategorizedEmails = { ...categorizedEmails };
    newCategorizedEmails[categoryKey] = newCategorizedEmails[categoryKey].map(e =>
      e.id === emailId ? { ...e, is_read: true } : e
    );
    setCategorizedEmails(newCategorizedEmails);

    try {
      // Call the actual backend service to persist the change.
      await markEmailAsReadService(emailId);
    } catch (error) {
      console.error("❌ AppMailia AI: Failed to mark email as read on the server:", error);
      showNotification("Failed to update email read status.", "error");
      // Revert on failure, which will also re-trigger the useEffect to fix counts.
      setCategorizedEmails(originalEmails);
    }
  }, [categorizedEmails]);

  /**
   * Fetches previously stored emails from chrome.storage.local.
   * This is used for initial loading to quickly display cached data.
   */
  // 2. Update `fetchStoredEmails` to control the 'initialLoading' state
  const fetchStoredEmails = useCallback(async () => {
    setInitialLoading(true);
    try {
      const stored = await fetchStoredEmailsService();
      setCategorizedEmails(stored);
      calculateUnreadCounts(stored);
    } catch (error) {
      console.error("❌ AppMailia AI: Error fetching stored emails:", error);
      showNotification("Failed to load stored emails.", "error");
    } finally {
      // This will remove the main loading overlay, revealing the stored emails.
      setInitialLoading(false);
    }
  }, [calculateUnreadCounts]);


  /**
   * Requests the background script to initiate a new email synchronization with the backend.
   */
  const fetchNewEmails = useCallback(async (fullRefresh = false) => {
    setIsSyncing(true);
    try {
      const response = await fetchNewEmailsService(userEmail, userId, fullRefresh);
      if (!response.success) {
        showNotification(`Failed to sync emails: ${response.error}`, "error");
        setIsSyncing(false);
      }
    } catch (error) {
      console.error("❌ AppMailia AI: Error requesting new email sync:", error);
      showNotification(`Failed to request email sync: ${error.message}`, "error");
      setIsSyncing(false);
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
      console.error("❌ AppMailia AI: Missing critical email data for misclassification report:", reportPayload);
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
      console.error("❌ AppMailia AI: Error reporting misclassification:", error);
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
      console.error("❌ AppMailia AI: Error undoing misclassification:", error);
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
      } else if (result.needsReauth) {
        showNotification("Re-auth required to send email. Please log out and sign in again to grant permissions.", "warning");
      } else if (result.fallback) {
        showNotification("Temporary send fallback used; message may not appear in Gmail Sent.", "warning");
      } else {
        showNotification(`Failed to send email reply: ${result.error || 'Unknown error'}`, "error");
      }
    } catch (error) {
      console.error("❌ AppMailia AI: Error sending email reply:", error);
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
      console.error("❌ AppMailia AI: Error archiving email:", error);
      showNotification("Error archiving email.", "error");
    } finally {
  setLoadingEmails(false);
    }
  }, [userEmail, fetchStoredEmails]);

  // Mark all emails in a category as read (UI-first, then persist via background)
  const markEmailsAsReadForCategory = useCallback(async (category) => {
    if (!category) return;
    const prev = JSON.parse(JSON.stringify(categorizedEmails));
    const next = { ...categorizedEmails };
    next[category] = (next[category] || []).map(e => ({ ...e, is_read: true }));
    setCategorizedEmails(next);
    try {
      await markEmailsAsReadService(category, userId);
    } catch (e) {
      setCategorizedEmails(prev);
      showNotification('Failed to mark all as read.', 'error');
    }
  }, [categorizedEmails, userId]);

  // Returns all states and functions provided by this hook
  return {
    categorizedEmails,
    fetchStoredEmails,
    fetchNewEmails,
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
  markEmailsAsReadForCategory,
    markEmailAsRead,
    initialLoading,
  isSyncing,
  loadingEmails
  };
}

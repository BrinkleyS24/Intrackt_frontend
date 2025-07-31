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

  // NEW: State to track unread counts per category
  const [unreadCounts, setUnreadCounts] = useState({
    applied: 0,
    interviewed: 0,
    offers: 0,
    rejected: 0,
    irrelevant: 0,
  });

  // Function to calculate unread counts
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
  const categorizedEmailsRef = useRef(categorizedEmails);
  useEffect(() => {
    categorizedEmailsRef.current = categorizedEmails;
  }, [categorizedEmails]);


  // Effect to listen for EMAILS_SYNCED messages from background.js
  // This updates the UI with the latest data from the backend sync.
  useEffect(() => {
    const handleEmailsSynced = (msg) => {
      if (msg.type === 'EMAILS_SYNCED' && msg.success) {
        console.log("✅ Intrackt: EMAILS_SYNCED message received in useEmails hook.");
        setCategorizedEmails(msg.categorizedEmails);
        calculateUnreadCounts(msg.categorizedEmails); // Update unread counts
        setLoadingEmails(false); // Stop loading after sync
        // Update quota data if available in the message
        if (msg.quota) {
          // This will be handled by useAuth's chrome.storage.onChanged listener
          // No direct state update needed here for quotaData
        }
      } else if (msg.type === 'EMAILS_SYNCED' && !msg.success) {
        console.error("❌ Intrackt: Email sync failed:", msg.error);
        showNotification(`Email sync failed: ${msg.error}`, 'error');
        setLoadingEmails(false); // Stop loading even on error
      }
    };

    chrome.runtime.onMessage.addListener(handleEmailsSynced);

    return () => {
      chrome.runtime.onMessage.removeListener(handleEmailsSynced);
    };
  }, [calculateUnreadCounts]);


  const fetchStoredEmails = useCallback(async () => {
    setLoadingEmails(true);
    try {
      const stored = await fetchStoredEmailsService();
      setCategorizedEmails(stored);
      calculateUnreadCounts(stored); // Calculate unread counts after fetching stored emails
    } catch (error) {
      console.error("❌ Intrackt: Error fetching stored emails:", error);
      showNotification("Failed to load stored emails.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [calculateUnreadCounts]);


  const fetchNewEmails = useCallback(async (fullRefresh = false) => {
    setLoadingEmails(true);
    try {
      // The actual fetching and caching is done by the background script,
      // which then sends an 'EMAILS_SYNCED' message back to the popup.
      // The 'EMAILS_SYNCED' listener in this hook will update the state.
      const response = await fetchNewEmailsService(userEmail, userId, fullRefresh);
      if (!response.success) {
        showNotification(`Failed to sync emails: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error requesting new email sync:", error);
      showNotification(`Failed to request email sync: ${error.message}`, "error");
    } finally {
      // Loading state will be set to false by the EMAILS_SYNCED listener
    }
  }, [userEmail, userId]); // Depend on userEmail and userId


  const applyFilters = useCallback((filters) => {
    setAppliedFilters(filters);
    const { searchQuery, timeRange } = filters;
    let filtered = [];

    // If no search query and time range is 'all', show all emails for the selected category
    if (!searchQuery && timeRange === 'all') {
      setIsFilteredView(false);
      setFilteredEmails([]); // Clear filtered emails
      return;
    }

    setIsFilteredView(true);

    // Flatten all categorized emails into a single array for filtering
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
  }, [categorizedEmails]); // Recalculate if categorizedEmails change


  const clearFilters = useCallback(() => {
    setAppliedFilters({ searchQuery: '', timeRange: 'all' });
    setIsFilteredView(false);
    setFilteredEmails([]);
  }, []);

  // Add this helper function at the top of useEmails.js
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

  const handleReportMisclassification = useCallback(async (emailData, correctedCategory) => {
    // Transform both categories to match database expectations
    const reportPayload = {
      emailId: emailData.id, // Supabase row ID
      threadId: emailData.thread_id, // Gmail thread ID
      originalCategory: transformCategoryForBackend(emailData.category), // Transform original
      correctedCategory: transformCategoryForBackend(correctedCategory), // Transform corrected
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
          misclassifiedIntoCategory: reportPayload.correctedCategory,
        });
        setUndoToastVisible(true);
        misclassificationTimerRef.current = setTimeout(() => {
          setUndoToastVisible(false);
          setLastMisclassifiedEmail(null);
        }, 10000); // UNDO_TIMEOUT_MS

        await fetchStoredEmails();
      } else {
        showNotification(`Failed to report misclassification: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error reporting misclassification:", error);
      showNotification("Error reporting misclassification.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [fetchStoredEmails, userId, userEmail]);
  const undoMisclassification = useCallback(async () => {
    if (!lastMisclassifiedEmail) {
      showNotification("No recent misclassification to undo.", "info");
      return;
    }

    setLoadingEmails(true);
    try {
      // Clear the existing timeout immediately
      if (misclassificationTimerRef.current) {
        clearTimeout(misclassificationTimerRef.current);
        misclassificationTimerRef.current = null;
      }
      setUndoToastVisible(false); // Hide toast immediately

      const result = await undoMisclassificationService(lastMisclassifiedEmail); // Send undo data
      if (result.success) {
        showNotification("Misclassification undone!", "success");
        setLastMisclassifiedEmail(null); // Clear undo state
        await fetchStoredEmails(); // Refresh emails after undo
      } else {
        showNotification(`Failed to undo misclassification: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Intrackt: Error undoing misclassification:", error);
      showNotification("Error undoing misclassification.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [lastMisclassifiedEmail, fetchStoredEmails, userId, userEmail]); // Added userId and userEmail to dependencies

  const handleSendEmailReply = useCallback(async (threadId, recipient, subject, body) => {
    setLoadingEmails(true);
    try {
      const result = await sendEmailReplyService(threadId, recipient, subject, body, userEmail, userId);
      if (result.success) {
        showNotification("Email reply sent successfully!", "success");
        // Optionally, mark the email as read or update its status if needed
        // await markEmailsAsReadService(email.category, userId); // Example
        await fetchStoredEmails(); // Refresh emails after sending reply
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

  const handleArchiveEmail = useCallback(async (threadId) => {
    setLoadingEmails(true);
    try {
      const result = await archiveEmailService(threadId, userEmail);
      if (result.success) {
        showNotification("Email archived!", "success");
        await fetchStoredEmails(); // Refresh emails after archiving
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
  useEffect(() => {
    if (userEmail && userId) {
      fetchStoredEmails();
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
    unreadCounts,
  };
}

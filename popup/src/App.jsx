/**
 * @file popup/src/App.jsx
 * @description The main React application component.
 * It manages global state, authentication, and orchestrates the rendering
 * of different views (Dashboard, Email List, Email Preview).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/SideBar';
import Dashboard from './components/DashBoard';
import EmailList from './components/EmailList';
import EmailPreview from './components/EmailPreview';
import LoadingOverlay from './components/LoadingOverlay';
import { Notification, showNotification } from './components/Notification';
import QuotaBanner from './components/QuotaBanner';
import Pagination from './components/Pagination';
import Modals from './components/Modals';
import { SubscriptionManager } from './components/SubscriptionManager';

import { useAuth } from './hooks/useAuth';
import { useEmails } from './hooks/useEmails';
import { useFollowUps } from './hooks/useFollowUps';
import { countUniqueThreads } from './utils/grouping';

import { CONFIG } from './utils/constants';
import { Crown, Briefcase } from 'lucide-react';

// Small app-scoped logger to centralize popup logs and make them easy to silence
const appLogger = {
  info: (...args) => { try { console.log('[app][info]', ...args); } catch (_) {} },
  warn: (...args) => { try { console.warn('[app][warn]', ...args); } catch (_) {} },
  error: (...args) => { try { console.error('[app][error]', ...args); } catch (_) {} }
};

function App() {
  // Default to dashboard; a stored preference may override after auth is ready
  const [selectedCategory, setSelectedCategory] = useState('dashboard');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isMisclassificationModalOpen, setIsMisclassificationModalOpen] = useState(false);
  const [emailToMisclassify, setEmailToMisclassify] = useState(null);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isSubscriptionManagerOpen, setIsSubscriptionManagerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryBeforePreview, setCategoryBeforePreview] = useState('dashboard');

  // Callback to handle payment status changes (for auto-closing premium modal)
  const handlePaymentStatusChange = useCallback((newPlan, previousPlan) => {
    if (previousPlan === 'free' && newPlan === 'premium') {
      appLogger.info('Auto-closing premium modal after successful payment upgrade');
      setIsPremiumModalOpen(false);
    }
  }, []);

  const {
    userEmail,
    userName,
    userPlan,
    userId,
    isLoggedIn,
    isAuthReady,
    loginGoogleOAuth,
    logout,
    fetchUserPlan,
    fetchQuotaData,
    quotaData,
    loadingAuth,
    reloadUserState
  } = useAuth(handlePaymentStatusChange);
  const {
    categorizedEmails,
    fetchStoredEmails,
    fetchNewEmails,
    isFilteredView,
    filteredEmails,
    appliedFilters,
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
    loadingEmails,
    markingAllAsRead
  } = useEmails(userEmail, userId, CONFIG);

  const {
    followUpSuggestions,
    loadFollowUpSuggestions,
    loadingSuggestions,
    markFollowedUp,
    updateRespondedState,
  } = useFollowUps(userEmail, userId, userPlan);

  const isLoadingApp = loadingAuth || initialLoading || loadingSuggestions;

 // Load last selected category from storage once auth is ready
 useEffect(() => {
    const restoreSelectedCategory = async () => {
      try {
        const { intracktSelectedCategory } = await chrome.storage?.local?.get('intracktSelectedCategory') || {};
        if (intracktSelectedCategory) {
          setSelectedCategory(intracktSelectedCategory);
        }
      } catch (e) {
        // Non-fatal: storage may be unavailable in some contexts
      }
    };
    if (isAuthReady) restoreSelectedCategory();
  }, [isAuthReady]);

  // Expose reloadUserState globally for immediate UI refresh after payments
  useEffect(() => {
    window.reloadUserState = reloadUserState;
    return () => {
      delete window.reloadUserState;
    };
  }, [reloadUserState]);

 useEffect(() => {
    const initialDataFetch = async () => {
    if (isAuthReady && userEmail && userId) {
    appLogger.info("Auth ready, initiating single authoritative data fetch.");
        try {
    await fetchStoredEmails();
    // Avoid double-triggering sync here; background starts sync on auth state change
          fetchQuotaData();
          loadFollowUpSuggestions();
        } catch (error) {
          showNotification("Failed to load initial data.", "error");
        }
      } else {
        appLogger.info("Skipping initial data fetch. Auth not ready or user info missing.", { isAuthReady, userEmail, userId });
      }
    };
    initialDataFetch();
  }, [isAuthReady, userEmail, userId, fetchStoredEmails, fetchQuotaData, loadFollowUpSuggestions]);

  // Debug: log selectedCategory and unreadCounts when they change to diagnose Mark-All-Ready visibility
  useEffect(() => {
    try {
      appLogger.info('Debug: selectedCategory', selectedCategory, 'unreadCounts for category:', (unreadCounts && typeof unreadCounts[selectedCategory] !== 'undefined') ? unreadCounts[selectedCategory] : null);
    } catch (e) {
      appLogger.error('Debug log failure', e);
    }
  }, [selectedCategory, unreadCounts]);

  useEffect(() => {
    const handleBackgroundMessage = (message) => {
      if ((message.type === 'EMAILS_SYNCED' || message.type === 'NEW_EMAILS_UPDATED') && message.userEmail === userEmail) {
        // Only run heavier refreshes once the background sync finishes.
        if (!message.syncInProgress) {
          fetchStoredEmails();
          fetchQuotaData();
          loadFollowUpSuggestions();
        }
      }

    };
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    return () => chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
  }, [userEmail, userId, fetchStoredEmails, fetchQuotaData, loadFollowUpSuggestions]);

  // Add this useEffect to listen for the custom FORCE_LOGOUT message
  useEffect(() => {
    const handleForceLogout = (message) => {
      if (message.type === 'FORCE_LOGOUT') {
        showNotification(message.reason || "You have been logged out for security reasons.", "error");

        // Note: We don't need to call logout() here. The background script
        // already called signOut(), which will trigger the onAuthStateChanged
        // listener to update the UI and clear local data.
      }
    };

    chrome.runtime.onMessage.addListener(handleForceLogout);
    return () => chrome.runtime.onMessage.removeListener(handleForceLogout);
  }, []);

  // Listen for subscription updates from background script
  useEffect(() => {
    const handleSubscriptionUpdate = (message) => {
      if (message.type === 'SUBSCRIPTION_UPDATED' && message.subscription) {
  appLogger.info('Subscription status updated:', message.subscription);
        
        // Update user plan state
        setUserPlan(message.subscription.plan);
        
        // Show notification about subscription change
        if (message.subscription.plan === 'premium') {
          showNotification('Subscription activated! Premium features unlocked.', 'success');
        } else if (message.subscription.cancel_at_period_end) {
          showNotification('Subscription will cancel at the end of the billing period.', 'info');
        }
        
        // Refresh user state
        reloadUserState();
      }
    };

    chrome.runtime.onMessage.addListener(handleSubscriptionUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleSubscriptionUpdate);
  }, [showNotification, reloadUserState]);

  const handleRefresh = useCallback(async () => {
    if (!userEmail || !userId) return;
    try {
      await fetchNewEmails(true);
      showNotification("Emails refreshed!", "success");
      await fetchStoredEmails();
      await fetchQuotaData();
      await loadFollowUpSuggestions();
    } catch (error) {
      showNotification(`Failed to refresh emails: ${error.message}`, "error");
    }
  }, [userEmail, userId, fetchNewEmails, fetchStoredEmails, fetchQuotaData, loadFollowUpSuggestions]);

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
    setSelectedEmail(null);
    setCurrentPage(1);
    // Persist preference
    try {
      chrome.storage?.local?.set({ intracktSelectedCategory: category });
    } catch (e) {
      // ignore
    }
  }, []);

  const handleEmailSelect = useCallback((email) => {
    if (email) {
      // Mark as read if it's not already
      if (!email.is_read) {
        markEmailAsRead(email.id);
      }
      // Build full thread for preview
      const threadId = email.thread_id || email.threadId || email.thread;
      const allEmails = [
        ...(categorizedEmails.applied || []),
        ...(categorizedEmails.interviewed || []),
        ...(categorizedEmails.offers || []),
        ...(categorizedEmails.rejected || []),
        ...(categorizedEmails.irrelevant || []),
      ];
      const threadMessages = allEmails
        .filter(e => (e.thread_id || e.threadId || e.thread) === threadId)
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // newest -> oldest

      // Remember the current category before showing the preview
      setCategoryBeforePreview(selectedCategory);
      setSelectedEmail({ ...email, threadMessages });
      setSelectedCategory('emailPreview');
    }
  }, [selectedCategory, markEmailAsRead, categorizedEmails]);

  const handleBackToCategory = useCallback(() => {
    setSelectedEmail(null);
    setSelectedCategory(categoryBeforePreview);
  }, [categoryBeforePreview]);

  const openMisclassificationModal = useCallback((email) => {
    setEmailToMisclassify(email);
    setIsMisclassificationModalOpen(true);
  }, []);

  const closeMisclassificationModal = useCallback(() => {
    setIsMisclassificationModalOpen(false);
    setEmailToMisclassify(null);
  }, []);

  const handleMisclassificationSubmit = useCallback(async (emailData, newCategory) => {
    closeMisclassificationModal();
    await handleReportMisclassification(emailData, newCategory);
    await fetchStoredEmails();
    await loadFollowUpSuggestions();
  }, [handleReportMisclassification, closeMisclassificationModal, fetchStoredEmails, userEmail, userId, loadFollowUpSuggestions]);

  const handleReplySubmit = useCallback(async (threadId, recipient, subject, body) => {
    await handleSendEmailReply(threadId, recipient, subject, body);
    await fetchStoredEmails();
    await loadFollowUpSuggestions();
  }, [handleSendEmailReply, fetchStoredEmails, userEmail, userId, loadFollowUpSuggestions]);

  const handleArchive = useCallback(async (threadId) => {
    await handleArchiveEmail(threadId);
    await fetchStoredEmails();
    await loadFollowUpSuggestions();
    setSelectedEmail(null);
  }, [handleArchiveEmail, fetchStoredEmails, userEmail, userId, loadFollowUpSuggestions]);

  const openPremiumModal = useCallback(() => setIsPremiumModalOpen(true), []);
  const closePremiumModal = useCallback(() => setIsPremiumModalOpen(false), []);

  const handleManageSubscription = useCallback(() => {
    setIsSubscriptionManagerOpen(true);
  }, []);

  const closeSubscriptionManager = useCallback(() => {
    setIsSubscriptionManagerOpen(false);
  }, []);

  const renderMainContent = () => {
    switch (selectedCategory) {
      case 'dashboard':
        return <Dashboard {...{ categorizedEmails, onCategorySelect: handleCategoryChange, onEmailSelect: handleEmailSelect, openMisclassificationModal, followUpSuggestions, loadingSuggestions, markFollowedUp, updateRespondedState, userPlan, openPremiumModal, quotaData }} />;
      case 'emailPreview':
  return <EmailPreview {...{ email: selectedEmail, onBack: handleBackToCategory, onReply: handleReplySubmit, onArchive: handleArchive, onOpenMisclassificationModal: openMisclassificationModal, userPlan, openPremiumModal, loadingEmails }} />;
      default:
        const emailsForCategory = categorizedEmails[selectedCategory] || [];
        const paginatedEmails = emailsForCategory.slice((currentPage - 1) * CONFIG.PAGINATION.PAGE_SIZE, currentPage * CONFIG.PAGINATION.PAGE_SIZE);
        const totalThreadsInCurrentCategory = countUniqueThreads(emailsForCategory);
        const totalPages = Math.ceil(emailsForCategory.length / CONFIG.PAGINATION.PAGE_SIZE);
        return (
          <>
            <EmailList
              emails={paginatedEmails}
              category={selectedCategory}
              onEmailSelect={handleEmailSelect}
              onOpenMisclassificationModal={openMisclassificationModal}
              isFilteredView={isFilteredView}
              filteredEmails={filteredEmails}
              appliedFilters={appliedFilters}
              totalEmails={totalThreadsInCurrentCategory}
              onMarkAllAsRead={markEmailsAsReadForCategory}
              isMarkingAllAsRead={markingAllAsRead}
              hasUnreadCategory={Boolean(unreadCounts && unreadCounts[selectedCategory])}
            />
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalEmails={emailsForCategory.length}
                pageSize={CONFIG.PAGINATION.PAGE_SIZE}
              />
            )}
          </>
        );
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 shadow-md">
              <Briefcase className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
            <p className="text-gray-600 mt-2">Manage your job applications with ease</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-bold">Welcome back</h2>
              <p className="text-gray-600">Sign in to your account to continue</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button onClick={loginGoogleOAuth} className="w-full bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center space-x-2">
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] max-h-[600px] overflow-hidden bg-gray-100 dark:bg-zinc-900 text-gray-900 dark:text-white font-inter">
      {isLoadingApp && <LoadingOverlay message="Loading data..." />}
      <Notification />

  <div className="w-64 h-[600px] flex flex-col border-r border-gray-200 dark:border-zinc-700">
        <Sidebar
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          unreadCounts={unreadCounts}
          categorizedEmails={categorizedEmails}
          onLogout={logout}
          onRefresh={handleRefresh}
          isLoadingEmails={isSyncing}
          userPlan={userPlan}
          quotaData={quotaData}
          onUpgradeClick={openPremiumModal}
          onManageSubscription={handleManageSubscription}
        />
      </div>

  <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
          <h1 id="welcome-header" className="text-xl font-semibold text-gray-900 dark:text-white truncate">
            {`Welcome, ${userName || userEmail}!`}
          </h1>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {userPlan === 'free' && (
              <button
                onClick={openPremiumModal}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg rounded-full px-6 py-3 transition-all duration-300 flex items-center justify-center"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Premium
              </button>
            )}
          </div>
        </header>

        {quotaData && <QuotaBanner quota={quotaData} userPlan={userPlan} onUpgradeClick={openPremiumModal} />}

  <div className="flex-1">
          <div className="p-6">
            {isSubscriptionManagerOpen ? (
              <SubscriptionManager 
                onBack={closeSubscriptionManager}
                userPlan={userPlan}
              />
            ) : (
              renderMainContent()
            )}
          </div>
        </div>
      </main>

      <Modals
        isPremiumModalOpen={isPremiumModalOpen}
        onClosePremiumModal={closePremiumModal}
        isMisclassificationModalOpen={isMisclassificationModalOpen}
        onCloseMisclassificationModal={closeMisclassificationModal}
        selectedEmailForMisclassification={emailToMisclassify}
        onConfirmMisclassification={handleMisclassificationSubmit}
        lastMisclassifiedEmail={lastMisclassifiedEmail}
        undoMisclassification={undoMisclassification}
        undoToastVisible={undoToastVisible}
        setUndoToastVisible={setUndoToastVisible}
        onSubscribePremium={() => {
          // The modal will handle the subscription process directly
          console.log('Premium modal will handle subscription...');
        }}
      />
    </div>
  );
}

export default App;

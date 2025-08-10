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

import { useAuth } from './hooks/useAuth'; 
import { useEmails } from './hooks/useEmails';
import { useFollowUps } from './hooks/useFollowUps';

import { CONFIG } from './utils/constants';
import { Crown, Briefcase } from 'lucide-react';

function App() {
  const [selectedCategory, setSelectedCategory] = useState('dashboard');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isMisclassificationModalOpen, setIsMisclassificationModalOpen] = useState(false);
  const [emailToMisclassify, setEmailToMisclassify] = useState(null);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryBeforePreview, setCategoryBeforePreview] = useState('dashboard');

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
    loadingAuth
  } = useAuth();
  const {
    categorizedEmails,
    fetchStoredEmails,
    fetchNewEmails,
    loadingEmails,
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
    markEmailAsRead
  } = useEmails(userEmail, userId, CONFIG);

  const {
    followUpSuggestions,
    loadFollowUpSuggestions,
    loadingSuggestions,
    markFollowedUp,
    updateRespondedState,
  } = useFollowUps(userEmail, userId, userPlan);

  const isLoadingApp = loadingAuth || loadingEmails || loadingSuggestions;

  useEffect(() => {
    const initialDataFetch = async () => {
      if (isAuthReady && userEmail && userId) {
        try {
          await fetchStoredEmails();
          await fetchNewEmails(false);
          await fetchQuotaData();
          await loadFollowUpSuggestions();
        } catch (error) {
          showNotification("Failed to load initial data.", "error");
        }
      } else {
        console.log("App.jsx: Skipping initial data fetch. Auth not ready or user info missing.", { isAuthReady, userEmail, userId });
      }
    };
    initialDataFetch();
  }, [isAuthReady, userEmail, userId, fetchStoredEmails, fetchNewEmails, fetchQuotaData, loadFollowUpSuggestions]);

  useEffect(() => {
    const handleBackgroundMessage = (message) => {
      if ((message.type === 'EMAILS_SYNCED' || message.type === 'NEW_EMAILS_UPDATED') && message.userEmail === userEmail) {
        fetchStoredEmails();
        fetchQuotaData();
        loadFollowUpSuggestions();
      }

    };
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    return () => chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
  }, [userEmail, userId, fetchStoredEmails, fetchQuotaData, loadFollowUpSuggestions]);

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
  }, []);

  const handleEmailSelect = useCallback((email) => {
    if (email) {
      // Mark as read if it's not already
      if (!email.is_read) {
        markEmailAsRead(email.id);
      }
      // Remember the current category before showing the preview
      setCategoryBeforePreview(selectedCategory);
      setSelectedEmail(email);
      setSelectedCategory('emailPreview');
    }
  }, [selectedCategory, markEmailAsRead]);

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

  const renderMainContent = () => {
    switch (selectedCategory) {
      case 'dashboard':
        return <Dashboard {...{ categorizedEmails, onCategorySelect: handleCategoryChange, onEmailSelect: handleEmailSelect, openMisclassificationModal, followUpSuggestions, loadingSuggestions, markFollowedUp, updateRespondedState, userPlan, openPremiumModal, quotaData }} />;
      case 'emailPreview':
        return <EmailPreview {...{ email: selectedEmail, onBack: handleBackToCategory, onReply: handleReplySubmit, onArchive: handleArchive, onOpenMisclassificationModal: openMisclassificationModal, userPlan, openPremiumModal }} />;
      default:
        const emailsForCategory = categorizedEmails[selectedCategory] || [];
        const paginatedEmails = emailsForCategory.slice((currentPage - 1) * CONFIG.PAGINATION.PAGE_SIZE, currentPage * CONFIG.PAGINATION.PAGE_SIZE);
        const totalEmailsInCurrentCategory = emailsForCategory.length;
        const totalPages = Math.ceil(totalEmailsInCurrentCategory / CONFIG.PAGINATION.PAGE_SIZE);
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
              totalEmails={totalEmailsInCurrentCategory}
            />
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalEmails={totalEmailsInCurrentCategory}
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
    <div className="flex h-screen bg-gray-100 dark:bg-zinc-900 text-gray-900 dark:text-white font-inter">
      {isLoadingApp && <LoadingOverlay message="Loading data..." />}
      <Notification />

      <div className="w-64 h-full flex flex-col border-r border-gray-200 dark:border-zinc-700">
        <Sidebar
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          unreadCounts={unreadCounts}
          categorizedEmails={categorizedEmails}
          onLogout={logout}
          onRefresh={handleRefresh}
          isLoadingEmails={loadingEmails || !isAuthReady || !isLoggedIn}
          userPlan={userPlan}
          quotaData={quotaData}
          onUpgradeClick={openPremiumModal}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
          <h1 id="welcome-header" className="text-xl font-semibold text-gray-900 dark:text-white truncate">
            Welcome, {userName || userEmail}!
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

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {renderMainContent()}
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
        onSubscribePremium={async () => {
          if (!userEmail) {
            showNotification("No user logged in to upgrade plan.", "error");
            setIsPremiumModalOpen(false);
            return;
          }
          showNotification("Upgrading to Premium...", "info");
          setIsPremiumModalOpen(false);
          try {
            const response = await chrome.runtime.sendMessage({
              type: "UPDATE_USER_PLAN",
              userEmail: userEmail,
              newPlan: "premium"
            });
            if (response.success) {
              showNotification("🎉 Successfully upgraded to Premium! Please refresh to see changes.", "success");
              await fetchUserPlan(userEmail);
              await fetchQuotaData();
            } else {
              showNotification(`Failed to upgrade: ${response.error}`, "error");
              setIsPremiumModalOpen(true);
            }
          } catch (error) {
            showNotification(`Failed to upgrade: ${error.message || "Network error"}`, "error");
            setIsPremiumModalOpen(true);
          }
        }}
      />
    </div>
  );
}

export default App;

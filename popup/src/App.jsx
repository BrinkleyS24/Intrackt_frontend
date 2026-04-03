/**
 * @file popup/src/App.jsx
 * @description Main popup application shell for the extension.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import EmailList from './components/EmailList';
import EmailPreview from './components/EmailPreview';
import LoadingOverlay from './components/LoadingOverlay';
import { Notification, showNotification } from './components/Notification';
import Modals from './components/Modals';

import { useAuth } from './hooks/useAuth';
import { useEmails } from './hooks/useEmails';
import { useEmailQuota } from './hooks/useEmailQuota';
import { getApplicationKey, groupEmailsByThread } from './utils/grouping';
import { getCategoryTitle } from './utils/uiHelpers';
import { getPremiumDashboardUrl } from './utils/runtimeConfig';

import { CONFIG } from './utils/constants';
import { ArrowLeft, Briefcase, CalendarDays, LogOut, Mail, RefreshCw, Search, X } from 'lucide-react';

const LONG_SYNC_WARNING_MS = 10 * 60 * 1000;

const flattenCategorized = (categorized) => [
  ...(categorized?.applied || []),
  ...(categorized?.interviewed || []),
  ...(categorized?.offers || []),
  ...(categorized?.rejected || []),
  ...(categorized?.irrelevant || []),
];

const SELECTED_CATEGORY_STORAGE_KEY = 'applendiumSelectedCategory';
const LEGACY_SELECTED_CATEGORY_STORAGE_KEYS = [
  ['morrow', 'foldSelectedCategory'].join(''),
  ['app', 'mailiaSelectedCategory'].join(''),
  ['in', 'tracktSelectedCategory'].join(''),
];

const normalizeStoredCategory = (category) => {
  const normalized = (category || '').toString().trim().toLowerCase();
  if (!normalized || normalized === 'dashboard' || normalized === 'home') {
    return 'all';
  }
  return normalized;
};

const MAIN_TABS = [
  { id: 'all', label: 'All', activeClassName: 'bg-accent text-accent-foreground border-transparent' },
  { id: 'applied', label: 'Applied', activeClassName: 'bg-success text-success-foreground border-transparent' },
  { id: 'interviewed', label: 'Interviews', activeClassName: 'bg-warning text-warning-foreground border-transparent' },
  { id: 'offers', label: 'Offers', activeClassName: 'bg-success text-success-foreground border-transparent' },
  { id: 'rejected', label: 'Rejected', activeClassName: 'bg-destructive text-destructive-foreground border-transparent' },
];

const ListSearchBar = React.memo(function ListSearchBar({ value, onChange, placeholder }) {
  return (
    <div className="mt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-10 text-sm text-foreground shadow-sm outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            title="Clear search"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});

const appLogger = {
  info: () => {},
  warn: () => {},
  error: (...args) => {
    try {
      console.error('[app][error]', ...args);
    } catch (_) {}
  },
};

function getExtensionVersionLabel() {
  try {
    const manifest = globalThis?.chrome?.runtime?.getManifest?.() || {};
    return manifest.version ? `v${manifest.version}` : '';
  } catch (_) {
    return '';
  }
}

function App() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isMisclassificationModalOpen, setIsMisclassificationModalOpen] = useState(false);
  const [emailToMisclassify, setEmailToMisclassify] = useState(null);
  const [categoryBeforePreview, setCategoryBeforePreview] = useState('all');
  const [allApplicationsFilter, setAllApplicationsFilter] = useState('all');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [stableAllViewSummary, setStableAllViewSummary] = useState(null);
  const hasTriggeredLoginSyncRef = useRef(false);

  const {
    userPlan,
    userEmail,
    userId,
    isLoggedIn,
    isAuthReady,
    loginGoogleOAuth,
    logout,
    fetchQuotaData,
    quotaData,
    syncStatus,
    loadingAuth,
  } = useAuth();

  const {
    categorizedEmails,
    fetchStoredEmails,
    fetchNewEmails,
    handleReportMisclassification,
    handleSendEmailReply,
    handleArchiveEmail,
    handleUpdateCompanyName,
    handleUpdatePosition,
    undoMisclassification,
    undoToastVisible,
    setUndoToastVisible,
    markEmailsAsReadForCategory,
    markEmailAsRead,
    initialLoading,
    isSyncing,
    syncStuck,
    loadingEmails,
    markingAllAsRead,
  } = useEmails(userEmail, userId, CONFIG);

  const isLoadingApp = loadingAuth && !isLoggedIn;
  const isLoginPending = loadingAuth && isAuthReady && !isLoggedIn;
  const hasCachedEmails = useMemo(() => flattenCategorized(categorizedEmails).length > 0, [categorizedEmails]);
  const showInitialEmailLoading = isLoggedIn && initialLoading && !hasCachedEmails;
  const { quota, getWarningMessage, percentage } = useEmailQuota(quotaData, userPlan);
  const isLongRunningSync = useMemo(() => {
    if (!syncStatus?.inProgress || !syncStatus?.startedAt) return false;
    const startedAt = new Date(syncStatus.startedAt);
    if (Number.isNaN(startedAt.getTime())) return false;
    return (Date.now() - startedAt.getTime()) >= LONG_SYNC_WARNING_MS;
  }, [syncStatus?.inProgress, syncStatus?.startedAt]);
  const isSyncStuck = syncStuck || isLongRunningSync;
  const isSyncActive = !isSyncStuck && (isSyncing || Boolean(syncStatus?.inProgress));
  const extensionVersionLabel = useMemo(() => getExtensionVersionLabel(), []);
  const syncStatusLabel = useMemo(() => {
    if (isSyncStuck) return 'Sync may be stuck';
    if (isSyncActive) return 'Syncing in background...';

    const rawLastSyncAt = syncStatus?.lastSyncAt || syncStatus?.lastCompletedAt;
    if (!rawLastSyncAt) return 'No sync in progress';

    const lastSyncAt = new Date(rawLastSyncAt);
    if (Number.isNaN(lastSyncAt.getTime())) return 'No sync in progress';

    const now = Date.now();
    const diffMs = now - lastSyncAt.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) return 'Last synced just now';
    if (diffMinutes < 60) return `Last synced ${diffMinutes}m ago`;

    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return `Last synced ${formatter.format(lastSyncAt)}`;
  }, [isSyncActive, isSyncStuck, syncStatus?.lastSyncAt, syncStatus?.lastCompletedAt]);

  useEffect(() => {
    if (!selectedEmail?.id) return;
    if (selectedCategory !== 'emailPreview') return;

    const all = flattenCategorized(categorizedEmails);
    const updated = all.find((email) => email.id === selectedEmail.id);
    if (!updated) {
      setSelectedEmail(null);
      setSelectedCategory(categoryBeforePreview || 'all');
      return;
    }

    setSelectedEmail((prev) => {
      if (!prev) return prev;
      return { ...updated, threadMessages: prev.threadMessages };
    });
  }, [categorizedEmails, selectedEmail?.id, selectedCategory, categoryBeforePreview]);

  useEffect(() => {
    const restoreSelectedCategory = async () => {
      try {
        const storageKeys = [
          SELECTED_CATEGORY_STORAGE_KEY,
          ...LEGACY_SELECTED_CATEGORY_STORAGE_KEYS,
        ];
        const storage = await chrome.storage?.local?.get(storageKeys) || {};
        const selectedCat = [
          storage[SELECTED_CATEGORY_STORAGE_KEY],
          ...LEGACY_SELECTED_CATEGORY_STORAGE_KEYS.map((key) => storage[key]),
        ].find(Boolean);

        if (selectedCat) {
          const normalizedSelectedCategory = normalizeStoredCategory(selectedCat);
          setSelectedCategory(normalizedSelectedCategory);

          if (!storage[SELECTED_CATEGORY_STORAGE_KEY]) {
            await chrome.storage.local.set({ [SELECTED_CATEGORY_STORAGE_KEY]: normalizedSelectedCategory });
            await chrome.storage.local.remove(LEGACY_SELECTED_CATEGORY_STORAGE_KEYS);
          }
        }
      } catch (_) {
        // Non-fatal: storage can be unavailable in some contexts.
      }
    };

    if (isAuthReady) restoreSelectedCategory();
  }, [isAuthReady]);

  useEffect(() => {
    const initialDataFetch = async () => {
      if (isAuthReady && userEmail && userId) {
        appLogger.info('Auth ready, initiating authoritative data fetch.');
        try {
          await fetchStoredEmails();
          fetchQuotaData();

          if (!hasTriggeredLoginSyncRef.current) {
            try {
              const cached = await chrome.storage.local.get([
                'appliedEmails',
                'interviewedEmails',
                'offersEmails',
                'rejectedEmails',
                'irrelevantEmails',
              ]);
              const cachedCount =
                (cached.appliedEmails || []).length +
                (cached.interviewedEmails || []).length +
                (cached.offersEmails || []).length +
                (cached.rejectedEmails || []).length +
                (cached.irrelevantEmails || []).length;

              if (cachedCount === 0) {
                hasTriggeredLoginSyncRef.current = true;
                fetchNewEmails(false).catch(() => {});
              }
            } catch (_) {
              hasTriggeredLoginSyncRef.current = true;
              fetchNewEmails(false).catch(() => {});
            }
          }
        } catch (_) {
          showNotification('Failed to load initial data.', 'error');
        }
      } else {
        appLogger.info('Skipping initial data fetch.', { isAuthReady, userEmail, userId });
      }
    };

    initialDataFetch();
  }, [isAuthReady, userEmail, userId, fetchStoredEmails, fetchQuotaData, fetchNewEmails]);

  useEffect(() => {
    const handleBackgroundMessage = (message) => {
      if (message.type !== 'EMAILS_SYNCED' && message.type !== 'NEW_EMAILS_UPDATED') return;
      if (message.userEmail && message.userEmail !== userEmail) return;
      if (!message.syncInProgress) {
        fetchStoredEmails();
        fetchQuotaData();
      }
    };

    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    return () => chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
  }, [userEmail, fetchStoredEmails, fetchQuotaData]);

  useEffect(() => {
    const handleForceLogout = (message) => {
      if (message.type === 'FORCE_LOGOUT') {
        showNotification(message.reason || 'You have been logged out for security reasons.', 'error');
      }
    };

    chrome.runtime.onMessage.addListener(handleForceLogout);
    return () => chrome.runtime.onMessage.removeListener(handleForceLogout);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!userEmail || !userId) return;
    try {
      await fetchNewEmails(true);
      showNotification('Emails refreshed!', 'success');
      await fetchStoredEmails();
      await fetchQuotaData();
    } catch (error) {
      showNotification(`Failed to refresh emails: ${error.message}`, 'error');
    }
  }, [userEmail, userId, fetchNewEmails, fetchStoredEmails, fetchQuotaData]);

  const handleCategoryChange = useCallback((category) => {
    const normalizedCategory = normalizeStoredCategory(category);
    setSelectedCategory(normalizedCategory);
    setSelectedEmail(null);
    setListSearchQuery('');
    setDateRange('all');
    setShowDateFilter(false);
    if (normalizedCategory === 'all') {
      setAllApplicationsFilter('all');
    }
    try {
      chrome.storage?.local?.set({ [SELECTED_CATEGORY_STORAGE_KEY]: normalizedCategory });
    } catch (_) {}
  }, []);

  const normalizedListSearchQuery = useMemo(
    () => (listSearchQuery || '').toString().trim().toLowerCase(),
    [listSearchQuery]
  );

  const allRelevantEmails = useMemo(() => [
    ...(categorizedEmails.applied || []),
    ...(categorizedEmails.interviewed || []),
    ...(categorizedEmails.offers || []),
    ...(categorizedEmails.rejected || []),
  ], [categorizedEmails]);

  const filterConversationGroups = useCallback((groups, query, selectedDateRange = 'all') => {
    return (groups || []).filter((group) => {
      const latest = group?.latestEmail || {};
      const haystack = [
        group?.subject,
        group?.from,
        latest?.from,
        latest?.sender,
        latest?.company_name,
        latest?.position,
        latest?.body,
        latest?.html_body,
        group?.preview,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase())
        .join(' ');

      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (!selectedDateRange || selectedDateRange === 'all') return true;

      const dateValue = new Date(group?.date || latest?.date || 0);
      if (Number.isNaN(dateValue.getTime())) return false;
      const daysAgo = (Date.now() - dateValue.getTime()) / (1000 * 60 * 60 * 24);

      if (selectedDateRange === '7d') return daysAgo <= 7;
      if (selectedDateRange === '30d') return daysAgo <= 30;
      if (selectedDateRange === '90d') return daysAgo <= 90;
      return true;
    });
  }, []);

  const allViewConversationGroups = useMemo(
    () => groupEmailsByThread(allRelevantEmails),
    [allRelevantEmails]
  );

  const allViewFilteredGroups = useMemo(
    () => filterConversationGroups(allViewConversationGroups, normalizedListSearchQuery, dateRange),
    [allViewConversationGroups, dateRange, filterConversationGroups, normalizedListSearchQuery]
  );

  const allViewCategoryGroups = useMemo(() => ({
    applied: filterConversationGroups(groupEmailsByThread(categorizedEmails.applied || []), normalizedListSearchQuery, dateRange),
    interviewed: filterConversationGroups(groupEmailsByThread(categorizedEmails.interviewed || []), normalizedListSearchQuery, dateRange),
    offers: filterConversationGroups(groupEmailsByThread(categorizedEmails.offers || []), normalizedListSearchQuery, dateRange),
    rejected: filterConversationGroups(groupEmailsByThread(categorizedEmails.rejected || []), normalizedListSearchQuery, dateRange),
  }), [categorizedEmails, dateRange, filterConversationGroups, normalizedListSearchQuery]);

  const allViewLiveSummary = useMemo(
    () => ({
      counts: {
        applied: allViewCategoryGroups.applied.length,
        interviewed: allViewCategoryGroups.interviewed.length,
        offers: allViewCategoryGroups.offers.length,
        rejected: allViewCategoryGroups.rejected.length,
      },
      total: allViewFilteredGroups.length,
    }),
    [allViewCategoryGroups, allViewFilteredGroups.length]
  );

  const shouldFreezeHeadlineSummary =
    isSyncActive
    && !normalizedListSearchQuery
    && dateRange === 'all';

  useEffect(() => {
    if (!isSyncActive && !normalizedListSearchQuery && dateRange === 'all') {
      setStableAllViewSummary(allViewLiveSummary);
    }
  }, [allViewLiveSummary, dateRange, isSyncActive, normalizedListSearchQuery]);

  const allViewHeadlineSummary = useMemo(() => {
    if (shouldFreezeHeadlineSummary && stableAllViewSummary) {
      return stableAllViewSummary;
    }
    return allViewLiveSummary;
  }, [allViewLiveSummary, shouldFreezeHeadlineSummary, stableAllViewSummary]);

  const handleEmailSelect = useCallback((email, group = null) => {
    if (!email) return;

    if (!email.is_read) {
      markEmailAsRead(email.id);
    }

    let threadMessages;
    if (group?.emails?.length) {
      const groupEmails = [...group.emails];
      const selectedKey = getApplicationKey(email);
      let scoped = groupEmails;

      if (selectedKey && selectedKey !== 'unknown') {
        const matches = groupEmails.filter((item) => getApplicationKey(item) === selectedKey);
        if (matches.length > 0) scoped = matches;
      } else {
        const threadId = email.thread_id || email.threadId || email.thread;
        if (threadId) {
          const matches = groupEmails.filter((item) => (item.thread_id || item.threadId || item.thread) === threadId);
          if (matches.length > 0) scoped = matches;
        }
      }

      threadMessages = scoped.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      const threadId = email.thread_id || email.threadId || email.thread;
      const allEmails = flattenCategorized(categorizedEmails);
      threadMessages = allEmails
        .filter((item) => (item.thread_id || item.threadId || item.thread) === threadId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    setCategoryBeforePreview(selectedCategory);
    setSelectedEmail({ ...email, threadMessages });
    setSelectedCategory('emailPreview');
  }, [categorizedEmails, markEmailAsRead, selectedCategory]);

  const handleBackToCategory = useCallback(() => {
    setSelectedEmail(null);
    setSelectedCategory(categoryBeforePreview || 'all');
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

    if ((newCategory || '').toString().trim().toLowerCase() === 'irrelevant') {
      setSelectedEmail(null);
      setSelectedCategory(categoryBeforePreview || 'all');
    }
  }, [categoryBeforePreview, closeMisclassificationModal, handleReportMisclassification]);

  const handleReplySubmit = useCallback(async (threadId, recipient, subject, body) => {
    await handleSendEmailReply(threadId, recipient, subject, body);
    await fetchStoredEmails();
  }, [handleSendEmailReply, fetchStoredEmails]);

  const handleArchive = useCallback(async (threadId) => {
    await handleArchiveEmail(threadId);
    await fetchStoredEmails();
    setSelectedEmail(null);
  }, [handleArchiveEmail, fetchStoredEmails]);

  const openDashboard = useCallback(async () => {
    const rawUrl = await getPremiumDashboardUrl();

    if (!rawUrl) {
      showNotification(userPlan === 'premium' ? 'Dashboard URL is not configured yet.' : 'Upgrade URL is not configured yet.', 'info');
      return;
    }

    let baseUrl;
    try {
      baseUrl = new URL(rawUrl).origin;
    } catch {
      baseUrl = rawUrl.replace(/\/+$/, '');
    }

    const url = `${baseUrl}${userPlan === 'premium' ? '/dashboard' : '/upgrade'}`;

    try {
      chrome.tabs.create({ url });
    } catch (_) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [userPlan]);

  const countFilteredConversations = useCallback((categoryKey, options = {}) => {
    const { includeSearch = true, includeDate = true } = options;
    const emailsForCount =
      categoryKey === 'all'
        ? [
            ...(categorizedEmails.applied || []),
            ...(categorizedEmails.interviewed || []),
            ...(categorizedEmails.offers || []),
            ...(categorizedEmails.rejected || []),
          ]
        : categorizedEmails[categoryKey] || [];

    return filterConversationGroups(
      groupEmailsByThread(emailsForCount),
      includeSearch ? normalizedListSearchQuery : '',
      includeDate ? dateRange : 'all'
    ).length;
  }, [categorizedEmails, dateRange, filterConversationGroups, normalizedListSearchQuery]);

  const footerSummary = useMemo(() => {
    if (selectedCategory === 'all' || selectedCategory === 'home') {
      const activeView = allApplicationsFilter;
      const count =
        activeView === 'all'
          ? allViewHeadlineSummary.total
          : allViewHeadlineSummary.counts?.[activeView] || 0;

      if (activeView === 'applied') {
        return `${count} ${count === 1 ? 'application sent' : 'applications sent'}`;
      }
      if (activeView === 'interviewed') {
        return `${count} ${count === 1 ? 'interview scheduled' : 'interviews scheduled'}`;
      }
      if (activeView === 'offers') {
        return `${count} ${count === 1 ? 'offer received' : 'offers received'}`;
      }
      if (activeView === 'rejected') {
        return `${count} ${count === 1 ? 'rejection received' : 'rejections received'}`;
      }

      return `${count} ${count === 1 ? 'tracked application' : 'tracked applications'}`;
    }

    const activeView = (selectedCategory === 'all' || selectedCategory === 'home')
      ? allApplicationsFilter
      : selectedCategory;

    const count =
      selectedCategory === 'all' || selectedCategory === 'home'
        ? countFilteredConversations(activeView, { includeSearch: true, includeDate: true })
        : countFilteredConversations(activeView, { includeSearch: true, includeDate: false });

    if (activeView === 'applied') {
      return `${count} ${count === 1 ? 'application sent' : 'applications sent'}`;
    }
    if (activeView === 'interviewed') {
      return `${count} ${count === 1 ? 'interview scheduled' : 'interviews scheduled'}`;
    }
    if (activeView === 'offers') {
      return `${count} ${count === 1 ? 'offer received' : 'offers received'}`;
    }
    if (activeView === 'rejected') {
      return `${count} ${count === 1 ? 'rejection received' : 'rejections received'}`;
    }

    return `${count} ${count === 1 ? 'tracked application' : 'tracked applications'}`;
  }, [allApplicationsFilter, allViewHeadlineSummary, countFilteredConversations, selectedCategory]);

  const renderMainContent = () => {
    if (selectedCategory === 'emailPreview') {
      return (
        <EmailPreview
          email={selectedEmail}
          onBack={handleBackToCategory}
          onReply={handleReplySubmit}
          onArchive={handleArchive}
          onOpenMisclassificationModal={openMisclassificationModal}
          userPlan={userPlan}
          loadingEmails={loadingEmails}
          onUpdateCompanyName={handleUpdateCompanyName}
          onUpdatePosition={handleUpdatePosition}
          userEmail={userEmail}
        />
      );
    }

    if (selectedCategory === 'all' || selectedCategory === 'home') {
      const filteredConversations =
        allApplicationsFilter === 'all'
          ? allViewFilteredGroups
          : allViewCategoryGroups[allApplicationsFilter] || [];
      const totalConversations = filteredConversations.length;
      const allConversationEmails = filteredConversations.flatMap((conv) => conv.emails);
      const stats = allViewHeadlineSummary.counts;
      const trackedApplicationCount = allViewHeadlineSummary.total;

      return (
        <div className="flex h-full flex-col">
          <div className="space-y-3 px-3 py-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'applied', label: 'Applied', value: stats.applied, cardClass: 'bg-primary/10', textClass: 'text-primary' },
                { key: 'interviewed', label: 'Interviews', value: stats.interviewed, cardClass: 'bg-warning/15', textClass: 'text-warning' },
                { key: 'offers', label: 'Offers', value: stats.offers, cardClass: 'bg-success/10', textClass: 'text-success' },
                { key: 'rejected', label: 'Rejected', value: stats.rejected, cardClass: 'bg-destructive/10', textClass: 'text-destructive' },
              ].map((stat) => (
                <div key={stat.key} className={`${stat.cardClass} rounded-xl px-2 py-2 text-center`}>
                  <div className={`text-xl font-bold leading-none ${stat.textClass}`}>{stat.value}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <ListSearchBar
                value={listSearchQuery}
                onChange={setListSearchQuery}
                placeholder="Search companies, roles..."
              />

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowDateFilter((current) => !current)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                    dateRange !== 'all'
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  type="button"
                >
                  <CalendarDays className="h-3 w-3" />
                  {dateRange === 'all' ? 'Date' : dateRange === '7d' ? 'Past 7 days' : dateRange === '30d' ? 'Past 30 days' : 'Past 90 days'}
                </button>

                {showDateFilter && (
                  <div className="flex gap-1">
                    {[
                      { key: 'all', label: 'All' },
                      { key: '7d', label: '7d' },
                      { key: '30d', label: '30d' },
                      { key: '90d', label: '90d' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setDateRange(option.key);
                          setShowDateFilter(false);
                        }}
                        className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                          dateRange === option.key
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {quota && quota.total !== Infinity && (
              <div className="space-y-1 px-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {quota.used} of {quota.total} relevant messages counted
                    {trackedApplicationCount > 0
                      ? ` across ${trackedApplicationCount} tracked ${trackedApplicationCount === 1 ? 'application' : 'applications'}`
                      : ''}
                  </span>
                  <span className="text-[10px] font-medium text-accent">{percentage}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                  />
                </div>
                {getWarningMessage() && (
                  <div className="text-[10px] text-muted-foreground">{getWarningMessage()}</div>
                )}
              </div>
            )}

            <div className="flex gap-1.5 overflow-x-auto pb-1 popup-scrollbar">
              {MAIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setAllApplicationsFilter(tab.id);
                    setShowDateFilter(false);
                  }}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    allApplicationsFilter === tab.id
                      ? tab.activeClassName
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
              <span>{syncStatusLabel}</span>
              <div className="flex items-center gap-3">
                <button onClick={handleRefresh} className="inline-flex items-center gap-1 transition hover:text-foreground" type="button">
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncActive ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button onClick={logout} className="inline-flex items-center gap-1 transition hover:text-foreground" type="button">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>

          <EmailList
            emails={allConversationEmails}
            category={allApplicationsFilter === 'all' ? 'all' : allApplicationsFilter}
            selectedEmail={selectedEmail}
            onEmailSelect={handleEmailSelect}
            totalEmails={totalConversations}
            totalMessages={filteredConversations.reduce((sum, conv) => sum + (conv.emails?.length || 0), 0)}
            onMarkAllAsRead={allApplicationsFilter === 'all' ? undefined : markEmailsAsReadForCategory}
            isMarkingAllAsRead={markingAllAsRead}
            compact
          />
        </div>
      );
    }

    const emailsForCategory = categorizedEmails[selectedCategory] || [];
    const groupedConversations = groupEmailsByThread(emailsForCategory);
    const filteredConversations = filterConversationGroups(groupedConversations, normalizedListSearchQuery);
    const totalConversations = filteredConversations.length;
    const allConversationEmails = filteredConversations.flatMap((conv) => conv.emails);

    return (
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4">
          <ListSearchBar
            value={listSearchQuery}
            onChange={setListSearchQuery}
            placeholder={`Search ${getCategoryTitle(selectedCategory).toLowerCase()}...`}
          />
        </div>
        <EmailList
          emails={allConversationEmails}
          category={selectedCategory}
          selectedEmail={selectedEmail}
          onEmailSelect={handleEmailSelect}
          totalEmails={totalConversations}
          totalMessages={filteredConversations.reduce((sum, conv) => sum + (conv.emails?.length || 0), 0)}
          onMarkAllAsRead={markEmailsAsReadForCategory}
          isMarkingAllAsRead={markingAllAsRead}
        />
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/15">
              <Briefcase className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Applendium</h1>
            <p className="mt-2 text-sm text-muted-foreground">Track your job search from your inbox.</p>
          </div>

          <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-[0_16px_40px_rgba(17,24,39,0.08)]">
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="text-muted-foreground">
                {isLoginPending ? 'Completing Google sign-in...' : 'Sign in to your account to continue'}
              </p>
            </div>

            <button
              onClick={loginGoogleOAuth}
              disabled={isLoginPending}
              className={`flex w-full items-center justify-center space-x-2 rounded-xl border px-4 py-3 font-semibold shadow-sm transition-colors duration-200 ${
                isLoginPending
                  ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
              type="button"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>{isLoginPending ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showBackButton = selectedCategory !== 'all' && selectedCategory !== 'home';
  const headerAction = selectedCategory === 'emailPreview'
    ? handleBackToCategory
    : () => handleCategoryChange('all');
  const headerMetaLabel = selectedCategory === 'emailPreview'
    ? ''
    : (selectedCategory === 'all' || selectedCategory === 'home'
      ? (extensionVersionLabel || 'Applendium')
      : getCategoryTitle(selectedCategory));

  return (
    <div className="flex h-[600px] max-h-[600px] w-[400px] flex-col overflow-hidden rounded-[18px] border border-border bg-background text-foreground shadow-[0_18px_40px_rgba(17,24,39,0.14)]">
      {isLoadingApp && <LoadingOverlay message="Signing in..." />}
      {showInitialEmailLoading && <LoadingOverlay message="Loading emails..." />}
      <Notification />

      <div className="flex items-center justify-between bg-primary px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {showBackButton && (
            <button
              onClick={headerAction}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground"
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Mail className="h-4 w-4 shrink-0 text-accent" />
          <span className="truncate text-sm font-semibold text-primary-foreground">Applendium</span>
          <span className="rounded bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] text-primary-foreground/75">
            {userPlan === 'premium' ? 'Premium' : 'Free'}
          </span>
        </div>
        <div className="text-[10px] text-primary-foreground/60">
          {headerMetaLabel}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto popup-scrollbar">
        {renderMainContent()}
      </div>

      {selectedCategory !== 'emailPreview' && (
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2 text-[10px]">
          <span className="text-muted-foreground">{footerSummary}</span>
          <button onClick={openDashboard} className="font-medium text-accent transition hover:text-accent/80" type="button">
            {userPlan === 'premium' ? 'Open Dashboard ->' : 'Upgrade to Premium ->'}
          </button>
        </div>
      )}

      <Modals
        isMisclassificationModalOpen={isMisclassificationModalOpen}
        onCloseMisclassificationModal={closeMisclassificationModal}
        selectedEmailForMisclassification={emailToMisclassify}
        onConfirmMisclassification={handleMisclassificationSubmit}
        undoMisclassification={undoMisclassification}
        undoToastVisible={undoToastVisible}
        setUndoToastVisible={setUndoToastVisible}
      />
    </div>
  );
}

export default App;

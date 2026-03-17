import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDate, getCategoryBadgeColor, getCategoryTitle } from '../utils/uiHelpers';
import { groupEmailsByThread, countUniqueThreads } from '../utils/grouping';
import { useEmailQuota } from '../hooks/useEmailQuota';
import { getPremiumDashboardUrl } from '../utils/runtimeConfig';
import { showNotification } from './Notification';

export default function QuickView({
  categorizedEmails,
  quotaData,
  userPlan,
  isSyncing,
  onRefresh,
  onLogout,
  onOpenAll,
  onOpenEmail,
}) {
  const { quota, getWarningMessage, getProgressColor, percentage } = useEmailQuota(quotaData, userPlan);

  const counts = useMemo(() => {
    const applied = countUniqueThreads(categorizedEmails.applied || []);
    const interviewed = countUniqueThreads(categorizedEmails.interviewed || []);
    const offers = countUniqueThreads(categorizedEmails.offers || []);
    const rejected = countUniqueThreads(categorizedEmails.rejected || []);
    return { applied, interviewed, offers, rejected };
  }, [categorizedEmails]);

  const recentThreads = useMemo(() => {
    const allRelevant = [
      ...(categorizedEmails.applied || []),
      ...(categorizedEmails.interviewed || []),
      ...(categorizedEmails.offers || []),
      ...(categorizedEmails.rejected || []),
    ];
    const groups = groupEmailsByThread(allRelevant);
    const sorted = [...groups].sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted.slice(0, 5);
  }, [categorizedEmails]);

  const quotaText =
    userPlan === 'premium' || !quota || quota.total === Infinity ? null : `${Math.min(quota.used, quota.total)}/${quota.total}`;

  const scannedButNoTracked =
    !isSyncing &&
    (quota?.used || 0) > 0 &&
    (counts.applied + counts.interviewed + counts.offers + counts.rejected) === 0;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">MorrowFold</div>
          <div className="text-xs text-gray-600 dark:text-zinc-400">{isSyncing ? 'Syncing in background...' : 'Up to date'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const rawUrl = await getPremiumDashboardUrl();

              if (!rawUrl) {
                showNotification('Premium dashboard URL is not configured yet.', 'info');
                return;
              }

              // Strip any stored path — use only the origin
              let baseUrl;
              try { baseUrl = new URL(rawUrl).origin; } catch { baseUrl = rawUrl.replace(/\/+$/, ''); }

              // Navigate to /dashboard for premium users, /upgrade for free users
              const path = userPlan === 'premium' ? '/dashboard' : '/upgrade';
              const url = baseUrl + path;

              try {
                chrome.tabs.create({ url });
              } catch (e) {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border',
              'border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20',
              'text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/30'
            )}
            title={userPlan === 'premium' ? 'Premium dashboard' : 'Upgrade'}
            type="button"
          >
            {userPlan === 'premium' ? 'Premium' : 'Upgrade'}
          </button>
          <button
            onClick={onRefresh}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border',
              'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800',
              'text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700/50'
            )}
            title="Refresh"
            type="button"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={onLogout}
            className={cn(
              'px-3 py-2 rounded-md text-xs font-medium border',
              'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800',
              'text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700/50'
            )}
            title="Sign out"
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'applied', label: 'Applied', value: counts.applied, className: 'text-blue-600 dark:text-blue-400' },
          { key: 'interviewed', label: 'Interviews', value: counts.interviewed, className: 'text-yellow-600 dark:text-yellow-400' },
          { key: 'offers', label: 'Offers', value: counts.offers, className: 'text-green-600 dark:text-green-400' },
          { key: 'rejected', label: 'Rejected', value: counts.rejected, className: 'text-red-600 dark:text-red-400' },
        ].map((c) => (
          <div key={c.key} className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-2 text-center">
            <div className={cn('text-lg font-bold leading-none', c.className)}>{c.value}</div>
            <div className="mt-1 text-[10px] text-gray-600 dark:text-zinc-400 leading-tight">{c.label}</div>
          </div>
        ))}
      </div>

      {quotaText && (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-200">
            <span className="font-medium">Quota</span>
            <span className="tabular-nums">{quotaText}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden">
            <div className={cn('h-full transition-all', getProgressColor())} style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
          </div>
          {getWarningMessage() && <div className="mt-2 text-[11px] text-gray-600 dark:text-zinc-400">{getWarningMessage()}</div>}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">Recent activity</div>
        </div>

        {recentThreads.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-zinc-400">
            {isSyncing
              ? 'Syncing emails...'
              : scannedButNoTracked
                ? `Scanned ${quota.used} emails, but no job-related messages were detected yet.`
                : 'No tracked applications yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {recentThreads.map((t) => {
              const email = t.latestEmail || {};
              const category = (email.category || '').toString().toLowerCase();
              const title = getCategoryTitle(category);
              const company = email.company_name || 'Unknown company';
              const position = email.position || 'Unknown role';
              return (
                <button
                  key={t.threadId}
                  className={cn(
                    'w-full text-left rounded-md border border-gray-200 dark:border-zinc-700',
                    'hover:bg-gray-50 dark:hover:bg-zinc-700/40 px-3 py-2'
                  )}
                  onClick={() => onOpenEmail(email, t)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {company} - {position}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-zinc-400 truncate">{t.subject}</div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-500 dark:text-zinc-400">{formatDate(t.date)}</div>
                  </div>
                  <div className="mt-2">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px]', getCategoryBadgeColor(category))}>{title}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={onOpenAll}
        className={cn('w-full rounded-lg px-4 py-3 text-sm font-semibold', 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm')}
        type="button"
      >
        View all applications
      </button>
    </div>
  );
}


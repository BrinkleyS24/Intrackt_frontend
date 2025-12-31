import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDate, getCategoryBadgeColor, getCategoryTitle } from '../utils/uiHelpers';
import { groupEmailsByThread, countUniqueThreads } from '../utils/grouping';
import { useEmailQuota } from '../hooks/useEmailQuota';

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
  const { quota, getWarningMessage } = useEmailQuota(quotaData, userPlan);

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

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">AppMailia AI</div>
          <div className="text-xs text-gray-600 dark:text-zinc-400">
            {isSyncing ? 'Syncing in background…' : 'Up to date'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border',
              'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800',
              'text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700/50'
            )}
            title="Refresh"
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
          <div
            key={c.key}
            className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-2 text-center"
          >
            <div className={cn('text-lg font-bold leading-none', c.className)}>{c.value}</div>
            <div className="mt-1 text-[10px] text-gray-600 dark:text-zinc-400 leading-tight">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">Recent activity</div>
        </div>

        {recentThreads.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-zinc-400">No tracked applications yet.</div>
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
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {company} — {position}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-zinc-400 truncate">{t.subject}</div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-500 dark:text-zinc-400">{formatDate(t.date)}</div>
                  </div>
                  <div className="mt-2">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px]', getCategoryBadgeColor(category))}>
                      {title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={onOpenAll}
        className={cn(
          'w-full rounded-lg px-4 py-3 text-sm font-semibold',
          'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
        )}
      >
        View all applications
      </button>

      {quotaData && quota.warningLevel !== 'none' && (
        <div className="text-xs text-gray-700 dark:text-zinc-200">
          {getWarningMessage()}
        </div>
      )}
    </div>
  );
}

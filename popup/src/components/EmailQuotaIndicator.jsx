import React from 'react';
import { AlertTriangle, Mail } from 'lucide-react';
import { useEmailQuota } from '../hooks/useEmailQuota';
import { cn } from '../utils/cn';

const Progress = ({ value, className }) => {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-transparent border border-gray-800 dark:border-gray-300">
      <div className={cn('h-full transition-all', className)} style={{ width: `${value || 0}%` }} />
    </div>
  );
};

export function EmailQuotaIndicator({ userPlan, quotaData }) {
  const { quota, getWarningMessage, getProgressColor, percentage } = useEmailQuota(quotaData, userPlan);

  if (!quotaData) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-sm space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-20"></div>
          <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-10"></div>
        </div>
        <div className="space-y-2">
          <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded"></div>
        </div>
      </div>
    );
  }

  const progressColor = getProgressColor();
  const totalLabel = quota.total === Infinity ? '∞' : quota.total;

  return (
    <div className="p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Tracking</span>
        </div>
        {quota.warningLevel !== 'none' && (
          <AlertTriangle
            className={cn('h-4 w-4', {
              'text-red-500': quota.warningLevel === 'exceeded' || quota.warningLevel === 'critical',
              'text-yellow-500': quota.warningLevel === 'warning',
              'text-blue-500': quota.warningLevel === 'approaching',
            })}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-gray-600 dark:text-zinc-400">
          <span>
            {quota.used}/{totalLabel} emails
          </span>
          <span>{percentage}%</span>
        </div>
        <Progress value={percentage} className={progressColor} />
      </div>

      {getWarningMessage() && (
        <div
          className={cn('text-xs p-2 rounded border', {
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700':
              quota.warningLevel === 'exceeded' || quota.warningLevel === 'critical',
            'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700':
              quota.warningLevel === 'warning',
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700':
              quota.warningLevel === 'approaching',
          })}
        >
          {getWarningMessage()}
        </div>
      )}
    </div>
  );
}


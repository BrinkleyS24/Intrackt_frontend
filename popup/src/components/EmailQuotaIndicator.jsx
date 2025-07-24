import React from 'react';
import { Crown, AlertTriangle, Mail } from "lucide-react";
import { useEmailQuota } from '../hooks/useEmailQuota';
import { cn } from '../utils/cn';

// A simple Progress component placeholder to avoid breaking the app if not using a UI library
const Progress = ({ value, className, style, ...props }) => {
    const progressStyle = { ...style };
    if (className && className.includes('bg-')) {
        const colorMap = {
            'bg-red-500': '#ef4444',
            'bg-yellow-500': '#eab308',
            'bg-blue-500': '#3b82f6',
            'bg-green-500': '#22c55e',
        };
        const colorKey = Object.keys(colorMap).find(key => className.includes(key));
        if (colorKey) {
            progressStyle.backgroundColor = colorMap[colorKey];
        }
    }
    progressStyle.width = `${value}%`;

    return (
      <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700", className)} {...props}>
        <div className="h-full w-full flex-1 bg-inherit transition-all" style={{ transform: `translateX(-${100 - (value || 0)}%)`, backgroundColor: progressStyle.backgroundColor }} />
      </div>
    );
};


// A simple Button component placeholder
const Button = ({ children, size, ...props }) => {
    const sizeClasses = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm';
    return <button className={cn("inline-flex items-center justify-center rounded-md font-medium", sizeClasses)} {...props}>{children}</button>;
};

export function EmailQuotaIndicator({ userPlan, quotaData, onUpgradeClick }) {
  const { quota, getWarningMessage, getProgressColor, percentage } = useEmailQuota(quotaData, userPlan);

  // If the user is premium, show a premium badge instead of the quota bar
  if (userPlan === 'premium') {
    return (
      <div className="p-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg shadow-md flex items-center justify-center space-x-2">
        <Crown className="h-5 w-5" />
        <span className="font-semibold text-sm">Premium User</span>
      </div>
    );
  }

  // If quotaData is not yet available, render a loading skeleton.
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

  return (
    <div className="p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Email Usage</span>
        </div>
        {quota.warningLevel !== 'none' && (
          <AlertTriangle className={cn("h-4 w-4", {
            'text-red-500': quota.warningLevel === 'exceeded' || quota.warningLevel === 'critical',
            'text-yellow-500': quota.warningLevel === 'warning',
            'text-blue-500': quota.warningLevel === 'approaching',
          })} />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-gray-600 dark:text-zinc-400">
          <span>{quota.used}/{quota.total === Infinity ? '∞' : quota.total} emails</span>
          <span>{percentage}%</span>
        </div>
        <Progress value={percentage} className={progressColor} />
      </div>

      {getWarningMessage() && (
        <div className={cn("text-xs p-2 rounded border", {
          'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700': quota.warningLevel === 'exceeded' || quota.warningLevel === 'critical',
          'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700': quota.warningLevel === 'warning',
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700': quota.warningLevel === 'approaching',
        })}>
          {getWarningMessage()}
        </div>
      )}

      {(quota.warningLevel === 'warning' || quota.warningLevel === 'critical' || quota.warningLevel === 'exceeded') && (
        <Button
          size="sm"
          onClick={onUpgradeClick}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-md shadow-sm transition-all duration-200 mt-2"
        >
          <Crown className="h-3 w-3 mr-1" />
          Upgrade for Unlimited
        </Button>
      )}
    </div>
  );
}

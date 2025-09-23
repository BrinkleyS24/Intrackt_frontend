import React, { useState, useEffect } from 'react';
import { Crown, AlertTriangle, Mail, Settings, ExternalLink } from "lucide-react";
import { useEmailQuota } from '../hooks/useEmailQuota';
import { cn } from '../utils/cn';

// A simple Progress component that renders a track with a border and a fill.
const Progress = ({ value, className }) => {
    return (
      // This is the track/container. It's transparent with a border.
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-transparent border border-gray-800 dark:border-gray-300">
        <div
          className={cn("h-full transition-all", className)}
          style={{ width: `${value || 0}%` }}
        />
      </div>
    );
};

// A simple Button component placeholder
const Button = ({ children, size, ...props }) => {
    const sizeClasses = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm';
    return <button className={cn("inline-flex items-center justify-center rounded-md font-medium", sizeClasses)} {...props}>{children}</button>;
};

export function EmailQuotaIndicator({ userPlan, quotaData, onUpgradeClick, onManageSubscription }) {
  const { quota, getWarningMessage, getProgressColor, percentage } = useEmailQuota(quotaData, userPlan);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Load subscription status for premium users
  useEffect(() => {
    if (userPlan === 'premium' && window.subscriptionService) {
      loadSubscriptionStatus();
    }
  }, [userPlan]);

  const loadSubscriptionStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await window.subscriptionService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleManageSubscription = () => {
    if (onManageSubscription) {
      onManageSubscription();
    }
  };

  // If the user is premium, show a premium badge with management options
  if (userPlan === 'premium') {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5" />
              <span className="font-semibold text-sm">Premium User</span>
            </div>
          </div>
          
          {loadingStatus && (
            <div className="mt-2 text-xs text-purple-100 animate-pulse">
              Loading subscription details...
            </div>
          )}
          
          {subscriptionStatus && !loadingStatus && (
            <div className="mt-2 space-y-1 text-xs text-purple-100">
              {subscriptionStatus.subscription && (
                <>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="capitalize font-medium">
                      {subscriptionStatus.subscription.status}
                      {subscriptionStatus.subscription.status === 'canceled' && 
                       subscriptionStatus.subscription.current_period_end && 
                       new Date(subscriptionStatus.subscription.current_period_end) > new Date() && 
                       " (Active until end of period)"}
                    </span>
                  </div>
                  
                  {subscriptionStatus.subscription.current_period_end && (
                    <div className="flex justify-between">
                      <span>
                        {subscriptionStatus.subscription.status === 'canceled' ? 'Expires:' : 'Renews:'}
                      </span>
                      <span className="font-medium">
                        {new Date(subscriptionStatus.subscription.current_period_end).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {subscriptionStatus.subscription.items?.data?.[0]?.price && (
                    <div className="flex justify-between">
                      <span>Plan:</span>
                      <span className="font-medium">
                        ${(subscriptionStatus.subscription.items.data[0].price.unit_amount / 100).toFixed(2)}/
                        {subscriptionStatus.subscription.items.data[0].price.recurring?.interval || 'month'}
                      </span>
                    </div>
                  )}
                  
                  {subscriptionStatus.subscription.cancel_at_period_end && (
                    <div className="mt-2 p-2 bg-yellow-500 bg-opacity-20 rounded text-yellow-100 text-xs">
                      ⚠️ Subscription will not renew. You'll maintain premium access until {new Date(subscriptionStatus.subscription.current_period_end).toLocaleDateString()}.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {!subscriptionStatus && !loadingStatus && (
            <div className="mt-2 text-xs text-purple-100">
              Unable to load subscription details
            </div>
          )}
        </div>
        
        <Button
          size="sm"
          onClick={handleManageSubscription}
          disabled={loadingStatus}
          className="w-full bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded-md transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Settings className="h-3 w-3 mr-1" />
          Manage Subscription
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
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

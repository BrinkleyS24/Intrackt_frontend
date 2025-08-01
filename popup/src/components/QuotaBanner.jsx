/**
 * @file popup/src/components/QuotaBanner.jsx
 * @description React component for displaying the quota notification banner.
 * Implemented with Tailwind CSS and local storage for dismissible state.
 */

import React, { useState, useEffect } from 'react';
import { showNotification } from './Notification'; // For global toasts
import { cn } from '../utils/cn'; // For conditional class names

function QuotaBanner({ quota, userPlan, onUpgradeClick }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if the banner was previously dismissed
    const checkDismissedStatus = async () => {
      try {
        const result = await chrome.storage.local.get('quotaAlertDismissed');
        if (result.quotaAlertDismissed) {
          setDismissed(true);
        }
      } catch (error) {
        console.error("Error reading quota dismissal status:", error);
      }
    };
    checkDismissedStatus();
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await chrome.storage.local.set({ quotaAlertDismissed: true });
      console.log("📊 Intrackt: Quota banner dismissed and preference saved.");
    } catch (error) {
      console.error("Error saving quota dismissal status:", error);
      showNotification("Failed to dismiss banner preference.", "error");
    }
  };

  // Ensure quota and its properties are safely accessed
  const isMaxQuota = quota?.usagePercentage === 100;
  const isCloseToQuota = (quota?.usagePercentage >= 80 && quota?.usagePercentage < 100);

  // Don't render if dismissed, user is premium, no quota data, or not close to quota
  if (dismissed || userPlan === 'premium' || !quota || (!isMaxQuota && !isCloseToQuota)) {
    return null;
  }

  const message = isMaxQuota
    ? `You've reached your email processing limit (${quota.usage || 0}/${quota.limit || 0}). Upgrade to Premium for unlimited tracking.`
    : `You're close to your email processing limit (${quota.usage || 0}/${quota.limit || 0}). Upgrade for unlimited tracking.`;

  const actionText = isMaxQuota ? "Upgrade Now" : "Dismiss";

  return (
    <div className="px-4 py-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 flex items-center justify-between text-sm rounded-lg m-4 shadow-sm">
      <span className="flex-1 mr-4">{message}</span>
      {isMaxQuota ? (
        <button
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg rounded-full px-4 py-2 transition-all duration-300 flex items-center justify-center text-xs font-semibold"
          onClick={onUpgradeClick} // This prop should open the premium modal
        >
          {actionText}
        </button>
      ) : (
        <button
          className="border border-gray-300 dark:border-zinc-500 text-xs text-gray-600 dark:text-zinc-300 px-3 py-1 rounded-lg hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50"
          onClick={handleDismiss}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

export default QuotaBanner;

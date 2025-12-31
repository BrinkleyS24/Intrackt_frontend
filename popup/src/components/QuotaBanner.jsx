/**
 * @file popup/src/components/QuotaBanner.jsx
 * @description React component for displaying the quota notification banner.
 * Implemented with Tailwind CSS and local storage for dismissible state.
 */

import React, { useState, useEffect } from 'react';
import { showNotification } from './Notification'; // For global toasts

function QuotaBanner({ quota, userPlan }) {
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
    } catch (error) {
      console.error("Error saving quota dismissal status:", error);
      showNotification("Failed to dismiss banner preference.", "error");
    }
  };

  // Ensure quota and its properties are safely accessed (support both legacy + new shapes)
  const limit = quota?.limit ?? 0;
  const usage = quota?.usage ?? quota?.totalProcessed ?? 0;
  const usagePercentage = quota?.usagePercentage ?? (limit ? Math.min(100, Math.round((usage / limit) * 100)) : 0);

  const isMaxQuota = limit ? usagePercentage === 100 : false;
  const isCloseToQuota = limit ? (usagePercentage >= 80 && usagePercentage < 100) : false;

  // Don't render if dismissed, user is premium, no quota data, or not close to quota
  if (dismissed || userPlan === 'premium' || !quota || (!isMaxQuota && !isCloseToQuota)) {
    return null;
  }

  const message = isMaxQuota
    ? `You've reached your tracking limit (${usage}/${limit}).`
    : `You're close to your tracking limit (${usage}/${limit}).`;

  const actionText = "Dismiss";

  return (
    <div className="px-4 py-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 flex items-center justify-between text-sm rounded-lg m-4 shadow-sm">
      <span className="flex-1 mr-4">{message}</span>
      <button
        className="border border-gray-300 dark:border-zinc-500 text-xs text-gray-600 dark:text-zinc-300 px-3 py-1 rounded-lg hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50"
        onClick={handleDismiss}
      >
        {actionText}
      </button>
    </div>
  );
}

export default QuotaBanner;

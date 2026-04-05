import { useState, useEffect } from 'react';

const DEFAULT_FREE_TRACKING_LIMIT = 100;

/**
 * @typedef {Object} EmailQuota
 * @property {number} used
 * @property {number} total
 * @property {Date} resetDate
 * @property {boolean} isAtLimit
 * @property {'none' | 'approaching' | 'warning' | 'critical' | 'exceeded'} warningLevel
 */

/**
 * Custom React hook for managing email quota display logic.
 * @param {object | null} initialQuotaData - The quota data fetched from the backend (e.g., from useAuth).
 * @param {string} userPlan - The user's current plan ('free' or 'premium').
 */
export function useEmailQuota(initialQuotaData, userPlan) {
    const getQuotaUsed = (quotaData) => {
        if (!quotaData) return 0;
        if (Number.isFinite(quotaData.trackedApplications)) return quotaData.trackedApplications;
        if (Number.isFinite(quotaData.usage)) return quotaData.usage;
        return quotaData.totalProcessed || 0;
    };

    const getMessageVolume = (quotaData) => {
        if (!quotaData) return 0;
        return Number(quotaData.relevantMessagesProcessed || 0);
    };

    // Helper function to determine warning level based on usage.
    // Moved to the top to ensure it's defined before being used in useState initializer.
    const getWarningLevel = (used, total, plan) => {
        if (plan === 'premium') {
            return 'none'; // Premium users have no quota limits
        }
        const percentage = (used / total) * 100;
        if (used >= total) return 'exceeded';
        if (percentage >= 90) return 'critical';
        if (percentage >= 80) return 'warning';
        if (percentage >= 60) return 'approaching';
        return 'none';
    };

    // Helper function to calculate days until reset.
    // Moved to the top to ensure it's defined before being used.
    const getDaysUntilReset = (resetDate) => {
        const now = new Date();
        // Ensure resetDate is valid before calculating
        if (!resetDate || isNaN(resetDate.getTime())) {
            return 0; // Or some other appropriate default
        }
        const diffTime = resetDate.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    };

    // Initialize quota state with data from the backend or default values
    const [quota, setQuota] = useState(() => {
        if (initialQuotaData) {
            // Ensure resetDate is a Date object, default to current date if not provided
            const resetDate = initialQuotaData.next_reset_date ? new Date(initialQuotaData.next_reset_date) : new Date();
            const used = getQuotaUsed(initialQuotaData);
            const messageVolume = getMessageVolume(initialQuotaData);
            // Determine total based on userPlan
            const total = userPlan === 'premium' ? Infinity : (initialQuotaData.limit || DEFAULT_FREE_TRACKING_LIMIT);

            const initialWarningLevel = getWarningLevel(used, total, userPlan); // Now 'getWarningLevel' is defined

            return {
                used: used,
                total: total,
                resetDate: resetDate,
                isAtLimit: used >= total && total !== Infinity,
                warningLevel: initialWarningLevel,
                messageVolume,
                limitReached: Boolean(initialQuotaData.limitReached),
                limitBehavior: initialQuotaData.limitBehavior || null,
            };
        }
        return {
            used: 0,
            total: DEFAULT_FREE_TRACKING_LIMIT,
            resetDate: new Date(),
            isAtLimit: false,
            warningLevel: 'none',
            messageVolume: 0,
            limitReached: false,
            limitBehavior: null,
        };
    });

    // Function to get the warning message based on current quota state
    const getWarningMessage = () => {
        const remaining = quota.total === Infinity ? "Unlimited" : quota.total - quota.used;

        if (quota.total === Infinity) {
            return null; // No warning message for premium users
        }

        switch (quota.warningLevel) {
            case 'exceeded':
                if (quota.limitBehavior === 'existing_continue_new_paused') {
                    return "Tracking limit reached. Existing tracked applications still sync, but new ones are paused until your limit resets or you upgrade.";
                }
                return "Tracking limit reached. Upgrade for unlimited tracking.";
            case 'critical':
                return `Only ${remaining} tracked applications remaining in your limit.`;
            case 'warning':
                return `You're approaching your tracking limit (${remaining} left).`;
            case 'approaching':
                return `${quota.used}/${quota.total} tracked applications used.`;
            default:
                return null;
        }
    };

    // Function to get the progress bar color based on warning level
    const getProgressColor = () => {
        if (quota.total === Infinity) {
            return 'bg-green-500'; // Always green for premium
        }
        switch (quota.warningLevel) {
            case 'exceeded':
            case 'critical':
                return 'bg-red-500';
            case 'warning':
                return 'bg-yellow-500';
            case 'approaching':
                return 'bg-blue-500';
            default:
                return 'bg-green-500';
        }
    };

    // Update quota state when initialQuotaData or userPlan changes
    useEffect(() => {
        if (initialQuotaData) {
            const resetDate = initialQuotaData.next_reset_date ? new Date(initialQuotaData.next_reset_date) : new Date();
            const used = getQuotaUsed(initialQuotaData);
            const messageVolume = getMessageVolume(initialQuotaData);
            const total = userPlan === 'premium' ? Infinity : (initialQuotaData.limit || DEFAULT_FREE_TRACKING_LIMIT);

            const newWarningLevel = getWarningLevel(used, total, userPlan); // Pass userPlan to getWarningLevel

            setQuota({
                used: used,
                total: total,
                resetDate: resetDate,
                isAtLimit: used >= total && total !== Infinity,
                warningLevel: newWarningLevel,
                messageVolume,
                limitReached: Boolean(initialQuotaData.limitReached),
                limitBehavior: initialQuotaData.limitBehavior || null,
            });
        }
    }, [initialQuotaData, userPlan]); // Re-run effect when initialQuotaData or userPlan changes


    return {
        quota,
        getWarningMessage,
        getProgressColor,
        getDaysUntilReset, // Expose if needed, but not directly used in EmailQuotaIndicator
        percentage: quota.total === Infinity ? 0 : Math.round((quota.used / quota.total) * 100),
    };
}

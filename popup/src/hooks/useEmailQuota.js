import { useState, useEffect } from 'react';

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
export function useEmailQuota(initialQuotaData, userPlan) { // Added userPlan as a parameter
    // Initialize quota state with data from the backend or default values
    const [quota, setQuota] = useState(() => {
        if (initialQuotaData) {
            // Ensure resetDate is a Date object, default to current date if not provided
            const resetDate = initialQuotaData.next_reset_date ? new Date(initialQuotaData.next_reset_date) : new Date();
            // Use 'totalProcessed' from backend response
            const used = initialQuotaData.totalProcessed || 0;
            // Determine total based on userPlan
            const total = userPlan === 'premium' ? Infinity : (initialQuotaData.limit || 50); // Use initialQuotaData.limit if available, else default to 50

            const initialWarningLevel = getWarningLevel(used, total, userPlan);
            return {
                used: used,
                total: total,
                resetDate: resetDate,
                isAtLimit: used >= total && total !== Infinity,
                warningLevel: initialWarningLevel,
            };
        }
        // Default mock data if no initialQuotaData (should ideally not happen in a logged-in state)
        return {
            used: 0,
            total: 50, // Default to free tier limit
            resetDate: new Date(),
            isAtLimit: false,
            warningLevel: 'none'
        };
    });

    // Helper function to determine warning level based on usage and plan
    /**
     * @param {number} used
     * @param {number} total
     * @param {string} plan
     * @returns {'none' | 'approaching' | 'warning' | 'critical' | 'exceeded'}
     */
    const getWarningLevel = (used, total, plan) => {
        if (plan === 'premium') return 'none'; // Premium users have no quota warnings

        const percentage = (used / total) * 100;
        if (used >= total) return 'exceeded';
        if (percentage >= 90) return 'critical';
        if (percentage >= 80) return 'warning';
        if (percentage >= 60) return 'approaching';
        return 'none';
    };

    const getDaysUntilReset = () => {
        const now = new Date();
        const diffTime = quota.resetDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    const getWarningMessage = () => {
        const remaining = quota.total === Infinity ? 'Unlimited' : quota.total - quota.used;
        const days = getDaysUntilReset();

        if (quota.total === Infinity) return null; // No warning message for premium users

        switch (quota.warningLevel) {
            case 'exceeded':
                // If next_reset_date is the current date (meaning it wasn't provided), make message generic
                if (days <= 1 && Math.abs(quota.resetDate.getTime() - new Date().getTime()) < (24 * 60 * 60 * 1000)) {
                    return `Monthly limit reached. Upgrade for unlimited emails.`;
                }
                return `Monthly limit reached. Resets in ${days} day${days !== 1 ? 's' : ''}.`;
            case 'critical':
                return `Only ${remaining} emails remaining this month.`;
            case 'warning':
                return `You're approaching your monthly limit (${remaining} left).`;
            case 'approaching':
                return `${quota.used}/${quota.total} emails used this month.`;
            default:
                return null;
        }
    };

    const getProgressColor = () => {
        if (quota.total === Infinity) return 'bg-green-500'; // Premium is always green

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
            const used = initialQuotaData.totalProcessed || 0; // Use totalProcessed
            const total = userPlan === 'premium' ? Infinity : (initialQuotaData.limit || 50); // Use userPlan and initialQuotaData.limit

            const newWarningLevel = getWarningLevel(used, total, userPlan); // Pass userPlan to getWarningLevel

            setQuota({
                used: used,
                total: total,
                resetDate: resetDate,
                isAtLimit: used >= total && total !== Infinity,
                warningLevel: newWarningLevel,
            });
        }
    }, [initialQuotaData, userPlan]); // Re-run effect when initialQuotaData or userPlan changes


    return {
        quota,
        getWarningMessage,
        getProgressColor,
        getDaysUntilReset,
        percentage: quota.total === Infinity ? 0 : Math.round((quota.used / quota.total) * 100) // Percentage is 0 for premium
    };
}

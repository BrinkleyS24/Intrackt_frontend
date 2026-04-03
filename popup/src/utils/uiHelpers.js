/**
 * @file popup/src/utils/uiHelpers.js
 * @description Centralized utility functions for UI rendering,
 * specifically for formatting and styling based on categories and dates,
 * aligned with the provided React UI.
 */

/**
 * Formats a raw date string for display in various UI components,
 * matching the React component's logic.
 * @param {string} dateStr - The raw date string (e.g., ISO format).
 * @returns {string} The formatted date string (e.g., "Today", "Yesterday", "2 days ago", or "6/19/2024").
 */
export function parseEmailDate(dateValue) {
  if (dateValue == null) return null;
  if (dateValue instanceof Date) return dateValue;

  if (typeof dateValue === 'number' && Number.isFinite(dateValue)) {
    const d = new Date(dateValue);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(dateValue).trim();
  if (!raw) return null;

  const hasTimezoneSuffix = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const looksIsoNoTimezone =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) && !hasTimezoneSuffix;

  const normalized = looksIsoNoTimezone
    ? `${raw.replace(' ', 'T')}Z`
    : raw;

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const date = parseEmailDate(dateStr);
  if (!date) {
    console.warn("Invalid date string provided to formatDate:", dateStr);
    return "Invalid Date";
  }

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "Today";
  if (diffDays === 2) return "Yesterday";
  if (diffDays > 2 && diffDays <= 7) return `${diffDays - 1} days ago`;

  return date.toLocaleDateString();
}

/**
 * Gets the Tailwind CSS classes for the badge background color based on category.
 * @param {string|null|undefined} category - The email category string (e.g., "Applied").
 * @returns {string} Tailwind CSS classes for background color.
 */
export function getCategoryBadgeColor(category) {
  // Ensure category is a string before calling toLowerCase()
  const lowerCategory = (category || '').toLowerCase(); // Default to empty string if null/undefined

  switch (lowerCategory) {
    case 'applied':
      return 'bg-success/10 text-success';
    case 'interviewed':
      return 'bg-warning/15 text-warning-foreground';
    case 'offers':
      return 'bg-success/10 text-success';
    case 'rejected':
      return 'bg-destructive/10 text-destructive';
    case 'irrelevant':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground'; // Default for unknown/null
  }
}

/**
 * Gets the Tailwind CSS classes for the main card/text color based on category.
 * @param {string|null|undefined} category - The email category string (e.g., "Applied").
 * @returns {string} Tailwind CSS classes for text color.
 */
export function getCategoryColor(category) {
  // Ensure category is a string before calling toLowerCase()
  const lowerCategory = (category || '').toLowerCase(); // Default to empty string if null/undefined

  switch (lowerCategory) {
    case 'applied':
      return 'text-success';
    case 'interviewed':
      return 'text-warning';
    case 'offers':
      return 'text-success';
    case 'rejected':
      return 'text-destructive';
    case 'irrelevant':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground'; // Default for unknown/null
  }
}

/**
 * Calculates the difference in days between two dates.
 * @param {Date} date1 - The first date object.
 * @param {Date} date2 - The second date object.
 * @returns {number} The difference in days.
 */
export function differenceInDays(date1, date2) {
  const diffTime = Math.abs(date1.getTime() - date2.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determines the date threshold for filtering emails.
 * @param {string} timeRange - The selected time range filter (e.g., "today", "last7days").
 * @returns {Date} The calculated Date object for the threshold.
 */
export function getDateThreshold(timeRange) {
  const now = new Date();
  let threshold = new Date(); // Default to 'now' for 'today' or 'all'

  switch (timeRange) {
    case 'today':
      threshold.setHours(0, 0, 0, 0); // Start of today
      break;
    case 'last7days':
      threshold.setDate(now.getDate() - 7);
      break;
    case 'last30days':
      threshold.setDate(now.getDate() - 30);
      break;
    case 'all':
    default:
      return new Date(0); // Epoch start for filtering for "all time"
  }
  return threshold;
}

/**
 * Gets the human-readable title for a given email category key.
 * @param {string|null|undefined} categoryKey - The internal category key (e.g., "applied").
 * @returns {string} The display title (e.g., "Applied").
 */
export function getCategoryTitle(categoryKey) {
  // Ensure categoryKey is a string before calling toLowerCase()
  const lowerCategoryKey = (categoryKey || '').toLowerCase(); // Default to empty string if null/undefined

  const titles = {
    "applied": "Applied",
    "interviewed": "Interviews",
    "offers": "Offers",
    "rejected": "Rejected",
    "closed": "Closed",
    "irrelevant": "Irrelevant",
    "all": "All",
    "dashboard": "Dashboard", // For sidebar navigation
  };
  return titles[lowerCategoryKey] || (categoryKey || "Unknown Category"); // Fallback to original key or generic string
}

/**
 * Calculates time since oldest pending follow-up.
 * @param {Array<object>} followUpSuggestions - List of follow-up suggestions.
 * @returns {string} Formatted time string.
 */
export function getTimeSinceOldestPending(followUpSuggestions) {
  const pending = followUpSuggestions.filter(s => !s.followedUp && !s.responded);
  if (pending.length === 0) return "N/A";

  const validTimestamps = pending
    .map((e) => parseEmailDate(e.date)?.getTime())
    .filter((timestamp) => typeof timestamp === 'number' && !Number.isNaN(timestamp));
  if (validTimestamps.length === 0) return "N/A";

  const oldestTimestamp = Math.min(...validTimestamps);
  const now = Date.now();
  const diffMs = now - oldestTimestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

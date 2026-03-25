/**
 * @file popup/src/utils/constants.js
 * @description Centralized configuration object for the application,
 * including API endpoints and pagination settings.
 */

const IS_PRODUCTION_EXTENSION_BUILD = process.env.EXTENSION_BUILD_TARGET === 'production';
const FALLBACK_BACKEND_BASE_URL = 'https://gmail-tracker-backend-674309673051.us-central1.run.app';
const BUNDLED_BACKEND_BASE_URL = (
  IS_PRODUCTION_EXTENSION_BUILD
    ? (process.env.BACKEND_BASE_URL_PROD || FALLBACK_BACKEND_BASE_URL)
    : (process.env.BACKEND_BASE_URL || FALLBACK_BACKEND_BASE_URL)
).replace(/\/$/, '');
const BUNDLED_PREMIUM_DASHBOARD_URL = (
  IS_PRODUCTION_EXTENSION_BUILD
    ? (process.env.PREMIUM_DASHBOARD_URL_PROD || 'https://applendium.com')
    : (process.env.PREMIUM_DASHBOARD_URL || 'https://applendium.com')
).toString().trim();

export const CONFIG = {
  ENDPOINTS: {
    BACKEND_BASE_URL: BUNDLED_BACKEND_BASE_URL,
    AUTH_URL: '/api/auth/auth-url', // Endpoint for initiating Google OAuth (getting the auth URL)
    AUTH_TOKEN: '/api/auth/token', // Endpoint for exchanging OAuth code for refresh token
    SYNC_EMAILS: '/api/emails', // Primary endpoint for fetching/syncing new emails from Gmail and classification
    FETCH_STORED_EMAILS: '/api/emails/stored-emails', // Endpoint for fetching already stored emails from DB
    FOLLOWUP_NEEDED: '/api/emails/followup-needed', // Endpoint for getting follow-up suggestions
    REPORT_MISCLASSIFICATION: '/api/emails/report-misclassification', // Endpoint for reporting email misclassification
    UNDO_MISCLASSIFICATION: '/api/emails/undo-misclassification', // Added endpoint for undoing misclassification
    FETCH_USER_PLAN: '/api/user', // Endpoint for fetching user plan and status
    UPDATE_USER_PLAN: '/api/user/update-plan', // Endpoint for updating user plan
    SUGGESTION_ACTION: '/api/suggestions/action', // Endpoint for marking suggestions as completed
    SUGGESTION_SNOOZE: '/api/suggestions/snooze', // Endpoint for snoozing suggestions
    SUGGESTION_STATES: '/api/suggestions/states', // Endpoint for fetching suggestion states
    // Note: SEND_EMAIL_REPLY is handled by the background script directly with Gmail API, not via a specific backend endpoint.
    // Note: QUOTA data is returned as part of the SYNC_EMAILS response, not a separate endpoint.
  },
  PREMIUM_DASHBOARD_URL: BUNDLED_PREMIUM_DASHBOARD_URL,
  PAGINATION: {
    PAGE_SIZE: 10, // Number of emails per page
  },
};

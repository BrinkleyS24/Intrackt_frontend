/**
 * @file popup/src/utils/constants.js
 * @description Centralized configuration object for the application,
 * including API endpoints and pagination settings.
 */

export const CONFIG = {
  ENDPOINTS: {
    BACKEND_BASE_URL: 'https://gmail-tracker-backend-215378038667.us-central1.run.app', // Your production backend URL
    AUTH_URL: '/api/auth/auth-url', // Endpoint for initiating Google OAuth (getting the auth URL)
    AUTH_TOKEN: '/api/auth/token', // Endpoint for exchanging OAuth code for refresh token
    SYNC_EMAILS: '/api/emails', // Primary endpoint for fetching/syncing new emails from Gmail and classification
    FETCH_STORED_EMAILS: '/api/emails/stored-emails', // Endpoint for fetching already stored emails from DB
    FOLLOWUP_NEEDED: '/api/emails/followup-needed', // Endpoint for getting follow-up suggestions
    REPORT_MISCLASSIFICATION: '/api/emails/report-misclassification', // Endpoint for reporting email misclassification
    UNDO_MISCLASSIFICATION: '/api/emails/undo-misclassification', // Added endpoint for undoing misclassification
    FETCH_USER_PLAN: '/api/user', // Endpoint for fetching user plan and status
    UPDATE_USER_PLAN: '/api/user/update-plan', // Endpoint for updating user plan
    // Note: SEND_EMAIL_REPLY is handled by the background script directly with Gmail API, not via a specific backend endpoint.
    // Note: QUOTA data is returned as part of the SYNC_EMAILS response, not a separate endpoint.
  },
  PAGINATION: {
    PAGE_SIZE: 10, // Number of emails per page
  },
};

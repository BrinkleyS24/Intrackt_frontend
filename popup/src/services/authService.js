/**
 * @file popup/src/services/authService.js
 * @description Handles user authentication (login/logout) by communicating
 * with Firebase Authentication and fetching user plan from custom backend.
 */

import { sendMessageToBackground } from '../utils/chromeMessaging'; 

/**
 * Fetches the user's plan from the backend via the background script.
 * @param {string} userEmail - The email of the user to fetch the plan for.
 * @returns {Promise<string>} The user's plan ('free' or 'premium').
 */
export async function fetchUserPlanFromService(userEmail) {
  try {
    // Ensure userEmail is passed to the background script message
    const response = await sendMessageToBackground({ type: "FETCH_USER_PLAN", userEmail: userEmail });
    if (response.success) {
      return response.plan;
    } else {
      console.error("❌ Intrackt: Failed to fetch user plan from background:", response.error);
      return 'free'; // Default to free on error
    }
  } catch (error) {
    console.error("❌ Intrackt: Error communicating with background for user plan:", error);
    return 'free'; // Default to free on communication error
  }
}
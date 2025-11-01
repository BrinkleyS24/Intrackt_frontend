/**
 * @file popup/src/services/followUpService.js
 * @description Manages follow-up state in local storage and fetches suggestions
 * from the background script.
 */

import { sendMessageToBackground } from '../utils/chromeMessaging';

/**
 * Retrieves the current follow-up state (followedUpMap and respondedMap) from local storage.
 * @returns {Promise<{followedUpMap: object, respondedMap: object}>}
 */
export async function getFollowUpStateService() {
  try {
    const result = await chrome.storage.local.get({ followedUpMap: {}, respondedMap: {} });
    return result;
  } catch (error) {
    console.error("❌ AppMailia AI: Error getting follow-up state from local storage:", error);
    return { followedUpMap: {}, respondedMap: {} };
  }
}

/**
 * Marks an email thread as followed up in local storage.
 * @param {string} threadId - The ID of the thread to mark.
 * @returns {Promise<number>} The timestamp when it was marked.
 */
export async function markFollowedUpService(threadId) {
  const now = Date.now();
  try {
    const result = await chrome.storage.local.get({ followedUpMap: {} });
    const followedUpMap = { ...result.followedUpMap, [threadId]: now };
    await chrome.storage.local.set({ followedUpMap });
    return now;
  } catch (error) {
    console.error("❌ AppMailia AI: Error marking followed up in local storage:", error);
    throw error;
  }
}

/**
 * Updates the responded state for a specific email thread in local storage.
 * @param {string} threadId - The ID of the thread to update.
 * @param {boolean} isChecked - The new responded state (true/false).
 * @param {number|null} currentFollowedUpAt - The existing followedUpAt timestamp, if any.
 * @returns {Promise<{followedUpAt: number|null}>} The updated followedUpAt timestamp.
 */
export async function updateRespondedStateService(threadId, isChecked, currentFollowedUpAt) {
  const now = Date.now();
  try {
    const result = await chrome.storage.local.get({ respondedMap: {}, followedUpMap: {} });
    const respondedMap = { ...result.respondedMap };
    const followedUpMap = { ...result.followedUpMap };

    if (isChecked) {
      respondedMap[threadId] = true;
      if (!currentFollowedUpAt) {
        followedUpMap[threadId] = now; // Mark followed up if not already
      }
    } else {
      delete respondedMap[threadId];
      // Only delete followedUp entry if it matches the currentFollowedUpAt,
      // preventing accidental deletion if followedUp was set independently.
      if (followedUpMap[threadId] === currentFollowedUpAt) {
        delete followedUpMap[threadId];
      }
    }

    await chrome.storage.local.set({ respondedMap, followedUpMap });
    return { followedUpAt: followedUpMap[threadId] || null };
  } catch (error) {
    console.error("❌ AppMailia AI: Error updating responded state in local storage:", error);
    throw error;
  }
}

/**
 * Fetches follow-up suggestions from the background script.
 * @param {string} userEmail - The user's email for whom to fetch suggestions.
 * @returns {Promise<Array<object>>} An array of follow-up suggestion objects.
 */
export async function fetchFollowUpSuggestionsService(userEmail) {
  if (!userEmail) {
    console.warn("AppMailia AI: Cannot fetch follow-up suggestions - no user email.");
    return [];
  }
  try {
    const response = await sendMessageToBackground({
      type: 'FETCH_FOLLOWUP_SUGGESTIONS',
      userEmail: userEmail
    });
    if (response.success && Array.isArray(response.suggestions)) {
      return response.suggestions;
    } else {
      console.error("❌ AppMailia AI: Failed to fetch follow-up suggestions from background:", response.error);
      return [];
    }
  } catch (error) {
    console.error("❌ AppMailia AI: Error fetching follow-up suggestions:", error);
    return [];
  }
}

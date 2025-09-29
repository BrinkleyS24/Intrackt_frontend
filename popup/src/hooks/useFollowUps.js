/**
 * @file popup/src/hooks/useFollowUps.js
 * @description Custom React hook for managing follow-up suggestions and their states.
 * It interfaces with followUpService.js for local storage and background script communication.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getFollowUpStateService,
  markFollowedUpService,
  updateRespondedStateService,
  fetchFollowUpSuggestionsService
} from '../services/followUpService';
import { showNotification } from '../components/Notification'; // Assuming Notification component handles toasts
import { differenceInDays } from '../utils/uiHelpers'; // Reusing utility

export function useFollowUps(userEmail, userId, userPlan) { // Accept userPlan as a parameter
  const [followUpSuggestions, setFollowUpSuggestions] = useState([]);
  const [followedUpMap, setFollowedUpMap] = useState({}); // { threadId: timestamp }
  const [respondedMap, setRespondedMap] = useState({}); // { threadId: boolean }
  const [loadingSuggestions, setLoadingSuggestions] = useState(false); // New state for loading status

  // Load initial state from local storage on mount
  useEffect(() => {
    const loadInitialFollowUpState = async () => {
      try {
        const { followedUpMap, respondedMap } = await getFollowUpStateService();
        setFollowedUpMap(followedUpMap);
        setRespondedMap(respondedMap);
      } catch (error) {
        console.error("Error loading initial follow-up state:", error);
        showNotification("Failed to load follow-up states.", "error");
      }
    };
    loadInitialFollowUpState();
  }, []);

  // Function to load follow-up suggestions from the backend
  const loadFollowUpSuggestions = useCallback(async () => {
    if (!userEmail || !userId) {
      console.warn("Intrackt: Cannot load follow-up suggestions - user not logged in or ID missing.");
      setFollowUpSuggestions([]);
      return;
    }

    // Only fetch suggestions if the user is premium
    if (userPlan !== 'premium') {
      console.log("Intrackt: Follow-up suggestions are a premium feature. Skipping fetch for free user.");
      setFollowUpSuggestions([]); // Clear any old suggestions
      return;
    }

    setLoadingSuggestions(true);
    try {
      const fetchedSuggestions = await fetchFollowUpSuggestionsService(userEmail);
      console.log("DEBUG useFollowUps: Raw fetched suggestions from service:", fetchedSuggestions);

      // Merge with local followedUpMap and respondedMap
      // Normalize/enrich suggestion objects so the UI has predictable fields
      const mergedSuggestions = fetchedSuggestions.map(suggestion => {
        const threadId = suggestion.thread_id || suggestion.threadId || suggestion.thread || suggestion.id || suggestion.email_id || suggestion.emailId;
        const from = suggestion.from || suggestion.sender || '';
        const subject = suggestion.subject || suggestion.title || '';
        const daysAgo = (suggestion.date) ? Math.max(0, Math.round((Date.now() - new Date(suggestion.date).getTime()) / (1000*60*60*24))) : undefined;

        // Heuristic: try to split a "from" into company/position if backend provided structured fields
        const company = suggestion.company || suggestion.org || (from.includes('@') ? from.split('@')[1] : from);
        const position = suggestion.position || suggestion.role || suggestion.jobTitle || '';

        // Provide small, safe defaults for fields the Dashboard expects
        const enriched = {
          ...suggestion,
          threadId,
          id: suggestion.id || threadId,
          title: suggestion.title || subject || 'Follow up',
          description: suggestion.description || '',
          urgency: (suggestion.urgency || suggestion.priority || 'medium'),
          impact: (suggestion.impact || suggestion.importance || 'medium'),
          company: company || '',
          position: position || '',
          daysAgo,
          estimatedTime: suggestion.estimatedTime || suggestion.eta || suggestion.estimate || '10 mins',
          actionType: suggestion.actionType || suggestion.type || 'follow_up',
          followedUp: !!followedUpMap[threadId],
          responded: !!respondedMap[threadId],
        };
        return enriched;
      });

      // Filter out suggestions that have already been followed up or responded to
      const filteredSuggestions = mergedSuggestions.filter(suggestion =>
        !suggestion.followedUp && !suggestion.responded
      );

      console.log("DEBUG useFollowUps: Final merged and filtered suggestions:", filteredSuggestions);
      setFollowUpSuggestions(filteredSuggestions);
    } catch (error) {
      console.error("❌ Intrackt: Error fetching follow-up suggestions:", error);
      // Show specific error if it's a premium feature error
      if (error.message && error.message.includes("Premium feature")) {
        showNotification("Follow-up suggestions: Premium feature. Upgrade to unlock.", "info");
      } else {
        showNotification(`Failed to load follow-up suggestions: ${error.message}`, "error");
      }
      setFollowUpSuggestions([]); // Clear suggestions on error
    } finally {
      setLoadingSuggestions(false);
    }
  }, [userEmail, userId, userPlan, followedUpMap, respondedMap]); // Add userPlan to dependencies

  const markFollowedUp = useCallback(async (threadId) => {
    try {
      const { followedUpAt } = await markFollowedUpService(threadId);
      // Update local state immediately
      setFollowedUpMap(prev => ({ ...prev, [threadId]: followedUpAt }));
      showNotification("Follow-up marked!", "success");
      // Re-load suggestions to reflect the change immediately
      loadFollowUpSuggestions(); // Now `loadFollowUpSuggestions` uses the `userEmail` from the hook's scope

    } catch (error) {
      console.error("Error marking followed up:", error);
      showNotification(`Failed to mark follow-up: ${error.message}`, "error");
    }
  }, [loadFollowUpSuggestions]); // Only depend on loadFollowUpSuggestions

  const updateRespondedState = useCallback(async (threadId, isChecked, currentFollowedUpAt) => {
    try {
      const { followedUpAt: newFollowedUpAt } = await updateRespondedStateService(threadId, isChecked, currentFollowedUpAt);

      setRespondedMap(prev => ({ ...prev, [threadId]: isChecked }));
      setFollowedUpMap(prev => ({ ...prev, [threadId]: newFollowedUpAt || undefined })); // Remove if null

      showNotification("Responded state updated!", "success");
      // Re-load suggestions to reflect the change immediately
      loadFollowUpSuggestions(); // Now `loadFollowUpSuggestions` uses the `userEmail` from the hook's scope

    } catch (error) {
      console.error("Error updating responded state:", error);
      showNotification(`Failed to update responded state: ${error.message}`, "error");
    }
  }, [loadFollowUpSuggestions]); // Only depend on loadFollowUpSuggestions


  // Initial load of follow-up suggestions when userEmail, userId, and userPlan are available
  useEffect(() => {
    if (userEmail && userId && userPlan) { // Ensure userPlan is also available
      loadFollowUpSuggestions();
    }
  }, [userEmail, userId, userPlan, loadFollowUpSuggestions]); // Add userPlan to dependencies


  return {
    followUpSuggestions,
    followedUpMap,
    respondedMap,
    markFollowedUp,
    updateRespondedState,
    loadFollowUpSuggestions,
    loadingSuggestions,
  };
}

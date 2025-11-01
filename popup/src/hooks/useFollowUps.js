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
      console.warn("AppMailia AI: Cannot load follow-up suggestions - user not logged in or ID missing.");
      setFollowUpSuggestions([]);
      return;
    }

    // Only fetch suggestions if the user is premium
    if (userPlan !== 'premium') {
      setFollowUpSuggestions([]); // Clear any old suggestions
      return;
    }

    setLoadingSuggestions(true);
    try {
      const fetchedSuggestions = await fetchFollowUpSuggestionsService(userEmail);

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
        
        const actionType = suggestion.actionType || suggestion.type || 'follow_up';
        const category = (suggestion.category || '').toLowerCase();

        // Calculate urgency based on timing and action type
        // Color system: Red (high urgency) = 7+ days, Amber (medium) = 3-6 days, Blue (low) = 0-2 days or strategic
        let urgency = suggestion.urgency || suggestion.priority;
        if (!urgency) {
          // Intelligent urgency calculation based on action type
          switch (actionType) {
            case 'thank_you':
              // Thank-you notes are ALWAYS high priority (time-sensitive)
              urgency = 'high';  // Red: Send within 24-48 hours of interview
              break;
            
            case 'status_check':
              // Status checks are high priority (you've waited long enough)
              urgency = 'high';  // Red: Time to check in (7+ days elapsed)
              break;
            
            case 'follow_up':
              // Regular follow-ups are medium priority (optimal window)
              urgency = 'medium'; // Amber: Good timing to follow up (3-13 days)
              break;
            
            case 'research':
              // Research is low priority (strategic, no immediate deadline)
              urgency = 'low';   // Blue: Prepare while waiting for response (0-6 days)
              break;
            
            case 'networking':
            case 'portfolio':
              // Strategic actions are low priority
              urgency = 'low';   // Blue: Long-term value, no urgency
              break;
            
            default:
              // Fallback based on days for any unrecognized action types
              if (daysAgo >= 7) urgency = 'high';
              else if (daysAgo >= 3) urgency = 'medium';
              else urgency = 'low';
          }
        }

        // Calculate impact based on action type and context
        let impact = suggestion.impact || suggestion.importance;
        if (!impact) {
          if (actionType === 'thank_you' || actionType === 'networking') {
            impact = 'high'; // Relationship-building has high impact
          } else if (actionType === 'follow_up' && daysAgo >= 7) {
            impact = 'high'; // Timely follow-ups boost response rates
          } else if (actionType === 'research') {
            impact = 'medium'; // Research helps but isn't immediate
          } else {
            impact = 'medium';
          }
        }

        // Provide small, safe defaults for fields the Dashboard expects
        const enriched = {
          ...suggestion,
          threadId,
          id: suggestion.id || threadId,
          title: suggestion.title || subject || 'Follow up',
          description: suggestion.description || '',
          urgency,
          impact,
          company: company || '',
          position: position || '',
          daysAgo,
          estimatedTime: suggestion.estimatedTime || suggestion.eta || suggestion.estimate || '10 mins',
          actionType,
          followedUp: !!followedUpMap[threadId],
          responded: !!respondedMap[threadId],
        };
        return enriched;
      });

      // Filter out suggestions that have already been followed up or responded to
      const filteredSuggestions = mergedSuggestions.filter(suggestion =>
        !suggestion.followedUp && !suggestion.responded
      );

      setFollowUpSuggestions(filteredSuggestions);
    } catch (error) {
      console.error("❌ AppMailia AI: Error fetching follow-up suggestions:", error);
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

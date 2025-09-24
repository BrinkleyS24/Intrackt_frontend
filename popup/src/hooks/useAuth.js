/**
 * @file popup/src/hooks/useAuth.js
 * @description Custom React hook for managing user authentication state and actions
 * by communicating with the background script for Firebase Auth operations.
 * This hook now relies solely on chrome.storage.local and messages from the background script
 * for authentication state, removing direct Firebase Auth listener from the popup.
 */

import { useState, useEffect, useCallback } from 'react';
import { sendMessageToBackground } from '../utils/chromeMessaging'; // Centralized messaging
import { fetchUserPlanFromService } from '../services/authService';
import { showNotification } from '../components/Notification';
// REMOVED: import { onAuthStateChanged } from 'firebase/auth'; // No longer needed here

// The 'auth' instance is no longer passed as a parameter.
// useAuth.js
import { useState, useCallback, useEffect } from 'react';

export const useAuth = (onPaymentStatusChange) => {
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userPlan, setUserPlan] = useState('free');
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // Indicates initial auth state check is done
  const [quotaData, setQuotaData] = useState(null); // New state for quota data
  const [loadingAuth, setLoadingAuth] = useState(true); // Indicate if auth state is still loading (INITIALIZED TO TRUE)
  const isLoggedIn = !!userEmail; // Derived state

  // Function to check payment status from backend (using authenticated subscription status)
  const checkPaymentStatus = useCallback(async () => {
    console.log('🔍 checkPaymentStatus called with userEmail:', userEmail, 'userId:', userId);
    if (!userEmail || !userId) {
      console.log('❌ checkPaymentStatus: Missing userEmail or userId, skipping');
      return;
    }
    
    try {
      console.log('🔍 Checking subscription status from authenticated backend endpoint...');
      const response = await sendMessageToBackground({
        type: 'CHECK_SUBSCRIPTION_STATUS',
        userEmail: userEmail,
        userId: userId
      });
      
      console.log('📨 Backend subscription response:', response);
      
      if (response.success && response.subscription) {
        const currentPlan = response.subscription.plan;
        console.log('🔍 Current subscription plan:', currentPlan, 'vs stored plan:', userPlan);
        
        if (currentPlan && currentPlan !== userPlan) {
          console.log('💳 Subscription status updated:', currentPlan);
          const previousPlan = userPlan;
          setUserPlan(currentPlan);
          // Update storage to persist the change
          await chrome.storage.local.set({ userPlan: currentPlan });
          showNotification('Payment confirmed! Premium features unlocked.', 'success');
          
          // Close premium modal if user upgraded from free to premium
          if (previousPlan === 'free' && currentPlan === 'premium' && onPaymentStatusChange) {
            console.log('🎉 Payment upgrade detected! Closing premium modal...');
            onPaymentStatusChange(currentPlan, previousPlan);
          }
        } else if (response.success) {
          console.log('✅ Subscription status checked, no change needed. Current plan:', currentPlan);
        }
      }
    } catch (error) {
      console.error('❌ Error checking subscription status:', error);
    }
  }, [userEmail, userId, userPlan, showNotification]);

  // Function to load and update current user state from chrome.storage.local
  // This is now the primary source of truth for the popup's UI state.
  const loadCurrentUserStateFromStorage = useCallback(async () => {
    try {
      console.log("✅ AppMailia AI: Loading user state from storage...");
      const result = await chrome.storage.local.get(['userEmail', 'userName', 'userId', 'userPlan']); // Added userId, userPlan
      console.log("✅ AppMailia AI: Loaded user state from storage:", result);

      setUserEmail(result.userEmail || null);
      setUserName(result.userName || null);
      setUserId(result.userId || null); // Set userId from storage
      setUserPlan(result.userPlan || 'free'); // Set userPlan from storage, default to 'free'
      
      console.log('📊 Current user state after storage load:', {
        userEmail: result.userEmail,
        userPlan: result.userPlan || 'free',
        userId: result.userId
      });

      // Mark auth as ready once initial state is loaded from storage
      setIsAuthReady(true);
      setLoadingAuth(false);
    } catch (error) {
      console.error("❌ AppMailia AI: Error loading user state from storage:", error);
      setIsAuthReady(true); // Still mark as ready even on error to unblock UI
      setLoadingAuth(false);
    }
  }, []);

  // Function to fetch quota data from the background script
  const fetchQuotaData = useCallback(async () => {
    if (!userEmail || !userId) {
      console.warn("AppMailia AI: Cannot fetch quota data - user not logged in or userId missing.");
      setQuotaData(null); // Clear quota if user is not logged in
      return;
    }
    try {
      // Send a specific message to background to fetch only quota data
      const response = await sendMessageToBackground({
        type: "FETCH_QUOTA_DATA", // Corrected: New message type
        userEmail: userEmail,
        userId: userId,
      });

      if (response.success && response.quota) {
        setQuotaData(response.quota);
      } else {
        console.error("❌ AppMailia AI: Failed to fetch quota data:", response.error);
        setQuotaData(null); // Clear quota on error
      }
    } catch (error) {
      console.error("❌ AppMailia AI: Error fetching quota data:", error);
      setQuotaData(null); // Clear quota on error
    }
  }, [userEmail, userId]); // Depend on userEmail and userId


  // Initial load from storage when the hook mounts.
  // This replaces the Firebase onAuthStateChanged listener in the popup.
  useEffect(() => {
    loadCurrentUserStateFromStorage();
  }, [loadCurrentUserStateFromStorage]);

  // Check payment status when popup opens and user is logged in
  useEffect(() => {
    // Check payment status if we have user credentials (don't wait for full auth ready)
    if (userEmail && userId) {
      checkPaymentStatus();
    }
  }, [userEmail, userId, checkPaymentStatus]);


  // Listen for changes in chrome.storage.local and update state
  // This listener ensures the UI state in the popup stays synchronized
  // with changes made by the background script (e.g., after login/logout, or plan updates).
  useEffect(() => {
    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'local') {
        console.log('🔍 Storage change detected:', changes);
        // Only trigger a re-load if relevant auth/user data changes
        if (changes.userEmail || changes.userName || changes.userPlan || changes.userId) { // Added userId
          console.log("🔄 Detected storage change in user data. Re-loading state.");
          console.log('Previous userPlan:', changes.userPlan?.oldValue, '→ New userPlan:', changes.userPlan?.newValue);
          loadCurrentUserStateFromStorage(); // Re-load state from storage
        }
      }
    };

    // Also listen for custom userPlanUpdated events for immediate UI refresh
    const handleUserPlanUpdate = (event) => {
      console.log('🎯 Received userPlanUpdated event:', event.detail);
      loadCurrentUserStateFromStorage();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    window.addEventListener('userPlanUpdated', handleUserPlanUpdate);

    return () => {
      console.log("DEBUG useAuth: Cleaning up listeners.");
      chrome.storage.onChanged.removeListener(handleStorageChange);
      window.removeEventListener('userPlanUpdated', handleUserPlanUpdate);
    };
  }, [loadCurrentUserStateFromStorage]);


  // Fetch quota data whenever userEmail or userId changes (after initial auth setup)
  // This is separate from the initial storage load to ensure it runs if userEmail/userId changes
  // or if it's set from storage.
  useEffect(() => {
    if (userEmail && userId && isAuthReady) { // Ensure userId is also present and auth is ready
      console.log("DEBUG useAuth: userEmail, userId or isAuthReady changed. Re-fetching quota data.");
      fetchQuotaData();
    }
  }, [userEmail, userId, isAuthReady, fetchQuotaData]);


  // Function to initiate Google OAuth login flow
  const loginGoogleOAuth = useCallback(async () => {
    console.log("DEBUG useAuth: Initiating login process by sending LOGIN_GOOGLE_OAUTH message to background.");
    setLoadingAuth(true); // Start loading when login initiated
    try {
      const response = await sendMessageToBackground({ type: 'LOGIN_GOOGLE_OAUTH' });
      if (response.success) {
        console.log("DEBUG useAuth: Login message sent successfully. Background script will update storage.");
        // The chrome.storage.onChanged listener will pick up updates from background script
      } else {
        console.error("❌ AppMailia AI: Error during Google OAuth login process:", response.error);
        showNotification(`Login failed: ${response.error}`, "error");
        setLoadingAuth(false); // Stop loading on error
      }
    } catch (error) {
      console.error("❌ AppMailia AI: Error during Google OAuth login process:", error);
      showNotification(`Login failed: ${error.message || "Network error during login."}`, "error");
      setLoadingAuth(false); // Stop loading on error
    }
  }, []);

  return {
    userEmail,
    userName,
    userPlan,
    userId, // Export userId
    isLoggedIn,
    isAuthReady,
    loadingAuth,
    quotaData,
    fetchUserPlan: fetchUserPlanFromService, // Expose service function directly
    fetchQuotaData, // Expose the memoized fetchQuotaData
    reloadUserState: loadCurrentUserStateFromStorage, // Expose reload function for immediate refresh
    loginGoogleOAuth, // Expose the login function
    logout: useCallback(async () => {
      console.log("DEBUG useAuth: Initiating logout process.");
      try {
        await sendMessageToBackground({ type: 'LOGOUT' });
        showNotification("Logged out successfully!", "info");
        // State will be cleared by chrome.storage.onChanged listener
      } catch (error) {
        console.error("❌ AppMailia AI: Error during logout:", error);
        showNotification(`Logout failed: ${error.message}`, "error");
      }
    }, []),
  };
}

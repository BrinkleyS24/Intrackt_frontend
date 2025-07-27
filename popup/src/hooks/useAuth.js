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
export function useAuth() {
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userPlan, setUserPlan] = useState('free');
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // Indicates initial auth state check is done
  const [quotaData, setQuotaData] = useState(null); // New state for quota data
  const [loadingAuth, setLoadingAuth] = useState(true); // Indicate if auth state is still loading (INITIALIZED TO TRUE)
  const isLoggedIn = !!userEmail; // Derived state

  // Function to load and update current user state from chrome.storage.local
  // This is now the primary source of truth for the popup's UI state.
  const loadCurrentUserStateFromStorage = useCallback(async () => {
    try {
      console.log("✅ Intrackt: Loading user state from storage...");
      const result = await chrome.storage.local.get(['userEmail', 'userName', 'userId', 'userPlan']); // Added userId, userPlan
      console.log("✅ Intrackt: Loaded user state from storage:", result);

      setUserEmail(result.userEmail || null);
      setUserName(result.userName || null);
      setUserId(result.userId || null); // Set userId from storage
      setUserPlan(result.userPlan || 'free'); // Set userPlan from storage, default to 'free'

      // Mark auth as ready once initial state is loaded from storage
      setIsAuthReady(true);
      setLoadingAuth(false);
    } catch (error) {
      console.error("❌ Intrackt: Error loading user state from storage:", error);
      setIsAuthReady(true); // Still mark as ready even on error to unblock UI
      setLoadingAuth(false);
    }
  }, []);

  // Function to fetch quota data from the background script
  const fetchQuotaData = useCallback(async () => {
    if (!userEmail || !userId) {
      console.warn("Intrackt: Cannot fetch quota data - user not logged in or userId missing.");
      setQuotaData(null); // Clear quota if user is not logged in
      return;
    }
    console.log("DEBUG useAuth: Fetching quota data from background.");
    try {
      // Send a specific message to background to fetch only quota data
      const response = await sendMessageToBackground({
        type: "FETCH_QUOTA_DATA", // Corrected: New message type
        userEmail: userEmail,
        userId: userId,
      });

      if (response.success && response.quota) {
        setQuotaData(response.quota);
        console.log("✅ Intrackt: Quota data fetched:", response.quota);
      } else {
        console.error("❌ Intrackt: Failed to fetch quota data:", response.error);
        setQuotaData(null); // Clear quota on error
      }
    } catch (error) {
      console.error("❌ Intrackt: Error fetching quota data:", error);
      setQuotaData(null); // Clear quota on error
    }
  }, [userEmail, userId]); // Depend on userEmail and userId


  // Initial load from storage when the hook mounts.
  // This replaces the Firebase onAuthStateChanged listener in the popup.
  useEffect(() => {
    console.log("DEBUG useAuth: Initializing user state from storage.");
    loadCurrentUserStateFromStorage();
  }, [loadCurrentUserStateFromStorage]);


  // Listen for changes in chrome.storage.local and update state
  // This listener ensures the UI state in the popup stays synchronized
  // with changes made by the background script (e.g., after login/logout, or plan updates).
  useEffect(() => {
    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'local') {
        // Only trigger a re-load if relevant auth/user data changes
        if (changes.userEmail || changes.userName || changes.userPlan || changes.userId) { // Added userId
          console.log("DEBUG useAuth: Detected storage change in user data. Re-loading state.");
          loadCurrentUserStateFromStorage(); // Re-load state from storage
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      console.log("DEBUG useAuth: Cleaning up chrome.storage.onChanged listener.");
      chrome.storage.onChanged.removeListener(handleStorageChange);
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
        console.error("❌ Intrackt: Error during Google OAuth login process:", response.error);
        showNotification(`Login failed: ${response.error}`, "error");
        setLoadingAuth(false); // Stop loading on error
      }
    } catch (error) {
      console.error("❌ Intrackt: Error during Google OAuth login process:", error);
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
    loginGoogleOAuth, // Expose the login function
    logout: useCallback(async () => {
      console.log("DEBUG useAuth: Initiating logout process.");
      try {
        await sendMessageToBackground({ type: 'LOGOUT' });
        showNotification("Logged out successfully!", "info");
        // State will be cleared by chrome.storage.onChanged listener
      } catch (error) {
        console.error("❌ Intrackt: Error during logout:", error);
        showNotification(`Logout failed: ${error.message}`, "error");
      }
    }, []),
  };
}

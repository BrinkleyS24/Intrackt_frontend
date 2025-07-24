/**
 * @file popup/src/hooks/useAuth.js
 * @description Custom React hook for managing user authentication state and actions
 * by communicating with the background script for Firebase Auth operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { sendMessageToBackground } from '../utils/chromeMessaging'; // Centralized messaging
import { fetchUserPlanFromService } from '../services/authService';
import { showNotification } from '../components/Notification';
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged

export function useAuth(auth) { // Accept Firebase auth instance
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userPlan, setUserPlan] = useState('free');
  const [userId, setUserId] = useState(null); // New state for userId
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
    } catch (error) {
      console.error("❌ Intrackt: Error loading user state from storage:", error);
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


  // Firebase Auth listener (runs once on component mount)
  useEffect(() => {
    console.log("DEBUG useAuth: Setting up Firebase Auth listener.");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("DEBUG useAuth: onAuthStateChanged triggered. User:", user);
      if (user) {
        console.log("DEBUG useAuth: User logged in.");
        // When a user logs in, ensure their data is in storage and fetch plan
        await chrome.storage.local.set({
          userEmail: user.email,
          userName: user.displayName || user.email,
          userId: user.uid, // Store UID
        });
        // Fetch the user plan from the backend immediately after Firebase auth
        const plan = await fetchUserPlanFromService(user.email);
        await chrome.storage.local.set({ userPlan: plan });

        // Update local state from storage after all updates
        await loadCurrentUserStateFromStorage();

      } else {
        console.log("DEBUG useAuth: User logged out.");
        // Clear user info from storage on logout
        await chrome.storage.local.remove(['userEmail', 'userName', 'userId', 'userPlan']);
        await loadCurrentUserStateFromStorage(); // Update local state to nulls
      }
      setIsAuthReady(true);
      setLoadingAuth(false);
      console.log("DEBUG useAuth: Auth state listener finished. isAuthReady:", true, "loadingAuth:", false);
    });

    // Initial load from storage
    loadCurrentUserStateFromStorage();

    return () => {
      console.log("DEBUG useAuth: Cleaning up Firebase Auth listener.");
      unsubscribe();
    };
  }, [auth, loadCurrentUserStateFromStorage]); // Only depend on auth and the memoized callback


  // Listen for changes in chrome.storage.local and update state
  useEffect(() => {
    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'local') {
        // Only trigger a re-load if relevant auth/user data changes
        if (changes.userEmail || changes.userName || changes.userPlan || changes.userId) { // Added userId
          setIsAuthReady(true);
          setLoadingAuth(false);
          console.log("DEBUG useAuth: Auth state readiness set due to storage change.");
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      console.log("DEBUG useAuth: Cleaning up chrome.storage.onChanged listener.");
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []); // No dependencies, runs once for listener setup


  // Fetch quota data whenever userEmail or userId changes (after initial auth setup)
  // This is separate from the auth listener to ensure it runs if userEmail/userId changes
  // outside of the initial onAuthStateChanged, or if it's set from storage.
  useEffect(() => {
    if (userEmail && userId && isAuthReady) { // Ensure userId is also present
      console.log("DEBUG useAuth: userEmail, userId or isAuthReady changed. Re-fetching quota data.");
      fetchQuotaData();
    }
  }, [userEmail, userId, isAuthReady, fetchQuotaData]); // Added userId to dependencies


  // Function to initiate Google OAuth login flow
  const loginGoogleOAuth = useCallback(async () => {
    console.log("DEBUG useAuth: Initiating login process by sending LOGIN_GOOGLE_OAUTH message to background.");
    setLoadingAuth(true); // Start loading when login initiated
    try {
      const response = await sendMessageToBackground({ type: 'LOGIN_GOOGLE_OAUTH' });
      if (response.success) {
        console.log("DEBUG useAuth: Login message sent successfully. Waiting for AUTH_READY from background.");
        // The AUTH_READY message from background will update state via onAuthStateChanged and storage listener
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
        // State will be cleared by onAuthStateChanged listener
      } catch (error) {
        console.error("❌ Intrackt: Error during logout:", error);
        showNotification(`Logout failed: ${error.message}`, "error");
      }
    }, []),
  };
}

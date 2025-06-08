import { showNotification } from "../ui/notification.js";



export async function handleLogin(
    state,
    elements,
    toggleUI,
    updatePremiumButton,
    fetchUserPlan,
    loadFollowUpSuggestions,
    fetchStoredEmails,
    fetchNewEmails,
    updateWelcomeHeader,
    setLoadingState,
    CONFIG,
    applyFilters
) {
    if (typeof setLoadingState === "function") {
        setLoadingState(true);
    }

    try {
        console.log("📦 Received setLoadingState:", typeof setLoadingState);
        const response = await chrome.runtime.sendMessage({ type: "LOGIN" });
        if (!response.success) throw new Error(response.error);

        state.userEmail = response.email;
        state.token = response.token;

        await chrome.storage.local.set({
            gmail_token: response.token,
            userEmail: response.email
        });

        await fetchUserPlan();
        updatePremiumButton(true, state, elements);
        toggleUI(true, state, elements);

        const profile = await getUserInfo(state.token, updateWelcomeHeader);
        updateWelcomeHeader(profile.name);

        await fetchStoredEmails(state, elements, setLoadingState, CONFIG);
        await fetchNewEmails(state, elements, applyFilters, CONFIG);;

        await loadFollowUpSuggestions();

    } catch (err) {
        showNotification(`Login failed: ${err.message}`, "error");
    } finally {
        if (typeof setLoadingState === "function") {
            setLoadingState(false);
        }
    }
}



export async function handleLogout(state, elements, toggleUI, updatePremiumButton, updateWelcomeHeader, resetAppState) {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    resetAppState();
    toggleUI(false, state, elements)
    updatePremiumButton(false, state, elements);
    updateWelcomeHeader(null);
    clearStoredUserData();
    showNotification("Successfully logged out", "success");
}

export function clearStoredUserData() {
    chrome.storage.local.remove([
        'userEmail',
        'gmail_token',
        'currentPage',
        'currentCategory',
        'userName'
    ]);
}

export function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                console.error("Error fetching auth token:", chrome.runtime.lastError?.message);
                reject(new Error("Failed to get auth token."));
                return;
            }
            resolve(token);
        });
    });
}

export async function getUserInfo(token, updateWelcomeHeader) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["userName"], async (data) => {
            if (data.userName) {
                if (typeof updateWelcomeHeader === 'function') {
                    updateWelcomeHeader(data.userName);
                }
                return resolve({ name: data.userName });
            }

            try {
                const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        showNotification("Session expired. Please click the Sign In button to reauthenticate.", "error");
                        return reject(new Error("Unauthorized: Your token might be expired. Please reauthenticate via the Sign In button."));
                    }
                    throw new Error(`Profile fetch HTTP ${response.status}`);
                }

                const profile = await response.json();

                if (profile.name && typeof updateWelcomeHeader === 'function') {
                    chrome.storage.local.set({ userName: profile.name });
                    updateWelcomeHeader(profile.name);
                }

                resolve(profile);
            } catch (err) {
                console.error("❌ Failed to get user info:", err);
                reject(err);
            }
        });
    });
}
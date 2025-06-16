// UI utility imports - these remain unchanged as they handle local UI updates.
import { showNotification } from "../ui/notification.js";
import { updatePage } from "../ui/pagination.js";
import { updateCategoryCounts } from "../ui/emailUI.js";
import { handleQuotaNotification } from "../ui/quotaBanner.js";

/**
 * Normalizes email data received from the backend, ensuring consistent property names.
 * @param {object} email - The email object to normalize.
 * @returns {object} The normalized email object.
 */
export function normalizeEmailData(email) {
    return {
        ...email,
        emailId: email.emailId || email.email_id,
        threadId: email.threadId || email.thread_id,
        // Ensure date is a valid ISO string, defaulting to now if not present.
        date: email.date ? new Date(email.date).toISOString() : new Date().toISOString()
    };
}

/**
 * Fetches stored categorized emails from the backend via the background script.
 * Updates local state and UI accordingly.
 * @param {object} state - The global state object (e.g., from popup.js).
 * @param {object} elements - DOM elements object.
 * @param {function} setLoadingState - Function to update loading UI state.
 * @param {object} CONFIG - Configuration object containing API endpoints.
 * @async
 */
export async function fetchStoredEmails(state, elements, setLoadingState, CONFIG) {
    setLoadingState(true);
    try {
        // Send a message to the background script to fetch stored emails.
        // The background script will handle the actual API call.
        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_STORED_EMAILS',
            userEmail: state.userEmail
        });

        if (!response.success) {
            throw new Error(response.error || "Failed to fetch stored emails from background.");
        }

        const data = response; // The response already contains the data

        // Initialize categories to ensure all expected categories are present.
        state.categorizedEmails = { Applied: [], Interviewed: [], Offers: [], Rejected: [] };

        // Process and normalize the fetched emails.
        for (const [category, emails] of Object.entries(data.categorizedEmails)) {
            if (state.categorizedEmails.hasOwnProperty(category) && Array.isArray(emails)) {
                for (const email of emails) {
                    const normalized = normalizeEmailData(email);
                    state.categorizedEmails[category].push(normalized);
                }
            } else {
                console.warn(`Intrackt: Skipping unknown or invalid category "${category}" during stored email processing.`);
            }
        }

        // Sort emails within each category by date.
        Object.values(state.categorizedEmails).forEach(category =>
            category.sort((a, b) =>
                new Date(b.date || b.created_at) - new Date(a.date || a.created_at)
            )
        );

        // Update local storage and UI.
        await chrome.storage.local.set({ categorizedEmails: state.categorizedEmails });
        state.currentPage = 1;
        updatePage(1, state, elements, CONFIG);
        updateCategoryCounts(state, elements);

    } catch (error) {
        console.error("❌ Intrackt: Fetch stored emails error:", error);
        showNotification("Failed to load emails.", "error"); // Use showNotification instead of alert
    } finally {
        setLoadingState(false);
    }
}

/**
 * Fetches user quota data from the backend via the background script.
 * Handles and displays quota notifications.
 * @param {object} state - The global state object.
 * @param {object} elements - DOM elements object.
 * @async
 */
export async function fetchQuotaData(state, elements) { // Added 'elements' parameter
    try {
        // Send a message to the background script to fetch quota data.
        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_QUOTA_DATA',
            userEmail: state.userEmail
        });

        if (!response.success) {
            // Log the error but don't show a blocking alert.
            console.error("❌ Intrackt: Failed to fetch quota data from background:", response.error);
            return; // Exit if fetching failed
        }

        const quotaData = response.quota;

        if (quotaData) {
            handleQuotaNotification(quotaData, state, elements);
        }
    } catch (error) {
        console.error("❌ Intrackt: Error fetching quota data:", error);
    }
}

/**
 * Fetches new categorized emails from the backend via the background script.
 * Merges new emails with existing ones, updates state, and refreshes UI.
 * @param {object} state - The global state object.
 * @param {object} elements - DOM elements object.
 * @param {function} applyFilters - Function to re-apply filters after new emails are fetched.
 * @param {object} CONFIG - Configuration object.
 * @async
 */
export async function fetchNewEmails(state, elements, applyFilters, CONFIG) {
    const { userEmail, userPlan, isFilteredView, newEmailsCounts } = state;

    if (!userEmail) {
        console.error("❌ Intrackt: Cannot fetch new emails without user email.");
        showNotification("Please log in to fetch new emails.", "warning");
        return;
    }

    console.log("📌 Intrackt: Requesting new emails from background script...");
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_NEW_EMAILS',
            userEmail: userEmail,
        });

        if (!response.success) {
            console.error("❌ Intrackt: Failed to fetch new emails from background:", response.error);
            showNotification(`Failed to fetch new emails: ${response.error}`, "error");

            if (response.quota?.usagePercentage >= 100 && userPlan !== "premium") {
                showNotification("🚫 You've reached your quota. Upgrade for more access.", "warning");
                handleQuotaNotification(response.quota, state, elements);
            } else if (response.quota) {
                 handleQuotaNotification(response.quota, state, elements);
            }
            return; 
        }

        const data = response;

        if (Array.isArray(data.categorizedEmails)) {
            console.error("❌ Intrackt: categorizedEmails should be an object, got array:", data.categorizedEmails);
            return;
        }

        // Get stored emails to merge new ones
        const storedEmails = await new Promise(resolve => {
            chrome.storage.local.get(["categorizedEmails"], res => {
                const emails = res.categorizedEmails || { Applied: [], Interviewed: [], Offers: [], Rejected: [] };
                // Ensure all default categories exist in storedEmails
                for (const category in { Applied: [], Interviewed: [], Offers: [], Rejected: [] }) {
                    if (!emails.hasOwnProperty(category)) {
                        emails[category] = [];
                    }
                }
                resolve(emails);
            });
        });

        const updatedEmails = { ...storedEmails };
        let totalNewEmails = 0;

        Object.entries(data.categorizedEmails).forEach(([category, newEmails]) => {
            const validCategories = ['Applied', 'Interviewed', 'Offers', 'Rejected'];
            if (!validCategories.includes(category)) {
                console.warn(`⚠ Intrackt: Skipping unknown or invalid category "${category}" for new emails.`);
                return;
            }

            if (!Array.isArray(newEmails)) {
                console.warn(`⚠ Intrackt: Skipping category "${category}" — expected array of new emails, got`, newEmails);
                return;
            }

            const normalizedNew = newEmails.map(email => normalizeEmailData(email)); // Use normalizeEmailData

            if (!updatedEmails[category]) {
                updatedEmails[category] = [];
            }

            const existingIds = new Set(updatedEmails[category].map(e => e.emailId));
            const emailsToAdd = normalizedNew.filter(e => !existingIds.has(e.emailId));

            totalNewEmails += emailsToAdd.length;
            newEmailsCounts[category] += emailsToAdd.length;

            updatedEmails[category] = [
                ...updatedEmails[category],
                ...emailsToAdd
            ];
        });

        const newEmailFound = totalNewEmails > 0;

        // Save updated emails to local storage and refresh UI
        await chrome.storage.local.set({ categorizedEmails: updatedEmails });
        console.log(newEmailFound
            ? "✅ Intrackt: New emails merged successfully."
            : "ℹ Intrackt: No new emails detected.");

        state.categorizedEmails = updatedEmails;

        if (newEmailFound) {
            showNotification("📥 New job emails received!", "success");
        }

        state.currentPage = 1;
        // Re-apply filters or update page based on current view
        if (isFilteredView) {
            // Assuming applyFilters can handle `timeRangeWasChanged` from state or context if needed
            applyFilters(state, elements, CONFIG);
        } else {
            updatePage(1, state, elements, CONFIG);
        }

        updateCategoryCounts(state, elements);

        // Handle quota notification if data includes it
        if (data.quota) {
            handleQuotaNotification(data.quota, state, elements);
        }

    } catch (error) {
        console.error("❌ Intrackt: Error fetching new emails:", error.message);
        showNotification("Failed to fetch new emails.", "error");

        if (error.message.includes("quota reached")) {
            console.log("🔴 Intrackt: Quota reached error detected, displaying notification.");
            handleQuotaNotification(
                {
                    limit: 50,
                    usage: 50,
                    usagePercentage: 100
                },
                state,
                elements
            );
        }
    }
}

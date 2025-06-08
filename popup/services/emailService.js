import { fetchData } from "../api.js";
import { showNotification } from "../ui/notification.js";
import { updatePage } from "../ui/pagination.js";
import { updateCategoryCounts } from "../ui/emailUI.js";
import { handleQuotaNotification } from "../ui/quotaBanner.js";

export function normalizeEmailData(email) {
    return {
        ...email,
        emailId: email.emailId || email.email_id,
        threadId: email.threadId || email.thread_id,
        date: email.date ? new Date(email.date).toISOString() : new Date().toISOString()
    };
}

export async function fetchStoredEmails(state, elements, setLoadingState, CONFIG) {
    setLoadingState(true);
    try {
        const response = await fetch(
            `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.STORED_EMAILS}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: state.userEmail })
            }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

        const data = await response.json();

        state.categorizedEmails = { Applied: [], Interviewed: [], Offers: [], Rejected: [] };

        data.categorizedEmails.forEach(serverEmail => {
            const normalized = normalizeEmailData(serverEmail);
            if (state.categorizedEmails[normalized.category]) {
                state.categorizedEmails[normalized.category].push(normalized);
            }
        });

        Object.values(state.categorizedEmails).forEach(category =>
            category.sort((a, b) =>
                new Date(b.date || b.created_at) - new Date(a.date || a.created_at)
            )
        );

        chrome.storage.local.set({ categorizedEmails: state.categorizedEmails });
        state.currentPage = 1;
        updatePage(1, state, elements, CONFIG);

        updateCategoryCounts(state, elements);
        ;

    } catch (error) {
        showNotification("Failed to load emails", "error");
        console.error("Fetch stored emails error:", error);
    } finally {
        setLoadingState(false);
    }
}

export async function fetchQuotaData(state) {
    try {
        const response = await fetchData("http://localhost:3000/api/user", {
            email: state.userEmail
        });

        if (response?.quota) {
            handleQuotaNotification(response.quota, state, elements);
        }
    } catch (error) {
        console.error("Error fetching quota data:", error);
    }
}

export async function fetchNewEmails(state, elements, applyFilters, CONFIG) {
    const { token, userEmail, userPlan, categorizedEmails, isFilteredView, newEmailsCounts } = state;

    if (!token || !userEmail) {
        console.error("❌ Cannot fetch new emails without token and user email.");
        return;
    }

    console.log("📌 Fetching new emails...");
    try {
        // ✅ Move this line ABOVE any reference to `data`
        const data = await fetchData(
            `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.EMAILS}`,
            { token, email: userEmail }
        );

        // ✅ Now safe to use `data`
        if (Array.isArray(data.categorizedEmails)) {
            console.error("❌ categorizedEmails should be an object, got array:", data.categorizedEmails);
            return;
        }

        if (!data.success || !data.categorizedEmails) {
            if (data.quota?.usagePercentage >= 100 && userPlan !== "premium") {
                showNotification("🚫 You've reached your quota. Upgrade for more access.", "warning");
            }

            if (data.quota) {
                handleQuotaNotification(data.quota, state, elements);
            }

            return;
        }

        const defaultCategories = {
            Applied: [],
            Interviewed: [],
            Offers: [],
            Rejected: []
        };

        const storedEmails = await new Promise(resolve => {
            chrome.storage.local.get(["categorizedEmails"], res => {
                const emails = res.categorizedEmails || defaultCategories;
                for (const category in defaultCategories) {
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
            if (!['Applied', 'Interviewed', 'Offers', 'Rejected'].includes(category)) {
                return;
            }

            if (!Array.isArray(newEmails)) {
                console.warn(`⚠ Skipping category "${category}" — expected array, got`, newEmails);
                return;
            }

            const normalizedNew = newEmails.map(email => ({
                ...email,
                emailId: email.emailId || email.email_id,
                threadId: email.ThreadId || email.thread_id,
            }));

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

        chrome.storage.local.set({ categorizedEmails: updatedEmails }, () => {
            console.log(newEmailFound
                ? "✅ New emails merged successfully."
                : "ℹ No new emails detected.");

            state.categorizedEmails = updatedEmails;

            if (newEmailFound) {
                showNotification("📥 New job emails received!", "success");
            }

            state.currentPage = 1;
            if (isFilteredView) {
                applyFilters();
            } else {
                updatePage(1, state, elements, CONFIG);
            }

            updateCategoryCounts(state, elements);
        });


        if (data.quota) {
            handleQuotaNotification(data.quota, state, elements);;
        }
    } catch (error) {
        console.error("❌ Error fetching new emails:", error.message);
        showNotification("Failed to fetch new emails", "error");

        if (error.message.includes("quota reached")) {
            console.log("🔴 Quota reached error, forcing quota notification at 100%.");
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

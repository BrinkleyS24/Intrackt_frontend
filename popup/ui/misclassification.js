import { toggleMisclassModal } from "./modals.js";
import { showNotification } from "./notification.js";

let undoTimeoutId = null;
let undoIntervalId = null;

export async function submitMisclassificationForm(e, state, elements, CONFIG, setLoadingState, fetchStoredEmails) {
    e.preventDefault();

    const correctedCategory = e.target.correctCategory.value;
    if (!correctedCategory) return alert("Please select a category.");
    toggleMisclassModal(false, elements);

    const email = state.currentReportEmail;
    if (!email) {
        alert("❌ No email selected to report.");
        return;
    }

    if (correctedCategory === "Irrelevant") {
        const toast = document.getElementById("undo-toast");
        toast.style.display = "flex";

        clearTimeout(undoTimeoutId);
        clearInterval(undoIntervalId);
        startUndoCountdown();

        undoTimeoutId = setTimeout(() => {
            toast.style.display = "none";
            reportMisclassification(
                { ...email, correctedCategory },
                state,
                elements,
                CONFIG,    
                setLoadingState,
                fetchStoredEmails
            );
        }, 5000);
    } else {
        reportMisclassification(
            { ...email, correctedCategory },
            state,
            elements,
            CONFIG,    
            setLoadingState,
            fetchStoredEmails
        );
    }
}

function startUndoCountdown(duration = 5000) {
    const circle = document.getElementById("undo-timer-circle");
    const totalLength = 88;
    let start = Date.now();

    circle.style.strokeDashoffset = "0";

    undoIntervalId = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        circle.style.strokeDashoffset = totalLength * progress;
        if (progress === 1) clearInterval(undoIntervalId);
    }, 100);
}

async function reportMisclassification(data, state, elements, CONFIG, setLoadingState, fetchStoredEmails) {
    const { emailId, threadId, category: originalCategory, subject, body, correctedCategory } = data;
    const payload = {
        emailId,
        threadId,
        originalCategory,
        correctedCategory,
        emailSubject: subject,
        emailBody: body,
        userEmail: state.userEmail
    };

    try {
        const endpoint = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS?.REPORT_MISCLASS || '/report-misclassification'}`;
        const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        if (correctedCategory === "Irrelevant") {
            showNotification("Reported and archived successfully!", "success");
        } else {
            alert("✅ Correction submitted! Thank you.");
        }

        await fetchStoredEmails(state, elements, setLoadingState, CONFIG);
    } catch (err) {
        console.error("❌ Report failed:", err);
        alert(`Error: ${err.message}`);
    }
}

export function undoMisclassificationToast() {
    clearTimeout(undoTimeoutId);
    clearInterval(undoIntervalId);

    const circle = document.getElementById("undo-timer-circle");
    if (circle) circle.style.strokeDashoffset = "0";

    const toast = document.getElementById("undo-toast");
    if (toast) toast.style.display = "none";
}
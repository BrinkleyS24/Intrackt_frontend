import { getElement } from "../utils/dom.js";
import { getAuthToken } from "../services/authService.js"

/**
 * Toggle any modal and the shared backdrop
 * @param {HTMLElement} modal - The modal element
 * @param {boolean} show - Whether to show or hide
 */
export function toggleModal(modal, show) {
  const backdrop = getElement("modal-backdrop");
  if (!modal || !backdrop) return;

  if (show) {
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");

    requestAnimationFrame(() => {
      backdrop.classList.add("opacity-100");
      backdrop.classList.remove("opacity-0");

      modal.classList.add("scale-100", "opacity-100");
      modal.classList.remove("scale-95", "opacity-0");
    });
  } else {
    backdrop.classList.remove("opacity-100");
    backdrop.classList.add("opacity-0");

    modal.classList.remove("scale-100", "opacity-100");
    modal.classList.add("scale-95", "opacity-0");

    setTimeout(() => {
      backdrop.classList.add("hidden");
      modal.classList.add("hidden");
    }, 200);
  }
}

export function toggleEmailModal(show, elements) {
  const modal = elements.emailModal;
  if (!modal) return;
  toggleModal(modal, show);
}

export function toggleMisclassModal(show, elements) {
  if (!elements || !elements.misclassModal) {
    console.error("❌ toggleMisclassModal called without proper `elements` object.");
    return;
  }
  const modal = elements.misclassModal;
  const backdrop = getElement("modal-backdrop");

  if (show) {
    modal.style.display = "flex";
    backdrop.style.display = "block";
    requestAnimationFrame(() => {
      modal.classList.add("show");
      backdrop.classList.add("show");
    });
  } else {
    modal.classList.remove("show");
    backdrop.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
      backdrop.style.display = "none";
    }, 300);
  }
}

export function reportMisclassification(emailData, elements, state) {
  state.currentReportEmail = emailData;

  [...elements.misclassForm.correctCategory].forEach(radio => {
    radio.checked = (radio.value === emailData.category);
  });

  toggleMisclassModal(true, elements);
}


export async function displayEmailModal(emailData, threadId, elements) {
  const { subject, from, date, body } = emailData;

  const subjEl = document.getElementById("modal-subject");
  const dateEl = document.getElementById("modal-date");
  const fromEl = document.getElementById("modal-from");
  const bodyEl = document.getElementById("modal-body");

  if (subjEl) subjEl.textContent = subject || "(No Subject)";
  if (dateEl) {
    dateEl.textContent = new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }
  if (fromEl) fromEl.innerHTML = `<strong>From:</strong> ${from}`;
  if (bodyEl) bodyEl.innerHTML = body || "";

  const openLink = document.getElementById("open-in-gmail");
  if (openLink) {
    openLink.href = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    openLink.target = "_blank";
  }

  const replyBtn = document.getElementById("reply-button");
  const replySection = document.getElementById("reply-section");
  const replyTextarea = document.getElementById("reply-body");
  const sendReplyBtn = document.getElementById("send-reply");

  if (!replyBtn || !replySection || !replyTextarea || !sendReplyBtn) {
    console.warn("Reply UI elements not found.");
    return;
  }

  replySection.classList.add("hidden");
  replyTextarea.value = "";

  replyBtn.onclick = () => {
    replySection.classList.remove("hidden");
    replyTextarea.focus();
  };

  sendReplyBtn.onclick = async () => {
    const replyText = replyTextarea.value.trim();
    if (!replyText) {
      alert("Reply cannot be empty.");
      return;
    }

    try {
      const replySubject = `Re: ${subject || ""}`;
      await sendReply(threadId, from, replyText, replySubject);

      if (elements.toastSuccess) {
        elements.toastSuccess.textContent = "✅ Your reply has been sent.";
        elements.toastSuccess.style.display = "block";
        setTimeout(() => {
          elements.toastSuccess.style.display = "none";
        }, 4000);
      } else {
        alert("✅ Your reply has been sent.");
      }

      replyTextarea.value = "";
      replySection.classList.add("hidden");
      toggleModal(elements.emailModal, false);
    } catch (err) {
      console.error("❌ Reply send error:", err);
      alert("❌ Failed to send reply.");
    }
  };

  toggleModal(elements.emailModal, true);
}


async function sendReply(threadId, to, message) {

  const authToken = await getAuthToken();
  const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

  const subject = document.querySelector("#modal-subject")?.textContent || "(no subject)";
  const emailContent = `To: ${to}\r\nSubject: Re: ${subject}\r\nIn-Reply-To: ${threadId}\r\nReferences: ${threadId}\r\n\r\n${message}`;

  const encodedMessage = base64Encode(emailContent);
  const payload = { raw: encodedMessage };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error("❌ Gmail API Error:", errorDetails);
    throw new Error(`Failed to send reply. Status: ${response.status}`);
  }
}

function base64Encode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
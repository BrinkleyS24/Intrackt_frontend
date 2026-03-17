/**
 * @file content.js
 * @description Bridge between the MorrowFold web app and the extension.
 * Injected on localhost pages so the web app can authenticate via the extension.
 */

console.log("MorrowFold Content Script loaded.");

try {
	window.postMessage(
		{
			type: "MORROWFOLD_EXTENSION_READY",
			extensionId: chrome?.runtime?.id || null,
		},
		window.location.origin
	);
} catch (_) {
	// Ignore errors from early page lifecycle or invalid origin.
}

const BRIDGE_REQUEST = "MORROWFOLD_EXTENSION_TOKEN_REQUEST";
const BRIDGE_RESPONSE = "MORROWFOLD_EXTENSION_TOKEN_RESPONSE";
const AUTH_STATE_PUSH = "MORROWFOLD_AUTH_STATE_PUSH";

// --- Respond to token requests from the web page ---
window.addEventListener("message", (event) => {
	if (event.source !== window) return;
	if (event.origin !== window.location.origin) return;

	const data = event.data || {};
	if (data.type !== BRIDGE_REQUEST || !data.nonce) return;

	console.log("[MorrowFold Content] Received bridge token request, forwarding to background...");

	if (!chrome?.runtime?.sendMessage) {
		console.warn("[MorrowFold Content] chrome.runtime.sendMessage unavailable (extension context invalidated?)");
		window.postMessage(
			{ type: BRIDGE_RESPONSE, nonce: data.nonce, success: false, error: "Extension bridge unavailable." },
			window.location.origin
		);
		return;
	}

	chrome.runtime.sendMessage({ type: "GET_ID_TOKEN" }, (response) => {
		if (chrome.runtime.lastError) {
			console.warn("[MorrowFold Content] Runtime error:", chrome.runtime.lastError.message);
			window.postMessage(
				{ type: BRIDGE_RESPONSE, nonce: data.nonce, success: false, error: chrome.runtime.lastError.message },
				window.location.origin
			);
			return;
		}
		console.log("[MorrowFold Content] Background responded:", response?.success ? "success" : response?.error);
		const payload = {
			type: BRIDGE_RESPONSE,
			nonce: data.nonce,
			success: Boolean(response?.success),
			token: response?.token || null,
			error: response?.error || (response?.success ? null : "Failed to get token"),
		};
		window.postMessage(payload, window.location.origin);
	});
});

// --- Listen for auth state pushes from the background script ---
// When the user signs in/out of the extension, the background sends AUTH_STATE_CHANGED
// to all content scripts. We forward it to the web page.
chrome.runtime.onMessage.addListener((message) => {
	if (message?.type === "AUTH_STATE_CHANGED") {
		window.postMessage(
			{
				type: AUTH_STATE_PUSH,
				loggedIn: message.loggedIn,
				email: message.email || null,
			},
			window.location.origin
		);
	}
});


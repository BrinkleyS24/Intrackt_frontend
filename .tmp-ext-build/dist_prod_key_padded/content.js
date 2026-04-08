/**
 * @file content.js
 * @description Bridge between the Applendium web app and the extension.
 * Injected on localhost pages so the web app can authenticate via the extension.
 */

console.log("Applendium Content Script loaded.");

function isAllowedBridgePath(pathname) {
	return pathname === "/app" || pathname.startsWith("/app/");
}

if (!isAllowedBridgePath(window.location.pathname || "")) {
	console.log("[Applendium Content] Bridge disabled on non-app route.");
}

try {
	if (isAllowedBridgePath(window.location.pathname || "")) {
		if (!chrome?.runtime?.sendMessage) {
			window.postMessage(
				{
					type: "APPLENDIUM_EXTENSION_READY",
					extensionId: chrome?.runtime?.id || null,
					loggedIn: false,
					email: null,
				},
				window.location.origin
			);
		} else {
			chrome.runtime.sendMessage({ type: "GET_EXTENSION_AUTH_STATE" }, (response) => {
				const runtimeError = chrome.runtime.lastError;
				window.postMessage(
					{
						type: "APPLENDIUM_EXTENSION_READY",
						extensionId: chrome?.runtime?.id || null,
						loggedIn: Boolean(response?.loggedIn),
						email: response?.email || null,
						error: runtimeError?.message || null,
					},
					window.location.origin
				);
			});
		}
	}
} catch (_) {
	// Ignore errors from early page lifecycle or invalid origin.
}

const BRIDGE_REQUEST = "APPLENDIUM_EXTENSION_TOKEN_REQUEST";
const BRIDGE_RESPONSE = "APPLENDIUM_EXTENSION_TOKEN_RESPONSE";
const AUTH_STATE_PUSH = "APPLENDIUM_AUTH_STATE_PUSH";

// --- Respond to token requests from the web page ---
window.addEventListener("message", (event) => {
	if (!isAllowedBridgePath(window.location.pathname || "")) return;
	if (event.source !== window) return;
	if (event.origin !== window.location.origin) return;

	const data = event.data || {};
	if (data.type !== BRIDGE_REQUEST || !data.nonce) return;

	console.log("[Applendium Content] Received bridge auth request, forwarding to background...");

	if (!chrome?.runtime?.sendMessage) {
		console.warn("[Applendium Content] chrome.runtime.sendMessage unavailable (extension context invalidated?)");
		window.postMessage(
			{ type: BRIDGE_RESPONSE, nonce: data.nonce, success: false, error: "Extension bridge unavailable." },
			window.location.origin
		);
		return;
	}

	chrome.runtime.sendMessage({ type: "GET_EXTENSION_WEB_AUTH" }, (response) => {
		if (chrome.runtime.lastError) {
			console.warn("[Applendium Content] Runtime error:", chrome.runtime.lastError.message);
			window.postMessage(
				{ type: BRIDGE_RESPONSE, nonce: data.nonce, success: false, error: chrome.runtime.lastError.message },
				window.location.origin
			);
			return;
		}
		console.log("[Applendium Content] Background responded:", response?.success ? "success" : response?.error);
		const payload = {
			type: BRIDGE_RESPONSE,
			nonce: data.nonce,
			success: Boolean(response?.success),
			firebaseToken: response?.firebaseToken || null,
			error: response?.error || (response?.success ? null : "Failed to get token"),
		};
		window.postMessage(payload, window.location.origin);
	});
});

// --- Listen for auth state pushes from the background script ---
// When the user signs in/out of the extension, the background sends AUTH_STATE_CHANGED
// to all content scripts. We forward it to the web page.
chrome.runtime.onMessage.addListener((message) => {
	if (!isAllowedBridgePath(window.location.pathname || "")) return;
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


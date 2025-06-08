import { getElement } from "../utils/dom.js";

/**
 * Update the welcome header text.
 * @param {string|null} userName
 */
export function updateWelcomeHeader(userName) {
  const welcomeHeader = getElement("welcome-header");
  if (welcomeHeader) {
    welcomeHeader.textContent = userName
      ? `Welcome, ${userName}!`
      : "Welcome to Intrackt!";
  }
}

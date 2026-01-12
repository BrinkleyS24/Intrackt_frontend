/**
 * Sends a message to the background script and awaits a response.
 * Implements a retry mechanism for 'Receiving end does not exist' errors,
 * which commonly occur if the service worker is temporarily inactive.
 * @param {object} message - The message object to send.
 * @param {number} [retries=3] - Number of retry attempts.
 * @param {number} [delay=200] - Delay in milliseconds between retries.
 * @returns {Promise<any>} A promise that resolves with the response from the background script.
 * @throws {Error} If the background script returns an error, the message fails after retries,
 * or the background script is truly unreachable.
 */
export async function sendMessageToBackground(message, retries = 3, delay = 200) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.runtime.sendMessage(message);

      // Chrome extension messaging can sometimes return an empty response or undefined
      // if the listener doesn't explicitly send a response or if an error occurs
      // without the error being propagated.
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message;
        console.error("Chrome runtime last error:", errorMessage);

        // If the receiving end does not exist, and we have retries left, wait and try again
        if (errorMessage.includes("receiving end") && i < retries - 1) {
          console.warn(`ThreadHQ: Background script not ready, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Try sending the message again
        }
        throw new Error(`Chrome runtime error: ${errorMessage}`);
      }

      if (response && response.error) {
        throw new Error(response.error);
      }

      return response; // Success, return the response
    } catch (error) {
      console.error("Error sending message to background script:", error);
      // Propagate a more specific error if it's a communication issue
      if (error.message.includes("receiving end") && i < retries - 1) {
        console.warn(`ThreadHQ: Failed to connect to background script, retrying... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Try sending the message again
      }
      throw error; // Re-throw if it's not a 'receiving end' error or no retries left
    }
  }
  // If loop finishes, all retries failed
  throw new Error("Failed to connect to background script after multiple retries. Is the extension running?");
}

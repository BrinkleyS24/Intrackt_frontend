// Complete subscription service for Chrome extension
const subscriptionService = {
  async getSubscriptionStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_SUBSCRIPTION_STATUS' }, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  },

  async getPlans() {
    // Hardcoded plans that match your Stripe configuration
    return [
      {
        id: "monthly",
        name: "Monthly Premium",
        price: "$9.99/month",
        priceId: "price_1S96d5BRxRky1ddJ54Q1C07I", // Your actual Stripe price ID
        features: [
          "Unlimited email processing",
          "Advanced AI classification", 
          "Real-time sync",
          "Priority support"
        ]
      },
      {
        id: "yearly", 
        name: "Yearly Premium",
        price: "$99.99/year",
        priceId: "price_1S96dSBRxRky1ddJi9gbHmRS", // Your actual Stripe price ID
        features: [
          "Unlimited email processing",
          "Advanced AI classification",
          "Real-time sync", 
          "Priority support",
          "2 months free!"
        ],
        recommended: true
      }
    ];
  },

  async createCheckoutSession(priceId, successUrl, cancelUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'CREATE_CHECKOUT_SESSION',
        priceId,
        successUrl,
        cancelUrl
      }, (response) => {
        if (response?.success && response.url) {
          // Request background script to open and monitor the payment
          chrome.runtime.sendMessage({
            type: 'OPEN_PAYMENT_WINDOW',
            url: response.url
          }, (paymentResult) => {
            if (paymentResult?.success) {
              resolve(paymentResult);
            } else {
              reject(new Error(paymentResult?.error || 'Payment window failed'));
            }
          });
        } else {
          reject(new Error(response?.error || 'Failed to create checkout session'));
        }
      });
    });
  },

  async createPortalSession(returnUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'CREATE_PORTAL_SESSION', 
        returnUrl
      }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to create portal session'));
        }
      });
    });
  },

  async openManageSubscription(returnUrl = null) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'CREATE_PORTAL_SESSION',
        returnUrl
      }, (response) => {
        if (response?.success && response.url) {
          // Request background script to open and monitor the portal
          chrome.runtime.sendMessage({
            type: 'OPEN_PORTAL_WINDOW',
            url: response.url
          }, (portalResult) => {
            if (portalResult?.success) {
              resolve(portalResult);
            } else {
              reject(new Error(portalResult?.error || 'Portal window failed'));
            }
          });
        } else {
          reject(new Error(response?.error || 'Failed to create portal session'));
        }
      });
    });
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.subscriptionService = subscriptionService;
}

export default subscriptionService;
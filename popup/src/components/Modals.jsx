/**
 * @file popup/src/components/Modals.jsx
 * @description React component to manage and render all application modals
 * (Misclassification, Premium, and Undo Toast for Misclassification).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../utils/cn'; // For conditional class names
import { showNotification } from './Notification'; // Assuming Notification component handles toasts
import { X, Gift, Mail, Flag, Crown, Check, Loader2 } from 'lucide-react'; // Import necessary Lucide icons

// Icons for modals (if needed) - Keeping for reference, but Lucide React is preferred
const Icons = {
  Gift: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gift"><polyline points="20 12 12 12 12 22"/><path d="M20 12h-2a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4c0 1.1.9 2 2 2h2"/><path d="M12 22h4a2 2 0 0 0 2-2v-4"/><path d="M12 22V6a..."`,
};

function Modals({
  isMisclassificationModalOpen,
  onCloseMisclassificationModal,
  selectedEmailForMisclassification, // This prop now correctly receives the full email object
  onConfirmMisclassification, // This prop will now receive (emailData, newCategory)
  isPremiumModalOpen,
  onClosePremiumModal,
  onSubscribePremium,
  undoToastVisible,
  setUndoToastVisible,
  undoMisclassification,
}) {
  const [selectedMisclassificationCategory, setSelectedMisclassificationCategory] = useState('irrelevant');
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [subscribingToPlan, setSubscribingToPlan] = useState(null);

  // Load subscription plans when premium modal opens
  useEffect(() => {
    if (isPremiumModalOpen && subscriptionPlans.length === 0) {
      loadSubscriptionPlans();
    }
  }, [isPremiumModalOpen]);

  const loadSubscriptionPlans = async () => {
    setLoadingPlans(true);
    try {
      // Access the global subscription service
      if (window.subscriptionService) {
        const plans = await window.subscriptionService.getPlans();
        setSubscriptionPlans(plans);
      } else {
        console.error('Subscription service not available');
        // Fallback plans
        setSubscriptionPlans([
          {
            id: 'monthly',
            name: 'Monthly Premium',
            price: '$9.99/month',
            priceId: 'price_placeholder',
            features: ['Unlimited email processing', 'Advanced AI classification', 'Real-time sync', 'Priority support']
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading subscription plans:', error);
      showNotification('Failed to load subscription plans', 'error');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSubscribeToPlan = async (plan) => {
    console.log('💳 Starting subscription to plan:', plan);
    setSubscribingToPlan(plan.id);
    try {
      if (window.subscriptionService) {
        console.log('🔄 Creating checkout session...');
        const result = await window.subscriptionService.createCheckoutSession(plan.priceId);
        console.log('📋 Checkout session result:', result);
        
        if (result.success) {
          if (result.sessionCompleted) {
            console.log('✅ Payment successful! Showing notification and refreshing state...');
            showNotification('Payment successful! Welcome to Premium!', 'success');
            onClosePremiumModal();
            // Use sophisticated state refresh instead of crude page reload
            if (window.reloadUserState) {
              console.log('🔄 Triggering reloadUserState for immediate UI refresh...');
              window.reloadUserState();
            } else {
              console.warn('⚠️ reloadUserState not available, fallback to storage event');
              // Dispatch custom event as fallback
              const event = new CustomEvent('userPlanUpdated', { 
                detail: { plan: result.plan } 
              });
              window.dispatchEvent(event);
            }
          } else if (result.cancelled) {
            console.log('❌ Payment cancelled');
            showNotification('Payment cancelled', 'info');
          } else {
            console.log('⚠️ Payment window closed');
            showNotification('Payment window closed. Please try again if payment was not completed.', 'info');
          }
        } else {
          showNotification('Failed to start payment process', 'error');
        }
      } else {
        showNotification('Subscription service not available', 'error');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      showNotification('Failed to start payment process: ' + error.message, 'error');
    } finally {
      setSubscribingToPlan(null);
    }
  };

  // Debug log to confirm prop value
  useEffect(() => {
    console.log("DEBUG Modals.jsx: isMisclassificationModalOpen prop received:", isMisclassificationModalOpen);
    if (isMisclassificationModalOpen && selectedEmailForMisclassification) {
      console.log("DEBUG Modals.jsx: Email for misclassification:", selectedEmailForMisclassification);
    }
  }, [isMisclassificationModalOpen, selectedEmailForMisclassification]);


  // Logic for the undo toast timer (if needed, otherwise remove)
  const circumference = 2 * Math.PI * 14; // For a radius of 14
  const [strokeDashoffset, setStrokeDashoffset] = useState(circumference);

  useEffect(() => {
    if (undoToastVisible) {
      // Reset animation
      setStrokeDashoffset(circumference);
      // Start countdown animation (e.g., over 5 seconds)
      const startTime = Date.now();
      const duration = 5000; // 5 seconds
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setStrokeDashoffset(circumference * (1 - progress));
        if (progress === 1) {
          clearInterval(interval);
          setUndoToastVisible(false); // Hide toast when timer finishes
        }
      }, 50); // Update every 50ms for smooth animation

      return () => clearInterval(interval);
    }
  }, [undoToastVisible, circumference, setUndoToastVisible]);


  return (
    <>
      {/* Misclassification Modal */}
      {isMisclassificationModalOpen && ( // Direct conditional rendering
        <div
          id="misclassification-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300 opacity-100 visible"
        >
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={onCloseMisclassificationModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 z-10 p-1"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center mb-6">
              <Flag className="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Misclassified Email?
              </h3>
              <p className="text-gray-600 dark:text-zinc-300 text-sm">
                This email was classified as: <span className="font-bold text-blue-600 dark:text-blue-400">{selectedEmailForMisclassification?.category || 'N/A'}</span>
              </p>
              <p className="text-gray-600 dark:text-zinc-300 text-sm mt-1">
                Subject: <span className="font-semibold">{selectedEmailForMisclassification?.subject || 'N/A'}</span>
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="correctCategory" className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-2">
                Move to:
              </label>
              <select
                id="correctCategory"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                value={selectedMisclassificationCategory}
                onChange={(e) => setSelectedMisclassificationCategory(e.target.value)}
              >
                <option value="irrelevant">Irrelevant</option>
                <option value="applied">Applied</option>
                <option value="interviewed">Interviewed</option>
                <option value="offers">Offers</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onCloseMisclassificationModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-gray-200 dark:bg-zinc-700 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                // Now pass both the email object and the selected category
                onClick={() => onConfirmMisclassification(selectedEmailForMisclassification, selectedMisclassificationCategory)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Modal */}
      {isPremiumModalOpen && (
        <div
          id="premium-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300 opacity-100 visible"
        >
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={onClosePremiumModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 z-10 p-1"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="text-center mb-8">
              <Crown className="mx-auto h-16 w-16 text-purple-500 dark:text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Upgrade to Premium
              </h3>
              <p className="text-gray-600 dark:text-zinc-300">
                Unlock unlimited email processing and advanced features
              </p>
            </div>

            {loadingPlans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <span className="ml-2 text-gray-600 dark:text-zinc-300">Loading plans...</span>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 mb-6">
                {subscriptionPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative rounded-lg border-2 p-6 shadow-sm transition-all duration-200",
                      plan.recommended
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    )}
                  >
                    {plan.recommended && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Recommended
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center mb-6">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {plan.name}
                      </h4>
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-4">
                        {plan.price}
                      </div>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600 dark:text-zinc-300">
                          <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSubscribeToPlan(plan)}
                      disabled={subscribingToPlan === plan.id}
                      className={cn(
                        "w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center",
                        plan.recommended
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 hover:bg-gray-300 dark:hover:bg-zinc-600",
                        subscribingToPlan === plan.id && "opacity-75 cursor-not-allowed"
                      )}
                    >
                      {subscribingToPlan === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Crown className="h-4 w-4 mr-2" />
                          Subscribe Now
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
              <p className="text-xs text-gray-500 dark:text-zinc-400 text-center">
                Secure payment powered by Stripe. Cancel anytime from your account settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast - Now rendered conditionally based on undoToastVisible */}
      {undoToastVisible && (
        <div
          id="undo-toast"
          className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 bg-blue-500 flex items-center space-x-4"
          style={{ minWidth: '250px' }}
        >
          <span>Email reported as irrelevant.</span> {/* Updated message */}
          <svg id="undo-timer-svg" width="32" height="32" viewBox="0 0 32 32" className="flex-shrink-0">
            <circle r="14" cx="16" cy="16" fill="transparent" stroke="rgba(255,255,255,0.3)" strokeWidth="3"></circle>
            <circle
              id="undo-timer-circle"
              r="14"
              cx="16"
              cy="16"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset linear 0.05s' }} // Added duration to transition
            ></circle>
          </svg>
          <button
            id="undo-btn"
            onClick={undoMisclassification}
            className="ml-auto px-3 py-1 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}

export default Modals;


import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Calendar, 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  X, 
  ExternalLink,
  ArrowLeft,
  Trash2,
  RefreshCw
} from "lucide-react";
import { cn } from '../utils/cn';

const Button = ({ children, variant = 'default', size = 'default', disabled, className, ...props }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-gray-900 text-gray-50 hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-700",
    ghost: "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-50"
  };
  
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8"
  };
  
  return (
    <button
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }) => (
  <div className={cn("rounded-lg border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950", className)} {...props}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className }) => {
  const variants = {
    default: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50",
    secondary: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    destructive: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-50",
    success: "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-50",
    warning: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-50"
  };
  
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
};

export function SubscriptionManager({ onBack, userPlan }) {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (window.subscriptionService) {
        const response = await window.subscriptionService.getSubscriptionStatus();
        
        if (response.success) {
          setSubscriptionData(response.subscription);
          
          // Sync local storage with actual subscription status
          const actualPlan = response.subscription.plan || 'free';
          const actualStatus = response.subscription.status || 'inactive';
          
          // Update local storage to match backend reality
          await chrome.storage.local.set({ 
            userPlan: actualPlan,
            subscriptionStatus: actualStatus
          });
          
          // Update parent component's state if user plan changed
          if (userPlan !== actualPlan) {
            // Plan updated
          }
        } else {
          setError(response.error || 'Failed to load subscription data');
        }
      } else {
        setError('Subscription service not available');
      }
    } catch (err) {
      setError(err.message || 'Failed to load subscription data');
      console.error('Error loading subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setError(null);
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CANCEL_SUBSCRIPTION' }, resolve);
      });
      
      if (response.success) {
        await loadSubscriptionData(); // Refresh data
        setShowCancelConfirm(false);
      } else {
        throw new Error(response.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setResumeLoading(true);
    setError(null);
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'RESUME_SUBSCRIPTION' }, resolve);
      });
      
      if (response.success) {
        await loadSubscriptionData(); // Refresh data
      } else {
        throw new Error(response.error || 'Failed to resume subscription');
      }
    } catch (err) {
      setError(err.message || 'Failed to resume subscription');
    } finally {
      setResumeLoading(false);
    }
  };

  const handleUpdatePaymentMethod = () => {
    setShowPaymentModal(true);
  };

  const handlePaymentMethodConfirm = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create a setup intent for payment method update
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CREATE_SETUP_INTENT' }, resolve);
      });

      if (response.success) {
        // For now, show user instructions to contact support
        // TODO: Implement Stripe Elements integration
        setError('Payment method updates are currently being implemented. Please contact support for assistance.');
        setShowPaymentModal(false);
      } else {
        setError(response.error || 'Failed to create payment update session');
      }
    } catch (err) {
      setError(err.message || 'Failed to update payment method');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Handle both Date objects and timestamp numbers
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Unix timestamp (seconds)
      date = new Date(timestamp * 1000);
    } else {
      return 'N/A';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { variant: 'success', label: 'Active' },
      canceled: { variant: 'warning', label: 'Canceled' },
      past_due: { variant: 'destructive', label: 'Past Due' },
      unpaid: { variant: 'destructive', label: 'Unpaid' },
      incomplete: { variant: 'warning', label: 'Incomplete' }
    };
    
    const config = statusMap[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">Subscription Management</h2>
        </div>
        
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Loading subscription data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">Subscription Management</h2>
        </div>
        
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSubscriptionData} className="mt-3">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!subscriptionData || subscriptionData.plan !== 'premium' || subscriptionData.status !== 'active') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">Subscription Management</h2>
        </div>
        
        <Card>
          <div className="text-center py-6">
            <Crown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You don't currently have an active premium subscription.
            </p>
            <Button onClick={onBack}>
              Upgrade to Premium
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-lg font-semibold">Subscription Management</h2>
      </div>

      {/* Current Plan Card */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Crown className="h-8 w-8 text-purple-600" />
            <div>
              <h3 className="text-lg font-semibold">Premium Plan</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Unlimited email processing and advanced features
              </p>
            </div>
          </div>
          {getStatusBadge(subscriptionData.status)}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Period</p>
            <p className="text-sm">
              {formatDate(subscriptionData.current_period_start)} - {formatDate(subscriptionData.current_period_end)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {subscriptionData.cancel_at_period_end ? 'Expires' : 'Next Billing'}
            </p>
            <p className="text-sm">
              {formatDate(subscriptionData.current_period_end)}
            </p>
          </div>
        </div>

        {subscriptionData.cancel_at_period_end && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Your subscription is canceled and will end on {formatDate(subscriptionData.current_period_end)}.
                You'll continue to have premium access until then.
              </p>
            </div>
          </div>
        )}

        <div className="flex space-x-3">
          {!subscriptionData.cancel_at_period_end && subscriptionData.status === 'active' && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowCancelConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancel Subscription
            </Button>
          )}

          {subscriptionData.cancel_at_period_end && subscriptionData.status === 'active' && (
            <Button 
              variant="default" 
              size="sm"
              onClick={handleResumeSubscription}
              disabled={resumeLoading}
            >
              {resumeLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {resumeLoading ? 'Resuming...' : 'Resume Subscription'}
            </Button>
          )}
          
          <Button variant="outline" size="sm" onClick={handleUpdatePaymentMethod}>
            <CreditCard className="h-4 w-4 mr-2" />
            Update Payment Method
          </Button>
        </div>
      </Card>

      {/* Billing Information */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Billing Information</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Plan Price</span>
            <span className="text-sm">
              {(() => {
                // Try different possible field names for the amount
                const amount = subscriptionData.plan_amount || 
                              subscriptionData.amount || 
                              subscriptionData.price || 
                              subscriptionData.cost;
                
                if (amount && typeof amount === 'number') {
                  return `$${(amount / 100).toFixed(2)}`;
                } else if (amount && typeof amount === 'string') {
                  // Handle if it's already a string like "$9.99"
                  return amount.startsWith('$') ? amount : `$${amount}`;
                }
                
                // Default fallback for premium plan
                return '$9.99';
              })()} / {subscriptionData.interval || subscriptionData.billing_cycle || 'month'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Payment Method</span>
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <span className="text-sm">•••• •••• •••• {subscriptionData.last4 || '••••'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold">Cancel Subscription</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to cancel your subscription? You'll continue to have premium access 
              until {formatDate(subscriptionData.current_period_end)}, but your subscription won't renew.
            </p>
            
            <div className="flex space-x-3">
              <Button 
                variant="destructive" 
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
              >
                {cancelLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {cancelLoading ? 'Canceling...' : 'Yes, Cancel'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelLoading}
              >
                Keep Subscription
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Payment Method Update Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-semibold">Update Payment Method</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowPaymentModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Payment Method Updates
                  </h4>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Payment method updates are currently being implemented. 
                  Your financial information will be handled securely within the extension.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Current Payment Method</h4>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">•••• •••• •••• {subscriptionData?.last4 || '••••'}</p>
                    <p className="text-xs text-gray-500">
                      {subscriptionData?.card_brand ? subscriptionData.card_brand.toUpperCase() : 'Credit Card'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Available Options</h4>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>• Contact our support team for immediate assistance</p>
                  <p>• In-extension payment updates coming soon</p>
                  <p>• Cancel and re-subscribe with a new payment method</p>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowPaymentModal(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={handlePaymentMethodConfirm}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Contact Support
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
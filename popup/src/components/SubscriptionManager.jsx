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
  const [error, setError] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

  const handleUpdatePaymentMethod = async () => {
    try {
      if (window.subscriptionService) {
        await window.subscriptionService.openManageSubscription();
      }
    } catch (error) {
      setError('Failed to open payment method update');
      console.error('Error opening payment method update:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
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

  if (userPlan !== 'premium' || !subscriptionData) {
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
          
          <Button variant="outline" size="sm" onClick={handleUpdatePaymentMethod}>
            <ExternalLink className="h-4 w-4 mr-2" />
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
              ${subscriptionData.plan_amount ? (subscriptionData.plan_amount / 100).toFixed(2) : 'N/A'} / 
              {subscriptionData.interval || 'month'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold">Cancel Subscription</h3>
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
    </div>
  );
}
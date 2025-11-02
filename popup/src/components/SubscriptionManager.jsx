
import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Calendar, 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink,
  ArrowLeft,
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
  const [error, setError] = useState(null);

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

  const handleOpenCustomerPortal = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          type: 'OPEN_CUSTOMER_PORTAL',
          return_url: chrome.runtime.getURL('popup/index.html')
        }, resolve);
      });
      
      if (response.success) {
        setTimeout(() => {
          loadSubscriptionData();
        }, 1000);
      } else {
        throw new Error(response.error || 'Failed to open customer portal');
      }
    } catch (err) {
      setError(err.message || 'Failed to open billing portal');
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

        <Button 
          variant="default" 
          size="sm"
          onClick={handleOpenCustomerPortal}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Opening...' : 'Manage Billing & Payment'}
        </Button>
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


    </div>
  );
}
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileText, Calendar, Gift, X, Flag, ArrowUp, ArrowDown, BarChart3, TrendingUp, Clock } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDate } from '../utils/uiHelpers';
import { groupEmailsByThread, countUniqueThreads } from '../utils/grouping';
import { showNotification } from './Notification';
import { CONFIG } from '../utils/constants';

/**
 * Helper functions for category styling
 */
function getCategoryColor(category) {
  const colors = {
    applied: 'border-l-4 border-blue-500',
    interviewed: 'border-l-4 border-green-500',
    offers: 'border-l-4 border-purple-500',
    rejected: 'border-l-4 border-red-500',
    irrelevant: 'border-l-4 border-gray-400'
  };
  return colors[category] || 'border-l-4 border-gray-300';
}

function getCategoryBadgeColor(category) {
  const colors = {
    applied: 'bg-blue-100 text-blue-800',
    interviewed: 'bg-green-100 text-green-800',
    offers: 'bg-purple-100 text-purple-800',
    rejected: 'bg-red-100 text-red-800',
    irrelevant: 'bg-gray-100 text-gray-800'
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}

function getCategoryTitle(category) {
  const titles = {
    applied: 'Applied',
    interviewed: 'Interviewed',
    offers: 'Offers',
    rejected: 'Rejected',
    irrelevant: 'Irrelevant'
  };
  return titles[category] || category;
}

// Generate dynamic AI insights based on context
function generateDynamicInsight(suggestion) {
  if (!suggestion) return "";
  const type = suggestion.actionType || suggestion.type;
  const days = suggestion.daysAgo || 0;

  const defaultInsights = {
    follow_up: "Research shows following up now increases response rates by 65%.",
    thank_you: "Thank-you notes after interviews reinforce positive impressions.",
    status_check: "Status checks keep your application top-of-mind professionally.",
    research: "Gather market data to negotiate confidently.",
    networking: "Personalized connection requests have 40% higher acceptance rates.",
    portfolio: "Add your latest project showcasing the skills mentioned in recent job postings you've applied to."
  };

  return defaultInsights[type] || suggestion.description || "";
}

/**
 * StatCarousel component for cycling through different statistics
 */
function StatCarousel({ totalApplications, appsDeltaPct, responseRate, rateDeltaPct, newApplicationsThisWeek, offersCount, emailsCur30, emailsPrev30, emailsCur7, emailsPrev7, applicationStats, Trend }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const appsCur = countUniqueThreads(emailsCur30.filter(e => e.category?.toLowerCase().includes('appl')));
  const appsPrev = countUniqueThreads(emailsPrev30.filter(e => e.category?.toLowerCase().includes('appl')));
  const appsCur7 = countUniqueThreads(emailsCur7.filter(e => e.category?.toLowerCase().includes('appl')));
  const appsPrev7 = countUniqueThreads(emailsPrev7.filter(e => e.category?.toLowerCase().includes('appl')));
  
  const monthDelta = appsPrev > 0 ? Math.round(((appsCur - appsPrev) / appsPrev) * 100) : (appsCur > 0 ? 100 : 0);
  const weekDelta = appsPrev7 > 0 ? Math.round(((appsCur7 - appsPrev7) / appsPrev7) * 100) : (appsCur7 > 0 ? 100 : 0);
  
  const slides = [
    {
      label: "Active Applications",
      value: totalApplications,
      subtitle: applicationStats?.emails?.total ? `Across ${applicationStats.emails.total} emails` : null,
      delta: null,
      timeframe: null,
      bgColor: "bg-gradient-to-r from-cyan-600 to-blue-600",
      textColor: "text-white"
    },
    {
      label: "Last 30 Days",
      value: appsCur,
      delta: monthDelta,
      timeframe: "previous 30 days",
      bgColor: "bg-white dark:bg-zinc-800",
      textColor: "text-gray-900 dark:text-white"
    },
    {
      label: "Last 7 Days",
      value: appsCur7,
      delta: weekDelta,
      timeframe: "previous 7 days",
      bgColor: "bg-white dark:bg-zinc-800",
      textColor: "text-gray-900 dark:text-white"
    }
  ];

  return (
    <div className="relative">
      <div className={cn("p-4 rounded-lg shadow-sm", slides[currentSlide].bgColor)}>
        <div className={cn("flex items-center justify-between mb-3", slides[currentSlide].textColor)}>
          <div className="text-sm opacity-90">{slides[currentSlide].label}</div>
          <FileText className="h-5 w-5 opacity-75" />
        </div>
        <div className={cn("text-3xl font-bold mb-2", slides[currentSlide].textColor)}>
          {slides[currentSlide].value}
        </div>
        {slides[currentSlide].subtitle && (
          <div className={cn("text-xs opacity-75 mb-2", slides[currentSlide].textColor)}>
            {slides[currentSlide].subtitle}
          </div>
        )}
        {slides[currentSlide].delta !== null && (
          <div className={cn("text-xs opacity-90", slides[currentSlide].textColor)}>
            <Trend delta={slides[currentSlide].delta} timeframe={slides[currentSlide].timeframe} />
          </div>
        )}
        
        {/* Pagination dots inside the card */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                currentSlide === index 
                  ? "w-6 bg-current opacity-100" 
                  : "w-2 bg-current opacity-30 hover:opacity-50"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * CategorySummaryCard component
 */
function CategorySummaryCard({ categoryKey, counts, onCategorySelect }) {
  const categoryConfig = {
    applied: { title: 'Applied', icon: FileText, description: 'Applications sent', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    interviewed: { title: 'Interviewed', icon: Calendar, description: 'Interview invitations', iconBg: 'bg-green-100', iconText: 'text-green-600' },
    offers: { title: 'Offers', icon: Gift, description: 'Job offers received', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
    rejected: { title: 'Rejected', icon: X, description: 'Applications declined', iconBg: 'bg-red-100', iconText: 'text-red-600' }
  };

  const config = categoryConfig[categoryKey];
  if (!config) return null;

  const { title: categoryTitle, icon: IconComponent, description, iconBg: iconBgColorClass, iconText: iconTextColorClass } = config;
  const count = countUniqueThreads(counts[categoryKey] || []);

  return (
    <div
      className={cn(
        "card p-3 sm:p-4 flex flex-col justify-between transition-shadow hover:shadow-md h-full cursor-pointer rounded-lg shadow-sm bg-white dark:bg-zinc-800",
        getCategoryColor(categoryKey)
      )}
      onClick={() => onCategorySelect && onCategorySelect(categoryKey)}
    >
      <div className="flex items-center mb-3">
        <div className={cn("p-2 rounded-lg mr-3", iconBgColorClass)}>
          {IconComponent && <IconComponent className={cn("h-5 w-5", iconTextColorClass)} />}
        </div>
        <h4 className="text-md font-semibold text-gray-900 dark:text-white">{categoryTitle}</h4>
        <span className={cn(
          "ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full",
          getCategoryBadgeColor(categoryKey),
          "dark:bg-opacity-20 dark:text-white"
        )}>
          {count}
        </span>
      </div>
      <p className="text-sm opacity-80 text-gray-600 dark:text-zinc-400 mb-4">{description}</p>
      <button className="py-2 px-4 rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors w-full">
        View All
      </button>
    </div>
  );
}

/**
 * Renders a single email card for the "Recent Activity" section.
 */
function DashboardEmailCard({ email, onEmailSelect, onOpenMisclassificationModal }) {
  const handleMisclassifyClick = (e) => {
    e.stopPropagation();
    if (onOpenMisclassificationModal) {
      onOpenMisclassificationModal(email);
    } else {
      console.error("ERROR: onOpenMisclassificationModal is undefined!");
    }
  };

  return (
    <div
      className="flex-shrink-0 w-64 sm:w-72 bg-gray-100 dark:bg-zinc-700 p-3 sm:p-4 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors relative"
      onClick={() => onEmailSelect(email)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
          getCategoryBadgeColor(email.category)
        )}>
          {getCategoryTitle(email.category)}
        </span>
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          {formatDate(email.date)}
        </span>
      </div>
      <h3 className="text-base font-semibold truncate text-gray-900 dark:text-white">{email.subject}</h3>
      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{email.from}</p>

      <button
        onClick={handleMisclassifyClick}
        className="absolute bottom-2 right-2 p-1 rounded-full text-gray-500 hover:bg-gray-300 dark:hover:bg-zinc-500 dark:text-zinc-400 transition-colors"
        title="Report Misclassification"
      >
        <Flag className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Snooze Time Picker Modal
 */
function SnoozeModal({ isOpen, onClose, onConfirm }) {
  const [selectedDuration, setSelectedDuration] = useState(24); // Default 1 day

  const durations = [
    { label: '1 hour', value: 1 },
    { label: '3 hours', value: 3 },
    { label: '1 day', value: 24 },
    { label: '3 days', value: 72 },
    { label: '1 week', value: 168 }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Remind me later</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">When should we remind you about this?</p>
        
        <div className="space-y-2 mb-6">
          {durations.map((duration) => (
            <button
              key={duration.value}
              onClick={() => setSelectedDuration(duration.value)}
              className={cn(
                "w-full px-4 py-3 rounded-md text-sm font-medium text-left transition-colors",
                selectedDuration === duration.value
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-2 border-blue-500"
                  : "bg-gray-50 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-zinc-600"
              )}
            >
              {duration.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(selectedDuration);
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Set Reminder
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DashboardFollowUpCard component
 */
function DashboardFollowUpCard({ suggestion, markFollowedUp, updateRespondedState, onEmailSelect, openMisclassificationModal, onActionComplete, onSnooze }) {
  const [showWhyThis, setShowWhyThis] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);

  const getActionEmoji = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'email':
      case 'follow_up': return '📧';
      case 'linkedin':
      case 'networking': return '�';
      case 'call': return '📞';
      case 'research': return '🔍';
      case 'thank_you': return '💬';
      case 'status_check': return '⏰';
      case 'application': return '📄';
      case 'portfolio': return '🎯';
      default: return '📌';
    }
  };

  const getChannelEmoji = (channel) => {
    switch ((channel || '').toLowerCase()) {
      case 'email': return '📧';
      case 'linkedin': return '💼';
      case 'call': return '📞';
      case 'research': return '🔍';
      case 'portfolio': return '🎯';
      default: return '📧';
    }
  };

  const getChannelLabel = (channel) => {
    switch ((channel || '').toLowerCase()) {
      case 'email': return 'email';
      case 'linkedin': return 'LinkedIn';
      case 'call': return 'call';
      case 'research': return 'research';
      case 'portfolio': return 'portfolio';
      default: return 'email';
    }
  };

  const getUrgencyColors = (urgency) => {
    switch ((urgency || '').toLowerCase()) {
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          pillBg: 'bg-red-50',
          pillText: 'text-red-800',
          titleText: 'text-red-800',
          metaText: 'text-red-800',
          remind: 'text-red-700',
        };
      case 'medium':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          pillBg: 'bg-amber-50',
          pillText: 'text-amber-800',
          titleText: 'text-amber-800',
          metaText: 'text-amber-800',
          remind: 'text-amber-700',
        };
      case 'low':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          pillBg: 'bg-blue-50',
          pillText: 'text-blue-800',
          titleText: 'text-blue-800',
          metaText: 'text-blue-800',
          remind: 'text-blue-700',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          pillBg: 'bg-gray-50',
          pillText: 'text-gray-800',
          titleText: 'text-gray-800',
          metaText: 'text-gray-800',
          remind: 'text-gray-700',
        };
    }
  };

  const colors = getUrgencyColors(suggestion.urgency);
  const emoji = getActionEmoji(suggestion.actionType || suggestion.type);
  const aiInsight = suggestion.aiInsight || generateDynamicInsight(suggestion) || suggestion.description;

  // Use backend-provided values with smart fallbacks
  const estimatedTime = suggestion.estimatedTime || '10 mins';
  const actionChannel = suggestion.actionChannel || 'email';
  const channelEmoji = getChannelEmoji(actionChannel);
  const channelLabel = getChannelLabel(actionChannel);

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all hover:shadow-md",
      colors.bg,
      colors.border
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium",
            colors.pillBg,
            colors.pillText
          )}>
            {suggestion.urgency || 'medium'}
          </span>
          {suggestion.impact && suggestion.impact !== suggestion.urgency && (
            <span className={cn(
              "px-2 py-0.5 rounded text-xs",
              suggestion.impact === 'high' ? 'text-green-700 bg-green-50 border border-green-200' :
                suggestion.impact === 'medium' ? 'text-amber-700 bg-amber-50 border border-amber-200' :
                  'text-blue-700 bg-blue-50 border border-blue-200'
            )}>
              {suggestion.impact} impact
            </span>
          )}
        </div>
      </div>

      <h3 className={cn("text-base font-semibold mb-2", colors.titleText)}>
        {suggestion.title}
      </h3>

      <p className="text-sm text-gray-700 mb-3 leading-relaxed">
        {aiInsight}
      </p>

      <div className={cn("flex items-center gap-3 text-xs mb-3", colors.metaText)}>
        <span className="font-medium">{suggestion.company}</span>
        {suggestion.position && (
          <>
            <span>•</span>
            <span>{suggestion.position}</span>
          </>
        )}
        {suggestion.daysAgo !== undefined && (
          <>
            <span>•</span>
            <span>{suggestion.daysAgo} days ago</span>
          </>
        )}
        {suggestion.estimatedTime && (
          <span className="flex items-center gap-1">
            <span>⏱</span>
            {suggestion.estimatedTime}
          </span>
        )}
        {suggestion.actionType && (
          <span className="flex items-center gap-1">
            <span>📍</span>
            {suggestion.actionType}
          </span>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            onActionComplete?.(suggestion);
          }}
          className="flex-1 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Take Action
        </button>
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            setShowSnoozeModal(true);
          }}
          className={cn("flex-1 px-4 py-2 rounded-md text-sm font-medium hover:bg-white/50 transition-colors", colors.remind)}
        >
          Remind Later
        </button>
      </div>

      <SnoozeModal 
        isOpen={showSnoozeModal}
        onClose={() => setShowSnoozeModal(false)}
        onConfirm={(duration) => onSnooze?.(suggestion, duration)}
      />

      {showWhyThis && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            {suggestion.whyThisDetail || "AI recommends this action based on your application timeline and industry best practices."}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard Component ---
function Dashboard({
  categorizedEmails = { applied: [], interviewed: [], offers: [], rejected: [], irrelevant: [] },
  categoryTotals = null, // NEW: Accurate category counts from backend
  applicationStats = null, // NEW: Application lifecycle statistics
  onCategorySelect,
  onEmailSelect,
  followUpSuggestions = [],
  loadingSuggestions,
  markFollowedUp,
  updateRespondedState,
  openMisclassificationModal,
  userPlan,
  openPremiumModal,
  quotaData
}) {
  const isPremium = userPlan === 'premium';
  const [analyticsTab, setAnalyticsTab] = useState('overview');
  const [followUpSearch, setFollowUpSearch] = useState('');
  const [followUpUrgencyFilter, setFollowUpUrgencyFilter] = useState('all');
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState('all');
  const [followUpPage, setFollowUpPage] = useState(1);
  const [hiddenSuggestions, setHiddenSuggestions] = useState(new Set());
  const FOLLOW_UPS_PER_PAGE = 6;

  // Listen for scope error messages from background script
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === 'SCOPE_ERROR' || message.errorCode === 'INSUFFICIENT_SCOPES') {
        showNotification(
          '⚠️ Gmail permissions needed. Please sign out and sign in again to grant all permissions.',
          'error',
          null,
          10000 // Show for 10 seconds
        );
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Helper function to make authenticated API calls
  const apiFetch = useCallback(async (endpoint, options = {}) => {
    try {
      const { userEmail, userId } = await chrome.storage.local.get(['userEmail', 'userId']);
      
      const response = await chrome.runtime.sendMessage({
        type: 'API_CALL',
        endpoint,
        options: {
          ...options,
          body: options.body ? { ...options.body, userEmail, userId } : undefined
        }
      });

      if (!response?.success) {
        throw new Error(response?.error || 'API call failed');
      }

      return response;
    } catch (error) {
      console.error('API fetch error:', error);
      throw error;
    }
  }, []);

  // Handle Take Action - mark suggestion as completed and open email modal
  const handleActionComplete = useCallback(async (suggestion) => {
    try {
      const threadId = suggestion.threadId || suggestion.thread_id;
      const suggestionKey = `${threadId}:${suggestion.actionType}`;
      
      // Mark as pending completion (show with reduced opacity)
      setHiddenSuggestions(prev => {
        const next = new Set(prev);
        next.add(suggestionKey);
        return next;
      });
      
      const response = await chrome.runtime.sendMessage({
        type: 'SUGGESTION_ACTION',
        threadId: threadId,
        actionType: suggestion.actionType
      });

      if (response?.success) {
        // Show success notification with undo option
        showNotification(
          'Action completed! Opening email...', 
          'success',
          async () => {
            // Undo function - called when user clicks "Undo" button
            try {
              // Call backend to remove the action
              const undoResponse = await chrome.runtime.sendMessage({
                type: 'UNDO_SUGGESTION_ACTION',
                threadId: threadId,
                actionType: suggestion.actionType
              });
              
              if (undoResponse?.success) {
                // Restore the suggestion
                setHiddenSuggestions(prev => {
                  const next = new Set(prev);
                  next.delete(suggestionKey);
                  return next;
                });
                showNotification('Action undone!', 'info');
              } else {
                showNotification('Could not undo action', 'error');
              }
            } catch (error) {
              console.error('Error undoing action:', error);
              showNotification('Could not undo action', 'error');
            }
          },
          5000 // Show for 5 seconds
        );
        
        // Open the email modal so user can reply
        onEmailSelect(suggestion);
        
        // Refresh suggestions from backend after delay (in case user doesn't undo)
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'FETCH_FOLLOWUP_SUGGESTIONS' });
        }, 6000); // Wait for undo window to expire
      } else {
        // If failed, restore the suggestion
        setHiddenSuggestions(prev => {
          const next = new Set(prev);
          next.delete(suggestionKey);
          return next;
        });
        throw new Error(response?.error || 'Failed to mark action as complete');
      }
    } catch (error) {
      console.error('Error completing action:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  }, [onEmailSelect]);

  // Handle Remind Later - snooze suggestion
  const handleSnooze = useCallback(async (suggestion, durationHours) => {
    try {
      showNotification(`Snoozing for ${durationHours >= 24 ? `${durationHours / 24} day(s)` : `${durationHours} hour(s)`}...`);
      
      const response = await chrome.runtime.sendMessage({
        type: 'SUGGESTION_SNOOZE',
        threadId: suggestion.threadId || suggestion.thread_id,
        actionType: suggestion.actionType,
        snoozeDuration: durationHours
      });

      if (response?.success) {
        // Hide the suggestion immediately
        setHiddenSuggestions(prev => {
          const next = new Set(prev);
          next.add(`${suggestion.threadId || suggestion.thread_id}:${suggestion.actionType}`);
          return next;
        });
        
        const timeLabel = durationHours >= 24 ? `${durationHours / 24} day(s)` : `${durationHours} hour(s)`;
        showNotification(`Reminder set! We'll show this again in ${timeLabel}.`, 'success');
        
        // Refresh suggestions from backend after a short delay
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'FETCH_FOLLOWUP_SUGGESTIONS' });
        }, 500);
      } else {
        throw new Error(response?.error || 'Failed to snooze suggestion');
      }
    } catch (error) {
      console.error('Error snoozing suggestion:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  }, []);

  const getCount = useCallback((category) => {
    // Always count unique conversations/threads, not individual email messages
    // This ensures consistency across all UI elements (sidebar, dashboard, list views)
    // Backend categoryTotals counts raw DB records which includes all messages in a thread
    const list = (categorizedEmails[category] || categorizedEmails[category.charAt(0).toUpperCase() + category.slice(1)] || []);
    return countUniqueThreads(list);
  }, [categorizedEmails]);

  const appliedCount = useMemo(() => {
    // NEW: Use application stats if available, otherwise fallback to email counts
    return applicationStats?.applications?.applied ?? getCount('applied');
  }, [applicationStats, getCount]);
  
  const interviewedCount = useMemo(() => {
    return applicationStats?.applications?.interviewed ?? getCount('interviewed');
  }, [applicationStats, getCount]);
  
  const offersCount = useMemo(() => {
    return applicationStats?.applications?.offered ?? getCount('offers');
  }, [applicationStats, getCount]);
  
  const rejectedCount = useMemo(() => {
    return applicationStats?.applications?.rejected ?? getCount('rejected');
  }, [applicationStats, getCount]);
  
  const irrelevantCount = useMemo(() => getCount('irrelevant'), [getCount]);

  const allRelevantEmails = useMemo(() => {
    const relevantEmails = Object.values(categorizedEmails).flat()
      .filter(email => email.category?.toLowerCase() !== 'irrelevant');
    return relevantEmails;
  }, [categorizedEmails]);

  const totalApplications = useMemo(() => {
    // NEW: Use application lifecycle statistics if available
    if (applicationStats?.applications?.total) {
      return applicationStats.applications.total;
    }
    // Fallback to email-based counting (old behavior)
    const localTotal = countUniqueThreads(allRelevantEmails);
    const backendTotal = (typeof quotaData?.totalProcessed === 'number' && !Number.isNaN(quotaData.totalProcessed))
      ? quotaData.totalProcessed
      : null;
    if (backendTotal === null) return localTotal;
    return Math.max(backendTotal, localTotal);
  }, [applicationStats, quotaData, allRelevantEmails]);

  const totalInterviewsAndOffers = useMemo(() => interviewedCount + offersCount, [interviewedCount, offersCount]);

  const responseRate = useMemo(() => {
    return totalApplications > 0 ? Math.round((totalInterviewsAndOffers / totalApplications) * 100) : 0;
  }, [totalInterviewsAndOffers, totalApplications]);

  const newApplicationsThisWeek = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentApplications = (categorizedEmails.applied || categorizedEmails.Applied || []).filter(email => new Date(email.date) >= sevenDaysAgo);
    return countUniqueThreads(recentApplications);
  }, [categorizedEmails.applied, categorizedEmails.Applied]);

  const successRate = useMemo(() => {
    return totalApplications > 0 ? Math.round((offersCount / totalApplications) * 100) : 0;
  }, [offersCount, totalApplications]);

  const categories = useMemo(() => [
    { id: "applied", title: "Applied", count: appliedCount, icon: FileText, description: "Applications sent" },
    { id: "interviewed", title: "Interviewed", count: interviewedCount, icon: Calendar, description: "Interview invitations" },
    { id: "offers", title: "Offers", count: offersCount, icon: Gift, description: "Job offers received" },
    { id: "rejected", "title": "Rejected", count: rejectedCount, icon: X, description: "Applications declined" }
  ], [appliedCount, interviewedCount, offersCount, rejectedCount]);

  const recentEmails = useMemo(() => allRelevantEmails
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5), [allRelevantEmails]);

  // Trend metrics - Helper functions
  const parseMs = (d) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? null : t;
  };

  const isInRange = (ms, start, end) => ms !== null && ms >= start && ms < end;
  const hasCat = (e, sub) => ((e.category || '').toLowerCase().includes(sub));

  // Use the grouping logic to count UNIQUE company+position combinations, not just thread_ids
  const uniqueCount = (arr) => {
    const grouped = groupEmailsByThread(arr);
    return grouped.length;
  };

  // Calculate time ranges - must be inside useMemo to recalculate when allRelevantEmails changes
  const { nowMs, d30, d7, startCur30, startPrev30 } = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return {
      nowMs: now,
      d30: thirtyDays,
      d7: sevenDays,
      startCur30: now - thirtyDays,
      startPrev30: now - 2 * thirtyDays
    };
  }, [allRelevantEmails]); // Recalculate when emails change to get fresh timestamps

  const emailsCur30 = useMemo(() => {
    return allRelevantEmails.filter(e => isInRange(parseMs(e.date), startCur30, nowMs));
  }, [allRelevantEmails, startCur30, nowMs]);
  
  const emailsPrev30 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), startPrev30, startCur30)), [allRelevantEmails, startPrev30, startCur30]);
  const emailsCur7 = useMemo(() => {
    return allRelevantEmails.filter(e => isInRange(parseMs(e.date), nowMs - d7, nowMs));
  }, [allRelevantEmails, nowMs, d7]);
  const emailsPrev7 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), nowMs - 2 * d7, nowMs - d7)), [allRelevantEmails, nowMs, d7]);

  const appsCur = useMemo(() => {
    const apps = emailsCur30.filter(e => hasCat(e, 'appl'));
    const count = uniqueCount(apps);
    return count;
  }, [emailsCur30]);
  const appsPrev = useMemo(() => uniqueCount(emailsPrev30.filter(e => hasCat(e, 'appl'))), [emailsPrev30]);

  const interviewsCur = useMemo(() => uniqueCount(emailsCur30.filter(e => hasCat(e, 'interview'))), [emailsCur30]);
  const offersCur = useMemo(() => uniqueCount(emailsCur30.filter(e => hasCat(e, 'offer'))), [emailsCur30]);
  const interviewsPrev = useMemo(() => uniqueCount(emailsPrev30.filter(e => hasCat(e, 'interview'))), [emailsPrev30]);
  const offersPrev = useMemo(() => uniqueCount(emailsPrev30.filter(e => hasCat(e, 'offer'))), [emailsPrev30]);

  const respRateCur = useMemo(() => (appsCur > 0 ? Math.round(((interviewsCur + offersCur) / appsCur) * 100) : 0), [appsCur, interviewsCur, offersCur]);
  const respRatePrev = useMemo(() => (appsPrev > 0 ? Math.round(((interviewsPrev + offersPrev) / appsPrev) * 100) : null), [appsPrev, interviewsPrev, offersPrev]);

  const pctDelta = (cur, prev) => {
    if (prev === null || prev === undefined || prev === 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  };

  const appsDeltaPct = useMemo(() => pctDelta(appsCur, appsPrev), [appsCur, appsPrev]);
  const rateDeltaPct = useMemo(() => pctDelta(respRateCur, respRatePrev), [respRateCur, respRatePrev]);

  /* TODO: Avg Response Time Feature - Disabled for release
     Problem: Domain-based matching doesn't work when application emails come from 
     ATS platforms (greenhouse, smartrecruiters) but interviews come from company recruiters.
     
     Solution needed: Extract company name from email subject/body and match on that instead.
     
  const avgResponseDays = (emails) => {
    const extractDomain = (email) => {
      if (!email) return null;
      const match = email.match(/@([a-zA-Z0-9.-]+)/);
      return match ? match[1].toLowerCase() : null;
    };

    const byDomain = new Map();
    emails.forEach(e => {
      const domain = extractDomain(e.from);
      if (!domain) return;
      
      const t = parseMs(e.date);
      if (t === null) return;
      
      const cat = (e.category || '').toLowerCase();
      let rec = byDomain.get(domain);
      if (!rec) { rec = { app: null, resp: null }; byDomain.set(domain, rec); }
      
      if (cat.includes('appl')) rec.app = Math.min(rec.app ?? t, t);
      if (cat.includes('interview') || cat.includes('offer')) rec.resp = Math.min(rec.resp ?? t, t);
    });
    
    const diffs = [];
    byDomain.forEach(({ app, resp }, domain) => { 
      if (app && resp && resp >= app) {
        const days = (resp - app) / (1000 * 60 * 60 * 24);
        diffs.push(days);
      }
    });
    
    if (!diffs.length) {
      return null;
    }
    
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return Math.round(avg * 10) / 10;
  };

  const artCur = useMemo(() => avgResponseDays(allRelevantEmails), [allRelevantEmails]);
  const artPrev = useMemo(() => avgResponseDays(allRelevantEmails), [allRelevantEmails]);
  const artDeltaDays = useMemo(() => (artPrev === null || artPrev === 0 || artCur === null ? null : Math.round((artCur - artPrev) * 10) / 10), [artCur, artPrev]);
  */
  
  const interviewsThisWeek = useMemo(() => uniqueCount(emailsCur7.filter(e => hasCat(e, 'interview'))), [emailsCur7]);

  // Configurable number of weeks for chart
  const numWeeks = 4; // Show recent trends over 4 weeks
  const weeklyData = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    
    // Collect emails per week
    const weeklyEmails = Array(numWeeks).fill(null).map(() => ({
      appEmails: [],
      respEmails: []
    }));

    allRelevantEmails.forEach(e => {
      const t = parseMs(e.date);
      if (t === null) return;
      const age = now - t;
      const idx = Math.floor(age / weekMs);
      if (idx >= 0 && idx < numWeeks) {
        const i = numWeeks - 1 - idx;
        const cat = (e.category || '').toLowerCase();
        
        if (cat.includes('appl')) weeklyEmails[i].appEmails.push(e);
        if (cat.includes('interview') || cat.includes('offer')) weeklyEmails[i].respEmails.push(e);
      }
    });
    
    // Use countUniqueThreads for consistency with carousel
    return weeklyEmails.map((week, i) => ({ 
      week: `W${i + 1}`, 
      applications: countUniqueThreads(week.appEmails), 
      responses: countUniqueThreads(week.respEmails)
    }));
  }, [allRelevantEmails, numWeeks]);
  const Trend = ({ delta, timeframe = "previous period" }) => {
    if (delta === null) return <span className="text-xs text-gray-500">—</span>;
    const up = delta > 0;
    const val = Math.abs(delta);
    return (
      <span className={cn('inline-flex items-center text-xs', up ? 'text-green-600' : 'text-red-600')}>
        {up ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        {up ? '+' : '-'}{val}% from {timeframe}
      </span>
    );
  };

  const TimeTrend = ({ delta }) => {
    if (delta === null) return <span className="text-xs text-gray-500">—</span>;
    const up = delta > 0;
    const val = Math.abs(delta);
    return (
      <span className={cn('inline-flex items-center text-xs', up ? 'text-orange-600' : 'text-green-600')}>
        {up ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        {up ? `+${val}d slower` : `-${val}d improvement`}
      </span>
    );
  };

  // Filter and paginate follow-ups
  const filteredFollowUps = useMemo(() => {
    let filtered = followUpSuggestions;

    // Search filter
    if (followUpSearch.trim()) {
      const searchLower = followUpSearch.toLowerCase();
      filtered = filtered.filter(f => 
        f.title?.toLowerCase().includes(searchLower) ||
        f.company?.toLowerCase().includes(searchLower) ||
        f.position?.toLowerCase().includes(searchLower) ||
        f.description?.toLowerCase().includes(searchLower)
      );
    }

    // Urgency filter
    if (followUpUrgencyFilter !== 'all') {
      filtered = filtered.filter(f => 
        (f.urgency || '').toLowerCase() === followUpUrgencyFilter.toLowerCase()
      );
    }

    // Type filter
    if (followUpTypeFilter !== 'all') {
      filtered = filtered.filter(f => 
        (f.actionType || f.type || '').toLowerCase() === followUpTypeFilter.toLowerCase()
      );
    }

    return filtered;
  }, [followUpSuggestions, followUpSearch, followUpUrgencyFilter, followUpTypeFilter]);

  const totalFollowUpPages = useMemo(() => 
    Math.ceil(filteredFollowUps.length / FOLLOW_UPS_PER_PAGE),
    [filteredFollowUps.length]
  );

  const paginatedFollowUps = useMemo(() => {
    const startIdx = (followUpPage - 1) * FOLLOW_UPS_PER_PAGE;
    return filteredFollowUps.slice(startIdx, startIdx + FOLLOW_UPS_PER_PAGE);
  }, [filteredFollowUps, followUpPage]);

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-[680px] sm:max-w-[760px] space-y-4">
        {isPremium ? (
          <>
            <div className="card p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  Job Search Analytics
                  <span className="text-xs ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">Premium</span>
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400">Deep insights into your job search performance</p>
              </div>

              <div className="mb-4 grid grid-cols-4 gap-1">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'trends', label: 'Trends' },
                  { id: 'performance', label: 'Performance' },
                  { id: 'timing', label: 'Timing' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAnalyticsTab(t.id)}
                    className={cn(
                      'text-xs px-2 py-1 rounded border',
                      analyticsTab === t.id
                        ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white border-transparent'
                        : 'text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {analyticsTab === 'overview' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCarousel
                    totalApplications={totalApplications}
                    appsDeltaPct={appsDeltaPct}
                    responseRate={responseRate}
                    rateDeltaPct={rateDeltaPct}
                    newApplicationsThisWeek={newApplicationsThisWeek}
                    offersCount={offersCount}
                    emailsCur30={emailsCur30}
                    emailsPrev30={emailsPrev30}
                    emailsCur7={emailsCur7}
                    emailsPrev7={emailsPrev7}
                    applicationStats={applicationStats}
                    Trend={Trend}
                  />
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Response Rate</div>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">{responseRate}%</div>
                      </div>
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="mt-1"><Trend delta={rateDeltaPct} /></div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Interviews Scheduled</div>
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{interviewedCount}</div>
                      </div>
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="mt-1 text-xs text-blue-600">+{interviewsThisWeek} this week</div>
                  </div>
                  {/* TODO: Avg Response Time - Disabled until proper company name extraction is implemented
                      Currently uses domain-based matching which doesn't work when:
                      - Applications come from ATS platforms (greenhouse, smartrecruiters) 
                      - Interviews come from company recruiters with different email domains
                      Need to implement company name extraction from subject/body to properly match application→interview
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Avg Response Time</div>
                        <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{artCur ?? Math.max(1, Math.round((offersCount ? 3.2 : 5) * 10) / 10)}d</div>
                      </div>
                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="mt-1"><TimeTrend delta={artDeltaDays} /></div>
                  </div>
                  */}
                </div>
              )}

              {analyticsTab === 'trends' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-700">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">4-Week Activity Trend</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Applications sent vs responses received</p>
                    </div>

                    <div className="relative" style={{ height: '200px' }}>
                      {(() => {
                        // Check if all weekly values are zero
                        const allZero = weeklyData.every(w => w.applications === 0 && w.responses === 0);
                        if (allZero) {
                          return (
                            <div className="flex items-center justify-center h-40 text-sm text-gray-500 dark:text-gray-400">
                              No data available for this period.
                            </div>
                          );
                        }

                        // Data preparation - use minimum of 10 to prevent compression
                        const maxValue = Math.max(...weeklyData.map(w => Math.max(w.applications, w.responses)), 10);
                        const padding = { top: 10, bottom: 10 };
                        const chartHeight = 160;
                        const availableHeight = chartHeight - padding.top - padding.bottom;

                        // Scale function: high values at top, low at bottom
                        const scaleY = (value) => {
                          const ratio = value / maxValue;
                          return padding.top + (availableHeight * (1 - ratio));
                        };

                        // X positions for numWeeks
                        const xPositions = Array.from({ length: numWeeks }, (_, i) => {
                          // Spread evenly from 12 to 87 (for 4 weeks), scale for numWeeks
                          const minX = 12, maxX = 87;
                          if (numWeeks === 1) return (minX + maxX) / 2;
                          return minX + ((maxX - minX) * i) / (numWeeks - 1);
                        });

                        // Generate point arrays
                        const appPointsArray = weeklyData.map((w, i) => ({
                          x: xPositions[i],
                          y: scaleY(w.applications)
                        }));

                        const respPointsArray = weeklyData.map((w, i) => ({
                          x: xPositions[i],
                          y: scaleY(w.responses)
                        }));

                        const appPoints = appPointsArray.map(p => `${p.x},${p.y}`).join(' ');
                        const respPoints = respPointsArray.map(p => `${p.x},${p.y}`).join(' ');

                        // Y-axis ticks
                        const numTicks = 5;
                        const tickStep = maxValue / (numTicks - 1);
                        const yLabels = Array.from({ length: numTicks }, (_, i) =>
                          Math.round(maxValue - (i * tickStep))
                        );

                        return (
                          <>
                            {/* Y-axis labels */}
                            <div className="absolute left-0 top-0 w-7 flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400"
                              style={{ height: `${chartHeight}px`, paddingTop: `${padding.top}px`, paddingBottom: `${padding.bottom}px` }}>
                              {yLabels.map((label, i) => (
                                <div key={i} className="text-right leading-none" style={{ height: 0 }}>
                                  {label}
                                </div>
                              ))}
                            </div>

                            {/* Chart container */}
                            <div className="absolute left-8 right-0 top-0" style={{ height: `${chartHeight}px` }}>
                              <svg width="100%" height="100%" viewBox="0 0 100 160" preserveAspectRatio="none">
                                {/* Horizontal grid lines */}
                                {yLabels.map((_, i) => {
                                  const y = padding.top + (i / (numTicks - 1)) * availableHeight;
                                  return (
                                    <line
                                      key={i}
                                      x1="0"
                                      y1={y}
                                      x2="100"
                                      y2={y}
                                      stroke="currentColor"
                                      strokeWidth="0.3"
                                      className="text-gray-300 dark:text-zinc-600"
                                    />
                                  );
                                })}

                                {/* Area fills */}
                                <polygon
                                  points={`${appPoints} ${xPositions[numWeeks-1]},${chartHeight - padding.bottom} ${xPositions[0]},${chartHeight - padding.bottom}`}
                                  fill="rgb(59, 130, 246)"
                                  opacity="0.15"
                                />
                                <polygon
                                  points={`${respPoints} ${xPositions[numWeeks-1]},${chartHeight - padding.bottom} ${xPositions[0]},${chartHeight - padding.bottom}`}
                                  fill="rgb(34, 197, 94)"
                                  opacity="0.15"
                                />

                                {/* Line paths */}
                                <polyline
                                  points={appPoints}
                                  fill="none"
                                  stroke="rgb(59, 130, 246)"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <polyline
                                  points={respPoints}
                                  fill="none"
                                  stroke="rgb(34, 197, 94)"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />

                                {/* Data point circles */}
                                {weeklyData.map((w, i) => (
                                  <g key={i}>
                                    <circle
                                      cx={appPointsArray[i].x}
                                      cy={appPointsArray[i].y}
                                      r="3.5"
                                      fill="white"
                                      stroke="rgb(59, 130, 246)"
                                      strokeWidth="2.5"
                                    >
                                      <title>Week {i + 1}: {w.applications} applications</title>
                                    </circle>
                                    <circle
                                      cx={respPointsArray[i].x}
                                      cy={respPointsArray[i].y}
                                      r="3.5"
                                      fill="white"
                                      stroke="rgb(34, 197, 94)"
                                      strokeWidth="2.5"
                                    >
                                      <title>Week {i + 1}: {w.responses} responses</title>
                                    </circle>
                                  </g>
                                ))}
                              </svg>
                            </div>

                            {/* X-axis week labels */}
                            <div className="absolute left-8 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                              style={{ top: `${chartHeight + 8}px` }}>
                              {Array.from({ length: numWeeks }, (_, i) => `Week ${i + 1}`).map((label) => (
                                <span key={label} className="text-center" style={{ width: `${100/numWeeks}%` }}>
                                  {label}
                                </span>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-4 mt-8">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Applications ({weeklyData.reduce((sum, w) => sum + w.applications, 0)} total)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Responses ({weeklyData.reduce((sum, w) => sum + w.responses, 0)} total)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">Key Insights</h4>
                    <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                      {(() => {
                        const insights = [];
                        const lastWeekIndex = weeklyData.length - 1;
                        const appChange = weeklyData[lastWeekIndex].applications - weeklyData[0].applications;
                        const latestRespRate = weeklyData[lastWeekIndex].applications > 0 ? Math.round((weeklyData[lastWeekIndex].responses / weeklyData[lastWeekIndex].applications) * 100) : 0;
                        const firstRespRate = weeklyData[0].applications > 0 ? Math.round((weeklyData[0].responses / weeklyData[0].applications) * 100) : 0;

                        if (appChange > 0) {
                          insights.push(`Application volume increased by ${appChange} over ${numWeeks} weeks - excellent momentum`);
                        } else if (appChange < 0) {
                          insights.push(`Application volume decreased by ${Math.abs(appChange)} - consider increasing activity`);
                        } else {
                          insights.push(`Application volume steady - maintain consistency for best results`);
                        }

                        if (latestRespRate > firstRespRate) {
                          insights.push(`Response rate improved from ${firstRespRate}% to ${latestRespRate}% - quality applications paying off`);
                        } else if (latestRespRate < firstRespRate) {
                          insights.push(`Response rate declined from ${firstRespRate}% to ${latestRespRate}% - review application strategy`);
                        }

                        const bestWeek = weeklyData.reduce((best, week, i) => {
                          const rate = week.applications > 0 ? week.responses / week.applications : 0;
                          return rate > best.rate ? { week: i + 1, rate, data: week } : best;
                        }, { week: 0, rate: 0, data: null });

                        if (bestWeek.data) {
                          insights.push(`Week ${bestWeek.week} shows strongest performance with ${bestWeek.data.responses} responses from ${bestWeek.data.applications} applications`);
                        }

                        return insights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{insight}</span>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>
                </div>
              )}

              {analyticsTab === 'performance' && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-16 h-16 mb-4 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Performance Analytics Coming Soon</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-4">
                    We're building detailed insights on which job sources and company types yield the best results for your applications.
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Features in development: Response rates by platform, company type analysis, and optimization recommendations
                  </div>
                </div>
              )}

              {analyticsTab === 'timing' && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-16 h-16 mb-4 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Timing Analysis Coming Soon</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-4">
                    We're developing smart timing recommendations to help you apply and follow up at optimal moments for maximum impact.
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Features in development: Best application times, follow-up timing optimization, and response pattern analysis
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              {categories.map((category) => (
                <CategorySummaryCard
                  key={category.id}
                  categoryKey={category.id}
                  counts={categorizedEmails}
                  onCategorySelect={onCategorySelect}
                />
              ))}
            </div>

            <div className="card p-4 rounded-lg shadow-sm bg-white dark:bg-zinc-800">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Suggested Follow-ups</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400">Actionable steps to advance your job search</p>
              </div>

              {/* Filters */}
              <div className="mb-4 space-y-3">
                {/* Search input */}
                <div>
                  <input
                    type="text"
                    placeholder="Search follow-ups..."
                    value={followUpSearch}
                    onChange={(e) => {
                      setFollowUpSearch(e.target.value);
                      setFollowUpPage(1); // Reset to first page on search
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Urgency and Type filters */}
                <div className="flex gap-2">
                  <select
                    value={followUpUrgencyFilter}
                    onChange={(e) => {
                      setFollowUpUrgencyFilter(e.target.value);
                      setFollowUpPage(1);
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Urgency</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <select
                    value={followUpTypeFilter}
                    onChange={(e) => {
                      setFollowUpTypeFilter(e.target.value);
                      setFollowUpPage(1);
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="email">Email</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="call">Call</option>
                    <option value="research">Research</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="thank_you">Thank You</option>
                    <option value="networking">Networking</option>
                  </select>
                </div>
              </div>

              {/* Follow-up cards */}
              <div className="space-y-3 mb-4">
                {paginatedFollowUps.length > 0 ? (
                  paginatedFollowUps.map((f, idx) => {
                    const suggestionKey = `${f.threadId || f.thread_id}:${f.actionType}`;
                    if (hiddenSuggestions.has(suggestionKey)) return null;
                    
                    return (
                      <DashboardFollowUpCard
                        key={f.threadId || f.id || idx}
                        suggestion={f}
                        markFollowedUp={markFollowedUp}
                        updateRespondedState={updateRespondedState}
                        onEmailSelect={onEmailSelect}
                        openMisclassificationModal={openMisclassificationModal}
                        onActionComplete={handleActionComplete}
                        onSnooze={handleSnooze}
                      />
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-sm text-gray-500 dark:text-zinc-400">
                    {followUpSearch || followUpUrgencyFilter !== 'all' || followUpTypeFilter !== 'all'
                      ? 'No follow-ups match your filters'
                      : 'No follow-ups available'}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalFollowUpPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-zinc-700">
                  <div className="text-xs text-gray-600 dark:text-zinc-400">
                    Page {followUpPage} of {totalFollowUpPages} ({filteredFollowUps.length} total)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFollowUpPage(Math.max(1, followUpPage - 1))}
                      disabled={followUpPage === 1}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setFollowUpPage(Math.min(totalFollowUpPages, followUpPage + 1))}
                      disabled={followUpPage === totalFollowUpPages}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="card p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Recent Activity</h3>
              {recentEmails.length ? (
                <div className="relative">
                  <div className="flex space-x-3 overflow-x-auto no-scrollbar py-2 px-1 scroll-snap-type-x-mandatory -mx-1">
                    {recentEmails.map((email) => (
                      <div key={email.id || email.threadId} className="flex-shrink-0 scroll-snap-align-start" style={{ scrollSnapAlign: 'start' }}>
                        <DashboardEmailCard
                          email={email}
                          onEmailSelect={onEmailSelect}
                          onOpenMisclassificationModal={openMisclassificationModal}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-white/90 dark:from-zinc-900/90"></div>
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white/90 dark:from-zinc-900/90"></div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No recent activity.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <StatCarousel
                totalApplications={totalApplications}
                appsDeltaPct={appsDeltaPct}
                responseRate={responseRate}
                rateDeltaPct={rateDeltaPct}
                newApplicationsThisWeek={newApplicationsThisWeek}
                offersCount={offersCount}
                emailsCur30={emailsCur30}
                emailsPrev30={emailsPrev30}
                emailsCur7={emailsCur7}
                emailsPrev7={emailsPrev7}
                applicationStats={applicationStats}
                Trend={Trend}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              {categories.map((category) => (
                <CategorySummaryCard
                  key={category.id}
                  categoryKey={category.id}
                  counts={categorizedEmails}
                  onCategorySelect={onCategorySelect}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
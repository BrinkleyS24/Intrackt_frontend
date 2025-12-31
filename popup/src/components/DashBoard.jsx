import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FileText, Calendar, Gift, X, Flag, ArrowUp, ArrowDown, BarChart3, TrendingUp, Clock, Info, Target, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
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
    interviewed: 'border-l-4 border-yellow-500',
    offers: 'border-l-4 border-green-500',
    rejected: 'border-l-4 border-red-500',
    irrelevant: 'border-l-4 border-gray-400'
  };
  return colors[category] || 'border-l-4 border-gray-300';
}

function getCategoryBadgeColor(category) {
  const colors = {
    applied: 'bg-blue-100 text-blue-800',
    interviewed: 'bg-yellow-100 text-yellow-800',
    offers: 'bg-green-100 text-green-800',
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
 * InfoTooltip component for displaying helpful explanations
 */
function InfoTooltip({ children, className = "" }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 288; // w-72 = 18rem = 288px
      
      // Calculate left position, ensuring tooltip stays within viewport
      let leftPos = rect.left + rect.width / 2 + window.scrollX;
      
      // Check if tooltip would overflow right edge
      if (leftPos + tooltipWidth / 2 > window.innerWidth) {
        leftPos = window.innerWidth - tooltipWidth / 2 - 10; // 10px padding from edge
      }
      
      // Check if tooltip would overflow left edge
      if (leftPos - tooltipWidth / 2 < 0) {
        leftPos = tooltipWidth / 2 + 10; // 10px padding from edge
      }
      
      setPosition({
        top: rect.top + window.scrollY,
        left: leftPos
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsVisible(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={handleMouseEnter}
        onBlur={() => setIsVisible(false)}
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
        aria-label="More information"
      >
        <Info className="w-4 h-4" />
      </button>
      {isVisible && (
        <div 
          className={cn(
            "fixed z-[99999] w-72 max-w-[90vw] p-3 text-xs leading-relaxed",
            "text-gray-700 bg-white border border-gray-200 rounded-lg shadow-xl",
            "dark:text-gray-200 dark:bg-gray-800 dark:border-gray-700",
            "-translate-x-1/2 -translate-y-full",
            "whitespace-normal break-words",
            "pointer-events-none",
            // Arrow pointing down
            "after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2",
            "after:border-[6px] after:border-transparent after:border-t-white",
            "dark:after:border-t-gray-800",
            className
          )}
          style={{
            top: `${position.top - 12}px`,
            left: `${position.left}px`
          }}
        >
          {children}
        </div>
      )}
    </>
  );
}

/**
 * ApplicationJourneyCard - Shows recent auto-progressions detected by AI
 * Demonstrates autonomous status transitions (your key differentiator)
 */
function ApplicationJourneyCard({ journeys, onEmailSelect }) {
  if (!journeys || journeys.length === 0) return null;
  
  const stageConfig = {
    applied: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Applied' },
    interviewed: { icon: Calendar, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Interviewed' },
    offers: { icon: Gift, color: 'text-green-600', bg: 'bg-green-100', label: 'Offer' },
    rejected: { icon: X, color: 'text-red-600', bg: 'bg-red-100', label: 'Rejected' }
  };
  
  return (
    <div className="card p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-800">
          <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Auto-Detected Progressions</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">Your applications moving forward automatically</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {journeys.slice(0, 3).map((journey, idx) => {
          const fromConfig = stageConfig[journey.fromStage] || stageConfig.applied;
          const toConfig = stageConfig[journey.toStage] || stageConfig.interviewed;
          const FromIcon = fromConfig.icon;
          const ToIcon = toConfig.icon;
          
          return (
            <div 
              key={idx}
              onClick={() => onEmailSelect?.(journey.email)}
              className="flex items-center gap-2 p-2 rounded-lg bg-white/60 dark:bg-zinc-800/60 hover:bg-white dark:hover:bg-zinc-700 cursor-pointer transition-all group"
            >
              <div className={cn("p-1 rounded", fromConfig.bg)}>
                <FromIcon className={cn("h-3 w-3", fromConfig.color)} />
              </div>
              <ArrowRight className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
              <div className={cn("p-1 rounded", toConfig.bg)}>
                <ToIcon className={cn("h-3 w-3", toConfig.color)} />
              </div>
              <div className="flex-1 min-w-0 ml-1">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {journey.company || 'Unknown Company'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {journey.position || journey.subject}
                </p>
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                View →
              </div>
            </div>
          );
        })}
      </div>
      
      {journeys.length > 3 && (
        <p className="text-xs text-center text-indigo-600 dark:text-indigo-400 mt-2">
          +{journeys.length - 3} more progressions detected
        </p>
      )}
    </div>
  );
}

/**
 * CategoryDonutChart - SVG donut chart showing category distribution
 */
function CategoryDonutChart({ applied, interviewed, offers, rejected }) {
  const total = applied + interviewed + offers + rejected;
  if (total === 0) return null;
  
  const data = [
    { label: 'Applied', value: applied, color: '#3B82F6' },
    { label: 'Interviewed', value: interviewed, color: '#EAB308' },
    { label: 'Offers', value: offers, color: '#22C55E' },
    { label: 'Rejected', value: rejected, color: '#EF4444' },
  ].filter(d => d.value > 0);
  
  const radius = 40;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const segments = data.map((item) => {
    const percentage = item.value / total;
    const strokeDasharray = `${circumference * percentage} ${circumference * (1 - percentage)}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += circumference * percentage;
    
    return {
      ...item,
      percentage,
      strokeDasharray,
      strokeDashoffset,
    };
  });
  
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <svg width="100" height="100" viewBox="0 0 100 100">
          {segments.map((segment, idx) => (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              transform="rotate(-90 50 50)"
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">{total}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Total</div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {segments.map((segment, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {segment.label}: {segment.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
      subtitle: applicationStats?.emails?.total ? `From ${applicationStats.emails.total} conversations` : null,
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
    applied: { 
      title: 'Applied', 
      icon: FileText, 
      description: 'Jobs you\'ve applied to',
      tooltip: 'Track all the positions you\'ve submitted applications for',
      iconBg: 'bg-blue-100', 
      iconText: 'text-blue-600' 
    },
    interviewed: { 
      title: 'Interviewed', 
      icon: Calendar, 
      description: 'Interview scheduled',
      tooltip: 'Applications that have progressed to the interview stage. Click to see all interview conversations.',
      iconBg: 'bg-yellow-100', 
      iconText: 'text-yellow-600' 
    },
    offers: { 
      title: 'Offers', 
      icon: Gift, 
      description: 'Offers received',
      tooltip: 'Job offers you\'ve received - congratulations!',
      iconBg: 'bg-green-100', 
      iconText: 'text-green-600' 
    },
    rejected: { 
      title: 'Rejected', 
      icon: X, 
      description: 'Not selected',
      tooltip: 'Applications that weren\'t successful this time',
      iconBg: 'bg-red-100', 
      iconText: 'text-red-600' 
    }
  };

  const config = categoryConfig[categoryKey];
  if (!config) return null;

  const { title: categoryTitle, icon: IconComponent, description, tooltip, iconBg: iconBgColorClass, iconText: iconTextColorClass } = config;
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
        <div className="flex items-center">
          <h4 className="text-md font-semibold text-gray-900 dark:text-white">{categoryTitle}</h4>
          <InfoTooltip>
            {tooltip}
          </InfoTooltip>
        </div>
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
      case 'networking': return '💼';
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
  const isPremium = false;
  const [analyticsTab, setAnalyticsTab] = useState('overview');
  const [followUpSearch, setFollowUpSearch] = useState('');
  const [followUpUrgencyFilter, setFollowUpUrgencyFilter] = useState('all');
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState('all');
  const [followUpPage, setFollowUpPage] = useState(1);
  const [hiddenSuggestions, setHiddenSuggestions] = useState(new Set());
  const [roleMappings, setRoleMappings] = useState({});
  const [loadingRoleMappings, setLoadingRoleMappings] = useState(false);
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
      // Handle expired refresh token (INVALID_GRANT)
      if (message.type === 'AUTH_ERROR' || message.errorCode === 'INVALID_GRANT') {
        showNotification(
          '🔐 Your Google session has expired. Please sign out and sign back in to continue syncing emails.',
          'error',
          null,
          15000 // Show for 15 seconds - important message
        );
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Fetch role mappings for intelligent job title grouping
  const fetchRoleMappings = useCallback(async (roles) => {
    if (!roles || roles.length === 0) return {};
    
    try {
      setLoadingRoleMappings(true);
      
      // Get auth token
      const tokenResponse = await chrome.runtime.sendMessage({ type: 'GET_ID_TOKEN' });
      if (!tokenResponse?.success) {
        throw new Error('Failed to get authentication token');
      }

      const BACKEND_URL = 'http://localhost:3000';
      const response = await fetch(`${BACKEND_URL}/api/emails/normalize-roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenResponse.token}`
        },
        body: JSON.stringify({ roles })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.mappings) {
        console.log(`[Dashboard] Loaded ${Object.keys(data.mappings).length} role mappings (${data.cached} cached, ${data.new} new)`);
        return data.mappings;
      }
      return {};
    } catch (error) {
      console.error('[Dashboard] Error fetching role mappings:', error);
      return {};
    } finally {
      setLoadingRoleMappings(false);
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
    // Always use frontend categorization - applicationStats can be stale
    return getCount('applied');
  }, [getCount]);
  
  const interviewedCount = useMemo(() => {
    // Always use frontend categorization - applicationStats can be stale
    return getCount('interviewed');
  }, [getCount]);
  
  const offersCount = useMemo(() => {
    // Always use frontend categorization - applicationStats can be stale
    return getCount('offers');
  }, [getCount]);
  
  const rejectedCount = useMemo(() => {
    // Always use frontend categorization - applicationStats can be stale
    return getCount('rejected');
  }, [getCount]);
  
  const irrelevantCount = useMemo(() => getCount('irrelevant'), [getCount]);

  const allRelevantEmails = useMemo(() => {
    const relevantEmails = Object.values(categorizedEmails).flat()
      .filter(email => email.category?.toLowerCase() !== 'irrelevant');
    return relevantEmails;
  }, [categorizedEmails]);

  // Detect application journeys - threads that have progressed through stages
  // This showcases our AI's autonomous status detection capability
  const applicationJourneys = useMemo(() => {
    const stageOrder = { applied: 1, interviewed: 2, offers: 3, rejected: 4 };
    const threadMap = new Map();
    
    // Group all emails by thread
    allRelevantEmails.forEach(email => {
      const threadId = email.thread_id || email.threadId;
      if (!threadId) return;
      
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, {
          emails: [],
          company: email.company_name || email.company,
          position: email.position,
          subject: email.subject
        });
      }
      threadMap.get(threadId).emails.push(email);
    });
    
    // Find threads with multiple stages (indicating progression)
    const journeys = [];
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    threadMap.forEach((thread, threadId) => {
      const stages = new Set();
      let latestEmail = null;
      let latestDate = 0;
      
      thread.emails.forEach(email => {
        const cat = (email.category || '').toLowerCase();
        if (stageOrder[cat]) {
          stages.add(cat);
        }
        const emailDate = new Date(email.date).getTime();
        if (emailDate > latestDate) {
          latestDate = emailDate;
          latestEmail = email;
        }
      });
      
      // Only show recent progressions (last 7 days) with multiple stages
      if (stages.size >= 2 && latestDate >= sevenDaysAgo) {
        const stageArr = Array.from(stages).sort((a, b) => stageOrder[a] - stageOrder[b]);
        journeys.push({
          threadId,
          fromStage: stageArr[0],
          toStage: stageArr[stageArr.length - 1],
          company: thread.company,
          position: thread.position,
          subject: thread.subject,
          email: latestEmail,
          date: latestDate
        });
      }
    });
    
    // Sort by most recent first
    return journeys.sort((a, b) => b.date - a.date);
  }, [allRelevantEmails]);

  const totalApplications = useMemo(() => {
    // Always use frontend categorization - applicationStats can be stale (doesn't update in real-time)
    // Frontend categorization reflects the actual emails the user has categorized
    // Backend applicationStats requires recalculation triggers that may lag behind email sync
    return countUniqueThreads(allRelevantEmails);
  }, [allRelevantEmails]);

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

  const responseTiming = useMemo(() => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const STALE_DAYS = 14;
    const now = Date.now();

    const median = (values) => {
      if (!values || values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
      return sorted[mid];
    };

    const percentile = (values, p) => {
      if (!values || values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const idx = (sorted.length - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return sorted[lo];
      const w = idx - lo;
      return sorted[lo] * (1 - w) + sorted[hi] * w;
    };

    const getCompanyDisplay = (e) =>
      e.company_name_corrected ||
      e.companyNameCorrected ||
      e.company_name ||
      e.companyName ||
      e.company ||
      'Unknown company';

    const getPositionDisplay = (e) =>
      e.position_corrected ||
      e.positionCorrected ||
      e.position ||
      'Unknown role';

    const getKey = (e) =>
      e.application_id ||
      e.applicationId ||
      e.thread_id ||
      e.threadId ||
      `fallback:${getCompanyDisplay(e)}::${getPositionDisplay(e)}`;

    const groups = new Map();

    const parseEmailMs = (d) => {
      const t = Date.parse(d);
      return Number.isNaN(t) ? null : t;
    };

    for (const e of allRelevantEmails || []) {
      const t = parseEmailMs(e.date);
      if (t === null) continue;

      const key = getKey(e);
      const category = (e.category || '').toLowerCase();

      let rec = groups.get(key);
      if (!rec) {
        rec = {
          key,
          company: getCompanyDisplay(e),
          position: getPositionDisplay(e),
          appliedMs: null,
          firstInterviewMs: null,
          firstOfferMs: null,
          firstRejectMs: null,
          lastActivityMs: t
        };
        groups.set(key, rec);
      }

      // Keep the richest display values we see.
      const company = getCompanyDisplay(e);
      const position = getPositionDisplay(e);
      if (rec.company === 'Unknown company' && company !== 'Unknown company') rec.company = company;
      if (rec.position === 'Unknown role' && position !== 'Unknown role') rec.position = position;

      rec.lastActivityMs = Math.max(rec.lastActivityMs ?? t, t);

      if (category.includes('appl')) rec.appliedMs = Math.min(rec.appliedMs ?? t, t);
      if (category.includes('interview')) rec.firstInterviewMs = Math.min(rec.firstInterviewMs ?? t, t);
      if (category.includes('offer')) rec.firstOfferMs = Math.min(rec.firstOfferMs ?? t, t);
      if (category.includes('reject')) rec.firstRejectMs = Math.min(rec.firstRejectMs ?? t, t);
    }

    const timeToFirstResponseDays = [];
    const timeToInterviewDays = [];
    const timeInterviewToOfferDays = [];

    const stale = [];

    let appliedCount = 0;
    let respondedCount = 0;

    for (const rec of groups.values()) {
      if (rec.appliedMs === null) continue;
      appliedCount += 1;

      const responseCandidates = [rec.firstInterviewMs, rec.firstOfferMs, rec.firstRejectMs].filter(
        (x) => typeof x === 'number' && x >= rec.appliedMs
      );
      const firstResponseMs = responseCandidates.length ? Math.min(...responseCandidates) : null;

      if (firstResponseMs !== null) {
        respondedCount += 1;
        timeToFirstResponseDays.push((firstResponseMs - rec.appliedMs) / MS_PER_DAY);
      } else {
        const daysSinceApplied = (now - rec.appliedMs) / MS_PER_DAY;
        if (daysSinceApplied >= STALE_DAYS) {
          stale.push({
            key: rec.key,
            company: rec.company,
            position: rec.position,
            daysSinceApplied: Math.round(daysSinceApplied),
            lastActivityDaysAgo: Math.round((now - (rec.lastActivityMs ?? rec.appliedMs)) / MS_PER_DAY)
          });
        }
      }

      if (rec.firstInterviewMs !== null && rec.firstInterviewMs >= rec.appliedMs) {
        timeToInterviewDays.push((rec.firstInterviewMs - rec.appliedMs) / MS_PER_DAY);
      }

      if (
        rec.firstInterviewMs !== null &&
        rec.firstOfferMs !== null &&
        rec.firstOfferMs >= rec.firstInterviewMs
      ) {
        timeInterviewToOfferDays.push((rec.firstOfferMs - rec.firstInterviewMs) / MS_PER_DAY);
      }
    }

    stale.sort((a, b) => b.daysSinceApplied - a.daysSinceApplied);

    const round1 = (v) => (v === null ? null : Math.round(v * 10) / 10);

    return {
      staleDaysThreshold: STALE_DAYS,
      appliedCount,
      respondedCount,
      responseRatePct: appliedCount > 0 ? Math.round((respondedCount / appliedCount) * 100) : 0,
      staleCount: stale.length,
      staleTop: stale.slice(0, 5),

      medianFirstResponseDays: round1(median(timeToFirstResponseDays)),
      p25FirstResponseDays: round1(percentile(timeToFirstResponseDays, 0.25)),
      p75FirstResponseDays: round1(percentile(timeToFirstResponseDays, 0.75)),
      sampleFirstResponse: timeToFirstResponseDays.length,

      medianInterviewDays: round1(median(timeToInterviewDays)),
      sampleInterview: timeToInterviewDays.length,

      medianInterviewToOfferDays: round1(median(timeInterviewToOfferDays)),
      sampleInterviewToOffer: timeInterviewToOfferDays.length
    };
  }, [allRelevantEmails]);

  // Configurable number of weeks for chart (Premium only)
  const numWeeks = 4;
  const weeklyData = useMemo(() => {
    if (!isPremium) return []; // Only calculate for premium users
    
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
    
    return weeklyEmails.map((week, i) => ({ 
      week: `W${i + 1}`, 
      applications: countUniqueThreads(week.appEmails), 
      responses: countUniqueThreads(week.respEmails)
    }));
  }, [allRelevantEmails, numWeeks, isPremium]);
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

  // TODO: Role normalization with GPT-4 - Postponed for future release
  // Feature requires more prompt tuning to properly group semantic equivalents
  // while preserving meaningful distinctions (levels, qualifications, etc.)
  // For now, Performance tab shows ungrouped role-by-role breakdown
  
  // Fetch role mappings when Performance tab is viewed for the first time
  // useEffect(() => {
  //   if (analyticsTab === 'performance' && isPremium && !loadingRoleMappings) {
  //     // Check if we already have mappings for current roles
  //     const uniqueRoles = [...new Set(
  //       allRelevantEmails
  //         .map(email => email.position)
  //         .filter(pos => pos && pos !== 'Unknown Position')
  //     )];
  //     
  //     // Only fetch if we have roles and don't have mappings for all of them
  //     const unmappedRoles = uniqueRoles.filter(role => !roleMappings[role]);
  //     
  //     if (unmappedRoles.length > 0) {
  //       console.log(`[Dashboard] Fetching mappings for ${unmappedRoles.length} unmapped roles`);
  //       fetchRoleMappings(uniqueRoles).then(mappings => {
  //         setRoleMappings(mappings);
  //       });
  //     }
  //   }
  // }, [analyticsTab, isPremium]); // Only depend on tab and premium status to avoid loops

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-[680px] sm:max-w-[760px] space-y-4">
        {isPremium ? (
          <>
            {/* AI Auto-Progression Card - Key Differentiator */}
            {applicationJourneys.length > 0 && (
              <ApplicationJourneyCard 
                journeys={applicationJourneys} 
                onEmailSelect={onEmailSelect}
              />
            )}
            
            <div className="card p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  Job Search Analytics
                  <span className="text-xs ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">Premium</span>
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400">Deep insights into your job search performance</p>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-1">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'distribution', label: 'Distribution' },
                  ...(isPremium ? [{ id: 'trends', label: 'Trends' }] : [])
                  // TODO V2: Add Performance tab (role-based patterns) - requires domain-agnostic categorization
                  // TODO V2: Add Timing tab (optimal application/follow-up timing analysis)
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Simple snapshot cards - no trends or deltas */}
                  <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-xs opacity-90">Job Applications</div>
                      <FileText className="h-4 w-4 opacity-75" />
                    </div>
                    <div className="text-2xl font-bold">{totalApplications}</div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">Response Rate</div>
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{responseRate}%</div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">Interviewing</div>
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{interviewedCount}</div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">Offers</div>
                      <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{offersCount}</div>
                  </div>
                </div>
              )}

              {analyticsTab === 'distribution' && (
                <div className="space-y-4">
                  {/* Category Distribution Donut Chart */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-zinc-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Application Status Distribution</h4>
                    <div className="flex justify-center">
                      <CategoryDonutChart 
                        applied={appliedCount}
                        interviewed={interviewedCount}
                        offers={offersCount}
                        rejected={rejectedCount}
                      />
                    </div>
                  </div>
                  
                  {/* Status Progress Bars */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-zinc-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Status Breakdown</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Applied', count: appliedCount, color: 'bg-blue-500', total: totalApplications },
                        { label: 'Interviewed', count: interviewedCount, color: 'bg-yellow-500', total: totalApplications },
                        { label: 'Offers', count: offersCount, color: 'bg-green-500', total: totalApplications },
                        { label: 'Rejected', count: rejectedCount, color: 'bg-red-500', total: totalApplications },
                      ].map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {item.count} ({item.total > 0 ? Math.round((item.count / item.total) * 100) : 0}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-200 dark:bg-zinc-600 overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all", item.color)}
                              style={{ width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Learning Banner */}
                  <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-indigo-900 dark:text-indigo-300">
                          Self-Learning AI Classification
                        </p>
                        <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                          When you correct a misclassification, our AI learns from it. Your corrections are used to 
                          continuously improve classification accuracy for everyone.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {analyticsTab === 'trends' && isPremium && (
                <div className="space-y-3">
                  {/* Conversion Funnel - PRIMARY FEATURE */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="mb-4">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">Your Job Search Funnel</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Track your progress from application to offer</p>
                    </div>

                    {(() => {
                      // Calculate funnel stages
                      const applications = totalApplications;
                      const interviews = interviewedCount;
                      const offers = offersCount;
                      
                      // Calculate conversion rates
                      const appToInterview = applications > 0 ? Math.round((interviews / applications) * 100) : 0;
                      const interviewToOffer = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;
                      const overallConversion = applications > 0 ? Math.round((offers / applications) * 100) : 0;
                      
                      // Determine stage widths for visual funnel (max 100%, min 20%)
                      const maxCount = Math.max(applications, interviews, offers, 1);
                      const appWidth = 100;
                      const intWidth = Math.max(20, Math.round((interviews / maxCount) * 100));
                      const offWidth = Math.max(20, Math.round((offers / maxCount) * 100));
                      
                      return (
                        <>
                          {/* Visual Funnel */}
                          <div className="space-y-3 mb-4">
                            {/* Applications Stage */}
                            <div className="relative">
                              <div 
                                className="h-16 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-between px-4 text-white shadow-md transition-all hover:shadow-lg"
                                style={{ width: `${appWidth}%` }}
                              >
                                <div>
                                  <div className="text-xs font-medium opacity-90">Applications</div>
                                  <div className="text-2xl font-bold">{applications}</div>
                                </div>
                                <FileText className="h-6 w-6 opacity-75" />
                              </div>
                            </div>

                            {/* Conversion Arrow 1 */}
                            {applications > 0 && (
                              <div className="flex items-center gap-2 pl-4">
                                <ArrowDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className={cn(
                                  "text-xs font-medium px-2 py-0.5 rounded",
                                  appToInterview >= 20 
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : appToInterview >= 10
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                  {appToInterview}% conversion
                                </span>
                              </div>
                            )}

                            {/* Interviews Stage */}
                            <div className="relative">
                              <div 
                                className="h-16 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-between px-4 text-white shadow-md transition-all hover:shadow-lg"
                                style={{ width: `${intWidth}%`, marginLeft: `${(100 - intWidth) / 2}%` }}
                              >
                                <div>
                                  <div className="text-xs font-medium opacity-90">Interviews</div>
                                  <div className="text-2xl font-bold">{interviews}</div>
                                </div>
                                <Calendar className="h-6 w-6 opacity-75" />
                              </div>
                            </div>

                            {/* Conversion Arrow 2 */}
                            {interviews > 0 && (
                              <div className="flex items-center gap-2 pl-4" style={{ marginLeft: `${(100 - intWidth) / 2}%` }}>
                                <ArrowDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                <span className={cn(
                                  "text-xs font-medium px-2 py-0.5 rounded",
                                  interviewToOffer >= 30 
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : interviewToOffer >= 15
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                  {interviewToOffer}% conversion
                                </span>
                              </div>
                            )}

                            {/* Offers Stage */}
                            <div className="relative">
                              <div 
                                className="h-16 rounded-lg bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-between px-4 text-white shadow-md transition-all hover:shadow-lg"
                                style={{ width: `${offWidth}%`, marginLeft: `${(100 - offWidth) / 2}%` }}
                              >
                                <div>
                                  <div className="text-xs font-medium opacity-90">Offers</div>
                                  <div className="text-2xl font-bold">{offers}</div>
                                </div>
                                <Gift className="h-6 w-6 opacity-75" />
                              </div>
                            </div>
                          </div>

                          {/* Diagnostic Insights */}
                          <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                            <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                              <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              Diagnostic Insights
                            </h5>
                            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                              {applications === 0 && (
                                <p className="text-gray-500 dark:text-gray-400">
                                  Start applying to jobs to see your funnel take shape!
                                </p>
                              )}
                              
                              {applications > 0 && interviews === 0 && (
                                <>
                                  <p className="flex items-start gap-2">
                                    <span className="text-orange-600 dark:text-orange-400">•</span>
                                    <span><strong>Top-of-funnel issue:</strong> {applications} applications but no interviews yet. This suggests a resume/application optimization opportunity.</span>
                                  </p>
                                  <p className="flex items-start gap-2 ml-5 text-gray-600 dark:text-gray-400">
                                    Consider: Tailoring your resume to job descriptions, using relevant keywords, and ensuring ATS compatibility.
                                  </p>
                                </>
                              )}
                              
                              {applications > 0 && interviews > 0 && appToInterview < 10 && (
                                <>
                                  <p className="flex items-start gap-2">
                                    <span className="text-red-600 dark:text-red-400">•</span>
                                    <span><strong>Low application-to-interview rate ({appToInterview}%):</strong> Many job searches see ~10–20% conversion, but it varies by role and market. Your application materials may need refinement.</span>
                                  </p>
                                  <p className="flex items-start gap-2 ml-5 text-gray-600 dark:text-gray-400">
                                    Focus: Resume optimization, targeted applications, keyword matching.
                                  </p>
                                </>
                              )}
                              
                              {appToInterview >= 10 && appToInterview < 20 && (
                                <p className="flex items-start gap-2">
                                  <span className="text-yellow-600 dark:text-yellow-400">•</span>
                                  <span><strong>Average application-to-interview rate ({appToInterview}%):</strong> You're in the typical range. Small improvements to targeting could boost this further.</span>
                                </p>
                              )}
                              
                              {appToInterview >= 20 && (
                                <p className="flex items-start gap-2">
                                  <span className="text-green-600 dark:text-green-400">•</span>
                                  <span><strong>Strong application-to-interview rate ({appToInterview}%):</strong> Your resume and targeting are working well! Keep this momentum.</span>
                                </p>
                              )}
                              
                              {interviews > 0 && offers === 0 && (
                                <>
                                  <p className="flex items-start gap-2">
                                    <span className="text-orange-600 dark:text-orange-400">•</span>
                                    <span><strong>Bottom-of-funnel issue:</strong> Getting interviews but no offers yet suggests interview performance opportunity.</span>
                                  </p>
                                  <p className="flex items-start gap-2 ml-5 text-gray-600 dark:text-gray-400">
                                    Consider: Mock interviews, technical practice, behavioral question prep, and post-interview follow-ups.
                                  </p>
                                </>
                              )}
                              
                              {interviews > 0 && offers > 0 && interviewToOffer < 15 && (
                                <>
                                  <p className="flex items-start gap-2">
                                    <span className="text-yellow-600 dark:text-yellow-400">🟡</span>
                                    <span><strong>Interview-to-offer rate ({interviewToOffer}%):</strong> Below typical range (15-30%). Focus on interview skills.</span>
                                  </p>
                                  <p className="flex items-start gap-2 ml-5 text-gray-600 dark:text-gray-400">
                                    💡 Focus: Interview preparation, clear communication, technical skills demonstration.
                                  </p>
                                </>
                              )}
                              
                              {interviewToOffer >= 15 && interviewToOffer < 30 && (
                                <p className="flex items-start gap-2">
                                  <span className="text-green-600 dark:text-green-400">✅</span>
                                  <span><strong>Good interview-to-offer rate ({interviewToOffer}%):</strong> You're converting interviews effectively. Keep practicing!</span>
                                </p>
                              )}
                              
                              {interviewToOffer >= 30 && (
                                <p className="flex items-start gap-2">
                                  <span className="text-green-600 dark:text-green-400">🎉</span>
                                  <span><strong>Excellent interview-to-offer rate ({interviewToOffer}%):</strong> You're closing interviews at a strong rate!</span>
                                </p>
                              )}
                              
                              {offers > 0 && (
                                <p className="flex items-start gap-2">
                                  <span className="text-purple-600 dark:text-purple-400">🎊</span>
                                  <span><strong>Overall success rate: {overallConversion}%</strong> — You've converted {offers} of {applications} applications into offers. Great work!</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Application Volume Chart - SUPPORTING FEATURE */}
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-700">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Application Consistency Tracker</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your application volume over the past 4 weeks</p>
                    </div>

                    <div className="relative" style={{ height: '200px' }}>
                          {(() => {
                            // Check if all weekly values are zero
                            const allZero = weeklyData.every(w => w.applications === 0);
                            if (allZero) {
                              return (
                                <div className="flex items-center justify-center h-40 text-sm text-gray-500 dark:text-gray-400">
                                  No applications sent in this period.
                                </div>
                              );
                            }

                            // Data preparation - use minimum of 10 to prevent compression
                            const maxValue = Math.max(...weeklyData.map(w => w.applications), 10);
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

                            // Generate point arrays (applications only)
                            const appPointsArray = weeklyData.map((w, i) => ({
                              x: xPositions[i],
                              y: scaleY(w.applications)
                            }));

                            const appPoints = appPointsArray.map(p => `${p.x},${p.y}`).join(' ');

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

                                    {/* Area fill */}
                                    <polygon
                                      points={`${appPoints} ${xPositions[numWeeks-1]},${chartHeight - padding.bottom} ${xPositions[0]},${chartHeight - padding.bottom}`}
                                      fill="rgb(59, 130, 246)"
                                      opacity="0.15"
                                    />

                                    {/* Line path */}
                                    <polyline
                                      points={appPoints}
                                      fill="none"
                                      stroke="rgb(59, 130, 246)"
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
                          Applications sent ({weeklyData.reduce((sum, w) => sum + w.applications, 0)} total)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Weekly Breakdown */}
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Weekly Breakdown</h4>
                    <div className="space-y-2">
                      {weeklyData.map((week, i) => {
                        const prevWeek = i > 0 ? weeklyData[i - 1] : null;
                        const change = prevWeek ? week.applications - prevWeek.applications : 0;
                        const changePercent = prevWeek && prevWeek.applications > 0 
                          ? Math.round((change / prevWeek.applications) * 100)
                          : null;
                        
                        return (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-zinc-600 last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-14">Week {i + 1}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {week.applications} {week.applications === 1 ? 'app' : 'apps'}
                                </span>
                                {changePercent !== null && change !== 0 && (
                                  <span className={cn(
                                    "text-xs px-1.5 py-0.5 rounded",
                                    change > 0 
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  )}>
                                    {change > 0 ? '+' : ''}{changePercent}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-2 rounded-full bg-blue-200 dark:bg-blue-800" style={{ width: '60px' }}>
                                <div 
                                  className="h-2 rounded-full bg-blue-500 dark:bg-blue-400 transition-all"
                                  style={{ 
                                    width: `${Math.min(100, (week.applications / Math.max(...weeklyData.map(w => w.applications), 1)) * 100)}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">Last 30 Days</div>
                      <div className="text-xl font-bold text-blue-900 dark:text-blue-300 mb-1">
                        {appsCur}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {appsDeltaPct !== 0 && (
                          <>
                            {appsDeltaPct > 0 ? (
                              <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                            )}
                            <span className={cn(
                              appsDeltaPct > 0 
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            )}>
                              {Math.abs(appsDeltaPct)}% vs prev 30d
                            </span>
                          </>
                        )}
                        {appsDeltaPct === 0 && (
                          <span className="text-gray-600 dark:text-gray-400">No change</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="text-xs text-green-700 dark:text-green-400 mb-1">Response Rate</div>
                      <div className="text-xl font-bold text-green-900 dark:text-green-300 mb-1">
                        {respRateCur}%
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {rateDeltaPct !== null && rateDeltaPct !== 0 && (
                          <>
                            {rateDeltaPct > 0 ? (
                              <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                            )}
                            <span className={cn(
                              rateDeltaPct > 0 
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            )}>
                              {rateDeltaPct > 0 ? '+' : ''}{rateDeltaPct}pp vs prev 30d
                            </span>
                          </>
                        )}
                        {(rateDeltaPct === null || rateDeltaPct === 0) && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {interviewsCur + offersCur} responses
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                      <div className="text-xs text-orange-700 dark:text-orange-400 mb-1">Median Time to First Response</div>
                      <div className="text-xl font-bold text-orange-900 dark:text-orange-300 mb-1">
                        {responseTiming.medianFirstResponseDays !== null ? `${responseTiming.medianFirstResponseDays}d` : '—'}
                      </div>
                      <div className="text-xs text-orange-700 dark:text-orange-400">
                        {responseTiming.medianFirstResponseDays !== null
                          ? `Based on ${responseTiming.sampleFirstResponse} responded applications`
                          : 'No responses yet'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                      <div className="text-xs text-indigo-700 dark:text-indigo-400 mb-1">Median Time to Interview</div>
                      <div className="text-xl font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                        {responseTiming.medianInterviewDays !== null ? `${responseTiming.medianInterviewDays}d` : '—'}
                      </div>
                      <div className="text-xs text-indigo-700 dark:text-indigo-400">
                        {responseTiming.sampleInterview > 0
                          ? `Based on ${responseTiming.sampleInterview} interviews`
                          : 'No interview data yet'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <div className="text-xs text-red-700 dark:text-red-400 mb-1">Stale Applications</div>
                      <div className="text-xl font-bold text-red-900 dark:text-red-300 mb-1">
                        {responseTiming.staleCount}
                      </div>
                      <div className="text-xs text-red-700 dark:text-red-400">
                        {responseTiming.staleCount > 0
                          ? `Oldest: ${responseTiming.staleTop[0]?.daysSinceApplied}d`
                          : `None >${responseTiming.staleDaysThreshold}d`}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                      <div className="text-xs text-purple-700 dark:text-purple-400 mb-1">Active Interviews</div>
                      <div className="text-xl font-bold text-purple-900 dark:text-purple-300 mb-1">
                        {interviewedCount}
                      </div>
                      <div className="text-xs text-purple-700 dark:text-purple-400">
                        +{interviewsThisWeek} this week
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">Your Insights</h4>
                    <ul className="space-y-1.5 text-xs text-amber-700 dark:text-amber-400">
                      {(() => {
                        const insights = [];
                        
                        // Calculate overall metrics
                        const totalApps = weeklyData.reduce((sum, w) => sum + w.applications, 0);
                        const totalResps = weeklyData.reduce((sum, w) => sum + w.responses, 0);
                        const userResponseRate = totalApps > 0 ? (totalResps / totalApps) * 100 : 0;
                        const hasTiming = responseTiming.sampleFirstResponse > 0 && responseTiming.medianFirstResponseDays !== null;
                        
                        if (hasTiming) {
                          insights.push(`Median time to first response: ${responseTiming.medianFirstResponseDays} days (n=${responseTiming.sampleFirstResponse})`);
                          if (responseTiming.p25FirstResponseDays !== null && responseTiming.p75FirstResponseDays !== null) {
                            insights.push(`Typical range: ${responseTiming.p25FirstResponseDays}–${responseTiming.p75FirstResponseDays} days`);
                          }
                        }

                        if (responseTiming.staleCount > 0) {
                          insights.push(`${responseTiming.staleCount} applications are stale (> ${responseTiming.staleDaysThreshold} days with no response)`);
                          const oldest = responseTiming.staleTop?.[0];
                          if (oldest?.company && oldest?.daysSinceApplied) {
                            insights.push(`Oldest stale: ${oldest.company} (${oldest.daysSinceApplied} days)`);
                          }
                        }
                        
                        // SELF-COMPARISON: Your performance summary
                        if (totalApps >= 5) {
                          insights.push(`${userResponseRate.toFixed(0)}% of your ${totalApps} applications received responses`);
                          
                          if (userResponseRate >= 30) {
                            insights.push(`Strong conversion rate — your materials are resonating with employers`);
                          } else if (userResponseRate >= 15) {
                            insights.push(`Solid response rate — you're getting noticed by employers`);
                          } else if (userResponseRate >= 5) {
                            insights.push(`Building momentum — review your best-performing applications for patterns`);
                          } else if (userResponseRate > 0) {
                            insights.push(`Early stages — response rates typically improve as you refine your approach`);
                          }
                        }
                        
                        // Calculate week-over-week momentum
                        const weeklyChanges = [];
                        for (let i = 1; i < weeklyData.length; i++) {
                          weeklyChanges.push(weeklyData[i].applications - weeklyData[i - 1].applications);
                        }
                        const avgWeeklyChange = weeklyChanges.length > 0 
                          ? weeklyChanges.reduce((sum, change) => sum + change, 0) / weeklyChanges.length 
                          : 0;
                        
                        // MOMENTUM TRACKING: Compare your recent weeks
                        if (weeklyData.length >= 2) {
                          const recentWeek = weeklyData[weeklyData.length - 1];
                          const previousWeek = weeklyData[weeklyData.length - 2];
                          
                          if (recentWeek.applications > previousWeek.applications) {
                            const increase = recentWeek.applications - previousWeek.applications;
                            insights.push(`You increased applications by ${increase} this week vs last week`);
                          } else if (recentWeek.applications < previousWeek.applications) {
                            const decrease = previousWeek.applications - recentWeek.applications;
                            insights.push(`Application volume down ${decrease} this week — consider ramping back up`);
                          }
                        }
                        
                        // TIME-BASED PATTERNS (descriptive, not prescriptive)
                        const dayBuckets = Array(7).fill(0).map(() => ({ apps: 0, responses: 0 }));
                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        
                        allRelevantEmails.forEach(e => {
                          if (!e.date) return;
                          const dayOfWeek = new Date(e.date).getDay();
                          const cat = (e.category || '').toLowerCase();
                          
                          if (cat.includes('appl')) dayBuckets[dayOfWeek].apps++;
                          if (cat.includes('interview') || cat.includes('offer')) {
                            dayBuckets[dayOfWeek].responses++;
                          }
                        });
                        
                        // Find best performing day (min 3 apps for pattern)
                        let bestDay = null;
                        let bestRate = 0;
                        dayBuckets.forEach((bucket, idx) => {
                          if (bucket.apps >= 3) {
                            const rate = bucket.responses / bucket.apps;
                            if (rate > bestRate) {
                              bestRate = rate;
                              bestDay = idx;
                            }
                          }
                        });
                        
                        if (bestDay !== null && bestRate > 0 && totalApps >= 10) {
                          const bestRatePercent = Math.round(bestRate * 100);
                          const bestDayApps = dayBuckets[bestDay].apps;
                          insights.push(`Your ${dayNames[bestDay]} applications (${bestDayApps} sent) show ${bestRatePercent}% response rate`);
                        }
                        
                        // EDUCATIONAL CONTEXT: General principles
                        if (totalApps >= 3 && insights.length < 3) {
                          insights.push(`Consistency helps: applying regularly tends to increase chances of responses`);
                        }
                        
                        // Fallback for very early users
                        if (insights.length === 0) {
                          if (totalApps >= 1) {
                            insights.push(`You've started tracking your job search — keep applying to build meaningful patterns`);
                            insights.push(`Insights improve with more data — aim for at least 10 applications to see trends`);
                          } else {
                            insights.push(`Apply to jobs to start seeing personalized insights about your search`);
                          }
                        }

                        return insights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-0.5">•</span>
                            <span>{insight}</span>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>
                </div>
              )}

              {/* TODO V2: Performance Tab - Application Pattern Explorer
                  Requires domain-agnostic role categorization to work for all job types.
                  Current implementation uses tech-specific keywords (QA, Frontend, Backend, SWE).
                  
                  Options for V2:
                  1. User self-categorization: Let users define their own role categories during onboarding
                  2. Remove role grouping: Show patterns by time/response speed/company size instead
                  3. O*NET integration: Use government SOC taxonomy (1,016 occupations)
                  
                  Feature postponed until user demand validated and categorization approach decided.
              */}
              {/* analyticsTab === 'performance' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-700">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                        📊 Application Pattern Explorer
                        <InfoTooltip>
                          <div className="space-y-2">
                            <p className="font-semibold">Understanding Your Data:</p>
                            <p>This tool shows patterns in your application data, but does NOT make recommendations. Sample sizes matter!</p>
                            <p className="font-semibold mt-2">Sample Size Guide:</p>
                            <p>🔴 Red (&lt;10): Too small for conclusions</p>
                            <p>🟡 Yellow (10-29): Marginal - need more data</p>
                            <p>🟢 Green (30+): Adequate for patterns</p>
                            <p className="mt-2">Statistical significance requires n≥30 applications per category plus multiple offers to measure conversion reliability.</p>
                          </div>
                        </InfoTooltip>
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Explore patterns in your job search data - not recommendations</p>
                    </div>

                    {(() => {
                      // Categorize roles using keyword matching
                      const categorizeRole = (position) => {
                        if (!position) return 'Other';
                        const p = position.toLowerCase();
                        if (p.includes('qa') || p.includes('test') || p.includes('sdet') || p.includes('quality') || p.includes('automation') || p.includes('set')) 
                          return 'QA/Test/SDET';
                        if (p.includes('frontend') || p.includes('front-end') || p.includes('front end') || p.includes('ui') || p.includes('react') || p.includes('angular') || p.includes('vue'))
                          return 'Frontend';
                        if (p.includes('backend') || p.includes('back-end') || p.includes('back end') || p.includes('api') || p.includes('server'))
                          return 'Backend';
                        if (p.includes('software') || p.includes('developer') || p.includes('engineer') || p.includes('swe'))
                          return 'Software Engineer (General)';
                        return 'Other';
                      };

                      // Group emails by category
                      const categoryData = {};
                      
                      allRelevantEmails.forEach(email => {
                        const category = categorizeRole(email.position);
                        if (!categoryData[category]) {
                          categoryData[category] = {
                            applications: new Set(),
                            interviews: new Set(),
                            offers: new Set(),
                            rejected: new Set()
                          };
                        }
                        
                        const threadId = email.thread_id;
                        const emailCategory = (email.category || '').toLowerCase();
                        
                        // Track by thread ID to count unique applications
                        if (emailCategory.includes('appl')) categoryData[category].applications.add(threadId);
                        if (emailCategory.includes('interview')) categoryData[category].interviews.add(threadId);
                        if (emailCategory.includes('offer')) categoryData[category].offers.add(threadId);
                        if (emailCategory.includes('reject')) categoryData[category].rejected.add(threadId);
                      });

                      // Calculate metrics and determine confidence
                      const patterns = Object.entries(categoryData)
                        .map(([category, data]) => {
                          const applications = data.applications.size;
                          const interviews = data.interviews.size;
                          const offers = data.offers.size;
                          
                          // Determine confidence level based on sample size
                          let confidence = 'too_small';
                          let confidenceColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
                          let confidenceText = 'TOO SMALL';
                          let needMoreApps = Math.max(0, 10 - applications);
                          
                          if (applications >= 30) {
                            confidence = 'adequate';
                            confidenceColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
                            confidenceText = 'ADEQUATE';
                            needMoreApps = 0;
                          } else if (applications >= 10) {
                            confidence = 'marginal';
                            confidenceColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
                            confidenceText = 'MARGINAL';
                            needMoreApps = 30 - applications;
                          }
                          
                          const interviewRate = applications > 0 ? ((interviews / applications) * 100).toFixed(1) : '0.0';
                          const offerRate = applications > 0 ? ((offers / applications) * 100).toFixed(1) : '0.0';
                          
                          return {
                            category,
                            applications,
                            interviews,
                            offers,
                            interviewRate: parseFloat(interviewRate),
                            offerRate: parseFloat(offerRate),
                            confidence,
                            confidenceColor,
                            confidenceText,
                            needMoreApps
                          };
                        })
                        .filter(p => p.applications >= 3) // Hide categories with <3 applications
                        .sort((a, b) => b.applications - a.applications); // Sort by application count

                      if (patterns.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                              No pattern data available yet.
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Apply to at least 3 positions in a role category to start seeing patterns.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {patterns.map((pattern) => {
                            // Generate pattern observations
                            let patternObservation = '';
                            let alternativeExplanations = [];
                            
                            if (pattern.interviewRate > 100) {
                              patternObservation = `High interview activity (${pattern.interviewRate}% rate = multiple rounds per application), but ${pattern.offers === 0 ? 'no offers yet' : `only ${pattern.offerRate}% offer rate`}`;
                              alternativeExplanations = [
                                'Getting past initial screening successfully',
                                'May need to improve technical interview performance',
                                'Could be targeting roles slightly above current skill level',
                                'Sample too small to distinguish from random variation'
                              ];
                            } else if (pattern.interviewRate >= 20) {
                              patternObservation = `Good initial screening (${pattern.interviewRate}% interview rate)${pattern.offers === 0 ? ', but no offers yet' : `, ${pattern.offerRate}% offer rate`}`;
                              alternativeExplanations = [
                                'Resume effectively signals fit for these roles',
                                'Application materials align with job requirements',
                                pattern.offers === 0 ? 'May need more applications to see offer patterns' : 'Converting interviews to offers',
                                'Could be in competitive applicant pools'
                              ];
                            } else if (pattern.interviewRate < 10) {
                              patternObservation = `Low interview rate (${pattern.interviewRate}%)${pattern.offers > 0 ? `, but ${pattern.offers} offer(s) received` : ''}`;
                              alternativeExplanations = [
                                'Resume may not highlight relevant skills for these roles',
                                'Could be applying to highly competitive positions',
                                'Application materials might need optimization',
                                'Sample too small to determine if pattern is real'
                              ];
                            } else {
                              patternObservation = `Moderate activity: ${pattern.interviewRate}% interview rate, ${pattern.offerRate}% offer rate`;
                              alternativeExplanations = [
                                'Standard response rate for this role type',
                                'Need more data to identify clear patterns',
                                'Results consistent with competitive job market',
                                'May see clearer trends with more applications'
                              ];
                            }
                            
                            return (
                              <div key={pattern.category} className="p-4 border border-gray-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h5 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                                      🔍 {pattern.category}
                                    </h5>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                      {pattern.applications} applications → {pattern.interviews} interview emails → {pattern.offers} offers
                                    </div>
                                  </div>
                                  <span className={cn("px-2 py-1 rounded text-[10px] font-bold", pattern.confidenceColor)}>
                                    {pattern.confidenceText}
                                  </span>
                                </div>
                                
                                <div className="space-y-2 text-xs">
                                  <div className="p-2 bg-gray-50 dark:bg-zinc-700/50 rounded">
                                    <p className="font-medium text-gray-900 dark:text-white mb-1">Pattern observed:</p>
                                    <p className="text-gray-700 dark:text-gray-300">{patternObservation}</p>
                                  </div>
                                  
                                  {pattern.confidence !== 'adequate' && (
                                    <div className={cn(
                                      "p-2 rounded text-xs",
                                      pattern.confidence === 'too_small' 
                                        ? "bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-300" 
                                        : "bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-300"
                                    )}>
                                      ⚠️ <span className="font-medium">Sample size: {pattern.confidenceText}</span>
                                      {pattern.needMoreApps > 0 && (
                                        <> - need {pattern.needMoreApps} more applications to reach {pattern.confidence === 'too_small' ? 'marginal' : 'adequate'} confidence</>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white mb-1">💡 Possible explanations:</p>
                                    <ul className="list-disc list-inside space-y-0.5 text-gray-700 dark:text-gray-300 ml-2">
                                      {alternativeExplanations.map((exp, idx) => (
                                        <li key={idx}>{exp}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  
                                  {pattern.confidence !== 'adequate' && (
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded">
                                      <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">🧪 Experiment:</p>
                                      <p className="text-blue-800 dark:text-blue-400">
                                        Apply to {Math.max(10, pattern.needMoreApps)} more similar roles. 
                                        Track: Does interview rate stay consistent? What interview questions appear most? 
                                        {pattern.interviews > 0 && ' Do you convert more interviews to offers?'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          
                          <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <span className="text-base mt-0.5">🎓</span>
                              <div className="text-xs">
                                <p className="font-medium text-purple-900 dark:text-purple-300 mb-1">What makes a pattern reliable?</p>
                                <p className="text-purple-800 dark:text-purple-400 leading-relaxed">
                                  Statistical significance typically requires <span className="font-medium">n≥30 applications per category</span> plus 
                                  <span className="font-medium"> multiple offers</span> to measure conversion rates reliably. 
                                  With smaller samples, patterns might be random noise rather than true signals. 
                                  You're in the <span className="font-medium">early exploration phase</span> - use this data to form hypotheses, not conclusions.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) */}

              {/* TODO V2: Timing Tab - Optimal Application & Follow-up Timing Analysis
                  Features planned:
                  - Best times to submit applications (day of week, time of day)
                  - Optimal follow-up timing based on response patterns
                  - Company response speed analysis
                  - Time-to-hire insights
                  
                  Postponed until V1 launched and user demand validated.
              */}
              {/* analyticsTab === 'timing' && (
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
              ) */}
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
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Suggested Follow-ups</h3>
                  <InfoTooltip>
                    <div className="space-y-2">
                      <p className="font-semibold">Understanding the metrics:</p>
                      <p><span className="font-medium">Urgency:</span> How soon you should act (High = immediate, Low = when convenient)</p>
                      <p><span className="font-medium">Impact:</span> Expected effect on your job search success</p>
                      <p><span className="font-medium">Estimated time:</span> How long the action will take</p>
                      <p><span className="font-medium">Days ago:</span> Time since last interaction with this company</p>
                    </div>
                  </InfoTooltip>
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-400">AI-powered actionable steps to advance your job search</p>
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
            {/* Free users: Single Active Applications card (not carousel) */}
            <div className="mb-4">
              <div className="p-4 rounded-lg shadow-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm opacity-90 flex items-center">
                    Job Applications
                    <InfoTooltip>
                      Unique job applications (company + position pairs). Each may have multiple email conversations.
                    </InfoTooltip>
                  </div>
                  <FileText className="h-5 w-5 opacity-75" />
                </div>
                <div className="text-3xl font-bold mb-2">
                  {totalApplications}
                </div>
                {applicationStats?.emails?.total > 0 && (
                  <div className="text-xs opacity-75 mb-2">
                    From {applicationStats.emails.total} conversations
                  </div>
                )}
              </div>
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

            {/* Premium Analytics CTA */}
            <div className="mt-4 card p-5 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Self-Learning AI That Gets Smarter
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    The only job tracker with AI that learns from your corrections:
                  </p>
                  <ul className="space-y-1.5 mb-4 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 dark:text-purple-400">⚡</span>
                      <span><strong>Autonomous Progression</strong> — AI detects interviews & offers automatically</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 dark:text-purple-400">🧠</span>
                      <span><strong>Self-Learning Model</strong> — Corrections improve accuracy for everyone</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 dark:text-purple-400">📊</span>
                      <span><strong>Smart Follow-up Timing</strong> — Research-backed reminders (65% better response rates)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 dark:text-purple-400">📈</span>
                      <span><strong>Advanced Analytics</strong> — Conversion funnels, trends & insights</span>
                    </li>
                  </ul>
                  <button
                    disabled
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                  >
                    Premium web dashboard coming soon
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

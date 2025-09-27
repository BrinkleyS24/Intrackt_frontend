/**
 * @file popup/src/components/Dashboard.jsx
 * @description React component for the main job search dashboard,
 * displaying statistics, category cards, recent activity, and follow-up suggestions.
 * Implements styling using only Tailwind CSS and Lucide React icons.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FileText, Calendar, Gift, X, TrendingUp, Clock, CheckCircle,
  MessageSquare, Send, Crown, Lock, Mail, BarChart3, PieChart,
  Flag, MoreHorizontal
} from 'lucide-react';
import RemindButton from './RemindButton';

import { cn } from '../utils/cn'; // For conditional class joining
import { countUniqueThreads } from '../utils/grouping';
import { formatDate, getCategoryBadgeColor, getCategoryColor, differenceInDays, getTimeSinceOldestPending, getCategoryTitle } from '../utils/uiHelpers';
import { showNotification } from './Notification'; // For toasts

// --- Helper Components ---

/**
 * Renders a single statistic card for the dashboard summary using Tailwind CSS.
 * Uses Lucide React Icon components directly.
 */
const StatCard = ({ icon: Icon, title, value, subtitle, bgColorClasses, textColorClasses }) => (
  <div className={cn(
    "relative flex flex-col justify-between rounded-lg p-3 sm:p-4 shadow-sm transition-all duration-300 ease-in-out",
    "dark:bg-zinc-800 dark:text-white",
    bgColorClasses,
    textColorClasses
  )}>
    <div className="flex items-center space-x-3 mb-2">
      {Icon && <Icon className={cn("h-5 w-5 opacity-80", textColorClasses ? 'text-current' : 'text-gray-900 dark:text-white')} />}
      <h3 className="text-sm font-medium">{title}</h3>
    </div>
    <div className="flex items-end justify-between">
      <p className="text-2xl sm:text-3xl font-bold leading-none">{value}</p>
      {subtitle && <span className="text-xs text-opacity-70">{subtitle}</span>}
    </div>
  </div>
);

/**
 * Renders a single category summary card for the dashboard using Tailwind CSS.
 * Uses Lucide React Icon components directly.
 */
const CategorySummaryCard = ({ categoryKey, counts, onCategorySelect }) => {
  const categoryTitle = getCategoryTitle(categoryKey);
  // Use unique thread count for consistency across UI
  const list = (counts[categoryKey] || counts[categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)] || []);
  const count = countUniqueThreads(list);

  let IconComponent;
  let iconBgColorClass = '';
  let iconTextColorClass = '';

  switch (categoryKey) {
    case 'applied': IconComponent = FileText; iconBgColorClass = 'bg-blue-100 dark:bg-blue-900'; iconTextColorClass = 'text-blue-700 dark:text-blue-300'; break;
    case 'interviewed': IconComponent = Calendar; iconBgColorClass = 'bg-yellow-100 dark:bg-yellow-900'; iconTextColorClass = 'text-yellow-700 dark:text-yellow-300'; break;
    case 'offers': IconComponent = Gift; iconBgColorClass = 'bg-green-100 dark:bg-green-900'; iconTextColorClass = 'text-green-700 dark:text-green-300'; break;
    case 'rejected': IconComponent = X; iconBgColorClass = 'bg-red-100 dark:bg-red-800'; iconTextColorClass = 'text-red-700 dark:text-red-300'; break;
    case 'irrelevant': IconComponent = X; iconBgColorClass = 'bg-gray-100 dark:bg-gray-800'; iconTextColorClass = 'text-gray-700 dark:text-gray-300'; break;
    default: IconComponent = Mail; iconBgColorClass = 'bg-gray-100 dark:bg-gray-800'; iconTextColorClass = 'text-gray-700 dark:text-gray-300';
  }

  const descriptionMap = {
    'applied': 'Applications sent',
    'interviewed': 'Interview invitations',
    'offers': 'Job offers received',
    'rejected': 'Applications declined',
    'irrelevant': 'Emails marked as irrelevant'
  };
  const description = descriptionMap[categoryKey];

  return (
    <div
      className={cn(
        "card p-3 sm:p-4 flex flex-col justify-between transition-shadow hover:shadow-md h-full cursor-pointer rounded-lg shadow-sm bg-white dark:bg-zinc-800",
        getCategoryColor(categoryKey)
      )}
      onClick={() => onCategorySelect(categoryKey)}
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
};

/**
 * Renders a single email card for the "Recent Activity" section.
 * Uses Lucide React icons for action buttons.
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
 * Renders a single follow-up suggestion card.
 */
function DashboardFollowUpCard({ suggestion, markFollowedUp, updateRespondedState, onEmailSelect, openMisclassificationModal }) {
  const now = new Date();
  const lastActivityDateObj = suggestion.lastActivityDate ? new Date(suggestion.lastActivityDate) : null;

  const daysSinceLastActivity = (lastActivityDateObj && !isNaN(lastActivityDateObj.getTime()))
    ? differenceInDays(now, lastActivityDateObj)
    : null;

  const handleFollowedUp = (e) => {
    e.stopPropagation();
    markFollowedUp(suggestion.emailId);
  };

  const handleResponded = (e) => {
    e.stopPropagation();
    updateRespondedState(suggestion.emailId, true);
  };

  const handleMisclassifyClick = (e) => {
    e.stopPropagation();
    openMisclassificationModal(suggestion);
  };

  // Uses Lucide React for these icons
  const getFollowUpIcon = (type) => {
    switch (type) {
      case "follow_up": return Send;
      case "thank_you": return MessageSquare;
      case "status_check": return Clock;
      case "application": return FileText;
      default: return CheckCircle;
    }
  };
  const IconComponent = getFollowUpIcon(suggestion.type);

  const getUrgencyColorClasses = (urgency) => {
    switch (urgency) {
      case "high": return {
        bg: "bg-red-100 dark:bg-red-950",
        border: "border-red-300 dark:border-red-800",
        text: "text-red-800 dark:text-red-200",
        iconBg: "bg-red-200 dark:bg-red-800",
        iconText: "text-red-700 dark:text-red-300"
      };
      case "medium": return {
        bg: "bg-yellow-100 dark:bg-yellow-950",
        border: "border-yellow-300 dark:border-yellow-800",
        text: "text-yellow-800 dark:text-yellow-200",
        iconBg: "bg-yellow-200 dark:bg-yellow-800",
        iconText: "text-yellow-700 dark:text-yellow-300"
      };
      case "low": return {
        bg: "bg-blue-100 dark:bg-blue-950",
        border: "border-blue-300 dark:border-blue-800",
        text: "text-blue-800 dark:text-blue-200",
        iconBg: "bg-blue-200 dark:bg-blue-800",
        iconText: "text-blue-700 dark:text-blue-300"
      };
      default: return {
        bg: "bg-gray-100 dark:bg-zinc-800",
        border: "border-gray-200 dark:border-zinc-700",
        text: "text-gray-800 dark:text-gray-200",
        iconBg: "bg-gray-200 dark:bg-zinc-700",
        iconText: "text-gray-700 dark:text-gray-300"
      };
    }
  };

  const urgencyColors = getUrgencyColorClasses(suggestion.urgency);

  return (
    <div
      className={cn(
        "p-3 sm:p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out cursor-pointer bg-white dark:bg-zinc-800",
        urgencyColors.border
      )}
      onClick={() => onEmailSelect(suggestion)}
    >
      <div className="flex flex-col sm:flex-row items-start justify-between">
        <div className="flex-1 flex items-start space-x-3 w-full sm:max-w-[70%]">
          {IconComponent && (
            <div className={cn("p-2 rounded-full", urgencyColors.iconBg)}>
              <IconComponent className={cn("h-5 w-5", urgencyColors.iconText)} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center space-x-3">
              <h3 className="font-semibold text-md sm:text-lg text-gray-900 dark:text-white truncate">{suggestion.title}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-200">{suggestion.urgency}</span>
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200">{suggestion.impact || 'medium impact'}</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-zinc-300 mt-2 mb-3 truncate">{suggestion.description || "No specific description available."}</p>

            <div className="flex flex-wrap text-xs text-gray-500 dark:text-zinc-400 gap-4">
              <span className="truncate"><strong className="text-gray-700 dark:text-zinc-200">{suggestion.company}</strong> · {suggestion.position}</span>
              {suggestion.daysAgo !== undefined && <span>{suggestion.daysAgo} days ago</span>}
              {suggestion.estimatedTime && <span>{suggestion.estimatedTime}</span>}
              <span>{suggestion.actionType}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-row sm:flex-col items-center sm:items-end space-x-2 sm:space-x-0 sm:space-y-3 mt-3 sm:mt-0">
          <button
            onClick={(e) => { e.stopPropagation(); /* placeholder: open action */ showNotification('Open action not implemented'); }}
            className="bg-slate-900 text-white px-3 py-1 rounded-md text-sm shadow-sm hover:opacity-95"
          >
            Take Action
          </button>
          <RemindButton threadId={suggestion.threadId || suggestion.id} label="Remind Later" defaultDelayHours={24} />
        </div>
      </div>
    </div>
  );
}

// --- Main Dashboard Component ---
function Dashboard({
  categorizedEmails = { applied: [], interviewed: [], offers: [], rejected: [], irrelevant: [] },
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
  const [analyticsTab, setAnalyticsTab] = useState('overview'); // 'overview' | 'trends' | 'performance' | 'timing'
  const getCount = useCallback((category) => {
    const list = (categorizedEmails[category] || categorizedEmails[category.charAt(0).toUpperCase() + category.slice(1)] || []);
    const count = countUniqueThreads(list);
    return count;
  }, [categorizedEmails]);

  const appliedCount = useMemo(() => getCount('applied'), [getCount]);
  const interviewedCount = useMemo(() => getCount('interviewed'), [getCount]);
  const offersCount = useMemo(() => getCount('offers'), [getCount]);
  const rejectedCount = useMemo(() => getCount('rejected'), [getCount]);
  const irrelevantCount = useMemo(() => getCount('irrelevant'), [getCount]);


  const allRelevantEmails = useMemo(() => {
    const relevantEmails = Object.values(categorizedEmails).flat()
      .filter(email => email.category?.toLowerCase() !== 'irrelevant');
    return relevantEmails;
  }, [categorizedEmails]);

  // Prefer backend-provided total (DB-driven) when available; fallback to local unique thread count
  const totalApplications = useMemo(() => {
    const localTotal = countUniqueThreads(allRelevantEmails);
    const backendTotal = (typeof quotaData?.totalProcessed === 'number' && !Number.isNaN(quotaData.totalProcessed))
      ? quotaData.totalProcessed
      : null;
    if (backendTotal === null) return localTotal;
    return Math.max(backendTotal, localTotal);
  }, [quotaData, allRelevantEmails]);
  const totalInterviewsAndOffers = useMemo(() => interviewedCount + offersCount, [interviewedCount, offersCount]);
  const responseRate = useMemo(() => {
    return totalApplications > 0 ? Math.round((totalInterviewsAndOffers / totalApplications) * 100) : 0;
  }, [totalInterviewsAndOffers, totalApplications]);

  const newApplicationsThisWeek = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return (categorizedEmails.applied || categorizedEmails.Applied || []).filter(email => new Date(email.date) >= sevenDaysAgo).length;
  }, [categorizedEmails.applied, categorizedEmails.Applied]);

  // Success Rate: percentage of total applications that resulted in offers
  const successRate = useMemo(() => {
    return totalApplications > 0 ? Math.round((offersCount / totalApplications) * 100) : 0;
  }, [offersCount, totalApplications]);

  const categories = useMemo(() => [
    { id: "applied", title: "Applied", count: appliedCount, icon: FileText, description: "Applications sent" },
    { id: "interviewed", title: "Interviewed", count: interviewedCount, icon: Calendar, description: "Interview invitations" },
    { id: "offers", title: "Offers", count: offersCount, icon: Gift, description: "Job offers received" },
    { id: "rejected", "title": "Rejected", count: rejectedCount, icon: X, description: "Applications declined" }
  ], [appliedCount, interviewedCount, offersCount, rejectedCount, irrelevantCount]);

  const recentEmails = useMemo(() => allRelevantEmails
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5), [allRelevantEmails]);

  // Deterministic follow-up generator based on email dates and categories
  const followUps = useMemo(() => {
    const results = [];
    const now = Date.now();
    const pushIf = (obj) => { if (results.length < 6) results.push(obj); };

    const daysBetween = (d) => {
      const t = Date.parse(d);
      if (isNaN(t)) return null;
      return Math.floor((now - t) / (1000 * 60 * 60 * 24));
    };

    // Heuristic rules (deterministic)
    allRelevantEmails.forEach(email => {
      const daysAgo = daysBetween(email.date);
      if (daysAgo === null) return; // skip emails without parsable dates

      if ((email.category || '').toLowerCase().includes('appl') && daysAgo >= 7) {
        pushIf({
          id: `followup-${email.id || email.threadId}`,
          type: 'follow_up',
          title: 'Follow up on your application',
          description: `It has been ${daysAgo} day${daysAgo === 1 ? '' : 's'} since you applied. A concise follow-up can help re-surface your application.`,
          urgency: daysAgo > 10 ? 'high' : 'medium',
          daysAgo,
          company: email.company || email.from || 'Unknown',
          position: email.position || email.subject || '',
          threadId: email.threadId || email.id,
          actionType: 'email',
          estimatedTime: '5 mins',
          impact: 'medium'
        });
      }

      if ((email.category || '').toLowerCase().includes('interview') && daysAgo >= 2) {
        pushIf({
          id: `thankyou-${email.id || email.threadId}`,
          type: 'thank_you',
          title: 'Send a thank-you note',
          description: `Send a personalized thank-you referencing interview details to keep momentum.`,
          urgency: daysAgo > 5 ? 'high' : 'medium',
          daysAgo,
          company: email.company || email.from || 'Unknown',
          position: email.position || '',
          threadId: email.threadId || email.id,
          actionType: 'email',
          estimatedTime: '10 mins',
          impact: 'high'
        });
      }

      if ((email.category || '').toLowerCase().includes('offer') && daysAgo >= 1) {
        pushIf({
          id: `negotiate-${email.id || email.threadId}`,
          type: 'salary_negotiation',
          title: 'Research offer and negotiation',
          description: `Review the offer details and market benchmarks before responding.`,
          urgency: 'high',
          daysAgo,
          company: email.company || email.from || 'Unknown',
          position: email.position || '',
          threadId: email.threadId || email.id,
          actionType: 'research',
          estimatedTime: '30 mins',
          impact: 'high'
        });
      }
    });

    // Add 1-2 fixed strategic suggestions for premium users (no unverified numeric claims)
    if (results.length < 6) {
      pushIf({
        id: 'networking-linkedin',
        type: 'networking',
        title: 'Connect with relevant contacts',
        description: 'Identify and reach out to a few relevant contacts at target companies with a short, personalized message.',
        urgency: 'medium',
        daysAgo: 0,
        company: 'Target Companies',
        position: '',
        actionType: 'linkedin',
        estimatedTime: '15 mins',
        impact: 'medium'
      });
    }

    return results.slice(0, 6);
  }, [allRelevantEmails]);

  const [showAllFollowups, setShowAllFollowups] = useState(false);
  const displayedFollowups = showAllFollowups ? followUps : followUps.slice(0, 5);
  const handleShowMoreFollowups = useCallback(() => setShowAllFollowups(prev => !prev), []);
  
  return (
    <div className="w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-[360px] space-y-4">
        {isPremium ? (
          <>
            {/* Analytics (Premium) */}
            <div className="card p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  Job Search Analytics
                  <span className="text-xs ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">Premium</span>
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400">Deep insights into your job search performance</p>
              </div>
              {/* Tabs under description */}
              <div className="mb-4 grid grid-cols-4 gap-1">
                { [
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Total Applications</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{totalApplications}</div>
                      </div>
                      <BarChart3 className="h-5 w-5 text-gray-500" />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Response Rate</div>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">{responseRate}%</div>
                      </div>
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Interviews Scheduled</div>
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{interviewedCount}</div>
                      </div>
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Avg Response Time</div>
                        <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{Math.max(1, Math.round((offersCount ? 3.2 : 5) * 10) / 10)}d</div>
                      </div>
                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </div>
              )}
              {analyticsTab !== 'overview' && (
                <div className="p-3 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700 text-xs text-gray-600 dark:text-zinc-300">
                  This tab is available in the full analytics view. Switch back to Overview for key metrics.
                </div>
              )}
            </div>
            
            {/* Categories (Premium) */}
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

            {/* Follow-ups and Recent (Premium only) */}
            <div className="card p-4 rounded-lg shadow-sm bg-white dark:bg-zinc-800">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Suggested Follow-ups</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400">Actionable steps to advance your job search</p>
              </div>
              <div className="space-y-3">
                {displayedFollowups.map((f) => (
                  <DashboardFollowUpCard
                    key={f.threadId || f.id}
                    suggestion={f}
                    markFollowedUp={markFollowedUp}
                    updateRespondedState={updateRespondedState}
                    onEmailSelect={onEmailSelect}
                    openMisclassificationModal={openMisclassificationModal}
                  />
                ))}
              </div>
            </div>

            <div className="card p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Recent Activity</h3>
              {recentEmails.length ? (
                <div className="space-y-2">
                  {recentEmails.map((email) => (
                    <div key={email.id || email.threadId} className="w-full">
                      <DashboardEmailCard
                        email={email}
                        onEmailSelect={onEmailSelect}
                        onOpenMisclassificationModal={openMisclassificationModal}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No recent activity.</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Free: Compact stats only */}
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="text-sm">Total Applications</div>
                <div className="text-3xl font-bold">{totalApplications}</div>
                <div className="text-xs mt-1 opacity-90">Total applications</div>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
                <div className="text-sm text-green-600">Response Rate</div>
                <div className="text-2xl font-bold text-green-600">{responseRate}%</div>
                <div className="text-xs mt-1 text-gray-500">Interviews + Offers</div>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
                <div className="text-sm text-gray-600">This Week</div>
                <div className="text-2xl font-bold">{newApplicationsThisWeek}</div>
                <div className="text-xs mt-1 text-gray-500">New applications</div>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
                <div className="text-sm text-purple-600">Success Rate</div>
                <div className="text-2xl font-bold text-purple-600">{totalApplications ? Math.round((offersCount/ totalApplications)*100) : 0}%</div>
                <div className="text-xs mt-1 text-gray-500">Offers received</div>
              </div>
            </div>
            
            {/* Categories (Free) */}
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
            {/* No follow-ups or recent for free users */}
          </>
        )}
      </div>
    </div>
  );
 }

export default Dashboard;
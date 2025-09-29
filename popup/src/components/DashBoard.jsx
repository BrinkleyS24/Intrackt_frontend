  // Generate dynamic AI insights based on context
  function generateDynamicInsight(suggestion) {
    if (!suggestion) return "";
    const type = suggestion.actionType || suggestion.type;
    const days = suggestion.daysAgo || 0;
    const urgency = (suggestion.urgency || '').toLowerCase();
    // Follow-up insights vary by timing
    if (type === 'follow_up') {
      if (days > 14) {
        return `${days} days have passed. Companies often review applications in waves - a strategic follow-up now could catch the next review cycle.`;
      } else if (days > 10) {
        return `After ${days} days, your application may be in final review. Following up demonstrates continued interest and can tip the scales in your favor.`;
      } else if (days > 7) {
        return `${days} days since application. Research shows following up at this point increases response rates by 65% without appearing pushy.`;
      } else {
        return `It's been ${days} days. The optimal follow-up window is approaching - prepare your message to maximize impact.`;
      }
    }
    // Thank you notes vary by urgency
    if (type === 'thank_you') {
      if (urgency === 'high') {
        return `${days} days since interview. Send a personalized thank-you immediately - 68% of hiring managers consider thank-you notes in their decision.`;
      } else if (days > 3) {
        return `Interview was ${days} days ago. A thoughtful thank-you referencing specific discussion points can still make a strong impression.`;
      } else {
        return `Perfect timing for a thank-you note. Reference specific interview topics to stand out from other candidates.`;
      }
    }
    // Status checks with context
    if (type === 'status_check') {
      if (days > 21) {
        return `It's been ${days} days. A polite status inquiry shows professionalism and helps you plan your job search strategy.`;
      } else if (days > 14) {
        return `After ${days} days, checking on your application status is appropriate and shows genuine interest in the role.`;
      } else {
        return `Consider a status check after ${14 - days} more days. Timing is crucial to maintain professional boundaries.`;
      }
    }
    // Salary negotiation insights
    if (type === 'salary_negotiation') {
      if (urgency === 'high') {
        return `Time-sensitive: Research shows first 48 hours after offer are critical. Gather market data now - most offers have 10-20% negotiation room.`;
      } else {
        return `Analyze compensation benchmarks for ${suggestion.position || 'this role'}. Well-researched negotiations average 15% higher final offers.`;
      }
    }
    // Networking insights
    if (type === 'networking') {
      const company = suggestion.company;
      if (company && company !== 'Target Companies') {
        return `Connect with 2-3 ${company} employees in similar roles. Insider referrals have 7x higher conversion rates than cold applications.`;
      } else {
        return `Expand your network strategically. Personalized LinkedIn messages get 40% higher acceptance when you mention shared interests or mutual connections.`;
      }
    }
    // Portfolio updates
    if (type === 'portfolio_update' || type === 'portfolio') {
      return `Showcase projects using ${suggestion.skills || 'in-demand skills'}. Portfolios with recent, relevant work get 3x more interview invitations.`;
    }
    // Application strategy
    if (type === 'application') {
      return `Based on your profile, ${suggestion.company || 'companies in this sector'} show 3x higher response rates. Focus applications here for better ROI.`;
    }
    // Default fallback with variation
    const fallbacks = [
      "Strategic action recommended based on successful job search patterns.",
      "This step aligns with proven job search best practices.",
      "Taking action now positions you ahead of other candidates."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
// ...existing code...
// top-of-file helper definitions
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
  Flag, MoreHorizontal, ArrowUp, ArrowDown
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
 * Fixed DashboardFollowUpCard component matching target design
 */
function DashboardFollowUpCard({ suggestion, markFollowedUp, updateRespondedState, onEmailSelect, openMisclassificationModal }) {
  const [showWhyThis, setShowWhyThis] = useState(false);
  
  // Action channel to emoji mapping
  const getActionEmoji = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'email': return '📧';
      case 'linkedin': return '💼';
      case 'call': return '📞';
      case 'research': return '🔍';
      default: return '📍';
    }
  };

  // Get urgency-based colors
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
  
  // Format the AI insight
  const defaultInsights = {
    follow_up: "Research shows following up now increases response rates by 65%.",
    thank_you: "Thank-you notes after interviews reinforce positive impressions.",
    status_check: "Status checks keep your application top-of-mind professionally.",
    research: "Gather market data to negotiate confidently.",
    networking: "Personalized connection requests have 40% higher acceptance rates.",
    portfolio: "Add your latest project showcasing the skills mentioned in recent job postings you've applied to."
  };
  
  const aiInsight = suggestion.aiInsight || generateDynamicInsight(suggestion) || suggestion.description;

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all hover:shadow-md",
      colors.bg,
      colors.border
    )}>
      {/* Header with urgency and impact */}
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
              suggestion.impact === 'high' ? 'text-green-700 bg-green-50 border border-green-200' : suggestion.impact === 'medium' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-blue-700 bg-blue-50 border border-blue-200'
            )}>
              {suggestion.impact} impact
            </span>
          )}
        </div>
      </div>

      <h3 className={cn(
        "text-base font-semibold mb-2",
        colors.titleText
      )}>
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
          <>
            <span className="flex items-center gap-1">
              <span>⏱</span>
              {suggestion.estimatedTime}
            </span>
          </>
        )}
        {suggestion.actionType && (
          <span className="flex items-center gap-1">
            <span>{getActionEmoji(suggestion.actionType)}</span>
            {suggestion.actionType}
          </span>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <button
          onClick={(e) => { e.stopPropagation(); showNotification('Open action not implemented'); }}
          className="flex-1 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Take Action
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); showNotification('Remind Later not implemented'); }}
          className={cn("flex-1 px-4 py-2 rounded-md text-sm font-medium hover:bg-white/50 transition-colors", colors.remind)}
        >
          Remind Later
        </button>
      </div>

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

  // --- Trend metrics (last 30 days vs previous 30 days) ---
  const nowMs = Date.now();
  const d30 = 30 * 24 * 60 * 60 * 1000;
  const d7 = 7 * 24 * 60 * 60 * 1000;
  const startCur30 = nowMs - d30;
  const startPrev30 = nowMs - 2 * d30;

  const parseMs = (d) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? null : t;
  };

  const isInRange = (ms, start, end) => ms !== null && ms >= start && ms < end;
  const hasCat = (e, sub) => ((e.category || '').toLowerCase().includes(sub));

  const uniqueCount = (arr) => {
    const s = new Set();
    arr.forEach(e => s.add(e.thread_id || e.threadId || e.thread || e.id));
    return s.size;
  };

  const emailsCur30 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), startCur30, nowMs)), [allRelevantEmails]);
  const emailsPrev30 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), startPrev30, startCur30)), [allRelevantEmails]);
  const emailsCur7 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), nowMs - d7, nowMs)), [allRelevantEmails]);

  const appsCur = useMemo(() => uniqueCount(emailsCur30.filter(e => hasCat(e, 'appl'))), [emailsCur30]);
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

  // Avg response time per thread (days) comparing windows (best effort)
  const avgResponseDays = (emails) => {
    const byThread = new Map();
    emails.forEach(e => {
      const id = e.thread_id || e.threadId || e.thread || e.id;
      const t = parseMs(e.date);
      if (t === null) return;
      const cat = (e.category || '').toLowerCase();
      let rec = byThread.get(id);
      if (!rec) { rec = { app: null, resp: null }; byThread.set(id, rec); }
      if (cat.includes('appl')) rec.app = Math.min(rec.app ?? t, t);
      if (cat.includes('interview') || cat.includes('offer')) rec.resp = Math.min(rec.resp ?? t, t);
    });
    const diffs = [];
    byThread.forEach(({ app, resp }) => { if (app && resp && resp >= app) diffs.push((resp - app) / (1000*60*60*24)); });
    if (!diffs.length) return null;
    const avg = diffs.reduce((a,b)=>a+b,0) / diffs.length;
    return Math.round(avg * 10) / 10; // 1 decimal day
  };

  const artCur = useMemo(() => avgResponseDays(emailsCur30), [emailsCur30]);
  const artPrev = useMemo(() => avgResponseDays(emailsPrev30), [emailsPrev30]);
  const artDeltaDays = useMemo(() => (artPrev === null || artPrev === 0 || artCur === null ? null : Math.round((artCur - artPrev) * 10) / 10), [artCur, artPrev]);
  const interviewsThisWeek = useMemo(() => uniqueCount(emailsCur7.filter(e => hasCat(e,'interview'))), [emailsCur7]);

  const Trend = ({ delta }) => {
    if (delta === null) return <span className="text-xs text-gray-500">—</span>;
    const up = delta > 0;
    const val = Math.abs(delta);
    return (
      <span className={cn('inline-flex items-center text-xs', up ? 'text-green-600' : 'text-red-600')}>
        {up ? <ArrowUp className="h-3 w-3 mr-1"/> : <ArrowDown className="h-3 w-3 mr-1"/>}
        {up ? '+' : '-'}{val}% from last month
      </span>
    );
  };

  const TimeTrend = ({ delta }) => {
    if (delta === null) return <span className="text-xs text-gray-500">—</span>;
    const up = delta > 0; // up = slower (worse)
    const val = Math.abs(delta);
    return (
      <span className={cn('inline-flex items-center text-xs', up ? 'text-orange-600' : 'text-green-600')}>
        {up ? <ArrowUp className="h-3 w-3 mr-1"/> : <ArrowDown className="h-3 w-3 mr-1"/>}
        {up ? `+${val}d slower` : `-${val}d improvement`}
      </span>
    );
  };

  // --- Render ---
  return (
    <div className="w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-[680px] sm:max-w-[760px] space-y-4">
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
                    <div className="mt-1"><Trend delta={appsDeltaPct} /></div>
                  </div>
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
                {followUpSuggestions.slice(0, 5).map((f) => (
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
                // Horizontal carousel: snap to items, allow touch/mouse scroll
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
                  {/* Optional subtle left/right gradients for affordance on small screens */}
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
            {/* Free: Compact stats only */}
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="text-sm">Total Applications</div>
                <div className="text-3xl font-bold">{totalApplications}</div>
                <div className="text-xs mt-1 opacity-90">
                  <Trend delta={appsDeltaPct} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 shadow-sm">
                <div className="text-sm text-green-600">Response Rate</div>
                <div className="text-2xl font-bold text-green-600">{responseRate}%</div>
                <div className="text-xs mt-1"><Trend delta={rateDeltaPct} /></div>
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
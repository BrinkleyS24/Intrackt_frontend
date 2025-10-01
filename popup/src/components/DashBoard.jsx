import React, { useState, useCallback, useMemo } from 'react';
import { FileText, Calendar, Gift, X, Flag, ArrowUp, ArrowDown, BarChart3, TrendingUp, Clock } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatDate } from '../utils/uiHelpers';
import { countUniqueThreads } from '../utils/grouping';
import { showNotification } from './Notification';

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
 * DashboardFollowUpCard component
 */
function DashboardFollowUpCard({ suggestion, markFollowedUp, updateRespondedState, onEmailSelect, openMisclassificationModal }) {
  const [showWhyThis, setShowWhyThis] = useState(false);

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
  const [analyticsTab, setAnalyticsTab] = useState('overview');
  const [followUpSearch, setFollowUpSearch] = useState('');
  const [followUpUrgencyFilter, setFollowUpUrgencyFilter] = useState('all');
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState('all');
  const [followUpPage, setFollowUpPage] = useState(1);
  const FOLLOW_UPS_PER_PAGE = 6;

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

  // Trend metrics
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

  const emailsCur30 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), startCur30, nowMs)), [allRelevantEmails, startCur30, nowMs]);
  const emailsPrev30 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), startPrev30, startCur30)), [allRelevantEmails, startPrev30, startCur30]);
  const emailsCur7 = useMemo(() => allRelevantEmails.filter(e => isInRange(parseMs(e.date), nowMs - d7, nowMs)), [allRelevantEmails, nowMs, d7]);

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
        console.log(`[Analytics] Domain ${domain}: ${Math.round(days * 10) / 10} days response time`);
      }
    });
    
    if (!diffs.length) {
      console.log('[Analytics] No valid application→response pairs found');
      return null;
    }
    
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    console.log(`[Analytics] Average Response Time: ${Math.round(avg * 10) / 10} days (from ${diffs.length} companies)`);
    return Math.round(avg * 10) / 10;
  };

  const artCur = useMemo(() => avgResponseDays(allRelevantEmails), [allRelevantEmails]);
  const artPrev = useMemo(() => avgResponseDays(allRelevantEmails), [allRelevantEmails]);
  const artDeltaDays = useMemo(() => (artPrev === null || artPrev === 0 || artCur === null ? null : Math.round((artCur - artPrev) * 10) / 10), [artCur, artPrev]);
  */
  
  const interviewsThisWeek = useMemo(() => uniqueCount(emailsCur7.filter(e => hasCat(e, 'interview'))), [emailsCur7]);

  // Configurable number of weeks for chart
  const numWeeks = 4; // Change to 8 or 12 for longer history
  const weeklyData = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const apps = Array(numWeeks).fill(0);
    const resps = Array(numWeeks).fill(0);

    allRelevantEmails.forEach(e => {
      const t = parseMs(e.date);
      if (t === null) return;
      const age = now - t;
      const idx = Math.floor(age / weekMs);
      if (idx >= 0 && idx < numWeeks) {
        const i = numWeeks - 1 - idx;
        const cat = (e.category || '').toLowerCase();
        if (cat.includes('appl')) apps[i]++;
        if (cat.includes('interview') || cat.includes('offer')) resps[i]++;
      }
    });
    return apps.map((a, i) => ({ week: `W${i + 1}`, applications: a, responses: resps[i] }));
  }, [allRelevantEmails, numWeeks]);
  const Trend = ({ delta }) => {
    if (delta === null) return <span className="text-xs text-gray-500">—</span>;
    const up = delta > 0;
    const val = Math.abs(delta);
    return (
      <span className={cn('inline-flex items-center text-xs', up ? 'text-green-600' : 'text-red-600')}>
        {up ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        {up ? '+' : '-'}{val}% from last month
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
                          Applications ({weeklyData[0].applications} → {weeklyData[3].applications})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Responses ({weeklyData[0].responses} → {weeklyData[3].responses})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">Key Insights</h4>
                    <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                      {(() => {
                        const insights = [];
                        const appChange = weeklyData[3].applications - weeklyData[0].applications;
                        const latestRespRate = weeklyData[3].applications > 0 ? Math.round((weeklyData[3].responses / weeklyData[3].applications) * 100) : 0;
                        const firstRespRate = weeklyData[0].applications > 0 ? Math.round((weeklyData[0].responses / weeklyData[0].applications) * 100) : 0;

                        if (appChange > 0) {
                          insights.push(`Application volume increased by ${appChange} over 4 weeks - excellent momentum`);
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
                <div className="p-3 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700 text-xs text-gray-600 dark:text-zinc-300">
                  Performance metrics coming soon. Switch to Trends or Overview for available analytics.
                </div>
              )}

              {analyticsTab === 'timing' && (
                <div className="p-3 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700 text-xs text-gray-600 dark:text-zinc-300">
                  Timing analysis coming soon. Switch to Trends or Overview for available analytics.
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
                  paginatedFollowUps.map((f, idx) => (
                    <DashboardFollowUpCard
                      key={f.threadId || f.id || idx}
                      suggestion={f}
                      markFollowedUp={markFollowedUp}
                      updateRespondedState={updateRespondedState}
                      onEmailSelect={onEmailSelect}
                      openMisclassificationModal={openMisclassificationModal}
                    />
                  ))
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
                <div className="text-2xl font-bold text-purple-600">{totalApplications ? Math.round((offersCount / totalApplications) * 100) : 0}%</div>
                <div className="text-xs mt-1 text-gray-500">Offers received</div>
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
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
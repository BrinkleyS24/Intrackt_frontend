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

import { cn } from '../utils/cn'; // For conditional class joining
import { formatDate, getCategoryBadgeColor, getCategoryColor, differenceInDays, getTimeSinceOldestPending, getCategoryTitle } from '../utils/uiHelpers';
import { showNotification } from './Notification'; // For toasts

// --- Helper Components ---

/**
 * Renders a single statistic card for the dashboard summary using Tailwind CSS.
 * Uses Lucide React Icon components directly.
 */
const StatCard = ({ icon: Icon, title, value, subtitle, bgColorClasses, textColorClasses }) => (
  <div className={cn(
    "relative flex flex-col justify-between rounded-lg p-4 shadow-sm transition-all duration-300 ease-in-out",
    "dark:bg-zinc-800 dark:text-white", 
    bgColorClasses, 
    textColorClasses 
  )}>
    <div className="flex items-center space-x-3 mb-2">
      {Icon && <Icon className={cn("h-5 w-5 opacity-80", textColorClasses ? 'text-current' : 'text-gray-900 dark:text-white')} />}
      <h3 className="text-sm font-medium">{title}</h3>
    </div>
    <div className="flex items-end justify-between">
      <p className="text-3xl font-bold leading-none">{value}</p>
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
  const count = (counts[categoryKey] || counts[categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)] || []).length;

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
        "card p-4 flex flex-col justify-between transition-shadow hover:shadow-md h-full cursor-pointer rounded-lg shadow-sm bg-white dark:bg-zinc-800",
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
  console.log("DEBUG DashboardEmailCard: Rendering for email:", email, "onOpenMisclassificationModal prop:", typeof onOpenMisclassificationModal);

  const handleMisclassifyClick = (e) => {
    e.stopPropagation(); 
    console.log("DEBUG: Misclassification button clicked for email:", email?.email_id);
    if (onOpenMisclassificationModal) {
      onOpenMisclassificationModal(email);
    } else {
      console.error("ERROR: onOpenMisclassificationModal is undefined!");
    }
  };

  return (
    <div
      className="flex-shrink-0 w-72 bg-gray-100 dark:bg-zinc-700 p-4 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors relative"
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
      <p className="text-sm text-gray-600 dark:text-zinc-300 truncate">
        {email.company || "N/A"} &bull; {email.position || "N/A"}
      </p>
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
        `p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out cursor-pointer`,
        urgencyColors.bg,
        urgencyColors.border,
        urgencyColors.text 
      )}
      onClick={() => onEmailSelect(suggestion)} 
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {IconComponent && (
            <div className={cn("p-2 rounded-full", urgencyColors.iconBg)}>
              <IconComponent className={cn("h-5 w-5", urgencyColors.iconText)} />
            </div>
          )}
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{suggestion.title}</h3>
        </div>
        <span className={cn(
          "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize",
          urgencyColors.iconBg.replace('bg-', 'bg-opacity-50 bg-'), 
          urgencyColors.iconText 
        )}>
          {suggestion.urgency}
        </span>
      </div>
      <p className="text-sm mb-3">{suggestion.description || "No specific description available."}</p>
      <div className="text-xs opacity-85 flex justify-between items-center text-gray-600 dark:text-zinc-400 mb-3">
          <span>
              <span className="font-medium">{suggestion.company}</span> &bull; {suggestion.position}
              {suggestion.date && <span> &bull; Sent: {formatDate(suggestion.date)}</span>}
          </span>
          {suggestion.followedUpAt && (
              <span className="text-green-600 dark:text-green-400 ml-2">
                  (Followed up {formatDate(suggestion.followedUpAt)})
              </span>
          )}
          {daysSinceLastActivity !== null && daysSinceLastActivity > 10 && !suggestion.responded && !suggestion.followedUp && (
              <span className="text-red-500 dark:text-red-400 ml-auto font-semibold">
                  Overdue!
              </span>
          )}
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-600"
            checked={suggestion.responded}
            onChange={(e) => updateRespondedState(suggestion.threadId, e.target.checked, suggestion.followedUpAt)}
          />
          <span>Responded</span>
        </label>
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
  openPremiumModal
}) {
  console.log("DEBUG Dashboard.jsx: Received categorizedEmails prop:", categorizedEmails); // ADDED LOG

  const getCount = useCallback((category) => {
    const count = (categorizedEmails[category] || categorizedEmails[category.charAt(0).toUpperCase() + category.slice(1)] || []).length;
    console.log(`Count for ${category}:`, count); 
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

  const totalApplications = useMemo(() => allRelevantEmails.length, [allRelevantEmails]);
  const totalInterviewsAndOffers = useMemo(() => interviewedCount + offersCount, [interviewedCount, offersCount]);
  const responseRate = useMemo(() => totalApplications > 0 ? Math.round((totalInterviewsAndOffers / totalApplications) * 100) : 0, [totalInterviewsAndOffers, totalApplications]);

  const newApplicationsThisWeek = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return (categorizedEmails.applied || categorizedEmails.Applied || []).filter(email => new Date(email.date) >= sevenDaysAgo).length;
  }, [categorizedEmails.applied, categorizedEmails.Applied]);

  const successRate = useMemo(() => totalInterviewsAndOffers > 0 ? Math.round((offersCount / totalInterviewsAndOffers) * 100) : 0, [offersCount, totalInterviewsAndOffers]);
  
  const categories = useMemo(() => [
    { id: "applied", title: "Applied", count: appliedCount, icon: FileText, description: "Applications sent" },
    { id: "interviewed", title: "Interviewed", count: interviewedCount, icon: Calendar, description: "Interview invitations" },
    { id: "offers", title: "Offers", count: offersCount, icon: Gift, description: "Job offers received" },
    { id: "rejected", "title": "Rejected", count: rejectedCount, icon: X, description: "Applications declined" }
  ], [appliedCount, interviewedCount, offersCount, rejectedCount, irrelevantCount]);

  const recentEmails = useMemo(() => allRelevantEmails 
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5), [allRelevantEmails]);

  const [showAllFollowups, setShowAllFollowups] = useState(false);
  const displayedFollowups = showAllFollowups ? followUpSuggestions : followUpSuggestions.slice(0, 5);

  const handleShowMoreFollowups = useCallback(() => {
    setShowAllFollowups(prev => !prev);
  }, []);

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case "high": return "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300";
      case "medium": return "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-900 dark:text-yellow-300";
      case "low": return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300";
      default: return "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-950 dark:border-gray-900 dark:text-gray-300";
    }
  };


  return (
    <div className="min-w-0 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white">
      {/* Dashboard Header with dynamic greeting */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Job Search Dashboard</h2>
          <p className="text-gray-60:0 dark:text-zinc-400">Track your applications and progress</p>
        </div>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={BarChart3}
          title="Total Applications"
          value={totalApplications}
          subtitle="Total applications"
          bgColorClasses="bg-gradient-to-r from-blue-500 to-blue-600 text-white"
          textColorClasses=""
        />
        <StatCard
          icon={TrendingUp}
          title="Response Rate"
          value={`${responseRate}%`}
          subtitle="Interviews + Offers"
          bgColorClasses="bg-white dark:bg-zinc-800"
          textColorClasses="text-green-600 dark:text-green-400"
        />
        <StatCard
          icon={Clock}
          title="This Week"
          value={newApplicationsThisWeek}
          subtitle="New applications"
          bgColorClasses="bg-white dark:bg-zinc-800"
          textColorClasses="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={PieChart}
          title="Success Rate"
          value={`${successRate}%`}
          subtitle="Offers received"
          bgColorClasses="bg-white dark:bg-zinc-800"
          textColorClasses="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {categories.map(category => (
          <CategorySummaryCard
            key={category.id}
            categoryKey={category.id}
            counts={categorizedEmails}
            onCategorySelect={onCategorySelect}
          />
        ))}
      </div>

      {/* Suggested Follow-Ups Section - Premium Feature */}
      <div className="card mb-6 p-6 rounded-lg shadow-sm bg-white dark:bg-zinc-800">
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            Suggested Follow-ups
            {userPlan !== 'premium' && <Crown className="h-5 w-5 ml-2 text-yellow-500" />}
          </h3>
          <p className="text-gray-600 dark:text-zinc-400 text-sm mt-1">
            {userPlan === 'premium'
              ? "Actionable steps to advance your job search"
              : "Get personalized follow-up suggestions with Premium"
            }
          </p>
        </div>
        <div className="card-content">
          {userPlan === 'premium' ? (
            <div className="space-y-4">
              {loadingSuggestions ? (
                <div className="text-center py-8 text-gray-500 dark:text-zinc-400">
                  <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p>Loading follow-up suggestions...</p>
                </div>
              ) : (
                displayedFollowups.length > 0 ? (
                  displayedFollowups.map((followUp) => (
                    <DashboardFollowUpCard
                      key={followUp.threadId}
                      suggestion={followUp}
                      markFollowedUp={markFollowedUp}
                      updateRespondedState={updateRespondedState}
                      onEmailSelect={onEmailSelect}
                      openMisclassificationModal={openMisclassificationModal}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-zinc-400">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No follow-ups needed right now!</p>
                    <p className="text-sm">You're all caught up with your job search.</p>
                  </div>
                )
              )}
              {followUpSuggestions.length > 5 && (
                <button
                  className="btn btn-outline w-full mt-4 py-2 px-4 rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                  onClick={handleShowMoreFollowups}
                >
                  {showAllFollowups ? 'Show Less' : `Show More (${followUpSuggestions.length - 5} hidden)`}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-12 space-y-4 relative">
                <div className="absolute inset-0 bg-gray-100 dark:bg-zinc-800 opacity-90 rounded-lg flex flex-col items-center justify-center p-8 z-10">
                    <Lock className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Premium Feature</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xs mx-auto">
                        Get AI-powered follow-up suggestions based on your application timeline
                    </p>
                    <button
                        onClick={openPremiumModal}
                        className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg rounded-full px-6 py-3 transition-all duration-300 flex items-center justify-center"
                    >
                        <Crown className="h-4 w-4 mr-2" />
                        Upgrade to Premium
                    </button>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
                        Unlock smart follow-up reminders, application analytics, and more
                    </p>
                </div>
                <div className="blur-sm pointer-events-none">
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg border bg-gray-50 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-zinc-300">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Send className="h-4 w-4" />
                                        <h3 className="font-medium">Mock Follow-up 1</h3>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 ml-2">medium</span>
                                    </div>
                                    <p className="text-sm mb-2">This is a mock description for a follow-up.</p>
                                    <div className="text-xs opacity-75">
                                        <span className="font-medium">Company A</span> &bull; Position X &bull; 5 days ago
                                    </div>
                                </div>
                                <button className="py-1 px-3 text-sm rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300">Take Action</button>
                            </div>
                        </div>
                        <div className="p-4 rounded-lg border bg-gray-50 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-zinc-300">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <MessageSquare className="h-4 w-4" />
                                        <h3 className="font-medium">Mock Follow-up 2</h3>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 ml-2">high</span>
                                    </div>
                                    <p className="text-sm mb-2">Another mock description for a thank you note.</p>
                                    <div className="text-xs opacity-75">
                                        <span className="font-medium">Company B</span> &bull; Position Y &bull; 12 days ago
                                    </div>
                                </div>
                                <button className="py-1 px-3 text-sm rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300">Take Action</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <section className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
        {recentEmails.length > 0 ? (
          <div className="overflow-x-auto pb-4 flex space-x-4 px-1">
            {recentEmails.map(email => (
              <DashboardEmailCard
                key={email.id || email.threadId}
                email={email}
                onEmailSelect={onEmailSelect}
                onOpenMisclassificationModal={openMisclassificationModal}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-zinc-400 text-center py-8">No recent activity. Start applying for jobs!</p>
        )}
      </section>
    </div>
  );
}

export default Dashboard;

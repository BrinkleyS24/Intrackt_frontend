import React, { useEffect, useRef, useState } from 'react';
import { Mail, BarChart3, FileText, Calendar, Gift, X, Home, LogOut, RefreshCw, Settings } from "lucide-react";
import { cn } from "../utils/cn";
import { EmailQuotaIndicator } from "./EmailQuotaIndicator";
import { countUniqueThreads } from "../utils/grouping";

/**
 * @typedef {Object} Email
 * @property {string} category
 * @property {boolean} isRead
 * @property {string} id
 */

/**
 * @typedef {'applied' | 'interviewed' | 'offers' | 'rejected'} JobCategory
 */

/**
 * @typedef {Object} SidebarProps
 * @property {JobCategory | "dashboard"} selectedCategory
 * @property {(category: JobCategory | "dashboard") => void} onCategoryChange
 * @property {Object.<JobCategory, Email[]>} categorizedEmails
 * @property {Object.<string, number>} unreadCounts
 * @property {() => void} onLogout
 * @property {() => void} onRefresh
 * @property {boolean} isLoadingEmails
 * @property {string} userPlan
 * @property {object | null} quotaData
 * @property {() => void} onUpgradeClick
 * @property {() => void} onManageSubscription
 */

const Button = ({ children, ...props }) => <button {...props}>{children}</button>;
const Badge = ({ children, ...props }) => <span {...props}>{children}</span>;

export function Sidebar({
  selectedCategory,
  onCategoryChange,
  categorizedEmails,
  unreadCounts,
  onLogout,
  onRefresh,
  isLoadingEmails,
  userPlan,
  quotaData,
  onUpgradeClick,
  onManageSubscription
}) {
  const getEmailCount = (category) => {
    const list = categorizedEmails[category] || [];
    return countUniqueThreads(list);
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, count: null, unread: 0 },
    { id: "applied", label: "Applied", icon: FileText, count: getEmailCount("applied"), unread: unreadCounts?.applied || 0 },
    { id: "interviewed", label: "Interviewed", icon: Calendar, count: getEmailCount("interviewed"), unread: unreadCounts?.interviewed || 0 },
    { id: "offers", label: "Offers", icon: Gift, count: getEmailCount("offers"), unread: unreadCounts?.offers || 0 },
    { id: "rejected", label: "Rejected", icon: X, count: getEmailCount("rejected"), unread: unreadCounts?.rejected || 0 },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-800">
      {/* Header Section - More Compact */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0 sticky top-0 z-10 bg-white dark:bg-zinc-800">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Mail className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">AppMailia AI</h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">Job Application Assistant</p>
            {isLoadingEmails && (
              <div className="flex items-center text-xs text-blue-600 dark:text-blue-400 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-2"></span>
                Syncing…
              </div>
            )}
            {/* Backfill inline status removed */}
          </div>
        </div>
      </div>
      
  {/* Navigation Section - Scrolls if needed */}
  <div className="flex-1 py-2 overflow-y-auto">
        <div className="px-3">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "w-full text-left px-3 py-3 flex items-center rounded-lg transition-all duration-200",
                  "group relative",
                  selectedCategory === item.id
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-zinc-700/50"
                )}
                onClick={() => onCategoryChange(item.id)}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <item.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                  <span className="font-medium truncate">{item.label}</span>
                </div>
                
                <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                  {/* Total count badge */}
                  {item.count !== null && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      selectedCategory === item.id
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-800 dark:bg-zinc-600 dark:text-zinc-100"
                    )}>
                      {item.count}
                    </span>
                  )}
                  
                  {/* Unread notification dot */}
                  {item.unread > 0 && (
                    <div className="relative">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      {item.unread > 9 && (
                        <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          9+
                        </span>
                      )}
                      {item.unread <= 9 && item.unread > 1 && (
                        <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center font-bold px-1">
                          {item.unread}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Footer Section - More Compact */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-700">
        {/* Email Quota - Compact */}
        <div className="p-3 border-b border-gray-100 dark:border-zinc-700/50">
          <EmailQuotaIndicator
            userPlan={userPlan}
            quotaData={quotaData}
            onUpgradeClick={onUpgradeClick}
            onManageSubscription={onManageSubscription}
          />
        </div>
        
        {/* Action Buttons - Compact */}
        <div className="p-3 space-y-1">
          {/* Backfill controls removed */}
          <button
            className="w-full text-left px-3 py-2 flex items-center rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
            onClick={onRefresh}
            disabled={isLoadingEmails}
          >
            <RefreshCw className={cn(
              "h-4 w-4 mr-2 flex-shrink-0", 
              isLoadingEmails && "animate-spin"
            )} />
            <span>
              {isLoadingEmails ? 'Refreshing...' : 'Refresh'}
            </span>
          </button>
          
          <button
            className="w-full text-left px-3 py-2 flex items-center rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-700/50 transition-all duration-200 text-sm"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
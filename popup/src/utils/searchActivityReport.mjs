// Job Search Activity Report — pure data logic.
// Builds per-application rows from the popup's categorizedEmails so the report
// PDF can show applied date, company, position, and latest status. Kept
// dependency-free (no React, no jsPDF) so it runs under `node --test`.

const CATEGORY_STATUS_LABELS = {
  applied: 'Awaiting reply',
  interviewed: 'Interview',
  offers: 'Offer',
  rejected: 'Rejected',
  closed: 'Closed',
};

// Manual applications use the backend's current_status vocabulary.
const MANUAL_STATUS_TO_CATEGORY = {
  applied: 'applied',
  interviewed: 'interviewed',
  offered: 'offers',
  offers: 'offers',
  rejected: 'rejected',
};

const TRACKED_CATEGORIES = ['applied', 'interviewed', 'offers', 'rejected'];

// Email dates arrive as UTC with no zone marker ("2026-10-05 21:30:00"). Read
// them as UTC like popup/src/utils/uiHelpers.js parseEmailDate does (kept as a
// copy so this file stays importable under `node --test`), or an evening email
// lands on the next day in the report (2026-10-14).
function parseEmailDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const naiveIso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) && !hasZone;
  const date = new Date(naiveIso ? `${raw.replace(' ', 'T')}Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

// A manual application's applied date is a calendar day the user picked
// (stored as noon UTC). Rebuild it as that local day so the date-range filter
// never shifts it across midnight.
function parseCalendarDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function groupKeyForEmail(email) {
  const applicationId = email?.applicationId || email?.application_id;
  if (applicationId) return `app:${applicationId}`;
  const threadId = email?.thread_id || email?.threadId;
  if (threadId) return `thread:${threadId}`;
  const company = String(email?.company_name || '').trim().toLowerCase();
  const position = String(email?.position || '').trim().toLowerCase();
  if (company || position) return `pair:${company}|${position}`;
  return `email:${email?.id || Math.random()}`;
}

/**
 * Groups categorized emails and manually added applications into application rows.
 * @param {Record<string, Array<object>>} categorizedEmails — { applied, interviewed, offers, rejected }
 * @param {Array<object>} manualApplications — rows from LIST_MANUAL_APPLICATIONS
 * @returns {Array<{company, position, appliedDate, latestCategory, latestStatusLabel, latestStatusDate, everInterviewed, everOffered, source}>}
 */
export function buildActivityRows(categorizedEmails = {}, manualApplications = []) {
  const groups = new Map();

  for (const category of TRACKED_CATEGORIES) {
    for (const email of categorizedEmails?.[category] || []) {
      const key = groupKeyForEmail(email);
      const date = parseEmailDate(email?.date);
      let group = groups.get(key);
      if (!group) {
        group = {
          company: null,
          position: null,
          earliestDate: null,
          latestDate: null,
          latestCategory: null,
          everInterviewed: false,
          everOffered: false,
          manual: false,
        };
        groups.set(key, group);
      }
      const company = String(email?.company_name || '').trim();
      const position = String(email?.position || '').trim();
      if (company && !group.company) group.company = company;
      if (position && !group.position) group.position = position;
      if (category === 'interviewed') group.everInterviewed = true;
      if (category === 'offers') group.everOffered = true;
      if (date) {
        if (!group.earliestDate || date < group.earliestDate) group.earliestDate = date;
        if (!group.latestDate || date >= group.latestDate) {
          group.latestDate = date;
          group.latestCategory = category;
        }
      } else if (!group.latestCategory) {
        group.latestCategory = category;
      }
    }
  }

  // Applications the user added by hand were missing from the report, so a
  // 9/15-10/14 report said "0 applications" right after adding one dated 10/14
  // (persona report 2026-10-14). A manual entry that emails later linked to
  // shares the email rows' `app:` key and is counted once.
  for (const application of manualApplications || []) {
    if (!application || application.id == null) continue;
    const key = `app:${application.id}`;
    const appliedDay = parseCalendarDay(application.manual_applied_at)
      || parseEmailDate(application.first_email_date);
    const category = application.user_closed_at
      ? 'closed'
      : (MANUAL_STATUS_TO_CATEGORY[application.current_status] || 'applied');
    const existing = groups.get(key);
    if (existing) {
      if (appliedDay && (!existing.earliestDate || appliedDay < existing.earliestDate)) {
        existing.earliestDate = appliedDay;
      }
      if (!existing.latestDate && appliedDay) existing.latestDate = appliedDay;
      continue;
    }
    groups.set(key, {
      company: String(application.normalized_company_name || application.company_name || '').trim() || null,
      position: String(application.position || '').trim() || null,
      earliestDate: appliedDay,
      // Only the applied day is known; no separate status date to print.
      latestDate: null,
      latestCategory: category,
      everInterviewed: category === 'interviewed' || category === 'offers',
      everOffered: category === 'offers',
      manual: true,
    });
  }

  const rows = [];
  for (const group of groups.values()) {
    // A row without a single dated email cannot attest an application date;
    // exclude it rather than invent one (the report is a floor, not a ceiling).
    if (!group.earliestDate) continue;
    rows.push({
      company: group.company || 'Unknown company',
      position: group.position || 'Unknown position',
      appliedDate: group.earliestDate,
      latestCategory: group.latestCategory,
      latestStatusLabel: CATEGORY_STATUS_LABELS[group.latestCategory] || 'Awaiting reply',
      latestStatusDate: group.latestDate,
      everInterviewed: group.everInterviewed || group.everOffered,
      everOffered: group.everOffered,
      source: group.manual ? 'manual' : 'email',
    });
  }
  rows.sort((a, b) => a.appliedDate - b.appliedDate);
  return rows;
}

/** Rows whose applied date falls inside [start, end] (inclusive, day granularity). */
export function filterRowsByRange(rows, start, end) {
  const startMs = startOfDay(start).getTime();
  const endMs = endOfDay(end).getTime();
  return (rows || []).filter((row) => {
    const t = row.appliedDate?.getTime?.();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

export function summarizeRows(rows = []) {
  return {
    applications: rows.length,
    interviews: rows.filter((r) => r.everInterviewed).length,
    offers: rows.filter((r) => r.everOffered).length,
    rejections: rows.filter((r) => r.latestCategory === 'rejected').length,
    awaitingReply: rows.filter((r) => r.latestCategory === 'applied').length,
  };
}

/**
 * Buckets rows into consecutive 7-day windows anchored at `start` — matching
 * how benefit certification periods are counted from a chosen week start.
 */
export function weeklyActivity(rows, start, end) {
  const buckets = [];
  const endMs = endOfDay(end).getTime();
  // Calendar-date arithmetic, not fixed milliseconds: a DST change would make
  // ms-based weeks drift an hour and produce overlapping labels (Mar 8 - Mar 15,
  // Mar 15 - Mar 22).
  let cursor = startOfDay(start);
  while (cursor.getTime() <= endMs && buckets.length < 27) {
    const lastDay = new Date(cursor);
    lastDay.setDate(lastDay.getDate() + 6);
    const bucketEndMs = Math.min(endOfDay(lastDay).getTime(), endMs);
    const cursorMs = cursor.getTime();
    buckets.push({
      label: `${formatShortDate(cursor)} - ${formatShortDate(new Date(bucketEndMs))}`,
      count: (rows || []).filter((row) => {
        const t = row.appliedDate?.getTime?.();
        return Number.isFinite(t) && t >= cursorMs && t <= bucketEndMs;
      }).length,
    });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return buckets;
}

export function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatLongDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export const REPORT_PROVENANCE_NOTE =
  'Compiled from job application emails in the account holder\'s Gmail and from applications '
  + 'they added themselves (marked "added by applicant"). Applendium records an emailed '
  + 'application when a confirmation or related email arrives, so these counts are a floor, not an estimate.';

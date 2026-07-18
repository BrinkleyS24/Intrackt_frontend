function normalizeCategoryKey(value) {
  return (value || '').toString().trim().toLowerCase();
}

export function normalizeApplicationStatusKey(value) {
  const normalized = normalizeCategoryKey(value);
  if (['offer', 'offered', 'offers'].includes(normalized)) return 'offers';
  if (['interview', 'interviewed', 'interviews'].includes(normalized)) return 'interviewed';
  if (['reject', 'rejected', 'rejection'].includes(normalized)) return 'rejected';
  if (['apply', 'applied', 'application'].includes(normalized)) return 'applied';
  if (normalized === 'closed') return 'closed';
  return normalized;
}

export function isTerminalApplicationStatus(value) {
  const normalized = normalizeApplicationStatusKey(value);
  return normalized === 'offers' || normalized === 'rejected';
}

export function normalizeApplicationPresentationStatusKey(value) {
  const normalized = normalizeApplicationStatusKey(value);
  return normalized === 'rejected' ? 'closed' : normalized;
}

export function deriveDisplayCategory(category, applicationStatus, isClosed) {
  const rawCategory = normalizeApplicationStatusKey(category);
  const normalizedApplicationStatus = normalizeApplicationStatusKey(applicationStatus);
  const isTerminalOutcome = isTerminalApplicationStatus(normalizedApplicationStatus);

  if (!isClosed) return rawCategory;
  if (rawCategory === 'offers') return rawCategory;
  if (rawCategory === 'rejected') return 'closed';
  if (isTerminalOutcome || rawCategory === 'applied' || rawCategory === 'interviewed') return 'closed';
  return rawCategory || 'closed';
}

export function deriveApplicationStatusFromLifecycle(applicationStatus, lifecycle = []) {
  const normalizedApplicationStatus = normalizeApplicationStatusKey(applicationStatus);
  const lifecycleStatuses = (lifecycle || []).map((item) =>
    normalizeApplicationStatusKey(item?.category || item?.current_status)
  );

  if (lifecycleStatuses.includes('rejected')) return 'rejected';
  if (lifecycleStatuses.includes('offers')) return 'offers';
  if (lifecycleStatuses.includes('interviewed')) {
    return (!normalizedApplicationStatus || normalizedApplicationStatus === 'applied' || isTerminalApplicationStatus(normalizedApplicationStatus))
      ? 'interviewed'
      : normalizedApplicationStatus;
  }
  if (lifecycleStatuses.includes('applied')) {
    if (!normalizedApplicationStatus || isTerminalApplicationStatus(normalizedApplicationStatus) || normalizedApplicationStatus === 'closed') {
      return 'applied';
    }
  }

  return normalizedApplicationStatus;
}

export function hasTerminalLifecycleOutcome(applicationStatus, lifecycle = []) {
  if (isTerminalApplicationStatus(applicationStatus)) return true;
  return (lifecycle || []).some((item) =>
    isTerminalApplicationStatus(item?.category || item?.current_status)
  );
}

export function deriveEmailPresentationState(email = {}, options = {}) {
  const fallbackCategory = options.fallbackCategory ?? null;
  const lifecycle = Array.isArray(options.lifecycle) ? options.lifecycle : [];
  const resolvedApplicationStatus = deriveApplicationStatusFromLifecycle(
    options.applicationStatus ?? email?.applicationStatus,
    lifecycle
  );
  const rawStatusKey = normalizeApplicationStatusKey(fallbackCategory ?? email?.category) || 'applied';
  const hasTerminalOutcome =
    hasTerminalLifecycleOutcome(resolvedApplicationStatus, lifecycle) ||
    isTerminalApplicationStatus(rawStatusKey);
  const isEffectivelyUserClosed = Boolean(email?.applicationId && email?.isUserClosed && !hasTerminalOutcome);
  const isEffectivelyClosed = Boolean(
    hasTerminalOutcome ||
    (email?.applicationId && (email?.isClosed || isEffectivelyUserClosed))
  );
  const cachedDisplayCategory = normalizeApplicationStatusKey(email?.displayCategory);
  const derivedDisplayCategory =
    deriveDisplayCategory(rawStatusKey, resolvedApplicationStatus, isEffectivelyClosed) ||
    rawStatusKey;
  const baseStatusKey =
    (cachedDisplayCategory === 'closed' && !isEffectivelyClosed ? null : cachedDisplayCategory) ||
    derivedDisplayCategory;
  const shouldDisplayClosed =
    baseStatusKey === 'closed' ||
    baseStatusKey === 'rejected' ||
    Boolean(isEffectivelyClosed && baseStatusKey !== 'offers');

  return {
    rawStatusKey,
    applicationStatus: resolvedApplicationStatus,
    hasTerminalOutcome,
    isEffectivelyUserClosed,
    isEffectivelyClosed,
    shouldDisplayClosed,
    displayStatusKey: shouldDisplayClosed ? 'closed' : baseStatusKey,
  };
}

// --- Pipeline (one-card-per-role) tab model -------------------------------
//
// The inbox tabs are a funnel: a role lives in exactly ONE tab = its latest
// status update (owner-defined 2026-07). Rules:
//   - Active stages only move FORWARD (a late "thanks for applying" auto-ack
//     can never demote an interviewed role back to Applied).
//   - Terminal updates (offer / rejection) pull the role out of the active
//     tabs; when a role has both, the NEWER one wins (a rescinded offer is a
//     rejection; a re-offer after a rejection is an offer).
//   - Employer silence counts as a rejection FOR DISPLAY ("rejected in
//     silence"): manual closes with a ghosting/no-response reason land in the
//     Rejected tab. Stats and Apply Gate memory keep the honest distinction
//     via the backend's isUserRejected rule.
//   - Candidate-driven closes (withdrew / accepted elsewhere) are neither
//     active nor rejections: the role keeps its stage tab but is parked under
//     that tab's Closed sub-filter (see deriveGroupClosedByChoice).
export const PIPELINE_STATUS_RANK = {
  applied: 0,
  interviewed: 1,
};

const TERMINAL_PIPELINE_STATUSES = new Set(['offers', 'rejected']);

/**
 * The pipeline tab a single email's ROLE belongs to.
 * Uses the application's reconciled current_status (which already reflects the
 * role's stage for backend-linked roles), folds in manual closes that count as
 * rejections for display (isUserRejected, plus 'silence' closes), and falls
 * back to the email's own category when the role is unlinked.
 * @returns {'applied'|'interviewed'|'offers'|'rejected'}
 */
export function derivePipelineStatus(email) {
  if (!email) return 'applied';
  if (email.isUserRejected) return 'rejected';
  // Ghosting / no-response close-outs display as rejections ("rejected in silence").
  if (email.manualCloseKind === 'silence') return 'rejected';

  const appStatus = normalizeApplicationStatusKey(email.applicationStatus);
  if (appStatus === 'offers' || appStatus === 'rejected' || appStatus === 'interviewed' || appStatus === 'applied') {
    return appStatus;
  }

  const category = normalizeApplicationStatusKey(email.category);
  if (category === 'offers' || category === 'rejected' || category === 'interviewed') return category;
  return 'applied';
}

/**
 * The pipeline tab for a whole role (a group of emails spanning one or more
 * threads). Terminal statuses beat active ones; between the two terminals the
 * most RECENT supporting email decides (rejected wins ties — the backend's
 * resolution makes the same call). Among active stages the furthest wins, so
 * stage never regresses on late lower-stage emails.
 * @returns {'applied'|'interviewed'|'offers'|'rejected'}
 */
export function deriveGroupPipelineStatus(emails) {
  let bestActive = 'applied';
  let bestActiveRank = -1;
  let terminal = null;
  let terminalTime = -1;

  for (const email of emails || []) {
    const status = derivePipelineStatus(email);
    if (TERMINAL_PIPELINE_STATUSES.has(status)) {
      const time = toEpoch(email?.date);
      // Newest terminal update wins; on an exact tie prefer 'rejected'.
      if (time > terminalTime || (time === terminalTime && status === 'rejected')) {
        terminal = status;
        terminalTime = time;
      }
      continue;
    }
    const rank = PIPELINE_STATUS_RANK[status] ?? 0;
    if (rank > bestActiveRank) {
      bestActiveRank = rank;
      bestActive = status;
    }
  }

  return terminal || bestActive;
}

/**
 * True when the role was closed by the candidate's own decision (withdrew /
 * accepted elsewhere / no longer interested). These roles keep their stage tab
 * but are hidden from the default (Active) view and shown under the Closed
 * sub-filter instead — they are not rejections and not live leads.
 */
export function deriveGroupClosedByChoice(emails) {
  return (emails || []).some((email) => email?.manualCloseKind === 'user_choice');
}

// Mirror of backend utils/applicationCloseOutcome.js classifyManualCloseKind —
// keep the two in sync. The background uses this to recompute manualCloseKind
// when it patches cached emails from a close/reopen response (the backend
// snapshot provides it on full syncs, but patches only have the raw reason).
const USER_CHOICE_CLOSE_LABELS = ['withdrew', 'accepted elsewhere', 'no longer interested'];
const SILENCE_CLOSE_LABELS = ['no response', 'no reply', 'ghosted', 'stale'];
const GHOSTING_OR_STALE_PATTERN = /ghost|no response|no reply|went stale|\bstale\b|daily action queue/i;

/**
 * @param {string|null|undefined} userClosedReason
 * @returns {'rejection'|'silence'|'user_choice'}
 */
export function classifyManualCloseKind(userClosedReason) {
  const raw = (userClosedReason == null ? '' : String(userClosedReason)).trim();
  const leadingLabel = raw.split(' - ')[0].trim().toLowerCase();
  if (USER_CHOICE_CLOSE_LABELS.includes(leadingLabel)) return 'user_choice';
  if (SILENCE_CLOSE_LABELS.includes(leadingLabel)) return 'silence';
  if (GHOSTING_OR_STALE_PATTERN.test(raw)) return 'silence';
  return 'rejection';
}

const toEpoch = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

// The strongest application key found among a group's emails. Only `app_*`
// (backend-linked) and `cp_*` (company+position) keys identify a role across
// threads; thread/email-scoped keys stay per-thread so we never merge unrelated
// roles that happen to lack a link. `getApplicationKey` is injected to keep this
// module dependency-free (and therefore unit-testable in isolation).
function deriveGroupApplicationKey(group, getApplicationKey) {
  const emails = Array.isArray(group?.emails) ? group.emails : [];
  let appKey = null;
  for (const email of emails) {
    const key = getApplicationKey(email);
    if (key && key.startsWith('app_')) return key; // strongest signal, stop early
    if (!appKey && key && key.startsWith('cp_')) appKey = key;
  }
  return appKey;
}

/**
 * Collapse thread-groups that belong to the same role into a single card, so a
 * role whose application-confirmation and rejection live in different Gmail
 * threads shows once instead of twice. Only merges on durable role keys
 * (`app_*` / `cp_*`); everything else is passed through untouched. Pure: the
 * `getApplicationKey` resolver is injected by the caller.
 */
export function mergeGroupsByApplication(groups, getApplicationKey) {
  const byKey = new Map();
  const result = [];

  for (const group of groups || []) {
    const key = deriveGroupApplicationKey(group, getApplicationKey);
    if (!key) {
      result.push(group);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, group);
      result.push(group);
      continue;
    }
    existing._merge = existing._merge || [existing.emails ? [...existing.emails] : []];
    existing._merge.push(group.emails ? [...group.emails] : []);
  }

  // Re-summarize only the groups that actually absorbed a sibling.
  return result.map((group) => {
    if (!group._merge) return group;
    const emails = group._merge.flat();
    const sorted = [...emails].sort((a, b) => toEpoch(b?.date) - toEpoch(a?.date));
    const latest = sorted[0] || group.latestEmail || {};
    const earliest = sorted[sorted.length - 1] || group.earliestEmail || {};
    const unreadCount = emails.filter((email) => !email?.is_read).length;
    const key = deriveGroupApplicationKey({ emails }, getApplicationKey) || group.threadId;
    const { _merge, ...rest } = group;
    return {
      ...rest,
      threadId: key,
      id: `app-${key}`,
      emails,
      messageCount: emails.length,
      unreadCount,
      is_read: unreadCount === 0,
      date: latest?.date,
      latestDate: latest?.date,
      earliestDate: earliest?.date,
      from: latest?.from,
      subject: latest?.subject || earliest?.subject || group.subject || '(No subject)',
      preview: latest?.html_body || latest?.body || group.preview || '',
      latestEmail: latest,
      earliestEmail: earliest,
    };
  });
}

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
// The inbox tabs are a funnel: a role lives in exactly ONE tab = its current
// status. Terminal outcomes win (an Offer or a Rejection pulls the role out of
// Applied/Interviewed), otherwise the furthest active stage wins. This is what
// makes "Applied: N" mean "N still-live leads" instead of "N roles that ever
// received an applied-stage email, half of them dead". Higher rank wins.
export const PIPELINE_STATUS_RANK = {
  applied: 0,
  interviewed: 1,
  rejected: 2,
  offers: 3,
};

/**
 * The pipeline tab a single email's ROLE belongs to.
 * Uses the application's reconciled current_status (which already reflects the
 * furthest stage for backend-linked roles) and folds in a manual "rejected
 * verbally"-style close (`isUserRejected`). Neutral closes (withdrew / no
 * response) are NOT rejections — they keep their active stage and are dimmed in
 * place. Falls back to the email's own category when the role is unlinked.
 * @returns {'applied'|'interviewed'|'offers'|'rejected'}
 */
export function derivePipelineStatus(email) {
  if (!email) return 'applied';
  if (email.isUserRejected) return 'rejected';

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
 * threads). Terminal-wins: the highest-ranked status across the role's emails.
 * @returns {'applied'|'interviewed'|'offers'|'rejected'}
 */
export function deriveGroupPipelineStatus(emails) {
  let best = 'applied';
  let bestRank = -1;
  for (const email of emails || []) {
    const status = derivePipelineStatus(email);
    const rank = PIPELINE_STATUS_RANK[status] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = status;
    }
  }
  return best;
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

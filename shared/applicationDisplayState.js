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

export function deriveDisplayCategory(category, applicationStatus, isClosed) {
  const rawCategory = normalizeApplicationStatusKey(category);
  const normalizedApplicationStatus = normalizeApplicationStatusKey(applicationStatus);
  const isTerminalOutcome = isTerminalApplicationStatus(normalizedApplicationStatus);

  if (!isClosed) return rawCategory;
  if (rawCategory === 'offers' || rawCategory === 'rejected') return rawCategory;
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
    return normalizedApplicationStatus === 'applied'
      ? 'interviewed'
      : (normalizedApplicationStatus || 'interviewed');
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
  const resolvedApplicationStatus = normalizeApplicationStatusKey(
    options.applicationStatus ?? email?.applicationStatus
  );
  const hasTerminalOutcome = hasTerminalLifecycleOutcome(resolvedApplicationStatus, lifecycle);
  const isEffectivelyUserClosed = Boolean(email?.applicationId && email?.isUserClosed && !hasTerminalOutcome);
  const isEffectivelyClosed = Boolean(
    email?.applicationId && (email?.isClosed || isEffectivelyUserClosed || hasTerminalOutcome)
  );
  const rawStatusKey = normalizeApplicationStatusKey(fallbackCategory ?? email?.category) || 'applied';
  const cachedDisplayCategory = normalizeApplicationStatusKey(email?.displayCategory);
  const baseStatusKey =
    cachedDisplayCategory ||
    deriveDisplayCategory(rawStatusKey, resolvedApplicationStatus, isEffectivelyClosed) ||
    rawStatusKey;
  const shouldDisplayClosed =
    baseStatusKey === 'closed' ||
    Boolean(isEffectivelyClosed && !isTerminalApplicationStatus(baseStatusKey));

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

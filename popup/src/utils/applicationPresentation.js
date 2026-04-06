import {
  deriveApplicationStatusFromLifecycle,
  deriveEmailPresentationState,
  normalizeApplicationStatusKey,
} from '../../../shared/applicationDisplayState.js';

const toTime = (value) => {
  const parsed = new Date(value || 0);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : 0;
};

export function deriveConversationCurrentStatus(group) {
  const presentation = deriveConversationPresentationState(group);
  return normalizeApplicationStatusKey(presentation?.displayStatusKey) || 'applied';
}

export function deriveConversationPresentationState(group) {
  const emails = Array.isArray(group?.emails) ? [...group.emails] : [];
  if (emails.length === 0) {
    return deriveEmailPresentationState({}, { fallbackCategory: 'applied' });
  }

  const sorted = emails.sort((a, b) => toTime(b?.date) - toTime(a?.date));
  const latestEmail = sorted[0] || {};
  const representativeEmail =
    sorted.find((email) => (
      email?.applicationId ||
      email?.application_id ||
      email?.applicationStatus ||
      email?.isClosed ||
      email?.isUserClosed ||
      email?.displayCategory
    )) || latestEmail;
  const lifecycle = sorted.map((email) => ({
    category: email?.category,
    current_status: email?.applicationStatus,
    date: email?.date,
  }));
  const statusHint =
    sorted.find((email) => email?.applicationStatus)?.applicationStatus ||
    representativeEmail?.applicationStatus ||
    latestEmail?.applicationStatus ||
    null;
  const resolvedApplicationStatus = deriveApplicationStatusFromLifecycle(statusHint, lifecycle);
  const mergedPresentationEmail = {
    ...latestEmail,
    applicationId:
      representativeEmail?.applicationId ||
      representativeEmail?.application_id ||
      latestEmail?.applicationId ||
      latestEmail?.application_id ||
      null,
    applicationStatus: resolvedApplicationStatus || representativeEmail?.applicationStatus || latestEmail?.applicationStatus || null,
    isClosed: sorted.some((email) => Boolean(email?.isClosed)) || Boolean(representativeEmail?.isClosed),
    isUserClosed: sorted.some((email) => Boolean(email?.isUserClosed)) || Boolean(representativeEmail?.isUserClosed),
    displayCategory:
      representativeEmail?.displayCategory ||
      sorted.find((email) => normalizeApplicationStatusKey(email?.displayCategory))?.displayCategory ||
      latestEmail?.displayCategory ||
      null,
  };

  return deriveEmailPresentationState(mergedPresentationEmail, {
    fallbackCategory: normalizeApplicationStatusKey(latestEmail?.category) || 'applied',
    applicationStatus: resolvedApplicationStatus,
    lifecycle,
  });
}

export function attachConversationStatuses(groups = []) {
  return (groups || []).map((group) => ({
    ...group,
    currentStatus: deriveConversationCurrentStatus(group),
  }));
}

export function collapseJourneyStages(stages = []) {
  const sorted = [...(stages || [])].sort((a, b) => toTime(a?.date) - toTime(b?.date));
  const collapsed = [];

  for (const stage of sorted) {
    const category = normalizeApplicationStatusKey(stage?.category || stage?.current_status);
    if (!category) continue;

    const previous = collapsed[collapsed.length - 1];
    if (previous && previous.category === category) {
      previous.eventCount += 1;
      if (stage?.emailId != null) previous.emailIds.push(stage.emailId);
      if (stage?.subject && !previous.subjects.includes(stage.subject)) {
        previous.subjects.push(stage.subject);
      }
      if (stage?.subject) previous.subject = stage.subject;
      if (toTime(stage?.date) >= toTime(previous.lastDate || previous.date)) {
        previous.lastDate = stage?.date || previous.lastDate;
      }
      continue;
    }

    collapsed.push({
      ...stage,
      category,
      eventCount: 1,
      emailIds: stage?.emailId != null ? [stage.emailId] : [],
      subjects: stage?.subject ? [stage.subject] : [],
      lastDate: stage?.date || null,
    });
  }

  return collapsed;
}

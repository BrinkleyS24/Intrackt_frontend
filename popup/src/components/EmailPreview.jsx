import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, ChevronDown, Clock, ExternalLink, Flag, Lock, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { parseEmailDate, getCategoryTitle } from '../utils/uiHelpers';
import { showNotification } from './Notification';
import { sendMessageToBackground } from '../utils/chromeMessaging';
import { collapseJourneyStages } from '../utils/applicationPresentation';
import { isEncryptedPayload, safeTextValue } from '../utils/sensitiveContent';
import CompanyField from './CompanyField';
import confetti from '../lib/confetti.browser.min.js';
import {
  deriveEmailPresentationState,
  normalizeApplicationPresentationStatusKey,
  normalizeApplicationStatusKey,
} from '../../../shared/applicationDisplayState.js';

const CELEBRATED_OFFERS_KEY = 'applendiumCelebratedOfferThreads';

// Hero-popup celebration palette (bright green / interview gold / soft white).
const OFFER_CONFETTI_COLORS = ['#2FBE8F', '#F4C770', '#DCE2EA'];

function fireOfferConfetti() {
  try {
    confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 32,
      origin: { x: 0.5, y: 0.3 },
      colors: OFFER_CONFETTI_COLORS,
      zIndex: 1200,
      disableForReducedMotion: true,
    });
    setTimeout(() => {
      confetti({
        particleCount: 45,
        spread: 110,
        startVelocity: 24,
        origin: { x: 0.5, y: 0.25 },
        colors: OFFER_CONFETTI_COLORS,
        zIndex: 1200,
        disableForReducedMotion: true,
      });
    }, 220);
  } catch (_) {
    /* celebration is never allowed to break the preview */
  }
}

const STATUS_CLASSES = {
  applied: 'status-badge status-applied',
  interviewed: 'status-badge status-interviewed',
  offers: 'status-badge status-offers',
  rejected: 'status-badge status-rejected',
  closed: 'status-badge status-closed',
  irrelevant: 'status-badge bg-muted text-muted-foreground',
};

const decodeEmailContentSafe = (content) => {
  if (!content || typeof content !== 'string') return '';

  let decoded = content;
  try {
    if (decoded.startsWith('"') && decoded.endsWith('"')) {
      decoded = JSON.parse(decoded);
    }
  } catch (_) {}

  const textarea = document.createElement('textarea');
  textarea.innerHTML = decoded;
  decoded = textarea.value;

  return decoded
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac\u009c/g, '"')
    .replace(/\u00e2\u20ac\u009d/g, '"')
    .replace(/\u00e2\u20ac\u201c/g, '-')
    .replace(/\u00e2\u20ac\u201d/g, '-')
    .replace(/\u00e2\u20ac\u00a6/g, '...')
    .replace(/\u00e2\u20ac\u00a2/g, '*')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
};

const stripHtmlToText = (html) => {
  if (!html || typeof html !== 'string') return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style,script,noscript,head,meta,link,title,base').forEach((el) => el.remove());
    return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  } catch (_) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
};

const looksLikeHtml = (text) => {
  if (!text || typeof text !== 'string') return false;
  const value = text.trim();
  if (!value.includes('<') || !value.includes('>')) return false;
  return /<\s*(html|body|div|p|span|table|style|script|head|meta|link|br|hr|a|img)\b/i.test(value);
};

const isSafeLinkUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim(), 'https://example.invalid');
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const isSafeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim(), 'https://example.invalid');
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const sanitizeUntrustedEmailHtml = (html) => {
  if (!html || typeof html !== 'string') return '';

  const safeTags = new Set([
    'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead',
    'tr', 'u', 'ul',
  ]);
  const safeAttrs = new Set(['href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'aria-label', 'aria-hidden']);
  const dropTags = new Set(['style', 'script', 'noscript', 'head', 'meta', 'link', 'title', 'base']);

  const template = document.createElement('template');
  template.innerHTML = html;

  const sanitizeNode = (node) => {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.remove();
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      const tag = el.tagName.toLowerCase();

      if (dropTags.has(tag)) {
        el.remove();
        return;
      }

      if (!safeTags.has(tag)) {
        const fragment = document.createDocumentFragment();
        while (el.firstChild) fragment.appendChild(el.firstChild);
        el.replaceWith(fragment);
        return;
      }

      el.removeAttribute('style');
      el.removeAttribute('class');
      el.removeAttribute('id');

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'srcset' || name === 'nonce') {
          el.removeAttribute(attr.name);
          continue;
        }
        if (!safeAttrs.has(name)) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (tag === 'a' && name === 'href' && !isSafeLinkUrl(attr.value)) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (tag === 'img' && name === 'src' && !isSafeImageUrl(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }

      if (tag === 'a') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }

    for (const child of Array.from(node.childNodes)) {
      sanitizeNode(child);
    }
  };

  sanitizeNode(template.content);
  return template.innerHTML;
};

const sanitizeAndStyleEmailHTML = (html) => {
  const safeHtml = sanitizeUntrustedEmailHtml(html);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = safeHtml;
  tempDiv.querySelectorAll('img[width="1"], img[height="1"], img[src*="tracking"], img[src*="pixel"]').forEach((img) => img.remove());
  tempDiv.querySelectorAll('a').forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
  return tempDiv.innerHTML;
};

const escapePlainTextForHtml = (text) => (
  (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

const formatPlainTextEmail = (text) => {
  if (!text || typeof text !== 'string') return '';

  let formatted = escapePlainTextForHtml(text)
    .replace(/On\s+.+?\s+at\s+.+?,\s+.+?\s+wrote:\s*/gi, '\n--- Previous Message ---\n')
    .replace(/^-+\s*Original Message\s*-+$/gim, '\n--- Original Message ---\n')
    .replace(/^--\s*$/gm, '\n--- Signature ---\n');

  formatted = formatted.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  formatted = formatted.replace(
    /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
    '<a href="mailto:$1">$1</a>'
  );
  formatted = formatted.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  return `<p>${formatted}</p>`.replace(/<p>\s*<\/p>/g, '');
};

const cleanPlainTextEmail = (text) => {
  let out = (text || '')
    .replace(/On\s+.+?\s+at\s+.+?,\s+.+?\s+wrote:\s*/gi, '')
    .replace(/^-+\s*Forwarded message\s*-+$/gim, '')
    .replace(/^-+\s*Original Message\s*-+$/gim, '');

  // Cut the terminal footer/boilerplate block — everything from the first footer
  // marker to the end. (Line-based stripping fails because HTML→text collapses
  // newlines into one line, so a whole-line match would delete the entire body.)
  out = out.replace(
    /(?:(?:you can )?manage your (?:email )?(?:communication )?preferences|communication[_ ]preferences|to unsubscribe|unsubscribe from|update (?:your )?(?:email )?preferences|view (?:this email )?in (?:your )?browser|©\s*\d{4}|all rights reserved|this (?:email|message) was sent to|you(?:'re| are) receiving this)[\s\S]*$/i,
    '',
  );

  return out
    // Strip any remaining urls and bare tracking-token paths.
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b\S*\/[A-Za-z0-9_-]{16,}\S*/g, '')
    .replace(/\[image:[^\]]*\]/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Resolve a message's readable body to clean plain text — strip HTML, then
// remove tracking links / unsubscribe footers / opaque tokens. Shared by the
// renderer and the collapse "is this long?" heuristic so they always agree.
const getCleanMessageText = (message) => {
  let raw = '';
  if (message?.html_body && !isEncryptedPayload(message.html_body)) {
    raw = stripHtmlToText(decodeEmailContentSafe(message.html_body));
  } else if (message?.body && !isEncryptedPayload(message.body)) {
    const decoded = decodeEmailContentSafe(message.body);
    raw = looksLikeHtml(decoded) ? stripHtmlToText(decoded) : decoded;
  }
  return cleanPlainTextEmail(raw);
};

const getEmailThreadId = (emailLike) => {
  const candidates = [emailLike?.thread_id, emailLike?.threadId, emailLike?.thread];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const normalized = String(candidate).trim();
    if (normalized) return normalized;
  }
  return null;
};

const buildGmailThreadUrl = (emailLike, userEmail) => {
  const explicitLink = (emailLike?.gmail_link || '').toString().trim();
  if (explicitLink) return explicitLink;
  const threadId = getEmailThreadId(emailLike);
  if (!threadId) return null;
  const authUser = (userEmail || '').toString().trim();
  const authQuery = authUser ? `?authuser=${encodeURIComponent(authUser)}` : '';
  return `https://mail.google.com/mail/u/0/${authQuery}#all/${encodeURIComponent(threadId)}`;
};

const openExternalTab = async (url) => {
  if (!url) return false;
  try {
    if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
      await chrome.tabs.create({ url });
      return true;
    }
  } catch (_) {}
  try {
    return Boolean(window.open(url, '_blank', 'noopener,noreferrer'));
  } catch {
    return false;
  }
};

const InlineButton = ({ children, className, variant = 'primary', ...props }) => {
  const variantClasses = {
    primary: 'bg-accent text-accent-foreground hover:bg-accent/90',
    outline: 'border border-white/10 bg-white/[0.03] text-foreground hover:border-white/20 hover:bg-white/[0.06]',
    subtle: 'text-muted-foreground hover:text-foreground',
    danger: 'border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
};

const formatLongDate = (dateValue) => {
  const date = parseEmailDate(dateValue) || new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortDate = (dateValue) => {
  const date = parseEmailDate(dateValue) || new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getJourneyDescription = (category) => {
  const normalized = (category || '').toString().toLowerCase();
  if (normalized === 'applied') return 'Application email received';
  if (normalized === 'interviewed') return 'Interview email received';
  if (normalized === 'offers') return 'Offer email received';
  if (normalized === 'rejected') return 'Application rejected';
  return 'Status update email received';
};

export default function EmailPreview({
  email,
  onOpenMisclassificationModal,
  onUpdateCompanyName,
  onUpdatePosition,
  onOpenPremiumPage,
  userPlan,
  userEmail,
}) {
  if (!email) return null;

  const threadArr = Array.isArray(email.threadMessages) && email.threadMessages.length > 0
    ? email.threadMessages
    : [email];

  const [activeIdx, setActiveIdx] = useState(0);
  const [expandedMessages, setExpandedMessages] = useState({});
  const toggleMessageExpanded = (key) =>
    setExpandedMessages((prev) => ({ ...prev, [key]: !prev[key] }));
  const [lifecycle, setLifecycle] = useState(null);
  const [applicationSummary, setApplicationSummary] = useState(null);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [closingApplication, setClosingApplication] = useState(false);
  const [reopeningApplication, setReopeningApplication] = useState(false);
  const [showClosePanel, setShowClosePanel] = useState(false);
  const [closePreset, setClosePreset] = useState('no_response');
  const [closeNote, setCloseNote] = useState('');
  // Close taxonomy (mirrors backend utils/applicationCloseOutcome.js):
  //   - rejection (Rejected verbally / Position filled / Other) -> Rejected tab.
  //   - silence (No response) -> Rejected tab too ("rejected in silence"), but
  //     stats and Apply Gate keep treating it as a non-rejection.
  //   - user choice (Withdrew / Accepted elsewhere) -> stays in its stage tab
  //     under the Closed filter; never counted as a rejection.
  const closeKind = ['rejected_verbal', 'position_filled', 'other'].includes(closePreset)
    ? 'rejection'
    : closePreset === 'no_response'
      ? 'silence'
      : 'user_choice';
  const closeMovesToRejected = closeKind === 'rejection' || closeKind === 'silence';
  const latestLifecycleRequestRef = React.useRef(0);

  // One-time confetti the first time an offer thread is opened — the peak
  // moment of the whole product should not render like any other row.
  // Celebrated thread ids persist so reopening the thread stays calm.
  const offerCelebrationKey = email.thread_id || email.threadId || email.id || null;
  const threadHasOffer = threadArr.some(
    (message) => normalizeApplicationStatusKey(message?.category) === 'offers'
  );

  useEffect(() => {
    if (!threadHasOffer || !offerCelebrationKey) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const stored = await chrome.storage?.local?.get([CELEBRATED_OFFERS_KEY]);
        const celebrated = Array.isArray(stored?.[CELEBRATED_OFFERS_KEY])
          ? stored[CELEBRATED_OFFERS_KEY]
          : [];
        if (cancelled || celebrated.includes(offerCelebrationKey)) return;
        await chrome.storage?.local?.set({
          [CELEBRATED_OFFERS_KEY]: [...celebrated, offerCelebrationKey].slice(-100),
        });
        if (!cancelled) fireOfferConfetti();
      } catch (_) {
        /* storage unavailable (lab harness) — skip the celebration */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadHasOffer, offerCelebrationKey]);

  const loadLifecycle = React.useCallback(async (applicationId, emailId) => {
    // Latest-wins guard: rapidly switching emails can resolve lifecycle responses
    // out of order. Only the most recent request is allowed to write component state.
    const requestId = latestLifecycleRequestRef.current + 1;
    latestLifecycleRequestRef.current = requestId;
    const isCurrent = () => requestId === latestLifecycleRequestRef.current;

    if (!applicationId) {
      if (isCurrent()) {
        setLifecycle(null);
        setApplicationSummary(null);
      }
      return { success: false, skipped: true };
    }

    if (isCurrent()) setLoadingLifecycle(true);
    try {
      const response = await sendMessageToBackground({
        type: 'FETCH_APPLICATION_LIFECYCLE',
        applicationId,
        emailId,
      });

      if (!isCurrent()) return response;

      if (response?.success && response?.lifecycle) {
        setLifecycle(response.lifecycle);
        setApplicationSummary(response.application || null);
      } else {
        setLifecycle(null);
        setApplicationSummary(null);
      }

      return response;
    } catch (error) {
      // A stale/orphaned applicationId returns 404 "Application not found" once an
      // application re-resolution/repair deletes the old row and re-keys its emails.
      // Degrade to local thread stages instead of surfacing an uncaught rejection.
      if (isCurrent()) {
        setLifecycle(null);
        setApplicationSummary(null);
      }
      console.warn(
        `[EmailPreview] Lifecycle fetch failed for application ${applicationId}; showing local stages.`,
        error?.message || error
      );
      return { success: false, error: error?.message || 'Failed to fetch application lifecycle' };
    } finally {
      if (isCurrent()) setLoadingLifecycle(false);
    }
  }, []);

  useEffect(() => {
    setActiveIdx(0);
  }, [email, threadArr]);

  useEffect(() => {
    loadLifecycle(email?.applicationId, email?.id);
  }, [email?.applicationId, email?.id, loadLifecycle]);

  const rawJourneyData = useMemo(() => {
    const isRelevant = (value) => ['applied', 'interviewed', 'offers', 'rejected'].includes(normalizeApplicationStatusKey(value));

    const fromLifecycle = Array.isArray(lifecycle) ? lifecycle : [];
    if (fromLifecycle.length > 0) {
      return { stages: fromLifecycle, source: 'application' };
    }

    const localStages = (threadArr || [])
      .filter((item) => isRelevant(item?.category))
      .map((item) => ({
        emailId: item.id || item.emailId || `${item.thread_id || item.threadId || 'msg'}-${item.date || ''}`,
        subject: safeTextValue(item.subject, ''),
        category: normalizeApplicationStatusKey(item.category),
        date: item.date,
      }));

    const emailCategory = normalizeApplicationStatusKey(email?.category);
    if (localStages.length === 0 && isRelevant(emailCategory)) {
      localStages.push({
        emailId: email.id || `${email.thread_id || email.threadId || 'email'}-${email.date || ''}`,
        subject: safeTextValue(email.subject, ''),
        category: emailCategory,
        date: email.date,
      });
    }

    localStages.sort((a, b) => {
      const aTime = (parseEmailDate(a.date) || new Date(a.date)).getTime();
      const bTime = (parseEmailDate(b.date) || new Date(b.date)).getTime();
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    });

    const seen = new Set();
    return {
      source: 'fallback',
      stages: localStages.filter((stage) => {
        if (!stage.emailId || seen.has(stage.emailId)) return false;
        seen.add(stage.emailId);
        return true;
      }),
    };
  }, [email, lifecycle, threadArr]);

  const journeyStages = useMemo(
    () => collapseJourneyStages(rawJourneyData?.stages || []),
    [rawJourneyData?.stages]
  );

  const mergedJourneyStageCount = Math.max(0, (rawJourneyData?.stages?.length || 0) - journeyStages.length);

  const presentationEmail = useMemo(() => ({
    ...email,
    isUserClosed: Boolean(email?.isUserClosed || applicationSummary?.user_closed_at),
    isClosed: Boolean(email?.isClosed || applicationSummary?.user_closed_at || applicationSummary?.is_closed),
  }), [
    applicationSummary?.is_closed,
    applicationSummary?.user_closed_at,
    email,
  ]);

  const {
    hasTerminalOutcome,
    isEffectivelyUserClosed,
    isEffectivelyClosed,
    shouldDisplayClosed,
    displayStatusKey,
  } = useMemo(() => deriveEmailPresentationState(presentationEmail, {
    applicationStatus: applicationSummary?.current_status || email?.applicationStatus,
    lifecycle: rawJourneyData?.stages || [],
  }), [
    applicationSummary?.current_status,
    email,
    rawJourneyData?.stages,
    presentationEmail,
  ]);

  const showRepairJourney = useMemo(() => {
    if (rawJourneyData?.source !== 'application') return false;
    if (!email?.applicationId) return false;
    const stages = Array.isArray(rawJourneyData?.stages) ? rawJourneyData.stages : [];
    const appliedCount = stages.filter((stage) => (stage?.category || '').toString().toLowerCase() === 'applied').length;
    return appliedCount > 1 || stages.length >= 8;
  }, [rawJourneyData, email?.applicationId]);

  const hasVisibleTerminalStage = useMemo(() => {
    const stages = Array.isArray(rawJourneyData?.stages) ? rawJourneyData.stages : [];
    return stages.some((stage) => {
      const normalized = normalizeApplicationStatusKey(stage?.category || stage?.current_status);
      return normalized === 'offers' || normalized === 'rejected';
    });
  }, [rawJourneyData?.stages]);

  const shouldOfferStatusRepair = useMemo(() => {
    if (!email?.applicationId) return false;
    if (isEffectivelyUserClosed) return false;
    const rawCategory = normalizeApplicationStatusKey(email?.category);
    if (rawCategory !== 'applied' && rawCategory !== 'interviewed') return false;
    return displayStatusKey === 'closed' && !hasVisibleTerminalStage;
  }, [
    displayStatusKey,
    email?.applicationId,
    email?.category,
    hasVisibleTerminalStage,
    isEffectivelyUserClosed,
  ]);

  const showRepairAction = showRepairJourney || shouldOfferStatusRepair;
  const repairActionLabel = shouldOfferStatusRepair ? 'Repair status' : 'Repair journey';

  const lastActivityDate = useMemo(() => {
    const candidates = [];
    if (email?.date) candidates.push(parseEmailDate(email.date) || new Date(email.date));
    for (const message of threadArr || []) {
      if (!message?.date) continue;
      const date = parseEmailDate(message.date) || new Date(message.date);
      if (!Number.isNaN(date.getTime())) candidates.push(date);
    }
    for (const stage of rawJourneyData?.stages || []) {
      if (!stage?.date) continue;
      const date = parseEmailDate(stage.date) || new Date(stage.date);
      if (!Number.isNaN(date.getTime())) candidates.push(date);
    }
    if (candidates.length === 0) return null;
    return new Date(Math.max(...candidates.map((date) => date.getTime())));
  }, [email?.date, rawJourneyData?.stages, threadArr]);

  const staleDays = useMemo(() => {
    if (!lastActivityDate) return null;
    const ms = Date.now() - lastActivityDate.getTime();
    if (ms < 0) return 0;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }, [lastActivityDate]);

  useEffect(() => {
    if (showClosePanel && isEffectivelyClosed) {
      setShowClosePanel(false);
    }
  }, [isEffectivelyClosed, showClosePanel]);

  const scrollToIdx = (idx) => {
    const el = document.getElementById(`msg-${idx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveIdx(idx);
    }
  };

  const renderSingleMessage = (message, collapsed = false) => {
    const clampClass = collapsed ? 'max-h-[150px] overflow-hidden' : '';
    const fade = collapsed ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-xl bg-gradient-to-t from-background to-transparent" />
    ) : null;

    // Always render a clean, readable plain-text version of the body. This strips
    // HTML cruft, tracking pixels, and footer/unsubscribe junk uniformly (the old
    // html_body branch bypassed cleanPlainTextEmail and leaked that noise). Full
    // original formatting is one tap away via the "Gmail" button.
    const formatted = formatPlainTextEmail(getCleanMessageText(message));
    if (formatted.trim()) {
      return (
        <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-background/50">
          <div
            className={cn('email-content-text p-4 text-sm leading-relaxed text-foreground/80', clampClass)}
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
          {fade}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-muted-foreground">
        Email content could not be displayed properly.
      </div>
    );
  };

  const handleOpenGmail = async () => {
    const gmailUrl = buildGmailThreadUrl(email, userEmail);
    if (!gmailUrl) {
      showNotification('Gmail link not available for this email.', 'warning');
      return;
    }

    const opened = await openExternalTab(gmailUrl);
    if (!opened) {
      showNotification('Unable to open Gmail for this email.', 'error');
    }
  };

  const handleLinkAcrossCategories = async () => {
    if (!email?.id) {
      showNotification('Cannot link: missing email id', 'error');
      return;
    }
    try {
      setLoadingLifecycle(true);
      const resp = await sendMessageToBackground({ type: 'LINK_APPLICATION_ROLE', emailId: email.id });
      if (resp?.success) {
        const linkedApplicationId = email?.applicationId || resp?.applicationId || resp?.linkedApplicationId;
        if (linkedApplicationId) {
          await loadLifecycle(linkedApplicationId, email?.id);
        }
        showNotification('Linking complete. Refreshing...', 'success');
      } else {
        showNotification(resp?.error || 'Failed to link across categories', 'error');
      }
    } catch (err) {
      showNotification(err?.message || 'Failed to link across categories', 'error');
    } finally {
      setLoadingLifecycle(false);
    }
  };

  const handleRepairApplicationLinks = async () => {
    if (!email?.applicationId) {
      showNotification('This email is not linked to an application yet.', 'info');
      return;
    }
    try {
      setLoadingLifecycle(true);
      const resp = await sendMessageToBackground({
        type: 'REPAIR_APPLICATION_LINKS',
        applicationId: email.applicationId,
        emailId: email.id,
      });
      if (resp?.success) {
        const updatedEmail = Array.isArray(resp?.emailUpdates)
          ? resp.emailUpdates.find((item) => Number(item?.emailId) === Number(email?.id))
          : null;
        const nextApplicationId = updatedEmail?.applicationId || email.applicationId;
        if (nextApplicationId) {
          await loadLifecycle(nextApplicationId, email?.id);
        } else {
          await loadLifecycle(null, email?.id);
        }
        showNotification('Repair complete. Refreshing...', 'success');
      } else {
        showNotification(resp?.error || 'Failed to repair application links', 'error');
      }
    } catch (err) {
      showNotification(err?.message || 'Failed to repair application links', 'error');
    } finally {
      setLoadingLifecycle(false);
    }
  };

  const openClosePanel = (source = 'manual') => {
    if (!email?.applicationId) {
      showNotification('This email is not linked to an application yet.', 'info');
      return;
    }
    if (hasTerminalOutcome) {
      showNotification('This application is closed by outcome and cannot be manually closed.', 'info');
      return;
    }
    if (isEffectivelyClosed) {
      showNotification('This application is already closed.', 'info');
      return;
    }
    setClosePreset(source === 'stale' ? 'no_response' : 'rejected_verbal');
    setCloseNote('');
    setShowClosePanel(true);
  };

  const confirmCloseApplication = async () => {
    if (!email?.applicationId) return;

    const presetToLabel = {
      no_response: 'No response',
      rejected_verbal: 'Rejected verbally',
      withdrew: 'Withdrew',
      accepted_elsewhere: 'Accepted elsewhere',
      position_filled: 'Position filled',
      other: 'Other',
    };

    const parts = [];
    const presetLabel = presetToLabel[closePreset] || 'Other';
    if (presetLabel) parts.push(presetLabel);
    if ((closeNote || '').trim()) parts.push(closeNote.trim());

    try {
      setClosingApplication(true);
      const resp = await sendMessageToBackground({
        type: 'CLOSE_APPLICATION',
        applicationId: email.applicationId,
        emailId: email.id,
        reason: parts.join(' - ').trim(),
      });
      if (resp?.success) {
        setShowClosePanel(false);
        showNotification(
          closeMovesToRejected
            ? 'Moved to your Rejected tab.'
            : 'Closed — find it under this tab\'s Closed filter.',
          'success',
        );
      } else {
        showNotification(resp?.error || 'Failed to close application', 'error');
      }
    } catch (err) {
      showNotification(err?.message || 'Failed to close application', 'error');
    } finally {
      setClosingApplication(false);
    }
  };

  const handleReopenApplication = async () => {
    if (!email?.applicationId) return;
    try {
      setReopeningApplication(true);
      const resp = await sendMessageToBackground({
        type: 'REOPEN_APPLICATION',
        applicationId: email.applicationId,
        emailId: email.id,
      });
      if (resp?.success) {
        showNotification('Application reopened.', 'success');
      } else {
        showNotification(resp?.error || 'Failed to reopen application', 'error');
      }
    } catch (err) {
      showNotification(err?.message || 'Failed to reopen application', 'error');
    } finally {
      setReopeningApplication(false);
    }
  };

  const presentationStatusKey = normalizeApplicationPresentationStatusKey(displayStatusKey);
  const statusClassName = STATUS_CLASSES[presentationStatusKey] || STATUS_CLASSES.applied;
  const displaySubject = safeTextValue(email.subject, '(No subject)');
  const displayFrom = safeTextValue(email.from, '');

  // What Applendium auto-detected for this thread — real signals from the
  // classification, not decoration. Mirrors the landing hero's "detected" chips.
  const detectedSignals = (() => {
    const out = [];
    const statusLabel = presentationStatusKey === 'interviewed' ? 'Interview' : getCategoryTitle(presentationStatusKey);
    out.push(`${statusLabel} detected`);
    if (safeTextValue(email.company_name, '')) out.push('Company identified');
    if (safeTextValue(email.position, '')) out.push('Role identified');
    if (threadArr.length > 1) out.push(`${threadArr.length} emails linked`);
    else if (journeyStages.length > 0) out.push('Linked to your pipeline');
    return out;
  })();

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .email-content-html, .email-content-text {
              line-height: 1.65;
              word-break: break-word;
              overflow-wrap: anywhere;
            }
            .email-content-html p, .email-content-text p {
              margin: 0 0 0.7em;
            }
            .email-content-html p:last-child, .email-content-text p:last-child {
              margin-bottom: 0;
            }
            .email-content-html img {
              max-width: 100% !important;
              height: auto !important;
              border-radius: 8px;
            }
            .email-content-html table {
              width: 100% !important;
              max-width: 100% !important;
            }
            .email-content-html a, .email-content-text a {
              color: #5FD9AE;
              text-decoration: none;
              word-break: break-all;
            }
            .email-content-html a:hover, .email-content-text a:hover {
              text-decoration: underline;
            }
          `,
        }}
      />

      <div data-testid="email-preview" className="space-y-4 px-4 py-4">
        <div>
          <h2
            className={cn(
              'text-[28px] font-semibold leading-tight',
              shouldDisplayClosed ? 'text-muted-foreground line-through' : 'text-foreground'
            )}
          >
            {displaySubject}
          </h2>
          {displayFrom ? <p className="mt-2 text-sm text-muted-foreground">{displayFrom}</p> : null}
          <div className="mt-3 flex items-center gap-2">
            <span className={statusClassName}>
              {presentationStatusKey === 'interviewed' ? 'Interview' : getCategoryTitle(presentationStatusKey)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {[email.company_name, email.position].filter(Boolean).join(' · ') || 'Application details pending'}
            </span>
          </div>
        </div>

        {detectedSignals.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-accent" />
              Applendium detected
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detectedSignals.map((signal) => (
                <span
                  key={signal}
                  className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
                >
                  <span className="h-1 w-1 rounded-full bg-success" />
                  {signal}
                </span>
              ))}
            </div>
          </div>
        )}

        {threadArr.length > 1 && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-muted-foreground">
                {threadArr.length} message{threadArr.length === 1 ? '' : 's'} in thread
              </div>
              <div className="flex items-center gap-2">
                <InlineButton variant="outline" className="px-2 py-1 text-[11px]" onClick={() => scrollToIdx(Math.max(0, activeIdx - 1))}>
                  Prev
                </InlineButton>
                <InlineButton variant="outline" className="px-2 py-1 text-[11px]" onClick={() => scrollToIdx(Math.min(threadArr.length - 1, activeIdx + 1))}>
                  Next
                </InlineButton>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Company
              </div>
              {onUpdateCompanyName ? (
                <CompanyField email={email} userEmail={userEmail} onUpdate={onUpdateCompanyName} />
              ) : (
                <div className="text-sm text-foreground">{email.company_name || 'Not extracted'}</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Position
              </div>
              {onUpdatePosition ? (
                <CompanyField email={email} userEmail={userEmail} onUpdate={onUpdatePosition} fieldName="position" />
              ) : (
                <div className="text-sm text-foreground">{email.position || 'Not extracted'}</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-accent" />
              Application Journey
            </h3>
            <span className="text-[10px] text-accent">
              {loadingLifecycle ? 'Loading...' : `${journeyStages.length} stage${journeyStages.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {journeyStages.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No journey yet. Refresh to link this email to an application.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {journeyStages.map((stage, idx) => {
                const stageKey = normalizeApplicationStatusKey(stage.category);
                const stageClassName = STATUS_CLASSES[stageKey] || STATUS_CLASSES.applied;

                return (
                  <div key={stage.emailId || `${stage.category}-${idx}`} className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={stageClassName}>{getCategoryTitle(stageKey)}</span>
                          <p className="mt-1 text-[11px] text-muted-foreground">{getJourneyDescription(stage.category)}</p>
                          {stage.eventCount > 1 ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {stage.eventCount} similar emails merged into this stage
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatShortDate(stage.lastDate || stage.date)}</span>
                      </div>
                      {safeTextValue(stage.subject, '') ? (
                        <p className="mt-1 break-words text-[11px] text-foreground/80">
                          {stage.eventCount > 1 ? `Latest: ${safeTextValue(stage.subject, '')}` : safeTextValue(stage.subject, '')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {mergedJourneyStageCount > 0 && rawJourneyData.source === 'application' && (
                <p className="text-[10px] text-muted-foreground">
                  Merged {mergedJourneyStageCount} duplicate same-stage email{mergedJourneyStageCount === 1 ? '' : 's'} for clarity.
                </p>
              )}

              {rawJourneyData.source === 'fallback' && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    Showing local stages. Full journey appears after this email is linked across categories.
                  </p>
                  <InlineButton variant="outline" onClick={handleLinkAcrossCategories} disabled={loadingLifecycle}>
                    Link across categories
                  </InlineButton>
                </div>
              )}

              {showRepairAction && (
                <InlineButton variant="outline" onClick={handleRepairApplicationLinks} disabled={loadingLifecycle}>
                  {repairActionLabel}
                </InlineButton>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isEffectivelyUserClosed && (
            <InlineButton variant="outline" onClick={handleReopenApplication} disabled={reopeningApplication}>
              <TrendingUp className="h-3.5 w-3.5" />
              {reopeningApplication ? 'Reopening...' : 'Reopen'}
            </InlineButton>
          )}

          {email?.applicationId && !isEffectivelyClosed && (
            <InlineButton variant="outline" onClick={() => openClosePanel('manual')} disabled={closingApplication || showClosePanel}>
              <X className="h-3.5 w-3.5" />
              {closingApplication ? 'Closing...' : 'Close'}
            </InlineButton>
          )}

          <InlineButton variant="outline" onClick={() => onOpenMisclassificationModal(email)}>
            <Flag className="h-3.5 w-3.5" />
            Misclassify
          </InlineButton>

          <InlineButton variant="outline" onClick={handleOpenGmail}>
            <ExternalLink className="h-3.5 w-3.5" />
            Gmail
          </InlineButton>
        </div>

        {email?.applicationId && !isEffectivelyClosed && typeof staleDays === 'number' && staleDays >= 60 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
            <div>No activity for {staleDays} days. If you heard back off-email, you can close this role.</div>
            <InlineButton variant="outline" className="border-warning/30 bg-card/80" onClick={() => openClosePanel('stale')}>
              Close
            </InlineButton>
          </div>
        )}

        {showClosePanel && (
          <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Close application</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {closeKind === 'rejection'
                    ? 'Counts as a rejection — moves this role to your Rejected tab. Nothing is deleted; you can reopen it anytime.'
                    : closeKind === 'silence'
                      ? 'No response is a silent rejection — moves this role to your Rejected tab (it won\'t count against your stats). Nothing is deleted; you can reopen it anytime.'
                      : 'Your call, not a rejection — moves this role to this tab\'s Closed list. Nothing is deleted; you can reopen it anytime.'}
                </div>
              </div>
              <button onClick={() => setShowClosePanel(false)} className="text-muted-foreground transition hover:text-foreground" type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <select
                value={closePreset}
                onChange={(event) => setClosePreset(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
                disabled={closingApplication}
              >
                <option value="no_response">No response</option>
                <option value="rejected_verbal">Rejected verbally</option>
                <option value="withdrew">Withdrew</option>
                <option value="accepted_elsewhere">Accepted elsewhere</option>
                <option value="position_filled">Position filled</option>
                <option value="other">Other</option>
              </select>

              <input
                type="text"
                value={closeNote}
                onChange={(event) => setCloseNote(event.target.value)}
                placeholder="Add context (optional)"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
                disabled={closingApplication}
              />
            </div>

            <div className="flex justify-end gap-2">
              <InlineButton variant="outline" onClick={() => setShowClosePanel(false)} disabled={closingApplication}>
                Cancel
              </InlineButton>
              <InlineButton variant="danger" onClick={confirmCloseApplication} disabled={closingApplication}>
                {closingApplication ? 'Closing...' : 'Confirm close'}
              </InlineButton>
            </div>
          </div>
        )}

        {userPlan !== 'premium' && (presentationStatusKey === 'applied' || presentationStatusKey === 'interviewed') && onOpenPremiumPage && (
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-accent">
              <ShieldCheck className="h-3.5 w-3.5" />
              Your next move on this {presentationStatusKey === 'interviewed' ? 'interview' : 'application'}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-background/50 px-3 py-2">
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-3/4 rounded bg-muted-foreground/20" />
                <div className="mt-1.5 h-2 w-1/2 rounded bg-muted-foreground/15" />
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {presentationStatusKey === 'interviewed'
                ? 'When to follow up, what to send, and how similar interviews have played out — Premium maps your next step.'
                : 'When to follow up, whether to keep chasing, and how similar applications have played out — Premium maps your next step.'}
            </p>
            <button
              onClick={onOpenPremiumPage}
              className="mt-2.5 w-full rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent/90"
              type="button"
            >
              Unlock with Premium →
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{threadArr.length} message{threadArr.length === 1 ? '' : 's'}</span>
            </div>
            <span>{formatLongDate(email.date)}</span>
          </div>

          <div className="space-y-4">
            {threadArr.map((message, idx) => {
              const messageKey = message.id || `${message.thread_id || message.threadId || 'msg'}-${idx}`;
              // Collapse long bodies; measured on the cleaned text so junk removal counts.
              const isLong = getCleanMessageText(message).length > 520;
              const isExpanded = Boolean(expandedMessages[messageKey]);
              const collapsed = isLong && !isExpanded;

              return (
                <div key={messageKey} id={`msg-${idx}`} className="space-y-2">
                  {idx > 0 && (
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <div className="h-px flex-1 bg-border" />
                      Older message
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span className="truncate">{(message.from || 'Unknown sender').replace(/\s*<[^>]*>\s*/g, '').replace(/^"|"$/g, '').trim() || 'Unknown sender'}</span>
                    <span className="shrink-0">{formatLongDate(message.date)}</span>
                  </div>
                  {renderSingleMessage(message, collapsed)}
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => toggleMessageExpanded(messageKey)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-accent transition-colors hover:text-accent/80"
                    >
                      {isExpanded ? 'Show less' : 'Show full message'}
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

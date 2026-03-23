import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, Clock, ExternalLink, Flag, Reply, Send, TrendingUp, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { parseEmailDate, getCategoryTitle } from '../utils/uiHelpers';
import { showNotification } from './Notification';
import { sendMessageToBackground } from '../utils/chromeMessaging';
import CompanyField from './CompanyField';
import { deriveEmailPresentationState, normalizeApplicationStatusKey } from '../../../shared/applicationDisplayState.js';

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

const formatPlainTextEmail = (text) => {
  if (!text || typeof text !== 'string') return '';

  let formatted = text
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

const cleanPlainTextEmail = (text) => (
  (text || '')
    .replace(/On\s+.+?\s+at\s+.+?,\s+.+?\s+wrote:\s*/gi, '')
    .replace(/^-+\s*Forwarded message\s*-+$/gim, '')
    .replace(/^-+\s*Original Message\s*-+$/gim, '')
    .replace(/https?:\/\/tracking\..+$/gim, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
);

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
    outline: 'border border-border bg-card text-foreground hover:bg-muted',
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
  if (normalized === 'rejected') return 'Rejection email received';
  return 'Status update email received';
};

export default function EmailPreview({
  email,
  onReply,
  onOpenMisclassificationModal,
  loadingEmails,
  onUpdateCompanyName,
  onUpdatePosition,
  userEmail,
}) {
  if (!email) return null;

  const threadArr = Array.isArray(email.threadMessages) && email.threadMessages.length > 0
    ? email.threadMessages
    : [email];

  const [activeIdx, setActiveIdx] = useState(0);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyRecipient, setReplyRecipient] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [lifecycle, setLifecycle] = useState(null);
  const [applicationSummary, setApplicationSummary] = useState(null);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [closingApplication, setClosingApplication] = useState(false);
  const [reopeningApplication, setReopeningApplication] = useState(false);
  const [showClosePanel, setShowClosePanel] = useState(false);
  const [closePreset, setClosePreset] = useState('no_response');
  const [closeNote, setCloseNote] = useState('');

  const loadLifecycle = React.useCallback(async (applicationId) => {
    if (!applicationId) {
      setLifecycle(null);
      setApplicationSummary(null);
      return { success: false, skipped: true };
    }

    setLoadingLifecycle(true);
    try {
      const response = await sendMessageToBackground({
        type: 'FETCH_APPLICATION_LIFECYCLE',
        applicationId,
      });

      if (response?.success && response?.lifecycle) {
        setLifecycle(response.lifecycle);
        setApplicationSummary(response.application || null);
      } else {
        setLifecycle(null);
        setApplicationSummary(null);
      }

      return response;
    } finally {
      setLoadingLifecycle(false);
    }
  }, []);

  useEffect(() => {
    setActiveIdx(0);
    const first = threadArr[0];
    const fromValue = first?.from || '';
    const emailMatch = fromValue.match(/<([^>]+)>/);
    setReplyRecipient(emailMatch ? emailMatch[1] : fromValue);
    setReplySubject((email.subject || '').toLowerCase().startsWith('re:') ? email.subject : `Re: ${email.subject || ''}`);
    setReplyBody('');
    setShowReplyForm(false);
  }, [email, threadArr]);

  useEffect(() => {
    loadLifecycle(email?.applicationId);
  }, [email?.applicationId, loadLifecycle]);

  const journeyData = useMemo(() => {
    const isRelevant = (value) => ['applied', 'interviewed', 'offers', 'rejected'].includes(normalizeApplicationStatusKey(value));

    const fromLifecycle = Array.isArray(lifecycle) ? lifecycle : [];
    if (fromLifecycle.length > 0) {
      return { stages: fromLifecycle, source: 'application' };
    }

    const localStages = (threadArr || [])
      .filter((item) => isRelevant(item?.category))
      .map((item) => ({
        emailId: item.id || item.emailId || `${item.thread_id || item.threadId || 'msg'}-${item.date || ''}`,
        subject: item.subject || '',
        category: normalizeApplicationStatusKey(item.category),
        date: item.date,
      }));

    const emailCategory = normalizeApplicationStatusKey(email?.category);
    if (localStages.length === 0 && isRelevant(emailCategory)) {
      localStages.push({
        emailId: email.id || `${email.thread_id || email.threadId || 'email'}-${email.date || ''}`,
        subject: email.subject || '',
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

  const {
    hasTerminalOutcome,
    isEffectivelyUserClosed,
    isEffectivelyClosed,
    shouldDisplayClosed,
    displayStatusKey,
  } = useMemo(() => deriveEmailPresentationState(email, {
    applicationStatus: applicationSummary?.current_status || email?.applicationStatus,
    lifecycle: journeyData?.stages || [],
  }), [
    applicationSummary?.current_status,
    email,
    journeyData?.stages,
  ]);

  const showRepairJourney = useMemo(() => {
    if (journeyData?.source !== 'application') return false;
    if (!email?.applicationId) return false;
    const stages = Array.isArray(journeyData?.stages) ? journeyData.stages : [];
    const appliedCount = stages.filter((stage) => (stage?.category || '').toString().toLowerCase() === 'applied').length;
    return appliedCount > 1 || stages.length >= 8;
  }, [journeyData, email?.applicationId]);

  const lastActivityDate = useMemo(() => {
    const candidates = [];
    if (email?.date) candidates.push(parseEmailDate(email.date) || new Date(email.date));
    for (const message of threadArr || []) {
      if (!message?.date) continue;
      const date = parseEmailDate(message.date) || new Date(message.date);
      if (!Number.isNaN(date.getTime())) candidates.push(date);
    }
    for (const stage of journeyData?.stages || []) {
      if (!stage?.date) continue;
      const date = parseEmailDate(stage.date) || new Date(stage.date);
      if (!Number.isNaN(date.getTime())) candidates.push(date);
    }
    if (candidates.length === 0) return null;
    return new Date(Math.max(...candidates.map((date) => date.getTime())));
  }, [email?.date, journeyData?.stages, threadArr]);

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

  const renderSingleMessage = (message) => {
    if (message?.html_body) {
      const styledHtml = sanitizeAndStyleEmailHTML(decodeEmailContentSafe(message.html_body));
      if (styledHtml.trim()) {
        return (
          <div
            className="email-content-html rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-sm"
            dangerouslySetInnerHTML={{ __html: styledHtml }}
          />
        );
      }
    }

    if (message?.body) {
      let decoded = decodeEmailContentSafe(message.body);
      if (looksLikeHtml(decoded)) {
        decoded = stripHtmlToText(decoded);
      }
      const formatted = formatPlainTextEmail(cleanPlainTextEmail(decoded));
      if (formatted.trim()) {
        return (
          <div
            className="email-content-text rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-sm"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      }
    }

    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Email content could not be displayed properly.
      </div>
    );
  };

  const handleReplySubmit = async (event) => {
    event.preventDefault();
    if (!replyRecipient || !replySubject || !replyBody.trim()) {
      showNotification('Please fill in recipient, subject and message body.', 'warning');
      return;
    }

    try {
      setSending(true);
      await onReply(email.thread_id || email.threadId || email.thread, replyRecipient.trim(), replySubject.trim(), replyBody.trim());
      setReplyBody('');
      setShowReplyForm(false);
    } finally {
      setSending(false);
    }
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
          await loadLifecycle(linkedApplicationId);
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
      const resp = await sendMessageToBackground({ type: 'REPAIR_APPLICATION_LINKS', applicationId: email.applicationId });
      if (resp?.success) {
        await loadLifecycle(email.applicationId);
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
        showNotification('Application closed.', 'success');
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

  const statusClassName = STATUS_CLASSES[displayStatusKey] || STATUS_CLASSES.applied;

  if (showReplyForm) {
    return (
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-xs text-muted-foreground">Replying to</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{email.subject}</p>
          <p className="mt-1 text-sm text-muted-foreground">{email.from}</p>
        </div>

        <form onSubmit={handleReplySubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="email"
              value={replyRecipient}
              onChange={(event) => setReplyRecipient(event.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
              placeholder="Recipient"
              required
            />
            <input
              type="text"
              value={replySubject}
              onChange={(event) => setReplySubject(event.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
              placeholder="Subject"
              required
            />
            <textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              rows={8}
              className="w-full resize-none rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
              placeholder="Write your reply..."
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowReplyForm(false)}
              className="text-sm text-muted-foreground transition hover:text-foreground"
              type="button"
            >
              Cancel
            </button>
            <InlineButton className="px-4 py-2 text-sm" disabled={sending || loadingEmails} type="submit">
              <Send className="h-4 w-4" />
              {sending || loadingEmails ? 'Sending...' : 'Send Reply'}
            </InlineButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .email-content-html, .email-content-text {
              line-height: 1.6;
              word-break: break-word;
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
              color: #2e9e8f;
              text-decoration: none;
            }
          `,
        }}
      />

      <div className="space-y-4 px-4 py-4">
        <div>
          <h2
            className={cn(
              'text-[28px] font-semibold leading-tight',
              shouldDisplayClosed ? 'text-muted-foreground line-through' : 'text-foreground'
            )}
          >
            {email.subject}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{email.from}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className={statusClassName}>
              {displayStatusKey === 'interviewed' ? 'Interview' : getCategoryTitle(displayStatusKey)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {[email.company_name, email.position].filter(Boolean).join(' · ') || 'Application details pending'}
            </span>
          </div>
        </div>

        {threadArr.length > 1 && (
          <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
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

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
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

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-accent" />
              Application Journey
            </h3>
            <span className="text-[10px] text-accent">
              {loadingLifecycle ? 'Loading...' : `${journeyData.stages.length} event${journeyData.stages.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {journeyData.stages.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No journey yet. Refresh to link this email to an application.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {journeyData.stages.map((stage, idx) => {
                const stageKey = (stage.category || '').toString().toLowerCase();
                const stageClassName = STATUS_CLASSES[stageKey] || STATUS_CLASSES.applied;

                return (
                  <div key={stage.emailId || `${stage.category}-${idx}`} className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={stageClassName}>{getCategoryTitle(stageKey)}</span>
                          <p className="mt-1 text-[11px] text-muted-foreground">{getJourneyDescription(stage.category)}</p>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatShortDate(stage.date)}</span>
                      </div>
                      {stage.subject ? (
                        <p className="mt-1 break-words text-[11px] text-foreground/80">{stage.subject}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {journeyData.source === 'fallback' && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    Showing local stages. Full journey appears after this email is linked across categories.
                  </p>
                  <InlineButton variant="outline" onClick={handleLinkAcrossCategories} disabled={loadingLifecycle}>
                    Link across categories
                  </InlineButton>
                </div>
              )}

              {showRepairJourney && (
                <InlineButton variant="outline" onClick={handleRepairApplicationLinks} disabled={loadingLifecycle}>
                  Repair journey
                </InlineButton>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <InlineButton onClick={() => setShowReplyForm(true)} disabled={sending || loadingEmails}>
            <Reply className="h-3.5 w-3.5" />
            Reply
          </InlineButton>

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
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
            <div>No activity for {staleDays} days. If you heard back off-email, you can close this role.</div>
            <InlineButton variant="outline" className="border-warning/30 bg-card/80" onClick={() => openClosePanel('stale')}>
              Close
            </InlineButton>
          </div>
        )}

        {showClosePanel && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Close application</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  This does not delete anything. It marks the role as closed.
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
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
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
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
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

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{threadArr.length} message{threadArr.length === 1 ? '' : 's'}</span>
            </div>
            <span>{formatLongDate(email.date)}</span>
          </div>

          <div className="space-y-4">
            {threadArr.map((message, idx) => (
              <div key={message.id || `${message.thread_id || message.threadId || 'msg'}-${idx}`} id={`msg-${idx}`} className="space-y-2">
                {idx > 0 && (
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    Older message
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span className="truncate">{message.from || 'Unknown sender'}</span>
                  <span className="shrink-0">{formatLongDate(message.date)}</span>
                </div>
                {renderSingleMessage(message)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

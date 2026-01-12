 /**
  * Enhanced EmailPreview Component with Gmail-like email display
  */
import React, { useMemo, useState, useEffect } from 'react';
import { Building2, Briefcase, Calendar, Clock, ExternalLink, Reply, Flag, X, Pencil, Check, TrendingUp } from "lucide-react";
import { cn } from '../utils/cn';
import { parseEmailDate } from '../utils/uiHelpers';
import { showNotification } from './Notification';
import { sendMessageToBackground } from '../utils/chromeMessaging';
import CompanyField from './CompanyField';

// Enhanced email content utilities (embedded in this file)
const decodeEmailContent = (content) => {
  if (!content || typeof content !== 'string') return '';
  
  let decoded = content;
  
  // Handle double-encoded JSON strings
  try {
    if (decoded.startsWith('"') && decoded.endsWith('"')) {
      decoded = JSON.parse(decoded);
    }
  } catch (e) {
    // Not JSON, continue
  }
  
  // Create temporary element to decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = decoded;
  decoded = textarea.value;
  
  // Fix common encoding issues
  decoded = decoded
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€"/g, '–')
    .replace(/â€"/g, '—')
    .replace(/Â/g, '')
    .replace(/â€¦/g, '...')
    .replace(/â€¢/g, '•')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return decoded;
};

// Safer decoder/sanitizer used by rendering code (keeps source ASCII-only and avoids leaking mojibake/control chars).
const decodeEmailContentSafe = (content) => {
  if (!content || typeof content !== 'string') return '';

  let decoded = content;

  // Handle double-encoded JSON strings
  try {
    if (decoded.startsWith('"') && decoded.endsWith('"')) {
      decoded = JSON.parse(decoded);
    }
  } catch (_) {
    // ignore
  }

  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = decoded;
  decoded = textarea.value;

  // Fix common mojibake sequences (UTF-8 decoded as Windows-1252).
  decoded = decoded
    .replace(/\u00e2\u20ac\u2122/g, "'") // â€™
    .replace(/\u00e2\u20ac\u0153/g, '"') // â€œ
    .replace(/\u00e2\u20ac\u009c/g, '"') // â€œ (variant)
    .replace(/\u00e2\u20ac\u009d/g, '"') // â€ (variant)
    .replace(/\u00e2\u20ac\u201c/g, '-') // â€“
    .replace(/\u00e2\u20ac\u201d/g, '-') // â€—
    .replace(/\u00e2\u20ac\u00a6/g, '...') // â€¦
    .replace(/\u00e2\u20ac\u00a2/g, '*') // â€¢
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Strip control chars (keep \t \n \r).
  decoded = decoded.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  return decoded;
};

const stripHtmlToText = (html) => {
  if (!html || typeof html !== 'string') return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style,script,noscript,head,meta,link,title,base').forEach((el) => el.remove());
    const text = doc.body?.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  } catch (_) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
};

const looksLikeHtml = (text) => {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (!t.includes('<') || !t.includes('>')) return false;
  if (/<\s*(html|body|div|p|span|table|style|script|head|meta|link|br|hr|a|img)\b/i.test(t)) return true;
  if (/<\/\s*[a-z][a-z0-9]*\s*>/i.test(t)) return true;
  return false;
};

const isSafeLinkUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('#')) return true;
  try {
    const parsed = new URL(trimmed, 'https://example.invalid');
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

  const SAFE_TAGS = new Set([
    'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead',
    'tr', 'u', 'ul'
  ]);

  const SAFE_ATTRS = new Set(['href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'aria-label', 'aria-hidden']);
  const DROP_TAGS = new Set([
    // Never render these; unwrapping would leak CSS/JS text into the UI.
    'style',
    'script',
    'noscript',
    // Metadata/containers that commonly carry CSS/JS and aren't useful in the popup renderer.
    'head',
    'meta',
    'link',
    'title',
    'base',
  ]);

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

      if (DROP_TAGS.has(tag)) {
        el.remove();
        return;
      }

      if (!SAFE_TAGS.has(tag)) {
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
        const value = attr.value;

        if (name.startsWith('on') || name === 'srcset' || name === 'nonce') {
          el.removeAttribute(attr.name);
          continue;
        }

        if (!SAFE_ATTRS.has(name)) {
          el.removeAttribute(attr.name);
          continue;
        }

        if (tag === 'a' && name === 'href' && !isSafeLinkUrl(value)) {
          el.removeAttribute(attr.name);
          continue;
        }

        if (tag === 'img' && name === 'src' && !isSafeImageUrl(value)) {
          el.removeAttribute(attr.name);
          continue;
        }
      }

      if (tag === 'a') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      if (tag === 'img') {
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'no-referrer');
      }
    }

    for (const child of Array.from(node.childNodes)) {
      sanitizeNode(child);
    }
  };

  sanitizeNode(template.content);
  return template.innerHTML;
};

// Enhanced HTML sanitization and styling for Gmail-like display
const sanitizeAndStyleEmailHTML = (html) => {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizeUntrustedEmailHtml(html);
  
  // Remove tracking pixels and tiny images
  const trackingImages = tempDiv.querySelectorAll('img[width="1"], img[height="1"], img[src*="tracking"], img[src*="pixel"]');
  trackingImages.forEach(img => img.remove());
  
  // Style all text elements
  const textElements = tempDiv.querySelectorAll('p, div, span, td, th');
  textElements.forEach(el => {
    if (!el.style.fontSize) el.style.fontSize = '14px';
    if (!el.style.lineHeight) el.style.lineHeight = '1.6';
    el.style.wordWrap = 'break-word';
  });
  
  // Style headings
  const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach(heading => {
    heading.style.cssText += `
      margin: 16px 0 8px 0;
      font-weight: 600;
    `;
  });
  
  // Style links
  const links = tempDiv.querySelectorAll('a');
  links.forEach(link => {
    link.style.cssText += `
      color: #1a73e8;
      text-decoration: none;
    `;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  
  // Style images
  const images = tempDiv.querySelectorAll('img');
  images.forEach(img => {
    img.style.cssText += `
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 8px 0;
      display: block;
    `;
    
    // Hide broken images
    img.onerror = () => {
      img.style.display = 'none';
    };
  });
  
  // Style tables (common in email layouts)
  const tables = tempDiv.querySelectorAll('table');
  tables.forEach(table => {
    table.style.cssText += `
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    `;
  });
  
  const tableCells = tempDiv.querySelectorAll('td, th');
  tableCells.forEach(cell => {
    cell.style.cssText += `
      padding: 8px;
      vertical-align: top;
    `;
  });
  
  // Style lists
  const lists = tempDiv.querySelectorAll('ul, ol');
  lists.forEach(list => {
    list.style.cssText += `
      margin: 8px 0;
      padding-left: 20px;
    `;
  });
  
  // Remove or fix problematic CSS
  const styledElements = tempDiv.querySelectorAll('[style]');
  styledElements.forEach(el => {
    if (el.style.position === 'absolute' || el.style.position === 'fixed') {
      el.style.position = 'relative';
    }
    if (el.style.zIndex) {
      el.style.zIndex = 'auto';
    }
  });
  
  return tempDiv.innerHTML;
};

// Enhanced plain text formatting
const formatPlainTextEmail = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  let formatted = text;
  
  // Remove reply chains and signatures
  formatted = formatted
    .replace(/On\s+.+?\s+at\s+.+?,\s+.+?\s+wrote:\s*/gi, '\n--- Previous Message ---\n')
    .replace(/^-+\s*Original Message\s*-+$/gim, '\n--- Original Message ---\n')
    .replace(/^--\s*$/gm, '\n--- Signature ---\n');
  
  // Format URLs as clickable links
  formatted = formatted.replace(
    /(https?:\/\/[^\s]+)/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: none;">$1</a>'
  );

  // Sanitize the generated HTML (defense-in-depth)
  formatted = sanitizeUntrustedEmailHtml(formatted);
  
  // Format email addresses
  formatted = formatted.replace(
    /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
    '<a href="mailto:$1" style="color: #1a73e8; text-decoration: none;">$1</a>'
  );
  
  // Convert line breaks to proper HTML
  formatted = formatted.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  
  // Wrap in paragraphs
  formatted = `<p>${formatted}</p>`;
  
  // Clean up empty paragraphs
  formatted = formatted.replace(/<p><\/p>/g, '').replace(/<p>\s*<\/p>/g, '');
  
  return formatted;
};

const cleanPlainTextEmail = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  let cleaned = text;

  // Remove common email-client CSS "noise" that sometimes gets stored as plain text
  // (e.g., Outlook/WordHTML: ReadMsgBody, .ExternalClass, @media blocks).
  // This is a heuristic to improve readability; it only targets CSS-shaped sections.
  const removeCssNoise = (input) => {
    const normalized = input.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    const out = [];
    let inCss = false;
    let braceDepth = 0;

    const isCssStartLine = (line) => {
      const l = line.trim();
      if (!l) return false;
      if (/^(ReadMsgBody|\.ExternalClass)\b/i.test(l)) return true;
      if (/^@media\b/i.test(l)) return true;
      // Typical CSS selector line (e.g., ".foo {", "table td {", "body {")
      if (l.includes('{') && /(^[.#]|^(body|html|table|td|th|p|div|span|img)\b)/i.test(l)) return true;
      return false;
    };

    const looksLikeCssPropertyLine = (line) => {
      const l = line.trim();
      if (!l) return false;
      // property: value;  OR includes !important
      if (l.includes('!important')) return true;
      return /^[a-z-]+\s*:\s*[^;]+;?$/i.test(l);
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (!inCss && isCssStartLine(trimmed)) {
        inCss = true;
      }

      if (inCss) {
        // Track braces to detect end of CSS blocks.
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;

        // Skip CSS lines while inside a CSS-shaped section.
        if (looksLikeCssPropertyLine(trimmed) || trimmed.includes('{') || trimmed.includes('}') || isCssStartLine(trimmed)) {
          if (braceDepth <= 0 && !trimmed.includes('{') && !trimmed.includes('}')) {
            inCss = false;
            braceDepth = 0;
          }
          continue;
        }

        // If we hit a non-CSS looking line and we're not inside braces, exit CSS mode and keep the line.
        if (braceDepth <= 0) {
          inCss = false;
          braceDepth = 0;
          if (trimmed) out.push(line);
          continue;
        }

        continue;
      }

      out.push(line);
    }

    return out.join('\n');
  };

  cleaned = removeCssNoise(cleaned);
  
  cleaned = cleaned
    .replace(/On\s+.+?\s+at\s+.+?,\s+.+?\s+wrote:\s*/gi, '')
    .replace(/^-+\s*Forwarded message\s*-+$/gim, '')
    .replace(/^-+\s*Original Message\s*-+$/gim, '')
    .replace(/^--\s*$/gm, '<!-- SIGNATURE_START -->')
    .replace(/<!-- SIGNATURE_START -->[\s\S]*$/m, '')
    .replace(/https?:\/\/tracking\..+$/gim, '')
    .replace(/if you don't want to receive.+?unsubscribe.+$/gis, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/[ \t]+/g, ' ');
  
  return cleaned;
};

// UI Components
const Card = ({ children, className }) => (
  <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
    {children}
  </div>
);

const CardContent = ({ children, className }) => (
  <div className={cn("p-4", className)}>{children}</div>
);

const Button = ({ children, onClick, className, variant = 'default', size = 'default', disabled = false }) => {
  const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  };

  return (
    <button onClick={onClick} className={cn(baseClasses, variants[variant], sizes[size], className)} disabled={disabled}>
      {children}
    </button>
  );
};

const Badge = ({ children, className, variant = 'default' }) => {
  const baseClasses = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground",
  };
  return (
    <span className={cn(baseClasses, variants[variant], className)}>
      {children}
    </span>
  );
};

const Dialog = ({ children, isOpen, onOpenChange }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-800 rounded-lg shadow-lg animate-in fade-in-90 zoom-in-90">
        {children}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
    </div>
  );
};

const DialogContent = ({ children, className }) => (
  <div className={cn("p-6", className)}>{children}</div>
);

const DialogHeader = ({ children, className }) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left p-6 pr-16 border-b border-gray-200 dark:border-zinc-700", className)}>
    {children}
  </div>
);

const DialogTitle = ({ children, className }) => (
  <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h3>
);

// Main EmailPreview Component
export default function EmailPreview({ email, onBack, onReply, onArchive, onOpenMisclassificationModal, userPlan, openPremiumModal, loadingEmails, onUpdateCompanyName, onUpdatePosition, userEmail }) {
  if (!email) {
    return null;
  }

  const threadArr = Array.isArray(email.threadMessages) && email.threadMessages.length > 0
    ? email.threadMessages
    : [email];

  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    setActiveIdx(0);
  }, [email?.thread_id, email?.id]);

  const scrollToIdx = (i) => {
    const el = document.getElementById(`msg-${i}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveIdx(i);
    }
  };

  const getCategoryColor = (category) => {
    // Normalize to lowercase to handle both "Applied" and "applied"
    const normalizedCategory = category?.toLowerCase();
    const colors = {
      applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      interviewed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      offers: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      irrelevant: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
    };
    return colors[normalizedCategory] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = parseEmailDate(dateStr) || new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render a single email message body (html or plain)
  const renderSingleMessage = (msg) => {
    if (msg?.html_body) {
      const decodedHTML = decodeEmailContentSafe(msg.html_body);
      const styledHTML = sanitizeAndStyleEmailHTML(decodedHTML);
      if (styledHTML && styledHTML.trim()) {
        return (
          <div
            className="email-content-html bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontSize: '14px',
              lineHeight: '1.6',
              minHeight: '120px',
              overflow: 'hidden',
              wordWrap: 'break-word'
            }}
            dangerouslySetInnerHTML={{ __html: styledHTML }}
          />
        );
      }
    }
    if (msg?.body) {
      let decodedText = decodeEmailContentSafe(msg.body);

      // Some stored emails may have HTML in `body` instead of `html_body` (legacy ingestion).
      // Strip style/script and tags so users never see raw CSS/HTML in the viewer.
      if (looksLikeHtml(decodedText)) {
        decodedText = stripHtmlToText(decodedText);
      }

      const cleanedText = cleanPlainTextEmail(decodedText);
      const formattedText = formatPlainTextEmail(cleanedText);
      if (formattedText && formattedText.trim()) {
        return (
          <div
            className="email-content-text bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-5 shadow-sm text-gray-700 dark:text-zinc-300"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontSize: '14px',
              lineHeight: '1.6',
              minHeight: '120px',
              wordWrap: 'break-word'
            }}
            dangerouslySetInnerHTML={{ __html: formattedText }}
          />
        );
      }
    }
    return (
      <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-6 text-center text-gray-500 dark:text-zinc-400 italic">
        Email content could not be displayed properly.
      </div>
    );
  };

  // Render conversation with clear separators
  const getEmailBodyContent = () => {
    const thread = Array.isArray(email.threadMessages) && email.threadMessages.length > 0
      ? email.threadMessages
      : [email];

    return (
      <div className="space-y-6">
        {thread.map((msg, idx) => (
          <div key={msg.id || `${msg.thread_id || msg.threadId || 'msg'}-${idx}`} className="relative" id={`msg-${idx}`}>
            {idx > 0 && (
              <div className="flex items-center my-2 text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 select-none">
                <div className="flex-1 border-t border-dashed border-gray-300 dark:border-zinc-700"></div>
                <span className="mx-2">Older message</span>
                <div className="flex-1 border-t border-dashed border-gray-300 dark:border-zinc-700"></div>
              </div>
            )}
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 border border-gray-200 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-2 text-xs text-gray-600 dark:text-zinc-400">
                <div className="truncate">
                  <span className="font-medium">From:</span> {msg.from || 'Unknown'}
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(msg.date)}</span>
                </div>
              </div>
              {renderSingleMessage(msg)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Reply form state
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyRecipient, setReplyRecipient] = useState(() => {
    // Use the 'from' of the most recent message (index 0 in sorted thread)
    const first = threadArr[0];
    if (first?.from) {
      // Extract email inside angle brackets if present
      const match = first.from.match(/<([^>]+)>/);
      return match ? match[1] : first.from;
    }
    return '';
  });
  const [replySubject, setReplySubject] = useState(() => {
    const subj = email.subject || '';
    return subj.toLowerCase().startsWith('re:') ? subj : `Re: ${subj}`;
  });
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  // Lifecycle tracking state
  const [lifecycle, setLifecycle] = useState(null);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);

  // Manual application closure state
  const [closingApplication, setClosingApplication] = useState(false);
  const [reopeningApplication, setReopeningApplication] = useState(false);
  const [showClosePanel, setShowClosePanel] = useState(false);
  const [closePreset, setClosePreset] = useState('no_response');
  const [closeNote, setCloseNote] = useState('');

  // Fetch lifecycle when email with applicationId is opened
  useEffect(() => {
    if (email?.applicationId) {
      setLoadingLifecycle(true);
      chrome.runtime.sendMessage(
        {
          type: 'FETCH_APPLICATION_LIFECYCLE',
          applicationId: email.applicationId
        },
        (response) => {
          setLoadingLifecycle(false);
          if (response?.success && response?.lifecycle) {
            setLifecycle(response.lifecycle);
          } else {
            setLifecycle(null);
          }
        }
      );
    } else {
      setLifecycle(null);
    }
  }, [email?.applicationId]);

  const journeyData = useMemo(() => {
    const normalizeCategory = (c) => (c || '').toString().trim().toLowerCase();
    const isRelevant = (c) => ['applied', 'interviewed', 'offers', 'rejected'].includes(normalizeCategory(c));

    const fromLifecycle = Array.isArray(lifecycle) ? lifecycle : [];
    if (fromLifecycle.length > 0) {
      return { stages: fromLifecycle, source: 'application' };
    }

    // Fallback: show a minimal journey using the current thread messages we have locally.
    // This ensures "Applied" always has at least 1 visible stage even before application linking completes.
    const localStages = (threadArr || [])
      .filter((m) => isRelevant(m?.category))
      .map((m) => ({
        emailId: m.id || m.emailId || `${m.thread_id || m.threadId || 'msg'}-${m.date || ''}`,
        subject: m.subject || '',
        category: normalizeCategory(m.category),
        date: m.date
      }));

    // If nothing is categorized on the message objects, still show the current email's stage if relevant.
    const emailCategory = normalizeCategory(email?.category);
    if (localStages.length === 0 && isRelevant(emailCategory)) {
      localStages.push({
        emailId: email.id || email.emailId || `${email.thread_id || email.threadId || 'email'}-${email.date || ''}`,
        subject: email.subject || '',
        category: emailCategory,
        date: email.date
      });
    }

    // Sort oldest -> newest for a "journey" feel.
    localStages.sort((a, b) => {
      const aTime = (parseEmailDate(a.date) || new Date(a.date)).getTime();
      const bTime = (parseEmailDate(b.date) || new Date(b.date)).getTime();
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    });

    // De-dupe by emailId to avoid duplicates when threadArr contains the same message twice.
    const seen = new Set();
    const deduped = localStages.filter((s) => {
      if (!s.emailId) return false;
      if (seen.has(s.emailId)) return false;
      seen.add(s.emailId);
      return true;
    });

    return { stages: deduped, source: 'fallback' };
  }, [email, lifecycle, threadArr]);

  const showRepairJourney = useMemo(() => {
    if (journeyData?.source !== 'application') return false;
    if (!email?.applicationId) return false;
    const stages = Array.isArray(journeyData?.stages) ? journeyData.stages : [];
    const appliedCount = stages.filter((s) => (s?.category || '').toString().toLowerCase() === 'applied').length;
    return appliedCount > 1 || stages.length >= 8;
  }, [journeyData, email?.applicationId]);

  const handleLinkAcrossCategories = async () => {
    if (!email?.id) {
      showNotification('Cannot link: missing email id', 'error');
      return;
    }
    try {
      setLoadingLifecycle(true);
      const resp = await sendMessageToBackground({ type: 'LINK_APPLICATION_ROLE', emailId: email.id });
      if (resp?.success) {
        showNotification('Linking complete. Refreshing...', 'success');
      } else {
        showNotification(resp?.error || 'Failed to link across categories', 'error');
      }
    } catch (e) {
      showNotification(e?.message || 'Failed to link across categories', 'error');
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
        showNotification('Repair complete. Refreshing...', 'success');
      } else {
        showNotification(resp?.error || 'Failed to repair application links', 'error');
      }
    } catch (e) {
      showNotification(e?.message || 'Failed to repair application links', 'error');
    } finally {
      setLoadingLifecycle(false);
    }
  };

  const formatJourneyDate = (dateStr) => {
    const d = parseEmailDate(dateStr) || new Date(dateStr);
    if (!dateStr || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getJourneyDescription = (category) => {
    const c = (category || '').toString().toLowerCase();
    if (c === 'applied') return 'Application email received';
    if (c === 'interviewed') return 'Interview email received';
    if (c === 'offers') return 'Offer email received';
    if (c === 'rejected') return 'Rejection email received';
    return 'Status update email received';
  };

  const lastActivityDate = useMemo(() => {
    const candidates = [];
    if (email?.date) candidates.push(parseEmailDate(email.date) || new Date(email.date));

    for (const m of threadArr || []) {
      if (!m?.date) continue;
      const d = parseEmailDate(m.date) || new Date(m.date);
      if (!Number.isNaN(d.getTime())) candidates.push(d);
    }

    for (const s of journeyData?.stages || []) {
      if (!s?.date) continue;
      const d = parseEmailDate(s.date) || new Date(s.date);
      if (!Number.isNaN(d.getTime())) candidates.push(d);
    }

    if (candidates.length === 0) return null;
    return new Date(Math.max(...candidates.map((d) => d.getTime())));
  }, [email?.date, threadArr, journeyData?.stages]);

  const staleDays = useMemo(() => {
    if (!lastActivityDate) return null;
    const ms = Date.now() - lastActivityDate.getTime();
    if (ms < 0) return 0;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }, [lastActivityDate]);

  const openClosePanel = (source = 'manual') => {
    if (!email?.applicationId) {
      showNotification('This email is not linked to an application yet.', 'info');
      return;
    }
    if (email?.isClosed && !email?.isUserClosed) {
      showNotification('This application is closed by outcome and cannot be manually closed.', 'info');
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
      other: 'Other'
    };

    const parts = [];
    const presetLabel = presetToLabel[closePreset] || 'Other';
    if (presetLabel) parts.push(presetLabel);
    const note = (closeNote || '').toString().trim();
    if (note) parts.push(note);
    const reason = parts.join(' - ').trim();

    try {
      setClosingApplication(true);
      const resp = await sendMessageToBackground({
        type: 'CLOSE_APPLICATION',
        applicationId: email.applicationId,
        emailId: email.id,
        reason
      });
      if (resp?.success) {
        setShowClosePanel(false);
        showNotification('Application closed.', 'success');
      } else {
        showNotification(resp?.error || 'Failed to close application', 'error');
      }
    } catch (e) {
      showNotification(e?.message || 'Failed to close application', 'error');
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
        emailId: email.id
      });
      if (resp?.success) {
        showNotification('Application reopened.', 'success');
      } else {
        showNotification(resp?.error || 'Failed to reopen application', 'error');
      }
    } catch (e) {
      showNotification(e?.message || 'Failed to reopen application', 'error');
    } finally {
      setReopeningApplication(false);
    }
  };

  const toggleReplyForm = () => {
    setShowReplyForm(v => !v);
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyRecipient || !replySubject || !replyBody.trim()) {
      showNotification('Please fill in recipient, subject and message body.', 'warning');
      return;
    }
    try {
      setSending(true);
      await onReply(email.thread_id || email.threadId || email.thread, replyRecipient.trim(), replySubject.trim(), replyBody.trim());
      setReplyBody('');
      setShowReplyForm(false);
    } catch (err) {
      // onReply handles its own notifications
    } finally {
      setSending(false);
    }
  };

  // NOTE: Archive/star UI actions are intentionally hidden for launch until fully wired.

  const handleOpenGmail = () => {
    if (email.gmail_link) {
      window.open(email.gmail_link, '_blank');
    } else {
      showNotification("Gmail link not available for this email.", "warning");
    }
  };

  const handleMisclassifyClick = () => {
    onOpenMisclassificationModal(email);
  };

  return (
    <>
      {/* Email display styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .email-content-html img {
          max-width: 100% !important;
          height: auto !important;
        }
        .email-content-html table {
          width: 100% !important;
          max-width: 100% !important;
        }
        .email-content-html * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .email-content-html a:hover {
          border-bottom: 1px solid #1a73e8 !important;
        }
      ` }} />
      
      <Dialog isOpen={!!email} onOpenChange={onBack}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate pr-2">{email.subject}</span>
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", getCategoryColor(email.category))}>
              {email.category}
            </span>
          </DialogTitle>
        </DialogHeader>

        <DialogContent className="space-y-4">
          {/* Thread Navigator (sticky) */}
          {threadArr.length > 1 && (
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-800/80 backdrop-blur px-2 py-2 rounded-md border border-gray-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="text-xs text-gray-600 dark:text-zinc-400">
                {threadArr.length} messages • Newest at top
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => scrollToIdx(Math.max(0, activeIdx - 1))}>Prev</Button>
                <Button variant="outline" size="sm" onClick={() => scrollToIdx(Math.min(threadArr.length - 1, activeIdx + 1))}>Next</Button>
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  {threadArr.map((_, i) => (
                    <button
                      key={i}
                      title={`Jump to message ${i + 1}`}
                      className={`h-2.5 w-2.5 rounded-full ${i === activeIdx ? 'bg-blue-500' : 'bg-gray-300 dark:bg-zinc-600'} hover:bg-blue-400 dark:hover:bg-blue-500`}
                      onClick={() => scrollToIdx(i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Email Header Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-zinc-400">
              <div className="flex items-center space-x-1">
                <span className="font-medium">From:</span>
                <span>{email.from}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{formatDate(email.date)}</span>
              </div>
            </div>
          </div>

          {/* Job Details - Editable Company and Position */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Company Field */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">Company</span>
                </div>
                {onUpdateCompanyName ? (
                  <CompanyField 
                    email={email} 
                    userEmail={userEmail}
                    onUpdate={onUpdateCompanyName}
                  />
                ) : (
                  <div className="text-sm text-gray-900 dark:text-white">
                    {email.company_name || 'Not extracted'}
                  </div>
                )}
              </div>

              {/* Position Field */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">Position</span>
                </div>
                {onUpdatePosition ? (
                  <CompanyField 
                    email={email} 
                    userEmail={userEmail}
                    onUpdate={onUpdatePosition}
                    fieldName="position"
                  />
                ) : (
                  <div className="text-sm text-gray-900 dark:text-white">
                    {email.position || 'Not extracted'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="flex items-center space-x-1" onClick={toggleReplyForm} disabled={sending || loadingEmails}>
              <Reply className="h-4 w-4" />
              <span>{showReplyForm ? 'Close Reply' : 'Reply'}</span>
            </Button>

            {email?.applicationId && email?.isUserClosed && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center space-x-1"
                onClick={handleReopenApplication}
                disabled={reopeningApplication}
                title="Reopen this application"
              >
                <TrendingUp className="h-4 w-4" />
                <span>{reopeningApplication ? 'Reopening...' : 'Reopen'}</span>
              </Button>
            )}

            {email?.applicationId && !email?.isClosed && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center space-x-1"
                onClick={() => openClosePanel('manual')}
                disabled={closingApplication || showClosePanel}
                title="Close this application"
              >
                <X className="h-4 w-4" />
                <span>{closingApplication ? 'Closing...' : 'Close'}</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="flex items-center space-x-1" onClick={handleMisclassifyClick}>
              <Flag className="h-4 w-4" />
              <span>Misclassify</span>
            </Button>
            <Button variant="outline" size="sm" className="flex items-center space-x-1" onClick={handleOpenGmail}>
              <ExternalLink className="h-4 w-4" />
              <span>Open in Gmail</span>
            </Button>
          </div>

          {email?.applicationId && !email?.isClosed && typeof staleDays === 'number' && staleDays >= 60 && (
            <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                No activity for {staleDays} days. If you heard back off-email, you can close this role.
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
                onClick={() => openClosePanel('stale')}
                disabled={closingApplication || showClosePanel}
              >
                Close
              </Button>
            </div>
          )}

          {showClosePanel && (
            <div className="mt-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Close application</div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-zinc-400">
                    This doesn’t delete anything. It marks the role as closed (useful for phone rejections or long silence).
                  </div>
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                  onClick={() => setShowClosePanel(false)}
                  aria-label="Cancel closing"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Reason</label>
                  <select
                    value={closePreset}
                    onChange={(e) => setClosePreset(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={closingApplication}
                  >
                    <option value="no_response">No response</option>
                    <option value="rejected_verbal">Rejected verbally</option>
                    <option value="withdrew">Withdrew</option>
                    <option value="accepted_elsewhere">Accepted elsewhere</option>
                    <option value="position_filled">Position filled</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="Add context (optional)"
                    className="w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={closingApplication}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClosePanel(false)}
                  disabled={closingApplication}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-gray-900 hover:bg-black text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900"
                  onClick={confirmCloseApplication}
                  disabled={closingApplication}
                >
                  {closingApplication ? 'Closing...' : 'Confirm close'}
                </Button>
              </div>
            </div>
          )}

          {/* Reply Form */}
          {showReplyForm && (
            <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-zinc-700/40 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Reply className="h-4 w-4" />
                Compose Reply
              </h4>
              <form onSubmit={handleReplySubmit} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-zinc-400">To</label>
                  <input
                    type="email"
                    value={replyRecipient}
                    onChange={(e) => setReplyRecipient(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-zinc-400">Subject</label>
                  <input
                    type="text"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-zinc-400">Message</label>
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={5}
                    placeholder="Write your reply..."
                    className="w-full resize-y rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={sending || loadingEmails}
                  >
                    {sending || loadingEmails ? 'Sending...' : 'Send Reply'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowReplyForm(false)} disabled={sending}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {/* Application Journey (always visible; shows empty/fallback if not linked yet) */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Application Journey
              </h4>
              <div className="text-xs text-purple-700 dark:text-purple-300">
                {loadingLifecycle ? 'Loading…' : `${journeyData.stages.length} event${journeyData.stages.length === 1 ? '' : 's'}`}
              </div>
            </div>

            {journeyData.stages.length === 0 ? (
              <div className="text-xs text-purple-800/80 dark:text-purple-200/80">
                No journey yet. Refresh to link this email to an application.
              </div>
            ) : (
              <div className="space-y-3">
                {journeyData.stages.map((stage, idx) => (
                  <div key={stage.emailId || `${stage.category}-${idx}`} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full mt-1",
                        stage.category === 'applied' && "bg-blue-500",
                        stage.category === 'interviewed' && "bg-yellow-500",
                        stage.category === 'offers' && "bg-green-500",
                        stage.category === 'rejected' && "bg-red-500",
                        !['applied','interviewed','offers','rejected'].includes(stage.category) && "bg-purple-500"
                      )}></div>
                      {idx < journeyData.stages.length - 1 && (
                        <div className="w-0.5 flex-1 bg-purple-200 dark:bg-purple-700 min-h-6"></div>
                      )}
                    </div>

                    <div className="flex-1 pb-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <span className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                              stage.category === 'applied' && "bg-blue-100 text-blue-800",
                              stage.category === 'interviewed' && "bg-yellow-100 text-yellow-800",
                              stage.category === 'offers' && "bg-green-100 text-green-800",
                            stage.category === 'rejected' && "bg-red-100 text-red-800",
                            !['applied','interviewed','offers','rejected'].includes(stage.category) && "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                            )}>
                              {stage.category}
                            </span>
                            <span className="text-xs text-purple-900/70 dark:text-purple-200/70 truncate min-w-0">
                              {getJourneyDescription(stage.category)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {formatJourneyDate(stage.date)}
                          </div>
                        </div>

                        {stage.subject ? (
                          <div
                            className="mt-1 text-xs text-gray-700 dark:text-zinc-300 break-words whitespace-normal"
                            title={stage.subject}
                          >
                            {stage.subject}
                          </div>
                        ) : null}
                    </div>
                  </div>
                ))}

                {journeyData.source === 'fallback' && (
                  <div className="pt-1 space-y-2">
                    <div className="text-[10px] text-purple-900/60 dark:text-purple-200/60">
                      Showing local stages. Full journey appears after this email is linked across categories.
                    </div>
                    <button
                      type="button"
                      onClick={handleLinkAcrossCategories}
                      disabled={loadingLifecycle}
                      className={cn(
                        "text-xs font-medium px-3 py-1.5 rounded-md border",
                        "border-purple-200 dark:border-purple-800 bg-white/70 dark:bg-zinc-900/20",
                        "text-purple-800 dark:text-purple-200 hover:bg-white dark:hover:bg-zinc-900/30",
                        "disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                    >
                      Link across categories
                    </button>
                  </div>
                )}

                {showRepairJourney && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleRepairApplicationLinks}
                      disabled={loadingLifecycle}
                      className={cn(
                        "text-xs font-medium px-3 py-1.5 rounded-md border",
                        "border-purple-200 dark:border-purple-800 bg-white/70 dark:bg-zinc-900/20",
                        "text-purple-800 dark:text-purple-200 hover:bg-white dark:hover:bg-zinc-900/30",
                        "disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                      title="If unrelated emails appear in this journey, this will unlink and rebuild links for the application."
                    >
                      Repair journey
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gmail-Style Email Content */}
          <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-2">
              {getEmailBodyContent()}
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}

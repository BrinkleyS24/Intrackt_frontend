/**
 * Enhanced EmailPreview Component with Gmail-like email display
 */
import React, { useState, useEffect } from 'react';
import { Building2, Calendar, Clock, ExternalLink, Reply, Archive, Flag, Crown, X } from "lucide-react";
import { cn } from '../utils/cn';
import { showNotification } from './Notification';

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

// Enhanced HTML sanitization and styling for Gmail-like display
const sanitizeAndStyleEmailHTML = (html) => {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove dangerous elements
  const dangerousElements = tempDiv.querySelectorAll('script, object, embed, form, input, textarea, select, iframe');
  dangerousElements.forEach(el => el.remove());
  
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
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left p-6 border-b border-gray-200 dark:border-zinc-700", className)}>
    {children}
  </div>
);

const DialogTitle = ({ children, className }) => (
  <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h3>
);

// Main EmailPreview Component
export default function EmailPreview({ email, onBack, onReply, onArchive, onOpenMisclassificationModal, userPlan, openPremiumModal }) {
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
    const colors = {
      applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      interviewed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      offers: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      irrelevant: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
    };
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
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
      const decodedHTML = decodeEmailContent(msg.html_body);
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
      const decodedText = decodeEmailContent(msg.body);
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

  const handleReplyClick = () => {
    showNotification("Reply feature coming soon!", "info");
    console.log("Reply clicked for email:", email.subject);
  };

  const handleArchiveClick = async () => {
    await onArchive(email.thread_id);
    onBack();
  };

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
            <Badge className={getCategoryColor(email.category)}>
              {email.category}
            </Badge>
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

          {/* Job Details */}
          <Card className="bg-gray-50 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Company</p>
                    <p className="font-medium text-gray-900 dark:text-white">{email.company || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Position</p>
                    <p className="font-medium text-gray-900 dark:text-white">{email.position || "N/A"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="flex items-center space-x-1" onClick={handleReplyClick}>
              <Reply className="h-4 w-4" />
              <span>Reply</span>
            </Button>
            <Button variant="outline" size="sm" className="flex items-center space-x-1" onClick={handleArchiveClick}>
              <Archive className="h-4 w-4" />
              <span>Archive</span>
            </Button>
            <Button variant="outline" size="sm" className="flex items-center space-x-1" onClick={handleMisclassifyClick}>
              <Flag className="h-4 w-4" />
              <span>Misclassify</span>
            </Button>
            <Button variant="outline" size="sm" className="flex items-center space-x-1" onClick={handleOpenGmail}>
              <ExternalLink className="h-4 w-4" />
              <span>Open in Gmail</span>
            </Button>
          </div>

          {/* Gmail-Style Email Content */}
          <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-2">
              {getEmailBodyContent()}
            </div>
          </div>

          {/* Premium Feature Overlay */}
          {userPlan !== 'premium' && (email.category === 'applied' || email.category === 'interviewed' || email.category === 'offers') && (
            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-white dark:from-zinc-800 to-transparent flex flex-col items-center justify-end p-6 pointer-events-none">
              <div className="bg-white dark:bg-zinc-700 p-4 rounded-lg shadow-xl text-center z-10 pointer-events-auto">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Unlock Actions with Premium</h4>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
                  Reply, Archive, and Misclassify important emails with a Premium plan.
                </p>
                <Button
                  onClick={openPremiumModal}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg rounded-full px-6 py-3 transition-all duration-300 flex items-center justify-center"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Premium
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
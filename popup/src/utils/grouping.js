// Utility functions to group emails into conversation threads and count threads

/**
 * Enhanced email grouping that considers both thread_id and sender-subject similarity
 * to group related emails that might have different thread IDs.
 * 
 * FIX: Prevents duplicate interview counts by normalizing subject lines
 * Example: "Reminder - Q2 Software Engineer Interview" → "q2 software engineer interview"
 *          "Q2 Software Engineer Interview" → "q2 software engineer interview"
 * Both now group together instead of counting as 2 separate interviews.
 */
export function groupEmailsByThread(emails) {
  const map = new Map();
  
  // Helper function to extract company domain from email
  const getCompanyDomain = (email, emailObject = null) => {
    if (!email) return '';
    const match = email.match(/@([^>]+)/);
    if (!match) return '';
    const domain = match[1].toLowerCase();
    
    // Extract the main domain part (before TLD)
    // e.g., q2ebanking.com -> q2ebanking, q2.com -> q2, ncsecu.org -> ncsecu
    const parts = domain.split('.');
    if (parts.length >= 2) {
      const mainDomain = parts[parts.length - 2];
      
      // Handle recruiting platforms - extract actual company from sender name
      const recruitingPlatforms = ['myworkday', 'smartrecruiters', 'greenhouse', 'lever', 'ashbyhq', 'icims'];
      if (recruitingPlatforms.includes(mainDomain) && emailObject) {
        // Try to extract company name from sender or subject
        const senderName = emailObject.from?.match(/^([^<]+)</)?.[1]?.toLowerCase() || '';
        const subject = emailObject.subject?.toLowerCase() || '';
        
        // Check sender name for company (e.g., "NCSECU@myworkday.com" -> ncsecu)
        const usernameMatch = email.match(/^([^@]+)@/);
        if (usernameMatch && usernameMatch[1] !== 'notification' && usernameMatch[1] !== 'notifications') {
          const username = usernameMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (username.length >= 3 && username !== mainDomain) {
            return username; // e.g., "ncsecu" from "ncsecu@myworkday.com"
          }
        }
        
        // Check sender display name for company indicators
        const companyMatch = senderName.match(/^([a-z0-9]+(?:\s+[a-z0-9]+)?)\s+(?:hiring|recruitment|talent|careers)/i);
        if (companyMatch) {
          return companyMatch[1].replace(/\s+/g, '').toLowerCase();
        }
        
        // Last resort: look for company name in subject
        const subjectCompanyMatch = subject.match(/^(?:thank\s+you\s+for\s+applying\s+to|interview\s+with|schedule\s+interview\s+with)?\s*([a-z0-9\s&]+?)(?:\s+[-|:]\s+|\s+interview|\s+hiring|\s+application)/i);
        if (subjectCompanyMatch && subjectCompanyMatch[1].length >= 3) {
          return subjectCompanyMatch[1].replace(/\s+/g, '').toLowerCase();
        }
      }
      
      // Check if this looks like a subdomain pattern (e.g., "q2" might be root of "q2ebanking")
      // Only normalize if the shorter form exists at the start of the longer form
      // This handles: q2ebanking -> q2, but won't affect unrelated domains
      const potentialRoot = mainDomain.match(/^([a-z0-9]+?)(ebanking|banking|interviews|hiring|talent|hr|recruitment|careers)$/i);
      if (potentialRoot && potentialRoot[1].length >= 2) {
        return potentialRoot[1]; // Return the root part (e.g., "q2" from "q2ebanking")
      }
      
      return mainDomain;
    }
    return domain;
  };

  // Helper function to generate a grouping key
  const getGroupingKey = (email) => {
    const threadId = email.thread_id || email.threadId || email.thread || email.id;
    const sender = email.from?.toLowerCase() || '';
    const companyDomain = getCompanyDomain(sender, email);
    const category = (email.category || '').toLowerCase();
    
    // PRIORITY 1.5: For ALL INTERVIEWED emails, use universal company + time grouping
    // UNIVERSAL SOLUTION: Group ALL interview emails from the same company together
    // Why: Interview processes span weeks/months (outreach→schedule→interview→followup)
    // This prevents duplicate interview counts regardless of:
    // - Subject variations (reminder, confirmation, scheduling, request)
    // - Time spans (July initial contact, August interview, September followup)
    // - Email types (direct recruiter vs platform notifications)
    // - Sender variations (jake@ncsecu.org vs ncsecu@myworkday.com)
    // Edge case: If someone interviews with same company twice in one job search,
    // they probably want to see all communications together anyway
    if (category === 'interviewed' && companyDomain) {
      return `interview_${companyDomain}`;
    }
    
    // PRIORITY 1: Use Gmail's native thread_id if available
    // Gmail already groups emails into conversations using RFC 2822 standards
    // (References, In-Reply-To headers, and subject matching)
    // This handles direct recruiter email chains (like SECU)
    if (threadId && threadId !== email.id) {
      return `thread_${threadId}`;
    }
    
    // PRIORITY 3: Standard subject-based grouping with normalization (for non-interviewed or non-notification emails)
    let subject = (email.subject || '');
    
    // Step 1: Remove common email prefixes BEFORE lowercasing
    subject = subject.replace(/^(re:|fw:|fwd:|reminder\s*-\s*|follow[-\s]?up\s*-?\s*|\[action required\]\s*|\[reminder\]\s*|urgent\s*-?\s*)/gi, '');
    
    // Step 2: Remove personalized suffixes (recipient names) BEFORE lowercasing
    subject = subject.replace(/[:;\-–—]\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*$/g, '');
    
    // Step 3: NOW lowercase everything
    subject = subject.toLowerCase();
    
    // Step 4: Normalize confusable characters
    subject = subject
      .replace(/\bl\b/g, 'i')
      .replace(/\|/g, 'i');
    
    // Step 5: Remove administrative suffixes
    subject = subject
      .replace(/\s+(confirmation|confirmed|scheduled?|please confirm|action required|rsvp|booking|availability request)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Group by company domain + normalized subject
    if (companyDomain && subject) {
      return `company_${companyDomain}_${subject}`;
    }
    
    // Last resort: use email ID (each email separate)
    return `email_${email.id}`;
  };

  for (const email of emails || []) {
    const groupKey = getGroupingKey(email);
    
    let g = map.get(groupKey);
    if (!g) {
      g = { 
        threadId: email.thread_id || email.threadId || email.thread || email.id, 
        emails: [], 
        latest: null, 
        earliest: null 
      };
      map.set(groupKey, g);
    }
    g.emails.push(email);
    const d = new Date(email.date);
    if (!g.latest || d > new Date(g.latest.date)) g.latest = email;
    if (!g.earliest || d < new Date(g.earliest.date)) g.earliest = email;
  }
  
  const groups = [];
  for (const g of map.values()) {
    const unreadCount = g.emails.filter(e => !e.is_read).length;
    const messageCount = g.emails.length;
    const latest = g.latest || g.emails[0];
    const earliest = g.earliest || g.emails[0];
    const subject = latest?.subject || earliest?.subject || '(No subject)';
    const preview = latest?.html_body || latest?.body || '';
    groups.push({
      id: `thread-${g.threadId}`,
      threadId: g.threadId,
      subject,
      date: latest?.date,
      from: latest?.from,
      is_read: unreadCount === 0,
      messageCount,
      unreadCount,
      preview,
      latestEmail: latest,
      emails: g.emails, // Include all emails in this group for thread viewing
    });
  }
  
  return groups.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function countUniqueThreads(emails) {
  const groupedEmails = groupEmailsByThread(emails);
  return groupedEmails.length;
}

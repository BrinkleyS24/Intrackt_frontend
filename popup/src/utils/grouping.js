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

  // Helper to extract actual company name from interview emails (especially from ATS platforms)
  const extractCompanyFromInterview = (email) => {
    const subject = email.subject || '';
    const subjectLower = subject.toLowerCase();
    const sender = email.from?.toLowerCase() || '';
    
    // Common ATS platforms that don't reveal company in sender domain
    const atsPlatforms = ['dayforce', 'greenhouse', 'workday', 'smartrecruiters', 'lever', 'icims', 'fountain', 'rippling', 'ashbyhq'];
    const senderDomain = getCompanyDomain(sender, email);
    
    // Helper: Normalize company names to handle variations
    const normalizeCompany = (companyName) => {
      let normalized = companyName.toLowerCase().trim();
      
      // CRITICAL FIX: Handle "I Squared Logistics" variations
      // "I Squared Logistics", "I Squared", "I2Logistics", "I2Logistics.com" → "i_squared_logistics"
      if (normalized.match(/i\s*(?:2|squared)\s*(?:logistics?)?/i)) {
        return 'i_squared_logistics';
      }
      
      // Remove common suffixes
      normalized = normalized.replace(/\s+(inc|llc|corp|corporation|ltd|limited|co)\.?$/i, '');
      
      // Replace spaces with underscores
      return normalized.replace(/\s+/g, '_');
    };
    
    // If sender is from company domain (not ATS), use that
    if (!atsPlatforms.includes(senderDomain)) {
      return normalizeCompany(senderDomain);
    }
    
    // ATS platform detected - extract company name from subject line
    // Priority order: most specific patterns first
    
    // Pattern 1: "with [Company Name]" or "at [Company Name]"
    // Examples: "Interview with I Squared Logistics", "Zoom Interview Schedule with I Squared Logistics"
    let match = subjectLower.match(/(?:with|at)\s+([a-z][a-z0-9\s&]+?)(?:\s+on\s+|$|confirmed)/i);
    if (match) {
      const company = match[1].trim();
      // Filter out generic words and single letters
      if (company.length >= 5 && !['your', 'the', 'our', 'this', 'that'].includes(company)) {
        return normalizeCompany(company);
      }
    }
    
    // Pattern 2: Extract from sender display name ONLY if it looks like a company (2+ words, not just first name)
    // "I Squared Owner <owner@i2logistics.com>" → "i_squared_logistics"
    const senderNameMatch = email.from?.match(/^([^<@]+?)\s+(?:Owner|Hiring|Recruiter|HR|Team|Manager)\s*</i);
    if (senderNameMatch) {
      const name = senderNameMatch[1].trim();
      const words = name.split(/\s+/);
      // Must be 2+ words to be a company name (avoids "Jillian Y" or "Brad P")
      if (words.length >= 2 && name.length >= 5) {
        return normalizeCompany(name);
      }
    }
    
    // Pattern 3: "Role/Position at [Company]"
    match = subjectLower.match(/(?:role|position)\s+at\s+([a-z][a-z0-9\s&]+?)(?:\s|$)/i);
    if (match) {
      const company = match[1].trim();
      if (company.length >= 5) {
        return normalizeCompany(company);
      }
    }
    
    // Fallback: use ATS platform domain (will group all interviews from that platform together)
    // This is intentional - if we can't extract company name, group by platform
    return senderDomain;
  };

  // Helper function to generate a grouping key
  const getGroupingKey = (email) => {
    const threadId = email.thread_id || email.threadId || email.thread || email.id;
    const sender = email.from?.toLowerCase() || '';
    const companyDomain = getCompanyDomain(sender, email);
    const category = (email.category || '').toLowerCase();
    
    // PRIORITY 1.5: For ALL INTERVIEWED emails, use universal company + time grouping
    // CRITICAL FIX: Use backend application_id if available (most reliable)
    // Backend links emails to applications, so if two interview emails have the same
    // application_id, they're definitely part of the same interview process
    if (category === 'interviewed') {
      // ALWAYS extract company identifier for consistent grouping
      const companyIdentifier = extractCompanyFromInterview(email);
      
      // Check for backend application linking
      const appId = email.application_id || email.applicationId;
      
      const groupKey = `interview_${companyIdentifier}`;
      
      // DEBUG: Log ALL interviewed emails to trace grouping
      console.log('[INTERVIEW GROUPING]', {
        subject: email.subject?.substring(0, 50),
        from: email.from?.substring(0, 30),
        companyIdentifier,
        groupKey,
        appId,
        threadId: email.thread_id
      });
      
      if (appId || companyIdentifier) {
        return groupKey;
      }
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
        // Use groupKey as threadId to ensure uniqueness across different grouping strategies
        // For native Gmail threads, groupKey IS the thread_id
        // For interview grouping, groupKey is interview_${company}
        threadId: groupKey, 
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
  
  // DEBUG: Log final grouped result for interviewed category
  const interviewGroups = groups.filter(g => g.threadId.startsWith('interview_'));
  if (interviewGroups.length > 0) {
    console.log('[GROUPING RESULT] Interview groups:', interviewGroups.map(g => ({
      threadId: g.threadId,
      subject: g.subject,
      messageCount: g.messageCount,
      emails: g.emails.map(e => ({ subject: e.subject?.substring(0, 40), from: e.from?.substring(0, 30) }))
    })));
  }
  
  return groups.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function countUniqueThreads(emails) {
  const groupedEmails = groupEmailsByThread(emails);
  return groupedEmails.length;
}

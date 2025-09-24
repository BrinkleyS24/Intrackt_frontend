// Utility functions to group emails into conversation threads and count threads

/**
 * Enhanced email grouping that considers both thread_id and sender-subject similarity
 * to group related emails that might have different thread IDs
 */
export function groupEmailsByThread(emails) {
  const map = new Map();
  
  // Helper function to generate a grouping key
  const getGroupingKey = (email) => {
    const threadId = email.thread_id || email.threadId || email.thread || email.id;
    const sender = email.from?.toLowerCase() || '';
    const subject = (email.subject || '').toLowerCase()
      .replace(/^(re:|fw:|fwd:)\s*/i, '') // Remove reply/forward prefixes
      .replace(/\s+/g, ' ')
      .trim();
    
    // If we have a thread ID, use it primarily
    if (threadId) {
      return `thread_${threadId}`;
    }
    
    // For emails without thread IDs, group by sender + normalized subject
    if (sender && subject) {
      return `sender_${sender}_${subject}`;
    }
    
    // Fallback to email ID
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
    });
  }
  return groups.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function countUniqueThreads(emails) {
  const groupedEmails = groupEmailsByThread(emails);
  return groupedEmails.length;
}

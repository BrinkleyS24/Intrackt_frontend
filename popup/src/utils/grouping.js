// Utility functions to group emails into conversation threads and count threads

export function groupEmailsByThread(emails) {
  const map = new Map();
  for (const email of emails || []) {
    const threadId = email.thread_id || email.threadId || email.thread || email.id;
    if (!threadId) continue;
    let g = map.get(threadId);
    if (!g) {
      g = { threadId, emails: [], latest: null, earliest: null };
      map.set(threadId, g);
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
    const company = (g.emails.find(e => !!e.company)?.company) || earliest?.company || latest?.company || null;
    const position = (g.emails.find(e => !!e.position)?.position) || earliest?.position || latest?.position || null;
    const subject = latest?.subject || earliest?.subject || '(No subject)';
    const preview = latest?.html_body || latest?.body || '';
    groups.push({
      id: `thread-${g.threadId}`,
      threadId: g.threadId,
      subject,
      date: latest?.date,
      from: latest?.from,
      company,
      position,
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
  const s = new Set();
  for (const e of emails || []) s.add(e.thread_id || e.threadId || e.thread || e.id);
  return s.size;
}

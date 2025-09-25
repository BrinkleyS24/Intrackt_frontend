// Tiny simulation script that mirrors the logic used by the popup to decide
// whether the "Mark All Ready" button should be shown.

const fs = require('fs');
const path = require('path');

function countUnreadThreadsForCategory(categoryEmails) {
  const threadsWithUnread = new Set();
  for (const email of categoryEmails || []) {
    if (!email.is_read) {
      const threadId = email.thread_id || email.threadId || email.thread || email.id;
      threadsWithUnread.add(threadId);
    }
  }
  return threadsWithUnread.size;
}

function main() {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample_categorized_emails.json'), 'utf8'));

  const categories = Object.keys(fixture);
  const unreadCounts = {};
  for (const cat of categories) {
    unreadCounts[cat] = countUnreadThreadsForCategory(fixture[cat]);
  }

  console.log('Simulated unreadCounts:', unreadCounts);

  // Simulate selected category cases
  for (const cat of categories) {
    const showButton = Boolean(unreadCounts[cat] && unreadCounts[cat] > 0);
    console.log(`Category=${cat} showMarkAllButton=${showButton}`);
  }
}

main();

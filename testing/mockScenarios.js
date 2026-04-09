const CATEGORY_KEYS = ['applied', 'interviewed', 'offers', 'rejected', 'irrelevant'];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildCategoryTotals(categorizedEmails) {
  const totals = {};
  for (const key of CATEGORY_KEYS) {
    totals[key] = Array.isArray(categorizedEmails?.[key]) ? categorizedEmails[key].length : 0;
  }
  totals.relevant =
    totals.applied +
    totals.interviewed +
    totals.offers +
    totals.rejected;
  return totals;
}

function buildEmail({
  id,
  threadId,
  category,
  subject,
  from,
  date,
  company,
  position,
  body,
  htmlBody,
  isRead = false,
  applicationId = null,
  applicationStatus = null,
  isClosed = false,
  isUserClosed = false,
}) {
  return {
    id,
    thread_id: threadId,
    category,
    subject,
    from,
    sender: from,
    date,
    company_name: company,
    position,
    body,
    html_body: htmlBody || `<p>${body}</p>`,
    preview: body,
    is_read: isRead,
    applicationId,
    application_id: applicationId,
    applicationStatus,
    isClosed,
    isUserClosed,
    displayCategory: isClosed && ['applied', 'interviewed'].includes(category) ? 'closed' : category,
  };
}

const freeRichCategorizedEmails = {
  applied: [
    buildEmail({
      id: 101,
      threadId: 'northstar-product-manager',
      category: 'applied',
      subject: 'Application received: Senior Product Manager',
      from: 'Northstar Labs Recruiting <jobs@northstarlabs.com>',
      date: '2026-04-05T12:40:00.000Z',
      company: 'Northstar Labs',
      position: 'Senior Product Manager',
      body: 'Thanks for applying. We have your application and will review it this week.',
      applicationId: 9001,
      applicationStatus: 'applied',
    }),
    buildEmail({
      id: 102,
      threadId: 'northstar-product-manager',
      category: 'applied',
      subject: 'Application received: Senior Product Manager',
      from: 'Greenhouse <notifications@greenhouse.io>',
      date: '2026-04-03T15:20:00.000Z',
      company: 'Northstar Labs',
      position: 'Senior Product Manager',
      body: 'Your application for Senior Product Manager has been submitted successfully.',
      isRead: true,
      applicationId: 9001,
      applicationStatus: 'applied',
    }),
    buildEmail({
      id: 103,
      threadId: 'atlas-staff-engineer',
      category: 'applied',
      subject: 'Checking in on your Staff Engineer application',
      from: 'Atlas Talent <talent@atlas.co>',
      date: '2026-03-10T14:00:00.000Z',
      company: 'Atlas',
      position: 'Staff Engineer',
      body: 'This role has moved forward with other candidates, so we are closing the loop on your application.',
      isRead: true,
      applicationId: 9002,
      applicationStatus: 'applied',
      isClosed: true,
      isUserClosed: true,
    }),
  ],
  interviewed: [
    buildEmail({
      id: 201,
      threadId: 'acme-platform-engineer',
      category: 'interviewed',
      subject: 'Interview scheduled with Acme AI',
      from: 'Acme AI Recruiting <interviews@acme.ai>',
      date: '2026-04-04T16:30:00.000Z',
      company: 'Acme AI',
      position: 'Platform Engineer',
      body: 'Your second round interview is confirmed for Tuesday at 11:00 AM ET.',
      applicationId: 9003,
      applicationStatus: 'interviewed',
    }),
    buildEmail({
      id: 202,
      threadId: 'acme-platform-engineer',
      category: 'interviewed',
      subject: 'Interview scheduled with Acme AI',
      from: 'Google Calendar <calendar-notification@google.com>',
      date: '2026-04-04T15:45:00.000Z',
      company: 'Acme AI',
      position: 'Platform Engineer',
      body: 'Acme AI added a calendar invite for your technical interview.',
      isRead: true,
      applicationId: 9003,
      applicationStatus: 'interviewed',
    }),
  ],
  offers: [
    buildEmail({
      id: 301,
      threadId: 'brightwave-design',
      category: 'offers',
      subject: 'Offer letter for Senior Designer',
      from: 'Brightwave People Ops <people@brightwave.com>',
      date: '2026-04-02T18:10:00.000Z',
      company: 'Brightwave',
      position: 'Senior Designer',
      body: 'We are excited to share your offer package for the Senior Designer role.',
      applicationId: 9004,
      applicationStatus: 'offers',
      isRead: true,
    }),
  ],
  rejected: [
    buildEmail({
      id: 401,
      threadId: 'river-finance-analytics',
      category: 'rejected',
      subject: 'Update on your analytics application',
      from: 'River Finance Talent <careers@riverfinance.com>',
      date: '2026-03-30T13:10:00.000Z',
      company: 'River Finance',
      position: 'Analytics Lead',
      body: 'We appreciate your time. We have decided not to move forward after this round.',
      applicationId: 9005,
      applicationStatus: 'rejected',
      isRead: true,
    }),
  ],
  irrelevant: [
    buildEmail({
      id: 501,
      threadId: 'newsletter-1',
      category: 'irrelevant',
      subject: 'Weekly hiring newsletter',
      from: 'Jobs Weekly <newsletter@jobsweekly.example>',
      date: '2026-04-01T10:00:00.000Z',
      company: '',
      position: '',
      body: 'This is a general newsletter and should stay out of tracked applications.',
      isRead: true,
    }),
  ],
};

const premiumRichCategorizedEmails = {
  applied: [
    buildEmail({
      id: 601,
      threadId: 'lattice-growth',
      category: 'applied',
      subject: 'Application received: Growth Marketing Lead',
      from: 'Lattice Careers <careers@lattice.com>',
      date: '2026-04-05T11:20:00.000Z',
      company: 'Lattice',
      position: 'Growth Marketing Lead',
      body: 'We received your application and the hiring team will review it shortly.',
      applicationId: 9101,
      applicationStatus: 'applied',
    }),
  ],
  interviewed: [
    buildEmail({
      id: 602,
      threadId: 'signal-ml',
      category: 'interviewed',
      subject: 'Final interview loop confirmed',
      from: 'Signal Labs Recruiting <recruiting@signallabs.ai>',
      date: '2026-04-04T19:05:00.000Z',
      company: 'Signal Labs',
      position: 'ML Engineer',
      body: 'Your final loop is locked in for Friday. We are looking forward to meeting you.',
      applicationId: 9102,
      applicationStatus: 'interviewed',
    }),
  ],
  offers: [
    buildEmail({
      id: 603,
      threadId: 'orbit-ops',
      category: 'offers',
      subject: 'Offer package for Revenue Operations Director',
      from: 'Orbit HR <hr@orbit.io>',
      date: '2026-04-01T16:40:00.000Z',
      company: 'Orbit',
      position: 'Revenue Operations Director',
      body: 'Attached is your offer package and benefits summary.',
      applicationId: 9103,
      applicationStatus: 'offers',
      isRead: true,
    }),
  ],
  rejected: [],
  irrelevant: [],
};

const emptyCategorizedEmails = {
  applied: [],
  interviewed: [],
  offers: [],
  rejected: [],
  irrelevant: [],
};

const SCENARIOS = {
  'logged-out': {
    id: 'logged-out',
    label: 'Logged Out',
    description: 'Covers the unauthenticated landing state and Google sign-in CTA.',
    auth: null,
    userPlan: 'free',
    quotaData: null,
    sync: {
      inProgress: false,
      lastSyncAt: null,
      lastCompletedAt: null,
      startedAt: null,
    },
    categorizedEmails: emptyCategorizedEmails,
    applications: {},
  },
  'free-rich': {
    id: 'free-rich',
    label: 'Free Plan Rich Inbox',
    description: 'Free-plan state with quota pressure, unread threads, preview history, and closed applications.',
    auth: {
      email: 'qa.free@applendium.dev',
      name: 'Free Plan QA',
      userId: 'qa-free-001',
    },
    userPlan: 'free',
    quotaData: {
      trackedApplications: 82,
      totalProcessed: 82,
      limit: 100,
      relevantMessagesProcessed: 124,
      limitReached: false,
      limitBehavior: 'existing_continue_new_paused',
      next_reset_date: '2026-04-30T00:00:00.000Z',
    },
    sync: {
      inProgress: false,
      lastSyncAt: '2026-04-05T12:45:00.000Z',
      lastCompletedAt: '2026-04-05T12:45:00.000Z',
      startedAt: null,
    },
    categorizedEmails: freeRichCategorizedEmails,
    applications: {
      9001: {
        application: { id: 9001, current_status: 'applied', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 102, category: 'applied', date: '2026-04-03T15:20:00.000Z', subject: 'Application received: Senior Product Manager' },
          { emailId: 101, category: 'applied', date: '2026-04-05T12:40:00.000Z', subject: 'Application received: Senior Product Manager' },
        ],
      },
      9002: {
        application: { id: 9002, current_status: 'applied', is_closed: true, user_closed_at: '2026-03-12T09:00:00.000Z' },
        lifecycle: [
          { emailId: 103, category: 'applied', date: '2026-03-10T14:00:00.000Z', subject: 'Checking in on your Staff Engineer application' },
        ],
      },
      9003: {
        application: { id: 9003, current_status: 'interviewed', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 202, category: 'applied', date: '2026-04-02T12:00:00.000Z', subject: 'Acme AI interview logistics' },
          { emailId: 201, category: 'interviewed', date: '2026-04-04T16:30:00.000Z', subject: 'Interview scheduled with Acme AI' },
        ],
      },
      9004: {
        application: { id: 9004, current_status: 'offers', is_closed: true, user_closed_at: null },
        lifecycle: [
          { emailId: 301, category: 'offers', date: '2026-04-02T18:10:00.000Z', subject: 'Offer letter for Senior Designer' },
        ],
      },
      9005: {
        application: { id: 9005, current_status: 'rejected', is_closed: true, user_closed_at: null },
        lifecycle: [
          { emailId: 401, category: 'rejected', date: '2026-03-30T13:10:00.000Z', subject: 'Update on your analytics application' },
        ],
      },
    },
  },
  'free-limit-reached': {
    id: 'free-limit-reached',
    label: 'Free Plan Limit Reached',
    description: 'Free-plan state after the tracked application cap is reached, so upgrade pressure and blocked-new-tracking copy can be validated.',
    auth: {
      email: 'qa.limit@applendium.dev',
      name: 'Limit Reached QA',
      userId: 'qa-limit-001',
    },
    userPlan: 'free',
    quotaData: {
      trackedApplications: 100,
      totalProcessed: 100,
      limit: 100,
      relevantMessagesProcessed: 148,
      limitReached: true,
      limitBehavior: 'existing_continue_new_paused',
      next_reset_date: '2026-04-30T00:00:00.000Z',
    },
    sync: {
      inProgress: false,
      lastSyncAt: '2026-04-05T12:52:00.000Z',
      lastCompletedAt: '2026-04-05T12:52:00.000Z',
      startedAt: null,
    },
    categorizedEmails: freeRichCategorizedEmails,
    applications: {
      9001: {
        application: { id: 9001, current_status: 'applied', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 102, category: 'applied', date: '2026-04-03T15:20:00.000Z', subject: 'Application received: Senior Product Manager' },
          { emailId: 101, category: 'applied', date: '2026-04-05T12:40:00.000Z', subject: 'Application received: Senior Product Manager' },
        ],
      },
      9002: {
        application: { id: 9002, current_status: 'applied', is_closed: true, user_closed_at: '2026-03-12T09:00:00.000Z' },
        lifecycle: [
          { emailId: 103, category: 'applied', date: '2026-03-10T14:00:00.000Z', subject: 'Checking in on your Staff Engineer application' },
        ],
      },
      9003: {
        application: { id: 9003, current_status: 'interviewed', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 202, category: 'applied', date: '2026-04-02T12:00:00.000Z', subject: 'Acme AI interview logistics' },
          { emailId: 201, category: 'interviewed', date: '2026-04-04T16:30:00.000Z', subject: 'Interview scheduled with Acme AI' },
        ],
      },
      9004: {
        application: { id: 9004, current_status: 'offers', is_closed: true, user_closed_at: null },
        lifecycle: [
          { emailId: 301, category: 'offers', date: '2026-04-02T18:10:00.000Z', subject: 'Offer letter for Senior Designer' },
        ],
      },
      9005: {
        application: { id: 9005, current_status: 'rejected', is_closed: true, user_closed_at: null },
        lifecycle: [
          { emailId: 401, category: 'rejected', date: '2026-03-30T13:10:00.000Z', subject: 'Update on your analytics application' },
        ],
      },
    },
  },
  'premium-rich': {
    id: 'premium-rich',
    label: 'Premium Plan Active Search',
    description: 'Premium state for validating no free-plan quota friction and premium footer behavior.',
    auth: {
      email: 'qa.premium@applendium.dev',
      name: 'Premium QA',
      userId: 'qa-premium-001',
    },
    userPlan: 'premium',
    quotaData: {
      trackedApplications: 214,
      totalProcessed: 214,
      relevantMessagesProcessed: 322,
      limit: 100,
      limitReached: false,
      next_reset_date: '2026-04-30T00:00:00.000Z',
    },
    sync: {
      inProgress: false,
      lastSyncAt: '2026-04-05T12:15:00.000Z',
      lastCompletedAt: '2026-04-05T12:15:00.000Z',
      startedAt: null,
    },
    categorizedEmails: premiumRichCategorizedEmails,
    applications: {
      9101: {
        application: { id: 9101, current_status: 'applied', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 601, category: 'applied', date: '2026-04-05T11:20:00.000Z', subject: 'Application received: Growth Marketing Lead' },
        ],
      },
      9102: {
        application: { id: 9102, current_status: 'interviewed', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 602, category: 'interviewed', date: '2026-04-04T19:05:00.000Z', subject: 'Final interview loop confirmed' },
        ],
      },
      9103: {
        application: { id: 9103, current_status: 'offers', is_closed: true, user_closed_at: null },
        lifecycle: [
          { emailId: 603, category: 'offers', date: '2026-04-01T16:40:00.000Z', subject: 'Offer package for Revenue Operations Director' },
        ],
      },
    },
  },
  'sync-stuck': {
    id: 'sync-stuck',
    label: 'Sync Stuck Warning',
    description: 'Signed-in state with a long-running sync so the popup warning and recovery copy can be reviewed.',
    auth: {
      email: 'qa.sync@applendium.dev',
      name: 'Sync QA',
      userId: 'qa-sync-001',
    },
    userPlan: 'free',
    quotaData: {
      trackedApplications: 28,
      totalProcessed: 28,
      limit: 100,
      relevantMessagesProcessed: 61,
      limitReached: false,
      limitBehavior: 'existing_continue_new_paused',
      next_reset_date: '2026-04-30T00:00:00.000Z',
    },
    sync: {
      inProgress: true,
      startedAt: '2024-01-10T09:00:00.000Z',
      lastSyncAt: '2024-01-10T09:00:00.000Z',
      lastCompletedAt: '2024-01-09T21:12:00.000Z',
    },
    categorizedEmails: freeRichCategorizedEmails,
    applications: {
      9001: {
        application: { id: 9001, current_status: 'applied', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 102, category: 'applied', date: '2026-04-03T15:20:00.000Z', subject: 'Application received: Senior Product Manager' },
          { emailId: 101, category: 'applied', date: '2026-04-05T12:40:00.000Z', subject: 'Application received: Senior Product Manager' },
        ],
      },
      9003: {
        application: { id: 9003, current_status: 'interviewed', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 202, category: 'applied', date: '2026-04-02T12:00:00.000Z', subject: 'Acme AI interview logistics' },
          { emailId: 201, category: 'interviewed', date: '2026-04-04T16:30:00.000Z', subject: 'Interview scheduled with Acme AI' },
        ],
      },
      9004: {
        application: { id: 9004, current_status: 'offers', is_closed: true, user_closed_at: null },
        lifecycle: [
          { emailId: 301, category: 'offers', date: '2026-04-02T18:10:00.000Z', subject: 'Offer letter for Senior Designer' },
        ],
      },
    },
  },
  'refresh-failure': {
    id: 'refresh-failure',
    label: 'Refresh Failure',
    description: 'Signed-in state with cached tracked emails where a manual refresh fails and the popup must surface the error without losing state.',
    auth: {
      email: 'qa.refresh-failure@applendium.dev',
      name: 'Refresh Failure QA',
      userId: 'qa-refresh-failure-001',
    },
    userPlan: 'free',
    quotaData: {
      trackedApplications: 82,
      totalProcessed: 82,
      limit: 100,
      relevantMessagesProcessed: 124,
      limitReached: false,
      limitBehavior: 'existing_continue_new_paused',
      next_reset_date: '2026-04-30T00:00:00.000Z',
    },
    sync: {
      inProgress: false,
      lastSyncAt: '2026-04-05T12:45:00.000Z',
      lastCompletedAt: '2026-04-05T12:45:00.000Z',
      startedAt: null,
    },
    categorizedEmails: freeRichCategorizedEmails,
    applications: {
      9001: {
        application: { id: 9001, current_status: 'applied', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 102, category: 'applied', date: '2026-04-03T15:20:00.000Z', subject: 'Application received: Senior Product Manager' },
          { emailId: 101, category: 'applied', date: '2026-04-05T12:40:00.000Z', subject: 'Application received: Senior Product Manager' },
        ],
      },
      9003: {
        application: { id: 9003, current_status: 'interviewed', is_closed: false, user_closed_at: null },
        lifecycle: [
          { emailId: 202, category: 'applied', date: '2026-04-02T12:00:00.000Z', subject: 'Acme AI interview logistics' },
          { emailId: 201, category: 'interviewed', date: '2026-04-04T16:30:00.000Z', subject: 'Interview scheduled with Acme AI' },
        ],
      },
    },
    simulatedFailures: {
      refresh: {
        error: 'Mock network timeout while refreshing tracked emails.',
      },
    },
  },
  'empty-inbox': {
    id: 'empty-inbox',
    label: 'Empty Inbox',
    description: 'Logged-in state with no tracked applications yet.',
    auth: {
      email: 'qa.empty@applendium.dev',
      name: 'Empty Inbox QA',
      userId: 'qa-empty-001',
    },
    userPlan: 'free',
    quotaData: {
      trackedApplications: 0,
      totalProcessed: 0,
      relevantMessagesProcessed: 0,
      limit: 100,
      limitReached: false,
      next_reset_date: '2026-04-30T00:00:00.000Z',
    },
    sync: {
      inProgress: false,
      lastSyncAt: '2026-04-05T11:55:00.000Z',
      lastCompletedAt: '2026-04-05T11:55:00.000Z',
      startedAt: null,
    },
    categorizedEmails: emptyCategorizedEmails,
    applications: {},
  },
};

export const DEFAULT_EXTENSION_TEST_SCENARIO_ID = 'free-rich';

export function listExtensionTestScenarios() {
  return Object.values(SCENARIOS).map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    description: scenario.description,
  }));
}

export function getExtensionTestScenario(scenarioId) {
  const selected = SCENARIOS[scenarioId];
  if (!selected) return null;

  const cloned = deepClone(selected);
  cloned.categoryTotals = buildCategoryTotals(cloned.categorizedEmails);
  return cloned;
}

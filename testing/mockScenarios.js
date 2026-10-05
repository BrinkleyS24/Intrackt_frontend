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
    // Plan windows as the backend sends them since 2026-09-26 (90 free, 180 premium).
    dataCompleteness: {
      syncComplete: true,
      historyWindowDays: 90,
      premiumHistoryWindowDays: 180,
      visibleSinceDate: '2026-01-06T00:00:00.000Z',
    },
    // A free user on a job page with this week's check unused (one per rolling week, 2026-09-26).
    applyGate: {
      posting: {
        source: 'structured',
        url: 'https://jobs.lever.co/northwind/qa-analyst',
        title: 'QA Analyst',
        company: 'Northwind',
        description: 'Responsibilities: manual and automated testing. Qualifications: 2+ years QA, SQL.',
        looksLikeJob: true,
      },
      allowance: { plan: 'free', unlimited: false, limit: 1, used: 0, remaining: 1, nextAvailableAt: null },
      result: {
        success: true,
        id: 'verdict-free-1',
        verdict: 'good_fit',
        reasons: ['Your QA history matches the testing work.', 'SQL appears in two of your roles.'],
        explanation: {
          decision: 'apply_now',
          display_decision: { action: 'APPLY', label: 'Apply', headline: 'Worth applying', subtext: 'Your experience covers what they ask for.' },
        },
        resumeDocument: { variantId: null, source: 'legacy', fingerprint: 'def456', characters: 1800 },
        allowance: { limit: 1, used: 1, remaining: 0, nextAvailableAt: '2026-10-03T12:00:00.000Z' },
      },
    },
    searchRead: {
      read: {
        kind: 'performance-rejection-velocity-auto_screen',
        title: 'Your rejections are coming back too fast for anyone to have read the resume',
        description: '6 of 8 timed rejections arrived within 3 days of applying, averaging 1.4 days. Decisions that fast are consistent with the application form filtering you out — work authorisation, location, salary, or a required-experience question — before a recruiter opens anything.',
        stat: '75% of your timed rejections arrived this way',
        timeframe: 'In the last 90 days',
      },
      progress: null,
    },
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
  'free-healthy': {
    id: 'free-healthy',
    label: 'Free Plan Healthy Inbox',
    description: 'Free-plan state with an organized pipeline and plenty of quota headroom. Used for store screenshots so no scarcity banner appears.',
    auth: {
      email: 'qa.free@applendium.dev',
      name: 'Free Plan QA',
      userId: 'qa-free-001',
    },
    userPlan: 'free',
    quotaData: {
      trackedApplications: 6,
      totalProcessed: 6,
      limit: 100,
      relevantMessagesProcessed: 9,
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
    // This week's free check already used.
    applyGate: {
      posting: {
        source: 'page',
        url: 'https://boards.greenhouse.io/contoso/jobs/77',
        title: 'Support Engineer',
        company: 'Contoso',
        description: 'Responsibilities: triage tickets. Qualifications: customer support experience.',
        looksLikeJob: true,
      },
      allowance: { plan: 'free', unlimited: false, limit: 1, used: 1, remaining: 0, nextAvailableAt: '2026-10-03T12:00:00.000Z' },
    },
    searchRead: {
      read: null,
      progress: {
        unit: 'timed_rejections',
        have: 3,
        need: 5,
        label: "Your first read appears once 5 rejections from the last 90 days can be timed from application to decision. You're at 3.",
      },
    },
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
    dataCompleteness: {
      syncComplete: true,
      historyWindowDays: 180,
      premiumHistoryWindowDays: 180,
      visibleSinceDate: '2025-10-08T00:00:00.000Z',
    },
    label: 'Premium Plan Active Search',
    description: 'Premium state for validating no free-plan quota friction and premium footer behavior.',
    auth: {
      email: 'qa.premium@applendium.dev',
      name: 'Premium QA',
      userId: 'qa-premium-001',
    },
    userPlan: 'premium',
    // Apply Gate from the popup: the job the harness pretends is open in the active tab, and the
    // verdict the backend would return for it (shape of POST /api/emails/apply-gate/analyze).
    applyGate: {
      posting: {
        source: 'structured',
        url: 'https://boards.greenhouse.io/signallabs/jobs/4242',
        title: 'Senior QA Automation Engineer',
        company: 'Signal Labs',
        description: 'Responsibilities: own the Playwright suite. Qualifications: 5+ years of test automation, CI/CD, TypeScript.',
        looksLikeJob: true,
      },
      result: {
        success: true,
        id: 'verdict-qa-1',
        verdict: 'risky',
        jobTitle: 'Senior QA Automation Engineer',
        companyName: 'Signal Labs',
        reasons: [
          'Your resume shows Playwright but no CI/CD pipeline work.',
          'The role asks for 5+ years; your dated history shows 4.',
          'Core overlap: test automation, TypeScript, API testing.',
          'A fourth reason the popup should not show.',
        ],
        explanation: {
          decision: 'fix_first',
          display_decision: {
            action: 'FIX_THEN_APPLY',
            label: 'Fix first',
            headline: 'Close one gap, then apply',
            subtext: 'Add the CI/CD work you have done before sending this one.',
          },
        },
        resumeDocument: { variantId: 'v-default', source: 'default', fingerprint: 'abc123', characters: 2400 },
      },
    },
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
  'gmail-disconnected': {
    id: 'gmail-disconnected',
    label: 'Gmail Disconnected',
    description: 'Signed-in state with a dead Google refresh token: the cached pipeline still renders but nothing new has been tracked for months, so the reconnect banner must be the first thing seen.',
    auth: {
      email: 'qa.disconnected@applendium.dev',
      name: 'Disconnected QA',
      userId: 'qa-disconnected-001',
    },
    userPlan: 'free',
    quotaData: {
      trackedApplications: 31,
      totalProcessed: 31,
      limit: 500,
      relevantMessagesProcessed: 64,
      limitReached: false,
      limitBehavior: 'existing_continue_new_paused',
      next_reset_date: '2026-08-30T00:00:00.000Z',
    },
    // The tell that made this invisible: sync reports a clean, completed run.
    // Nothing here says "broken" — it just stopped, months ago.
    sync: {
      inProgress: false,
      lastSyncAt: '2026-04-15T09:12:00.000Z',
      lastCompletedAt: '2026-04-15T09:12:00.000Z',
      startedAt: null,
    },
    // Mirrors the worst real prod row found on 2026-07-26: a free user 102 days
    // dark. Keep the gap large so the duration copy is exercised, not the
    // "today" branch.
    gmailAuth: {
      requiresReconnect: true,
      errorCode: 'INVALID_GRANT',
      failedAt: '2026-04-15T09:12:00.000Z',
    },
    categorizedEmails: freeRichCategorizedEmails,
    applications: {},
  },
  'empty-inbox': {
    id: 'empty-inbox',
    label: 'Empty Inbox',
    description: 'Logged-in state with no tracked applications yet.',
    // A brand-new user has not added a resume either.
    resumeSelection: { resumeDocument: null, selectionRequired: false },
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

SCENARIOS['unlinked-outcome'] = {
  ...SCENARIOS['free-rich'],
  id: 'unlinked-outcome',
  label: 'Unlinked outcome',
  description: 'A rejection without an application link must disclose that its history may be incomplete.',
  categorizedEmails: {
    ...freeRichCategorizedEmails,
    rejected: freeRichCategorizedEmails.rejected.map((email) => ({ ...email, applicationId: null, application_id: null })),
  },
};

// The free inbox, with its older history stuck: the import failed every attempt and is
// waiting a week for its next round. Not on a job page, so Apply Gate stays out of the way.
SCENARIOS['history-import-retrying'] = {
  ...deepClone(SCENARIOS['free-rich']),
  id: 'history-import-retrying',
  label: 'History Import Retrying',
  description: 'Free inbox whose older-history import failed and will retry on a set date.',
  applyGate: undefined,
  dataCompleteness: {
    ...deepClone(SCENARIOS['free-rich'].dataCompleteness),
    historyImport: { state: 'retrying', nextRetryAt: '2026-10-10T12:00:00.000Z' },
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

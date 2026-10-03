const path = require('node:path');
const fs = require('node:fs');
const { chromium, expect, test } = require('@playwright/test');

const extensionPath = process.env.EXTENSION_DIST_DIR || path.resolve(__dirname, '..', 'popup', 'dist');

let context;
let extensionId;

function getLaunchOptions() {
  const args = [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ];

  if (process.env.PW_EXTENSION_EXECUTABLE_PATH) {
    return {
      executablePath: process.env.PW_EXTENSION_EXECUTABLE_PATH,
      headless: process.env.PW_HEADLESS !== 'false',
      args,
      viewport: { width: 1480, height: 1120 },
    };
  }

  return {
    channel: process.env.PW_EXTENSION_CHANNEL || 'chromium',
    headless: process.env.PW_HEADLESS !== 'false',
    args,
    viewport: { width: 1480, height: 1120 },
  };
}

async function openLabPage() {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`);
  await expect(page.getByTestId('test-harness-title')).toBeVisible();
  return page;
}

async function activateScenario(page, scenarioId) {
  await page.getByTestId(`scenario-${scenarioId}`).click();
  await expect(page.getByTestId('testing-mode')).toContainText('Scenario active');
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await expect(frame.getByTestId('extension-popup-root')).toBeVisible();
  return frame;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', getLaunchOptions());
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  extensionId = new URL(serviceWorker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

test('allows a mocked login transition from logged-out into the free inbox', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'logged-out');

  await expect(page.getByTestId('state-auth')).toContainText('Signed out');
  await expect(frame.getByTestId('login-google-button')).toBeVisible();
  await expect(frame.getByText(/turns it into a live pipeline/i)).toBeVisible();
  await frame.getByTestId('login-google-button').click();
  await expect(frame.getByTestId('plan-badge')).toContainText('Free');
  await expect(frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Northstar Labs' }).first()).toBeVisible();
  await expect(page.getByTestId('state-auth')).toContainText('Signed in');
  await expect(page.getByTestId('state-plan')).toContainText('Free');

  await page.screenshot({
    path: testInfo.outputPath('lab-login-transition.png'),
    fullPage: true,
  });

  await page.close();
});

test('makes an unlinked outcome visible without pretending the history is complete', async () => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'unlinked-outcome');
  await frame.getByTestId('main-tab-rejected').click();
  await frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'River Finance' }).first().click();
  await expect(frame.getByTestId('application-link-warning')).toContainText('not linked to an application');
  await frame.getByRole('button', { name: 'Review company and role' }).click();
  await expect(frame.getByTestId('email-preview-details')).toBeVisible();
  await page.close();
});

test('renders the free-plan inbox and opens a thread preview', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-rich');
  const northstarThread = frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Northstar Labs' }).first();

  await expect(frame.getByTestId('quota-status-notice')).toContainText('82/100 active in the last 30 days');
  await expect(northstarThread).toBeVisible();
  await northstarThread.click();
  await expect(frame.getByTestId('email-preview')).toBeVisible();
  await expect(frame.getByText('Application Journey')).toBeVisible();
  // Which application this is leads; the subject reads as the email's title under it (2026-09-27).
  await expect(frame.getByRole('heading', { name: 'Northstar Labs' })).toBeVisible();
  await expect(frame.getByTestId('email-preview-header')).toContainText('Application received: Senior Product Manager');
  // The email itself comes before the journey, not ~900px under it.
  const order = await frame.getByTestId('email-preview').evaluate((root) => {
    const text = root.innerText;
    return { message: text.indexOf('Thanks for applying'), journey: text.indexOf('Application Journey') };
  });
  expect(order.message).toBeGreaterThan(-1);
  expect(order.message).toBeLessThan(order.journey);
  // Editing company and role is there when asked for, and no field carries an "Auto" pill.
  await expect(frame.getByTestId('email-preview-details')).toHaveCount(0);
  await frame.getByTestId('email-preview-edit-details').click();
  await expect(frame.getByTestId('email-preview-details')).toContainText('Northstar Labs');
  await expect(frame.getByText('Auto', { exact: true })).toHaveCount(0);
  await expect(frame.getByText(/merged into this stage|duplicate same-stage/)).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Reply' })).toHaveCount(0);
  // The "Applendium detected" chips only restated the badge and the fields beside them.
  await expect(frame.getByText('Applendium detected')).toHaveCount(0);

  await frame.getByTestId('popup-header-back').click();
  await expect(frame.getByTestId('refresh-button')).toBeVisible();
  // Being ghosted is a rejection to the person searching; the popup no longer argues otherwise.
  await expect(frame.getByText(/had no reply/)).toHaveCount(0);

  // The history note states the plan's window and what Premium adds, from the backend's
  // numbers (it used to hard-code "Premium imports 90 days", no gain once free reached 90).
  const coverageNote = frame.getByTestId('history-coverage-note');
  await expect(coverageNote).toContainText('your plan imports the last 90 days');
  await expect(coverageNote).toContainText('Premium imports 180 days');

  await page.screenshot({
    path: testInfo.outputPath('lab-free-rich.png'),
    fullPage: true,
  });

  // It can be dismissed, and stays dismissed the next time the popup opens (2026-09-27).
  await frame.getByTestId('history-coverage-dismiss').click();
  await expect(coverageNote).toHaveCount(0);
  const reopened = await activateScenario(page, 'free-rich');
  await expect(reopened.getByTestId('refresh-button')).toBeVisible();
  await expect(reopened.getByTestId('quota-status-notice')).toBeVisible();
  await expect(reopened.getByTestId('history-coverage-note')).toHaveCount(0);

  await page.close();
});

test('loads the packaged PDF chunks without an inline import map', async () => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-rich');
  await frame.getByTestId('report-button').click();
  await expect(frame.getByTestId('report-modal')).toBeVisible();
  await frame.getByTestId('report-start-date').fill('2026-03-01');
  await frame.getByTestId('report-end-date').fill('2026-05-01');
  await expect(frame.getByTestId('report-download-button')).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await frame.getByTestId('report-download-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(fs.readFileSync(await download.path()).subarray(0, 4).toString()).toBe('%PDF');
  await page.close();
});

test('renders the free-plan limit reached state with premium-status guidance', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-limit-reached');

  await expect(page.getByTestId('state-plan')).toContainText('Free');
  await expect(page.getByTestId('state-quota')).toContainText('Limit reached');
  await expect(frame.getByTestId('quota-status-notice')).toContainText('Limit reached');
  await expect(frame.getByTestId('quota-premium-status-button')).toBeVisible();
  await expect(frame.getByTestId('dashboard-link')).toContainText('Upgrade to Premium');

  await page.screenshot({
    path: testInfo.outputPath('lab-free-limit-reached.png'),
    fullPage: true,
  });

  await page.close();
});

test('renders the stuck sync warning state', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'sync-stuck');

  await expect(page.getByTestId('state-sync')).toContainText('In progress');
  await expect(frame.getByTestId('sync-status-label')).toContainText('Sync may be stuck');
  await expect(frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Acme AI' }).first()).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('lab-sync-stuck.png'),
    fullPage: true,
  });

  await page.close();
});

test('shows a visible refresh error and keeps the inbox usable when refresh fails', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'refresh-failure');
  const northstarThread = frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Northstar Labs' }).first();

  await expect(page.getByTestId('state-auth')).toContainText('Signed in');
  await expect(frame.getByTestId('refresh-button')).toBeVisible();
  await expect(northstarThread).toBeVisible();

  await frame.getByTestId('refresh-button').click();

  const failureToast = frame.getByRole('status');
  await expect(failureToast).toContainText('Failed to sync emails: Mock network timeout while refreshing tracked emails.');
  await expect(frame.getByTestId('refresh-button')).toBeVisible();
  await expect(northstarThread).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('lab-refresh-failure.png'),
    fullPage: true,
  });

  await page.close();
});

test('renders premium footer behavior without a live dashboard promise', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'premium-rich');
  const premiumThread = frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Signal Labs' }).first();

  await expect(page.getByTestId('state-plan')).toContainText('Premium');
  await expect(frame.getByTestId('plan-badge')).toContainText('Premium');
  await expect(frame.getByTestId('dashboard-link')).toContainText('Premium dashboard');
  await expect(premiumThread).toBeVisible();

  // Premium members used to get NOTHING here: the teaser slot returned null for
  // them, so the 10px footer link was the only pointer to the paid surfaces and
  // trial users never found the dashboard. Guard against that regressing.
  await expect(frame.getByTestId('premium-active-card')).toBeVisible();
  await expect(frame.getByTestId('premium-active-cta')).toContainText('Open your dashboard');
  await expect(frame.getByTestId('premium-teaser')).toHaveCount(0);

  // Premium's own window, and no upgrade line.
  const coverageNote = frame.getByTestId('history-coverage-note');
  await expect(coverageNote).toContainText('your plan imports the last 180 days');
  await expect(coverageNote).not.toContainText('Premium imports');

  await page.screenshot({
    path: testInfo.outputPath('lab-premium-rich.png'),
    fullPage: true,
  });

  // Opening an in-flight thread should offer the contextual next move too.
  await premiumThread.dispatchEvent('click');
  await expect(frame.getByTestId('email-preview')).toBeVisible();
  await expect(frame.getByTestId('premium-next-move')).toBeVisible();

  await page.close();
});

test('the first application starts near the top of the popup, not halfway down', async () => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-healthy');
  await page.getByTestId('popup-preview-frame').scrollIntoViewIfNeeded();
  const root = await frame.getByTestId('extension-popup-root').boundingBox();
  const firstCard = await frame.locator('[data-testid="email-thread-card"]').first().boundingBox();
  const offset = Math.round(firstCard.y - root.y);
  console.log(`[layout] first application card starts ${offset}px below the popup top`);
  // 2026-09-26: 309px before the tiles became the filters and the date control moved into search.
  expect(offset).toBeLessThanOrEqual(230);

  // The tiles are the filters: tap one to narrow the list, tap "Show all" (or the tile again) to undo.
  const cardsBefore = await frame.locator('[data-testid="email-thread-card"]').count();
  await frame.getByTestId('main-tab-applied').click();
  await expect(frame.getByTestId('main-tab-applied')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.getByTestId('main-tab-all')).toBeVisible();
  await frame.getByTestId('main-tab-all').click();
  await expect(frame.getByTestId('main-tab-applied')).toHaveAttribute('aria-pressed', 'false');
  await expect(frame.locator('[data-testid="email-thread-card"]')).toHaveCount(cardsBefore);
  await page.close();
});

test('premium members check the job they are looking at and decide from the popup', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'premium-rich');

  // Seen a job -> check it -> decide, without copying the posting into another tab.
  // (Clicking this scenario scrolls the lab page; bring the popup preview back before measuring.)
  await page.getByTestId('popup-preview-frame').scrollIntoViewIfNeeded();
  const strip = frame.getByTestId('apply-gate-strip');
  await expect(strip).toBeInViewport();
  await expect(strip).toContainText('Senior QA Automation Engineer · Signal Labs');
  await frame.getByTestId('apply-gate-check').click();

  await expect(frame.getByTestId('apply-gate-decision')).toHaveText('Fix first');
  await expect(strip).toContainText('Close one gap, then apply');
  await expect(strip).toContainText('Add the CI/CD work you have done before sending this one.');
  await expect(strip).toContainText('no CI/CD pipeline work');
  await expect(strip).not.toContainText('A fourth reason');
  await expect(strip).toContainText('Checked against the default résumé at the time');
  await page.screenshot({ path: testInfo.outputPath('lab-apply-gate-verdict.png'), fullPage: true });

  // Same buttons as the web page, and the choice is recorded.
  await expect(frame.getByTestId('apply-gate-action-fixed')).toHaveText("I'll fix first");
  await frame.getByTestId('apply-gate-action-fixed').click();
  await expect(frame.getByTestId('apply-gate-recorded')).toContainText('fixing first');

  await page.close();
});

test('the page reader takes structured postings first and ignores pages that are not postings', async () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, '..', 'shared', 'applyGateCheck.js'), 'utf8');
  const { extractJobPostingFromPage } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  const read = async (html) => {
    const page = await context.newPage();
    await page.setContent(html);
    const result = await page.evaluate(`(${extractJobPostingFromPage.toString()})()`);
    const pwned = await page.evaluate(() => window.__pwned === 1);
    await page.close();
    return { ...result, pwned };
  };

  const jobPosting = {
    '@type': 'JobPosting',
    title: 'QA Engineer',
    hiringOrganization: { '@type': 'Organization', name: 'Acme' },
    // The <img onerror> must NOT run: the reader parses into an inert document.
    description: '<p>About the role</p><ul><li>Own the Playwright suite</li><li>Ship weekly</li></ul><img src="x" onerror="window.__pwned=1">',
  };
  const structured = await read(`<html><head><title>Jobs</title>
    <meta property="og:site_name" content="LinkedIn">
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [jobPosting] })}</script>
    </head><body><nav>Home Jobs</nav><main>noise</main></body></html>`);
  expect(structured.source).toBe('structured');
  expect(structured.title).toBe('QA Engineer');
  expect(structured.company).toBe('Acme');
  expect(structured.description).toContain('• Own the Playwright suite');
  expect(structured.looksLikeJob).toBe(true);
  expect(structured.pwned).toBe(false);

  const plain = await read(`<html><head><title>QA Lead - Beta</title><meta property="og:site_name" content="Beta Corp"></head>
    <body><h1>QA Lead</h1><main><h2>Responsibilities</h2><p>${'Lead the test strategy for the platform team. '.repeat(12)}</p>
    <h2>Qualifications</h2><p>${'Five years of automation experience with CI pipelines. '.repeat(6)}</p></main></body></html>`);
  expect(plain.source).toBe('page');
  expect(plain.title).toBe('QA Lead');
  expect(plain.company).toBe('Beta Corp');
  expect(plain.looksLikeJob).toBe(true);

  // A job-board search page names jobs but is not one posting.
  const search = await read(`<html><body><h1>Search results</h1><main>${'QA Engineer at Acme. Apply now. '.repeat(40)}</main></body></html>`);
  expect(search.looksLikeJob).toBe(false);
});

test('free users see one real read of their own search the moment the popup opens', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-rich');

  // Measured 2026-09-25: in the list footer the read started ~1,100px below a 236px viewport for a
  // full page of applications. It must be visible without any scrolling.
  const read = frame.getByTestId('search-read');
  await expect(read).toBeInViewport();
  await expect(read).toContainText('Your rejections are coming back too fast');
  await expect(read).toContainText('last 90 days');
  await expect(frame.getByTestId('search-read-cta')).toContainText('See what to do about it');
  await expect(frame.getByTestId('search-read-cta')).toBeInViewport();
  // Free users get one Apply Gate check a week on the job they are looking at (2026-09-26).
  const strip = frame.getByTestId('apply-gate-strip');
  await expect(strip).toContainText('your free check this week');
  await frame.getByTestId('apply-gate-check').click();
  await expect(frame.getByTestId('apply-gate-decision')).toHaveText('Apply');
  await expect(frame.getByTestId('apply-gate-free-used-note')).toContainText("That was this week's free check");
  // Free results name the résumé they were checked against, the same as Premium.
  await expect(frame.getByTestId('apply-gate-checked-resume')).toContainText('Checked against');
  await expect(frame.getByTestId('apply-gate-see-premium')).toBeVisible();
  // The Premium-only full read is not offered to a free user.
  await expect(frame.getByTestId('apply-gate-full-read')).toHaveCount(0);

  // The evidence is one tap away, and the recommendation is never in the free popup.
  await expect(frame.getByTestId('search-read-detail')).toHaveCount(0);
  await frame.getByTestId('search-read-why').click();
  await expect(frame.getByTestId('search-read-detail')).toContainText('timed rejections');
  await expect(frame.getByTestId('extension-popup-root')).not.toContainText('screening questions');

  // One surface for the read: the footer teaser does not repeat it.
  await expect(frame.getByTestId('premium-teaser')).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath('lab-free-search-read.png'), fullPage: true });
  await page.close();
});

test('a free user without enough data sees honest progress instead of a blur', async () => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-limit-reached');

  const progress = frame.getByTestId('search-read-progress');
  await progress.scrollIntoViewIfNeeded();
  await expect(progress).toContainText("You're at 3.");
  await expect(frame.getByTestId('premium-teaser')).toContainText('Your first search read');
  await expect(frame.getByTestId('search-read')).toHaveCount(0);

  // This week's free Apply Gate check is already used: say when the next opens, offer no check.
  await expect(frame.getByTestId('apply-gate-used')).toContainText('The next one opens');
  await expect(frame.getByTestId('apply-gate-check')).toHaveCount(0);
  await page.close();
});

const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..', 'popup', 'dist');

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

test('renders the free-plan inbox and opens a thread preview', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-rich');
  const northstarThread = frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Northstar Labs' }).first();

  await expect(frame.getByTestId('quota-status-notice')).toContainText('82/100 tracked');
  await expect(northstarThread).toBeVisible();
  await northstarThread.click();
  await expect(frame.getByTestId('email-preview')).toBeVisible();
  await expect(frame.getByText('Application Journey')).toBeVisible();
  await expect(frame.getByRole('heading', { name: /Senior Product Manager/i })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Reply' })).toHaveCount(0);

  await frame.getByTestId('popup-header-back').click();
  await expect(frame.getByTestId('refresh-button')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('lab-free-rich.png'),
    fullPage: true,
  });

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

test('free users see one real read of their own search the moment the popup opens', async ({}, testInfo) => {
  const page = await openLabPage();
  const frame = await activateScenario(page, 'free-rich');

  // Measured 2026-09-25: in the list footer the read started ~1,100px below a 236px viewport for a
  // full page of applications. It must be visible without any scrolling.
  const read = frame.getByTestId('search-read');
  await expect(read).toBeInViewport();
  await expect(read).toContainText('Your rejections are coming back too fast');
  await expect(read).toContainText('last 30 days');
  await expect(frame.getByTestId('search-read-cta')).toContainText('See what to do about it');
  await expect(frame.getByTestId('search-read-cta')).toBeInViewport();

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
  await page.close();
});

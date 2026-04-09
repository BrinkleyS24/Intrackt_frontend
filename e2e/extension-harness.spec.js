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
  await expect(frame.getByText('Welcome back')).toBeVisible();
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

  await expect(frame.getByTestId('quota-status-notice')).toContainText('approaching your tracking limit');
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
  await expect(frame.getByTestId('quota-status-notice')).toContainText('Tracking limit reached');
  await expect(frame.getByTestId('quota-premium-status-button')).toBeVisible();
  await expect(frame.getByTestId('dashboard-link')).toContainText('Premium coming soon');

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
  await expect(frame.getByTestId('dashboard-link')).toContainText('Premium status');
  await expect(premiumThread).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('lab-premium-rich.png'),
    fullPage: true,
  });

  await page.close();
});

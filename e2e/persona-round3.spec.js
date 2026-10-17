// Round-3 persona fixes (reports of 2026-10-15), run against the built extension's lab harness.
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');

const extensionPath = process.env.EXTENSION_DIST_DIR || path.resolve(__dirname, '..', 'popup', 'dist');
let context;
let extensionId;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const args = [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`];
  context = await chromium.launchPersistentContext('', {
    ...(process.env.PW_EXTENSION_EXECUTABLE_PATH
      ? { executablePath: process.env.PW_EXTENSION_EXECUTABLE_PATH }
      : { channel: process.env.PW_EXTENSION_CHANNEL || 'chromium' }),
    headless: process.env.PW_HEADLESS !== 'false',
    args,
    viewport: { width: 1480, height: 1120 },
  });
  // Assert the destination the extension opens; external site redirects/auth are a separate integration.
  await context.route(/https?:\/\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Captured destination</title>' }));
  const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  extensionId = new URL(serviceWorker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

async function openLab(scenarioId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`);
  await expect(page.getByTestId('test-harness-title')).toBeVisible();
  await page.getByTestId(`scenario-${scenarioId}`).click();
  await expect(page.getByTestId('testing-mode')).toContainText('Scenario active');
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await expect(frame.getByTestId('extension-popup-root')).toBeVisible();
  return { page, frame };
}

const tileValue = async (frame, key) => (await frame.getByTestId(`main-tab-${key}`).locator('div').first().textContent()).trim();

test('a Premium member\'s "next move" opens Interview Prep or Next Actions, not the pricing page', async () => {
  const { page, frame } = await openLab('premium-rich');
  const popup = page.frames().find(frame => frame.url().includes('/popup/public/'));
  await popup.evaluate(() => {
    window.requestedTabs = [];
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = options => { window.requestedTabs.push(options); return create(options); };
  });
  const openNextMove = async (company) => {
    await frame.locator('[data-testid="email-thread-card"]').filter({ hasText: company }).first().dispatchEvent('click');
    const nextMove = frame.getByTestId('premium-next-move');
    await expect(nextMove).toBeVisible();
    const before = await popup.evaluate(() => window.requestedTabs.length);
    await nextMove.click();
    // A Chrome tab can report its initial root document before the requested navigation.
    // Check the actual chrome.tabs.create command; remote auth/redirects are out of this fixture's scope.
    await expect.poll(() => popup.evaluate(() => window.requestedTabs.length)).toBe(before + 1);
    const url = await popup.evaluate(() => window.requestedTabs.at(-1).url);
    const { pathname } = new URL(url);
    await frame.getByTestId('popup-header-back').click();
    return pathname;
  };
  expect(await openNextMove('Signal Labs')).toBe('/interview-prep');
  expect(await openNextMove('Lattice')).toBe('/next-actions');
  // The footer link takes a member to the dashboard, not to pricing either.
  const before = await popup.evaluate(() => window.requestedTabs.length);
  await frame.getByTestId('dashboard-link').click();
  await expect.poll(() => popup.evaluate(() => window.requestedTabs.length)).toBe(before + 1);
  expect(new URL(await popup.evaluate(() => window.requestedTabs.at(-1).url)).pathname).toBe('/dashboard');
  for (const tab of context.pages()) if (tab !== page) await tab.close();
  await page.close();
});

test('the sign-in screen privacy link meets AA contrast', async () => {
  const { page, frame } = await openLab('logged-out');
  const ratio = await frame.getByTestId('login-privacy-link').evaluate((link) => {
    const channels = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    const luminance = ([r, g, b]) => {
      const c = [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    // The nearest opaque background behind the link (the footer tint is a few percent white).
    let node = link.parentElement;
    let bg = channels(getComputedStyle(node).backgroundColor);
    while (node && (bg.length === 4 && bg[3] < 0.5)) {
      node = node.parentElement;
      bg = node ? channels(getComputedStyle(node).backgroundColor) : [0, 0, 0];
    }
    const [a, b] = [luminance(channels(getComputedStyle(link).color)), luminance(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
  // rgb(19,28,48) on the navy popup measured about 1.2:1.
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  await page.close();
});

test('Misclassify starts on the current stage and saves nothing until another stage is picked', async () => {
  const { page, frame } = await openLab('free-healthy');
  await frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Acme AI' }).first().click();
  await frame.getByRole('button', { name: 'Misclassify' }).click();
  await expect(frame.getByTestId('misclassify-current-stage')).toHaveText('Interview');
  await expect(frame.getByTestId('misclassify-stage-select')).toHaveValue('interviewed');
  await expect(frame.getByTestId('misclassify-submit')).toBeDisabled();
  await frame.getByTestId('misclassify-stage-select').selectOption('applied');
  await expect(frame.getByTestId('misclassify-submit')).toBeEnabled();
  await frame.getByRole('button', { name: 'Cancel' }).click();
  await page.close();
});

test('a thread has one Close button, named for what it closes', async () => {
  const { page, frame } = await openLab('free-healthy');
  // Acme AI has been quiet for months, so the stale nudge shows and carries the only Close.
  await frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Acme AI' }).first().click();
  await expect(frame.getByTestId('stale-close-nudge')).toBeVisible();
  const preview = frame.getByTestId('email-preview');
  await expect(preview.getByRole('button', { name: 'Close application' })).toHaveCount(1);
  await expect(preview.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
  await page.close();
});

test('a manual application can be opened, closed with a reason, and reopened', async () => {
  const { page, frame } = await openLab('free-rich');
  await page.evaluate(async () => { const { userId } = await chrome.storage.local.get('userId'); await chrome.storage.local.remove(`manualApplicationDraft:${userId}`); });
  await frame.getByTestId('add-application-button').click();
  await frame.getByLabel('Company', { exact: true }).fill('Cedar Research');
  await frame.getByLabel('Role', { exact: true }).fill('Research Assistant');
  await frame.getByRole('button', { name: 'Save application', exact: true }).click();
  const card = frame.getByTestId('manual-application-card').filter({ hasText: 'Cedar Research' });
  await expect(card).toContainText('Applied');
  const closedBefore = await tileValue(frame, 'rejected');

  await card.click();
  const detail = frame.getByTestId('manual-application-detail');
  await expect(detail.getByRole('heading', { name: 'Cedar Research' })).toBeVisible();
  await frame.getByTestId('manual-close-open').click();
  await frame.getByLabel('What happened?').selectOption('Rejected verbally');
  await expect(frame.getByTestId('manual-close-panel')).toContainText('Counts as a rejection');
  await frame.getByTestId('manual-close-confirm').click();
  await expect(frame.getByTestId('manual-detail-stage')).toHaveText('Closed');
  await frame.getByTestId('popup-header-back').click();
  await expect.poll(() => tileValue(frame, 'rejected')).toBe(String(Number(closedBefore) + 1));

  await card.click();
  await frame.getByTestId('manual-reopen').click();
  await expect(frame.getByTestId('manual-detail-stage')).toHaveText('Applied');
  // Withdrew is the applicant's own choice: parked under "Closed by you", not counted as Closed.
  await frame.getByTestId('manual-close-open').click();
  await frame.getByLabel('What happened?').selectOption('Withdrew');
  await frame.getByTestId('manual-close-confirm').click();
  await expect(frame.getByTestId('manual-detail-stage')).toHaveText('Closed by you');
  await frame.getByTestId('popup-header-back').click();
  await expect.poll(() => tileValue(frame, 'rejected')).toBe(closedBefore);
  await page.close();
});

test('an empty inbox explains what happens next instead of "No emails found"', async () => {
  const { page, frame } = await openLab('empty-inbox');
  const empty = frame.getByTestId('empty-list-state');
  await expect(empty).toContainText('Your applications will show up here');
  await expect(empty).toContainText('next few hours');
  await expect(empty).toContainText('+ Add');
  await expect(frame.getByText('No emails found in this category.')).toHaveCount(0);
  await page.close();
});

test('header, labels, headings, dates and type size read as one product', async () => {
  const { page, frame } = await openLab('free-healthy');
  const wordmark = frame.getByTestId('popup-wordmark');
  await expect(wordmark).toHaveText('Applendium™');
  expect(await wordmark.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(frame.getByTestId('main-tab-interviewed')).toContainText('In interviews (now)');
  // The quota pill says it counts active applications, beside the tracked total it differs from.
  await expect(frame.getByTestId('quota-badge')).toHaveText(/^\d+\/500 active$/);
  await expect(frame.getByTestId('footer-summary')).toHaveText(/tracked applications?$/);

  const root = frame.getByTestId('extension-popup-root');
  await expect(root.locator('h1')).toHaveCount(1);
  expect(await root.locator('h2').count()).toBeGreaterThanOrEqual(2);

  // One date format: "Apr 5", never "4/5/2026".
  for (const text of await root.locator('[data-testid="email-thread-card"]').allInnerTexts()) {
    expect(text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  }

  // Body text is at least 12px; only short labels (stage chips, caps eyebrows, tile captions) are smaller.
  const small = await root.evaluate((el) => [...el.querySelectorAll('*')].filter((node) => {
    const ownText = [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim());
    if (!ownText || !node.getClientRects().length) return false;
    const style = getComputedStyle(node);
    if (parseFloat(style.fontSize) >= 12) return false;
    return !(style.textTransform === 'uppercase' || /mono/i.test(style.fontFamily)
      || node.closest('.status-badge, [data-testid^="main-tab-"], .sr-only'));
  }).map((node) => `${node.textContent.trim().slice(0, 40)} (${getComputedStyle(node).fontSize})`));
  expect(small).toEqual([]);

  // More of the list fits: at least three cards start inside the 600px popup.
  const visibleCards = await root.evaluate((el) => {
    const bottom = el.getBoundingClientRect().bottom - 40;
    return [...el.querySelectorAll('[data-testid="email-thread-card"]')].filter((card) => card.getBoundingClientRect().top < bottom).length;
  });
  expect(visibleCards).toBeGreaterThanOrEqual(3);
  await page.close();
});

test('the activity report states its counting rule and its "now" counts match the tiles', async () => {
  const { page, frame } = await openLab('free-healthy');
  const [applied, interviewed, offers, closed] = [
    await tileValue(frame, 'applied'), await tileValue(frame, 'interviewed'),
    await tileValue(frame, 'offers'), await tileValue(frame, 'rejected'),
  ];
  await frame.getByTestId('report-button').click();
  // A window covering every application, so it is the same set the tiles count.
  await frame.getByTestId('report-start-date').fill('2025-01-01');
  const now = frame.getByTestId('report-preview-now');
  await expect(now).toContainText(`Now: ${applied} awaiting reply · ${interviewed} in interviews · ${offers} offer`);
  await expect(now).toContainText(`· ${closed} closed`);
  await expect(frame.getByTestId('report-preview')).toContainText('reached an interview (ever)');
  await expect(frame.getByTestId('report-counting-rule')).toContainText("counted the same way as the Applendium extension's tiles");
  await page.close();
});

const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const extensionPath = process.env.EXTENSION_DIST_DIR || path.resolve(__dirname, '../popup/dist');
let context, extensionId;
test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    channel: process.env.PW_EXTENSION_CHANNEL || 'chromium', headless: process.env.PW_HEADLESS !== 'false',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    viewport: { width: 1480, height: 1120 },
  });
  await context.route(/https?:\/\//, route => route.abort());
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});
test.afterAll(async () => context?.close());

async function open(scenario, responses = {}) {
  const page = await context.newPage();
  await page.addInitScript((responses) => {
    if (!location.pathname.includes('/popup/public/') || !globalThis.chrome?.runtime) return;
    window.acceptanceRequests = [];
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = async message => {
      window.acceptanceRequests.push(message);
      if (message.type in responses) return responses[message.type];
      return send(message);
    };
  }, responses);
  await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`);
  await page.evaluate(() => chrome.storage.local.remove('applendiumSelectedCategory'));
  await page.getByTestId(`scenario-${scenario}`).click();
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await expect(frame.getByTestId('extension-popup-root')).toBeVisible();
  return { page, frame };
}

for (const scenario of ['free-rich', 'free-limit-reached', 'gmail-disconnected']) {
  test(`a complete application is visible on open: ${scenario}`, async () => {
    const { page, frame } = await open(scenario);
    await expect(frame.getByTestId('email-thread-card').first()).toBeVisible();
    const complete = await frame.getByTestId('email-thread-card').first().evaluate(card => {
      const rect = card.getBoundingClientRect(); let bottom = 600;
      for (let parent = card.parentElement; parent; parent = parent.parentElement) {
        if (/auto|hidden/.test(getComputedStyle(parent).overflowY)) bottom = Math.min(bottom, parent.getBoundingClientRect().bottom);
      }
      return rect.top >= 0 && rect.bottom <= bottom;
    });
    expect(complete).toBe(true);
    await expect(frame.getByTestId('list-search-input')).toBeVisible();
    await page.close();
  });
}

test('denied authorization never requests catch-up or announces success', async () => {
  const { page, frame } = await open('gmail-disconnected');
  const popup = page.frames().find(frame => frame.url().includes('/popup/public/'));
  await popup.evaluate(() => {
    window.acceptanceNotices = [];
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('[role="status"]')) window.acceptanceNotices.push(node.innerText);
    }).observe(document.body, { subtree: true, childList: true });
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = message => message.type === 'LOGIN_GOOGLE_OAUTH'
      ? Promise.resolve({ success: false, error: 'Authorization denied' }) : send(message);
  });
  await frame.getByTestId('gmail-reconnect-button').click();
  await expect(frame.getByTestId('gmail-reconnect-banner')).toBeVisible();
  await page.waitForTimeout(3700); // The old success message was queued behind the failure toast.
  const evidence = await popup.evaluate(() => ({ notices: window.acceptanceNotices, requests: window.acceptanceRequests }));
  expect(evidence.notices.join(' ')).not.toMatch(/Gmail reconnected/);
  expect(evidence.requests.filter(message => message.type === 'FETCH_NEW_EMAILS')).toHaveLength(0);
  await page.close();
});

test('a failed manual source cannot produce a complete-looking download', async () => {
  const { page, frame } = await open('free-rich', { LIST_MANUAL_APPLICATIONS: { success: false, error: 'Manual records unavailable' } });
  await frame.getByTestId('report-button').click();
  await frame.getByTestId('report-start-date').fill('2026-03-01');
  await frame.getByTestId('report-end-date').fill('2026-05-01');
  await expect(frame.getByTestId('report-preview')).toContainText('Incomplete preview');
  await expect(frame.getByTestId('report-download-button')).toBeDisabled();
  await expect(frame.getByRole('button', { name: 'Retry loading applications' })).toBeVisible();
  await page.close();
});

test('a failed review correction keeps the record available for retry', async () => {
  const email = { id: 103, thread_id: 'atlas-staff-engineer', category: 'applied', subject: 'Application received', body: 'Thanks for applying', from: 'jobs@example.test' };
  const { page, frame } = await open('free-rich', {
    FETCH_REVIEW_QUEUE: { success: true, emails: [email] },
    REPORT_MISCLASSIFICATION: { success: false, error: 'Correction unavailable' },
  });
  await frame.getByTestId('needs-review-banner').click();
  await frame.getByTestId('review-lane-item').getByRole('button', { name: 'Interviewed', exact: true }).click();
  await expect(frame.getByTestId('review-lane-item')).toHaveCount(1);
  await expect(frame.getByTestId('review-lane-item').getByRole('button', { name: 'Interviewed', exact: true })).toBeEnabled();
  await expect(frame.getByText("You're all caught up", { exact: true })).toHaveCount(0);
  await page.close();
});

test('a saved correction exposes a working Undo', async () => {
  const { page, frame } = await open('free-rich');
  await frame.getByTestId('email-thread-card').filter({ hasText: 'Northstar Labs' }).first().click();
  await frame.getByRole('button', { name: 'Misclassify', exact: true }).click();
  await frame.getByTestId('misclassify-stage-select').selectOption('irrelevant');
  await frame.getByTestId('misclassify-submit').click();
  await expect(frame.locator('#undo-btn')).toBeVisible();
  expect(await page.evaluate(async () => (await chrome.storage.local.get('appliedEmails')).appliedEmails.some(email => email.id === 101))).toBe(false);
  await frame.locator('#undo-btn').click();
  await expect.poll(() => page.evaluate(async () => (await chrome.storage.local.get('appliedEmails')).appliedEmails.some(email => email.id === 101))).toBe(true);
  await expect(frame.getByTestId('email-thread-card').filter({ hasText: 'Northstar Labs' })).toHaveCount(1);
  await page.close();
});

test('the report traps focus, closes with Escape and restores its opener', async () => {
  const { page, frame } = await open('free-rich');
  await frame.getByTestId('report-button').click();
  const close = frame.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  await close.press('Shift+Tab');
  await expect(frame.getByTestId('report-end-date')).toBeFocused(); // Empty current-date range disables Download.
  await page.keyboard.press('Escape');
  await expect(frame.getByTestId('report-modal')).toHaveCount(0);
  await expect(frame.getByTestId('report-button')).toBeFocused();
  await page.close();
});

test('failed undo retains its retry control', async () => {
  const { page, frame } = await open('free-rich', { UNDO_MISCLASSIFICATION: { success: false, error: 'Undo unavailable' } });
  await frame.getByTestId('email-thread-card').filter({ hasText: 'Northstar Labs' }).first().click();
  await frame.getByRole('button', { name: 'Misclassify', exact: true }).click();
  await frame.getByTestId('misclassify-stage-select').selectOption('irrelevant');
  await frame.getByTestId('misclassify-submit').click();
  await frame.locator('#undo-btn').click();
  await expect(frame.locator('#undo-btn')).toBeVisible();
  expect(await page.evaluate(async () => (await chrome.storage.local.get('appliedEmails')).appliedEmails.some(email => email.id === 101))).toBe(false);
  await page.close();
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..', 'popup', 'dist');

function getLaunchOptions() {
  return {
    channel: process.env.PW_EXTENSION_CHANNEL || 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    viewport: { width: 1440, height: 1000 },
  };
}

function isFailureToast(message) {
  const normalized = (message || '').toLowerCase();
  return normalized.includes('failed') || normalized.includes('error');
}

async function collectDebugSnapshot(context, popupPage) {
  const pages = context.pages();
  const googlePage = pages.find((page) => page.url().startsWith('https://accounts.google.com/'));
  const pageUrls = pages.map((page) => page.url());

  let googleTitle = '';
  let googleBody = '';
  if (googlePage) {
    googleTitle = await googlePage.title().catch(() => '');
    googleBody = await googlePage.locator('body').innerText().catch(() => '');
  }

  const popupBody = await popupPage.locator('body').innerText().catch(() => '');
  const storageState = await popupPage.evaluate(async () => {
    const result = await chrome.storage.local.get(['userEmail', 'userName', 'userId', 'userPlan']);
    return result;
  }).catch(() => ({}));

  return {
    pageUrls,
    googleTitle,
    googleBody: (googleBody || '').replace(/\s+/g, ' ').trim().slice(0, 800),
    popupBody: (popupBody || '').replace(/\s+/g, ' ').trim().slice(0, 800),
    storageState,
  };
}

async function waitForStatusToast(popupPage, timeoutMs = 20_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const toast = popupPage.locator('[role="status"]').last();
    if (await toast.count()) {
      const text = (await toast.textContent())?.trim() || '';
      if (text) return text;
    }
    await popupPage.waitForTimeout(250);
  }

  return '';
}

async function main() {
  const context = await chromium.launchPersistentContext('', getLaunchOptions());

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = new URL(serviceWorker.url()).host;
    const popupPage = await context.newPage();
    const popupUrl = `chrome-extension://${extensionId}/popup/public/index.html`;

    popupPage.on('console', async (message) => {
      try {
        console.log(`[popup-console][${message.type()}] ${message.text()}`);
      } catch (_) {}
    });

    context.on('page', async (page) => {
      try {
        await page.bringToFront();
        console.log(`[smoke] new page opened: ${page.url()}`);
      } catch (_) {}
    });

    await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await popupPage.locator('[data-testid="extension-popup-root"]').waitFor({ timeout: 30_000 });
    await popupPage.getByTestId('login-google-button').waitFor({ timeout: 30_000 });

    console.log('[smoke] popup loaded in logged-out state');
    console.log('[smoke] a browser window is open; complete the Google sign-in flow if prompted');

    await popupPage.getByTestId('login-google-button').click();

    await popupPage.getByTestId('plan-badge').waitFor({ timeout: 480_000 });
    const planBadge = ((await popupPage.getByTestId('plan-badge').textContent()) || '').trim();
    console.log(`[smoke] login completed, plan badge: ${planBadge}`);

    await popupPage.getByTestId('refresh-button').waitFor({ timeout: 30_000 });
    await popupPage.getByTestId('refresh-button').click();

    const toastMessage = await waitForStatusToast(popupPage);
    if (toastMessage) {
      console.log(`[smoke] refresh toast: ${toastMessage}`);
      if (isFailureToast(toastMessage)) {
        throw new Error(`Refresh failed: ${toastMessage}`);
      }
    } else {
      console.log('[smoke] no refresh toast observed within timeout');
    }

    await popupPage.getByRole('button', { name: 'Sign out' }).click();
    await popupPage.getByTestId('login-google-button').waitFor({ timeout: 30_000 });
    console.log('[smoke] logout returned the popup to signed-out state');
  } catch (error) {
    try {
      const snapshot = await collectDebugSnapshot(context, context.pages().find((page) => page.url().startsWith('chrome-extension://')) || context.pages()[0]);
      console.error('[smoke] debug snapshot:', JSON.stringify(snapshot, null, 2));
    } catch (snapshotError) {
      console.error('[smoke] failed to collect debug snapshot');
      console.error(snapshotError);
    }
    throw error;
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('[smoke] production extension smoke check failed');
  console.error(error);
  process.exitCode = 1;
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  getBuildTargetHint,
  getExtensionConfigValue,
  normalizeExtensionConfigValue,
} from './lib/extensionEnv.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const smokeStartedAt = new Date();

function resolveDistDir() {
  const explicitDistDir = process.env.EXTENSION_DIST_DIR || process.env.DIST_DIR;
  return path.resolve(projectRoot, explicitDistDir || 'popup/dist_prod');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} is missing: ${filePath}`);
  }
}

function sanitizeFileName(value) {
  return String(value || '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function createArtifactDir() {
  const timestamp = smokeStartedAt
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
  return fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMP || path.resolve(projectRoot, '.tmp'), `applendium-prod-smoke-${timestamp}-`));
}

function getLaunchOptions(extensionPath) {
  return {
    channel: process.env.PW_EXTENSION_CHANNEL || 'chromium',
    headless: process.env.PW_HEADLESS === 'true',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    viewport: { width: 1440, height: 1000 },
  };
}

function isFailureText(value) {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('failed')
    || normalized.includes('error')
    || normalized.includes('unable')
    || normalized.includes('expired')
    || normalized.includes('permission')
    || normalized.includes('denied');
}

function buildPopupUrl(extensionId, manifest) {
  const popupPath = manifest?.action?.default_popup || 'popup/public/index.html';
  return `chrome-extension://${extensionId}/${popupPath}`;
}

function assertSmokeAuthPrerequisites(manifest, extensionPath) {
  const buildTarget = getBuildTargetHint(extensionPath);
  const hasOAuthClient = Boolean(normalizeExtensionConfigValue(manifest?.oauth2?.client_id));
  if (!hasOAuthClient) return { buildTarget, expectedExtensionId: '' };

  const manifestKey = normalizeExtensionConfigValue(manifest?.key);
  if (!manifestKey) {
    throw new Error(
      `OAuth smoke is invalid for this ${buildTarget} build because manifest.key is missing. ` +
      `An unpacked extension without a stable manifest key gets a random extension ID, which breaks the Google redirect URI. ` +
      `Set EXTENSION_MANIFEST_KEY${buildTarget === 'production' ? '_PROD' : '_LOCAL'} or EXTENSION_MANIFEST_KEY, rebuild, and rerun the smoke check.`
    );
  }

  const expectedExtensionId = getExtensionConfigValue('EXTENSION_EXPECTED_ID', { buildTarget });

  return {
    buildTarget,
    expectedExtensionId,
  };
}

async function waitForStatusToast(popupPage, timeoutMs = 20_000) {
  const start = Date.now();

  while ((Date.now() - start) < timeoutMs) {
    const toast = popupPage.locator('[role="status"]').last();
    if (await toast.count()) {
      const text = (await toast.textContent())?.trim() || '';
      if (text) return text;
    }
    await popupPage.waitForTimeout(250);
  }

  return '';
}

async function captureStorageState(popupPage) {
  return popupPage.evaluate(async () => {
    const keys = [
      'userEmail',
      'userName',
      'userId',
      'userPlan',
      'quotaData',
      'categoryTotals',
      'appliedEmails',
      'interviewedEmails',
      'offersEmails',
      'rejectedEmails',
      'irrelevantEmails',
    ];
    return chrome.storage.local.get(keys);
  }).catch(() => ({}));
}

async function writeDebugSnapshot(artifactDir, popupPage, extra = {}) {
  const popupBody = await popupPage.locator('body').innerText().catch(() => '');
  const snapshot = {
    capturedAt: new Date().toISOString(),
    popupUrl: popupPage.url(),
    popupBody: String(popupBody || '').replace(/\s+/g, ' ').trim().slice(0, 4000),
    storage: await captureStorageState(popupPage),
    ...extra,
  };

  const outputPath = path.join(artifactDir, 'debug-snapshot.json');
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
  return outputPath;
}

async function saveScreenshot(page, artifactDir, name) {
  const filename = `${sanitizeFileName(name)}.png`;
  const outputPath = path.join(artifactDir, filename);
  await page.screenshot({ path: outputPath, fullPage: true }).catch(() => {});
  return outputPath;
}

async function captureOpenPages(context, artifactDir) {
  const snapshots = [];

  for (const [index, page] of context.pages().entries()) {
    const url = page.url();
    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const screenshotPath = await saveScreenshot(page, artifactDir, `page-${index + 1}-${title || url || 'untitled'}`);

    snapshots.push({
      index,
      url,
      title,
      screenshotPath,
      bodyText: String(bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 4000),
    });
  }

  return snapshots;
}

async function assertFreshProfile(popupPage) {
  const storage = await captureStorageState(popupPage);
  if (storage?.userEmail || storage?.userId || storage?.userPlan || storage?.quotaData) {
    throw new Error(`Fresh-profile check failed: popup started with cached auth/quota state ${JSON.stringify(storage)}`);
  }
}

async function reopenPopup(context, popupUrl) {
  const popupPage = await context.newPage();
  await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popupPage.getByTestId('extension-popup-root').waitFor({ timeout: 30_000 });
  return popupPage;
}

async function main() {
  const extensionPath = resolveDistDir();
  const manifestPath = path.join(extensionPath, 'manifest.json');
  ensureExists(extensionPath, 'Extension build output directory');
  ensureExists(manifestPath, 'Built manifest');

  const manifest = readJson(manifestPath);
  const artifactDir = createArtifactDir();
  const smokeAuthConfig = assertSmokeAuthPrerequisites(manifest, extensionPath);
  const report = {
    startedAt: smokeStartedAt.toISOString(),
    extensionPath,
    manifestVersion: manifest.version,
    artifactDir,
    userDataDir: '(playwright-temp-profile)',
    buildTarget: smokeAuthConfig.buildTarget,
    expectedExtensionId: smokeAuthConfig.expectedExtensionId || null,
    openedPages: [],
    authFlowError: null,
    popupConsoleErrors: [],
    popupPageErrors: [],
  };

  const context = await chromium.launchPersistentContext('', getLaunchOptions(extensionPath));

  try {
    let extensionId = smokeAuthConfig.expectedExtensionId || '';
    if (!extensionId) {
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker');
      }
      extensionId = new URL(serviceWorker.url()).host;
    }

    const popupUrl = buildPopupUrl(extensionId, manifest);
    report.extensionId = extensionId;
    report.popupUrl = popupUrl;

    context.on('page', (page) => {
      const url = page.url();
      report.openedPages.push(url);
      console.log(`[smoke] page opened: ${url}`);

      page.on('load', async () => {
        const loadedUrl = page.url();
        try {
          const title = await page.title().catch(() => '');
          console.log(`[smoke] page loaded: ${loadedUrl} title=${title}`);
          if (!loadedUrl.startsWith('chrome-extension://')) {
            await saveScreenshot(page, artifactDir, `auth-page-${title || loadedUrl}`);
          }
        } catch (_) {
          // ignore auth-page diagnostic capture failures
        }
      });
    });

    const popupPage = await reopenPopup(context, popupUrl);
    popupPage.on('console', (message) => {
      const text = message.text();
      if (text.includes('[popup][auth-stage] login_error')) {
        report.authFlowError = text;
      }
      if (message.type() === 'error') {
        report.popupConsoleErrors.push(text);
      }
      console.log(`[smoke][popup-console][${message.type()}] ${text}`);
    });
    popupPage.on('pageerror', (error) => {
      report.popupPageErrors.push(error?.message || String(error));
      console.error(`[smoke][popup-pageerror] ${error?.message || error}`);
    });

    await popupPage.getByTestId('login-google-button').waitFor({ timeout: 30_000 });
    await assertFreshProfile(popupPage);
    report.initialStorage = await captureStorageState(popupPage);
    await saveScreenshot(popupPage, artifactDir, '01-logged-out');
    console.log('[smoke] fresh profile confirmed; popup opened in logged-out state');

    console.log('[smoke] complete the Google sign-in flow in the opened browser window if prompted');
    await popupPage.getByTestId('login-google-button').click();

    try {
      await popupPage.getByTestId('plan-badge').waitFor({ timeout: 480_000 });
    } catch (error) {
      if (report.authFlowError) {
        throw new Error(report.authFlowError);
      }
      throw error;
    }
    report.postLoginStorage = await captureStorageState(popupPage);
    report.planBadge = ((await popupPage.getByTestId('plan-badge').textContent()) || '').trim();
    await saveScreenshot(popupPage, artifactDir, '02-post-login');
    console.log(`[smoke] login completed; plan badge=${report.planBadge}`);

    const signedInToast = await waitForStatusToast(popupPage, 15_000);
    if (signedInToast) {
      report.postLoginToast = signedInToast;
      console.log(`[smoke] post-login toast: ${signedInToast}`);
      if (isFailureText(signedInToast)) {
        throw new Error(`Login flow surfaced failure toast: ${signedInToast}`);
      }
    }

    await popupPage.getByTestId('refresh-button').waitFor({ timeout: 30_000 });
    const syncLabelBeforeRefresh = ((await popupPage.getByTestId('sync-status-label').textContent()) || '').trim();
    report.syncLabelBeforeRefresh = syncLabelBeforeRefresh;
    await popupPage.getByTestId('refresh-button').click();

    const refreshToast = await waitForStatusToast(popupPage, 20_000);
    report.refreshToast = refreshToast;
    if (refreshToast) {
      console.log(`[smoke] refresh toast: ${refreshToast}`);
      if (isFailureText(refreshToast)) {
        throw new Error(`Refresh surfaced failure toast: ${refreshToast}`);
      }
    } else {
      console.log('[smoke] no refresh toast observed within timeout');
    }

    await popupPage.waitForTimeout(5_000);
    const syncLabelAfterRefresh = ((await popupPage.getByTestId('sync-status-label').textContent()) || '').trim();
    report.syncLabelAfterRefresh = syncLabelAfterRefresh;
    if (isFailureText(syncLabelAfterRefresh)) {
      throw new Error(`Refresh left popup in failure state: ${syncLabelAfterRefresh}`);
    }
    await saveScreenshot(popupPage, artifactDir, '03-post-refresh');

    await popupPage.getByRole('button', { name: 'Sign out' }).click();
    await popupPage.getByTestId('login-google-button').waitFor({ timeout: 30_000 });
    report.postLogoutStorage = await captureStorageState(popupPage);
    await saveScreenshot(popupPage, artifactDir, '04-post-logout');
    console.log('[smoke] logout returned the popup to signed-out state');

    await popupPage.close();
    const reopenedPopup = await reopenPopup(context, popupUrl);
    await reopenedPopup.getByTestId('login-google-button').waitFor({ timeout: 30_000 });
    report.reopenedStorage = await captureStorageState(reopenedPopup);
    await saveScreenshot(reopenedPopup, artifactDir, '05-reopened-after-logout');
    await reopenedPopup.close();
    console.log('[smoke] reopening the popup after logout preserved the signed-out state');

    if (report.popupConsoleErrors.length > 0 || report.popupPageErrors.length > 0) {
      throw new Error(`Popup emitted runtime errors during smoke run. consoleErrors=${report.popupConsoleErrors.length} pageErrors=${report.popupPageErrors.length}`);
    }

    report.completedAt = new Date().toISOString();
    report.result = 'passed';
    const reportPath = path.join(artifactDir, 'smoke-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('[smoke] production extension smoke check passed');
    console.log(`[smoke] report: ${reportPath}`);

    await context.close();
  } catch (error) {
    report.completedAt = new Date().toISOString();
    report.result = 'failed';
    report.error = {
      message: error?.message || String(error),
      stack: error?.stack || null,
    };
    report.openPageSnapshots = await captureOpenPages(context, artifactDir).catch(() => []);

    const popupPage = context.pages().find((page) => page.url().startsWith('chrome-extension://'));
    if (popupPage) {
      await saveScreenshot(popupPage, artifactDir, 'failure-popup');
      await writeDebugSnapshot(artifactDir, popupPage, report);
    } else {
      const reportPath = path.join(artifactDir, 'debug-snapshot.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }

    const reportPath = path.join(artifactDir, 'smoke-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.error('[smoke] production extension smoke check failed');
    console.error(`[smoke] artifacts: ${artifactDir}`);
    throw error;
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

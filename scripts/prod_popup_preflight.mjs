import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const extensionPath = path.resolve(process.env.EXTENSION_DIST_DIR || 'popup/dist_prod');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 30_000 });
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  const cspErrors = [];
  page.on('console', message => {
    if (/content security policy|violates.*script-src/i.test(message.text())) cspErrors.push(message.text());
  });
  page.on('pageerror', error => cspErrors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/${manifest.action.default_popup}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-google-button').waitFor({ timeout: 30_000 });
  const build = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_BUILD_INFO' }));
  const backend = build?.runtime?.backendBaseUrl;
  if (backend !== 'https://applendium-backend-277330820484.us-central1.run.app') {
    throw new Error(`Production popup uses unexpected backend: ${backend || '(missing)'}`);
  }
  if (cspErrors.length) throw new Error(`Popup CSP/page errors: ${cspErrors.join('; ')}`);
  console.log(`Production popup preflight passed: version ${manifest.version}, extension ID ${extensionId}, new backend.`);
} finally {
  await context.close();
}

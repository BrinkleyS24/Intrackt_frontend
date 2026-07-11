// QA driver for the review-ask card: seeds an 8-day-old tenure clock, loads
// the free-rich scenario (82 tracked applications), verifies the card shows,
// exercises dismiss persistence, then verifies the negative case (free-healthy
// has 6 tracked, below the 10 threshold).
// Run: node scripts/verify_review_ask.mjs
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const extensionPath = path.resolve(process.env.PW_EXTENSION_PATH || path.join(rootDir, 'popup', 'dist'));
const outDir = path.join(rootDir, 'test-results', 'review-ask');

async function openLab(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('test-harness-title').waitFor();
  return page;
}

async function activate(page, scenarioId) {
  await page.getByTestId(`scenario-${scenarioId}`).click();
  await page.getByTestId('testing-mode').waitFor();
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await frame.getByTestId('extension-popup-root').waitFor();
  return frame;
}

async function seedTenure(page, daysAgo) {
  await page.evaluate(async (ms) => {
    await chrome.storage.local.set({ reviewAskState: { eligibleSince: Date.now() - ms } });
  }, daysAgo * 24 * 60 * 60 * 1000);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: process.env.PW_HEADLESS !== 'false',
    viewport: { width: 1568, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;
    const page = await openLab(context, extensionId);

    // Positive case: 8-day tenure + 82 tracked -> card shows.
    await seedTenure(page, 8);
    let frame = await activate(page, 'free-rich');
    await frame.getByTestId('review-ask-card').waitFor({ timeout: 10000 });
    console.log('POSITIVE: card visible on free-rich with 8-day tenure');
    await page.screenshot({ path: path.join(outDir, 'review-ask-visible.png') });

    // Dismiss persists: click "No thanks", reload scenario, card must stay gone.
    await frame.getByTestId('review-ask-dismiss').click();
    await frame.getByTestId('review-ask-card').waitFor({ state: 'detached', timeout: 5000 });
    frame = await activate(page, 'free-rich');
    const stillGone = await frame.getByTestId('review-ask-card').count();
    if (stillGone !== 0) throw new Error('card reappeared after dismissal');
    console.log('DISMISS: answer persisted, card retired after reload');

    // Negative case: fresh tenure clock but only 6 tracked (free-healthy).
    await seedTenure(page, 8);
    frame = await activate(page, 'free-healthy');
    await frame.getByTestId('extension-popup-root').waitFor();
    await page.waitForTimeout(1500);
    const belowThreshold = await frame.getByTestId('review-ask-card').count();
    if (belowThreshold !== 0) throw new Error('card showed below the 10-application threshold');
    console.log('NEGATIVE: card hidden at 6 tracked applications');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('VERIFY_FAILED:', error.message);
  process.exit(1);
});

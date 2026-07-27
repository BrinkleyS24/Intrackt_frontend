// QA driver for the Gmail reconnect banner: loads the gmail-disconnected
// scenario and verifies the banner leads the popup with an honest duration,
// then verifies the negative case (a healthy scenario must show nothing).
//
// The negative case is the one that matters. A banner that appears for working
// accounts is the same self-inflicted harm the backfill nearly caused on
// 2026-07-27, just rendered instead of written.
//
// Run: node scripts/verify_gmail_reconnect.mjs
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const extensionPath = path.resolve(process.env.PW_EXTENSION_PATH || path.join(rootDir, 'popup', 'dist'));
const outDir = path.join(rootDir, 'test-results', 'gmail-reconnect');

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

    // Positive case: dead token -> banner leads the popup.
    let frame = await activate(page, 'gmail-disconnected');
    const banner = frame.getByTestId('gmail-reconnect-banner');
    await banner.waitFor({ timeout: 10000 });
    const copy = (await banner.textContent()) || '';
    console.log(`POSITIVE: banner visible — ${copy.replace(/\s+/g, ' ').trim()}`);

    if (!/\d+ days/.test(copy)) throw new Error(`banner omitted the duration: ${copy}`);
    if (!/Reconnect/.test(copy)) throw new Error('banner has no reconnect action');
    for (const alarming of ['deleted', 'lost your', 'suspended']) {
      if (copy.toLowerCase().includes(alarming)) throw new Error(`banner copy reads as data loss: "${alarming}"`);
    }

    // It has to outrank Needs Review: nothing new is arriving at all, so
    // triaging the existing backlog is the lesser ask.
    const order = await frame.locator('[data-testid="gmail-reconnect-banner"], [data-testid="needs-review-banner"]')
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.testid));
    if (order[0] !== 'gmail-reconnect-banner') {
      throw new Error(`reconnect banner is not first in the popup: ${order.join(' -> ')}`);
    }
    console.log(`ORDER: ${order.join(' -> ')}`);

    // The header must not claim "synced" above a banner saying we cannot see
    // the inbox. The last sync did complete, so the timestamp is not lying —
    // but a green pill is the stale-but-healthy signal that hid this for months.
    const pill = ((await frame.getByTestId('sync-status-label').textContent()) || '').trim();
    if (/^synced$/i.test(pill)) throw new Error(`header still reads "${pill}" while disconnected`);
    console.log(`HEADER: reads "${pill}"`);

    // Capture the popup iframe itself; a full-page shot is mostly lab chrome.
    await page.locator('[data-testid="popup-preview-frame"]')
      .screenshot({ path: path.join(outDir, 'gmail-reconnect-banner.png') });

    // Negative case: a healthy scenario must render nothing at all.
    frame = await activate(page, 'free-rich');
    await page.waitForTimeout(1500);
    const onHealthy = await frame.getByTestId('gmail-reconnect-banner').count();
    if (onHealthy !== 0) throw new Error('banner showed for a healthy connection');
    console.log('NEGATIVE: nothing rendered for a healthy connection');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('VERIFY_FAILED:', error.message);
  process.exit(1);
});

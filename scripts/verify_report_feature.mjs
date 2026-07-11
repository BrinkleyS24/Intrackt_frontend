// One-off QA driver for the Job Search Activity Report: loads the built
// extension in the testing lab, opens the report modal on the free-healthy
// scenario, verifies the preview counts, and downloads the real PDF.
// Run: node scripts/verify_report_feature.mjs
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const extensionPath = path.resolve(process.env.PW_EXTENSION_PATH || path.join(rootDir, 'popup', 'dist'));
const outDir = path.join(rootDir, 'test-results', 'report-feature');

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: process.env.PW_HEADLESS !== 'false',
    viewport: { width: 1568, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('test-harness-title').waitFor();
    await page.getByTestId('scenario-free-healthy').click();
    await page.getByTestId('testing-mode').waitFor();
    const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
    await frame.getByTestId('extension-popup-root').waitFor();

    // Open the report modal from the header.
    await frame.getByTestId('report-button').click();
    await frame.getByTestId('report-modal').waitFor();

    // Scenario emails are dated Mar-Apr 2026; widen the range to cover them.
    await frame.getByTestId('report-start-date').fill('2026-03-01');
    await frame.getByTestId('report-end-date').fill('2026-07-11');
    const preview = await frame.getByTestId('report-preview').innerText();
    console.log('PREVIEW:', preview.replace(/\s+/g, ' ').trim());

    await page.screenshot({ path: path.join(outDir, 'report-modal.png') });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await frame.getByTestId('report-download-button').click();
    const download = await downloadPromise;
    const pdfPath = path.join(outDir, download.suggestedFilename());
    await download.saveAs(pdfPath);
    console.log('PDF_SAVED:', pdfPath);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('VERIFY_FAILED:', error.message);
  process.exit(1);
});

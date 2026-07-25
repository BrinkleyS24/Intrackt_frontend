import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..', 'popup', 'dist');
const outDir = path.resolve(__dirname, '..', '.premium-active-shots');

async function main() {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    viewport: { width: 1480, height: 1120 },
  });

  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extensionId = new URL(sw.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`);
  await page.getByTestId('test-harness-title').waitFor();

  // Premium plan, logged in, 3 tracked applications.
  await page.getByTestId('scenario-premium-rich').click();
  await page.getByTestId('testing-mode').filter({ hasText: 'Scenario active' }).waitFor();

  const frameEl = await page.waitForSelector('[data-testid="popup-preview-frame"]');
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await frame.getByTestId('extension-popup-root').waitFor();

  // Shot 1: All view — premium members should now see the active card, not nothing.
  await frame.getByTestId('premium-active-card').waitFor({ timeout: 10_000 });
  await frame.getByTestId('premium-active-card').scrollIntoViewIfNeeded();
  await frameEl.screenshot({ path: path.join(outDir, '01-premium-active-card.png') });
  console.log('Captured premium active card (All view).');

  // Shot 2: open an interviewed thread → premium contextual next-move block.
  const signalCard = frame
    .locator('[data-testid="email-thread-card"]')
    .filter({ hasText: 'Signal Labs' })
    .first();
  await signalCard.scrollIntoViewIfNeeded();
  await signalCard.dispatchEvent('click');
  await frame.getByTestId('email-preview').waitFor();
  const nextMove = frame.getByTestId('premium-next-move');
  await nextMove.waitFor({ timeout: 10_000 });
  await nextMove.scrollIntoViewIfNeeded();
  await frameEl.screenshot({ path: path.join(outDir, '02-premium-next-move.png') });
  console.log('Captured premium next-move block (email preview).');

  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

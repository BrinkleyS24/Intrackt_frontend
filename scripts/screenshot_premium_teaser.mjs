import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..', 'popup', 'dist');
const outDir = path.resolve(__dirname, '..', '.premium-teaser-shots');

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

  // Activate the free-rich scenario (logged-in free user, 6 tracked apps).
  await page.getByTestId('scenario-free-rich').click();
  await page.getByTestId('testing-mode').filter({ hasText: 'Scenario active' }).waitFor();

  const frameEl = await page.waitForSelector('[data-testid="popup-preview-frame"]');
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await frame.getByTestId('extension-popup-root').waitFor();

  // Shot 1: All view — should show the PremiumTeaserCard.
  await frame.getByText('Premium insights ready').waitFor({ timeout: 10_000 });
  await frameEl.screenshot({ path: path.join(outDir, '01-teaser-card.png') });
  console.log('Captured teaser card (All view).');

  // Shot 2: open an applied thread → locked Apply Gate card.
  // Dispatch the click directly: in the harness iframe the thread row can sit
  // under the popup's sticky header/footer, so a coordinate-based click gets
  // intercepted even though the element is the right one.
  const northstarCard = frame
    .locator('[data-testid="email-thread-card"]')
    .filter({ hasText: 'Northstar Labs' })
    .first();
  await northstarCard.scrollIntoViewIfNeeded();
  await northstarCard.dispatchEvent('click');
  await frame.getByTestId('email-preview').waitFor();
  const nextMoveHeading = frame.getByText('Your next move on this');
  await nextMoveHeading.waitFor({ timeout: 10_000 });
  // Scroll the preview so the locked next-move card is in view before the shot.
  await nextMoveHeading.scrollIntoViewIfNeeded();
  await frameEl.screenshot({ path: path.join(outDir, '02-apply-gate-locked.png') });
  console.log('Captured locked Apply Gate card (email preview).');

  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

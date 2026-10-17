const path = require('node:path');
const { chromium, test, expect } = require('@playwright/test');
const dist = process.env.EXTENSION_DIST_DIR || path.resolve(__dirname, '../popup/dist');

for (const mode of ['normal fonts', 'blocked fonts', 'enlarged text']) {
  test(`onboarding content and sign-in are keyboard reachable: ${mode}`, async () => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true, viewport: { width: 400, height: 600 },
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
    try {
      if (mode === 'blocked fonts') await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.abort());
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      const page = await context.newPage();
      await page.goto(`chrome-extension://${new URL(worker.url()).host}/popup/public/index.html`);
      const signIn = page.getByTestId('login-google-button');
      await signIn.waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (mode === 'enlarged text') await page.evaluate(() => {
        const sizes = [...document.querySelectorAll('p,h1,li,button')].map(e => [e, parseFloat(getComputedStyle(e).fontSize)]);
        for (const [e, size] of sizes) e.style.fontSize = `${size * 1.5}px`;
      });
      const region = page.getByRole('region', { name: 'About Applendium and Gmail access' });
      await page.keyboard.press('Tab');
      await expect(region).toBeFocused();
      expect(await region.evaluate(e => parseFloat(getComputedStyle(e).outlineWidth))).toBeGreaterThanOrEqual(2);
      await page.keyboard.press('End');
      await expect.poll(() => region.evaluate(e => e.scrollTop > 0 && e.scrollTop + e.clientHeight >= e.scrollHeight - 2)).toBe(true);
      await page.keyboard.press('Tab');
      await expect(signIn).toBeFocused();
      const rect = await signIn.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(600);
      await page.keyboard.press('Shift+Tab');
      await expect(region).toBeFocused();
    } finally {
      await context.close();
    }
  });
}

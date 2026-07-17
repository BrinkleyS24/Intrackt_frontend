// Capture REAL extension-popup motion for the demo commercial.
// Loads the built extension in the testing lab (fixture data, no sign-in),
// records one video per beat while driving paced, deliberate interactions,
// and writes a manifest with each clip's path + the popup iframe bounding box
// so the raw lab-page video can be cropped to just the popup.
//
// Run: node scripts/capture_demo_clips.mjs
// Output: test-results/demo-clips/*.webm  +  manifest.json
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const extensionPath = path.resolve(process.env.PW_EXTENSION_PATH || path.join(rootDir, 'popup', 'dist'));
const outDir = path.join(rootDir, 'test-results', 'demo-clips');
const viewport = { width: 1568, height: 900 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openLab(context, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('test-harness-title').waitFor();
  return page;
}

async function activate(page, scenarioId) {
  await page.getByTestId(`scenario-${scenarioId}`).click();
  await page.getByTestId('testing-mode').waitFor();
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await frame.getByTestId('extension-popup-root').waitFor();
  await sleep(500);
  return frame;
}

async function popupBox(page) {
  const box = await page.locator('[data-testid="popup-preview-frame"]').boundingBox();
  return box ? { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } : null;
}

// Scroll the popup preview into view and vertically center it in the viewport,
// so the recorded video actually shows the popup (default lab layout parks it
// above the fold). Returns the corrected on-screen bounding box.
async function positionPopup(page) {
  const sel = '[data-testid="popup-preview-frame"]';
  await page.locator(sel).scrollIntoViewIfNeeded();
  await sleep(200);
  let box = await popupBox(page);
  if (box) {
    const targetY = Math.max(20, Math.round((viewport.height - box.height) / 2));
    await page.evaluate((dy) => window.scrollBy(0, dy), box.y - targetY);
    await sleep(250);
    box = await popupBox(page);
  }
  return box;
}

// scroll the popup's internal list by wheeling over its center
async function wheel(page, box, dy, steps = 6) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(90);
  }
}

const beats = [
  {
    id: 'pipeline',
    async run(page, frame) {
      const box = await positionPopup(page);
      await sleep(1600);            // hold on the sorted pipeline
      await wheel(page, box, 520);  // scroll down through the list
      await sleep(900);
      await wheel(page, box, -520); // back to top
      await sleep(900);
      return box;
    },
  },
  {
    id: 'filter',
    async run(page, frame) {
      const box = await positionPopup(page);
      await sleep(1200);
      await frame.getByTestId('main-tab-interviewed').click();
      await sleep(1800);
      // return to the full pipeline
      for (const tid of ['main-tab-all', 'main-tab-applied']) {
        const el = frame.getByTestId(tid);
        if (await el.count()) { await el.first().click(); break; }
      }
      await sleep(1400);
      return box;
    },
  },
  {
    id: 'thread',
    async run(page, frame) {
      const box = await positionPopup(page);
      await sleep(1100);
      const card = frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Northstar Labs' }).first();
      await card.click();
      await frame.getByTestId('email-preview').waitFor();
      await sleep(1800);
      await wheel(page, box, 360, 5);
      await sleep(1200);
      return box;
    },
  },
  {
    id: 'report',
    async run(page, frame) {
      const box = await positionPopup(page);
      await sleep(900);
      await frame.getByTestId('report-button').click();
      await frame.getByTestId('report-modal').waitFor();
      await sleep(400);
      await frame.getByTestId('report-start-date').fill('2026-03-01');
      await sleep(300);
      await frame.getByTestId('report-end-date').fill('2026-07-11');
      await sleep(200);
      // clear the focus highlight off the date input so the hold frame is clean
      await frame.getByTestId('report-preview').click();
      await sleep(3200);            // long hold on the live counts + enabled Download
      return box;
    },
  },
];

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: process.env.PW_HEADLESS !== 'false',
    viewport,
    recordVideo: { dir: outDir, size: viewport },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const manifest = [];
  try {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker');
    const extensionId = new URL(sw.url()).host;

    for (const beat of beats) {
      const page = await openLab(context, extensionId);
      const scenario = 'free-healthy';
      const frame = await activate(page, scenario);
      let box = null;
      try {
        box = await beat.run(page, frame);
      } catch (e) {
        console.error(`[${beat.id}] interaction error:`, e.message);
      }
      const video = page.video();
      await page.close();
      const vpath = video ? await video.path() : null;
      manifest.push({ id: beat.id, video: vpath ? path.basename(vpath) : null, box });
      console.log(`[${beat.id}] clip=${vpath ? path.basename(vpath) : 'NONE'} box=${JSON.stringify(box)}`);
    }
  } finally {
    await context.close();
  }

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('MANIFEST:', path.join(outDir, 'manifest.json'));
}

main().catch((e) => { console.error('CAPTURE_FAILED:', e); process.exit(1); });

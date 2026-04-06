import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extensionPath = path.resolve(process.env.PW_EXTENSION_PATH || path.join(rootDir, 'popup', 'dist_storelab'));
const outputDir = path.resolve(process.env.STORE_ASSET_OUTPUT_DIR || path.join(rootDir, 'chrome-store', 'assets'));
const screenshotsDir = path.join(outputDir, 'screenshots');
const promoDir = path.join(outputDir, 'promo');
const viewport = { width: 1280, height: 800 };

const STORE_CAPTURE_CSS = `
  body.store-capture {
    background:
      radial-gradient(circle at top left, rgba(15, 138, 120, 0.18), transparent 34%),
      radial-gradient(circle at bottom right, rgba(198, 113, 56, 0.16), transparent 30%),
      #f4efe7;
  }

  body.store-capture .lab-shell {
    min-height: 100vh;
    padding: 28px;
  }

  body.store-capture .lab-grid {
    grid-template-columns: minmax(320px, 360px) minmax(0, 1fr);
    gap: 24px;
    align-items: stretch;
  }

  body.store-capture .lab-sidebar,
  body.store-capture .lab-preview {
    min-height: 744px;
  }

  body.store-capture .lab-sidebar {
    position: static;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  body.store-capture .lab-kicker {
    background: rgba(15, 138, 120, 0.1);
    color: #0a695c;
  }

  body.store-capture .lab-title {
    font-size: 42px;
    max-width: 12ch;
  }

  body.store-capture .lab-copy {
    font-size: 16px;
    line-height: 1.65;
  }

  body.store-capture .store-highlights {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  body.store-capture .store-highlight {
    display: inline-flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(20, 32, 39, 0.1);
    background: rgba(255, 255, 255, 0.74);
    font-size: 12px;
    font-weight: 600;
    color: #142027;
  }

  body.store-capture .lab-section {
    margin-top: 20px;
  }

  body.store-capture .lab-section-title {
    margin-bottom: 10px;
  }

  body.store-capture .lab-state-grid {
    gap: 10px;
  }

  body.store-capture .lab-state-card,
  body.store-capture .lab-state-summary {
    background: rgba(255, 255, 255, 0.74);
  }

  body.store-capture .lab-preview {
    display: flex;
    flex-direction: column;
    padding: 22px;
  }

  body.store-capture .lab-preview-header {
    padding: 4px 2px 14px;
  }

  body.store-capture .lab-preview-title {
    font-size: 22px;
  }

  body.store-capture .lab-preview-copy {
    font-size: 14px;
    line-height: 1.6;
    max-width: 58ch;
  }

  body.store-capture .lab-status-pill {
    background: rgba(15, 138, 120, 0.08);
    color: #0a695c;
  }

  body.store-capture .lab-browser-bar {
    display: none;
  }

  body.store-capture .lab-frame-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 18px 22px;
  }

  body.store-capture .lab-frame-card {
    flex: 1;
    align-items: center;
    padding: 18px;
  }

  body.store-capture .lab-frame {
    width: 420px;
    height: 620px;
  }

  body.store-capture .lab-footer-note {
    margin-top: 14px;
    font-size: 12px;
    line-height: 1.5;
  }
`;

const slides = [
  {
    id: '01-login',
    scenarioId: 'logged-out',
    kicker: 'Chrome extension',
    title: 'Track your job search from the popup.',
    description: 'Sign in with Google from the extension and start from the Gmail-connected job tracker, not a blank spreadsheet.',
    previewTitle: 'Google sign-in from the popup',
    previewDescription: 'The launch flow starts inside the extension popup. This screenshot uses the real shipped popup page rendered through the extension harness.',
    footerNote: 'Read-only Gmail access is requested at sign-in. The extension no longer asks for send-mail permission.',
    highlights: ['Read-only Gmail access', 'Popup-first onboarding', 'No manual setup inside the store build'],
  },
  {
    id: '02-overview',
    scenarioId: 'free-rich',
    kicker: 'Free-core launch',
    title: 'See every application stage at a glance.',
    description: 'The default view groups job-application threads by stage so users can scan what is applied, interviewing, offered, or rejected in one pass.',
    previewTitle: 'Pipeline overview inside the popup',
    previewDescription: 'The All tab surfaces grouped conversations, category totals, search, refresh, and the current free-plan status in a single view.',
    footerNote: 'The screenshot shows the real popup rendered in the extension harness with fixture-backed data that mirrors the shipped UI states.',
    highlights: ['Grouped by stage', 'Search companies and roles', 'Refresh from the popup'],
  },
  {
    id: '03-interviews',
    scenarioId: 'free-rich',
    kicker: 'Workflow focus',
    title: 'Filter the inbox down to the stage that matters.',
    description: 'Users can jump from the full pipeline into a single stage without leaving the popup or rebuilding a manual tracker.',
    previewTitle: 'Stage filters stay one click away',
    previewDescription: 'This capture focuses the popup on interview threads so the extension feels useful during an active search, not just after a sync completes.',
    footerNote: 'The popup keeps the same grouped thread layout while the visible stage changes, so users do not have to relearn the interface.',
    highlights: ['Applied, interviews, offers, rejected', 'Consistent grouped-thread layout', 'Fast stage switching'],
    prepare: async ({ frame }) => {
      await frame.getByTestId('main-tab-interviewed').click();
    },
  },
  {
    id: '04-thread-preview',
    scenarioId: 'free-rich',
    kicker: 'Thread detail',
    title: 'Open a thread to review the application journey.',
    description: 'A single click opens the email history for that application so the user can review the conversation without losing the overall pipeline context.',
    previewTitle: 'Conversation history inside the popup',
    previewDescription: 'The preview view is meant for reading and triage. It shows the grouped thread, the role, and the application history without pretending to be an email composer.',
    footerNote: 'Reply-from-extension is intentionally absent in the launch build. The store release is read-only and focused on tracking reliability.',
    highlights: ['Grouped thread history', 'Application journey view', 'Read-only launch scope'],
    prepare: async ({ frame }) => {
      const thread = frame.locator('[data-testid="email-thread-card"]').filter({ hasText: 'Northstar Labs' }).first();
      await thread.click();
      await frame.getByTestId('email-preview').waitFor();
    },
  },
  {
    id: '05-free-limit',
    scenarioId: 'free-limit-reached',
    kicker: 'Honest free plan',
    title: 'Free-plan limits are visible inside the product.',
    description: 'The launch build does not hide quota pressure or silently fail. The popup surfaces the limit state directly when tracking reaches the current free cap.',
    previewTitle: 'Quota guidance inside the popup',
    previewDescription: 'This view shows the free-plan limit state and the current premium placeholder language exactly as it appears in the extension.',
    footerNote: 'Premium billing is intentionally closed for this launch. The popup routes users to the public status page instead of an unfinished checkout.',
    highlights: ['No silent quota failures', 'Premium status page only', 'Free-core store release'],
  },
];

function getLaunchOptions() {
  const args = [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ];

  if (process.env.PW_EXTENSION_EXECUTABLE_PATH) {
    return {
      executablePath: process.env.PW_EXTENSION_EXECUTABLE_PATH,
      headless: process.env.PW_HEADLESS !== 'false',
      args,
      viewport,
    };
  }

  return {
    channel: process.env.PW_EXTENSION_CHANNEL || 'chromium',
    headless: process.env.PW_HEADLESS !== 'false',
    args,
    viewport,
  };
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function openLabPage(context, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`chrome-extension://${extensionId}/testing/public/index.html`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByTestId('test-harness-title').waitFor();
  return page;
}

async function activateScenario(page, scenarioId) {
  await page.getByTestId(`scenario-${scenarioId}`).click();
  await page.getByTestId('testing-mode').waitFor();
  const frame = page.frameLocator('[data-testid="popup-preview-frame"]');
  await frame.getByTestId('extension-popup-root').waitFor();
  return frame;
}

async function applyStoreCaptureLayout(page, slide) {
  const slideData = {
    kicker: slide.kicker,
    title: slide.title,
    description: slide.description,
    previewTitle: slide.previewTitle,
    previewDescription: slide.previewDescription,
    footerNote: slide.footerNote,
    highlights: slide.highlights,
  };

  await page.addStyleTag({ content: STORE_CAPTURE_CSS });
  await page.evaluate(({ slideData }) => {
    document.body.classList.add('store-capture');

    const kicker = document.querySelector('.lab-kicker');
    if (kicker) kicker.textContent = slideData.kicker;

    const title = document.querySelector('.lab-title');
    if (title) title.textContent = slideData.title;

    const description = document.querySelector('.lab-copy');
    if (description) description.textContent = slideData.description;

    const sidebar = document.querySelector('.lab-sidebar');
    const sections = Array.from(sidebar?.querySelectorAll('.lab-section') || []);
    for (const section of sections) {
      const sectionTitle = section.querySelector('.lab-section-title')?.textContent?.trim();
      if (sectionTitle !== 'Scenario Snapshot') {
        section.remove();
      }
    }

    const snapshotTitle = document.querySelector('.lab-section-title');
    if (snapshotTitle) snapshotTitle.textContent = 'At a glance';

    let highlightHost = document.getElementById('store-highlights');
    if (!highlightHost && description?.parentElement) {
      highlightHost = document.createElement('div');
      highlightHost.id = 'store-highlights';
      highlightHost.className = 'store-highlights';
      description.insertAdjacentElement('afterend', highlightHost);
    }

    if (highlightHost) {
      highlightHost.innerHTML = '';
      for (const value of slideData.highlights) {
        const chip = document.createElement('span');
        chip.className = 'store-highlight';
        chip.textContent = value;
        highlightHost.appendChild(chip);
      }
    }

    const detailCopy = [
      'Google account state',
      'Plan badge shown in the popup',
      'Tracked applications',
      'Latest sync state',
    ];

    Array.from(document.querySelectorAll('.lab-state-detail')).forEach((node, index) => {
      if (detailCopy[index]) node.textContent = detailCopy[index];
    });

    const previewTitle = document.querySelector('.lab-preview-title');
    if (previewTitle) previewTitle.textContent = slideData.previewTitle;

    const previewDescription = document.querySelector('.lab-preview-copy');
    if (previewDescription) previewDescription.textContent = slideData.previewDescription;

    const footerNote = document.querySelector('.lab-footer-note');
    if (footerNote) footerNote.textContent = slideData.footerNote;
  }, { slideData });
}

function renderPromoMarkup({ width, height, title, subtitle, eyebrow, popupDataUrl }) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          :root {
            color-scheme: light;
            --bg: #f4efe7;
            --ink: #142027;
            --muted: #52616b;
            --accent-soft: rgba(15, 138, 120, 0.12);
          }

          * { box-sizing: border-box; }

          html, body {
            width: ${width}px;
            height: ${height}px;
            margin: 0;
            overflow: hidden;
            font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
            background:
              radial-gradient(circle at top left, rgba(15, 138, 120, 0.22), transparent 34%),
              radial-gradient(circle at bottom right, rgba(198, 113, 56, 0.18), transparent 28%),
              var(--bg);
            color: var(--ink);
          }

          .wrap {
            width: 100%;
            height: 100%;
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: ${width >= 1000 ? 36 : 18}px;
            padding: ${width >= 1000 ? 44 : 24}px;
            align-items: center;
          }

          .copy {
            display: grid;
            gap: ${width >= 1000 ? 18 : 12}px;
            align-content: center;
          }

          .eyebrow {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            padding: 8px 12px;
            border-radius: 999px;
            background: var(--accent-soft);
            color: #0a695c;
            font-size: ${width >= 1000 ? 14 : 12}px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            font-size: ${width >= 1000 ? 68 : 40}px;
            line-height: 0.96;
            letter-spacing: -0.04em;
            max-width: 9ch;
          }

          p {
            margin: 0;
            color: var(--muted);
            font-size: ${width >= 1000 ? 24 : 16}px;
            line-height: 1.45;
            max-width: 26ch;
          }

          .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }

          .chip {
            display: inline-flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.76);
            border: 1px solid rgba(20, 32, 39, 0.08);
            font-size: ${width >= 1000 ? 15 : 11}px;
            font-weight: 600;
          }

          .visual {
            display: flex;
            justify-content: center;
          }

          .device {
            width: ${width >= 1000 ? 300 : 170}px;
            padding: ${width >= 1000 ? 14 : 8}px;
            border-radius: ${width >= 1000 ? 30 : 20}px;
            background: linear-gradient(180deg, rgba(28, 42, 46, 0.96), rgba(15, 23, 28, 0.98));
            box-shadow: 0 24px 60px rgba(20, 32, 39, 0.24);
          }

          .device img {
            display: block;
            width: 100%;
            border-radius: ${width >= 1000 ? 22 : 16}px;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="copy">
            <div class="eyebrow">${eyebrow}</div>
            <h1>${title}</h1>
            <p>${subtitle}</p>
            <div class="chips">
              <span class="chip">Read-only Gmail scope</span>
              <span class="chip">Popup-first workflow</span>
              <span class="chip">Free-core launch</span>
            </div>
          </div>
          <div class="visual">
            <div class="device">
              <img src="${popupDataUrl}" alt="Applendium popup preview" />
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function createPromoAsset(page, options) {
  const { width, height, fileName, title, subtitle, eyebrow, popupDataUrl } = options;
  await page.setViewportSize({ width, height });
  await page.setContent(
    renderPromoMarkup({ width, height, title, subtitle, eyebrow, popupDataUrl }),
    { waitUntil: 'domcontentloaded' },
  );
  await page.screenshot({
    path: path.join(promoDir, fileName),
    type: 'png',
  });
}

async function generateAssets() {
  await ensureDirectory(screenshotsDir);
  await ensureDirectory(promoDir);

  const context = await chromium.launchPersistentContext('', getLaunchOptions());

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = new URL(serviceWorker.url()).host;
    let popupPreviewDataUrl = null;

    for (const slide of slides) {
      const page = await openLabPage(context, extensionId);
      const frame = await activateScenario(page, slide.scenarioId);

      if (slide.prepare) {
        await slide.prepare({ page, frame });
      }

      await applyStoreCaptureLayout(page, slide);
      await page.screenshot({
        path: path.join(screenshotsDir, `${slide.id}.png`),
        type: 'png',
      });

      if (!popupPreviewDataUrl && slide.id === '02-overview') {
        const popupHandle = await frame.getByTestId('extension-popup-root').elementHandle();
        if (!popupHandle) {
          throw new Error('Failed to capture popup preview for promo assets.');
        }
        const popupBuffer = await popupHandle.screenshot({ type: 'png' });
        popupPreviewDataUrl = `data:image/png;base64,${popupBuffer.toString('base64')}`;
        await fs.writeFile(path.join(promoDir, 'popup-overview.png'), popupBuffer);
      }

      await page.close();
    }

    if (!popupPreviewDataUrl) {
      throw new Error('Promo popup preview was not generated.');
    }

    const promoPage = await context.newPage();

    await createPromoAsset(promoPage, {
      width: 440,
      height: 280,
      fileName: 'small-promo-tile.png',
      eyebrow: 'Chrome extension',
      title: 'Applendium',
      subtitle: 'Track job-application emails from Gmail in one popup.',
      popupDataUrl: popupPreviewDataUrl,
    });

    await createPromoAsset(promoPage, {
      width: 1400,
      height: 560,
      fileName: 'marquee-promo-tile.png',
      eyebrow: 'Free-core launch',
      title: 'Applendium',
      subtitle: 'A Gmail-connected popup that groups job applications by stage so users can review their search without maintaining a manual tracker.',
      popupDataUrl: popupPreviewDataUrl,
    });

    await promoPage.close();
  } finally {
    await context.close();
  }
}

generateAssets().catch((error) => {
  console.error('[store-assets] generation failed');
  console.error(error);
  process.exitCode = 1;
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function resolveDistDir() {
  const explicitDistDir = process.env.EXTENSION_DIST_DIR || process.env.DIST_DIR;
  return path.resolve(projectRoot, explicitDistDir || 'popup/dist_prod');
}

function createArtifactDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  return fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMP || path.resolve(projectRoot, '.tmp'), `applendium-extension-inspect-${timestamp}-`));
}

function getLaunchOptions(extensionPath) {
  return {
    channel: process.env.PW_EXTENSION_CHANNEL || 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    viewport: { width: 1440, height: 1000 },
  };
}

async function extractExtensionsPageState(page) {
  return page.evaluate(() => {
    function queryShadow(root, selector) {
      if (!root) return null;
      return root.querySelector(selector);
    }

    const manager = document.querySelector('extensions-manager');
    const managerRoot = manager?.shadowRoot;
    const itemList = queryShadow(managerRoot, 'extensions-item-list');
    const itemListRoot = itemList?.shadowRoot;
    const items = Array.from(itemListRoot?.querySelectorAll('extensions-item') || []);

    const extractedItems = items.map((item) => {
      const root = item.shadowRoot;
      const text = root?.innerText || '';
      const name =
        root?.querySelector('#name')?.textContent?.trim()
        || root?.querySelector('[id="name"]')?.textContent?.trim()
        || '';
      const idLine = text.split('\n').find((line) => line.trim().startsWith('ID:')) || '';
      const enabled = root?.querySelector('#enableToggle')?.checked ?? null;
      const hasErrorsButton = Boolean(Array.from(root?.querySelectorAll('button, cr-button, a') || []).find((node) => /errors/i.test(node.textContent || '')));
      return {
        name,
        idLine: idLine.trim(),
        enabled,
        hasErrorsButton,
        text: text.trim(),
      };
    });

    return {
      title: document.title,
      bodyText: document.body?.innerText || '',
      items: extractedItems,
    };
  });
}

async function main() {
  const extensionPath = resolveDistDir();
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Extension path is missing: ${extensionPath}`);
  }

  const artifactDir = createArtifactDir();
  const context = await chromium.launchPersistentContext('', getLaunchOptions(extensionPath));

  try {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const serviceWorkers = context.serviceWorkers().map((worker) => worker.url());
    const page = await context.newPage();
    await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const extensionsState = await extractExtensionsPageState(page);
    const screenshotPath = path.join(artifactDir, 'chrome-extensions.png');
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    const report = {
      createdAt: new Date().toISOString(),
      extensionPath,
      artifactDir,
      userDataDir: '(playwright-temp-profile)',
      serviceWorkers,
      extensionsPage: extensionsState,
      pages: context.pages().map((openPage) => openPage.url()),
    };

    const reportPath = path.join(artifactDir, 'inspect-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`ARTIFACT_DIR=${artifactDir}`);
    console.log(`REPORT_PATH=${reportPath}`);
    console.log(`SERVICE_WORKER_COUNT=${serviceWorkers.length}`);
    for (const workerUrl of serviceWorkers) {
      console.log(`SERVICE_WORKER=${workerUrl}`);
    }
    for (const item of extensionsState.items) {
      console.log(`EXTENSION_ITEM=${JSON.stringify(item)}`);
    }
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

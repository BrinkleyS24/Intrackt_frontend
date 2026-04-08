import './index.css';
import { listExtensionTestScenarios } from '../mockScenarios';

const root = document.getElementById('root');
const popupBaseUrl = chrome.runtime.getURL('popup/public/index.html');
const DEFAULT_SCENARIOS = listExtensionTestScenarios();

const state = {
  build: null,
  testing: null,
  snapshot: null,
  scenarios: DEFAULT_SCENARIOS,
  busyAction: null,
  frameKey: Date.now(),
  renderSignature: null,
  lastError: null,
};

const MESSAGE_TIMEOUT_MS = 10_000;

async function sendMessage(message, { timeoutMs = MESSAGE_TIMEOUT_MS } = {}) {
  let timeoutHandle = null;
  try {
    return await Promise.race([
      chrome.runtime.sendMessage(message),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Extension test message timed out after ${timeoutMs}ms: ${message?.type || 'unknown'}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function getPopupUrl() {
  return `${popupBaseUrl}?lab=1&frame=${state.frameKey}`;
}

function formatTestingStatus(testing) {
  if (!testing?.supported) return 'Unavailable in production build';
  if (!testing?.active) return 'Live mode';
  return `Scenario active: ${testing.label || testing.scenarioId || 'Unknown'}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPlanLabel(plan) {
  return plan === 'premium' ? 'Premium' : 'Free';
}

function getTrackedUsage(snapshot) {
  const quota = snapshot?.quota || null;
  if (!quota) return Number(snapshot?.trackedApplications || 0);
  if (Number.isFinite(quota.trackedApplications)) return quota.trackedApplications;
  if (Number.isFinite(quota.usage)) return quota.usage;
  if (Number.isFinite(snapshot?.trackedApplications)) return snapshot.trackedApplications;
  return Number(quota.totalProcessed || 0);
}

function formatQuotaSummary(snapshot) {
  if (!snapshot?.auth?.isLoggedIn) return 'Signed out';

  const quota = snapshot?.quota || null;
  if (!quota) return 'Unavailable';

  const trackedUsage = getTrackedUsage(snapshot);
  if (snapshot?.userPlan === 'premium') {
    return `${trackedUsage} tracked - Unlimited`;
  }

  const limit = Number(quota.limit || 100);
  if (quota.limitReached || trackedUsage >= limit) {
    return `${trackedUsage}/${limit} tracked - Limit reached`;
  }

  return `${trackedUsage}/${limit} tracked`;
}

function formatSyncSummary(snapshot) {
  const sync = snapshot?.sync || null;
  if (!snapshot?.auth?.isLoggedIn) return 'Signed out';
  if (!sync?.inProgress) {
    const lastActiveAt = sync?.lastCompletedAt || sync?.lastSyncAt;
    return lastActiveAt ? `Idle - last ${formatDateTime(lastActiveAt)}` : 'Idle';
  }

  const startedAt = sync?.startedAt || sync?.lastSyncAt;
  return startedAt ? `In progress - started ${formatDateTime(startedAt)}` : 'In progress';
}

function render() {
  if (!root) return;

  const popupUrl = getPopupUrl();
  const existingFrame = root.querySelector('[data-testid="popup-preview-frame"]');
  const reusableFrame =
    existingFrame && existingFrame.getAttribute('src') === popupUrl
      ? existingFrame
      : null;
  const testing = state.testing || { supported: false, active: false };
  const build = state.build || {};
  const runtime = build.runtime || {};
  const snapshot = state.snapshot || null;
  const activeScenarioId = testing.scenarioId || null;
  const currentScenario = state.scenarios.find((scenario) => scenario.id === activeScenarioId) || null;
  const categoryTotals = snapshot?.categoryTotals || {};
  const authStatusLabel = snapshot?.auth?.isLoggedIn ? 'Signed in' : 'Signed out';
  const accountLabel = snapshot?.auth?.email || 'Unavailable';
  const planLabel = snapshot?.auth?.isLoggedIn ? formatPlanLabel(snapshot?.userPlan) : 'N/A';
  const quotaLabel = formatQuotaSummary(snapshot);
  const syncLabel = formatSyncSummary(snapshot);
  const relevantCount = Number(categoryTotals.relevant || 0);
  const categoryBreakdownMarkup = ['applied', 'interviewed', 'offers', 'rejected', 'irrelevant']
    .map((key) => `
      <span class="lab-chip" data-testid="state-count-${escapeHtml(key)}">
        ${escapeHtml(key)}: ${escapeHtml(categoryTotals[key] ?? 0)}
      </span>
    `)
    .join('');
  const renderSignature = JSON.stringify({
    popupUrl,
    busyAction: state.busyAction,
    testing,
    snapshot,
    scenarios: state.scenarios,
    runtime: {
      backendBaseUrl: runtime.backendBaseUrl || null,
      premiumDashboardUrl: runtime.premiumDashboardUrl || null,
    },
    lastError: state.lastError,
  });

  if (state.renderSignature === renderSignature) {
    return;
  }

  state.renderSignature = renderSignature;

  const scenariosMarkup = state.scenarios.map((scenario) => {
    const isActive = activeScenarioId === scenario.id;
    return `
      <button
        class="lab-scenario${isActive ? ' is-active' : ''}"
        data-action="activate-scenario"
        data-scenario-id="${escapeHtml(scenario.id)}"
        data-testid="scenario-${escapeHtml(scenario.id)}"
        ${state.busyAction ? 'disabled' : ''}
      >
        <div class="lab-scenario-header">
          <p class="lab-scenario-title">${escapeHtml(scenario.label)}</p>
          ${isActive ? '<span class="lab-scenario-badge">Active</span>' : ''}
        </div>
        <p class="lab-scenario-description">${escapeHtml(scenario.description)}</p>
      </button>
    `;
  }).join('');

  root.innerHTML = `
    <div class="lab-shell">
      <div class="lab-grid">
        <aside class="lab-panel lab-sidebar">
          <div class="lab-kicker">Extension QA Surface</div>
          <h1 class="lab-title" data-testid="test-harness-title">Applendium Extension Lab</h1>
          <p class="lab-copy">
            This page drives the real extension popup in a fixture-backed mode so UI work can be validated before shipping.
            Live mode is restorable with one click.
          </p>

          ${state.lastError ? `<div class="lab-copy" data-testid="lab-error">${escapeHtml(state.lastError)}</div>` : ''}

          <section class="lab-section">
            <h2 class="lab-section-title">Current State</h2>
            <div class="lab-meta-list">
              <div class="lab-meta-row">
                <span class="lab-meta-label">Mode</span>
                <span class="lab-meta-value" data-testid="testing-mode">${escapeHtml(formatTestingStatus(testing))}</span>
              </div>
              <div class="lab-meta-row">
                <span class="lab-meta-label">Backend</span>
                <span class="lab-meta-value">${escapeHtml(runtime.backendBaseUrl || 'Unknown')}</span>
              </div>
              <div class="lab-meta-row">
                <span class="lab-meta-label">Premium URL</span>
                <span class="lab-meta-value">${escapeHtml(runtime.premiumDashboardUrl || 'Not configured')}</span>
              </div>
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Scenario Snapshot</h2>
            <div class="lab-state-grid">
              <div class="lab-state-card">
                <span class="lab-state-label">Auth</span>
                <strong class="lab-state-value" data-testid="state-auth">${escapeHtml(authStatusLabel)}</strong>
                <span class="lab-state-detail" data-testid="state-account">${escapeHtml(accountLabel)}</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Plan</span>
                <strong class="lab-state-value" data-testid="state-plan">${escapeHtml(planLabel)}</strong>
                <span class="lab-state-detail">Scenario-backed billing state</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Quota</span>
                <strong class="lab-state-value" data-testid="state-quota">${escapeHtml(quotaLabel)}</strong>
                <span class="lab-state-detail">Tracked applications in this fixture</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Sync</span>
                <strong class="lab-state-value" data-testid="state-sync">${escapeHtml(syncLabel)}</strong>
                <span class="lab-state-detail">Matches popup sync messaging inputs</span>
              </div>
            </div>

            <div class="lab-state-summary">
              <div class="lab-summary-row">
                <span class="lab-summary-label">Relevant emails</span>
                <span class="lab-summary-value" data-testid="state-relevant">${escapeHtml(relevantCount)}</span>
              </div>
              <div class="lab-chip-row">
                ${categoryBreakdownMarkup}
              </div>
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Scenario Library</h2>
            <div class="lab-scenarios">
              ${scenariosMarkup || '<p class="lab-copy">No scenarios are available in this build.</p>'}
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Actions</h2>
            <div class="lab-actions">
              <button class="lab-button primary" data-action="reload-preview" data-testid="reload-preview" ${state.busyAction ? 'disabled' : ''}>
                Reload Preview
              </button>
              <button class="lab-button secondary" data-action="open-popup-tab" data-testid="open-popup-tab" ${state.busyAction ? 'disabled' : ''}>
                Open Popup Tab
              </button>
              <button class="lab-button secondary" data-action="live-mode" data-testid="live-mode-button" ${state.busyAction ? 'disabled' : ''}>
                Restore Live Mode
              </button>
              <button class="lab-button secondary" data-action="refresh-state" data-testid="refresh-state" ${state.busyAction ? 'disabled' : ''}>
                Refresh State
              </button>
            </div>
          </section>
        </aside>

        <main class="lab-panel lab-preview">
          <div class="lab-preview-header">
            <div>
              <h2 class="lab-preview-title">Real Popup Preview</h2>
              <p class="lab-preview-copy">
                ${escapeHtml(currentScenario?.description || 'Live extension popup rendered inside the test harness.')}
              </p>
            </div>
            <div class="lab-status-pill">
              <span class="lab-stage${testing.active ? ' is-live' : ''}"></span>
              <span>${escapeHtml(testing.active ? 'Fixture active' : 'Live mode')}</span>
            </div>
          </div>

          <div class="lab-frame-wrap">
            <div class="lab-browser-bar">
            <div class="lab-browser-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div class="lab-browser-url" data-testid="popup-preview-url">${escapeHtml(popupUrl)}</div>
            </div>

            <div class="lab-frame-card">
              <iframe
                class="lab-frame"
                src="${escapeHtml(popupUrl)}"
                title="Applendium popup preview"
                data-testid="popup-preview-frame"
              ></iframe>
            </div>

            <p class="lab-footer-note">
              The preview is the shipped popup page, not a mocked React-only clone. Scenario state lives in the extension background worker and can be toggled without rewriting production routes.
            </p>
          </div>
        </main>
      </div>
    </div>
  `;

  if (reusableFrame) {
    const nextFrame = root.querySelector('[data-testid="popup-preview-frame"]');
    if (nextFrame) {
      nextFrame.replaceWith(reusableFrame);
    }
  }

  bindEvents();
}

function syncRenderedState() {
  if (!root) return;

  const testing = state.testing || { supported: false, active: false };
  const build = state.build || {};
  const runtime = build.runtime || {};
  const snapshot = state.snapshot || null;
  const activeScenarioId = testing.scenarioId || null;
  const currentScenario = state.scenarios.find((scenario) => scenario.id === activeScenarioId) || null;
  const categoryTotals = snapshot?.categoryTotals || {};
  const categoryBreakdownMarkup = ['applied', 'interviewed', 'offers', 'rejected', 'irrelevant']
    .map((key) => `
      <span class="lab-chip" data-testid="state-count-${escapeHtml(key)}">
        ${escapeHtml(key)}: ${escapeHtml(categoryTotals[key] ?? 0)}
      </span>
    `)
    .join('');
  const scenarioDescription = currentScenario?.description || 'Live extension popup rendered inside the test harness.';

  const updateText = (selector, value) => {
    const element = root.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  };

  updateText('[data-testid="testing-mode"]', formatTestingStatus(testing));
  updateText('[data-testid="state-auth"]', snapshot?.auth?.isLoggedIn ? 'Signed in' : 'Signed out');
  updateText('[data-testid="state-account"]', snapshot?.auth?.email || 'Unavailable');
  updateText('[data-testid="state-plan"]', snapshot?.auth?.isLoggedIn ? formatPlanLabel(snapshot?.userPlan) : 'N/A');
  updateText('[data-testid="state-quota"]', formatQuotaSummary(snapshot));
  updateText('[data-testid="state-sync"]', formatSyncSummary(snapshot));
  updateText('[data-testid="state-relevant"]', String(Number(categoryTotals.relevant || 0)));
  updateText('.lab-preview-copy', scenarioDescription);
  updateText('.lab-status-pill span:last-child', testing.active ? 'Fixture active' : 'Live mode');

  const chipRow = root.querySelector('.lab-chip-row');
  if (chipRow) {
    chipRow.innerHTML = categoryBreakdownMarkup;
  }

  const errorEl = root.querySelector('[data-testid="lab-error"]');
  if (state.lastError) {
    if (errorEl) {
      errorEl.textContent = state.lastError;
    }
  } else if (errorEl) {
    errorEl.remove();
  }

  root.querySelectorAll('[data-action="activate-scenario"]').forEach((button) => {
    const scenarioId = button.getAttribute('data-scenario-id');
    const isActive = scenarioId === activeScenarioId;
    button.classList.toggle('is-active', isActive);
    button.disabled = Boolean(state.busyAction);

    const header = button.querySelector('.lab-scenario-header');
    const existingBadge = button.querySelector('.lab-scenario-badge');
    if (isActive && !existingBadge && header) {
      const badge = document.createElement('span');
      badge.className = 'lab-scenario-badge';
      badge.textContent = 'Active';
      header.appendChild(badge);
    } else if (!isActive && existingBadge) {
      existingBadge.remove();
    }
  });

  root.querySelectorAll('[data-action]').forEach((button) => {
    button.disabled = Boolean(state.busyAction);
  });

  const backendValue = root.querySelectorAll('.lab-meta-value')[1];
  if (backendValue) {
    backendValue.textContent = runtime.backendBaseUrl || 'Unknown';
  }

  const premiumValue = root.querySelectorAll('.lab-meta-value')[2];
  if (premiumValue) {
    premiumValue.textContent = runtime.premiumDashboardUrl || 'Not configured';
  }
}

function bindEvents() {
  root.querySelectorAll('[data-action="activate-scenario"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const scenarioId = button.getAttribute('data-scenario-id');
      if (!scenarioId) return;
      state.busyAction = `activate:${scenarioId}`;
      render();
      try {
        const response = await sendMessage({
          type: 'ACTIVATE_EXTENSION_TEST_SCENARIO',
          scenarioId,
        }, { timeoutMs: 30_000 });
        if (!response?.success) {
          throw new Error(response?.error || 'Failed to activate the scenario.');
        }
        state.lastError = null;
        const activatedScenario = DEFAULT_SCENARIOS.find((scenario) => scenario.id === scenarioId);
        state.testing = response.testing || {
          supported: true,
          active: true,
          scenarioId,
          label: activatedScenario?.label || scenarioId,
          description: activatedScenario?.description || null,
        };
        state.frameKey = Date.now();
        await refreshState().catch((error) => {
          console.warn('[extension-lab] refresh after activation failed', error);
        });
        state.testing = response.testing || state.testing;
      } catch (error) {
        console.error('[extension-lab] activate failed', error);
        state.lastError = error.message || 'Failed to activate the selected scenario.';
      } finally {
        state.busyAction = null;
        render();
      }
    });
  });

  root.querySelector('[data-action="reload-preview"]')?.addEventListener('click', () => {
    state.frameKey = Date.now();
    render();
  });

  root.querySelector('[data-action="open-popup-tab"]')?.addEventListener('click', async () => {
    await chrome.tabs.create({ url: getPopupUrl() });
  });

  root.querySelector('[data-action="live-mode"]')?.addEventListener('click', async () => {
    state.busyAction = 'live-mode';
    render();
    try {
      const response = await sendMessage({ type: 'DEACTIVATE_EXTENSION_TEST_MODE' }, { timeoutMs: 30_000 });
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to restore live mode.');
      }
      state.lastError = null;
      state.testing = response.testing || state.testing;
      state.frameKey = Date.now();
      await refreshState().catch((error) => {
        console.warn('[extension-lab] refresh after live mode restore failed', error);
      });
    } catch (error) {
      console.error('[extension-lab] live mode restore failed', error);
      state.lastError = error.message || 'Failed to restore live mode.';
    } finally {
      state.busyAction = null;
      render();
    }
  });

  root.querySelector('[data-action="refresh-state"]')?.addEventListener('click', async () => {
    state.busyAction = 'refresh-state';
    render();
    try {
      await refreshState();
    } finally {
      state.busyAction = null;
      render();
    }
  });
}

async function refreshState() {
  const [buildInfoResult, testingInfoResult] = await Promise.allSettled([
    sendMessage({ type: 'GET_BUILD_INFO' }),
    sendMessage({ type: 'GET_EXTENSION_TEST_STATE' }),
  ]);

  const buildInfo = buildInfoResult.status === 'fulfilled' ? buildInfoResult.value : null;
  const testingInfo = testingInfoResult.status === 'fulfilled' ? testingInfoResult.value : null;

  if (buildInfoResult.status === 'rejected') {
    console.warn('[extension-lab] GET_BUILD_INFO failed', buildInfoResult.reason);
  }
  if (testingInfoResult.status === 'rejected') {
    console.warn('[extension-lab] GET_EXTENSION_TEST_STATE failed', testingInfoResult.reason);
  }

  const refreshErrors = [];
  if (buildInfoResult.status === 'rejected') {
    refreshErrors.push(buildInfoResult.reason?.message || 'GET_BUILD_INFO failed');
  } else if (buildInfo && buildInfo.success === false) {
    refreshErrors.push(buildInfo.error || 'GET_BUILD_INFO failed');
  }

  if (testingInfoResult.status === 'rejected') {
    refreshErrors.push(testingInfoResult.reason?.message || 'GET_EXTENSION_TEST_STATE failed');
  } else if (testingInfo && testingInfo.success === false) {
    refreshErrors.push(testingInfo.error || 'GET_EXTENSION_TEST_STATE failed');
  }

  state.build = buildInfo || state.build || {
    success: false,
    runtime: {},
    testing: { supported: true, active: false },
  };
  state.testing = testingInfo?.testing || state.testing || buildInfo?.testing || { supported: true, active: false };
  state.snapshot = testingInfo?.snapshot || state.snapshot || null;
  state.scenarios = testingInfo?.scenarios?.length ? testingInfo.scenarios : state.scenarios || DEFAULT_SCENARIOS;
  state.lastError = refreshErrors.length > 0 ? refreshErrors[0] : null;
}

async function init() {
  try {
    render();
    await refreshState();
    state.lastError = null;
    render();
  } catch (error) {
    console.error('[extension-lab] failed to initialize', error);
    if (root) {
      root.innerHTML = `<div class="lab-shell"><div class="lab-panel lab-sidebar"><h1 class="lab-title">Applendium Extension Lab</h1><p class="lab-copy">Failed to initialize the extension test lab: ${escapeHtml(error.message || 'Unknown error')}</p></div></div>`;
    }
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'EXTENSION_TEST_STATE_CHANGED') return;
  refreshState().then(() => syncRenderedState()).catch(() => {});
});

chrome.storage.onChanged.addListener((_, areaName) => {
  if (areaName !== 'local') return;
  refreshState().then(() => syncRenderedState()).catch(() => {});
});

init();

setInterval(() => {
  refreshState().then(() => syncRenderedState()).catch(() => {});
}, 1500);

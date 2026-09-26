import { useCallback, useEffect, useState } from 'react';
import { sendMessageToBackground } from '../utils/chromeMessaging';
import {
  APPLY_GATE_LAST_CHECK_KEY,
  APPLY_GATE_LAST_CHECK_TTL_MS,
  samePostingUrl,
  summarizeApplyGateResult,
} from '../../../shared/applyGateCheck.js';

const HIDDEN = { phase: 'hidden', posting: null, summary: null, error: null, recorded: null, recording: false, allowance: null };

async function readCachedCheck(url) {
  try {
    const cached = (await chrome.storage?.local?.get([APPLY_GATE_LAST_CHECK_KEY]))?.[APPLY_GATE_LAST_CHECK_KEY];
    if (!cached?.summary || !samePostingUrl(cached.url, url)) return null;
    if (Date.now() - (cached.at || 0) > APPLY_GATE_LAST_CHECK_TTL_MS) return null;
    return cached;
  } catch (_) {
    return null;
  }
}

async function rememberRecordedAction(url, action) {
  try {
    const cached = (await chrome.storage.local.get([APPLY_GATE_LAST_CHECK_KEY]))?.[APPLY_GATE_LAST_CHECK_KEY];
    if (cached && samePostingUrl(cached.url, url)) {
      await chrome.storage.local.set({ [APPLY_GATE_LAST_CHECK_KEY]: { ...cached, recorded: action } });
    }
  } catch (_) { /* cosmetic: only affects what a reopened popup shows */ }
}

async function readAllowance() {
  try {
    const response = await sendMessageToBackground({ type: 'APPLY_GATE_ALLOWANCE' });
    return response?.allowance || null;
  } catch (_) {
    return null;
  }
}

/**
 * Apply Gate on the page the user is looking at. Premium checks any posting; a free user gets one
 * check per rolling week (founder decision, 2026-09-26). Reads the active tab once per popup open and
 * shows nothing unless the page reads like a job posting, so an ordinary tab never sprouts a card.
 */
export function useApplyGateCheck(enabled, { premium = false } = {}) {
  const [state, setState] = useState(HIDDEN);

  useEffect(() => {
    if (!enabled) {
      setState(HIDDEN);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      let posting = null;
      try {
        const response = await sendMessageToBackground({ type: 'READ_ACTIVE_JOB_POSTING' });
        posting = response?.posting || null;
      } catch (_) {
        posting = null;
      }
      if (cancelled) return;
      if (!posting?.looksLikeJob || !(posting.description || posting.title)) {
        setState(HIDDEN);
        return;
      }
      const [cached, allowance] = await Promise.all([
        readCachedCheck(posting.url),
        premium ? Promise.resolve(null) : readAllowance(),
      ]);
      if (cancelled) return;
      if (cached) {
        setState({ ...HIDDEN, phase: 'result', posting, summary: cached.summary, recorded: cached.recorded || null, allowance });
        return;
      }
      const usedUp = !premium && allowance && allowance.unlimited !== true && allowance.remaining === 0;
      setState({ ...HIDDEN, phase: usedUp ? 'used' : 'ready', posting, allowance });
    })();
    return () => { cancelled = true; };
  }, [enabled, premium]);

  const check = useCallback(async () => {
    const { posting } = state;
    if (!posting) return;
    setState((current) => ({ ...current, phase: 'checking', error: null }));
    try {
      const response = await sendMessageToBackground({
        type: 'APPLY_GATE_ANALYZE',
        payload: {
          jobTitle: posting.title || '',
          companyName: posting.company || '',
          jobDescription: posting.description || '',
          jobUrl: posting.url || '',
        },
      });
      if (response?.weeklyCheckUsed) {
        setState((current) => ({
          ...current,
          phase: 'used',
          allowance: { ...(current.allowance || {}), remaining: 0, nextAvailableAt: response.nextAvailableAt || null },
        }));
        return;
      }
      const summary = summarizeApplyGateResult(response?.result);
      setState((current) => ({
        ...current,
        phase: summary ? 'result' : 'error',
        summary,
        allowance: response?.result?.allowance || current.allowance,
        error: summary ? null : 'Apply Gate did not return a call for this page.',
      }));
    } catch (error) {
      setState((current) => ({ ...current, phase: 'error', error: error?.message || 'The check did not finish.' }));
    }
  }, [state]);

  const record = useCallback(async (action) => {
    const verdictId = state.summary?.id;
    if (!verdictId) return;
    setState((current) => ({ ...current, recording: true, error: null }));
    try {
      await sendMessageToBackground({ type: 'APPLY_GATE_ACTION', verdictId, action });
      await rememberRecordedAction(state.posting?.url, action);
      setState((current) => ({ ...current, recording: false, recorded: action }));
    } catch (error) {
      setState((current) => ({ ...current, recording: false, error: 'That did not save. Try again, or record it on the web.' }));
    }
  }, [state]);

  return { ...state, premium, check, record };
}

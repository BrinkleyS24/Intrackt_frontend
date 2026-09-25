import { useCallback, useEffect, useState } from 'react';
import { sendMessageToBackground } from '../utils/chromeMessaging';
import {
  APPLY_GATE_LAST_CHECK_KEY,
  APPLY_GATE_LAST_CHECK_TTL_MS,
  samePostingUrl,
  summarizeApplyGateResult,
} from '../../../shared/applyGateCheck.js';

const HIDDEN = { phase: 'hidden', posting: null, summary: null, error: null, recorded: null, recording: false };

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

/**
 * Apply Gate on the page the user is looking at (premium). Reads the active tab once per popup
 * open; shows nothing unless the page reads like a job posting, so an ordinary tab never sprouts
 * a "check this job" card.
 */
export function useApplyGateCheck(enabled) {
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
      const cached = await readCachedCheck(posting.url);
      if (cancelled) return;
      setState(cached
        ? { ...HIDDEN, phase: 'result', posting, summary: cached.summary, recorded: cached.recorded || null }
        : { ...HIDDEN, phase: 'ready', posting });
    })();
    return () => { cancelled = true; };
  }, [enabled]);

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
      const summary = summarizeApplyGateResult(response?.result);
      setState((current) => ({
        ...current,
        phase: summary ? 'result' : 'error',
        summary,
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

  return { ...state, check, record };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessageToBackground } from '../utils/chromeMessaging';
import {
  summarizeApplyGateResult,
} from '../../../shared/applyGateCheck.js';

const HIDDEN = { phase: 'hidden', posting: null, summary: null, error: null, recorded: null, recording: false, allowance: null };

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
export function useApplyGateCheck(enabled, { premium = false, accountId = null } = {}) {
  const [state, setState] = useState(HIDDEN);
  const activeAccount = useRef(accountId);
  activeAccount.current = accountId;
  const mounted = useRef(true);
  const checking = useRef(false);
  const generation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    generation.current += 1;
    checking.current = false;
    if (!enabled) {
      setState(HIDDEN);
      return undefined;
    }
    let cancelled = false;
    setState(HIDDEN);
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
        // Off a job page the only useful thing to say is that Apply Gate has no resume to
        // check against — otherwise users find out only once they open a posting.
        try {
          const context = await sendMessageToBackground({ type: 'APPLY_GATE_CONTEXT', url: '' });
          if (cancelled || context?.accountId !== activeAccount.current) return;
          if (context?.selection && !context.selection.resumeDocument) {
            setState({ ...HIDDEN, phase: 'nudge', selection: context.selection });
            return;
          }
        } catch (_) {
          // A failed lookup is not evidence of a missing resume; stay quiet.
        }
        if (!cancelled) setState(HIDDEN);
        return;
      }
      let context;
      let allowance;
      try {
        [context, allowance] = await Promise.all([
        sendMessageToBackground({ type: 'APPLY_GATE_CONTEXT', url: posting.url }),
        premium ? Promise.resolve(null) : readAllowance(),
      ]);
      } catch (error) {
        if (!cancelled) setState({ ...HIDDEN, phase: 'error', posting, error: error.message });
        return;
      }
      if (cancelled || context?.accountId !== activeAccount.current) return;
      const { cached, selection } = context;
      if (cached) {
        setState({ ...HIDDEN, phase: 'result', posting, summary: cached.summary, recorded: cached.recorded || null, allowance, selection, stale: cached.stale });
        return;
      }
      if (!selection?.resumeDocument) {
        setState({ ...HIDDEN, phase: 'result', posting, allowance, selection, summary: { kind: selection?.selectionRequired ? 'needs_resume_selection' : 'needs_resume', message: selection?.selectionRequired ? 'Choose a readable default resume. This check was not used.' : 'Add and choose a default resume before checking this role.' } });
        return;
      }
      const usedUp = !premium && allowance && allowance.unlimited !== true && allowance.remaining === 0;
      setState({ ...HIDDEN, phase: usedUp ? 'used' : 'ready', posting, allowance, selection });
    })();
    return () => { cancelled = true; generation.current += 1; };
  }, [enabled, premium, accountId]);

  const check = useCallback(async () => {
    const { posting } = state;
    if (!posting || checking.current) return;
    const owner = accountId;
    const requestGeneration = generation.current;
    checking.current = true;
    setState((current) => ({ ...current, phase: 'checking', error: null }));
    try {
      const context = await sendMessageToBackground({ type: 'APPLY_GATE_CONTEXT', url: posting.url });
      if (!mounted.current || generation.current !== requestGeneration || activeAccount.current !== owner || context.accountId !== owner) return;
      const doc = context.selection?.resumeDocument;
      if (!doc) {
        setState((current) => ({ ...current, phase: 'result', selection: context.selection, summary: { kind: 'needs_resume_selection', message: 'Choose a readable default resume. This check was not used.' } }));
        return;
      }
      const previous = state.selection?.resumeDocument;
      if (!previous || previous.variantId !== doc.variantId || previous.fingerprint !== doc.fingerprint) {
        setState((current) => ({ ...current, phase: 'ready', selection: context.selection, error: 'Your default changed. Review the resume shown before checking.' }));
        return;
      }
      const response = await sendMessageToBackground({
        type: 'APPLY_GATE_ANALYZE',
        payload: {
          variantId: doc.variantId,
          expectedResumeFingerprint: doc.fingerprint,
          jobTitle: posting.title || '',
          companyName: posting.company || '',
          jobDescription: posting.description || '',
          jobUrl: posting.url || '',
        },
      });
      if (!mounted.current || generation.current !== requestGeneration || activeAccount.current !== owner) return;
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
        summary, stale: false, recorded: null,
        allowance: response?.result?.allowance || current.allowance,
        error: summary ? null : 'Apply Gate did not return a call for this page.',
      }));
    } catch (error) {
      if (!mounted.current || generation.current !== requestGeneration || activeAccount.current !== owner) return;
      setState((current) => ({ ...current, phase: 'error', error: error?.message || 'The check did not finish.' }));
    } finally {
      if (generation.current === requestGeneration) checking.current = false;
    }
  }, [state, accountId]);

  const record = useCallback(async (action) => {
    const verdictId = state.summary?.id;
    if (!verdictId) return;
    const requestGeneration = generation.current;
    setState((current) => ({ ...current, recording: true, error: null }));
    try {
      await sendMessageToBackground({ type: 'APPLY_GATE_ACTION', verdictId, action });
      if (!mounted.current || generation.current !== requestGeneration || activeAccount.current !== accountId) return;
      setState((current) => ({ ...current, recording: false, recorded: action }));
    } catch (error) {
      if (!mounted.current || generation.current !== requestGeneration || activeAccount.current !== accountId) return;
      setState((current) => ({ ...current, recording: false, error: 'That did not save. Try again, or record it on the web.' }));
    }
  }, [state, accountId]);

  return { ...state, premium, check, record };
}

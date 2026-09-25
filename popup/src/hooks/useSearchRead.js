import { useEffect, useState } from 'react';
import { sendMessageToBackground } from '../utils/chromeMessaging';

const IDLE = { status: 'idle', read: null, progress: null };

/**
 * The free user's one read of their own search. Fetched once per popup open, which is also
 * what lets the backend count returning free users. Any failure is 'unavailable' — the card
 * then falls back to the generic teaser; it never shows an invented read.
 */
export function useSearchRead(enabled) {
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading', read: null, progress: null });
    sendMessageToBackground({ type: 'FETCH_SEARCH_READ' })
      .then((response) => {
        if (cancelled) return;
        if (!response?.success || response.unavailable) {
          setState({ status: 'unavailable', read: null, progress: null });
          return;
        }
        setState({ status: 'ready', read: response.read || null, progress: response.progress || null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable', read: null, progress: null });
      });
    return () => { cancelled = true; };
  }, [enabled]);

  return state;
}

import { useCallback, useEffect, useRef, useState } from 'react';
const EMPTY_APPLICATIONS = Object.freeze([]);

export function useManualApplications(userId) {
  const [state, setState] = useState({ owner: null, applications: [], nextCursor: null, error: null, creationEnabled: false, loading: false });
  const generation = useRef(0);
  const owner = useRef(userId);
  owner.current = userId;
  const refresh = useCallback(async (before = null) => {
    if (!userId) return;
    const ticket = ++generation.current;
    setState((old) => ({ ...old, owner: userId, loading: true }));
    try {
      const result = await chrome.runtime.sendMessage({ type: 'LIST_MANUAL_APPLICATIONS', ownerUid: userId, before });
      if (!result?.success || !Array.isArray(result.applications)) throw new Error(result?.error || 'Added applications could not be loaded.');
      if (generation.current !== ticket || owner.current !== userId) return;
      setState((old) => ({
        owner: userId, applications: before ? [...old.applications, ...result.applications] : result.applications,
        nextCursor: result.nextCursor, creationEnabled: result.creationEnabled, error: null, loading: false,
      }));
    } catch (error) {
      if (generation.current === ticket && owner.current === userId) setState((old) => ({ ...old, loading: false, error: error.message }));
    }
  }, [userId]);
  useEffect(() => {
    setState({ owner: userId, applications: [], nextCursor: null, error: null, creationEnabled: false, loading: false });
    if (userId) refresh();
    const listener = (message) => { if (message.type === 'EMAILS_SYNCED' && message.success) refresh(); };
    chrome.runtime.onMessage.addListener(listener);
    return () => { generation.current += 1; chrome.runtime.onMessage.removeListener(listener); };
  }, [userId, refresh]);
  const acceptSaved = useCallback((application) => {
    if (owner.current !== userId) return;
    setState((old) => old.owner === userId
      ? { ...old, applications: [application, ...old.applications.filter((row) => String(row.id) !== String(application.id))] }
      : old);
  }, [userId]);
  const remove = useCallback(async (applicationId) => {
    const result = await chrome.runtime.sendMessage({ type: 'REMOVE_MANUAL_APPLICATION', ownerUid: userId, applicationId });
    if (owner.current !== userId) throw new Error('Your account changed. Reopen the popup.');
    if (!result?.success) throw new Error(result?.error || 'Removal could not be confirmed. Refresh before trying again.');
    setState((old) => ({ ...old, applications: old.applications.filter((row) => String(row.id) !== String(applicationId)) }));
    await refresh();
    if (result.refreshWarning && owner.current === userId) setState((old) => ({ ...old, error: 'Application removed, but the totals could not refresh. Try Refresh shortly.' }));
  }, [userId, refresh]);
  return { ...(state.owner === userId ? state : { applications: EMPTY_APPLICATIONS, nextCursor: null, error: null, creationEnabled: false, loading: true }), refresh, acceptSaved, remove };
}

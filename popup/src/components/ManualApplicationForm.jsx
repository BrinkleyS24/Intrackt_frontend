import React, { useEffect, useRef, useState } from 'react';

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const newDraft = () => ({ requestId: crypto.randomUUID(), company: '', position: '', appliedDate: localToday(), jobUrl: '', separate: false, uncertain: false });
const fieldClass = 'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';
export default function ManualApplicationForm({ userId, onSaved, onClose }) {
  const [draft, setDraft] = useState(newDraft);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [canReset, setCanReset] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  const writes = useRef(Promise.resolve());
  const storageKey = `manualApplicationDraft:${userId}`;
  useEffect(() => {
    mounted.current = true;
    chrome.storage.local.get(storageKey).then((saved) => {
      if (!mounted.current) return;
      const value = saved[storageKey];
      if (value?.requestId && typeof value.company === 'string' && typeof value.position === 'string') setDraft(value);
      setReady(true);
    }).catch(() => { if (mounted.current) setError('Your saved draft could not be loaded. Reopen this form before saving.'); });
    return () => { mounted.current = false; };
  }, [storageKey]);
  const persist = (next) => {
    writes.current = writes.current.catch(() => {}).then(() => chrome.storage.local.set({ [storageKey]: next }));
    return writes.current;
  };
  const update = (field, value) => {
    const next = { ...draft, [field]: value };
    setDraft(next); if (field !== 'separate') setDuplicate(null); setError('');
    persist(next).catch(() => { if (mounted.current) setError('Your draft could not be saved on this device. Try again before closing.'); });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy.current || !ready) return;
    busy.current = true; setSaving(true); setError(''); setDuplicate(null);
    const submitted = { ...draft, uncertain: true };
    try {
      // Freeze and persist before the network request. Closing Chrome's popup can
      // lose the response after commit; reopening replays the same immutable intent.
      await persist(submitted);
      setDraft(submitted);
      const result = await chrome.runtime.sendMessage({ type: 'CREATE_MANUAL_APPLICATION', ownerUid: userId, application: submitted });
      if (!mounted.current) return;
      if (!result?.success) {
        const knownNoSave = ['duplicate', 'quota', 'invalid_input', 'disabled', 'no_user', 'sync_busy'].includes(result?.code);
        if (knownNoSave) { const editable = { ...submitted, uncertain: false }; setDraft(editable); await persist(editable); }
        if (result?.code === 'duplicate') setDuplicate(result.application);
        if (['request_conflict', 'removed'].includes(result?.code)) setCanReset(true);
        setError(result?.error || 'The save could not be confirmed. Retry this draft safely.');
        return;
      }
      let draftCleared = true;
      try { await chrome.storage.local.remove(storageKey); } catch { draftCleared = false; }
      // An account change can unmount this form while draft cleanup is pending.
      // Never publish the old account's result into the next account's popup.
      if (mounted.current) onSaved(result.application, { refreshWarning: result.refreshWarning, draftCleared });
    } catch (failure) {
      if (mounted.current) setError('The save could not be confirmed. Your draft is kept; retry it safely.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} data-testid="manual-application-form" className="space-y-4 p-4">
      <div><h2 className="text-base font-semibold">Add application</h2><p className="mt-1 text-xs text-muted-foreground">Already applied but received no confirmation email? Add it here. Matching emails can update it later.</p></div>
      <fieldset disabled={!ready || saving || draft.uncertain} className="space-y-3">
        <label className="block text-xs">Company<input autoFocus required maxLength={200} value={draft.company} onChange={(e) => update('company', e.target.value)} className={fieldClass} /></label>
        <label className="block text-xs">Role<input required maxLength={200} value={draft.position} onChange={(e) => update('position', e.target.value)} className={fieldClass} /></label>
        <label className="block text-xs">Date applied<input type="date" required max={localToday()} value={draft.appliedDate} onChange={(e) => update('appliedDate', e.target.value)} className={fieldClass} /></label>
        <label className="block text-xs">Posting link (optional)<input type="url" maxLength={2048} value={draft.jobUrl} onChange={(e) => update('jobUrl', e.target.value)} className={fieldClass} /></label>
      </fieldset>
      {draft.uncertain && !saving && <p className="text-xs text-warning">A previous save has not been confirmed. Retry these same details to avoid adding it twice.</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {canReset && <button type="button" disabled={saving} onClick={() => { const next = newDraft(); setDraft(next); setCanReset(false); setError(''); persist(next).catch(() => setError('Your new draft could not be saved.')); }} className="text-xs text-accent underline">Start a new draft</button>}
      {duplicate && <div className="rounded-lg border border-warning/30 p-3 text-xs"><p>Already tracked: {duplicate.normalized_company_name} · {duplicate.position}</p><p className="mt-1 text-muted-foreground">If this is the same application, keep the existing record. If you applied again or to a different opening, track it separately.</p><label className="mt-2 flex gap-2"><input type="checkbox" checked={draft.separate} onChange={(e) => update('separate', e.target.checked)} />This is a separate application</label></div>}
      <div className="flex gap-2"><button type="submit" disabled={!ready || saving} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-50">{saving ? 'Saving…' : draft.uncertain ? 'Retry save safely' : 'Save application'}</button><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-border px-3 py-2 text-xs">{duplicate ? 'Keep existing' : 'Back'}</button></div>
    </form>
  );
}

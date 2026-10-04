import React, { useEffect, useRef, useState } from 'react';
const STATUS = { applied: 'Applied', interviewed: 'In interviews', offered: 'Offer', rejected: 'Rejected' };
export default function ManualApplicationCard({ application, onRemove }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => () => { mounted.current = false; }, []);
  const remove = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await onRemove(application.id); }
    catch (failure) { if (mounted.current) setError(failure.message); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const date = String(application.manual_applied_at || application.first_email_date).slice(0, 10);
  let safeUrl = null;
  try { const parsed = new URL(application.job_url); if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) safeUrl = parsed.href; } catch {}
  return (
    <article data-testid="manual-application-card" className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-2"><strong>{application.normalized_company_name}</strong><span className="text-[10px] text-muted-foreground">{application.user_closed_at ? 'Closed by you' : STATUS[application.current_status] || 'Applied'}</span></div>
      <p className="mt-1 text-xs">{application.position}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">Added by you · Applied {date}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{application.linkedEmailCount ? 'Linked emails are tracked. Refresh to see their history.' : 'Waiting for a matching email. No confirmation is required to keep tracking.'}</p>
      {safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-accent">View posting</a>}
      {!application.linkedEmailCount && onRemove && <div className="mt-2 text-xs">{confirm ? <><p>Remove this manually added application?</p><button type="button" disabled={busy} onClick={remove} className="mr-3 mt-2 text-destructive">{busy ? 'Removing…' : 'Confirm removal'}</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>Keep it</button></> : <button type="button" onClick={() => setConfirm(true)} className="text-muted-foreground underline">Remove entry</button>}</div>}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </article>
  );
}

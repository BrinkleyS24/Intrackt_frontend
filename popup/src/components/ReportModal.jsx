/**
 * @file popup/src/components/ReportModal.jsx
 * @description Job Search Activity Report — pick a date range, preview the
 * counts, download a PDF. Free-tier feature: the report is proof of search
 * activity for career coaches, workforce programs, and benefit requirements.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, X } from 'lucide-react';
import {
  buildActivityRows,
  filterRowsByRange,
  summarizeRows,
  REPORT_COUNTING_RULE,
  REPORT_PROVENANCE_NOTE,
} from '../utils/searchActivityReport.mjs';
import {
  deriveGroupClosedByChoice,
  deriveGroupPipelineStatus,
  deriveManualPipelineState,
} from '../../../shared/applicationDisplayState.js';

// The popup tiles' own rules, so the report's "now" counts are the tiles' counts (2026-10-15).
const STAGE_RULES = { deriveGroupClosedByChoice, deriveGroupPipelineStatus, deriveManualPipelineState };
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
import { downloadSearchActivityPdf } from '../utils/searchActivityPdf.js';
import { showNotification } from './Notification';

function toInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReportModal({
  isOpen,
  onClose,
  categorizedEmails,
  manualApplications = [],
  manualApplicationsError = null,
  manualApplicationsLoading = false,
  manualApplicationsIncomplete = false,
  onRetryManualApplications,
  userName,
  userEmail,
}) {
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date;
  }, []);
  const [startValue, setStartValue] = useState(toInputValue(defaultStart));
  const [endValue, setEndValue] = useState(toInputValue(today));
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);
  const sourceUnavailable = Boolean(manualApplicationsError || manualApplicationsLoading || manualApplicationsIncomplete);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    return () => previousFocus?.focus?.();
  }, [isOpen]);

  const rows = useMemo(
    () => buildActivityRows(categorizedEmails, manualApplications, STAGE_RULES),
    [categorizedEmails, manualApplications],
  );

  const start = useMemo(() => new Date(`${startValue}T00:00:00`), [startValue]);
  const end = useMemo(() => new Date(`${endValue}T00:00:00`), [endValue]);
  const rangeValid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end;
  const preview = useMemo(
    () => summarizeRows(rangeValid ? filterRowsByRange(rows, start, end) : []),
    [rows, start, end, rangeValid],
  );

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (sourceUnavailable || !rangeValid || isDownloading) return;
    setIsDownloading(true);
    setError(null);
    try {
      await downloadSearchActivityPdf({ rows, start, end, userName, userEmail });
      onClose();
      // The modal used to close with no sign the file was saved (2026-10-14).
      showNotification('Report downloaded. Check your Downloads folder.', 'success', null, 4000);
    } catch (err) {
      const reason = err instanceof Error && err.message ? ` ${err.message}` : '';
      setError(`The PDF could not be created.${reason} Try again.`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      data-testid="report-modal"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
    >
      <div className="relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="report-title" className="text-lg font-semibold text-foreground">Job search activity report</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A PDF record of your applications for a career coach, workforce program, or benefit requirement.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex-1 text-xs text-muted-foreground">
            From
            <input
              type="date"
              value={startValue}
              max={endValue}
              onChange={(event) => setStartValue(event.target.value)}
              data-testid="report-start-date"
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex-1 text-xs text-muted-foreground">
            To
            <input
              type="date"
              value={endValue}
              min={startValue}
              onChange={(event) => setEndValue(event.target.value)}
              data-testid="report-end-date"
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground" data-testid="report-preview">
          {sourceUnavailable && <p className="mb-1 font-semibold text-warning">Incomplete preview — still missing added applications.</p>}
          {rangeValid ? (
            <>
              <p>
                <span className="font-semibold text-foreground">{preview.applications}</span> application{preview.applications === 1 ? '' : 's'} in this period
                {' · '}{preview.interviews} reached an interview (ever)
              </p>
              <p data-testid="report-preview-now" className="mt-1">
                Now: {preview.now.applied} awaiting reply · {preview.now.interviewed} in interviews · {plural(preview.now.offers, 'offer')} · {preview.now.closed} closed
                {preview.now.closedByYou ? ` · ${preview.now.closedByYou} closed by you` : ''}
              </p>
            </>
          ) : (
            'Pick a valid date range.'
          )}
        </div>

        <p data-testid="report-counting-rule" className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{REPORT_COUNTING_RULE}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{REPORT_PROVENANCE_NOTE}</p>

        {sourceUnavailable && (
          <p role="status" data-testid="report-manual-warning" className="mt-2 text-xs text-warning">
            {manualApplicationsLoading
              ? 'Loading all applications you added. Download will be available when the complete record is ready.'
              : 'The complete record of applications you added is unavailable. Download is paused to avoid leaving applications out.'}
            {!manualApplicationsLoading && onRetryManualApplications && (
              <button type="button" onClick={onRetryManualApplications} className="ml-1 font-semibold underline underline-offset-2">Retry loading applications</button>
            )}
          </p>
        )}

        {error && <p role="alert" data-testid="report-error" className="mt-2 text-xs text-destructive">{error}</p>}

        <button
          onClick={handleDownload}
          disabled={!rangeValid || isDownloading || preview.applications === 0 || sourceUnavailable}
          data-testid="report-download-button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <FileDown className="h-4 w-4" />
          {isDownloading ? 'Building PDF...' : 'Download PDF'}
        </button>
        {rangeValid && preview.applications === 0 && (
          <p className="mt-2 text-center text-[12px] text-muted-foreground">
            No dated applications in this range yet.
          </p>
        )}
      </div>
    </div>
  );
}

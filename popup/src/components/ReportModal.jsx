/**
 * @file popup/src/components/ReportModal.jsx
 * @description Job Search Activity Report — pick a date range, preview the
 * counts, download a PDF. Free-tier feature: the report is proof of search
 * activity for career coaches, workforce programs, and benefit requirements.
 */

import React, { useMemo, useState } from 'react';
import { FileDown, X } from 'lucide-react';
import {
  buildActivityRows,
  filterRowsByRange,
  summarizeRows,
  REPORT_PROVENANCE_NOTE,
} from '../utils/searchActivityReport.mjs';
import { downloadSearchActivityPdf } from '../utils/searchActivityPdf.js';

function toInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReportModal({ isOpen, onClose, categorizedEmails, userName, userEmail }) {
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

  const rows = useMemo(() => buildActivityRows(categorizedEmails), [categorizedEmails]);

  const start = useMemo(() => new Date(`${startValue}T00:00:00`), [startValue]);
  const end = useMemo(() => new Date(`${endValue}T00:00:00`), [endValue]);
  const rangeValid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end;
  const preview = useMemo(
    () => summarizeRows(rangeValid ? filterRowsByRange(rows, start, end) : []),
    [rows, start, end, rangeValid],
  );

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      await downloadSearchActivityPdf({ rows, start, end, userName, userEmail });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      data-testid="report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold text-foreground">Job search activity report</h3>
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
          {rangeValid ? (
            <>
              <span className="font-semibold text-foreground">{preview.applications}</span> application{preview.applications === 1 ? '' : 's'} in this period
              {' · '}{preview.interviews} interview{preview.interviews === 1 ? '' : 's'}
              {' · '}{preview.offers} offer{preview.offers === 1 ? '' : 's'}
              {' · '}{preview.rejections} rejection{preview.rejections === 1 ? '' : 's'}
            </>
          ) : (
            'Pick a valid date range.'
          )}
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{REPORT_PROVENANCE_NOTE}</p>

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

        <button
          onClick={handleDownload}
          disabled={!rangeValid || isDownloading || preview.applications === 0}
          data-testid="report-download-button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <FileDown className="h-4 w-4" />
          {isDownloading ? 'Building PDF...' : 'Download PDF'}
        </button>
        {rangeValid && preview.applications === 0 && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            No dated applications in this range yet.
          </p>
        )}
      </div>
    </div>
  );
}

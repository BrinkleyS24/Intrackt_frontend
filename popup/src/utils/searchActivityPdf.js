// Renders the Job Search Activity Report PDF. jsPDF is imported dynamically so
// the popup's startup bundle does not pay for it until a report is downloaded.
import {
  filterRowsByRange,
  summarizeRows,
  weeklyActivity,
  formatLongDate,
  formatShortDate,
  REPORT_PROVENANCE_NOTE,
} from './searchActivityReport.mjs';

const INK = '#111827';
const MUTED = '#6b7280';
const RULE = '#d1d5db';

export async function downloadSearchActivityPdf({ rows, start, end, userName, userEmail }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default;

  const inRange = filterRowsByRange(rows, start, end);
  const summary = summarizeRows(inRange);
  const weeks = weeklyActivity(inRange, start, end);

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Header
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('APPLENDIUM', margin, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(INK);
  doc.text('Job Search Activity Report', margin, 76);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  const identity = [userName, userEmail].filter(Boolean).join(' · ');
  if (identity) doc.text(identity, margin, 94);
  doc.text(
    `Period: ${formatLongDate(start)} to ${formatLongDate(end)} · Generated ${formatLongDate(new Date())}`,
    margin,
    identity ? 110 : 94,
  );
  doc.setDrawColor(RULE);
  doc.line(margin, 122, pageWidth - margin, 122);

  // Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text('Summary', margin, 144);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Applications: ${summary.applications}    Interviews: ${summary.interviews}    Offers: ${summary.offers}    `
    + `Rejections: ${summary.rejections}    Awaiting reply: ${summary.awaitingReply}`,
    margin,
    162,
  );

  const weekLine = weeks.map((week) => `${week.label}: ${week.count}`).join('   ·   ');
  doc.setTextColor(MUTED);
  const weekWrapped = doc.splitTextToSize(`Weekly activity — ${weekLine}`, pageWidth - margin * 2);
  doc.text(weekWrapped, margin, 180);
  const afterWeeks = 180 + weekWrapped.length * 13;

  // Activity table
  autoTable(doc, {
    startY: afterWeeks + 10,
    margin: { left: margin, right: margin, bottom: 64 },
    head: [['Date applied', 'Company', 'Position', 'Latest status']],
    body: inRange.map((row) => [
      formatShortDate(row.appliedDate),
      row.company,
      row.position,
      row.latestStatusDate && row.latestCategory !== 'applied'
        ? `${row.latestStatusLabel} (${formatShortDate(row.latestStatusDate)})`
        : row.latestStatusLabel,
    ]),
    styles: { font: 'helvetica', fontSize: 9, textColor: INK, lineColor: RULE, lineWidth: 0.5 },
    headStyles: { fillColor: '#f3f4f6', textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#fafafa' },
  });

  // Footer with provenance on every page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    const note = doc.splitTextToSize(REPORT_PROVENANCE_NOTE, pageWidth - margin * 2 - 120);
    doc.text(note, margin, pageHeight - 40);
    doc.text(`applendium.com · page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 40, { align: 'right' });
  }

  const stamp = `${formatShortDate(start)}-${formatShortDate(end)}`.replace(/\s+/g, '').toLowerCase();
  doc.save(`applendium-job-search-activity-${stamp}.pdf`);
  return { rowCount: inRange.length, summary };
}

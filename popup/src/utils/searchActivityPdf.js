// Renders the Job Search Activity Report PDF. jsPDF is imported dynamically so
// the popup's startup bundle does not pay for it until a report is downloaded.
//
// Design: Applendium paper/ink/green — ink header band, stat tiles, a weekly
// activity bar chart, numbered activity table, reviewer sign-off line. Counts
// are always printed as text next to any colored element so the document stays
// legible in black-and-white photocopies.
import {
  filterRowsByRange,
  summarizeRows,
  weeklyActivity,
  formatLongDate,
  formatShortDate,
  REPORT_PROVENANCE_NOTE,
} from './searchActivityReport.mjs';

const INK = '#101613';
const PAPER = '#f7f6f2';
const PAPER_TINT = '#eef2ee';
const GREEN = '#7ddfb7';
const MUTED = '#5f6f66';
const MUTED_ON_INK = '#9db3a8';
const RULE = '#d7ded9';

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
  const contentWidth = pageWidth - margin * 2;

  // ── Header band ──────────────────────────────────────────────────────────
  const bandHeight = 96;
  doc.setFillColor(INK);
  doc.rect(0, 0, pageWidth, bandHeight, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(GREEN);
  doc.text('A P P L E N D I U M', margin, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(PAPER);
  doc.text('Job Search Activity Report', margin, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED_ON_INK);
  const identity = [userName, userEmail].filter(Boolean).join('  ·  ');
  if (identity) doc.text(identity, margin, 74);
  doc.text(
    `Period: ${formatLongDate(start)} to ${formatLongDate(end)}`,
    margin,
    identity ? 87 : 74,
  );
  doc.text(`Generated ${formatLongDate(new Date())}`, pageWidth - margin, identity ? 87 : 74, { align: 'right' });

  // ── Stat tiles ───────────────────────────────────────────────────────────
  const tiles = [
    { value: summary.applications, label: 'APPLICATIONS' },
    { value: summary.interviews, label: 'INTERVIEWS' },
    { value: summary.offers, label: 'OFFERS' },
    { value: summary.rejections, label: 'REJECTIONS' },
    { value: summary.awaitingReply, label: 'AWAITING REPLY' },
  ];
  const tileGap = 10;
  const tileWidth = (contentWidth - tileGap * (tiles.length - 1)) / tiles.length;
  const tileTop = bandHeight + 22;
  const tileHeight = 54;
  tiles.forEach((tile, index) => {
    const x = margin + index * (tileWidth + tileGap);
    doc.setFillColor(index === 0 ? PAPER_TINT : '#ffffff');
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.75);
    doc.roundedRect(x, tileTop, tileWidth, tileHeight, 5, 5, 'FD');
    if (index === 0) {
      // Green keel on the headline tile; the number itself stays ink for B/W.
      doc.setFillColor(GREEN);
      doc.rect(x, tileTop + 5, 3, tileHeight - 10, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.setTextColor(INK);
    doc.text(String(tile.value), x + 12, tileTop + 30);
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED);
    doc.text(tile.label, x + 12, tileTop + 43);
  });

  // ── Weekly activity bar chart ────────────────────────────────────────────
  const chartTitleY = tileTop + tileHeight + 30;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text('WEEKLY ACTIVITY', margin, chartTitleY);

  const chartTop = chartTitleY + 10;
  const chartHeight = 58;
  const baselineY = chartTop + chartHeight;
  const maxCount = Math.max(1, ...weeks.map((week) => week.count));
  const barGap = weeks.length > 14 ? 3 : 6;
  const barWidth = (contentWidth - barGap * Math.max(0, weeks.length - 1)) / Math.max(1, weeks.length);
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 9));

  doc.setDrawColor(RULE);
  doc.setLineWidth(0.75);
  doc.line(margin, baselineY, margin + contentWidth, baselineY);

  weeks.forEach((week, index) => {
    const x = margin + index * (barWidth + barGap);
    if (week.count > 0) {
      const barHeight = Math.max(6, (week.count / maxCount) * chartHeight);
      doc.setFillColor(GREEN);
      doc.setDrawColor(INK);
      doc.setLineWidth(0.5);
      doc.rect(x, baselineY - barHeight, barWidth, barHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(INK);
      doc.text(String(week.count), x + barWidth / 2, baselineY - barHeight - 4, { align: 'center' });
    } else {
      // Zero weeks stay honest and visible: a flat tick on the baseline.
      doc.setDrawColor(MUTED);
      doc.setLineWidth(1);
      doc.line(x + barWidth * 0.25, baselineY - 1.5, x + barWidth * 0.75, baselineY - 1.5);
    }
    if (index % labelEvery === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(MUTED);
      const weekStart = week.label.split(' - ')[0];
      doc.text(weekStart, x + barWidth / 2, baselineY + 10, { align: 'center' });
    }
  });

  // ── Activity table ───────────────────────────────────────────────────────
  autoTable(doc, {
    startY: baselineY + 26,
    margin: { left: margin, right: margin, bottom: 96 },
    head: [['#', 'Date applied', 'Company', 'Position', 'Latest status']],
    body: inRange.map((row, index) => [
      String(index + 1),
      formatShortDate(row.appliedDate),
      row.company,
      row.position,
      row.latestStatusDate && row.latestCategory !== 'applied'
        ? `${row.latestStatusLabel} (${formatShortDate(row.latestStatusDate)})`
        : row.latestStatusLabel,
    ]),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
      lineColor: RULE,
      lineWidth: { bottom: 0.5 },
    },
    headStyles: {
      fillColor: INK,
      textColor: PAPER,
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: PAPER_TINT },
    columnStyles: {
      0: { cellWidth: 26, textColor: MUTED },
      1: { cellWidth: 78 },
      4: { fontStyle: 'bold' },
    },
  });

  // ── Reviewer sign-off ────────────────────────────────────────────────────
  let afterTableY = (doc.lastAutoTable?.finalY || baselineY + 26) + 30;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (afterTableY > pageHeight - 120) {
    doc.addPage();
    afterTableY = 72;
  }
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(MUTED);
  doc.text('FOR REVIEWER USE', margin, afterTableY);
  doc.setDrawColor(INK);
  doc.setLineWidth(0.75);
  const signWidth = (contentWidth - 40) / 3;
  const signY = afterTableY + 28;
  ['Reviewed by', 'Signature', 'Date'].forEach((label, index) => {
    const x = margin + index * (signWidth + 20);
    doc.line(x, signY, x + signWidth, signY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(MUTED);
    doc.text(label, x, signY + 11);
  });

  // ── Footer with provenance on every page ─────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 58, pageWidth - margin, pageHeight - 58);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    const note = doc.splitTextToSize(REPORT_PROVENANCE_NOTE, contentWidth - 130);
    doc.text(note, margin, pageHeight - 44);
    doc.setFont('courier', 'bold');
    doc.text(`applendium.com · page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 44, { align: 'right' });
  }

  const stamp = `${formatShortDate(start)}-${formatShortDate(end)}`.replace(/\s+/g, '').toLowerCase();
  doc.save(`applendium-job-search-activity-${stamp}.pdf`);
  return { rowCount: inRange.length, summary };
}

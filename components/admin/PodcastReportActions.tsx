'use client';

import { useEffect, useState } from 'react';
import { drawFullCanvasText, wrapCanvasText } from '@/lib/canvasText';
import type { PodcastReportData } from '@/lib/podcastReport';

const COLORS = {
  navy: '#071a2d',
  violet: '#6d4ee8',
  orange: '#e97919',
  green: '#168657',
  red: '#d84747',
  text: '#132238',
  muted: '#64748b',
  line: '#dce4ee',
  bg: '#eef2f6',
  white: '#ffffff',
  soft: '#f8fafc',
};

const PAGE_W = 1800;
const PAGE_H = Math.round(PAGE_W * 210 / 297);
const PAGE_GAP = 34;
const MARGIN = 45;

function safeFilename(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'release-check';
}


function avg(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function rank(value: number | null) {
  return value === null ? '—' : `#${value}`;
}

function fillPage(ctx: CanvasRenderingContext2D, top: number, height = PAGE_H) {
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, top, PAGE_W, height);
}

function drawHeader(ctx: CanvasRenderingContext2D, top: number, title: string, data: PodcastReportData, page: string) {
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, top, PAGE_W, 132);
  ctx.fillStyle = COLORS.white;
  ctx.font = '900 22px Arial, sans-serif';
  ctx.fillText('KNALLHART SERVIERT · RELEASE CHECK', MARGIN, top + 33);
  ctx.font = '900 32px Arial, sans-serif';
  drawFullCanvasText(ctx, title, MARGIN, top + 74, PAGE_W - MARGIN * 2, 36);
  ctx.fillStyle = '#c7d4e2';
  ctx.font = '700 17px Arial, sans-serif';
  drawFullCanvasText(ctx, `${data.title}${data.period ? ` · ${data.period}` : ''}`, MARGIN, top + 112, 1100, 22);
  ctx.textAlign = 'right';
  ctx.font = '800 17px Arial, sans-serif';
  ctx.fillText(page, PAGE_W - MARGIN, top + 34);
  ctx.font = '600 14px Arial, sans-serif';
  ctx.fillText(`${data.summary.songs} Songs · ${data.summary.countedAudienceVotes} Publikum · Jury ${data.summary.submittedJurors}/${data.summary.activeJurors}`, PAGE_W - MARGIN, top + 112);
  ctx.textAlign = 'left';
}

function drawSummaryCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string, detail: string, accent: string) {
  ctx.fillStyle = COLORS.white;
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, 140, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, 7, 140);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '900 12px Arial, sans-serif';
  ctx.fillText(label, x + 20, y + 24);
  ctx.fillStyle = COLORS.text;
  ctx.font = '900 17px Arial, sans-serif';
  drawFullCanvasText(ctx, value, x + 20, y + 80, w - 40, 70);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 12px Arial, sans-serif';
  drawFullCanvasText(ctx, detail, x + 20, y + 121, w - 40, 22);
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  top: number,
  x: number,
  headers: string[],
  widths: number[],
  rows: string[][],
  rowHeight: number,
  options: { headerHeight?: number; fontSize?: number; boldCols?: number[]; alignCenterFrom?: number } = {},
) {
  const headerHeight = options.headerHeight || 38;
  const fontSize = options.fontSize || 13;
  const boldCols = new Set(options.boldCols || []);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  ctx.fillStyle = '#edf1f5';
  ctx.fillRect(x, top, totalWidth, headerHeight);
  let cx = x;
  ctx.fillStyle = COLORS.muted;
  ctx.font = '900 11px Arial, sans-serif';
  headers.forEach((header, i) => {
    const center = options.alignCenterFrom !== undefined && i >= options.alignCenterFrom;
    ctx.textAlign = center ? 'center' : 'left';
    drawFullCanvasText(ctx, header, center ? cx + widths[i] / 2 : cx + 6, top + 24, widths[i] - 12, 24);
    cx += widths[i];
  });
  ctx.textAlign = 'left';

  let cursor = top + headerHeight;
  rows.forEach((row, ri) => {
    const y = cursor;
    const actualRowHeight = Math.max(rowHeight, ...row.map((cell, ci) => {
      const size = ci === 1 ? fontSize : Math.max(9, fontSize - 1);
      ctx.font = `${boldCols.has(ci) ? 900 : 600} ${size}px Arial, sans-serif`;
      return wrapCanvasText(ctx, cell, widths[ci] - 12).length * size * 1.15 + 12;
    }));
    if (ri % 2) { ctx.fillStyle = COLORS.soft; ctx.fillRect(x, y, totalWidth, actualRowHeight); }
    ctx.strokeStyle = COLORS.line; ctx.beginPath(); ctx.moveTo(x, y + actualRowHeight); ctx.lineTo(x + totalWidth, y + actualRowHeight); ctx.stroke();
    let colX = x;
    row.forEach((cell, ci) => {
      const center = options.alignCenterFrom !== undefined && ci >= options.alignCenterFrom;
      ctx.textAlign = center ? 'center' : 'left';
      ctx.fillStyle = COLORS.text;
      ctx.font = `${boldCols.has(ci) ? 900 : 600} ${ci === 1 ? fontSize : Math.max(9, fontSize - 1)}px Arial, sans-serif`;
      drawFullCanvasText(ctx, cell, center ? colX + widths[ci] / 2 : colX + 6, y + 6 + (actualRowHeight - 12) * .65, widths[ci] - 12, actualRowHeight - 12);
      colX += widths[ci];
    });
    cursor += actualRowHeight;
  });
  ctx.textAlign = 'left';
  return cursor;
}

function drawPage1(ctx: CanvasRenderingContext2D, top: number, data: PodcastReportData, height = PAGE_H) {
  fillPage(ctx, top, height);
  drawHeader(ctx, top, 'SENDUNGSAUSDRUCK · ERGEBNISMATRIX', data, 'SEITE 1 / 2');
  const y0 = top + 150;
  const cardGap = 12;
  const cardW = (PAGE_W - MARGIN * 2 - cardGap * 3) / 4;
  drawSummaryCard(ctx, MARGIN, y0, cardW, 'GESAMT', data.quick.overallWinner, data.quick.overallWinnerDetail, COLORS.orange);
  drawSummaryCard(ctx, MARGIN + (cardW + cardGap), y0, cardW, 'JURY', data.quick.juryWinner, data.quick.juryWinnerDetail, COLORS.violet);
  drawSummaryCard(ctx, MARGIN + (cardW + cardGap) * 2, y0, cardW, 'PUBLIKUM', data.quick.audienceWinner, data.quick.audienceWinnerDetail, COLORS.green);
  drawSummaryCard(ctx, MARGIN + (cardW + cardGap) * 3, y0, cardW, 'Knallhart durchgefallen', data.quick.zonkWinner, data.quick.strongestSplitDetail, COLORS.red);

  const tableTop = y0 + 160;
  const jurorCount = Math.max(1, data.jurors.length);
  const fixed = 45 * 3 + 380 + 66 + 58 + 64 + 70 + 58 + 70 + 58;
  const jurorW = Math.max(48, (PAGE_W - MARGIN * 2 - fixed) / jurorCount);
  const widths = [45, 45, 45, 380, ...Array.from({ length: jurorCount }, () => jurorW), 66, 58, 64, 70, 58, 70, 58];
  const headers = ['G', 'J', 'P', 'SONG / KÜNSTLER', ...(data.jurors.length ? data.jurors.map((j) => j.name) : ['JURY']), 'JΣ', 'ØJ', 'P12', 'P ROH', 'ØP', 'GΣ', 'ØG'];
  const rowHeight = 28;
  const rows = data.overallRows.map((row) => [
    rank(row.rank), rank(row.juryRank), rank(row.audienceRank), `${row.title} — ${row.artist}`,
    ...(row.jurorPoints.length ? row.jurorPoints.map((entry) => entry.points === null ? '—' : String(entry.points)) : ['—']),
    String(row.juryPoints), avg(row.juryAverage), String(row.audiencePoints), String(row.audienceRawPoints), avg(row.audienceAverage), String(row.total), avg(row.overallAverage),
  ]);
  const tableBottom = drawTable(ctx, tableTop, MARGIN, headers, widths, rows, rowHeight, { headerHeight: 40, fontSize: rowHeight < 25 ? 10 : 12, boldCols: [0, 4 + jurorCount, 5 + jurorCount, 9 + jurorCount, 10 + jurorCount], alignCenterFrom: 4 });

  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 10px Arial, sans-serif';
  ctx.fillText('G/J/P = Gesamt-/Jury-/Publikumsplatz · P12 = Publikum als virtuelle 12–1-Stimme · P Roh / ØP = alle gewerteten Publikumsvotings.', MARGIN, top + height - 18);
  return Math.max(PAGE_H, tableBottom - top + 50);
}

function drawPage2(ctx: CanvasRenderingContext2D, top: number, data: PodcastReportData, height = PAGE_H) {
  fillPage(ctx, top, height);
  drawHeader(ctx, top, 'SENDUNGSAUSDRUCK · EINZELSTIMMEN & PUBLIKUM', data, 'SEITE 2 / 2');

  const columns = [...data.jurors.map((j) => ({ id: j.id, name: j.name, rows: j.rows, zonk: j.zonk || '—', submitted: j.submitted })), { id: 'audience', name: 'Publikum', rows: data.audienceCard.rows, zonk: data.audienceCard.zonk || '—', submitted: data.summary.countedAudienceVotes > 0 }];
  const voteTop = top + 150;
  const firstW = 158;
  const colW = (PAGE_W - MARGIN * 2 - firstW) / Math.max(1, columns.length);
  const widths = [firstW, ...columns.map(() => colW)];
  const headers = ['PL.', ...columns.map((c) => c.name)];
  const voteRows = Array.from({ length: 12 }, (_, index) => {
    const place = index + 1;
    return [`#${place} · ${13 - place}P`, ...columns.map((column) => {
      if (!column.submitted) return '—';
      const row = column.rows.find((entry) => entry.rank === place);
      return row ? `${row.title} — ${row.artist}` : '—';
    })];
  });
  voteRows.push(['Knallhart durchgefallen', ...columns.map((c) => c.zonk)]);
  const voteBottom = drawTable(ctx, voteTop, MARGIN, headers, widths, voteRows, 43, { headerHeight: 38, fontSize: 11, boldCols: [0], alignCenterFrom: 0 });

  const bottomTop = voteBottom + 18;
  const leftW = 1135;
  const rightX = MARGIN + leftW + 18;
  const rightW = PAGE_W - MARGIN - rightX;
  ctx.fillStyle = COLORS.text; ctx.font = '900 18px Arial, sans-serif'; ctx.fillText('PUBLIKUM KOMPAKT', MARGIN, bottomTop + 17);
  const audienceTop = bottomTop + 28;
  const audWidths = [52, 520, 82, 82, 82, 82, 70];
  const audHeaders = ['PL.', 'SONG / KÜNSTLER', 'ROH', 'ØP', 'GEW.', 'ANTEIL', '12–1'];
  const audRows = data.audienceRows.map((row) => [`#${row.rank}`, `${row.title} — ${row.artist}`, String(row.total), avg(row.average), String(row.mentions), row.share === null ? '—' : `${row.share.toFixed(1)}%`, String(row.audiencePoints)]);
  const audienceBottom = drawTable(ctx, audienceTop, MARGIN, audHeaders, audWidths, audRows, 27, { headerHeight: 34, fontSize: 10, boldCols: [0, 3, 6], alignCenterFrom: 2 });

  ctx.fillStyle = COLORS.text; ctx.font = '900 18px Arial, sans-serif'; ctx.fillText('GESPRÄCHSANKER', rightX, bottomTop + 17);
  let y = audienceTop;
  const anchors = [
    ['Gesamt', data.quick.overallWinner, data.quick.overallWinnerDetail],
    ['Jury', data.quick.juryWinner, data.quick.juryWinnerDetail],
    ['Publikum', data.quick.audienceWinner, data.quick.audienceWinnerDetail],
    ['Abweichung', data.quick.strongestSplit, data.quick.strongestSplitDetail],
  ];
  anchors.forEach(([label, value, detail]) => {
    ctx.fillStyle = COLORS.soft; ctx.beginPath(); ctx.roundRect(rightX, y, rightW, 58, 8); ctx.fill();
    ctx.fillStyle = COLORS.muted; ctx.font = '900 10px Arial, sans-serif'; ctx.fillText(label.toUpperCase(), rightX + 10, y + 15);
    ctx.fillStyle = COLORS.text; ctx.font = '900 12px Arial, sans-serif'; drawFullCanvasText(ctx, value, rightX + 10, y + 34, rightW - 20, 24);
    ctx.fillStyle = COLORS.muted; ctx.font = '600 9px Arial, sans-serif'; drawFullCanvasText(ctx, detail, rightX + 10, y + 50, rightW - 20, 16);
    y += 64;
  });
  ctx.fillStyle = COLORS.red; ctx.font = '900 12px Arial, sans-serif'; ctx.fillText('Knallhart durchgefallen GESAMT', rightX, y + 14); y += 24;
  data.zonkRows.slice(0, 5).forEach((row) => {
    ctx.fillStyle = COLORS.text; ctx.font = '800 10px Arial, sans-serif';
    drawFullCanvasText(ctx, `#${row.rank} ${row.title} — ${row.artist}`, rightX, y + 12, rightW - 80, 20);
    ctx.textAlign = 'right'; ctx.fillText(`P${row.audience} J${row.jury} Σ${row.total}`, rightX + rightW, y + 12); ctx.textAlign = 'left'; y += 23;
  });

  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 10px Arial, sans-serif';
  ctx.fillText('Ø Publikum = Durchschnitt über alle gewerteten einzelnen Publikumsvotings, nicht gewählte Songs zählen mit 0. Publikum 12–1 zählt in der Gesamtwertung genau einmal.', MARGIN, top + height - 18);
  return Math.max(PAGE_H, Math.max(audienceBottom, y) - top + 50);
}

function buildPodcastCanvas(data: PodcastReportData) {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const firstHeight = Math.ceil(drawPage1(ctx, 0, data));
  const secondHeight = Math.ceil(drawPage2(ctx, 0, data));
  canvas.height = firstHeight + PAGE_GAP + secondHeight;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPage1(ctx, 0, data, firstHeight);
  drawPage2(ctx, firstHeight + PAGE_GAP, data, secondHeight);
  return canvas;
}

export default function PodcastReportActions({ data, autoPrint = false, printHref }: { data: PodcastReportData; autoPrint?: boolean; printHref?: string }) {
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  function downloadPng() {
    setWorking(true);
    window.setTimeout(() => {
      try {
        const canvas = buildPodcastCanvas(data);
        if (!canvas) return;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${safeFilename(data.title)}-sendungsausdruck.png`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
      } finally {
        setWorking(false);
      }
    }, 30);
  }

  function printReport() {
    if (printHref) { window.open(printHref, '_blank', 'noopener,noreferrer'); return; }
    window.print();
  }

  return <div className="ks-inline-actions no-print">
    <button className="ks-button primary" type="button" onClick={printReport}>PDF / Drucken</button>
    <button className="ks-button secondary" type="button" onClick={downloadPng} disabled={working}>{working ? 'PNG wird erstellt …' : 'Sendungsausdruck als PNG'}</button>
  </div>;
}

'use client';

import { useEffect, useState } from 'react';
import type { PodcastReportData } from '@/lib/podcastReport';

const COLORS = {
  navy: '#071a2d',
  violet: '#6d4ee8',
  orange: '#e97919',
  text: '#132238',
  muted: '#64748b',
  line: '#dce4ee',
  bg: '#f4f7fb',
  white: '#ffffff',
  soft: '#f7f8fb',
};

function safeFilename(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'release-check';
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = 16) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function fit(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function drawCellText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, bold = false, size = 18) {
  ctx.fillStyle = COLORS.text;
  ctx.font = `${bold ? 800 : 600} ${size}px Arial, sans-serif`;
  ctx.fillText(fit(ctx, value, width), x, y);
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, number: string, title: string, subtitle: string, y: number, width: number) {
  ctx.fillStyle = COLORS.violet;
  ctx.font = '900 24px Arial, sans-serif';
  ctx.fillText(number, 70, y + 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = '900 34px Arial, sans-serif';
  ctx.fillText(title, 125, y + 30);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '500 18px Arial, sans-serif';
  ctx.fillText(fit(ctx, subtitle, width - 195), 125, y + 60);
  return y + 92;
}

function drawSimpleTable(
  ctx: CanvasRenderingContext2D,
  y: number,
  headers: string[],
  widths: number[],
  rows: string[][],
  options: { rowHeight?: number; firstColumnsBold?: number } = {},
) {
  const x = 70;
  const rowHeight = options.rowHeight || 54;
  const firstBold = options.firstColumnsBold || 0;
  const totalWidth = widths.reduce((sum, value) => sum + value, 0);
  ctx.fillStyle = COLORS.white;
  roundedRect(ctx, x, y, totalWidth, 48 + rows.length * rowHeight, 14);
  ctx.fill();
  ctx.fillStyle = '#eef1f6';
  ctx.fillRect(x, y, totalWidth, 48);
  let cursor = x;
  ctx.fillStyle = COLORS.muted;
  ctx.font = '800 14px Arial, sans-serif';
  headers.forEach((header, index) => {
    ctx.fillText(fit(ctx, header.toUpperCase(), widths[index] - 16), cursor + 8, y + 30);
    cursor += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const rowY = y + 48 + rowIndex * rowHeight;
    if (rowIndex % 2 === 1) {
      ctx.fillStyle = COLORS.soft;
      ctx.fillRect(x, rowY, totalWidth, rowHeight);
    }
    ctx.strokeStyle = COLORS.line;
    ctx.beginPath();
    ctx.moveTo(x, rowY + rowHeight);
    ctx.lineTo(x + totalWidth, rowY + rowHeight);
    ctx.stroke();
    let colX = x;
    row.forEach((cell, colIndex) => {
      drawCellText(ctx, cell, colX + 8, rowY + 33, widths[colIndex] - 16, colIndex < firstBold, colIndex === 1 ? 17 : 16);
      colX += widths[colIndex];
    });
  });
  return y + 48 + rows.length * rowHeight;
}

function average(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function rank(value: number | null) {
  return value === null ? '—' : `#${value}`;
}

function buildPodcastCanvas(data: PodcastReportData) {
  const width = 1800;
  const juryCards = data.jurors.length + 1;
  const juryRows = Math.ceil(juryCards / 2);
  const overallHeight = 170 + data.overallRows.length * 56;
  const juryHeight = 130 + juryRows * 610;
  const ratingsHeight = 170 + data.songRatingRows.length * 54;
  const audienceHeight = 170 + data.audienceRows.length * 54;
  const zonkHeight = 160 + Math.max(1, data.zonkRows.length) * 54;
  const height = 1050 + overallHeight + juryHeight + ratingsHeight + audienceHeight + zonkHeight + 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, width, 245);
  ctx.fillStyle = COLORS.white;
  ctx.font = '900 26px Arial, sans-serif';
  ctx.fillText('KNALLHART SERVIERT · RELEASE CHECK', 70, 58);
  ctx.font = '900 56px Arial, sans-serif';
  ctx.fillText('SENDUNGSAUSDRUCK', 70, 130);
  ctx.fillStyle = '#c7d4e2';
  ctx.font = '700 25px Arial, sans-serif';
  ctx.fillText(fit(ctx, `${data.title}${data.period ? ` · ${data.period}` : ''}`, width - 140), 70, 180);
  ctx.font = '600 18px Arial, sans-serif';
  ctx.fillText(`${data.summary.songs} Songs · ${data.summary.countedAudienceVotes} Publikum gewertet · Jury ${data.summary.submittedJurors}/${data.summary.activeJurors}`, 70, 218);

  let y = 285;
  ctx.fillStyle = COLORS.text;
  ctx.font = '900 34px Arial, sans-serif';
  ctx.fillText('Schnellblick für die Sendung', 70, y + 30);
  y += 58;
  const quick = [
    ['Gesamtsieger', data.quick.overallWinner, data.quick.overallWinnerDetail],
    ['Jury-Sieger', data.quick.juryWinner, data.quick.juryWinnerDetail],
    ['Publikums-Sieger', data.quick.audienceWinner, data.quick.audienceWinnerDetail],
    ['ZONK gesamt', data.quick.zonkWinner, data.quick.zonkWinnerDetail],
    ['Größte Abweichung', data.quick.strongestSplit, data.quick.strongestSplitDetail],
    ['Abstand Platz 1–2', data.summary.winnerGap === null ? '—' : `${data.summary.winnerGap} Punkte`, `${data.summary.totalAudienceVotes} Publikumsstimmen insgesamt`],
  ];
  const gap = 18;
  const cardWidth = (width - 140 - gap * 2) / 3;
  quick.forEach((entry, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 70 + col * (cardWidth + gap);
    const cardY = y + row * 170;
    roundedRect(ctx, x, cardY, cardWidth, 150, 16);
    ctx.fillStyle = COLORS.white;
    ctx.fill();
    ctx.fillStyle = COLORS.violet;
    ctx.fillRect(x, cardY, 7, 150);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '800 15px Arial, sans-serif';
    ctx.fillText(entry[0].toUpperCase(), x + 26, cardY + 34);
    ctx.fillStyle = COLORS.text;
    ctx.font = '900 22px Arial, sans-serif';
    ctx.fillText(fit(ctx, entry[1], cardWidth - 52), x + 26, cardY + 76);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 16px Arial, sans-serif';
    ctx.fillText(fit(ctx, entry[2], cardWidth - 52), x + 26, cardY + 112);
  });
  y += 365;

  y = drawSectionTitle(ctx, '01', 'Gesamtwertung Jury + Publikum', 'Einzelpunkte jedes Jurors plus Jury-Summe, Ø Jury, Publikum und Gesamtwertung.', y, width);
  const jurorWidth = data.jurors.length ? Math.max(70, Math.min(120, 450 / data.jurors.length)) : 80;
  const overallHeaders = ['Pl.', 'Song / Künstler', ...data.jurors.map((juror) => juror.name), 'Jury Σ', 'Ø J.', 'Publ.', 'Ges.', 'Ø G.'];
  const fixed = 90 + 520 + 105 + 90 + 90 + 100 + 90;
  const remaining = width - 140 - fixed;
  const actualJurorWidth = data.jurors.length ? Math.max(46, Math.min(jurorWidth, remaining / data.jurors.length)) : 0;
  const overallWidths = [90, 520, ...data.jurors.map(() => actualJurorWidth), 105, 90, 90, 100, 90];
  const usedWidth = overallWidths.reduce((sum, value) => sum + value, 0);
  if (usedWidth < width - 140) overallWidths[1] += (width - 140 - usedWidth);
  y = drawSimpleTable(ctx, y, overallHeaders, overallWidths, data.overallRows.map((row) => [rank(row.rank), `${row.title} — ${row.artist}`, ...row.jurorPoints.map((entry) => entry.points === null ? '—' : String(entry.points)), String(row.juryPoints), average(row.juryAverage), String(row.audiencePoints), String(row.total), average(row.overallAverage)]), { rowHeight: 56, firstColumnsBold: 1 });
  y += 45;

  y = drawSectionTitle(ctx, '02', 'Einzelne Jury-Wertungen', 'Top 12 jedes Jurors plus Publikum als virtuelle 12–1-Stimme und der jeweilige ZONK.', y, width);
  const cards = [
    ...data.jurors.map((juror) => ({ title: juror.name, sub: juror.submitted ? 'abgegeben' : 'noch offen', rows: juror.rows, zonk: juror.zonk || 'Kein ZONK gewählt' })),
    { title: 'Publikum · 12–1-Stimme', sub: `${data.summary.countedAudienceVotes} gewertet`, rows: data.audienceCard.rows, zonk: data.audienceCard.zonk || 'Noch kein Publikums-ZONK' },
  ];
  const cardW = (width - 140 - 20) / 2;
  cards.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 70 + col * (cardW + 20);
    const cardY = y + row * 610;
    roundedRect(ctx, x, cardY, cardW, 585, 16);
    ctx.fillStyle = COLORS.white;
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = '900 23px Arial, sans-serif';
    ctx.fillText(fit(ctx, card.title, cardW - 170), x + 22, cardY + 38);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 15px Arial, sans-serif';
    ctx.fillText(card.sub, x + cardW - 140, cardY + 38);
    ctx.strokeStyle = COLORS.line;
    ctx.beginPath(); ctx.moveTo(x + 20, cardY + 55); ctx.lineTo(x + cardW - 20, cardY + 55); ctx.stroke();
    if (!card.rows.length) {
      ctx.fillStyle = COLORS.muted; ctx.font = '600 18px Arial, sans-serif'; ctx.fillText('Noch keine Wertung.', x + 22, cardY + 92);
    } else {
      card.rows.forEach((entry, entryIndex) => {
        const rowY = cardY + 83 + entryIndex * 37;
        ctx.fillStyle = COLORS.violet; ctx.font = '900 16px Arial, sans-serif'; ctx.fillText(`#${entry.rank}`, x + 22, rowY);
        ctx.fillStyle = COLORS.text; ctx.font = '800 16px Arial, sans-serif'; ctx.fillText(fit(ctx, entry.title, cardW - 235), x + 72, rowY);
        ctx.fillStyle = COLORS.muted; ctx.font = '600 14px Arial, sans-serif'; ctx.fillText(fit(ctx, entry.artist, cardW - 235), x + 72, rowY + 17);
        ctx.fillStyle = COLORS.text; ctx.font = '800 15px Arial, sans-serif'; ctx.fillText(`${entry.points} P.`, x + cardW - 72, rowY);
      });
    }
    ctx.fillStyle = '#fff5e9';
    roundedRect(ctx, x + 18, cardY + 526, cardW - 36, 42, 10); ctx.fill();
    ctx.fillStyle = '#9a4d0a'; ctx.font = '800 14px Arial, sans-serif'; ctx.fillText(fit(ctx, `ZONK: ${card.zonk}`, cardW - 62), x + 30, cardY + 552);
  });
  y += Math.ceil(cards.length / 2) * 610 + 45;

  y = drawSectionTitle(ctx, '03', 'Song-Bewertungen im Vergleich', 'Gesamt-, Jury- und Publikumsplatz sowie Ø Jury, Ø Publikum, Ø Gesamt, Nennungen und Polarisierung.', y, width);
  y = drawSimpleTable(ctx, y, ['Ges.', 'Song / Künstler', 'Jury-Pl.', 'Publ.-Pl.', 'Ø Jury', 'Ø Publ.', 'Ø Ges.', 'Gewählt', 'Abw.', 'Pol.'], [80, 590, 105, 105, 100, 105, 100, 105, 120, 100], data.songRatingRows.map((row) => [rank(row.rank), `${row.title} — ${row.artist}`, rank(row.juryRank), rank(row.audienceRank), average(row.juryAverage), average(row.audienceAverage), average(row.overallAverage), String(row.audienceMentions), row.rankDifference === null ? '—' : row.rankDifference === 0 ? 'gleich' : row.rankDifference > 0 ? `Publ. +${row.rankDifference}` : `Jury +${Math.abs(row.rankDifference)}`, row.polarizationIndex === null ? '—' : `${row.polarizationIndex}/100`]), { rowHeight: 54, firstColumnsBold: 1 });
  y += 45;

  y = drawSectionTitle(ctx, '04', 'Publikumsergebnis', 'Offizielle Publikums-Top-12 mit Rohpunkten, Ø Publikum, Nennungen und 12–1-Punkten.', y, width);
  y = drawSimpleTable(ctx, y, ['Platz', 'Song / Künstler', 'Punkte', 'Ø Publikum', 'Gewählt', 'Anteil', '12–1'], [100, 790, 150, 160, 135, 135, 130], data.audienceRows.map((row) => [`#${row.rank}`, `${row.title} — ${row.artist}`, String(row.total), average(row.average), String(row.mentions), row.share === null ? '—' : `${row.share.toFixed(1)} %`, String(row.audiencePoints)]), { rowHeight: 54, firstColumnsBold: 1 });
  y += 45;

  y = drawSectionTitle(ctx, '05', 'ZONK-Auswertung', 'ZONK-Stimmen aus Publikum und Jury getrennt und zusammen.', y, width);
  const zonkRows = data.zonkRows.length ? data.zonkRows.map((row) => [`#${row.rank}`, `${row.title} — ${row.artist}`, String(row.audience), String(row.jury), String(row.total)]) : [['—', 'Noch keine ZONK-Stimmen vorhanden', '0', '0', '0']];
  y = drawSimpleTable(ctx, y, ['Platz', 'Song / Künstler', 'Publikum', 'Jury', 'Gesamt'], [110, 930, 210, 210, 200], zonkRows, { rowHeight: 54, firstColumnsBold: 1 });
  y += 55;

  ctx.fillStyle = COLORS.text; ctx.font = '900 32px Arial, sans-serif'; ctx.fillText('Sendungsnotizen', 70, y + 30);
  y += 60;
  ctx.strokeStyle = '#b9c6d5';
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath(); ctx.moveTo(70, y + i * 42); ctx.lineTo(width - 70, y + i * 42); ctx.stroke();
  }
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
    <button className="ks-button secondary" type="button" onClick={downloadPng} disabled={working}>{working ? 'PNG wird erstellt …' : 'Kompletten Report als PNG'}</button>
  </div>;
}

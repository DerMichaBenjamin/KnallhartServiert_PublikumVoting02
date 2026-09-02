'use client';

import { useEffect, useState } from 'react';
import type { ReportGraphicData } from '@/lib/releaseStatisticsCore';
import PopoverMenu from './PopoverMenu';

type ReportView = 'results' | 'statistics';

const COLORS = {
  navy: '#071a2d',
  violet: '#6d4ee8',
  orange: '#e97919',
  green: '#168657',
  red: '#d84747',
  text: '#132238',
  muted: '#64748b',
  line: '#dde4ee',
  background: '#f4f7fb',
};

function safeFilename(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'release-check';
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = 18) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function drawHeader(context: CanvasRenderingContext2D, data: ReportGraphicData, heading: string, width: number) {
  context.fillStyle = COLORS.navy;
  context.fillRect(0, 0, width, 310);
  context.fillStyle = COLORS.violet;
  context.fillRect(0, 300, width, 10);
  context.fillStyle = '#ffffff';
  context.font = '800 30px Arial, sans-serif';
  context.fillText('KNALLHART SERVIERT · RELEASE-CHECK', 90, 74);
  context.font = '800 58px Arial, sans-serif';
  context.fillText(fitText(context, heading, width - 180), 90, 160);
  context.font = '700 34px Arial, sans-serif';
  context.fillStyle = '#d7e2ee';
  context.fillText(fitText(context, data.title, width - 180), 90, 218);
  context.font = '500 24px Arial, sans-serif';
  context.fillStyle = '#afc0d1';
  context.fillText(data.period, 90, 264);
}

function drawFooter(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = COLORS.navy;
  context.fillRect(0, height - 86, width, 86);
  context.fillStyle = '#c8d5e2';
  context.font = '600 20px Arial, sans-serif';
  context.fillText('Automatisch und deterministisch aus den vorhandenen Votingdaten erstellt.', 70, height - 36);
}

function triggerDownload(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function drawResultsGraphic(data: ReportGraphicData) {
  const width = 1600;
  const rowHeight = 76;
  const height = Math.max(1700, 500 + data.results.length * rowHeight + 170);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, width, height);
  drawHeader(context, data, 'ERGEBNISSE', width);

  const x = 70;
  const tableWidth = width - 140;
  const startY = 370;
  roundedRect(context, x, startY, tableWidth, 88 + data.results.length * rowHeight, 22);
  context.fillStyle = '#ffffff';
  context.fill();
  context.fillStyle = '#eef1f6';
  context.fillRect(x, startY, tableWidth, 72);
  context.fillStyle = COLORS.muted;
  context.font = '800 19px Arial, sans-serif';
  context.fillText('PLATZ', 95, startY + 45);
  context.fillText('SONG / KÜNSTLER', 220, startY + 45);
  context.fillText('JURY', 1160, startY + 45);
  context.fillText('PUBLIKUM', 1280, startY + 45);
  context.fillText('GESAMT', 1450, startY + 45);

  data.results.forEach((row, index) => {
    const rowY = startY + 72 + index * rowHeight;
    if (index < 3) {
      context.fillStyle = index === 0 ? '#fff3df' : '#fffaf1';
      context.fillRect(x, rowY, tableWidth, rowHeight);
    }
    context.strokeStyle = COLORS.line;
    context.beginPath();
    context.moveTo(x + 20, rowY + rowHeight);
    context.lineTo(x + tableWidth - 20, rowY + rowHeight);
    context.stroke();
    context.fillStyle = index < 3 ? COLORS.orange : COLORS.violet;
    context.font = '900 30px Arial, sans-serif';
    context.fillText(String(row.rank ?? '—'), 110, rowY + 48);
    context.fillStyle = COLORS.text;
    context.font = '800 25px Arial, sans-serif';
    context.fillText(fitText(context, row.title, 780), 220, rowY + 32);
    context.fillStyle = COLORS.muted;
    context.font = '500 19px Arial, sans-serif';
    context.fillText(fitText(context, row.artist, 780), 220, rowY + 59);
    context.fillStyle = COLORS.text;
    context.font = '800 25px Arial, sans-serif';
    context.fillText(String(row.juryPoints), 1180, rowY + 48);
    context.fillText(String(row.audiencePoints), 1325, rowY + 48);
    context.fillText(String(row.total), 1480, rowY + 48);
  });
  drawFooter(context, width, height);
  return canvas;
}

function drawStatisticsGraphic(data: ReportGraphicData) {
  const width = 1600;
  const highlights = data.highlights.slice(0, 10);
  const height = Math.max(2200, 1070 + Math.ceil(highlights.length / 2) * 245 + 150);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, width, height);
  drawHeader(context, data, 'STATISTIKEN', width);

  const metrics = [
    ['Songs', String(data.songsCount)],
    ['Gewertete Stimmen', String(data.countedVotes)],
    ['Jury', data.juryStatus],
    ['Abstand Platz 1–2', data.winnerGap === null ? '—' : `${data.winnerGap} Punkte`],
    ['Punkteanteil Top 3', data.top3Share === null ? '—' : `${data.top3Share.toFixed(1)} %`],
    ['Punkteanteil Top 5', data.top5Share === null ? '—' : `${data.top5Share.toFixed(1)} %`],
    ['Ø Polarisierung', data.averagePolarization === null ? '—' : `${data.averagePolarization.toFixed(1)} / 100`],
    ['Ohne Punkte', String(data.songsWithoutPoints)],
    ['Ohne Nennung', String(data.songsWithoutRatings)],
  ];
  const margin = 70;
  const gap = 22;
  const cardWidth = (width - margin * 2 - gap * 2) / 3;
  metrics.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + column * (cardWidth + gap);
    const y = 370 + row * 190;
    roundedRect(context, x, y, cardWidth, 166, 20);
    context.fillStyle = '#ffffff';
    context.fill();
    context.fillStyle = COLORS.violet;
    context.fillRect(x, y, 8, 166);
    context.fillStyle = COLORS.muted;
    context.font = '700 20px Arial, sans-serif';
    context.fillText(label, x + 34, y + 52);
    context.fillStyle = COLORS.text;
    context.font = '900 36px Arial, sans-serif';
    context.fillText(fitText(context, value, cardWidth - 68), x + 34, y + 112);
  });

  context.fillStyle = COLORS.text;
  context.font = '900 38px Arial, sans-serif';
  context.fillText('Besonderheiten dieser Woche', margin, 1020);
  highlights.forEach((highlight, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * ((width - margin * 2 + gap) / 2);
    const y = 1070 + row * 245;
    const cardW = (width - margin * 2 - gap) / 2;
    roundedRect(context, x, y, cardW, 220, 18);
    context.fillStyle = '#ffffff';
    context.fill();
    context.fillStyle = highlight.tone === 'danger' ? COLORS.red : highlight.tone === 'warning' ? COLORS.orange : highlight.tone === 'success' ? COLORS.green : COLORS.violet;
    context.fillRect(x, y, 8, 220);
    context.fillStyle = COLORS.muted;
    context.font = '800 18px Arial, sans-serif';
    context.fillText(highlight.title.toUpperCase(), x + 34, y + 43);
    context.fillStyle = COLORS.text;
    context.font = '900 28px Arial, sans-serif';
    context.fillText(fitText(context, highlight.value, cardW - 68), x + 34, y + 93);
    context.fillStyle = COLORS.muted;
    context.font = '500 19px Arial, sans-serif';
    context.fillText(fitText(context, highlight.detail, cardW - 68), x + 34, y + 143);
  });
  drawFooter(context, width, height);
  return canvas;
}

export default function ReportActions({ data, view, autoPrint = false }: { data: ReportGraphicData; view: ReportView; autoPrint?: boolean }) {
  const [working, setWorking] = useState<'results' | 'statistics' | null>(null);
  const base = `/admin/release-voting/${data.roundId}`;
  const exportBase = `/api/admin/statistics/export?scope=round&roundId=${encodeURIComponent(data.roundId)}`;

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  function graphic(kind: 'results' | 'statistics') {
    setWorking(kind);
    window.setTimeout(() => {
      const canvas = kind === 'results' ? drawResultsGraphic(data) : drawStatisticsGraphic(data);
      if (canvas) triggerDownload(canvas, `${safeFilename(data.title)}-${kind === 'results' ? 'ergebnisse' : 'statistiken'}.png`);
      setWorking(null);
    }, 20);
  }

  return <div className="ks-report-actions no-print" aria-label="Druck und Export">
    {view === 'results'
      ? <button className="ks-button secondary" type="button" onClick={() => window.print()}>Ergebnisse drucken / PDF</button>
      : <a className="ks-button secondary" href={`${base}/results?print=1`} target="_blank" rel="noreferrer">Ergebnisse drucken / PDF</a>}
    {view === 'statistics'
      ? <button className="ks-button secondary" type="button" onClick={() => window.print()}>Statistiken drucken / PDF</button>
      : <a className="ks-button secondary" href={`${base}/statistics?print=1`} target="_blank" rel="noreferrer">Statistiken drucken / PDF</a>}
    <button className="ks-button secondary" type="button" disabled={working !== null} onClick={() => graphic('results')}>{working === 'results' ? 'Erstelle …' : 'Ergebnisgrafik PNG'}</button>
    <button className="ks-button secondary" type="button" disabled={working !== null} onClick={() => graphic('statistics')}>{working === 'statistics' ? 'Erstelle …' : 'Statistikgrafik PNG'}</button>
    <PopoverMenu label="Daten exportieren" trigger="Daten exportieren ▾" triggerClassName="ks-button primary" panelClassName="ks-export-menu">
      {(close) => <>
        <strong>Aktuelle Umfrage</strong>
        <a href={`${exportBase}&format=csv`} onClick={close}>CSV herunterladen</a>
        <a href={`${exportBase}&format=xlsx`} onClick={close}>XLSX herunterladen</a>
        <strong>Alle Umfragen</strong>
        <a href="/api/admin/statistics/export?scope=all&format=csv" onClick={close}>Gesamtauswertung CSV</a>
        <a href="/api/admin/statistics/export?scope=all&format=xlsx" onClick={close}>Gesamtauswertung XLSX</a>
      </>}
    </PopoverMenu>
  </div>;
}

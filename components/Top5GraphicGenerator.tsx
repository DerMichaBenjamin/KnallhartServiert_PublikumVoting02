'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeaderboardRow, Round, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { JURY_PLACES_COUNT } from '@/lib/releaseVotingShared';

const TEMPLATE_SRC = '/release-check-top5-template.png';
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

type Props = {
  round: Round;
  songs: Song[];
  publicLeaderboard: LeaderboardRow[];
  publicVerifiedVotes: number;
  juryData: AdminJuryRoundData;
};

type GraphicRow = {
  rank: number;
  title: string;
  artist: string;
  total: number;
  audiencePoints: number;
};

function compareSongs(a: Song, b: Song) {
  return a.title.localeCompare(b.title, 'de', { sensitivity: 'base' })
    || a.artist.localeCompare(b.artist, 'de', { sensitivity: 'base' });
}

function formatRoundDate(round: Round) {
  const raw = round.starts_at || round.created_at;
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(date);
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fitSingleLineFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxFontSize: number, minFontSize: number, fontFamily: string, fontWeight = 900) {
  for (let size = maxFontSize; size >= minFontSize; size -= 1) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return minFontSize;
}

function fitWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  maxFontSize: number,
  minFontSize: number,
  fontFamily: string,
  fontWeight = 900,
) {
  const words = text.split(/\s+/).filter(Boolean);

  for (let size = maxFontSize; size >= minFontSize; size -= 1) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (!current || ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    if (lines.length <= maxLines) return { fontSize: size, lines };
  }

  return { fontSize: minFontSize, lines: [text] };
}

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize: number,
  fontFamily: string,
  fontWeight = 900,
) {
  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = Math.max(2, fontSize * 0.08);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.max(8, fontSize * 0.2);
  ctx.textBaseline = 'alphabetic';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

export default function Top5GraphicGenerator({ round, songs, publicLeaderboard, publicVerifiedVotes, juryData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateImageRef = useRef<HTMLImageElement | null>(null);
  const [templateReady, setTemplateReady] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const activeJurors = useMemo(() => juryData.jurors.filter((juror) => juror.is_active), [juryData.jurors]);
  const submittedJurors = useMemo(() => activeJurors.filter((juror) => Boolean(juror.submitted_at)), [activeJurors]);

  const audiencePoints = useMemo(() => {
    const map = new Map<string, number>();
    if (publicVerifiedVotes <= 0) return map;

    const sorted = [...publicLeaderboard].sort((a, b) =>
      b.total - a.total
      || compareSongs(a.song, b.song)
    );

    sorted.slice(0, JURY_PLACES_COUNT).forEach((row, index) => {
      map.set(row.song.id, JURY_PLACES_COUNT - index);
    });

    return map;
  }, [publicLeaderboard, publicVerifiedVotes]);

  const graphicRows = useMemo<GraphicRow[]>(() => {
    const hasVotes = audiencePoints.size > 0 || submittedJurors.length > 0;
    if (!hasVotes) return [];

    const rows = songs.map((song) => {
      let total = audiencePoints.get(song.id) || 0;

      for (const juror of activeJurors) {
        if (!juror.submitted_at) continue;
        const item = juror.items.find((entry) => entry.song_id === song.id);
        const points = Number(item?.points || 0);
        if (Number.isFinite(points) && points > 0) total += points;
      }

      return {
        song,
        total,
        audiencePoints: audiencePoints.get(song.id) || 0,
      };
    });

    rows.sort((a, b) => b.total - a.total || compareSongs(a.song, b.song));

    let previousTotal: number | null = null;
    let previousRank = 0;

    const ranked = rows.map((row, index) => {
      const rank = previousTotal === row.total ? previousRank : index + 1;
      previousTotal = row.total;
      previousRank = rank;
      return {
        rank,
        title: row.song.title,
        artist: row.song.artist,
        total: row.total,
        audiencePoints: row.audiencePoints,
      };
    });

    return ranked.filter((row) => row.rank <= 5 && row.total > 0);
  }, [songs, audiencePoints, activeJurors, submittedJurors.length]);

  const dateLabel = useMemo(() => formatRoundDate(round), [round]);
  const countedSources = submittedJurors.length + (publicVerifiedVotes > 0 ? 1 : 0);
  const fileName = useMemo(() => {
    const base = safeFileName(round.slug || round.title || 'release-check');
    return `knallhart-serviert-top5-${base || 'release-check'}.png`;
  }, [round.slug, round.title]);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      templateImageRef.current = image;
      setTemplateReady(true);
    };
    image.onerror = () => setTemplateReady(false);
    image.src = TEMPLATE_SRC;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const templateImage = templateImageRef.current;
    if (!canvas || !templateReady || !templateImage) return;

    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    ctx.drawImage(templateImage, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    if (!graphicRows.length) {
      setPreviewUrl(canvas.toDataURL('image/png'));
      return;
    }

    const rowsCount = graphicRows.length;
    const groupTop = 875;
    const groupBottom = 1845;
    const gap = rowsCount <= 5 ? 24 : rowsCount <= 6 ? 18 : 14;
    const rowHeight = (groupBottom - groupTop - gap * (rowsCount - 1)) / rowsCount;
    const circleSize = Math.min(150, rowHeight - 4);
    const circleX = 86;
    const barX = 208;
    const barWidth = 784;

    graphicRows.forEach((row, index) => {
      const y = groupTop + index * (rowHeight + gap);
      const circleY = y + (rowHeight - circleSize) / 2;
      const barY = y + (rowHeight - (rowHeight - 4)) / 2;
      const barHeight = rowHeight - 4;

      ctx.save();
      ctx.shadowColor = 'rgba(255, 213, 0, 0.55)';
      ctx.shadowBlur = 24;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffcf0d';
      ctx.fillStyle = 'rgba(5, 5, 5, 0.96)';
      drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 22);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const circleGradient = ctx.createRadialGradient(circleX + circleSize * 0.35, circleY + circleSize * 0.28, circleSize * 0.12, circleX + circleSize / 2, circleY + circleSize / 2, circleSize / 2);
      circleGradient.addColorStop(0, '#ffe680');
      circleGradient.addColorStop(0.55, '#ffd31a');
      circleGradient.addColorStop(1, '#ecb700');

      ctx.save();
      ctx.shadowColor = 'rgba(255, 213, 0, 0.45)';
      ctx.shadowBlur = 24;
      ctx.fillStyle = circleGradient;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(circleX + circleSize / 2, circleY + circleSize / 2, circleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const platzFont = Math.max(18, Math.min(24, rowHeight * 0.18));
      const rankFont = Math.max(46, Math.min(84, rowHeight * 0.6));

      ctx.save();
      ctx.textAlign = 'center';
      drawTextLine(ctx, 'PLATZ', circleX + circleSize / 2, circleY + circleSize * 0.36, '#111111', platzFont, 'Arial Black, Arial, sans-serif');
      drawTextLine(ctx, String(row.rank), circleX + circleSize / 2, circleY + circleSize * 0.82, '#111111', rankFont, 'Arial Black, Arial, sans-serif');
      ctx.restore();

      const textX = barX + 28;
      const titleMaxWidth = barWidth - 52;
      const titleText = row.title.toUpperCase();
      const artistText = row.artist.toUpperCase();
      const titleFont = fitSingleLineFont(ctx, titleText, titleMaxWidth, Math.max(30, Math.min(64, rowHeight * 0.34)), 24, 'Arial Black, Arial, sans-serif');
      const artistWrap = fitWrappedText(ctx, artistText, titleMaxWidth, 2, Math.max(20, Math.min(40, rowHeight * 0.22)), 16, 'Arial Black, Arial, sans-serif');

      const titleBaseline = barY + rowHeight * (artistWrap.lines.length > 1 ? 0.44 : 0.42);
      drawTextLine(ctx, titleText, textX, titleBaseline, '#f0f0f0', titleFont, 'Arial Black, Arial, sans-serif');

      const artistLineHeight = artistWrap.fontSize * 1.1;
      const artistStartY = barY + rowHeight * 0.72 - (artistWrap.lines.length - 1) * (artistLineHeight / 2);
      artistWrap.lines.forEach((line, artistIndex) => {
        drawTextLine(ctx, line, textX, artistStartY + artistIndex * artistLineHeight, '#ffd117', artistWrap.fontSize, 'Arial Black, Arial, sans-serif');
      });
    });

    setPreviewUrl(canvas.toDataURL('image/png'));
  }, [templateReady, graphicRows]);

  function downloadGraphic() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setDownloadBusy(true);
    canvas.toBlob((blob) => {
      try {
        if (!blob) {
          const fallbackUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = fallbackUrl;
          link.download = fileName;
          link.click();
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      } finally {
        setDownloadBusy(false);
      }
    }, 'image/png');
  }

  return (
    <section className="admin-card top5-graphic-card">
      <div className="top5-graphic-header">
        <div>
          <h2>Top-5-Grafik</h2>
          <p className="admin-help-text">
            Die Grafik wird automatisch aus der <b>Gesamtwertung Jury + Publikum</b> erzeugt. Bei Gleichstand werden alle Songs bis einschließlich Platz 5 mit aufgenommen.
          </p>
        </div>
        <div className="top5-graphic-badges">
          <span className="status-badge">Stand: {dateLabel}</span>
          <span className="status-badge">Quellen: {countedSources}</span>
          <span className="status-badge">Einträge: {graphicRows.length}</span>
        </div>
      </div>

      <div className="top5-graphic-layout">
        <div className="top5-graphic-preview-wrap">
          <canvas ref={canvasRef} className="top5-graphic-canvas" />
          {!templateReady && <div className="notice">Vorlage wird geladen…</div>}
        </div>

        <div className="top5-graphic-sidepanel">
          {graphicRows.length ? (
            <>
              <div className="top5-graphic-actions">
                <button type="button" onClick={downloadGraphic} disabled={downloadBusy || !templateReady}>
                  {downloadBusy ? 'Erstelle PNG…' : 'PNG herunterladen'}
                </button>
                {previewUrl && (
                  <a href={previewUrl} download={fileName}>
                    Direktlink zur Vorschau
                  </a>
                )}
              </div>

              <div className="top5-graphic-meta">
                <p><b>Dateiname:</b> {fileName}</p>
                <p><b>Format:</b> 1080 × 1920 Pixel (Instagram-Reel)</p>
              </div>

              <div className="top5-graphic-ranking-list">
                <h3>Inhalt der Grafik</h3>
                <ol>
                  {graphicRows.map((row) => (
                    <li key={`${row.rank}-${row.title}-${row.artist}`}>
                      <b>Platz {row.rank}</b><br />
                      {row.title} — {row.artist}<br />
                      <small>{row.total} Gesamtpunkte · Publikum: {row.audiencePoints}</small>
                    </li>
                  ))}
                </ol>
              </div>

              {round.status !== 'ended' && (
                <div className="notice">
                  Die Grafik kann schon jetzt erzeugt werden. Endgültig sinnvoll ist sie, sobald Publikum und Jury vollständig abgeschlossen sind.
                </div>
              )}
            </>
          ) : (
            <div className="notice">
              Es liegt noch keine ausreichende Gesamtwertung vor. Die Grafik wird automatisch verfügbar, sobald mindestens eine gewertete Publikums- oder Jury-Stimme vorhanden ist.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

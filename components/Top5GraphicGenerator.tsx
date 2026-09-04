'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { LeaderboardRow, Round, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { buildCombinedResults } from '@/lib/combinedVotingResults';

const FIXED_TEMPLATE_SRC = '/release-check-top5-template-clean.png';
const VARIABLE_TEMPLATE_SRC = '/release-check-top5-template-variable.png';
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

type Props = {
  round: Round;
  songs: Song[];
  publicLeaderboard: LeaderboardRow[];
  publicVerifiedVotes: number;
  juryData: AdminJuryRoundData;
  variant?: 'full' | 'compact';
};

type GraphicRow = {
  rank: number;
  title: string;
  artist: string;
  total: number;
  audiencePoints: number;
};

type WrappedTextResult = {
  fontSize: number;
  lines: string[];
  lineHeight: number;
};

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

function formatShortRoundDate(round: Round) {
  const raw = round.starts_at || round.created_at;
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-DE', {
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

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length === maxLines - 1) break;
  }

  if (current) {
    const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    const remainingWords = words.slice(consumedWords);
    const finalLine = remainingWords.length ? remainingWords.join(' ') : current;

    if (lines.length < maxLines) {
      if (ctx.measureText(finalLine).width <= maxWidth) lines.push(finalLine);
      else {
        let trimmed = finalLine;
        while (trimmed.length > 2 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
          trimmed = trimmed.slice(0, -1).trim();
        }
        lines.push(`${trimmed}…`);
      }
    }
  }

  return lines.slice(0, maxLines);
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
): WrappedTextResult {
  for (let size = maxFontSize; size >= minFontSize; size -= 1) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    const lines = wrapTextLines(ctx, text, maxWidth, maxLines);
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (lines.length <= maxLines && widest <= maxWidth) {
      return {
        fontSize: size,
        lines,
        lineHeight: size * 1.02,
      };
    }
  }

  return {
    fontSize: minFontSize,
    lines: [text],
    lineHeight: minFontSize * 1.02,
  };
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
  textBaseline: CanvasTextBaseline = 'alphabetic',
) {
  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
  ctx.lineWidth = Math.max(2, fontSize * 0.08);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
  ctx.shadowBlur = Math.max(8, fontSize * 0.2);
  ctx.textBaseline = textBaseline;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

export default function Top5GraphicGenerator({ round, songs, publicLeaderboard, publicVerifiedVotes, juryData, variant = 'full' }: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateImageRef = useRef<HTMLImageElement | null>(null);
  const previewObjectUrlRef = useRef('');
  const savedTemplateLoadedRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [templateReady, setTemplateReady] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [customTemplateSource, setCustomTemplateSource] = useState('');
  const [pendingTemplateDataUrl, setPendingTemplateDataUrl] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [templateChanged, setTemplateChanged] = useState(false);

  const combinedResults = useMemo(
    () => buildCombinedResults(songs, publicLeaderboard, publicVerifiedVotes, juryData),
    [songs, publicLeaderboard, publicVerifiedVotes, juryData]
  );
  const { submittedJurors, overallRows } = combinedResults;

  const graphicRows = useMemo<GraphicRow[]>(() => {
    return overallRows
      .filter((row) => row.rank !== null && row.rank <= 5 && row.total > 0)
      .map((row) => ({
        rank: row.rank as number,
        title: row.song.title,
        artist: row.song.artist,
        total: row.total,
        audiencePoints: row.audiencePoints,
      }));
  }, [overallRows]);

  const dateLabel = useMemo(() => formatRoundDate(round), [round]);
  const shortDateLabel = useMemo(() => formatShortRoundDate(round), [round]);
  const countedSources = submittedJurors.length + (publicVerifiedVotes > 0 ? 1 : 0);
  const fileName = useMemo(() => {
    const base = safeFileName(round.slug || round.title || 'release-check');
    return `knallhart-serviert-top5-${base || 'release-check'}.png`;
  }, [round.slug, round.title]);

  const votingIncomplete = useMemo(() => {
    const now = Date.now();
    const publicStillOpen = round.status !== 'ended' && (!round.ends_at || Date.parse(round.ends_at) > now);
    const juryDeadline = round.jury_voting_ends_at || round.ends_at || null;
    const juryStillOpen = !round.jury_voting_closed && (!juryDeadline || Date.parse(juryDeadline) > now);
    return publicStillOpen || juryStillOpen;
  }, [round]);

  const socialMediaText = useMemo(() => {
    if (!graphicRows.length) return '';

    const lines = [
      `Knallhart Release-Check der Woche mit den neuen Songs vom Freitag, dem ${shortDateLabel}.`,
      '',
      'Unsere Top 5 der Woche sind:',
      '',
      ...graphicRows.map((row) => `${row.rank}. ${row.title} — ${row.artist}`),
      '',
      '#knallhartserviert #top5 #releasecheck #neuemusik #partyschlager',
    ];

    return lines.join('\n');
  }, [graphicRows, shortDateLabel]);

  const requiresDynamicRows = graphicRows.length !== 5
    || graphicRows.some((row, index) => row.rank !== index + 1);
  const templateSource = requiresDynamicRows
    ? VARIABLE_TEMPLATE_SRC
    : customTemplateSource || FIXED_TEMPLATE_SRC;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || shouldRender) return;
    if (!('IntersectionObserver' in window)) {
      setShouldRender(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setShouldRender(true);
      observer.disconnect();
    }, { rootMargin: '600px 0px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender || savedTemplateLoadedRef.current || requiresDynamicRows) return;
    savedTemplateLoadedRef.current = true;
    void fetch('/api/admin/settings?key=top5-template')
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok && typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image/')) {
          setCustomTemplateSource(data.dataUrl);
        }
      })
      .catch(() => undefined);
  }, [requiresDynamicRows, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    setTemplateReady(false);
    const image = new window.Image();
    image.onload = () => {
      templateImageRef.current = image;
      setTemplateReady(true);
    };
    image.onerror = () => {
      setTemplateReady(false);
      setNotice({ type: 'error', text: 'Die Hintergrundgrafik konnte nicht geladen werden.' });
    };
    image.src = templateSource;
  }, [shouldRender, templateSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const templateImage = templateImageRef.current;
    if (!shouldRender || !canvas || !templateReady || !templateImage) return;

    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    ctx.drawImage(templateImage, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    const updatePreview = () => canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
      const nextUrl = URL.createObjectURL(blob);
      previewObjectUrlRef.current = nextUrl;
      setPreviewUrl(nextUrl);
    }, 'image/png');

    if (!graphicRows.length) return updatePreview();

    const rowsCount = graphicRows.length;
    const groupTop = 875;
    const groupBottom = 1845;
    const gap = requiresDynamicRows
      ? rowsCount <= 5 ? 24 : rowsCount <= 8 ? 14 : rowsCount <= 12 ? 8 : 4
      : 24;
    const rowHeight = (groupBottom - groupTop - gap * (rowsCount - 1)) / rowsCount;
    const circleSize = Math.max(18, Math.min(150, rowHeight - 4));
    const circleX = 84;
    const barX = 183;
    const barWidth = 810;

    graphicRows.forEach((row, index) => {
      const y = groupTop + index * (rowHeight + gap);
      const circleY = y + (rowHeight - circleSize) / 2;
      const barY = y + 2;
      const barHeight = rowHeight - 4;

      if (requiresDynamicRows) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 213, 0, 0.55)';
        ctx.shadowBlur = Math.min(24, rowHeight * 0.14);
        ctx.lineWidth = Math.max(2, Math.min(4, rowHeight * 0.04));
        ctx.strokeStyle = '#ffcf0d';
        ctx.fillStyle = 'rgba(5, 5, 5, 0.96)';
        drawRoundedRect(ctx, barX, barY, barWidth, barHeight, Math.min(22, rowHeight * 0.16));
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const circleGradient = ctx.createRadialGradient(circleX + circleSize * 0.35, circleY + circleSize * 0.28, circleSize * 0.12, circleX + circleSize / 2, circleY + circleSize / 2, circleSize / 2);
        circleGradient.addColorStop(0, '#ffe680');
        circleGradient.addColorStop(0.55, '#ffd31a');
        circleGradient.addColorStop(1, '#ecb700');

        ctx.save();
        ctx.shadowColor = 'rgba(255, 213, 0, 0.45)';
        ctx.shadowBlur = Math.min(24, rowHeight * 0.14);
        ctx.fillStyle = circleGradient;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(1, Math.min(3, rowHeight * 0.025));
        ctx.beginPath();
        ctx.arc(circleX + circleSize / 2, circleY + circleSize / 2, circleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const platzFont = Math.max(7, Math.min(24, rowHeight * 0.18));
        const rankFont = Math.max(11, Math.min(84, rowHeight * 0.52));
        ctx.save();
        ctx.textAlign = 'center';
        drawTextLine(ctx, 'PLATZ', circleX + circleSize / 2, circleY + circleSize * 0.36, '#111111', platzFont, 'Arial Black, Arial, sans-serif');
        drawTextLine(ctx, String(row.rank), circleX + circleSize / 2, circleY + circleSize * 0.82, '#111111', rankFont, 'Arial Black, Arial, sans-serif');
        ctx.restore();
      }

      const textX = barX + barWidth / 2;
      const textMaxWidth = barWidth - 156;
      const titleText = row.title.toUpperCase();
      const artistText = row.artist.toUpperCase();

      const maxLines = rowHeight < 82 ? 1 : 2;
      const titleMin = Math.max(8, Math.min(18, rowHeight * 0.22));
      const artistMin = Math.max(7, Math.min(14, rowHeight * 0.17));
      let titleWrap = fitWrappedText(ctx, titleText, textMaxWidth, maxLines, Math.max(titleMin, Math.min(56, rowHeight * 0.29)), titleMin, 'Arial Black, Arial, sans-serif');
      let artistWrap = fitWrappedText(ctx, artistText, textMaxWidth, maxLines, Math.max(artistMin, Math.min(33, rowHeight * 0.19)), artistMin, 'Arial Black, Arial, sans-serif');

      const availableTextHeight = rowHeight * 0.76;
      const textGap = Math.max(2, Math.min(8, rowHeight * 0.04));
      let totalTextHeight = titleWrap.lines.length * titleWrap.lineHeight + artistWrap.lines.length * artistWrap.lineHeight + textGap;
      while (totalTextHeight > availableTextHeight && (titleWrap.fontSize > titleMin || artistWrap.fontSize > artistMin)) {
        titleWrap = fitWrappedText(ctx, titleText, textMaxWidth, maxLines, titleWrap.fontSize - 1, titleMin, 'Arial Black, Arial, sans-serif');
        artistWrap = fitWrappedText(ctx, artistText, textMaxWidth, maxLines, artistWrap.fontSize - 1, artistMin, 'Arial Black, Arial, sans-serif');
        totalTextHeight = titleWrap.lines.length * titleWrap.lineHeight + artistWrap.lines.length * artistWrap.lineHeight + textGap;
      }

      const textBlockTop = barY + (barHeight - totalTextHeight) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      titleWrap.lines.forEach((line, titleIndex) => {
        drawTextLine(ctx, line, textX, textBlockTop + titleWrap.lineHeight * (titleIndex + 0.5), '#f0f0f0', titleWrap.fontSize, 'Arial Black, Arial, sans-serif', 900, 'middle');
      });

      const artistStartY = textBlockTop + titleWrap.lines.length * titleWrap.lineHeight + textGap;
      artistWrap.lines.forEach((line, artistIndex) => {
        drawTextLine(ctx, line, textX, artistStartY + artistWrap.lineHeight * (artistIndex + 0.5), '#ffffff', artistWrap.fontSize, 'Arial Black, Arial, sans-serif', 900, 'middle');
      });
      ctx.restore();
    });

    updatePreview();
  }, [graphicRows, requiresDynamicRows, shouldRender, templateReady, templateSource]);

  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
  }, []);

  async function saveTemplate(dataUrl: string) {
    setUploadBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top5GraphicTemplateDataUrl: dataUrl, top5GraphicTemplateVersion: dataUrl ? 'clean-v2' : '' }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Die Hintergrundgrafik konnte nicht gespeichert werden.');
      }

      setPendingTemplateDataUrl(dataUrl);
      setTemplateChanged(false);
      setNotice({ type: 'ok', text: 'Die neue Hintergrundgrafik wurde gespeichert.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unbekannter Fehler.' });
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleTemplateFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCustomTemplateSource(dataUrl);
      setPendingTemplateDataUrl(dataUrl);
      setTemplateChanged(true);
      setNotice({ type: 'ok', text: 'Neue Hintergrundgrafik geladen. Speichere sie, wenn sie künftig dauerhaft verwendet werden soll.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Die Datei konnte nicht verarbeitet werden.' });
    } finally {
      event.target.value = '';
    }
  }

  async function resetTemplateToDefault() {
    const ok = window.confirm('Die gespeicherte Hintergrundgrafik wirklich zurücksetzen und wieder die Standardvorlage verwenden?');
    if (!ok) return;

    setCustomTemplateSource('');
    setPendingTemplateDataUrl('');
    setTemplateChanged(true);
    await saveTemplate('');
  }

  async function copySocialMediaText() {
    if (!socialMediaText) return;
    await navigator.clipboard?.writeText(socialMediaText);
    setNotice({ type: 'ok', text: 'Social-Media-Text kopiert.' });
  }

  function downloadGraphic() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (votingIncomplete) {
      const ok = window.confirm('Achtung: Das Voting ist noch nicht abgeschlossen. Die Grafik basiert auf einem Zwischenstand. Wirklich jetzt als PNG erstellen?');
      if (!ok) return;
    }

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
    <section ref={sectionRef} id="top5" className={`admin-card top5-graphic-card ${variant === 'compact' ? 'top5-compact' : ''}`}>
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

      {notice && <div className={`notice ${notice.type === 'ok' ? 'success' : 'error'}`}>{notice.text}</div>}
      {votingIncomplete && (
        <div className="notice top5-warning-notice">
          Achtung: Das Voting ist noch nicht abgeschlossen. Die Vorschau und der PNG-Export zeigen deshalb nur einen Zwischenstand.
        </div>
      )}

      {variant === 'full' && <div className="top5-graphic-template-card">
        <div>
          <h3>Hintergrundgrafik</h3>
          <p className="admin-help-text">Du kannst eine saubere Vorlage mit festen Rahmen und Platzmarkierungen hochladen. Alte, noch gespeicherte Vorlagen ohne die neue Versionskennung überschreiben die bereinigte Standarddatei nicht mehr.</p>
        </div>
        <div className="top5-template-actions">
          <label className="top5-template-upload">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleTemplateFileChange} />
            Neue Hintergrundgrafik laden
          </label>
          {templateChanged && (
            <button type="button" disabled={uploadBusy || !pendingTemplateDataUrl} onClick={() => saveTemplate(pendingTemplateDataUrl)}>
              {uploadBusy ? 'Speichere…' : 'Neue Vorlage speichern'}
            </button>
          )}
          <button type="button" disabled={uploadBusy} onClick={resetTemplateToDefault}>Auf Standard zurücksetzen</button>
        </div>
      </div>}

      <div className="top5-graphic-layout">
        <div className="top5-graphic-preview-wrap">
          <canvas ref={canvasRef} className="top5-graphic-canvas" width={OUTPUT_WIDTH} height={OUTPUT_HEIGHT} />
          {!templateReady && <div className="notice">{shouldRender ? 'Vorlage wird geladen…' : 'Vorschau wird vorbereitet…'}</div>}
        </div>

        <div className="top5-graphic-sidepanel">
          {graphicRows.length ? (
            <>
              <div className="top5-graphic-actions">
                <button type="button" onClick={downloadGraphic} disabled={downloadBusy || !templateReady}>
                  {downloadBusy ? 'Erstelle PNG…' : 'PNG herunterladen'}
                </button>
                {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer">Vorschau ansehen</a>}
              </div>

              {variant === 'full' && <div className="top5-graphic-meta">
                <p><b>Dateiname:</b> {fileName}</p>
                <p><b>Format:</b> 1080 × 1920 Pixel (Instagram-Reel)</p>
              </div>}

              {variant === 'full' && <div className="top5-graphic-ranking-list">
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
              </div>}

              <div className="top5-graphic-copy-card">
                <div className="top5-copy-header">
                  <h3>Social-Media-Text</h3>
                  <button type="button" onClick={copySocialMediaText}>Text kopieren</button>
                </div>
                <textarea value={socialMediaText} readOnly rows={12} />
              </div>
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

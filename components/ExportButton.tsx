'use client';
import { toPng } from 'html-to-image';

export default function ExportButton({ date, targetId = 'story-canvas-export' }: { date: string; targetId?: string }) {
  async function download() {
    const node = document.getElementById(targetId);
    if (!node) return alert(`PNG-Export fehlgeschlagen: Die Grafik mit der ID „${targetId}“ wurde nicht gefunden.`);
    try {
      const dataUrl = await toPng(node, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: {
          width: '1080px',
          height: '1920px',
          transform: 'none',
          transformOrigin: 'top left'
        }
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `knallhart_serviert_live_auftritte_mallorca_${date}.png`;
      a.click();
    } catch (err) {
      console.error(err);
      alert('PNG-Export fehlgeschlagen. Bitte prüfe, ob alle Bilder geladen sind und versuche es erneut. Details stehen in der Browser-Konsole.');
    }
  }
  return <button className="btn" onClick={download}>Als 9:16 PNG herunterladen</button>;
}

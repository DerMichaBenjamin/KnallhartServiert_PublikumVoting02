'use client';

import type { Round } from '@/lib/releaseVotingShared';

export default function RoundLinksBar({ round, copyUrl }: { round: Round; copyUrl: (path: string, message: string) => void }) {
  return <section className="ks-round-links" aria-labelledby="round-links-title">
    <h2 id="round-links-title">Öffentliche und interne Links</h2>
    <div className="ks-round-link-items">
      <div><strong>Publikum</strong><a href={`/release-voting/${round.slug}`} target="_blank" rel="noreferrer" aria-label="Publikumsseite öffnen">↗ <span>öffnen</span></a><button type="button" onClick={() => copyUrl(`/release-voting/${round.slug}`, 'Publikums-Link kopiert.')} aria-label="Publikums-Link kopieren">⧉ <span>kopieren</span></button></div>
      {round.is_public_results && <div><strong>Ergebnis</strong><a href={`/ergebnisse/${round.slug}`} target="_blank" rel="noreferrer" aria-label="Öffentliches Ergebnis öffnen">↗ <span>öffnen</span></a><button type="button" onClick={() => copyUrl(`/ergebnisse/${round.slug}`, 'Ergebnis-Link kopiert.')} aria-label="Ergebnis-Link kopieren">⧉ <span>kopieren</span></button></div>}
      <div><strong>Backend</strong><button type="button" onClick={() => copyUrl(`/admin/release-voting/${round.id}`, 'Backend-Direktlink kopiert.')} aria-label="Backend-Link kopieren">⧉ <span>kopieren</span></button></div>
    </div>
  </section>;
}

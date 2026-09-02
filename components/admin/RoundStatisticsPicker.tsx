'use client';

import { useRouter } from 'next/navigation';

export default function RoundStatisticsPicker({ rounds }: { rounds: Array<{ id: string; title: string; date: string }> }) {
  const router = useRouter();
  return <label className="ks-round-statistics-picker">
    <span>Einzelne Umfrage öffnen</span>
    <select defaultValue="" onChange={(event) => { if (event.target.value) router.push(`/admin/release-voting/${event.target.value}/statistics`); }}>
      <option value="" disabled>Umfrage auswählen …</option>
      {rounds.map((round) => <option key={round.id} value={round.id}>{round.title} · {new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(round.date))}</option>)}
    </select>
  </label>;
}

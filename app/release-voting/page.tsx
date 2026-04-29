import { redirect } from 'next/navigation';import { getCurrentRound } from '@/lib/releaseVoting';
export default async function Page(){ const round=await getCurrentRound(); if(round) redirect(`/release-voting/${round.slug}`); return <main className="public-shell"><h1>Keine aktive Abstimmung</h1><a href="/ergebnisse">Zu den Ergebnissen</a></main>}

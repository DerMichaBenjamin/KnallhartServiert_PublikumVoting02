import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import PublicVotesManager from '@/components/admin/PublicVotesManager';

export const dynamic = 'force-dynamic';

const filters = new Set(['all', 'counted', 'review', 'excluded', 'unverified']);

export default async function AdminVotesPage({ params, searchParams }: { params: Promise<{ roundId: string }>; searchParams: Promise<{ filter?: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [{ roundId }, query] = await Promise.all([params, searchParams]);
  const data = await getAdminRoundDetailData(roundId, { includeParticipants: true });
  if (!data) notFound();
  const initialFilter = filters.has(String(query.filter || '')) ? String(query.filter) : 'all';
  return <PublicVotesManager round={data.round} summary={data.summary} initialFilter={initialFilter as 'all' | 'counted' | 'review' | 'excluded' | 'unverified'} />;
}

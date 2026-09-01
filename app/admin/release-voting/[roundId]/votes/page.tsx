import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import PublicVotesManager from '@/components/admin/PublicVotesManager';

export const dynamic = 'force-dynamic';

export default async function AdminVotesPage({ params }: { params: Promise<{ roundId: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const { roundId } = await params; const data = await getAdminRoundDetailData(roundId); if (!data) notFound();
  return <PublicVotesManager round={data.round} summary={data.summary} />;
}

import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminRoundDetail from '@/components/AdminRoundDetail';
import { getAdminRoundDetailData, getCurrentDjRoundId } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PageProps = {
  params: Promise<{ roundId: string }>;
};

export default async function AdminRoundPage({ params }: PageProps) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const { roundId } = await params;
  const [data, currentDjRoundId, juryData] = await Promise.all([
    getAdminRoundDetailData(roundId, { includeInactiveSongs: true }),
    getCurrentDjRoundId(),
    getAdminJuryRoundData(roundId),
  ]);

  if (!data) notFound();

  return <AdminRoundDetail
    round={data.round}
    songs={data.songs}
    summary={data.summary}
    isCurrentDj={currentDjRoundId === data.round.id}
    juryData={juryData}
    securityAlerts={null}
  />;
}

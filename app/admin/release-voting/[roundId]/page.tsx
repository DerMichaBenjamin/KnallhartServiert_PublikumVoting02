import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminRoundDetail from '@/components/AdminRoundDetail';
import { getAdminRoundDetailData, getCurrentDjRoundId } from '@/lib/releaseVoting';
import { getVotingSecurityReport } from '@/lib/votingSecurity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PageProps = {
  params: Promise<{ roundId: string }>;
};

export default async function AdminRoundPage({ params }: PageProps) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const { roundId } = await params;
  const data = await getAdminRoundDetailData(roundId);
  const currentDjRoundId = await getCurrentDjRoundId();

  if (!data) notFound();

  const securityReport = await getVotingSecurityReport(roundId);
  const highAlerts = securityReport.activeAlerts.filter((alert) => alert.level === 'high').length;

  return (
    <>
      {securityReport.activeAlerts.length > 0 && (
        <div style={{ maxWidth: 1180, margin: '18px auto -4px', padding: '0 18px' }}>
          <div className={`notice ${highAlerts > 0 ? 'error' : ''}`}>
            <b>
              {highAlerts > 0 ? 'Auffälliges Voting-Muster gefunden.' : 'Voting-Hinweis:'}
            </b>{' '}
            {securityReport.activeAlerts.length} Auffälligkeit
            {securityReport.activeAlerts.length === 1 ? '' : 'en'} sollte
            {securityReport.activeAlerts.length === 1 ? '' : 'n'} geprüft werden.{' '}
            <a href={`/admin/release-voting/${roundId}/security`}>Sicherheitsprüfung öffnen</a>
          </div>
        </div>
      )}

      <AdminRoundDetail
        round={data.round}
        songs={data.songs}
        summary={data.summary}
        isCurrentDj={currentDjRoundId === data.round.id}
      />
    </>
  );
}

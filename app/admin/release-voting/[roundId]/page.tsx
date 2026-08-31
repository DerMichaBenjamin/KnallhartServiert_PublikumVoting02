import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminRoundDetail from '@/components/AdminRoundDetail';
import {
  getAdminRoundDetailData,
  getCurrentDjRoundId,
} from '@/lib/releaseVoting';
import { getVotingSecurityReport } from '@/lib/votingSecurity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PageProps = {
  params: Promise<{ roundId: string }>;
};

export default async function AdminRoundPage({
  params,
}: PageProps) {
  if (!(await isAdminLoggedIn())) {
    redirect('/admin/login');
  }

  const { roundId } = await params;

  const data =
    await getAdminRoundDetailData(roundId);

  const currentDjRoundId =
    await getCurrentDjRoundId();

  if (!data) {
    notFound();
  }

  const securityReport =
    await getVotingSecurityReport(roundId);

  const activeAlerts =
    securityReport.activeAlerts;

  const highAlerts =
    activeAlerts.filter(
      (alert) => alert.level === 'high'
    ).length;

  const alertCount =
    activeAlerts.length;

  const securityClass =
    highAlerts > 0
      ? 'notice error'
      : alertCount > 0
        ? 'notice'
        : 'notice success';

  return (
    <>
      <div
        style={{
          maxWidth: 1180,
          margin: '18px auto -4px',
          padding: '0 18px',
        }}
      >
        <div className={securityClass}>
          {highAlerts > 0 ? (
            <>
              <b>
                🔴 Sicherheitscheck:
                Auffälliges Voting-Muster gefunden.
              </b>{' '}
              {alertCount}{' '}
              {alertCount === 1
                ? 'Auffälligkeit sollte'
                : 'Auffälligkeiten sollten'}{' '}
              geprüft werden.
            </>
          ) : alertCount > 0 ? (
            <>
              <b>
                ⚠️ Sicherheitscheck:
                Hinweise vorhanden.
              </b>{' '}
              {alertCount}{' '}
              {alertCount === 1
                ? 'Auffälligkeit sollte'
                : 'Auffälligkeiten sollten'}{' '}
              geprüft werden.
            </>
          ) : (
            <>
              <b>
                ✅ Sicherheitscheck:
                Keine aktuellen Auffälligkeiten erkannt.
              </b>{' '}
              Neue Stimmen werden automatisch auf
              auffällige Voting-Muster geprüft.
            </>
          )}

          {' '}

          <a
            href={`/admin/release-voting/${roundId}/security`}
          >
            Sicherheitsprüfung öffnen
          </a>
        </div>
      </div>

      <AdminRoundDetail
        round={data.round}
        songs={data.songs}
        summary={data.summary}
        isCurrentDj={
          currentDjRoundId === data.round.id
        }
      />
    </>
  );
}

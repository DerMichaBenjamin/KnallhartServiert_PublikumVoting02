import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getRoundById } from '@/lib/releaseVoting';
import { getVotingSecurityReport } from '@/lib/votingSecurity';
import AdminVotingSecurity from '@/components/AdminVotingSecurity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PageProps = {
  params: Promise<{ roundId: string }>;
};

export default async function AdminVotingSecurityPage({ params }: PageProps) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const { roundId } = await params;
  const round = await getRoundById(roundId);
  if (!round) notFound();

  const report = await getVotingSecurityReport(roundId);

  return <AdminVotingSecurity round={round} report={report} />;
}

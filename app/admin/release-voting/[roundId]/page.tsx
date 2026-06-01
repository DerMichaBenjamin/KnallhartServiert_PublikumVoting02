import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminRoundDetail from '@/components/AdminRoundDetail';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';

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

  if (!data) notFound();

  return <AdminRoundDetail round={data.round} songs={data.songs} summary={data.summary} />;
}

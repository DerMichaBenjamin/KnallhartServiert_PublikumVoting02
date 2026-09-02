import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminDashboard from '@/components/AdminDashboard';
import { getAdminDashboardRoundData, getCurrentRound } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function Admin() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const current = await getCurrentRound();
  const [currentData, currentJuryData] = await Promise.all([
    current ? getAdminDashboardRoundData(current) : Promise.resolve(null),
    current ? getAdminJuryRoundData(current.id) : Promise.resolve({ defaultProfiles: [], jurors: [] }),
  ]);

  return <AdminDashboard
    currentRound={current}
    currentSongs={currentData?.songs || []}
    currentSummary={currentData?.summary || null}
    currentJuryData={currentJuryData}
    securityAlerts={null}
  />;
}

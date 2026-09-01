import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminDashboard from '@/components/AdminDashboard';
import { getSetting } from '@/lib/settings';
import { getAdminRoundDetailData, getCurrentRound } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function Admin() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const current = await getCurrentRound();
  const [currentData, currentJuryData, top5TemplateDataUrl] = await Promise.all([
    current ? getAdminRoundDetailData(current.id) : Promise.resolve(null),
    current ? getAdminJuryRoundData(current.id) : Promise.resolve({ defaultProfiles: [], jurors: [] }),
    getSetting('top5_graphic_template_data_url', ''),
  ]);

  return <AdminDashboard currentRound={current} currentSongs={currentData?.songs || []} currentSummary={currentData?.summary || null} currentJuryData={currentJuryData} top5TemplateDataUrl={top5TemplateDataUrl} />;
}

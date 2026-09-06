import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { listAllReleaseArtists } from '@/lib/releaseVoting';
import { PageHeader } from '@/components/admin/AdminUi';
import ArtistInstagramManager from '@/components/admin/ArtistInstagramManager';

export const dynamic = 'force-dynamic';

export default async function ArtistInstagramPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const knownArtists = await listAllReleaseArtists();

  return <main>
    <PageHeader
      eyebrow={<a href="/admin/release-voting">← Zum Dashboard</a>}
      title="Künstler & Instagram"
      description="Zentrales Instagram-Verzeichnis für den Release-Check und die Social-Media-Texte."
    />
    <ArtistInstagramManager knownArtists={knownArtists} />
  </main>;
}

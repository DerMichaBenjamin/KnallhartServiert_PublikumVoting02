import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSetting, setSetting } from '@/lib/settings';
import {
  RELEASE_ARTIST_INSTAGRAM_SEED_HANDLES,
  RELEASE_ARTIST_INSTAGRAM_SEED_LABELS,
  RELEASE_ARTIST_INSTAGRAM_SEED_VERSION,
} from '@/lib/releaseArtistInstagramSeed';

function cleanLabelDirectory(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>;

  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
    const key = String(rawKey || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('de-DE')
      .slice(0, 160);
    const label = String(rawValue || '').trim().replace(/\s+/g, ' ').slice(0, 160);
    if (!key || !label) continue;
    out[key] = label;
  }
  return out;
}

function cleanHandleDirectory(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>;

  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
    const key = String(rawKey || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('de-DE')
      .slice(0, 160);
    const handles = String(rawValue || '').trim().replace(/\s+/g, ' ').slice(0, 500);
    if (!key || !handles) continue;
    out[key] = handles;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const key = req.nextUrl.searchParams.get('key');

  if (key === 'top5-template') {
    const version = await getSetting('top5_graphic_template_version', '');
    if (version !== 'clean-v2') return NextResponse.json({ ok: true, dataUrl: '' });
    const dataUrl = await getSetting('top5_graphic_template_data_url', '');
    return NextResponse.json({ ok: true, dataUrl });
  }

  if (key === 'artist-instagram-handles') {
    const [rawHandles, rawLabels, storedSeedVersion] = await Promise.all([
      getSetting('release_check_instagram_handles', '{}'),
      getSetting('release_check_instagram_artist_labels', '{}'),
      getSetting('release_check_instagram_seed_version', ''),
    ]);

    let handles: Record<string, string> = {};
    let labels: Record<string, string> = {};
    try { handles = cleanHandleDirectory(JSON.parse(rawHandles || '{}')); } catch { handles = {}; }
    try { labels = cleanLabelDirectory(JSON.parse(rawLabels || '{}')); } catch { labels = {}; }

    // Die bestätigten Handles aus der Live-Auftritte-Verwaltung werden genau einmal
    // als Startbestand übernommen. Bereits im Release-Check gepflegte Werte haben Vorrang.
    // Nach dem Seed bleiben spätere Änderungen/Löschungen im Release-Check unangetastet.
    if (storedSeedVersion !== RELEASE_ARTIST_INSTAGRAM_SEED_VERSION) {
      handles = cleanHandleDirectory({ ...RELEASE_ARTIST_INSTAGRAM_SEED_HANDLES, ...handles });
      labels = cleanLabelDirectory({ ...RELEASE_ARTIST_INSTAGRAM_SEED_LABELS, ...labels });
      await Promise.all([
        setSetting('release_check_instagram_handles', JSON.stringify(handles)),
        setSetting('release_check_instagram_artist_labels', JSON.stringify(labels)),
        setSetting('release_check_instagram_seed_version', RELEASE_ARTIST_INSTAGRAM_SEED_VERSION),
      ]);
    }

    return NextResponse.json({ ok: true, handles, labels });
  }

  return NextResponse.json({ ok: false, error: 'Unbekannte Einstellung.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const body = await req.json();

    if (typeof body.impressum !== 'undefined') {
      await setSetting('impressum_text', String(body.impressum || ''));
    }

    if (typeof body.top5GraphicTemplateDataUrl !== 'undefined') {
      await setSetting('top5_graphic_template_data_url', String(body.top5GraphicTemplateDataUrl || ''));
    }

    if (typeof body.top5GraphicTemplateVersion !== 'undefined') {
      await setSetting('top5_graphic_template_version', String(body.top5GraphicTemplateVersion || ''));
    }

    if (typeof body.artistInstagramHandles !== 'undefined') {
      const handles = cleanHandleDirectory(body.artistInstagramHandles);
      await setSetting('release_check_instagram_handles', JSON.stringify(handles));
    }

    if (typeof body.artistInstagramLabels !== 'undefined') {
      const labels = cleanLabelDirectory(body.artistInstagramLabels);
      await setSetting('release_check_instagram_artist_labels', JSON.stringify(labels));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

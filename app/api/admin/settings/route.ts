import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSetting, setSetting } from '@/lib/settings';
import {
  RELEASE_ARTIST_INSTAGRAM_SEED_HANDLES,
  RELEASE_ARTIST_INSTAGRAM_SEED_LABELS,
  RELEASE_ARTIST_INSTAGRAM_SEED_VERSION,
} from '@/lib/releaseArtistInstagramSeed';
import {
  RELEASE_ARTIST_INSTAGRAM_EXTRA_HANDLES,
  RELEASE_ARTIST_INSTAGRAM_EXTRA_LABELS,
  RELEASE_ARTIST_INSTAGRAM_EXTRAS_VERSION,
} from '@/lib/releaseArtistInstagramExtras';

const MAX_ARTIST_DIRECTORY_ENTRIES = 5000;
const RELEASE_ARTIST_INSTAGRAM_COMBINED_VERSION =
  `${RELEASE_ARTIST_INSTAGRAM_SEED_VERSION}+${RELEASE_ARTIST_INSTAGRAM_EXTRAS_VERSION}`;

function cleanLabelDirectory(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>;

  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ARTIST_DIRECTORY_ENTRIES)) {
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
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ARTIST_DIRECTORY_ENTRIES)) {
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

function sameDirectory(left: Record<string, string>, right: Record<string, string>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
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

    let storedHandles: Record<string, string> = {};
    let storedLabels: Record<string, string> = {};
    try { storedHandles = cleanHandleDirectory(JSON.parse(rawHandles || '{}')); } catch { storedHandles = {}; }
    try { storedLabels = cleanLabelDirectory(JSON.parse(rawLabels || '{}')); } catch { storedLabels = {}; }

    const seedHandles = cleanHandleDirectory({
      ...RELEASE_ARTIST_INSTAGRAM_SEED_HANDLES,
      ...RELEASE_ARTIST_INSTAGRAM_EXTRA_HANDLES,
    });
    const seedLabels = cleanLabelDirectory({
      ...RELEASE_ARTIST_INSTAGRAM_SEED_LABELS,
      ...RELEASE_ARTIST_INSTAGRAM_EXTRA_LABELS,
    });

    // Seed/Importdaten ergänzen nur fehlende Einträge.
    // Bereits im Release-Check manuell gepflegte Werte haben IMMER Vorrang.
    const handles = cleanHandleDirectory({ ...seedHandles, ...storedHandles });
    const labels = cleanLabelDirectory({ ...seedLabels, ...storedLabels });

    // Nicht mehr nur "einmalig" importieren:
    // Wenn später neue Seed-/Importeinträge dazukommen, werden sie automatisch ergänzt.
    // Manuelle Release-Check-Werte werden dabei niemals überschrieben.
    if (
      storedSeedVersion !== RELEASE_ARTIST_INSTAGRAM_COMBINED_VERSION
      || !sameDirectory(handles, storedHandles)
      || !sameDirectory(labels, storedLabels)
    ) {
      await Promise.all([
        setSetting('release_check_instagram_handles', JSON.stringify(handles)),
        setSetting('release_check_instagram_artist_labels', JSON.stringify(labels)),
        setSetting('release_check_instagram_seed_version', RELEASE_ARTIST_INSTAGRAM_COMBINED_VERSION),
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

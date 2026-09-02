import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSetting, setSetting } from '@/lib/settings';

export async function GET(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  if (req.nextUrl.searchParams.get('key') !== 'top5-template') {
    return NextResponse.json({ ok: false, error: 'Unbekannte Einstellung.' }, { status: 400 });
  }

  const version = await getSetting('top5_graphic_template_version', '');
  if (version !== 'clean-v2') return NextResponse.json({ ok: true, dataUrl: '' });
  const dataUrl = await getSetting('top5_graphic_template_data_url', '');
  return NextResponse.json({ ok: true, dataUrl });
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 });
  }
}

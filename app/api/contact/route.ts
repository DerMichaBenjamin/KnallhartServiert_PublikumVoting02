import { NextResponse } from 'next/server';

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/kontakt', req.url), { status: 303 });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const name = clean(form.get('name'));
    const email = clean(form.get('email'));
    const message = clean(form.get('message'));

    if (!name || !email || !message) {
      return NextResponse.redirect(new URL('/kontakt?error=missing', req.url), { status: 303 });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();

    if (!apiKey || !from) {
      return NextResponse.redirect(new URL('/kontakt?error=config', req.url), { status: 303 });
    }

    const resend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Knallhart serviert Kontakt <${from}>`,
        to: ['info@knallhart-serviert.de'],
        reply_to: email,
        subject: 'Kontaktformular Knallhart serviert Voting',
        text: `Name: ${name}\nE-Mail: ${email}\n\n${message}`,
      }),
    });

    if (!resend.ok) {
      const errorText = await resend.text();
      const url = new URL('/kontakt', req.url);
      url.searchParams.set('error', 'mail');
      url.searchParams.set('detail', errorText.slice(0, 250));
      return NextResponse.redirect(url, { status: 303 });
    }

    return NextResponse.redirect(new URL('/kontakt?sent=1', req.url), { status: 303 });
  } catch (error) {
    const url = new URL('/kontakt', req.url);
    url.searchParams.set('error', 'server');
    url.searchParams.set('detail', error instanceof Error ? error.message : 'Unbekannter Fehler');
    return NextResponse.redirect(url, { status: 303 });
  }
}

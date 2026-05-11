import Header from '@/components/Header';

export const dynamic = 'force-dynamic';

export default async function Kontakt({
  searchParams,
}: {
  searchParams?: Promise<{ sent?: string; error?: string; detail?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const sent = params?.sent === '1';
  const error = params?.error;
  const detail = params?.detail ? decodeURIComponent(params.detail) : '';

  const errorText =
    error === 'missing'
      ? 'Bitte fülle alle Pflichtfelder aus.'
      : error === 'config'
        ? 'Das Kontaktformular ist noch nicht vollständig konfiguriert.'
        : error === 'mail'
          ? `Die Nachricht konnte nicht gesendet werden. ${detail}`
          : error === 'server'
            ? `Serverfehler beim Senden. ${detail}`
            : '';

  return (
    <main className="public-shell simple-page-shell">
      <Header />
      <section className="card simple-page-card">
        <h1>Kontakt</h1>
        <p>Schreib uns eine Nachricht. Sie wird an info@knallhart-serviert.de gesendet.</p>

        {sent && <div className="notice success">Nachricht wurde gesendet.</div>}
        {errorText && <div className="notice error">{errorText}</div>}

        <form className="contact-form" action="/api/contact" method="post">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            E-Mail
            <input name="email" type="email" required />
          </label>
          <label>
            Nachricht
            <textarea name="message" required rows={7} />
          </label>
          <button className="submit" type="submit">Nachricht senden</button>
        </form>
      </section>
    </main>
  );
}

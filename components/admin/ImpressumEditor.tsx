'use client';

import { useState } from 'react';

export default function ImpressumEditor({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  return <form className="ks-card ks-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setMessage(null); try { const response = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ impressum: value }) }); const data = await response.json().catch(() => null); if (!response.ok || !data?.ok) throw new Error(data?.error || 'Das Impressum konnte nicht gespeichert werden.'); setMessage({ type: 'ok', text: 'Impressum gespeichert.' }); } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unbekannter Fehler.' }); } finally { setBusy(false); } }}>
    {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
    <label>Impressumstext<textarea rows={24} value={value} onChange={(event) => setValue(event.target.value)} /></label>
    <div className="ks-form-actions"><a className="ks-button secondary" href="/impressum" target="_blank" rel="noreferrer">Öffentliche Seite ansehen</a><button className="ks-button primary" type="submit" disabled={busy}>{busy ? 'Speichert…' : 'Speichern'}</button></div>
  </form>;
}

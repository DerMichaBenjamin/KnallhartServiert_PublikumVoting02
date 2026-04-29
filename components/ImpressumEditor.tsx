'use client';
import { useEffect, useState } from 'react';

export default function ImpressumEditor() {
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [title, setTitle] = useState('Impressum');
  const [content, setContent] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/impressum', { cache: 'no-store' });
    const json = await res.json();
    setTitle(json.impressum?.title || 'Impressum');
    setContent(json.impressum?.content || '');
  }

  async function login() {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) { setLoggedIn(true); setMsg('Angemeldet.'); }
    else setMsg((await res.json()).error || 'Login fehlgeschlagen.');
  }

  async function save() {
    const res = await fetch('/api/impressum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    const json = await res.json();
    setMsg(res.ok ? 'Impressum gespeichert.' : (json.error || 'Speichern fehlgeschlagen.'));
  }

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <section className="admin-card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <a className="btn btn-secondary" href="/admin">← Admin</a>
          <a className="btn btn-secondary" href="/impressum">Öffentliches Impressum ansehen</a>
        </div>
        <div>
          <h1 className="text-3xl font-black text-[#06285f]">Impressum bearbeiten</h1>
          <p className="mt-2 opacity-75">Fülle die Platzhalter vollständig aus. Für rechtliche Sicherheit sollte der finale Text geprüft werden.</p>
        </div>
        {!loggedIn && (
          <div className="flex gap-3 flex-wrap">
            <input className="input max-w-xs" type="password" placeholder="Admin-Passwort" value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="btn" onClick={login}>Einloggen</button>
          </div>
        )}
        {msg && <p className="font-bold text-[#06285f]">{msg}</p>}
      </section>

      <section className="admin-card p-5 space-y-4">
        <label className="block font-bold">Titel
          <input className="input mt-1" value={title} onChange={e=>setTitle(e.target.value)} />
        </label>
        <label className="block font-bold">Impressum-Text
          <textarea className="input mt-1 min-h-[520px] font-mono text-sm leading-relaxed" value={content} onChange={e=>setContent(e.target.value)} />
        </label>
        <div className="flex gap-3 flex-wrap">
          <button className="btn" onClick={save} disabled={!loggedIn}>Impressum speichern</button>
          {!loggedIn && <span className="self-center font-bold opacity-70">Zum Speichern erst einloggen.</span>}
        </div>
      </section>
    </main>
  );
}

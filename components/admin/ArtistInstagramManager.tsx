'use client';

import { useEffect, useMemo, useState } from 'react';
import { cleanArtistLabel, normalizeArtistKey, splitReleaseArtistNames } from '@/lib/artistNames';

type Props = {
  knownArtists: string[];
};

type Directory = Record<string, string>;

function normalizeInstagramToken(token: string) {
  const cleaned = token
    .trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^@+/, '')
    .split(/[/?#]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, '');
  return cleaned ? `@${cleaned}` : '';
}

function normalizeHandles(value: string) {
  const unique = new Set<string>();
  for (const token of value.split(/[\s,;]+/)) {
    const normalized = normalizeInstagramToken(token);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique).join(' ');
}

export default function ArtistInstagramManager({ knownArtists }: Props) {
  const [handles, setHandles] = useState<Directory>({});
  const [labels, setLabels] = useState<Directory>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [newArtist, setNewArtist] = useState('');
  const [newHandles, setNewHandles] = useState('');

  useEffect(() => {
    void fetch('/api/admin/settings?key=artist-instagram-handles', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.ok) throw new Error(data?.error || 'Instagram-Verzeichnis konnte nicht geladen werden.');
        setHandles(data.handles && typeof data.handles === 'object' ? data.handles as Directory : {});
        setLabels(data.labels && typeof data.labels === 'object' ? data.labels as Directory : {});
      })
      .catch((error) => setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Instagram-Verzeichnis konnte nicht geladen werden.' }))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const map = new Map<string, string>();
    for (const artist of knownArtists) {
      for (const label of splitReleaseArtistNames(artist)) {
        map.set(normalizeArtistKey(label), label);
      }
    }
    for (const [key, rawLabel] of Object.entries(labels)) {
      const split = splitReleaseArtistNames(rawLabel || key);
      if (split.length === 1) {
        const label = split[0];
        const normalizedKey = normalizeArtistKey(label);
        if (!map.has(normalizedKey)) map.set(normalizedKey, label);
      }
    }
    for (const key of Object.keys(handles)) {
      const rawLabel = labels[key] || key;
      const split = splitReleaseArtistNames(rawLabel);
      if (split.length !== 1) continue;
      const label = split[0];
      const normalizedKey = normalizeArtistKey(label);
      if (!map.has(normalizedKey)) map.set(normalizedKey, label);
    }

    const needle = search.trim().toLocaleLowerCase('de-DE');
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label, handles: handles[key] || '' }))
      .filter((row) => !needle || row.label.toLocaleLowerCase('de-DE').includes(needle) || row.handles.toLocaleLowerCase('de-DE').includes(needle))
      .filter((row) => !onlyMissing || !row.handles.trim())
      .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
  }, [handles, knownArtists, labels, onlyMissing, search]);

  const totalArtists = useMemo(() => {
    const keys = new Set<string>();
    knownArtists.forEach((artist) => splitReleaseArtistNames(artist).forEach((label) => keys.add(normalizeArtistKey(label))));
    Object.keys(handles).forEach((key) => keys.add(key));
    Object.keys(labels).forEach((key) => keys.add(key));
    return keys.size;
  }, [handles, knownArtists, labels]);
  const handleCount = Object.values(handles).filter((value) => value.trim()).length;

  function changeHandles(key: string, value: string) {
    setHandles((current) => ({ ...current, [key]: value }));
  }

  function addArtist() {
    const label = cleanArtistLabel(newArtist);
    if (!label) {
      setNotice({ type: 'error', text: 'Bitte zuerst einen Künstlernamen eingeben.' });
      return;
    }
    const key = normalizeArtistKey(label);
    const normalized = normalizeHandles(newHandles);
    setLabels((current) => ({ ...current, [key]: label }));
    setHandles((current) => ({ ...current, [key]: normalized || current[key] || '' }));
    setNewArtist('');
    setNewHandles('');
    setSearch(label);
    setOnlyMissing(false);
    setNotice({ type: 'ok', text: `${label} wurde in das Verzeichnis aufgenommen. Bitte noch speichern.` });
  }

  async function saveAll() {
    setSaving(true);
    setNotice(null);
    try {
      const cleanedHandles: Directory = {};
      const cleanedLabels: Directory = {};

      for (const rawLabel of Object.values(labels)) {
        const split = splitReleaseArtistNames(rawLabel);
        if (split.length !== 1) continue;
        const label = split[0];
        cleanedLabels[normalizeArtistKey(label)] = label;
      }

      for (const artist of knownArtists) {
        for (const label of splitReleaseArtistNames(artist)) {
          cleanedLabels[normalizeArtistKey(label)] = label;
        }
      }

      for (const [key, value] of Object.entries(handles)) {
        const rawLabel = labels[key] || key;
        const split = splitReleaseArtistNames(rawLabel);
        if (split.length !== 1) continue;
        const normalized = normalizeHandles(value);
        if (normalized) cleanedHandles[normalizeArtistKey(split[0])] = normalized;
      }

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistInstagramHandles: cleanedHandles,
          artistInstagramLabels: cleanedLabels,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Instagram-Verzeichnis konnte nicht gespeichert werden.');

      setHandles(cleanedHandles);
      setLabels(cleanedLabels);
      setNotice({ type: 'ok', text: 'Instagram-Verzeichnis gespeichert. Die Tags werden im Social-Media-Text automatisch verwendet.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Instagram-Verzeichnis konnte nicht gespeichert werden.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="notice">Künstlerverzeichnis wird geladen…</div>;

  return <div className="ks-instagram-manager">
    {notice && <div className={`notice ${notice.type === 'ok' ? 'success' : 'error'}`}>{notice.text}</div>}

    <section className="admin-card ks-instagram-summary-card">
      <div>
        <h2>Künstlerverzeichnis</h2>
        <p className="admin-help-text">Die Release-Check-Künstler werden automatisch übernommen. Instagram-Handles speicherst du hier einmal dauerhaft. Mehrere Handles pro Künstler sind möglich.</p>
      </div>
      <div className="ks-instagram-summary-stats">
        <span><b>{totalArtists}</b> Künstler</span>
        <span><b>{handleCount}</b> mit Instagram-Tag</span>
      </div>
    </section>

    <section className="admin-card ks-instagram-add-card">
      <div>
        <h3>Neuen Künstler ergänzen</h3>
        <p className="admin-help-text">Für Künstler, die noch in keiner Release-Check-Runde vorkommen.</p>
      </div>
      <div className="ks-instagram-add-grid">
        <input value={newArtist} onChange={(event) => setNewArtist(event.target.value)} placeholder="Künstlername" />
        <input value={newHandles} onChange={(event) => setNewHandles(event.target.value)} placeholder="@instagramhandle oder mehrere Handles" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addArtist(); } }} />
        <button type="button" className="ks-button secondary" onClick={addArtist}>Künstler hinzufügen</button>
      </div>
    </section>

    <section className="admin-card">
      <div className="ks-table-toolbar ks-instagram-toolbar">
        <div>
          <h2>Instagram-Tags bearbeiten</h2>
          <p className="admin-help-text">Im Social-Media-Text erscheinen nur Tags, die hier gespeichert sind und zum jeweiligen Top-5-/Top-12-Ergebnis gehören.</p>
        </div>
        <div className="ks-instagram-filter-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Künstler oder Handle suchen" />
          <label><input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} /> Nur ohne Handle</label>
        </div>
      </div>

      <div className="ks-table-scroll">
        <table className="ks-table ks-instagram-table">
          <thead><tr><th>Künstler</th><th>Instagram-Handle(s)</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.key}>
              <td><strong>{row.label}</strong></td>
              <td><input value={row.handles} onChange={(event) => changeHandles(row.key, event.target.value)} placeholder="@instagramhandle" /></td>
              <td>{row.handles.trim() ? <span className="status-badge success">vorhanden</span> : <span className="status-badge">fehlt</span>}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={3}><div className="notice">Keine Künstler für diesen Filter gefunden.</div></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="ks-instagram-save-row">
        <button type="button" className="ks-button" onClick={saveAll} disabled={saving}>{saving ? 'Speichere…' : 'Alle Instagram-Tags speichern'}</button>
      </div>
    </section>
  </div>;
}

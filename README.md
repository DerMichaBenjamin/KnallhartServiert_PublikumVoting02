# Knallhart serviert – Live-Auftritte Mallorca

## Logos austauschen
Lege deine Bilddateien in den Ordner `/public/` und benenne sie exakt so:

- `knallhart-logo.png`
- `bierkoenig-logo.png`
- `megapark-logo.png`
- `oberbayern-logo.png`
- `mk-arena-logo.png`

Danach neu deployen.

## Supabase SQL
```sql
create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  location text not null check (location in ('Bierkönig', 'Megapark', 'Oberbayern', 'MK Arena')),
  time text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create index if not exists events_date_idx on public.events(date);
create index if not exists events_location_idx on public.events(location);
create index if not exists events_date_location_time_idx on public.events(date, location, time);

-- Entfernt bereits vorhandene doppelte identische Termine, bevor der eindeutige Index angelegt wird.
delete from public.events a
using public.events b
where a.id > b.id
  and a.date = b.date
  and a.location = b.location
  and a.time = b.time
  and a.title = b.title;

-- Verhindert doppelte identische Termine beim Speichern.
create unique index if not exists events_unique_day_location_time_title
on public.events(date, location, time, title);

alter table public.events enable row level security;

drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events for select using (true);
```

## ENV Variablen
In Vercel unter Project → Settings → Environment Variables eintragen:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`

## Deployment kurz
1. Supabase-Projekt erstellen.
2. SQL Editor öffnen und SQL oben ausführen.
3. Project Settings → API öffnen.
4. URL, anon key und service_role key kopieren.
5. GitHub Repo erstellen und alle Dateien hochladen.
6. Vercel → Add New Project → GitHub Repo auswählen.
7. ENV Variablen eintragen.
8. Deploy klicken.
9. `/admin` öffnen, Passwort eingeben, Termine eintragen.
10. PNG exportieren.

## PWA / App zur Startseite hinzufügen

Die App ist als Progressive Web App vorbereitet.

Enthaltene Dateien im Ordner `public/`:

- `manifest.json`
- `icon-192.png`
- `icon-512.png`
- `apple-touch-icon.png`
- `favicon.png`

Die Meta-Tags für iOS/Android liegen in `app/layout.tsx`.

Auf der öffentlichen Seite `/` erscheint unter der Story-Grafik der Button:

`Als App zur Startseite hinzufügen`

Wichtig:

- Der Button liegt außerhalb der 9:16-Grafik.
- Der Button wird nicht in den PNG-Export übernommen.
- Unterstützt der Browser die direkte Installation, startet der Button die Installation.
- Unterstützt der Browser das nicht direkt, erscheint der Hinweis:
  `Öffne das Browser-Menü und wähle „Zum Startbildschirm hinzufügen“.`

### Hinweis zu iPhone / iPad

Safari auf iOS zeigt oft keinen direkten Installationsdialog. Dort muss man meistens manuell gehen auf:

`Teilen` → `Zum Home-Bildschirm`

### Icons austauschen

Wenn du später bessere App-Icons möchtest, ersetze einfach diese Dateien im Ordner `public/`:

- `icon-192.png`
- `icon-512.png`
- `apple-touch-icon.png`
- `favicon.png`

Die Dateinamen müssen gleich bleiben.

## Ergänzung: Impressum-Tabelle in Supabase

Führe zusätzlich dieses SQL im Supabase SQL Editor aus:

```sql
create table if not exists public.legal_pages (
  slug text primary key,
  title text not null default 'Impressum',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists legal_pages_set_updated_at on public.legal_pages;
create trigger legal_pages_set_updated_at
before update on public.legal_pages
for each row execute function public.set_updated_at();

alter table public.legal_pages enable row level security;

drop policy if exists "legal_pages public read" on public.legal_pages;
create policy "legal_pages public read" on public.legal_pages for select using (true);

insert into public.legal_pages (slug, title, content) values (
  'impressum',
  'Impressum',
  'Angaben gemäß § 5 TMG / § 18 MStV

Bitte im Admin-Bereich vollständig ausfüllen und rechtlich prüfen lassen.

Betreiber:
[Name / Firma]
[Straße und Hausnummer]
[PLZ Ort]
[Deutschland]

Kontakt:
E-Mail: [E-Mail-Adresse]
Telefon: [Telefonnummer, falls gewünscht]

Vertreten durch:
[Name der verantwortlichen Person]

Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:
[Name]
[Adresse]

Umsatzsteuer-ID:
[falls vorhanden]

Haftung für Inhalte:
Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden.

Haftung für Links:
Diese Website kann Links zu externen Websites enthalten. Auf deren Inhalte haben wir keinen Einfluss. Für diese fremden Inhalte übernehmen wir keine Gewähr.

Urheberrecht:
Die durch den Betreiber erstellten Inhalte und Werke auf dieser Website unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung und Verbreitung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung.'
) on conflict (slug) do nothing;
```

## Impressum bearbeiten

Die öffentliche Seite zeigt unten einen kleinen Link zu `/impressum`.

Das Impressum lässt sich im Backend bearbeiten:

`/admin/impressum`

Wichtig:

- Vor dem Speichern mit dem `ADMIN_PASSWORD` einloggen.
- Platzhalter vollständig ersetzen.
- Der enthaltene Text ist eine technische Vorlage und muss für den konkreten Betreiber rechtlich geprüft werden.
- Der Impressum-Link liegt außerhalb der 9:16-Grafik und erscheint deshalb nicht im PNG-Export.

## Änderungen in dieser Version

### PNG-Export wirklich 9:16
Der Export nutzt jetzt eine versteckte, unskalierte 1080×1920-Grafik. Dadurch wird nicht mehr die kleine Vorschau oder die Browserfläche exportiert, sondern direkt eine postbare Story-Datei.

### Sortierung der Uhrzeiten
Der Veranstaltungstag läuft von 08:00 Uhr morgens bis 07:59 Uhr am Folgetag.

Beispiele:

- 20:00 kommt vor 22:00
- 23:30 kommt vor 00:15
- 00:15, 01:30, 03:00 zählen noch zum vorher ausgewählten Veranstaltungstag
- Erst Termine ab 08:00 Uhr gehören zum nächsten Veranstaltungstag

### Admin-Schutz
Auftritte können nur nach Admin-Login hinzugefügt, geändert oder gespeichert werden. Die öffentliche Seite kann nur lesen.

### Aussagekräftige Fehlermeldungen
Speicher- und Ladefehler geben jetzt konkretere Hinweise aus, z. B. ob Admin-Login, Supabase-ENV, SQL-Setup oder Service-Role-Key geprüft werden müssen.

### CSV-Export für Google Sheets
Im Backend unter `/admin/tabelle` gibt es jetzt den Button:

`CSV für Google Sheets herunterladen`

Die Datei wird als UTF-8-CSV mit Semikolon-Trennung ausgegeben und lässt sich in Google Sheets importieren.

### Freigestelltes Logo
`public/knallhart-logo.png` wurde durch ein freigestelltes PNG-Logo ersetzt.

### Hintergrund
Die Story-Grafik nutzt jetzt das Mockup-Bild als Hintergrundgrundlage. Es wird weich überlagert, damit die Termine lesbar bleiben.


## Update-Hinweise v3

- Die öffentliche Startseite zeigt automatisch den Veranstaltungstag bis 01:59 Uhr nachts an. Ab 02:00 Uhr wird der neue Tag angezeigt.
- Auf der öffentlichen Seite gibt es Buttons für vorherigen/nächsten Tag.
- Speichern im Admin ersetzt den kompletten gewählten Tag und hängt vorhandene Termine nicht erneut an.
- Identische Duplikate werden zusätzlich durch den eindeutigen Index `events_unique_day_location_time_title` verhindert.
- Die Web-Ansicht wurde übersichtlicher gemacht: Steuerung links/oben, Story-Grafik klar getrennt rechts/darunter.

### Künstler-Dropdown später

Ja, das ist problemlos möglich. Sinnvolle Umsetzung: zusätzliche Tabelle `artists` mit `location`, `name`, `created_at`. Im Admin bekommt jede Location dann ein Dropdown mit bekannten Künstlern plus weiterhin ein freies Textfeld. Für das MVP ist es noch nicht eingebaut, weil zuerst Speichern, Tageslogik und Export stabil sein sollten.

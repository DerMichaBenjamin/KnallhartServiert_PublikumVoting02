create table if not exists public.app_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now()
);

insert into public.app_settings (key, value_json)
values (
  'imprint',
  jsonb_build_object(
    'content', 'Impressum\n\nAngaben gemäß § 5 TMG\n\n[Name / Unternehmen]\n[Straße und Hausnummer]\n[PLZ Ort]\nDeutschland\n\nKontakt\nE-Mail: voting@knallhart-serviert.de\n\nVerantwortlich für den Inhalt nach § 18 Abs. 2 MStV\n[Name]\n[Adresse]\n\nHinweis: Bitte diese Angaben im Admin-Bereich vollständig und rechtssicher ausfüllen.'
  )
)
on conflict (key) do nothing;

create or replace function public.set_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_app_settings_updated_at();

alter table public.app_settings enable row level security;

notify pgrst, 'reload schema';

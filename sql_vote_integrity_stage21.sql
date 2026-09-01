-- Knallhart serviert – Vote-Check / Integritätsstatus (Stufe 2.1)
-- Idempotente Migration: kann erneut ausgeführt werden.
-- Bestehende Stimmen werden NICHT gelöscht.

begin;

-- 1) Ergebnis-/Prüfstatus ergänzen
alter table public.release_voting_votes
  add column if not exists is_counted boolean;

-- Nur neu fehlende Werte auffüllen. Falls is_counted aus einer früheren Version
-- bereits existiert, bleiben dort false-Werte ausdrücklich erhalten.
update public.release_voting_votes
set is_counted = true
where is_counted is null;

alter table public.release_voting_votes
  alter column is_counted set default true;

alter table public.release_voting_votes
  alter column is_counted set not null;

alter table public.release_voting_votes
  add column if not exists integrity_status text;

update public.release_voting_votes
set integrity_status = case when is_counted = false then 'review' else 'clear' end
where integrity_status is null or btrim(integrity_status) = '';

alter table public.release_voting_votes
  alter column integrity_status set default 'clear';

alter table public.release_voting_votes
  alter column integrity_status set not null;

-- Hinweise werden als JSON-Array gespeichert, z. B.
-- ["Wegwerf-/Alias-E-Mail-Domain: …", "Mehrere bestätigte Stimmen …"]
alter table public.release_voting_votes
  add column if not exists integrity_reasons jsonb;

alter table public.release_voting_votes
  add column if not exists email_domain text;

alter table public.release_voting_votes
  add column if not exists ip_hash text;

alter table public.release_voting_votes
  add column if not exists ranking_hash text;

alter table public.release_voting_votes
  add column if not exists integrity_updated_at timestamptz;

alter table public.release_voting_votes
  add column if not exists moderated_at timestamptz;

-- 2) Falls eine ältere Version bereits anders benannte Felder hatte,
--    soweit gefahrlos möglich in die neuen Felder übernehmen.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_votes' and column_name = 'is_excluded'
  ) then
    execute $sql$
      update public.release_voting_votes
      set is_counted = false,
          integrity_status = 'excluded'
      where coalesce(is_excluded, false) = true
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_votes' and column_name = 'excluded_at'
  ) then
    execute $sql$
      update public.release_voting_votes
      set is_counted = false,
          integrity_status = 'excluded',
          moderated_at = coalesce(moderated_at, excluded_at)
      where excluded_at is not null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_votes' and column_name = 'client_ip_hash'
  ) then
    execute $sql$
      update public.release_voting_votes
      set ip_hash = client_ip_hash
      where ip_hash is null and client_ip_hash is not null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_votes' and column_name = 'submit_ip_hash'
  ) then
    execute $sql$
      update public.release_voting_votes
      set ip_hash = submit_ip_hash
      where ip_hash is null and submit_ip_hash is not null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_votes' and column_name = 'exclusion_reason'
  ) then
    execute $sql$
      update public.release_voting_votes
      set integrity_reasons = jsonb_build_array(exclusion_reason::text)
      where exclusion_reason is not null
        and btrim(exclusion_reason::text) <> ''
        and integrity_reasons is null
    $sql$;
  end if;
end $$;

-- 3) Bestehende E-Mail-Domain ableiten (keine personenbezogene Zusatzinformation;
--    nur der Domainteil wird separat für die Prüfung gespeichert).
update public.release_voting_votes
set email_domain = lower(split_part(juror_email, '@', 2))
where (email_domain is null or email_domain = '')
  and juror_email like '%@%';

-- Bekannte Wegwerf-/Alias-Domains auch für bereits vorhandene bestätigte Stimmen
-- zunächst in die Prüfung schieben. Das ist KEIN endgültiger Ausschluss; im Backend
-- kann jede Stimme anschließend manuell als "Werten" freigegeben werden.
update public.release_voting_votes
set is_counted = false,
    integrity_status = 'review',
    integrity_reasons = coalesce(integrity_reasons, '[]'::jsonb) || jsonb_build_array('Wegwerf-/Alias-E-Mail-Domain: ' || email_domain),
    integrity_updated_at = now()
where is_verified = true
  and integrity_status not in ('approved', 'excluded')
  and email_domain in (
    '10minutemail.com', '10minutesemail.net', '20minutemail.com', 'atomicmail.io',
    'discard.email', 'discardmail.com', 'dispostable.com', 'emailondeck.com',
    'fakeinbox.com', 'getairmail.com', 'getnada.com', 'guerrillamail.com',
    'guerrillamail.net', 'guerrillamail.org', 'maildrop.cc', 'mailinator.com',
    'mailnesia.com', 'mintemail.com', 'moakt.com', 'mytemp.email',
    'sharklasers.com', 'spamgourmet.com', 'temp-mail.org', 'tempail.com',
    'tempmail.com', 'tempmail.net', 'tempmailo.com', 'throwawaymail.com',
    'trashmail.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net'
  )
  and not coalesce(integrity_reasons, '[]'::jsonb) @> jsonb_build_array('Wegwerf-/Alias-E-Mail-Domain: ' || email_domain);

-- Wenn aus einer früheren Version bereits IP-Hashes vorhanden sind, werden starke
-- Häufungen (3+ bestätigte Stimmen derselben Runde) ebenfalls nur zur Prüfung markiert.
with ip_clusters as (
  select id, count(*) over (partition by round_id, ip_hash) as ip_count
  from public.release_voting_votes
  where is_verified = true and ip_hash is not null
)
update public.release_voting_votes v
set is_counted = false,
    integrity_status = 'review',
    integrity_reasons = coalesce(v.integrity_reasons, '[]'::jsonb) || jsonb_build_array('Mehrere bestätigte Stimmen über dieselbe Verbindung (' || c.ip_count || ').'),
    integrity_updated_at = now()
from ip_clusters c
where v.id = c.id
  and c.ip_count >= 3
  and v.integrity_status not in ('approved', 'excluded')
  and not exists (
    select 1
    from jsonb_array_elements_text(coalesce(v.integrity_reasons, '[]'::jsonb)) as reason(value)
    where reason.value like 'Mehrere bestätigte Stimmen über dieselbe Verbindung%'
  );

-- 4) Bestehende nicht gewertete Stimmen bleiben nicht gewertet.
--    Falls noch kein spezieller Status existiert, werden sie als "review" gezeigt.
update public.release_voting_votes
set integrity_status = 'review'
where is_counted = false
  and integrity_status not in ('review', 'excluded');

-- 5) Indizes für Dashboard und automatische Prüfung
create index if not exists release_voting_votes_round_counted_idx
  on public.release_voting_votes(round_id, is_verified, is_counted);

create index if not exists release_voting_votes_round_integrity_idx
  on public.release_voting_votes(round_id, integrity_status);

create index if not exists release_voting_votes_round_ip_hash_idx
  on public.release_voting_votes(round_id, ip_hash)
  where ip_hash is not null;

create index if not exists release_voting_votes_round_ranking_hash_idx
  on public.release_voting_votes(round_id, ranking_hash)
  where ranking_hash is not null;

notify pgrst, 'reload schema';

commit;

-- Kontrollausgabe
select
  count(*) as gesamt,
  count(*) filter (where is_verified = true and is_counted = true) as gewertet,
  count(*) filter (where is_verified = true and is_counted = false and integrity_status <> 'excluded') as pruefung_nicht_gewertet,
  count(*) filter (where is_verified = true and integrity_status = 'excluded') as ausgeschlossen,
  count(*) filter (where is_verified = false) as unbestaetigt
from public.release_voting_votes;

select
  r.title,
  count(v.id) as gesamt,
  count(v.id) filter (where v.is_verified = true and v.is_counted = true) as gewertet,
  count(v.id) filter (where v.is_verified = true and v.is_counted = false and v.integrity_status <> 'excluded') as pruefung_nicht_gewertet,
  count(v.id) filter (where v.is_verified = true and v.integrity_status = 'excluded') as ausgeschlossen,
  count(v.id) filter (where v.is_verified = false) as unbestaetigt
from public.release_voting_rounds r
left join public.release_voting_votes v on v.round_id = r.id
group by r.id, r.title, r.created_at
order by r.created_at desc;

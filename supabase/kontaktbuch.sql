-- Mare Liberum · the contact book (since 3.79.0): one line per contact at the paywall
-- A contact is an agent at the paywall: the hash of its program name and its network. The node keeps these lines in its own
-- state (node/contacts.mjs: contact:<cid>, 31 days from first_seen) and hands them to the operator as NDJSON in exactly the
-- columns below (GET /contacts.ndjson, header x-mare-mod; tools/contacts-proof.mjs proves that the columns match). This file
-- puts the same lines into the shared database (schema mare, beside mare.sales; supabase/schema.sql) so they can be asked with
-- SQL. Row level security is on and no policy opens the table: nothing reaches it from outside. Lines are written only through
-- mare_contact_put, which first checks the writer secret against the 'writer' row of mare.keys (its SHA-256), as
-- mare_sale_put does. No address is ever in it: the network is an HMAC (ip_prefix_hash), the program a SHA-256 (ua_hash).
--
-- Load an export of the node (operator):
--   curl -s https://mareliberum.dev/contacts.ndjson -H "x-mare-mod: $MOD_KEY" > contacts.ndjson
--   while read -r line; do psql "$DB" -c "select public.mare_contact_put('$WRITER', \$j\$${line}\$j\$::jsonb)"; done < contacts.ndjson

-- ---------------------------------------------------------------- the lines
create table if not exists mare.contacts (
  cid             text primary key check (cid ~ '^[0-9a-f]{24}$'),            -- HMAC of (ua_hash, network) with a key of the server
  ua_hash         text not null check (ua_hash ~ '^[0-9a-f]{64}$'),            -- SHA-256 of the user agent
  ip_prefix_hash  text not null check (ip_prefix_hash ~ '^[0-9a-f]{24}$'),     -- HMAC of the network (IPv4 /24, IPv6 /48); never the network
  agent           text check (char_length(agent) <= 60),                      -- the program as the census names it
  kind            text check (char_length(kind) <= 20),                       -- the census kind: assistant, mcp-client, tool, registry, unknown …
  probe           boolean not null default false,                             -- an index, a registry or a probe by its name or kind
  kompetenz       text check (kompetenz in ('route', 'read', 'check', 'deal', 'pack', 'credit', 'session', 'fair')), -- the door of the last paywall hit
  preis_usd       numeric(12, 6) check (preis_usd >= 0),                       -- its price
  paywall_hits    integer not null default 0 check (paywall_hits >= 0),       -- 402 answers to this contact
  paywall_type    text check (paywall_type in ('no_wallet', 'price', 'scheme', 'chain', 'timeout')), -- the cause of the last 402
  paywall_types   jsonb not null default '{}'::jsonb,                         -- how often each cause stopped it
  first_seen      timestamptz not null,
  last_seen       timestamptz not null,
  days            date[] not null default '{}',                               -- the UTC days it was seen
  versuchte_paths text[] not null default '{}',                               -- the paid doors it tried (at most 20)
  abbruch_phase   text check (abbruch_phase in ('402', 'session', 'probe', 'probe_empty', 'pay_sent', 'paid')), -- the furthest step reached
  session         text check (session ~ '^[0-9a-f]{24}$'),                    -- the id of its session (POST /session), never the key
  paid            integer not null default 0 check (paid >= 0),               -- answers it paid for
  paid_usd        numeric(12, 6) not null default 0 check (paid_usd >= 0),
  wiederkunft_d7  boolean not null default false,                             -- seen again on another UTC day within 7 days of first_seen
  check (last_seen >= first_seen)
);
create index if not exists contacts_first_seen on mare.contacts (first_seen desc);
create index if not exists contacts_last_seen on mare.contacts (last_seen desc);
create index if not exists contacts_paywall_type on mare.contacts (paywall_type);
alter table mare.contacts enable row level security;
revoke all on table mare.contacts from anon, authenticated;

-- ---------------------------------------------------------------- writing: one line of /contacts.ndjson, newer wins
create or replace function public.mare_contact_put(secret text, c jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare i text := c->>'cid';
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  if i is null or i !~ '^[0-9a-f]{24}$' then raise exception 'cid: 24 hex characters'; end if;
  insert into mare.contacts (cid, ua_hash, ip_prefix_hash, agent, kind, probe, kompetenz, preis_usd, paywall_hits, paywall_type, paywall_types,
                             first_seen, last_seen, days, versuchte_paths, abbruch_phase, session, paid, paid_usd, wiederkunft_d7)
  values (i, c->>'ua_hash', c->>'ip_prefix_hash', left(c->>'agent', 60), left(c->>'kind', 20), coalesce((c->>'probe')::boolean, false),
          c->>'kompetenz', (c->>'preis_usd')::numeric, coalesce((c->>'paywall_hits')::int, 0), c->>'paywall_type', coalesce(c->'paywall_types', '{}'::jsonb),
          (c->>'first_seen')::timestamptz, (c->>'last_seen')::timestamptz,
          coalesce(array(select jsonb_array_elements_text(c->'days'))::date[], '{}'), coalesce(array(select left(x, 60) from jsonb_array_elements_text(c->'versuchte_paths') x limit 20), '{}'),
          c->>'abbruch_phase', c->>'session', coalesce((c->>'paid')::int, 0), coalesce((c->>'paid_usd')::numeric, 0), coalesce((c->>'wiederkunft_d7')::boolean, false))
  on conflict (cid) do update set
    agent = excluded.agent, kind = excluded.kind, probe = excluded.probe, kompetenz = excluded.kompetenz, preis_usd = excluded.preis_usd,
    paywall_hits = excluded.paywall_hits, paywall_type = excluded.paywall_type, paywall_types = excluded.paywall_types,
    last_seen = excluded.last_seen, days = excluded.days, versuchte_paths = excluded.versuchte_paths, abbruch_phase = excluded.abbruch_phase,
    session = excluded.session, paid = excluded.paid, paid_usd = excluded.paid_usd, wiederkunft_d7 = excluded.wiederkunft_d7
  where excluded.last_seen >= mare.contacts.last_seen;
  return i;
end $$;
revoke all on function public.mare_contact_put(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- the four numbers of the morning (dashboard_zeilen.md)
-- per UTC day of first_seen: new contacts, their 402 by cause, 402 to paid, back within 7 days (the cohort is complete 8 days on).
-- The node's /contacts.json counts the 402 of each day exactly; this view sums what each contact carries.
create or replace view mare.contacts_morning with (security_invoker = true) as
select (first_seen at time zone 'UTC')::date                                   as day,
       count(*)                                                                 as neue_agenten,
       count(*) filter (where probe)                                            as davon_pruefer,
       coalesce(sum((paywall_types->>'no_wallet')::int), 0)                     as p402_kein_wallet,
       coalesce(sum((paywall_types->>'price')::int), 0)                         as p402_preis,
       coalesce(sum((paywall_types->>'scheme')::int), 0)                        as p402_scheme,
       coalesce(sum((paywall_types->>'chain')::int), 0)                         as p402_chain,
       coalesce(sum((paywall_types->>'timeout')::int), 0)                       as p402_timeout,
       coalesce(sum(paywall_hits), 0)                                           as p402,
       count(*) filter (where paywall_hits > 0 and paid > 0)                    as bezahlt_nach_402,
       count(*) filter (where paywall_hits > 0)                                 as kontakte_mit_402,
       count(*) filter (where paywall_hits = 1)                                 as einmal,
       count(*) filter (where paywall_hits > 1)                                 as mehrmals,
       count(*) filter (where wiederkunft_d7)                                   as wiederkunft_d7,
       round(100.0 * count(*) filter (where wiederkunft_d7) / nullif(count(*), 0), 1) as wiederkunft_d7_pct
from mare.contacts
group by 1;
revoke all on mare.contacts_morning from anon, authenticated;

-- ---------------------------------------------------------------- keeping: 31 days from first_seen, as in the node
create or replace function public.mare_contacts_sweep(secret text) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  delete from mare.contacts where first_seen < now() - interval '31 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mare_contacts_sweep(text) from public, anon, authenticated;

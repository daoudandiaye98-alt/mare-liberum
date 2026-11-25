-- Mare Liberum · fair share (3.34): the exact amount and the kind of a fair-share settlement in the sales of the till;
-- what became of a sale, by id (mare_sale_get); the treasury and the pulse with fair-share payments counted apart
-- A MIGRATION FILE ONLY: written with branch fair/1, not applied. The operator applies it (Supabase, project
-- nmfnetqvivvfkvwwlxhp, schema mare) when fair share goes live; until then the node works exactly as before: it already
-- sends amount_micro and kind with a fair-share sale (node/fair.mjs, node/ledger.mjs), and mare_sale_put as it stands
-- ignores both, so the sale is kept with its amount rounded to whole cents (amount_cents), as every sale before.
-- The receipts themselves are not in the database: the node keeps them 30 days in its own memory (kv fair:d:<day>), with
-- the running totals (kv fair:total) and the payments (kv fair:pay). Nothing here holds an address or a caller hash
-- beyond what mare.sales already holds (agent_ua_hash, salted per day; the paying wallet, public on chain anyway).

alter table mare.sales add column if not exists amount_micro bigint check (amount_micro is null or amount_micro between 0 and 1000000000);  -- millionths of a dollar (USDC base units)
alter table mare.sales add column if not exists kind text check (kind is null or kind in ('fair'));                                   -- null: the paid route; fair: a fair-share settlement

create or replace function public.mare_sale_put(secret text, s jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare i text := left(s->>'id', 40);
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  if i is null or i !~ '^[a-z0-9]{6,40}$' then raise exception 'id: 6 to 40 small letters and digits'; end if;
  insert into mare.sales (id, ts, q, amount_cents, status, agent_ua_hash, settled_at, method, tx, payer, network, amount_micro, kind)
  values (i, coalesce((s->>'ts')::timestamptz, now()), left(s->>'q', 300), coalesce((s->>'amount_cents')::int, 0), coalesce(s->>'status', 'unverified'),
          left(s->>'agent_ua_hash', 32), (s->>'settled_at')::timestamptz, left(s->>'method', 20), left(s->>'tx', 120), left(s->>'payer', 42), left(s->>'network', 20),
          (s->>'amount_micro')::bigint, case when s->>'kind' = 'fair' then 'fair' end)
  on conflict do nothing;
  return i;
end $$;

-- what the fair share brought in, exact to the millionth of a dollar (for /fair once the node reads it; read-only)
create or replace function public.mare_fair_settled(secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  return (select jsonb_build_object(
    'settled_micro', coalesce(sum(amount_micro) filter (where status = 'settled'), 0),
    'on_its_way_micro', coalesce(sum(amount_micro) filter (where status in ('pending', 'unverified')), 0),
    'payments', count(*) filter (where status in ('settled', 'pending', 'unverified'))
  ) from mare.sales where kind = 'fair');
end $$;

-- ---------------------------------------------------------------- what became of a sale (since 3.34): status by id
-- A node that restarted lost its own copy of the sales; a fair-share payment still "on its way" asks here whether it
-- settled. Read-only, guarded by the writer secret; it gives the status, the transaction and the time, nothing else.
create or replace function public.mare_sale_get(secret text, ids text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'tx', s.tx, 'payer', s.payer, 'settled_at', s.settled_at))
                   from mare.sales s where s.id = any(coalesce(ids, '{}')[1:200])), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- the treasury and the pulse: fair-share payments apart
-- A fair-share payment is a voluntary contribution, never a sale of the paid move: the numbers of the paid move leave it
-- out, and it is counted apart under "fair". Rows written before this migration are known by their method (fair-x402-v…).
create or replace function public.mare_treasury(secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d0 timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc'; r jsonb;
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  select jsonb_build_object(
    'today', to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
    'today_count', count(*) filter (where ts >= d0 and status in ('settled', 'pending', 'unverified', 'unsettled')),
    'today_paid', count(*) filter (where ts >= d0 and status in ('settled', 'pending', 'unverified', 'unsettled')),
    'today_free', count(*) filter (where ts >= d0 and status = 'free_sample'),
    'today_usd', round(coalesce(sum(amount_cents) filter (where ts >= d0 and status = 'settled'), 0) / 100.0, 2),
    'today_usd_unconfirmed', round(coalesce(sum(amount_cents) filter (where ts >= d0 and status in ('pending', 'unverified', 'unsettled')), 0) / 100.0, 2),
    'tests_today', count(*) filter (where ts >= d0 and status = 'test'),
    'total_count', count(*) filter (where status in ('settled', 'pending', 'unverified', 'unsettled')),
    'total_usd', round(coalesce(sum(amount_cents) filter (where status = 'settled'), 0) / 100.0, 2),
    'total_usd_unconfirmed', round(coalesce(sum(amount_cents) filter (where status in ('pending', 'unverified', 'unsettled')), 0) / 100.0, 2)
  ) into r from mare.sales where not (coalesce(kind, '') = 'fair' or coalesce(method, '') like 'fair-%');
  r := r || jsonb_build_object('today_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) as n from mare.sales where ts >= d0 and status in ('settled', 'pending', 'unverified', 'unsettled') and not (coalesce(kind, '') = 'fair' or coalesce(method, '') like 'fair-%') group by status) x), '{}'::jsonb));
  r := r || jsonb_build_object('last_5', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'ts', y.ts, 'q', left(y.q, 80), 'amount_usd', round(y.amount_cents / 100.0, 2), 'status', y.status, 'method', y.method,
                 'tx', case when length(y.tx) > 16 then left(y.tx, 10) || '…' || right(y.tx, 6) else y.tx end) order by y.ts desc)
               from (select * from mare.sales where status <> 'free_sample' and not (coalesce(kind, '') = 'fair' or coalesce(method, '') like 'fair-%') order by ts desc limit 5) y), '[]'::jsonb));
  r := r || jsonb_build_object('fair', (select jsonb_build_object(
    'today_count', count(*) filter (where ts >= d0 and status in ('settled', 'pending', 'unverified', 'unsettled')),
    'today_usd', round(coalesce(sum(coalesce(amount_micro, amount_cents * 10000)) filter (where ts >= d0 and status = 'settled'), 0) / 1000000.0, 6),
    'today_usd_unconfirmed', round(coalesce(sum(coalesce(amount_micro, amount_cents * 10000)) filter (where ts >= d0 and status in ('pending', 'unverified', 'unsettled')), 0) / 1000000.0, 6),
    'total_count', count(*) filter (where status in ('settled', 'pending', 'unverified', 'unsettled')),
    'total_usd', round(coalesce(sum(coalesce(amount_micro, amount_cents * 10000)) filter (where status = 'settled'), 0) / 1000000.0, 6),
    'total_usd_unconfirmed', round(coalesce(sum(coalesce(amount_micro, amount_cents * 10000)) filter (where status in ('pending', 'unverified', 'unsettled')), 0) / 1000000.0, 6),
    'note', 'voluntary fair-share payments for receipts (/fair), counted apart: they are no sales of the paid move')
    from mare.sales where coalesce(kind, '') = 'fair' or coalesce(method, '') like 'fair-%'));
  return r;
end $$;

-- the pulse of the day, as in schema.sql, with fair-share payments apart from the money of the paid move
create or replace function public.mare_pulse(secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h1 timestamptz := now() - interval '1 hour'; h24 timestamptz := now() - interval '1 day';
        d0 timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc'; r jsonb;
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  select jsonb_build_object(
    'unique_domains_today', count(distinct target_domain) filter (where ts >= d0),
    'agents_today', count(distinct ua_hash) filter (where ts >= d0),
    'hits_today', count(*) filter (where ts >= d0),
    'hits_last_hour', count(*) filter (where ts >= h1),
    'unique_domains_last_hour', count(distinct target_domain) filter (where ts >= h1),
    'hits_last_24h', count(*) filter (where ts >= h24),
    'worked_last_24h', count(*) filter (where ts >= h24 and outcome = 'worked'),
    'failed_last_24h', count(*) filter (where ts >= h24 and outcome = 'failed')
  ) into r from mare.via_hits where ts >= least(d0, h24);
  -- a task shows only once two different callers carried it: one agent's words alone are never put on show
  r := r || jsonb_build_object('top_queries', coalesce((select jsonb_agg(jsonb_build_object('query', left(x.q, 80), 'count', x.n) order by x.n desc, x.q)
            from (select q, count(*) as n from mare.via_hits where ts >= d0 and q is not null group by q having count(distinct ua_hash) >= 2 order by count(*) desc, q limit 10) x), '[]'::jsonb));
  r := r || jsonb_build_object('top_domains', coalesce((select jsonb_agg(jsonb_build_object('domain', x.target_domain, 'count', x.n) order by x.n desc, x.target_domain)
            from (select target_domain, count(*) as n from mare.via_hits where ts >= d0 and target_domain is not null group by target_domain order by count(*) desc, target_domain limit 10) x), '[]'::jsonb));
  r := r || jsonb_build_object('by_kind_today', coalesce((select jsonb_object_agg(x.k, x.n) from (select coalesce(kind, 'walk') as k, count(*) as n from mare.via_hits where ts >= d0 group by 1) x), '{}'::jsonb));
  -- as in 3.27.0: the last 24 hours
  r := r || jsonb_build_object('top_10_domains', coalesce((select jsonb_agg(jsonb_build_object('domain', x.target_domain, 'hits', x.n) order by x.n desc, x.target_domain)
            from (select target_domain, count(*) as n from mare.via_hits where ts >= h24 and target_domain is not null group by target_domain order by count(*) desc, target_domain limit 10) x), '[]'::jsonb));
  r := r || jsonb_build_object('top_5_queries', coalesce((select jsonb_agg(jsonb_build_object('q', left(x.q, 80), 'hits', x.n) order by x.n desc, x.q)
            from (select q, count(*) as n from mare.via_hits where ts >= h24 and q is not null group by q having count(distinct ua_hash) >= 2 order by count(*) desc, q limit 5) x), '[]'::jsonb));
  r := r || (select jsonb_build_object(
              'paid_today_usd', round(coalesce(sum(amount_cents) filter (where status = 'settled'), 0) / 100.0, 2),
              'paid_today_usd_unconfirmed', round(coalesce(sum(amount_cents) filter (where status in ('pending', 'unverified', 'unsettled')), 0) / 100.0, 2),
              'free_samples_today', count(*) filter (where status = 'free_sample'),
              'paid_today', jsonb_build_object(
                'count', count(*) filter (where status in ('settled', 'pending', 'unverified', 'unsettled')),
                'usd', round(coalesce(sum(amount_cents) filter (where status = 'settled'), 0) / 100.0, 2),
                'usd_unconfirmed', round(coalesce(sum(amount_cents) filter (where status in ('pending', 'unverified', 'unsettled')), 0) / 100.0, 2)))
            from mare.sales where ts >= d0 and not (coalesce(kind, '') = 'fair' or coalesce(method, '') like 'fair-%'));
  -- voluntary fair-share payments (since 3.34), apart from the paid move
  r := r || jsonb_build_object('fair_today_usd', (select round(coalesce(sum(coalesce(amount_micro, amount_cents * 10000)) filter (where status = 'settled'), 0) / 1000000.0, 6)
            from mare.sales where ts >= d0 and (coalesce(kind, '') = 'fair' or coalesce(method, '') like 'fair-%')));
  return r;
end $$;

-- Mare Liberum · the till and the via record (since 3.27.0)
-- These tables live in the sea's shared database, schema mare (project nmfnetqvivvfkvwwlxhp), beside mare.mem,
-- mare.keys, mare.works and mare.atlas. Nothing reaches them from outside: row level security is on and no policy
-- opens them. The node writes and reads only through the functions below, and every function first checks the node's
-- writer secret against the 'writer' row of mare.keys (its SHA-256), like mare_mem_put does.
-- Applied as migrations mare_till_sales (sales, treasury) and mare_via_hits (via record, pulse); since 3.28.0
-- mare_till_free_sample (free samples beside the sales), mare_via_kinds (what passed through, by kind) and
-- mare_pulse_today (the pulse of the day).

-- ---------------------------------------------------------------- sales: one line for every sale of the paid move
create table if not exists mare.sales (
  id            text primary key,                     -- made by the node (s + time + random), shown to the buyer
  ts            timestamptz not null default now(),
  q             text,                                 -- the task the route was bought for
  amount_cents  integer not null check (amount_cents between 0 and 100000),
  status        text not null check (status in ('settled', 'pending', 'unverified', 'unsettled', 'test', 'free_sample')),  -- free_sample: POST /route?free=true, never money
  agent_ua_hash text,                                 -- program and network of the buyer, salted per day; no address
  settled_at    timestamptz,                          -- when the money was seen to arrive on chain
  method        text,                                 -- x402-v1, x402-v2, transfer, receipt, test
  tx            text,                                 -- transaction hash (or the receipt as handed in)
  payer         text,                                 -- the paying wallet, where the payment names one
  network       text
);
-- a receipt counts once
create unique index if not exists sales_tx_once on mare.sales (lower(tx)) where tx is not null;
create index if not exists sales_ts on mare.sales (ts desc);
alter table mare.sales enable row level security;
revoke all on table mare.sales from anon, authenticated;

create or replace function public.mare_sale_put(secret text, s jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare i text := left(s->>'id', 40);
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  if i is null or i !~ '^[a-z0-9]{6,40}$' then raise exception 'id: 6 to 40 small letters and digits'; end if;
  insert into mare.sales (id, ts, q, amount_cents, status, agent_ua_hash, settled_at, method, tx, payer, network)
  values (i, coalesce((s->>'ts')::timestamptz, now()), left(s->>'q', 300), coalesce((s->>'amount_cents')::int, 0), coalesce(s->>'status', 'unverified'),
          left(s->>'agent_ua_hash', 32), (s->>'settled_at')::timestamptz, left(s->>'method', 20), left(s->>'tx', 120), left(s->>'payer', 42), left(s->>'network', 20))
  on conflict do nothing;
  return i;
end $$;

-- what became of a sale later: a settlement that landed after the answer went out
create or replace function public.mare_sale_set(secret text, i text, s jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  update mare.sales set
    status     = coalesce(s->>'status', status),
    tx         = coalesce(left(s->>'tx', 120), tx),
    payer      = coalesce(left(s->>'payer', 42), payer),
    settled_at = coalesce((s->>'settled_at')::timestamptz, settled_at)
  where id = i;
  get diagnostics n = row_count;
  return n;
end $$;

-- the numbers of the till: money seen to arrive (settled) apart from what is only claimed or still on its way;
-- sales of the paid move (today_paid) apart from free samples (today_free), which are never money and never sales
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
  ) into r from mare.sales;
  r := r || jsonb_build_object('today_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) as n from mare.sales where ts >= d0 and status in ('settled', 'pending', 'unverified', 'unsettled') group by status) x), '{}'::jsonb));
  r := r || jsonb_build_object('last_5', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'ts', y.ts, 'q', left(y.q, 80), 'amount_usd', round(y.amount_cents / 100.0, 2), 'status', y.status, 'method', y.method,
                 'tx', case when length(y.tx) > 16 then left(y.tx, 10) || '…' || right(y.tx, 6) else y.tx end) order by y.ts desc)
               from (select * from mare.sales where status <> 'free_sample' order by ts desc limit 5) y), '[]'::jsonb));
  return r;
end $$;

-- ---------------------------------------------------------------- via_hits: one line for every walk through /via/
-- (since 3.28.0 for every step through the sea toward a site or a task, by kind)
create table if not exists mare.via_hits (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  kind          text,        -- walk (/via/), read (the reader), door (/d/…), go (a go link), site (/site/<domain> as data), ask (the brain); empty before 3.28.0: a walk
  target_domain text,        -- the site the walk went to (its registrable name); empty for walks out of a private memory
  q             text,        -- the task the address was handed out for, when it carried one
  ua_hash       text,        -- program and network of the caller, salted per day with the node's key; no address
  token_host    text,        -- the exact host the token named (without www.)
  outcome       text,        -- worked or failed, once the agent says so through worked_it / failed_it; robots when refused
  status        smallint     -- what the place answered (or 502 when it did not)
);
create index if not exists via_hits_domain_ts on mare.via_hits (target_domain, ts);
create index if not exists via_hits_q_ts on mare.via_hits (q, ts);
create index if not exists via_hits_ts on mare.via_hits (ts);
create index if not exists via_hits_ua_ts on mare.via_hits (ua_hash, ts);
create index if not exists via_hits_kind_ts on mare.via_hits (kind, ts);
alter table mare.via_hits enable row level security;
revoke all on table mare.via_hits from anon, authenticated;

-- the node hands over the walks of a moment together; walks older than 90 days are let go now and then
create or replace function public.mare_via_put(secret text, rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 500 then raise exception 'rows: an array of at most 500'; end if;
  insert into mare.via_hits (ts, kind, target_domain, q, ua_hash, token_host, outcome, status)
  select coalesce(r.ts, now()), case when r.kind in ('walk', 'read', 'door', 'go', 'site', 'ask') then r.kind else 'walk' end,
         left(r.target_domain, 200), left(r.q, 300), left(r.ua_hash, 32), left(r.token_host, 200), left(r.outcome, 20),
         case when r.status between 100 and 599 then r.status else null end
  from jsonb_to_recordset(rows) as r(ts timestamptz, kind text, target_domain text, q text, ua_hash text, token_host text, outcome text, status int);
  get diagnostics n = row_count;
  if random() < 0.01 then delete from mare.via_hits where ts < now() - interval '90 days'; end if;
  return n;
end $$;

-- "it worked" / "it failed": the newest walk of that caller to that site in the last day that has no outcome yet
create or replace function public.mare_via_outcome(secret text, o jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  if coalesce(o->>'outcome', '') not in ('worked', 'failed') then raise exception 'outcome: worked or failed'; end if;
  update mare.via_hits set outcome = o->>'outcome'
   where id = (select h.id from mare.via_hits h
                where h.ts > now() - interval '1 day' and h.outcome is null and h.target_domain = o->>'target_domain'
                  and h.ua_hash in (select jsonb_array_elements_text(coalesce(o->'ua_hashes', '[]'::jsonb)))
                order by h.ts desc limit 1);
  get diagnostics n = row_count;
  return n;
end $$;

-- the pulse of the day (since 3.28.0, migration mare_pulse_today): every step through the sea counts (walks, reads,
-- doors, go links, maps of sites as data, questions to the brain); a task shows once two different callers carried it;
-- free samples and paid money apart. The numbers of 3.27.0 (the last 24 hours) stay beside them.
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
            from mare.sales where ts >= d0);
  return r;
end $$;

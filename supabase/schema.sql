-- Mare Liberum · the till and the via record (since 3.27.0)
-- These tables live in the sea's shared database, schema mare (project nmfnetqvivvfkvwwlxhp), beside mare.mem,
-- mare.keys, mare.works and mare.atlas. Nothing reaches them from outside: row level security is on and no policy
-- opens them. The node writes and reads only through the functions below, and every function first checks the node's
-- writer secret against the 'writer' row of mare.keys (its SHA-256), like mare_mem_put does.
-- Applied as migrations mare_till_sales (sales, treasury) and mare_via_hits (via record, pulse).

-- ---------------------------------------------------------------- sales: one line for every sale of the paid move
create table if not exists mare.sales (
  id            text primary key,                     -- made by the node (s + time + random), shown to the buyer
  ts            timestamptz not null default now(),
  q             text,                                 -- the task the route was bought for
  amount_cents  integer not null check (amount_cents between 0 and 100000),
  status        text not null check (status in ('settled', 'pending', 'unverified', 'unsettled', 'test')),
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

-- the numbers of the till: money seen to arrive (settled) apart from what is only claimed or still on its way
create or replace function public.mare_treasury(secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d0 timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc'; r jsonb;
begin
  if not exists (select 1 from mare.keys k where k.name = 'writer' and k.hash = encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')) then
    raise exception 'not allowed';
  end if;
  select jsonb_build_object(
    'today', to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
    'today_count', count(*) filter (where ts >= d0 and status <> 'test'),
    'today_usd', round(coalesce(sum(amount_cents) filter (where ts >= d0 and status = 'settled'), 0) / 100.0, 2),
    'today_usd_unconfirmed', round(coalesce(sum(amount_cents) filter (where ts >= d0 and status in ('pending', 'unverified', 'unsettled')), 0) / 100.0, 2),
    'tests_today', count(*) filter (where ts >= d0 and status = 'test'),
    'total_count', count(*) filter (where status <> 'test'),
    'total_usd', round(coalesce(sum(amount_cents) filter (where status = 'settled'), 0) / 100.0, 2),
    'total_usd_unconfirmed', round(coalesce(sum(amount_cents) filter (where status in ('pending', 'unverified', 'unsettled')), 0) / 100.0, 2)
  ) into r from mare.sales;
  r := r || jsonb_build_object('today_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) as n from mare.sales where ts >= d0 and status <> 'test' group by status) x), '{}'::jsonb));
  r := r || jsonb_build_object('last_5', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'ts', y.ts, 'q', left(y.q, 80), 'amount_usd', round(y.amount_cents / 100.0, 2), 'status', y.status, 'method', y.method,
                 'tx', case when length(y.tx) > 16 then left(y.tx, 10) || '…' || right(y.tx, 6) else y.tx end) order by y.ts desc)
               from (select * from mare.sales order by ts desc limit 5) y), '[]'::jsonb));
  return r;
end $$;

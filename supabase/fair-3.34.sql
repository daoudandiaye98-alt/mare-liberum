-- Mare Liberum · fair share (3.34): the exact amount and the kind of a fair-share settlement in the sales of the till
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

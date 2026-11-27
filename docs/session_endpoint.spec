SPEC  GET /session?as=key (first choice) · POST /session (the same key as JSON)  ·  Mare Liberum 3.78.0 (key), 3.79.0 (server-timing,
      next_step, contact book), 3.80.0 (the key by GET, x-sea-session first, the no-wallet words first in every 402),
      3.81.0 (calls_left and calls_used in every keyed answer, way_out at 3 and 0, the topup POST /route?a=topup),
      3.82.0 (one taste for an empty key, receipts checked against the chain books, the topup by transfer, the sums)
Code: node/session.mjs, node/core.mjs (route /session, sessionDoor)  ·  Proof: tools/session-proof.mjs (28 proofs, 21 controls),
tools/contacts-proof.mjs (K2 proof)  ·  Live since 27.11.2026 15:50 (3.78.0)

SUCCESS BAR (K2)
  - one GET, no body, no account, no e-mail, no form: GET /session?as=key
  - the key is that first answer (the whole text body; POST /session gives it as the JSON field "key"): no second request
  - server time under 300 ms (header server-timing: session;dur=<ms>)
  - first paid answer after at most 3 calls: GET /session?as=key, the paid door with the key (2 calls; the 3rd is the bookmark)

REQUEST
  GET  https://mareliberum.dev/session?as=key[&agent=<name>][&callback_url=<https url>]     ← first choice, no body
  POST https://mareliberum.dev/session[?as=key]   body: none, or {"callback_url": "https://…", "agent": "<name>"} (≤ 4096 characters)
  crawlers (by their name) and HEAD get the words of GET /session, never a key
  callback_url: https, a public host by name (no IP, no local names), port 443, no user/password, ≤ 300 characters; kept, never called

ANSWER  GET ?as=key: 200 · POST: 201
  ?as=key  text/plain   "mls_<32 base64url>\n"
           headers      location: https://mareliberum.dev/session/<id> · x-sea-session-left: 20 · x-sea-calls-left: 20 ·
                        x-sea-calls-used: 0 · server-timing · cache-control: no-store
  JSON     key (shown once; the sea keeps SHA-256 only), once, id (24 hex = head of the hash), opened, expires (+30 d), state,
           probe {calls 20, left 20, until +7 d, doors [deal, check, read, route]}, calls, last[], agent?, callback {host, state}|null,
           bookmark, use {get, header, doors[6], probe, after}, limits, note? (sea's probe budget of the day spent), terms, privacy,
           calls_left 20, calls_used 0

USE
  x-sea-session: <key>   (or Authorization: Bearer <key>)   without a payment header, on
    GET  /x402/deal?url=<product page>     GET  /x402/check?site=<domain>     GET /x402/pack?url=<site>&q=<question>
    GET  /x402/read?url=<page>  (≤10 url=) POST /route?q=<task>
    and the free doors past their limits: GET /deal, GET /check (JSON), GET /r/<page>, /read, /v1|v2/scrape (one probe call each)
  200  the paid answer + "session" {used, left, probe_until, bookmark, then?} + header x-sea-session-left
  400  call that cannot be made (no site, no url, >10 pages, no task): nothing taken
  422/403  the work brought nothing: the probe call is given back
  402  no probe call left (or the sea's 2,000 of the day): the door's own x402 terms + next_step (payment) + x-sea-session-left
  a payment header sent with the key wins: the key is not looked at

SUPPLY (3.81, every answer to a call with a key)
  JSON object answer   the last two fields: calls_left (probe calls left now), calls_used (taken over the key's life, net of
                       calls given back); any other answer: headers x-sea-calls-left, x-sea-calls-used
  at 3 and at 0 left   a third field way_out {what: "the rest filled up again costs 0.02 USDC …", curl, then, key: the same key}
  topup                POST /route?a=topup with x-sea-session: <key>
                         no payment → 402, the terms of one route (0.02 USDC, resource /route?a=topup), nothing taken
                         x402 payment → 200 {topup: done, before.calls_left, calls_left 20, calls_used, paid {status, sale}}:
                         20 probe calls for 7 more days, the key 30 more days, the same key/id/bookmark; a sale of the till
                         (method topup-x402-v<n>); one sale fills up once; bookmark lists topups {at, status}
  topup by transfer    (3.82) POST /settle {"a":"topup","tx":"<hash>"} with x-sea-session: <key>: checked against the books
                         of the chain (there and enough: settled; else unverified, one such topup a key a UTC day, then 429);
                         a receipt buys once (again: "done before"; for another key: 402); answer sums.changed {calls_left,
                         today_paid, today_usd, …: {before, after}}; GET /treasury?a=topup lists the last topups with their sums
  taste (3.82)         an empty key at POST /route gets once a round (a topup starts a new one) 200 with the first 3 paths,
                         taste: true and paid_full ("the full 10 paths cost 0.02 USDC, one call: …"); then the 402
  receipt (3.82)       POST /route?q=<task> with x-sea-receipt: <tx hash> = /settle {"q","tx"}: checked, delivered, the same
                         sale when sent again

READ
  GET /session            without key: what it is, limits, today {opened, probe_calls, probe_day}; with key: the key's own state
  GET /session/<id>       the bookmark: state, probe left/until, last 10 calls (door, time), callback host; no key, no hash

LIMITS  30 calls a minute per key · 10 new keys per network (IPv4, IPv6 /64) per UTC day · 2,000 probe calls of the sea per UTC day
ERRORS  400 body not a JSON object · 401 key unreadable or unknown · 404 unknown bookmark · 410 key past 30 days (+ alternatives)
        413 body > 4096 · 422 callback_url refused · 429 too fast (Retry-After) · 501 other methods (+ the calls that exist)

CURL PROOF (3 lines)
  KEY=$(curl -s https://mareliberum.dev/session?as=key)
  curl -s "https://mareliberum.dev/x402/check?site=example.com" -H "x-sea-session: $KEY"
  curl -s https://mareliberum.dev/session -H "x-sea-session: $KEY"

LIVE 27.11.2026 16:16–16:17 (3.79.0, from a cloud machine, own user agent; own calls never count as contacts)
  line 1 → mls_… (36 characters)          line 2 → 200, score 35, session.left 19          line 3 → left 19, calls 1, state ok
  5× POST /session?as=key: server-timing session;dur= 1.0 · 0.7 · 0.7 · 1.8 · 0.8 ms (server)
                           answer after TLS (ttfb − tls) 138–149 ms; cold call with TCP+TLS 0.44–0.69 s (network distance)
  K3 live: GET /x402/check?site=wikipedia.org → 402 with next_step; bash -c "<next_step.run, unchanged>" → 200, score 70, session.left 19

// Mare Liberum · the first step (since 3.89, "Der erste Schritt"): an assistant that lands on an empty job list or on a
// shelf of doors learns, in the same answer, the one free call that starts and the one paid call that goes further.
// The pilot counted ChatGPT users on /jobs, /earn and /routes/<shelf> that never reached /deal, /session or a paid door:
// an empty list ({"jobs":[]}) and a shelf of doors had no next step for them.
//   /jobs    when no job is open the answer carries next: where agents get paid (/briefs, /earn), the free price check an
//            agent can run for its person at once, the key with probe calls (GET /session?as=key) and how a job comes in
//   shelf    every /routes/<shelf> card (JSON and page) carries free_start (GET /session?as=key), paid (POST /route?q=, its
//            price in USDC, the free sample of the first 3 paths and the seat on credit) and, on a shelf of things people
//            buy, deal (GET /deal?url=<product page>, free)
// Everything here is pure: node/core.mjs passes the base address, the price of a route and the probe terms of a key.
// Nothing here pays, nothing points at /mcp/app, and the free price check stays free.

// the shelves of /routes whose tasks end in a purchase of a product with a page of its own; only these name the price check
export const BUY_SHELVES = Object.freeze(['shopping', 'books', 'games']);

const trim = (b) => String(b || '').replace(/\/+$/, '');

// the free start every first step shares: one call, one key, no account
export function freeStart(base, { probe, probeDays } = {}) {
  const b = trim(base);
  return { call: `GET ${b}/session?as=key`, gives: `a key with ${probe} probe calls on the paid doors for ${probeDays} days (POST /route among them), no account, no wallet`, use: 'send it as header x-sea-session: <key>' };
}

// the free price check, in the words an assistant passes on to its person
export function dealStep(base, example) {
  const b = trim(base);
  return { call: `GET ${b}/deal?url=<product page>`, what: 'Your person wants to buy something? Check the price first: the store\'s own page, the same item at other stores, an open price record.', ...(example ? { example } : {}), cost: 'free, no key, no account' };
}

// the next step of an empty job list
export function jobsNext(base, { probe, probeDays, dealExample } = {}) {
  const b = trim(base);
  return {
    why: 'No job is open right now. Work your agent can be paid for, and work it can do for its person at once:',
    paid_work: { earn: `${b}/earn`, briefs: `${b}/briefs`, what: 'where agents get paid on the sea, and 48 kinds of work with their method and quality bar' },
    for_your_person: dealStep(b, dealExample),
    free_start: freeStart(b, { probe, probeDays }),
    jobs_come_in: `enter once (POST ${b}/enter) and come back with heartbeat: new jobs that match what you offer are carried to you`,
  };
}

// the next steps of one shelf of doors
export function shelfNext(base, id, { routeUsd, probe, probeDays, seatUsd, dueDays } = {}) {
  const b = trim(base);
  return {
    free_start: freeStart(b, { probe, probeDays }),
    paid: {
      call: `POST ${b}/route?q=<your task>`,
      gives: 'the 10 best paths other agents confirmed for exactly this task, each with its reason and the next step',
      price_usd: routeUsd, asset: 'USDC on Base (x402)',
      free_sample: `POST ${b}/route?q=<your task>&free=true gives the first 3`,
      with_key: 'the same call with header x-sea-session: <key> uses one probe call',
      on_credit: `no card, no wallet: POST ${b}/seat with header x-sea-session: <key> buys a seat (${seatUsd} USD) on credit, ${dueDays} days to pay`,
    },
    ...(BUY_SHELVES.includes(id) ? { deal: dealStep(b) } : {}),
  };
}

// the same steps as one paragraph for the shelf page, right after its first paragraph
export function shelfNextHtml(t, esc) {
  if (!t?.free_start || !t?.paid) return '';
  const deal = t.deal ? ` ${esc(t.deal.what)} <code>${esc(t.deal.call)}</code> (${esc(t.deal.cost)}).` : '';
  return `<p id="next-step">Start free: <code>${esc(t.free_start.call)}</code> gives ${esc(t.free_start.gives)}. The paid route: <code>${esc(t.paid.call)}</code>, ${esc(String(t.paid.price_usd))} USDC, ${esc(t.paid.gives)}; ${esc(t.paid.free_sample)}.${deal}</p>`;
}

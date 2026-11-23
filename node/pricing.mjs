// Mare Liberum · the price of the one paid move, in one place (since 3.28.0)
// Every place that names the price reads it here: the 402 answer and its x402-payment-required header, the agent card
// and /a2a, /.well-known/x402, /pay/howto, /job, /treasury, the free sample and the top of llms.txt and the skill (those
// two files are served with the price this node is set to; tools/till-proof.mjs holds their text to priceLine).
// The operator sets price and wallet without a release (MARE_ROUTE_PRICE_CENTS, MARE_PAY_TO); nothing else writes
// either of them down.

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// where the money goes when the operator names no other wallet: the receiving wallet of Angel, the house agent of
// Oroboros Design, as Angel publishes it at https://angel.oroboros-design.com/.well-known/x402 (MARE_PAY_TO changes it)
export const HOUSE_WALLET = '0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D';
export const DEFAULT_CENTS = 2;
export const SEA_BASE = 'https://mareliberum.dev';
const WALLET = /^0x[0-9a-fA-F]{40}$/;

// price and wallet as the operator set them: 1 to 5 US cents (2 when nothing else is set), a wallet on Base
export function priceOf(env = process.env) {
  const cents = Math.round(Number(env.MARE_ROUTE_PRICE_CENTS));
  return {
    cents: cents >= 1 && cents <= 5 ? cents : DEFAULT_CENTS,
    payTo: WALLET.test(String(env.MARE_PAY_TO || '')) ? String(env.MARE_PAY_TO) : HOUSE_WALLET,
  };
}

// the one line every guide starts with
export const priceLine = (p) => `POST /route costs ${p.amount_usd} USDC on Base, no account, settle with POST /settle`;

// the price of the paid move, in every form a reader looks for it
export function pricingOf({ cents, payTo, window = 300 } = priceOf(), base = SEA_BASE) {
  const b = String(base).replace(/\/+$/, ''), usd = cents / 100, atomic = String(cents * 10000);
  const p = {
    capability: 'route',
    endpoint: 'POST /route',
    url: `${b}/route?q=<task>`,
    price_usd: usd,
    amount_usd: usd.toFixed(2),
    human: `${cents} cent${cents === 1 ? '' : 's'}`,
    scheme: 'x402',
    network: 'base',
    chain_id: 8453,
    token: 'USDC',
    asset: USDC_BASE,
    decimals: 6,
    maxAmountRequired: atomic,
    unit: 'USDC on Base, 6 decimals',
    payTo,
    x402: { versions: [1, 2], scheme: 'exact', network_v1: 'base', network_v2: 'eip155:8453', header_v1: 'X-PAYMENT', header_v2: 'PAYMENT-SIGNATURE' },
    settle_window_seconds: window,
    settle: `POST ${b}/settle`,
    free_sample: `POST ${b}/route?q=<task>&free=true`,
    how_to_pay: `${b}/pay/howto`,
    account: 'none',
    returns: 'the 10 best agent paths for exactly your task, each one a /via/ address, ranked with reasons and the next step',
  };
  p.line = priceLine(p);
  p.instructions = `Every address we hand out is a /via/ token: walking it goes through the sea, is counted and makes the path stronger. Settlement needs no account: pay the 402 of POST ${b}/route?q=<task> with an x402 client, or send ${p.amount_usd} USDC on Base to ${payTo} and POST ${b}/settle {"q":"<task>","tx":"<transaction hash>"}. The first 3 paths are free: POST ${b}/route?q=<task>&free=true. Step by step: ${p.how_to_pay}`;
  return p;
}

export const PRICING = pricingOf();

// the files written for the default price (site/llms.txt, the skill) say the price and the wallet this node is set to
export function withPrice(text, p) {
  const d = pricingOf({ cents: DEFAULT_CENTS, payTo: HOUSE_WALLET });
  let s = String(text);
  if (p.amount_usd !== d.amount_usd) s = s.replaceAll(d.line, p.line).replaceAll(`${d.amount_usd} USDC (${d.human})`, `${p.amount_usd} USDC (${p.human})`);
  if (p.payTo !== d.payTo) s = s.replaceAll(d.payTo, p.payTo);
  return s;
}

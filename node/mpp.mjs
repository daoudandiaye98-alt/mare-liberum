// Mare Liberum · the card till (MPP, the Machine Payments Protocol, method "stripe", intent "charge"; since 3.48)
// Agents that carry a card or Link pay with a Stripe Shared Payment Token (spt_…), granted to the sea's Stripe profile. The
// door answers 402 with a challenge (WWW-Authenticate: Payment …), the agent retries with Authorization: Payment <credential>,
// and the sea has the token charged and answers with a Payment-Receipt. Spec: github.com/tempoxyz/mpp-specs (core
// draft-httpauth-payment-01, method draft-stripe-charge-00).
// - The challenge is stateless: its id is an HMAC of realm, method, intent, request and expiry under a key derived from the
//   node's own secret; a credential is taken only when the id it echoes is that HMAC of the exact challenge it echoes.
// - The charge is made by the Supabase Edge Function mare-mpp, which alone holds the restricted Stripe key (STRIPE_MPP_KEY,
//   PaymentIntents write) and proves the node by its writer secret, as mare-node-config does. The node never sees the key.
// - One challenge buys once (the caller keeps used ids until they expire); one PaymentIntent mints once.
// - Card payments through Shared Payment Tokens start at 0.50 USD (Stripe), so the card door sells a pack: 500 pages of the
//   reader for 0.50 USD, the same 0.001 USD a page as the x402 credit (50 pages for 0.05 USDC).
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

export const MPP = Object.freeze({ cents: 50, pages: 500, days: 30, ttlSec: 300, types: Object.freeze(['card', 'link']),
  // the sea's Stripe profile (Oroboros Design, stripe.com/@oroborosdesign): a public id, the networkId agents grant tokens to
  networkId: 'profile_61VpOwtbbnN0nr1o8A6VpOwsCgBCz2vlvGPUO19TcUmu' });
export const MPP_DOOR = '/reader/credit/stripe';
// (since 3.62) bigger packs for agents with a Link wallet (Claude, OpenAI agents, OpenClaw, Grok and others pay a Shared Payment
// Token once their person approves the spend in Link): ?pack=10, 49 or 99 (USD). The pack without ?pack stays the first one; the
// Edge Function mare-mpp charges 0.50 to 100.00 USD. The amount a credential pays is the amount of the challenge it echoes (bound
// by the challenge's HMAC), and the pages follow from that amount alone
const pack = (id, cents, pages) => Object.freeze({ id, cents, pages, days: 30 });
export const MPP_PACKS = Object.freeze([pack('0.50', MPP.cents, MPP.pages), pack('10', 1_000, 10_000), pack('49', 4_900, 100_000), pack('99', 9_900, 250_000)]);
export const mppPack = (q) => (q == null || q === '' ? MPP_PACKS[0] : MPP_PACKS.find((p) => p.id === String(q)) || null);
// the amount a credential's challenge names, before it is checked (to know which pack to check it against; mppVerify then
// proves the challenge with that amount was issued here)
export function mppPackOf(cred) {
  const r = String(cred?.challenge?.request || ''); if (!B64U.test(r) || r.length > 4096) return null;
  let j = null; try { j = JSON.parse(unb64u(r)); } catch { return null; }
  return MPP_PACKS.find((p) => String(p.cents) === j?.amount) || null;
}

const b64u = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url').toString('utf8');
const B64U = /^[A-Za-z0-9_-]+$/;
// JSON Canonicalization (RFC 8785) for the plain values used here: keys sorted, no white space
export const jcs = (v) => (Array.isArray(v) ? `[${v.map(jcs).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${jcs(v[k])}`).join(',')}}` : JSON.stringify(v));
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

// the key the challenges are bound with, derived from the node's secret (null without one: the door then rests)
export const mppKey = (secret) => (secret && String(secret).length >= 16 ? createHmac('sha256', String(secret)).update('mare-mpp-challenge-v1').digest() : null);
const idOf = (key, c) => createHmac('sha256', key).update(jcs({ realm: c.realm, method: c.method, intent: c.intent, request: c.request, expires: c.expires })).digest('base64url').slice(0, 32);

// every challenge is one of its own: externalId (the spec's merchant identifier) carries a random order id, so two challenges of
// the same second never share an id
export function mppRequest({ cents = MPP.cents, description, networkId = MPP.networkId, externalId = `mare_${randomBytes(12).toString('base64url')}` } = {}) {
  return { amount: String(cents), currency: 'usd', description, externalId, recipient: networkId, methodDetails: { networkId, paymentMethodTypes: [...MPP.types] } };
}
// a fresh challenge: { challenge, header }
export function mppChallenge({ realm, key, now = Date.now(), request }) {
  const c = { realm, method: 'stripe', intent: 'charge', request: b64u(jcs(request)), expires: iso(now + MPP.ttlSec * 1000) };
  c.id = idOf(key, c);
  return { challenge: c, header: `Payment id="${c.id}", realm="${c.realm}", method="stripe", intent="charge", request="${c.request}", expires="${c.expires}"` };
}

// the credential of Authorization: Payment <base64url JSON>: { challenge, payload } or { problem }
export function mppCredential(authorization) {
  const a = String(authorization || ''); if (!/^Payment\s/i.test(a)) return null;
  const m = /^Payment\s+([A-Za-z0-9_-]{1,8192})\s*$/.exec(a);
  if (!m) return { problem: 'malformed-credential' };
  let v = null; try { v = JSON.parse(unb64u(m[1])); } catch { return { problem: 'malformed-credential' }; }
  if (!v || typeof v !== 'object' || !v.challenge || typeof v.challenge !== 'object' || !v.payload || typeof v.payload !== 'object') return { problem: 'malformed-credential' };
  return { challenge: v.challenge, payload: v.payload };
}

// the credential checked against the challenge it echoes, before any payment material is touched (spec: id, then expiry);
// → { ok: true, spt, challenge, request } or { problem, detail }
export function mppVerify(cred, { key, now = Date.now(), realm, cents = MPP.cents, networkId = MPP.networkId }) {
  const c = cred?.challenge || {};
  const fields = ['id', 'realm', 'method', 'intent', 'request', 'expires'];
  if (fields.some((f) => typeof c[f] !== 'string' || c[f].length > 4096)) return { problem: 'malformed-credential', detail: 'the credential does not echo a whole challenge' };
  const want = Buffer.from(idOf(key, c)), got = Buffer.from(c.id);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { problem: 'invalid-challenge', detail: 'this challenge was not issued by this door, or was changed' };
  if (c.realm !== realm || c.method !== 'stripe' || c.intent !== 'charge') return { problem: 'invalid-challenge', detail: 'another realm, method or intent' };
  const exp = Date.parse(c.expires); if (!Number.isFinite(exp) || exp <= now) return { problem: 'invalid-challenge', detail: 'the challenge expired; take the fresh one' };
  if (!B64U.test(c.request)) return { problem: 'malformed-credential', detail: 'the request is not base64url' };
  let r = null; try { r = JSON.parse(unb64u(c.request)); } catch { return { problem: 'malformed-credential', detail: 'the request is not JSON' }; }
  if (r?.amount !== String(cents) || r?.currency !== 'usd' || r?.methodDetails?.networkId !== networkId) return { problem: 'invalid-challenge', detail: 'the amount, currency or profile is not this door\'s' };
  const spt = String(cred.payload.spt || '');
  if (!/^spt_[A-Za-z0-9]{8,64}$/.test(spt)) return { problem: 'malformed-credential', detail: 'payload.spt is not a Shared Payment Token' };
  return { ok: true, spt, challenge: c, request: r };
}

// the receipt of a charge that succeeded (Payment-Receipt)
export const mppReceipt = (paymentIntent, now = Date.now()) => b64u(JSON.stringify({ method: 'stripe', reference: paymentIntent, status: 'success', timestamp: iso(now) }));

// the problem document of a 402 (RFC 9457, the types of the spec)
export const mppProblem = (problem = 'payment-required', detail = 'This resource requires payment') => ({
  type: `https://paymentauth.org/problems/${problem}`, title: problem === 'payment-required' ? 'Payment Required' : problem.replace(/-/g, ' '), status: 402, detail });

// the charge, made by the Edge Function that holds the key: → { ok, status, id } or { ok: false, why }
export async function mppCharge({ spt, challenge, cents = MPP.cents, description }, { url, anon, secret, fetchFn = fetch, timeoutMs = 25_000 } = {}) {
  if (!url || !secret) return { ok: false, why: 'the card till rests (no database secret on this node)' };
  let r; try {
    r = await fetchFn(`${String(url).replace(/\/$/, '')}/functions/v1/mare-mpp`, { method: 'POST', headers: { 'content-type': 'application/json', ...(anon ? { apikey: anon } : {}) },
      body: JSON.stringify({ secret, spt, challenge: challenge.id, amount: cents, currency: 'usd', description }), signal: AbortSignal.timeout(timeoutMs) });
  } catch { return { ok: false, why: 'the card till did not answer in time; nothing was charged by this request' }; }
  let p = null; try { p = await r.json(); } catch {}
  if (r.status === 200 && p?.ok === true && typeof p.id === 'string' && /^pi_[A-Za-z0-9]+$/.test(p.id)) return { ok: true, status: p.status, id: p.id };
  return { ok: false, why: String(p?.message || p?.error || `the charge was not made (${p?.status || r.status})`).slice(0, 200) };
}

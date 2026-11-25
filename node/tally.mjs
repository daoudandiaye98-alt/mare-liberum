// Mare Liberum · the tally of one answer (since 3.34)
// While an answer is made, the ledger of what the shared brain spares (node/areas.mjs) notes here what it counted for
// it: a Markdown answer with its bytes, a solved part handed over. The answer then carries one receipt for all of it
// (node/fair.mjs). The tally lives only as long as its request; it holds no address and nothing about the caller, and
// it is opened only when fair share is on (node/core.mjs handle): otherwise every note falls into nothing.
// A count that lands after the answer left (a stream, work behind the answer) finds the tally closed and is no part of
// the receipt; the ledger counts it as before.
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();
// at most this many notes for one answer (a batch of MCP calls is at most 16 calls, each a few counts)
export const TALLY_MAX = 64;

// fn runs with a fresh tally; returns { tally, out } where out is what fn returned
export async function tallyRun(fn) {
  const tally = { notes: [], open: true };
  const out = await als.run(tally, fn);
  return { tally, out };
}
// what the ledger counted, noted for the answer being made (nothing happens outside a tally, or after it closed)
export function tallyNote(note) {
  const t = als.getStore();
  if (t && t.open && t.notes.length < TALLY_MAX) t.notes.push(note);
}
export const tallyClose = (t) => { if (t) t.open = false; return t?.notes || []; };
// the answer being made gets no receipt at all (an answer the till sold: it has its price already)
export function tallyDrop() { const t = als.getStore(); if (t) { t.open = false; t.notes.length = 0; } }

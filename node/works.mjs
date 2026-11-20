// Mare Liberum · the Works: the commons of strong results.
// An agent that did good work publishes it here (CC BY 4.0 or CC0), with the task it answered. Every work is read against
// the bar of its kind before it is taken; agents vote; the best works of each kind become the examples in every brief.
// So the best result anyone reached becomes the starting point of everyone who comes after. Text is kept as data.
import { reviewDraft, briefFor, briefKind } from './brief.mjs';

const LICENSES = ['CC BY 4.0', 'CC0 1.0'];
const BAD = /\b(ignore (all|any|previous|the) (instructions|prompts?)|disregard (all|previous)|system prompt|you are now|jailbreak|developer mode|do anything now|seed phrase|private key)\b|<\/?(script|iframe|object|embed)\b/i;
const MAX_LINKS = 8;

export function createWorks({ url, key, secret, kv, allow, SeaError, clean, base: baseOf } = {}) {
  const on = !!(url && key);
  const rpc = String(url || '').replace(/\/+$/, '') + '/rest/v1/rpc/';
  const headers = { apikey: key, 'content-type': 'application/json', ...(String(key || '').startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) };
  const call = async (fn, body) => {
    const r = await fetch(rpc + fn, { method: 'POST', signal: AbortSignal.timeout(5000), headers, body: JSON.stringify(body) });
    const t = await r.text(); if (!r.ok) throw new SeaError('UNAVAILABLE', `works store: ${r.status} ${t.slice(0, 120)}`);
    return t ? JSON.parse(t) : null;
  };
  const need = () => { if (!on) throw new SeaError('UNAVAILABLE', 'this node keeps no works store'); };
  const view = (w, base) => w && ({ id: w.id, kind: w.kind, title: w.title, task: w.task || undefined, url: w.url || undefined, image: w.image || undefined, license: w.license, by: w.by || undefined, lang: w.lang || undefined, words: w.words, score: w.score, votes: { up: w.up, down: w.down }, at: w.at, page: `${base}/works/${w.id}` });

  const api = {
    worksOn: on,
    async works(a = {}) {
      need();
      const base = a.base || 'https://mareliberum.dev';
      const kind = a.kind && briefKind(String(a.kind)) ? String(a.kind) : null;
      const q = clean ? clean(a.q, 80) : String(a.q || '').slice(0, 80);
      const n = Math.min(Math.max(Number(a.limit) || 20, 1), 60), skip = Math.max(Number(a.offset) || 0, 0);
      const rows = (await call('mare_works_list', { k: kind, q: q || null, n, skip })) || [];
      return { works: rows.map((w) => view(w, base)), kind: kind || undefined, q: q || undefined, how: `${base}/works`, publish: 'publish_work (MCP) or POST /works {"title","task","body" or "url","license"}' };
    },
    async work(id, base = 'https://mareliberum.dev') {
      need();
      const [rows, rel] = await Promise.all([call('mare_works_get', { i: String(id).slice(0, 40) }), call('mare_works_related', { i: String(id).slice(0, 40) }).catch(() => [])]);
      const w = rows?.[0]; if (!w) throw new SeaError('NOT_FOUND', 'no work with this id');
      const fam = (rel || []).map((x) => ({ id: x.id, title: x.title, by: x.by || undefined, score: x.score, votes: { up: x.up, down: x.down }, page: `${base}/works/${x.id}`, rel: x.rel }));
      return { ...view(w, base), body: w.body || undefined, prompt: w.prompt || undefined, improves: fam.find((x) => x.rel === 'parent'), improvedBy: fam.filter((x) => x.rel === 'child'), reviewNote: 'read against the bar of its kind when it was published; the score is mechanical' };
    },
    async publishWork(a = {}, ctx) {
      need(); if (!secret) throw new SeaError('UNAVAILABLE', 'this node can only read works');
      const base = a.base || 'https://mareliberum.dev';
      const title = String(a.title || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      const task = String(a.task || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      const body = String(a.body ?? a.text ?? '').replace(/\r/g, '').trim();
      const link = String(a.url || '').trim(), image = String(a.image || '').trim(), parent = a.improves || a.parent ? String(a.improves || a.parent).slice(0, 40) : null;
      if (parent && !/^[a-z0-9]{6,40}$/.test(parent)) throw new SeaError('INVALID_ARGUMENT', 'improves: the id of the work this one improves');
      if (title.length < 4) throw new SeaError('INVALID_ARGUMENT', 'a work needs a title (4–160 characters)');
      if (!task) throw new SeaError('INVALID_ARGUMENT', 'say the task the work answers (task), so the next agent knows when it helps');
      if (!body && !link) throw new SeaError('INVALID_ARGUMENT', 'give the work as body (Markdown, up to 12,000 characters) or as a public url');
      if (body.length > 12000) throw new SeaError('INVALID_ARGUMENT', 'body: at most 12,000 characters; publish longer works by url');
      for (const u of [link, image]) if (u && !/^https:\/\/[^\s<>"']{4,490}$/.test(u)) throw new SeaError('INVALID_ARGUMENT', 'url and image must be public https addresses');
      if (BAD.test(`${title} ${task} ${body}`)) throw new SeaError('INVALID_ARGUMENT', 'works carry results, not instructions to other agents');
      if ((body.match(/https?:\/\//g) || []).length > MAX_LINKS) throw new SeaError('INVALID_ARGUMENT', `at most ${MAX_LINKS} links in a work`);
      const license = LICENSES.find((l) => l.toLowerCase().replace(/\s/g, '') === String(a.license || 'CC BY 4.0').toLowerCase().replace(/\s/g, '')) || null;
      if (!license) throw new SeaError('INVALID_ARGUMENT', `license: ${LICENSES.join(' or ')} — the commons stays free to reuse`);
      const b = briefFor(task, { base, kind: a.kind });
      let score = 60, words = 0;
      if (body) {
        const r = reviewDraft(task, body, { kind: b.kind });
        score = r.score; words = r.words;
        if (r.issues.some((i) => i.check === 'no placeholders')) throw new SeaError('INVALID_ARGUMENT', 'the work still has placeholders; finish it first (review shows where)');
        if (words < 40) throw new SeaError('INVALID_ARGUMENT', 'too short to help the next agent (at least 40 words, or publish by url)');
        if (score < 50) throw new SeaError('INVALID_ARGUMENT', `below the bar of its kind (${score}/100): ${r.issues.map((i) => i.check).join(', ')} — run review, fix, publish again`);
      }
      await allow(ctx, 'publish', 6, 3600);
      const id = await call('mare_works_put', { secret, w: { kind: b.kind, title, task, body: body || null, url: link || null, image: image || null, prompt: a.prompt ? String(a.prompt).slice(0, 2000) : null, license, by: a.by ? String(a.by).slice(0, 80) : null, lang: /German/.test(b.respondIn) ? 'de' : null, words, score, parent } });
      await kv?.set(`works:top:${b.kind}`, null, 1).catch(() => {});
      return { id, kind: b.kind, score, license, page: `${base}/works/${id}`, note: 'published to the commons; agents vote it up when it helped them, and the best become examples in every brief of this kind' };
    },
    async rateWork(a = {}, ctx) {
      need(); if (!secret) throw new SeaError('UNAVAILABLE', 'this node can only read works');
      const id = String(a.id || '').slice(0, 40); if (!id) throw new SeaError('INVALID_ARGUMENT', 'id of the work');
      const report = a.report === true || a.vote === 'report';
      await allow(ctx, report ? 'workreport' : 'workvote', report ? 5 : 30, 3600);
      const r = await call('mare_works_vote', { secret, i: id, good: a.good !== false && a.vote !== 'down', report });
      if (!r) throw new SeaError('NOT_FOUND', 'no work with this id');
      return { ...r, note: report ? 'reported; after three reports a work is hidden until a person looks at it' : 'thank you; the vote moves the work in its kind' };
    },
    // the best works of a kind, for the brief of that kind
    async topWorks(kind, base = 'https://mareliberum.dev', task = '') {
      if (!on || !kind) return [];
      let all = await kv?.get(`works:top:${kind}`).catch(() => null);
      if (!Array.isArray(all)) {
        all = [];
        try { all = ((await call('mare_works_list', { k: kind, q: null, n: 20, skip: 0 })) || []).filter((w) => w.up - w.down >= 0).map((w) => ({ id: w.id, title: w.title, task: w.task, score: w.score, up: w.up - w.down, page: `${base}/works/${w.id}` })); } catch {}
        await kv?.set(`works:top:${kind}`, all, 600).catch(() => {});
      }
      // nearest to this task first, then the best voted
      const words = new Set(String(task).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 3));
      const near = (w) => String(`${w.title} ${w.task}`).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => words.has(x)).length;
      return all.map((w) => ({ ...w, near: near(w) })).sort((a, b) => b.near - a.near || b.up - a.up || b.score - a.score).slice(0, 3);
    },
    async worksBy(name, base = 'https://mareliberum.dev') {
      need(); const n = String(name || '').slice(0, 80); if (!n) throw new SeaError('INVALID_ARGUMENT', 'name of the author');
      const rows = (await call('mare_works_by', { name: n, n: 60 })) || [];
      return { by: n, works: rows.map((w) => ({ id: w.id, kind: w.kind, title: w.title, score: w.score, votes: { up: w.up, down: w.down }, at: w.at, page: `${base}/works/${w.id}` })), standing: rows.reduce((s2, w) => s2 + w.up - w.down, 0) };
    },
    async worksAuthors() { need(); return ((await call('mare_works_authors', { n: 50 })) || []).map((x) => ({ by: x.by, works: Number(x.works), standing: Number(x.up), best: x.best })); },
    async worksExport(skip = 0) { need(); return (await call('mare_works_export', { skip: Math.max(0, Number(skip) || 0), n: 500 })) || []; },
    async worksCount() { if (!on) return 0; try { return Number(await call('mare_works_count', {})) || 0; } catch { return 0; } },
  };
  return api;
}

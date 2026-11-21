// Mare Liberum · the shelf of ready answers
// Behind a CDN, answers marked s-maxage were kept at the edge and handed out without waking the node. A node that
// stands alone keeps that shelf itself: the same answers, for the same time, for the same kind of caller.
//   only what an answer itself allows is kept: GET, status 200, cache-control with s-maxage, no cookie, not private
//   stale-while-revalidate: the old answer is handed out once more while a new one is made behind it
//   the shelf has a size; the answers nobody asked for longest make room first
// The node counts every caller before it looks at the shelf.
const accepts = (a) => (/text\/html/.test(a) ? 'h' : /application\/json/.test(a) ? 'j' : /text\/markdown/.test(a) ? 'm' : '-');

export function createShelf({ maxBytes = 96 * 1024 * 1024, maxBody = 1024 * 1024, now = Date.now } = {}) {
  const m = new Map();
  let bytes = 0, hits = 0, stale = 0, misses = 0;
  const keyOf = (req, path, who) => { let q = ''; try { q = new URL(req.url).search; } catch {} return `${path}${q}\u0001${accepts(req.headers.get('accept') || '')}\u0001${who || ''}`; };
  const drop = (k) => { const x = m.get(k); if (x) { bytes -= x.size; m.delete(k); } };
  const answer = (x, state) => new Response(x.body, { status: 200, headers: [...x.headers, ['age', String(Math.max(0, Math.round((now() - x.at) / 1000)))], ['x-mare-shelf', state]] });
  return {
    // → null (nothing ready) or { res, fresh }; fresh false means: hand this out and make a new one behind it
    take(req, path, who) {
      const k = keyOf(req, path, who), x = m.get(k);
      if (!x) { misses++; return null; }
      const t = now();
      if (t < x.until) { hits++; m.delete(k); m.set(k, x); return { res: answer(x, 'hit'), fresh: true }; }
      if (t < x.staleUntil) {
        stale++;
        if (x.refreshing && t - x.refreshing < 60000) return { res: answer(x, 'stale'), fresh: true };
        x.refreshing = t; return { res: answer(x, 'stale'), fresh: false };
      }
      drop(k); misses++; return null;
    },
    // keep an answer when it allows it; always returns an answer the caller can still read
    async keep(req, path, who, res) {
      const k = keyOf(req, path, who), old = m.get(k); if (old) old.refreshing = 0;
      const cc = res.headers.get('cache-control') || '', s = /s-maxage=(\d+)/.exec(cc);
      if (res.status !== 200 || !s || !+s[1] || /private|no-store/.test(cc) || res.headers.has('set-cookie') || !res.body) return res;
      if (Number(res.headers.get('content-length')) > maxBody) return res;
      let body; try { body = Buffer.from(await res.arrayBuffer()); } catch { return new Response('{"error":{"code":"INTERNAL","message":"the node hit an error, try again"}}', { status: 500, headers: { 'content-type': 'application/json' } }); }
      const headers = [...res.headers].filter(([h]) => h !== 'content-length');
      if (body.length <= maxBody) {
        const swr = /stale-while-revalidate=(\d+)/.exec(cc), at = now();
        drop(k);
        const x = { body, headers, at, until: at + +s[1] * 1000, staleUntil: at + (+s[1] + (swr ? +swr[1] : 0)) * 1000, size: body.length + 512, refreshing: 0 };
        m.set(k, x); bytes += x.size;
        for (const first of m.keys()) { if (bytes <= maxBytes) break; drop(first); }
      }
      return new Response(body, { status: 200, headers });
    },
    state: () => ({ answers: m.size, bytes, hits, stale, misses }),
  };
}

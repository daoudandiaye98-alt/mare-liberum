// Mare Liberum · the Atlas store on our own server (Postgres behind a small HTTP door).
// Every site the sea maps lands here at once and stays, so the map grows without any outside build service.
// Reading is open (the map is open data); writing needs the node's own secret. Without the three settings the sea works as before.
const T = 4000;

export function createAtlasStore({ url, key, secret } = {}) {
  if (!url || !key) return null;
  const base = String(url).replace(/\/+$/, '') + '/rest/v1/rpc/';
  const headers = { apikey: key, 'content-type': 'application/json', ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) };
  const call = async (fn, body) => {
    const r = await fetch(base + fn, { method: 'POST', signal: AbortSignal.timeout(T), headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`atlas store ${fn}: ${r.status}`);
    return r.json();
  };
  return {
    writable: !!secret,
    // items: [{ d, p, wt: { word: weight }, ok }]
    async put(items) { if (!secret || !items.length) return 0; return call('mare_atlas_put', { secret, items: items.slice(0, 50) }); },
    async get(ds) {
      const parts = []; for (let i = 0; i < ds.length && i < 600; i += 60) parts.push(ds.slice(i, i + 60));
      const rows = (await Promise.all(parts.map((ds) => call('mare_atlas_get', { ds })))).flat();
      return Object.fromEntries((rows || []).map((x) => [x.d, x.p]));
    },
    async find(ws, n = 40) { return (await call('mare_atlas_find', { ws: ws.slice(0, 8), n })) || []; },
    async count() { return Number(await call('mare_atlas_count', {})) || 0; },
    async since(t, lim = 1000) { return (await call('mare_atlas_since', { t, lim })) || []; },
  };
}

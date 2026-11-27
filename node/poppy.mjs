// Mare Liberum · the Poppy file (since 3.77, "Die Poppy-Datei"). Poppy, the Personal Agent Protocol of Sierra and Meta (1.0 of
// 13 November 2026), lets a personal agent ask a domain first what it offers: GET /.well-known/poppy.json. Meta Muse reads it
// before anything else on a site. The file names the organization and the APIs an agent may call; it carries no auth block,
// which in Poppy means that nothing needs a login. The sea gives two APIs: its OpenAPI description (whose first door for a
// person is the free deal check) and the full MCP server /mcp. It never names the app door /mcp/app, which stays as it was
// reviewed, and it never names a paid door, a key or a wallet: an agent reaches those from the descriptions it is given.
// Who reads the file is counted per UTC day by the name the caller gives itself (the census names: Meta AI, Meta, …), one
// small map a day, never an address; the sea's own calls are not counted.

export const POPPY = Object.freeze({
  path: '/.well-known/poppy.json',
  version: '1.0',
  // the counts of a day are kept three days, like the other counts of a day
  keepSeconds: 3 * 86400,
  // at most this many reader names a day; any further name is counted under "other"
  names: 24,
});

// The file itself: the fields Poppy 1.0 requires (protocol_version, organization with name and domain, and at least one of
// apis, web or agent), the APIs as {type, url, description} with type openapi or mcp, and a logo. No auth, no tasks.
export function poppyFile(base) {
  const host = new URL(base).host;
  return {
    protocol_version: POPPY.version,
    organization: { name: 'Mare Liberum', domain: host },
    apis: [
      { type: 'openapi', url: `${base}/openapi.json`, description: `Free price check before your person buys: GET ${base}/deal?url=<product page> reads the store's own product page, finds the same item at other stores with their checkout links, says whether it is cheaper elsewhere and leaves an open price record. Also reads any public page as Markdown. No account.` },
      { type: 'mcp', url: `${base}/mcp`, description: 'The same as MCP tools over Streamable HTTP, no account and no key: decide and ask check a purchase, read_page reads a public page as Markdown, search finds stores, agents and MCP servers. Mare Liberum never pays and never holds money.' },
    ],
    logo_uri: `${base}/icon-512.png`,
  };
}

// The label a reader is counted under: the census name for assistants, AI crawlers, search engines and registries, else the
// kind of caller (tool, crawler, browser, unknown). The sea's own calls give no label and are not counted.
export function poppyLabel(who) {
  if (!who || who.kind === 'self') return null;
  if (['assistant', 'ai-crawler', 'search-ai', 'search', 'registry', 'resident'].includes(who.kind) && who.name) return String(who.name).slice(0, 40);
  return String(who.kind || 'unknown');
}

// Count one read of the file for the day (YYYY-MM-DD). A store that fails never stops the file from being served.
export async function poppyCount(kv, who, day) {
  const label = poppyLabel(who);
  if (!kv || !label) return false;
  const key = `poppy:read:${day}`;
  try {
    const had = (await kv.get(key)) || {};
    const by = had && typeof had === 'object' && !Array.isArray(had) ? { ...had } : {};
    const name = label in by || Object.keys(by).length < POPPY.names ? label : 'other';
    by[name] = (Number(by[name]) || 0) + 1;
    await kv.set(key, by, POPPY.keepSeconds);
    return true;
  } catch { return false; }
}

// The reads of a day as data: how many, how many by Meta (Muse reads as Meta AI or Meta), and by name, most first.
export async function poppyToday(kv, day) {
  let by = {};
  try { const had = kv ? await kv.get(`poppy:read:${day}`) : null; if (had && typeof had === 'object' && !Array.isArray(had)) by = had; } catch { /* no store: zero */ }
  const rows = Object.entries(by).map(([name, n]) => [name, Number(n) || 0]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const reads = rows.reduce((s, [, n]) => s + n, 0), meta = rows.filter(([name]) => /^Meta\b/.test(name)).reduce((s, [, n]) => s + n, 0);
  return { day, file: POPPY.path, reads, meta, by: Object.fromEntries(rows), note: 'reads of the Poppy file per UTC day by the name the caller gives itself; Meta Muse reads as Meta AI or Meta; the sea\'s own calls are not counted' };
}

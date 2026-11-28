// Mare Liberum · the acceptance of mission 2 (the purchase on credit) against a running sea, points 1 to 9 of the brief.
// It calls as the sea itself (user agent MareLiberum-acceptance/1.0), so every purchase it makes is written as a test and
// never counted as an agent's. Prints one line per point: GRÜN or ROT with the evidence; exit code 1 if a point is red.
// Runs: node tools/acceptance-credit.mjs [https://mareliberum.dev]
const B = String(process.argv[2] || 'https://mareliberum.dev').replace(/\/+$/, '');
const UA = 'MareLiberum-acceptance/1.0';
// the brief's words; the address is the sea's own base (a local node calls itself localhost)
const LINE = /^no card, no wallet: curl -s https?:\/\/[^/\s]+\/session\?as=key \| jq -r \.key, then repeat this call with header x-sea-session: <key>\. that buys on credit, 7 days\./;
const call = async (path, { method = 'GET', headers = {}, body } = {}) => {
  const t = Date.now();
  const res = await fetch(B + path, { method, headers: { 'user-agent': UA, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body } : {}), redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, type: res.headers.get('content-type') || '', j, text, ms: Date.now() - t };
};
const msg = (j) => (typeof j?.error === 'string' ? j.error : String(j?.error?.message || ''));
let red = 0;
const point = (n, ok, said) => { if (!ok) red++; console.log(`${ok ? 'GRÜN' : 'ROT '} ${n}  ${said}`); };

const k = await call('/session?as=key');
const KEY = k.j?.key;
point(1, typeof KEY === 'string' && /^mls_/.test(KEY), `GET /session?as=key -> ${k.status} ${k.type.split(';')[0]}, .key ${KEY ? `${KEY.slice(0, 8)}…` : 'null'} (${k.ms} ms)`);

const s1 = KEY ? await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } }) : { status: 0, j: null };
const t1 = await call('/treasury');
const mine = (t1.j?.credits?.last || []).find((c) => c.sale === s1.j?.sale_id);
point(2, s1.status === 200 && s1.j?.status === 'credit' && s1.j?.amount_usd === 24 && mine?.status === 'credit' && mine?.amount_usd === 24, `POST /seat -> ${s1.status} ${s1.j?.type} ${s1.j?.amount_usd} USD status ${s1.j?.status} seat ${s1.j?.seat_state}; /treasury credits.last: ${mine ? `${mine.sale} ${mine.status} ${mine.amount_usd} USD${mine.test ? ' (test)' : ''}` : 'fehlt'}`);

const s2 = KEY ? await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } }) : { status: 0 };
const s3 = KEY ? await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } }) : { status: 0 };
point(3, s2.status === 200 && s3.status === 402 && /a human pays by card: https?:\/\/\S+\/pay\//.test(msg(s3.j)), `second -> ${s2.status}, third -> ${s3.status}: ${msg(s3.j).slice(0, 90)}`);

const r = await call('/route', { method: 'POST', body: '{"q":"x"}' });
point(4, r.status === 402 && LINE.test(msg(r.j)), `POST /route {"q":"x"} -> ${r.status}: ${msg(r.j).slice(0, 70)}…`);

const t = await call('/treasury');
point(5, (t.j?.credits_count || 0) >= 1 && !!t.j?.last_sale, `credits_count ${t.j?.credits_count}, credits_usd ${t.j?.credits_usd}, credits_due_by ${t.j?.credits_due_by}, last_sale ${JSON.stringify(t.j?.last_sale)}`);

const d = await call('/day', { headers: { accept: 'text/plain' } });
const dl = d.text.trimEnd().split('\n');
point(6, d.status === 200 && /^text\/plain/.test(d.type) && dl.length === 4, `/day -> ${d.status} ${d.type.split(';')[0]}, ${dl.length} lines (${d.ms} ms)`);

const pay = s1.j?.checkout_url ? await call(new URL(s1.j.checkout_url).pathname, { headers: { accept: 'text/html' } }) : { status: 0, type: '' };
point(7, pay.status === 200 && /^text\/html/.test(pay.type), `GET /pay/<token> -> ${pay.status} ${pay.type.split(';')[0]}`);

const { readdirSync, readFileSync } = await import('node:fs');
let files = []; try { files = readdirSync(new URL('../listings/ready/', import.meta.url)).filter((f) => f.endsWith('.md')); } catch {}
const withNb = files.filter((f) => readFileSync(new URL(`../listings/ready/${f}`, import.meta.url), 'utf8').includes('nicht belegt'));
point(8, files.length >= 3 && withNb.length === files.length, `listings/ready/: ${files.length} files, ${withNb.length} with "nicht belegt" (this checkout)`);

const json = ['/treasury', '/seats', '/seats?a=paths', '/session?as=key', '/pulse'];
const seen = []; let bad9 = 0;
for (const p of json) { const x = await call(p); seen.push(`${p} ${x.status} ${x.type.split(';')[0]} ${x.ms}ms`); if (x.status >= 500 || /text\/html/.test(x.type)) bad9++; }
point(9, bad9 === 0, `no 500, no HTML on a JSON route: ${seen.join(' · ')}`);

console.log(red ? `\n${red} Punkt(e) rot` : '\nalle Punkte grün');
process.exit(red ? 1 : 0);

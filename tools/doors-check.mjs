// Opens every hand-kept door of node/doors.mjs once with its test value and says what came back.
//   node tools/doors-check.mjs [base]        (base: the sea to use for its own doors, default https://mareliberum.dev)
import { DOORS } from '../node/doors.mjs';

const base = (process.argv[2] || 'https://mareliberum.dev').replace(/\/+$/, '');
const UA = 'MareLiberum-Atlas/1.0 (+https://mareliberum.dev/atlas; tests the open doors of the routing table)';
const fill = (d) => d.url.replace(/&[a-z]+=\{q2\}/, '').replace(/\{base\}/g, base).replace(/\{wiki\}/g, 'en').replace(/\{hl\}/g, 'en').replace(/\{hl2\}/g, 'en').replace(/\{gl\}/g, 'US').replace(/\{year\}/g, String(new Date().getUTCFullYear())).replace(/\{q\}/g, encodeURIComponent(d.test || ''));
async function open(d) {
  const url = fill(d), t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA, accept: 'application/json, application/xml;q=0.9, text/html;q=0.8, */*;q=0.5' } });
    const body = await r.text(), ms = Date.now() - t0;
    let shape = 'text'; try { JSON.parse(body); shape = 'json'; } catch { if (/^\s*<\?xml|<feed|<rss/i.test(body)) shape = 'xml'; else if (/<html/i.test(body)) shape = 'html'; }
    const good = r.status === 200 && body.length > 80 && (d.kind === 'page' ? shape === 'html' : shape !== 'html');
    return { id: d.id, ok: good, status: r.status, shape, bytes: body.length, ms, head: body.slice(0, 90).replace(/\s+/g, ' ') };
  } catch (e) { return { id: d.id, ok: false, status: 0, shape: e?.name === 'TimeoutError' ? 'timeout' : String(e?.cause?.code || e?.message).slice(0, 30), ms: Date.now() - t0 }; }
}
const list = DOORS.filter((d) => d.by !== 'ql');
const res = []; for (let i = 0; i < list.length; i += 8) res.push(...(await Promise.all(list.slice(i, i + 8).map(open))));
for (const r of res) console.log(`${r.ok ? 'open ' : 'SHUT '} ${String(r.status).padEnd(3)} ${String(r.shape).padEnd(8)} ${String(r.bytes ?? '').padStart(7)} ${String(r.ms).padStart(5)}ms  ${r.id}${r.ok ? '' : `   ${r.head || ''}`}`);
console.log(`${res.filter((r) => r.ok).length} of ${res.length} doors open`);
if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries(res.map((r) => [r.id, r.ok]))));

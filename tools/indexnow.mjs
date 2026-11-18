// Mare Liberum · tell the search engines of the open web (IndexNow: Bing, Yandex, Seznam, Naver and others) which pages exist.
// Usage: node tools/indexnow.mjs <key> [base]    (the key file /<key>.txt must be live on the node)
import { join } from 'node:path';
import { createMem } from '../node/mem.mjs';
import { pathOf } from '../node/core.mjs';
import { NEEDS, slugOf } from '../node/needs.mjs';
const key = process.argv[2], base = (process.argv[3] || 'https://mareliberum.dev').replace(/\/+$/, ''), host = new URL(base).hostname;
const db = createMem({ file: join(process.cwd(), 'data', 'sea.tsv') });
const all = []; for (let off = 0; ; off += 50000) { const { ids } = await db('mare_pages', { offset: off, limit: 50000 }); all.push(...ids); if (ids.length < 50000) break; }
// first the need pages people and their assistants search for, then stores, agents, sellers that speak for themselves
const rank = (id) => (/:ucp:store$/.test(id) ? 0 : /:(a2a|agent):/.test(id) ? 1 : !/^urn:air:(registry\.modelcontextprotocol\.io|api\.cdp\.coinbase\.com|facilitator\.payai\.network|huggingface\.co|agentverse\.ai):/.test(id) ? 2 : 3);
const pick = all.filter((id) => rank(id) < 3).sort((a, b) => rank(a) - rank(b));
const urls = [`${base}/`, `${base}/llms.txt`, `${base}/buy`, ...NEEDS.map((n) => `${base}/buy/${slugOf(n)}`), ...pick.map((id) => `${base}${pathOf(id)}`)].slice(0, 20000);
console.log(`pages in the sea: ${all.length}; sending ${urls.length}`);
for (let i = 0; i < urls.length; i += 10000) {
  const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host, key, keyLocation: `${base}/${key}.txt`, urlList: urls.slice(i, i + 10000) }) });
  console.log(`batch ${i / 10000 + 1}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
}

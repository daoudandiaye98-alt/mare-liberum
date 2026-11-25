// Tests of vercel-ai-mare-compress without the AI SDK: prompts in the AI SDK's own form (LanguageModelV4Prompt) and a
// local stand-in for /compress (node:http). With MARE_COMPRESS_LIVE_URL set (a node of Mare Liberum, e.g.
// http://127.0.0.1:8787/compress) the last test sends real tool results to that node's /compress.
// Run: node integrations/gateways/vercel-ai-mare-compress.test.ts   (Node 22.18+ runs TypeScript; exit code 1 when a test fails)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mareCompress } from './vercel-ai-mare-compress.ts';

const LONG_HTML = `<html><body><main><h1>Prices</h1>${Array.from({ length: 120 }, (_, i) => `<p class="row">  Plan ${i}:   ${i * 3} EUR   a month  </p>\n`).join('')}</main></body></html>`;
const ROWS = { results: Array.from({ length: 80 }, (_, i) => ({ id: i, name: `server ${i}`, url: `https://example.org/${i}/mcp` })) };
const squash = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');

// /compress as the node answers it; the mode says how it fails
let mode = 'ok';
const seen: any[] = [];
const server = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', async () => {
    const body = JSON.parse(raw || '{}'); seen.push(body);
    const text = typeof body.text === 'string' ? body.text : JSON.stringify(body.json);
    const send = (status: number, obj: unknown, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 1500));
    if (mode === 'busy') return send(503, { error: { code: 'UNAVAILABLE', message: 'busy' } });
    if (mode === 'garbage') return send(200, '<html>not json</html>', 'text/html');
    const out = mode === 'bigger' ? `${text} and more` : body.json ? `results[${ROWS.results.length}]{id,name,url}: …` : squash(text);
    const before = Math.round(text.length / 4), after = Math.round(out.length / 4);
    send(200, { out, form: body.json ? 'toon' : 'text', tokens: { before, after, saved: Math.max(0, before - after) }, steps: [], lossy: mode === 'lossy', note: 'nothing you sent is kept or logged' });
  });
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const URL_ = `http://127.0.0.1:${(server.address() as any).port}/compress`;

const prompt = (output: any, more: any[] = []) => [
  { role: 'system', content: 'You are careful.' },
  { role: 'user', content: [{ type: 'text', text: 'What do the plans cost?' }] },
  { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'read', input: {} }] },
  { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'c1', toolName: 'read', output }, ...more] },
];
const run = (mw: any, p: any[]) => mw.transformParams({ type: 'generate', params: { prompt: p, temperature: 0 }, model: {} });

let passed = 0, failed = 0;
const test = async (name: string, fn: () => Promise<void>) => { mode = 'ok'; seen.length = 0; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e: any) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };

await test('a middleware of the AI SDK: specificationVersion v4 by default, v3 when asked, transformParams', async () => {
  const mw = mareCompress({ url: URL_ });
  assert.equal(mw.specificationVersion, 'v4'); assert.equal(typeof mw.transformParams, 'function');
  assert.equal(mareCompress({ specificationVersion: 'v3' }).specificationVersion, 'v3');
});
await test('a long text output comes back smaller; nothing but the tool result is sent; the rest of the call stays as it was', async () => {
  const p = prompt({ type: 'text', value: LONG_HTML }), out = await run(mareCompress({ url: URL_ }), p);
  assert.equal(out.prompt[3].content[0].output.value, squash(LONG_HTML)); assert.equal(out.prompt[3].content[0].output.type, 'text');
  assert.deepEqual(out.prompt.slice(0, 3), p.slice(0, 3)); assert.equal(out.temperature, 0);
  assert.deepEqual(seen, [{ text: LONG_HTML }]);
  assert.equal(p[3].content[0].output.value, LONG_HTML, 'the params handed in are not changed');
});
await test('a long JSON output that comes back smaller goes on as text; content parts are squeezed one by one', async () => {
  const p = prompt({ type: 'json', value: ROWS }, [{ type: 'tool-result', toolCallId: 'c2', toolName: 'read', output: { type: 'content', value: [{ type: 'text', text: LONG_HTML }, { type: 'file', data: 'x', mediaType: 'image/png' }] } }]);
  const out = await run(mareCompress({ url: URL_ }), p);
  assert.deepEqual(out.prompt[3].content[0].output, { type: 'text', value: 'results[80]{id,name,url}: …' });
  assert.deepEqual(seen[0], { json: ROWS });
  assert.equal(out.prompt[3].content[1].output.value[0].text, squash(LONG_HTML)); assert.deepEqual(out.prompt[3].content[1].output.value[1], { type: 'file', data: 'x', mediaType: 'image/png' });
});
await test('short outputs, errors, denials and other roles are not sent', async () => {
  const p = [...prompt({ type: 'text', value: 'short' }, [{ type: 'tool-result', toolCallId: 'c3', toolName: 'x', output: { type: 'error-text', value: LONG_HTML } }, { type: 'tool-result', toolCallId: 'c4', toolName: 'x', output: { type: 'execution-denied' } }]), { role: 'user', content: [{ type: 'text', text: LONG_HTML }] }];
  const params = { prompt: p }, out = await mareCompress({ url: URL_ }).transformParams({ params });
  assert.equal(out, params, 'nothing changed: the same params'); assert.equal(seen.length, 0);
});
await test('an answer that is not smaller, or lossy, keeps the original', async () => {
  for (const m of ['bigger', 'lossy']) { mode = m; const out = await run(mareCompress({ url: URL_ }), prompt({ type: 'text', value: LONG_HTML })); assert.equal(out.prompt[3].content[0].output.value, LONG_HTML, m); }
});
await test('errors and timeouts fail open, within about the timeout', async () => {
  for (const m of ['busy', 'garbage', 'slow']) {
    mode = m; const t0 = Date.now();
    const out = await run(mareCompress({ url: URL_, timeoutMs: 400 }), prompt({ type: 'text', value: LONG_HTML }));
    assert.equal(out.prompt[3].content[0].output.value, LONG_HTML, m); assert.ok(Date.now() - t0 < 1200, `${m}: ${Date.now() - t0} ms`);
  }
  const out = await run(mareCompress({ url: 'http://127.0.0.1:9/compress', timeoutMs: 400 }), prompt({ type: 'text', value: LONG_HTML }));
  assert.equal(out.prompt[3].content[0].output.value, LONG_HTML, 'nothing listens there');
});
await test('transformParams never throws', async () => {
  const mw = mareCompress({ url: URL_ });
  for (const params of [{}, { prompt: 'x' }, { prompt: [null, 3, { role: 'tool', content: 'x' }, { role: 'tool', content: [null, { type: 'tool-result' }] }] }]) assert.equal(await mw.transformParams({ params }), params);
  const broken = mareCompress({ url: URL_, fetch: (() => { throw new Error('no network'); }) as any });
  const out = await run(broken, prompt({ type: 'text', value: LONG_HTML })); assert.equal(out.prompt[3].content[0].output.value, LONG_HTML);
});
await test('the same text is sent once; a failure is asked again next time; at most maxTexts texts per call', async () => {
  const mw = mareCompress({ url: URL_ });
  await run(mw, prompt({ type: 'text', value: LONG_HTML })); const again = await run(mw, prompt({ type: 'text', value: LONG_HTML }));
  assert.equal(seen.length, 1); assert.equal(again.prompt[3].content[0].output.value, squash(LONG_HTML));
  mode = 'busy'; await run(mw, prompt({ type: 'text', value: `${LONG_HTML} 2` })); mode = 'ok';
  const later = await run(mw, prompt({ type: 'text', value: `${LONG_HTML} 2` })); assert.equal(later.prompt[3].content[0].output.value, squash(`${LONG_HTML} 2`));
  seen.length = 0;
  const many = [{ role: 'tool', content: Array.from({ length: 5 }, (_, i) => ({ type: 'tool-result', toolCallId: `m${i}`, toolName: 'read', output: { type: 'text', value: `${LONG_HTML} m${i}` } })) }];
  await run(mareCompress({ url: URL_, maxTexts: 2 }), many); assert.equal(seen.length, 2);
});
if (process.env.MARE_COMPRESS_LIVE_URL) {
  await test('live: a node of Mare Liberum makes HTML Markdown and JSON smaller without loss; a short text stays', async () => {
    const mw = mareCompress({ url: process.env.MARE_COMPRESS_LIVE_URL });
    const p = prompt({ type: 'text', value: LONG_HTML }, [{ type: 'tool-result', toolCallId: 'c2', toolName: 'list', output: { type: 'json', value: ROWS } }, { type: 'tool-result', toolCallId: 'c3', toolName: 'note', output: { type: 'text', value: 'Plan 1: 3 EUR. '.repeat(4) } }]);
    const out = await run(mw, p), [html, rows, short] = out.prompt[3].content.map((c: any) => c.output);
    assert.ok(html.value.length < LONG_HTML.length && !html.value.includes('<p') && html.value.includes('Plan 119'), 'HTML as Markdown');
    if (rows.type === 'text') assert.ok(rows.value.length < JSON.stringify(ROWS).length && rows.value.includes('server 79'), 'JSON smaller, every row'); else assert.deepEqual(rows, { type: 'json', value: ROWS }, 'or kept when not smaller');
    assert.deepEqual(short, { type: 'text', value: 'Plan 1: 3 EUR. '.repeat(4) });
  });
} else console.log('  skip live: no node named in MARE_COMPRESS_LIVE_URL');

server.close();
console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);

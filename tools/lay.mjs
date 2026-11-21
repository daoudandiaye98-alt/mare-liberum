// Mare Liberum · what travels beside the sea
// The sea itself (the index) is drawn from the lakes. Everything else a release carries comes from the code: the pages
// people and agents read first, what the open ledger remembers, the fonts and faces of the site, and the source that
// anyone can read. The build lays these out after it has drawn the sea; a release that carries the sea of the build
// before it ([keep-sea], see deploy/update.sh) lays them out again from its own code:  node tools/lay.mjs
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export function layOut() {
  mkdirSync('data', { recursive: true });
  // the open ledger of the living sea (traces, latest events) travels with the build, so the sea remembers across restarts
  for (const [from, to] of [['flow/traces.json', 'data/flow-traces.json'], ['flow/head.json', 'data/flow-head.json'], ['flow/carry.json', 'data/flow-carry.json']]) if (existsSync(from)) cpSync(from, to);
  // the first pages people and agents read are served by the node
  mkdirSync('data/site', { recursive: true }); for (const f of ['index.html', 'llms.txt', 'robots.txt', 'skill.md', 'heartbeat.md', 'skill.json']) if (existsSync(`site/${f}`)) cpSync(`site/${f}`, `data/site/${f}`);
  // the fonts of the site are served as static files, from our own domain (no third-party font requests)
  if (existsSync('site/fonts')) { mkdirSync('public/fonts', { recursive: true }); cpSync('site/fonts', 'public/fonts', { recursive: true }); }
  // the faces of the sea when it is shared or saved: preview images, icons, the web manifest
  for (const f of ['demo.mp4', 'og.png', 'og-check.png', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico', 'manifest.webmanifest']) if (existsSync(`site/${f}`)) cpSync(`site/${f}`, `public/${f}`);
  // The source travels with the node: anyone can read it and run a mirror.
  mkdirSync('public/source', { recursive: true });
  for (const f of ['node/core.mjs', 'node/mem.mjs', 'node/flow.mjs', 'tools/build.mjs', 'tools/archive.mjs', 'engines/postgres/schema.sql', 'seeds.txt', 'seeds-ard.txt', 'store-pages.json', 'README.md', 'LICENSE']) if (existsSync(f)) cpSync(f, `public/source/${f.split('/').pop()}`);
  // the node to take home: everything a machine needs to run an empty sea of its own, in one package (see /download)
  try { packHome(); } catch (e) { console.error('mare_lay', `the package to take home was not made: ${e?.message}`); }
  // how large the sea is and when it was drawn, for anyone who asks
  if (existsSync('data/build.json')) cpSync('data/build.json', 'public/build.json');
}

// a tar archive in the plain ustar form, written here so the build needs no program beside Node
function tarOf(files, at) {
  const out = [];
  for (const f of files) {
    if (Buffer.byteLength(f.name) > 100) throw new Error(`name too long for the archive: ${f.name}`);
    const h = Buffer.alloc(512), oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';
    h.write(f.name, 0, 100, 'utf8'); h.write(oct(f.mode || 0o644, 8), 100, 8, 'ascii'); h.write(oct(0, 8), 108, 8, 'ascii'); h.write(oct(0, 8), 116, 8, 'ascii');
    h.write(oct(f.data.length, 12), 124, 12, 'ascii'); h.write(oct(Math.floor(at / 1000), 12), 136, 12, 'ascii'); h.write('        ', 148, 8, 'ascii'); h.write('0', 156, 1, 'ascii');
    h.write('ustar\0', 257, 6, 'ascii'); h.write('00', 263, 2, 'ascii');
    let sum = 0; for (const b of h) sum += b; h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    out.push(h, f.data, Buffer.alloc((512 - (f.data.length % 512)) % 512));
  }
  out.push(Buffer.alloc(1024));
  return Buffer.concat(out);
}
export function packHome() {
  if (!existsSync('home/README.md')) return null;
  const version = /export const VERSION = '([^']+)'/.exec(readFileSync('node/core.mjs', 'utf8'))?.[1] || '0.0.0', root = 'mare-liberum/', files = [];
  const add = (from, to, mode) => { if (existsSync(from)) files.push({ name: root + to, data: readFileSync(from), mode }); };
  add('serve.mjs', 'serve.mjs'); add('LICENSE', 'LICENSE'); add('SECURITY.md', 'SECURITY.md');
  add('home/README.md', 'README.md'); add('home/Dockerfile', 'Dockerfile'); add('home/start.sh', 'start.sh', 0o755); add('home/start.cmd', 'start.cmd');
  for (const f of readdirSync('node').filter((x) => x.endsWith('.mjs')).sort()) add(`node/${f}`, `node/${f}`);
  for (const f of ['index.html', 'llms.txt', 'robots.txt', 'skill.md', 'heartbeat.md', 'skill.json']) add(`site/${f}`, `site/${f}`);
  for (const f of ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico', 'manifest.webmanifest']) add(`site/${f}`, `public/${f}`);
  if (existsSync('site/fonts')) for (const f of readdirSync('site/fonts').sort()) add(`site/fonts/${f}`, `public/fonts/${f}`);
  files.push({ name: `${root}package.json`, data: Buffer.from(JSON.stringify({ name: 'mare-liberum', version, private: true, type: 'module', license: 'MIT', description: 'Mare Liberum on your own machine: an empty sea of your own, with harbours for your teams.', engines: { node: '>=22' }, scripts: { start: 'node serve.mjs' } }, null, 2) + '\n') });
  const at = Date.now(), gz = gzipSync(tarOf(files, at), { level: 9 }), file = `mare-liberum-${version}.tar.gz`;
  rmSync('public/download', { recursive: true, force: true }); mkdirSync('public/download', { recursive: true }); mkdirSync('data', { recursive: true });
  writeFileSync(`public/download/${file}`, gz);
  const info = { file, version, bytes: gz.length, files: files.length, sha256: createHash('sha256').update(gz).digest('hex'), at: new Date(at).toISOString() };
  writeFileSync('public/download/latest.json', JSON.stringify(info)); writeFileSync('data/download.json', JSON.stringify(info));
  return info;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) layOut();

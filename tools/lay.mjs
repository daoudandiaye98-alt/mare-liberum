// Mare Liberum · what travels beside the sea
// The sea itself (the index) is drawn from the lakes. Everything else a release carries comes from the code: the pages
// people and agents read first, what the open ledger remembers, the fonts and faces of the site, and the source that
// anyone can read. The build lays these out after it has drawn the sea; a release that carries the sea of the build
// before it ([keep-sea], see deploy/update.sh) lays them out again from its own code:  node tools/lay.mjs
import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  // how large the sea is and when it was drawn, for anyone who asks
  if (existsSync('data/build.json')) cpSync('data/build.json', 'public/build.json');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) layOut();

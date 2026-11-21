// Mare Liberum · pack the node as one file, for nodes that run on their own server
//   node tools/release.mjs check   compare this build with the one that is published; a build that lost much of the sea is not published
//   node tools/release.mjs pack    write sea.tar.gz (code, the open index, pages, static files) and release.json (its name and SHA-256)
// Runs after `node tools/build.mjs`. The published file is what deploy/update.sh fetches.
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { VERSION } from '../node/core.mjs';

const cmd = process.argv[1]?.endsWith('release.mjs') ? process.argv[2] : '';
const REPO = process.env.GITHUB_REPOSITORY || 'daoudandiaye98-alt/mare-liberum';
const FROM = process.env.MARE_RELEASE_URL || `https://github.com/${REPO}/releases/download/sea-latest`;
const built = () => JSON.parse(readFileSync('data/build.json', 'utf8'));
const num = (v) => (typeof v === 'number' ? v : 0);

// what a build may lose against the one before it: at most a fifth of all entries; and when a lake of size falls to
// less than half, the build is held back if that shows in the sea (more than one entry in a hundred is gone).
// A lake whose rows another lake carries as well (the live top of a deep lake), or a small one, may rest for a day
// without the whole sea standing still: on 2026-11-21 two such lakes did not answer, 0.7 % of the entries were
// missing, and three builds in a row were held back, the fixes they carried with them.
export function compare(now, before, { total = 0.8, lake = 0.5, big = 2000, seen = 0.01 } = {}) {
  const lost = [];
  if (num(before?.entries) >= 1000 && num(now?.entries) < before.entries * total) lost.push(`entries: ${now?.entries} now, ${before.entries} before`);
  if (num(before?.entries) - num(now?.entries) > num(before?.entries) * seen) for (const [name, n] of Object.entries(before?.lakes || {})) if (num(n) >= big && num(now?.lakes?.[name]) < n * lake) lost.push(`lake ${name}: ${now?.lakes?.[name]} now, ${n} before`);
  return lost;
}
// the lakes that did not answer this build although they had rows before: said aloud, also when the build goes on
export function tired(now, before, { lake = 0.5, small = 200 } = {}) {
  return Object.entries(before?.lakes || {}).filter(([name, n]) => num(n) >= small && num(now?.lakes?.[name]) < n * lake)
    .map(([name, n]) => `${name}: ${typeof now?.lakes?.[name] === 'number' ? now.lakes[name] : 'no answer'} now, ${n} before`);
}

if (cmd === 'check') {
  const build = built(); let before = null;
  try { const r = await fetch(`${FROM}/release.json`, { redirect: 'follow', signal: AbortSignal.timeout(30000) }); if (r.ok) before = await r.json(); } catch {}
  if (!before) { console.log('release: nothing published yet; this build is the first'); process.exit(0); }
  const lost = compare(build, before);
  console.log(`release: ${build.entries} entries now, ${before.entries} in ${before.id}`);
  if (lost.length && !/\[force-sea\]/.test(process.env.MARE_COMMIT_MESSAGE || '') && process.env.MARE_FORCE !== '1') {
    console.log(`release: this build lost part of the sea and is not published (the node keeps running the build before):\n  ${lost.join('\n  ')}\n  to publish it anyway: put [force-sea] into the commit message, or run the workflow by hand with force`);
    process.exit(1);
  }
  if (lost.length) console.log(`release: published although it lost part of the sea:\n  ${lost.join('\n  ')}`);
  process.exit(0);
}

if (cmd === 'pack') {
  const build = built();
  const sha = (process.env.GITHUB_SHA || '').slice(0, 40) || execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
  const stamp = new Date(build.builtAt || Date.now()).toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
  const id = `${stamp}-${sha.slice(0, 7)}`;
  // the node as it runs: no lake caches, no plain copy of the index (the node reads the compressed one), no git history
  const keep = ['serve.mjs', 'package.json', 'LICENSE', 'README.md', 'server.json', 'node', 'site', 'public', 'flow', 'deploy', 'engines'].filter((f) => existsSync(f));
  const dataFiles = readdirSync('data', { withFileTypes: true }).filter((d) => d.isDirectory() || (!/\.ndjson$/.test(d.name) && d.name !== 'sea.tsv')).map((d) => `data/${d.name}`);
  if (!existsSync('data/sea.tsv.gz')) throw new Error('data/sea.tsv.gz is missing; run node tools/build.mjs first');
  execFileSync('tar', ['-czf', 'sea.tar.gz', '--owner=0', '--group=0', ...keep, ...dataFiles], { stdio: 'inherit' });
  const sha256 = createHash('sha256').update(readFileSync('sea.tar.gz')).digest('hex');
  const manifest = { id, sha, version: VERSION, builtAt: build.builtAt, entries: build.entries, lakes: build.lakes, bytes: statSync('sea.tar.gz').size, sha256, file: 'sea.tar.gz' };
  writeFileSync('release.json', JSON.stringify(manifest, null, 1));
  console.log(`release: ${id} · ${manifest.entries} entries · ${(manifest.bytes / 1048576).toFixed(1)} MB · sha256 ${sha256}`);
  process.exit(0);
}

if (cmd && process.argv[1]?.endsWith('release.mjs')) { console.log('usage: node tools/release.mjs check | pack'); process.exit(1); }

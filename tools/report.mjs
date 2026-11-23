#!/usr/bin/env node
// Mare Liberum · write the full report on one website (the paid "Full report with fixes") as a Markdown file
//
//   node tools/report.mjs <domain> [--competitors a.com,b.com,c.com] [--pages https://…,https://…] [--out file.md]
//                                  [--base https://mareliberum.dev] [--date YYYY-MM-DD] [--json data.json] [--sample]
//
// It asks the sea what the free check and the Atlas read (/check?site=…&format=json, /site/<domain>.json) for the site
// and for up to three competitors, reads up to 10 pages of the site through the reader of the sea (/r/, which follows
// robots.txt), and writes one Markdown file. It sends nothing to anyone: a person reads the file, fills the lines marked
// TODO and sends it. With --json it also writes the data it read (or, when the file exists and --offline is given,
// writes the report from that file without the network).
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { reportMarkdown } from '../node/report.mjs';

const UA = 'MareLiberum-session/1.0';
const argv = process.argv.slice(2), flag = (n) => { const i = argv.indexOf(`--${n}`); return i < 0 ? null : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; };
const host = (x) => String(x || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
const okHost = (h) => /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(h);
const list = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);

const domain = host(argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true) || argv[0]);
if (!okHost(domain)) { console.error('use: node tools/report.mjs <domain> [--competitors a.com,b.com] [--pages url,url] [--out file.md]'); process.exit(2); }
const base = String(flag('base') || 'https://mareliberum.dev').replace(/\/$/, ''), date = typeof flag('date') === 'string' ? flag('date') : new Date().toISOString().slice(0, 10);
const out = typeof flag('out') === 'string' ? flag('out') : `reports/${domain}-${date}.md`, jsonFile = typeof flag('json') === 'string' ? flag('json') : null;
const rivals = list(flag('competitors')).map(host).filter((h) => okHost(h) && h !== domain).slice(0, 3);

const get = async (path, asJson = true) => {
  const r = await fetch(`${base}${path}`, { headers: { 'user-agent': UA, accept: asJson ? 'application/json' : 'text/markdown, text/plain' }, signal: AbortSignal.timeout(40000) });
  const t = await r.text(); if (!asJson) return { status: r.status, text: t };
  try { return JSON.parse(t); } catch { return { error: `the sea answered ${r.status} without JSON` }; }
};
const one = async (d) => { const [check, site] = await Promise.all([get(`/check?site=${encodeURIComponent(d)}&format=json`).catch((e) => ({ error: e.message })), get(`/site/${encodeURIComponent(d)}.json`).catch((e) => ({ error: e.message }))]); return { domain: d, check: check?.error?.message ? { error: check.error.message } : check, site: site?.mapped === false || site?.error ? {} : site }; };
// one page as an agent reads it: through the reader of the sea, as text
const readPage = async (url) => {
  try {
    const r = await get(`/r/${url}`, false); if (r.status !== 200) return { url, ok: false, note: `the reader answered ${r.status}${r.status === 403 || /robots/i.test(r.text) ? ' (robots.txt may not let it in)' : ''}` };
    const body = r.text.split(/^Markdown Content:\s*$/m)[1] ?? r.text, title = (/^Title:\s*(.+)$/m.exec(r.text) || [])[1] || (/^# (.+)$/m.exec(body) || [])[1] || '';
    return { url, ok: true, title: title.slice(0, 90), words: (body.match(/[\p{L}\p{N}]{2,}/gu) || []).length };
  } catch (e) { return { url, ok: false, note: String(e.message).slice(0, 80) }; }
};

let data;
if (flag('offline') && jsonFile && existsSync(jsonFile)) data = JSON.parse(readFileSync(jsonFile, 'utf8'));
else {
  const me = await one(domain), others = []; for (const d of rivals) others.push(await one(d));
  const named = list(flag('pages')).filter((u) => { try { return host(new URL(u).hostname) === domain; } catch { return false; } });
  const found = (me.site.sections || []).map((s) => s.url).filter((u) => { try { return host(new URL(u).hostname) === domain; } catch { return false; } });
  const urls = [...new Set([me.site.home ? `${me.site.home.replace(/\/$/, '')}/` : `https://${domain}/`, ...named, ...found])].slice(0, 10), pages = [];
  for (const u of urls) pages.push(await readPage(u));
  data = { domain, date, base, check: me.check, site: me.site, pages, competitors: others };
}
if (flag('sample')) data.sample = true;
const md = reportMarkdown(data);
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, md);
if (jsonFile && !flag('offline')) { mkdirSync(dirname(jsonFile), { recursive: true }); writeFileSync(jsonFile, JSON.stringify(data, null, 1)); }
const todo = (md.match(/TODO/g) || []).length;
console.log(`${out}  (${md.split('\n').length} lines, score ${data.check?.score ?? 'n/a'}, ${data.pages?.length || 0} pages read, ${data.competitors?.length || 0} competitors, ${todo} TODO)`);
console.log('Nothing was sent. Read it, fill the lines marked TODO, then send it by hand.');

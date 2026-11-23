// Mare Liberum · checks the sea charts (node/charts.mjs) against the course format.
//   node tools/charts-check.mjs           validate, print counts, exit 1 on any error
//   node tools/charts-check.mjs --fetch   also fetch every `to` once (GET, no redirects followed) and compare with REACHED
// Offline by default: the statuses fetched at build time stand in REACHED.
import { createHash } from 'node:crypto';
import { CHARTS, CHART_KINDS, CHART_VERBS, CHART_CHECKS, VERB_TOOLS, REACHED } from '../node/charts.mjs';
import { BRIEF_KINDS, briefFor } from '../node/brief.mjs';
import { YARD_KINDS } from '../node/yard.mjs';

const errors = [], notes = [];
const bad = (where, msg) => errors.push(`${where}: ${msg}`);

// ---------------------------------------------------------------- what a step may never say: pay, submit, post, log in
// An action word at the start of a clause is an instruction. Linked by and/then/to/now it is one too, unless the
// clause says the agent does not do it (never, not, nothing, without) or that a person does it.
const ACT = String.raw`(pay|pays|paying|buy|purchase|check\s?out(?![\s-]*(links?|pages?|url))|submit|send|post|publish|log\s?in|login|sign\s?(in|up)|book|register (an |a |your )?account|place (an |the )?order|order now|enter (your |the |a )?(card|payment|password|login|credentials|seed|private key|pin|iban))`;
const START = new RegExp(String.raw`^(then\s+|now\s+|and\s+|please\s+)?${ACT}\b`, 'i');
const LINKED = new RegExp(String.raw`\b(and|then|to|now|please)\s+${ACT}\b`, 'i');
const GUARD = /\b(never|not|no|nothing|without|don't|do not|the person|a person|person's|after (a|an|the) (explicit )?yes|waits for)\b/i;
const FORM = /\b(fill (in|out)|complete)\b[^.;]*\bform\b|\b(type|paste|give|put)\b[^.;]*\b(password|card number|seed phrase|private key|pin)\b/i;
const PREFIX = /^([a-z][a-z0-9-]*:)\s/;
export function instructs(text) {
  const body = String(text || '').replace(PREFIX, '');
  for (const raw of body.split(/[.;:!?]\s+|[.;:!?]$|,\s*(?=(?:then|and)\b)|\s+then\s+/)) {
    const cl = (raw || '').trim(); if (!cl) continue;
    if (START.test(cl)) return cl;
    if (LINKED.test(cl) && !GUARD.test(cl)) return cl;
    if (FORM.test(cl) && !GUARD.test(cl)) return cl;
  }
  return null;
}
// the detector proves itself first
for (const t of ['Pay with the saved card.', 'Then log in to the store.', 'Fill in the form and submit it.', 'Open the page and post the text on X.', 'Enter your card number on the page.', 'Book the cheapest flight.', 'Read the offer, then buy it.', 'Go to the shop to purchase the item.', 'Type the password into the login field.'])
  if (!instructs(t)) bad('detector', `does not catch "${t}"`);
for (const t of ["The person pays through the store's own checkout.", 'Nothing was booked.', 'Never pay, never log in.', 'checkout-link: the pick carries a checkout link that answers.', 'Read the payment page without entering anything.', "The booking waits for the person's explicit yes."])
  if (instructs(t)) bad('detector', `flags a harmless line "${t}"`);

// ---------------------------------------------------------------- the frame
const briefKinds = new Set(BRIEF_KINDS.map((k) => k.kind));
const extraKinds = new Map();
for (const k of CHART_KINDS) {
  if (!/^[a-z][a-z0-9-]{2,30}$/.test(k.kind || '')) bad(`CHART_KINDS ${k.kind}`, 'a kind is 3 to 31 lower-case letters, digits or -');
  if (briefKinds.has(k.kind)) bad(`CHART_KINDS ${k.kind}`, 'already a kind of node/brief.mjs');
  if (extraKinds.has(k.kind)) bad(`CHART_KINDS ${k.kind}`, 'listed twice');
  if (!k.title || !k.keys) bad(`CHART_KINDS ${k.kind}`, 'needs title and keys');
  if (k.tool && !CHART_VERBS.includes(k.tool)) bad(`CHART_KINDS ${k.kind}`, `tool ${k.tool} is not a verb`);
  extraKinds.set(k.kind, k);
}
const yard = new Map(YARD_KINDS.map((y) => [y.id, y]));
const FOR = new Set([...yard.keys(), 'angel', 'any']);
const SEA_TOOLS = ['think', 'read_page', 'check_site', 'ask', 'decide', 'search', 'mind'];
for (const v of CHART_VERBS) if (!VERB_TOOLS.sea[v]) bad('VERB_TOOLS', `no sea tools for ${v}`);
for (const v of Object.keys(VERB_TOOLS.harbour)) if (!CHART_VERBS.includes(v)) bad('VERB_TOOLS', `harbour verb ${v} is not a verb`);
for (const p of Object.keys(CHART_CHECKS)) if (!/^[a-z0-9-]+:$/.test(p)) bad('CHART_CHECKS', `prefix ${p}`);
const oneSentence = (t) => !/[.!?]\s+["'(]?[A-Z]/.test(String(t).replace(/\b(e\.g|i\.e|etc|vs|no)\.\s/gi, ''));
const sha = (x) => createHash('sha256').update(x).digest('hex').slice(0, 14);

// ---------------------------------------------------------------- every course
const ids = new Map(), tasks = new Map(), usedTo = new Set(), recognised = {};
CHARTS.forEach((cr, i) => {
  const w = `#${i} ${cr.kind || '?'} "${String(cr.title || '').slice(0, 50)}"`;
  const keys = Object.keys(cr).sort().join(',');
  if (keys !== 'for,kind,steps,task,title') bad(w, `fields are kind, title, for, task, steps (got ${keys})`);
  if (!briefKinds.has(cr.kind) && !extraKinds.has(cr.kind)) bad(w, `kind ${cr.kind} is neither a brief kind nor in CHART_KINDS`);
  if (typeof cr.title !== 'string' || cr.title.length < 12 || cr.title.length > 120 || !/[.!?]$/.test(cr.title) || !oneSentence(cr.title)) bad(w, 'title: one sentence of 12 to 120 characters, ending with a stop');
  const words = String(cr.task || '').trim().split(/\s+/).filter(Boolean).length;
  if (typeof cr.task !== 'string' || words < 3 || words > 25 || cr.task.length > 140) bad(w, 'task: 3 to 25 words in plain text');
  if (tasks.has(String(cr.task).toLowerCase())) bad(w, `task repeats course ${tasks.get(String(cr.task).toLowerCase())}`);
  tasks.set(String(cr.task).toLowerCase(), i);
  if (!Array.isArray(cr.for) || !cr.for.length) bad(w, 'for: a list of blueprint ids, angel or any');
  for (const f of cr.for || []) if (!FOR.has(f)) bad(w, `for: ${f} is not a blueprint id, angel or any`);
  if (new Set(cr.for || []).size !== (cr.for || []).length) bad(w, 'for: a value twice');
  // the task must be recognised as the kind it claims, when the kind is one of the briefs
  const seen = briefFor(cr.task || '').kind;
  if (briefKinds.has(cr.kind) && seen !== cr.kind) bad(w, `task is recognised as ${seen}, not ${cr.kind}`);
  if (extraKinds.has(cr.kind)) recognised[seen] = (recognised[seen] || 0) + 1;
  const steps = cr.steps;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 6) { bad(w, 'steps: 1 to 6'); return; }
  const blueprints = (cr.for || []).filter((f) => yard.has(f)).map((f) => yard.get(f));
  steps.forEach((st, j) => {
    const sw = `${w} step ${j + 1}`;
    for (const k of Object.keys(st)) if (!['do', 'to', 'on', 'say', 'check'].includes(k)) bad(sw, `unknown field ${k}`);
    if (!CHART_VERBS.includes(st.do)) bad(sw, `do: ${st.do} is not one of ${CHART_VERBS.join(', ')}`);
    if (typeof st.say !== 'string' || st.say.length < 10 || st.say.length > 260 || !oneSentence(st.say)) bad(sw, 'say: one sentence of 10 to 260 characters');
    if (typeof st.check !== 'string' || st.check.length < 8 || st.check.length > 200 || !oneSentence(st.check)) bad(sw, 'check: one sentence of 8 to 200 characters');
    // the address of a go step: https, public, fetched at build time with a 2xx or 3xx
    if (st.do === 'go') {
      let u = null; try { u = new URL(st.to); } catch { /* bad below */ }
      if (!u || u.protocol !== 'https:' || u.username || u.password || /^(localhost|127\.|10\.|192\.168\.|\[)/.test(u.hostname) || !u.hostname.includes('.')) bad(sw, 'to: a public https address');
      else if (/mareliberum\.dev$/.test(u.hostname)) bad(sw, 'to: the sea itself is reached with its verbs, not with go');
      const r = REACHED[st.to];
      if (!r || !(r.status >= 200 && r.status < 400)) bad(sw, `to: ${st.to} has no 2xx/3xx status in REACHED`);
      usedTo.add(st.to);
    } else if ('to' in st) bad(sw, 'to: only with do go');
    // the prefix of a check
    const m = PREFIX.exec(st.check || '');
    if (m) {
      const p = CHART_CHECKS[m[1]];
      if (!p) bad(sw, `check: unknown prefix ${m[1]} (known: ${Object.keys(CHART_CHECKS).join(' ')})`);
      else if (!p.on.includes(st.do)) bad(sw, `check: ${m[1]} does not fit do ${st.do} (fits ${p.on.join(', ')})`);
      if (st.on === 'harbour') bad(sw, 'check: the sea cannot test a step on a harbour; use plain text');
    }
    if (st.do === 'go' && !(st.check || '').startsWith('reachable:')) bad(sw, 'check: a go step is checked with reachable:');
    // a step on a harbour: only for blueprints that work from a harbour
    if ('on' in st) {
      if (st.on !== 'harbour') bad(sw, 'on: only harbour');
      else if (!VERB_TOOLS.harbour[st.do]) bad(sw, `on harbour: the harbour has no ${st.do}`);
      if (!blueprints.length || blueprints.length !== cr.for.length || blueprints.some((b) => !b.harbour)) bad(sw, 'on harbour: only in courses for blueprints that work from a harbour');
    }
    // each blueprint may use the verb: one of its tools is allowed, or asked for with a yes
    for (const b of blueprints) {
      const tools = (st.on === 'harbour' ? VERB_TOOLS.harbour : VERB_TOOLS.sea)[st.do] || [];
      const allow = tools.filter((t) => b.tools.allow.includes(t)), ask = tools.filter((t) => b.tools.ask.includes(t));
      if (!allow.length && !ask.length) bad(sw, `${b.id} may not use ${st.on === 'harbour' ? 'harbour ' : ''}${st.do} (${tools.join(', ')})`);
      else if (!allow.length && !/\byes\b/i.test(st.say)) bad(sw, `${b.id} needs a yes for ${ask.join(', ')}: say so in the step`);
      if (tools.length && tools.every((t) => b.tools.never.includes(t))) bad(sw, `${b.id} never uses ${tools.join(', ')}`);
    }
    // no instruction to pay, submit, post or log in
    for (const [f, t] of [['say', st.say], ['check', st.check]]) { const hit = instructs(t); if (hit) bad(sw, `${f} reads like an instruction to act: "${hit}"`); }
  });
  const id = sha(`${cr.kind}|${JSON.stringify(steps.map((st) => [st.do, st.to || '', st.on || '', st.say, st.check]))}`);
  if (ids.has(id)) bad(w, `same kind and steps as course #${ids.get(id)}`);
  ids.set(id, i);
});
for (const u of Object.keys(REACHED)) if (!usedTo.has(u)) bad('REACHED', `${u} is used by no step`);

// ---------------------------------------------------------------- coverage
const byFor = {}, byKind = {}, toolCourse = {};
for (const cr of CHARTS) {
  for (const f of cr.for) byFor[f] = (byFor[f] || 0) + 1;
  byKind[cr.kind] = (byKind[cr.kind] || 0) + 1;
  const t = extraKinds.get(cr.kind)?.tool;
  if (t && cr.for.includes('any') && cr.steps.some((st) => st.do === t)) toolCourse[t] = (toolCourse[t] || 0) + 1;
}
for (const id of yard.keys()) { const n = byFor[id] || 0; if (n < 3 || n > 5) bad('coverage', `${id} has ${n} courses (3 to 5)`); }
const angelKinds = new Set(CHARTS.filter((cr) => cr.for.includes('angel')).map((cr) => cr.kind));
for (const k of ['shop-safety', 'payment-safety', 'token-safety', 'shopping']) if (!angelKinds.has(k)) bad('coverage', `angel has no course of kind ${k}`);
for (const k of briefKinds) if (!CHARTS.some((cr) => cr.kind === k && cr.for.includes('any'))) bad('coverage', `brief kind ${k} has no course for any`);
for (const t of SEA_TOOLS) if (!toolCourse[t]) bad('coverage', `the sea tool ${t} has no course of its own (a CHART_KINDS kind with tool: '${t}', for any)`);
for (const k of extraKinds.keys()) if (!byKind[k]) bad('coverage', `CHART_KINDS ${k} is used by no course`);

// ---------------------------------------------------------------- optional: fetch every address once more
if (process.argv.includes('--fetch')) {
  for (const u of [...usedTo].sort()) {
    let status = 0;
    try { status = (await fetch(u, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'MareLiberum-session/1.0' }, signal: AbortSignal.timeout(10000) })).status; } catch { status = 0; }
    notes.push(`fetch ${status} ${u}`);
    if (!(status >= 200 && status < 400)) bad('fetch', `${u} answered ${status || 'nothing'}`);
  }
}

// ---------------------------------------------------------------- report
const steps = CHARTS.reduce((n, cr) => n + cr.steps.length, 0);
const checks = {}; for (const cr of CHARTS) for (const st of cr.steps) { const m = PREFIX.exec(st.check); const k = m ? m[1] : 'plain'; checks[k] = (checks[k] || 0) + 1; }
const verbs = {}; for (const cr of CHARTS) for (const st of cr.steps) { const k = st.on === 'harbour' ? `harbour.${st.do}` : st.do; verbs[k] = (verbs[k] || 0) + 1; }
const line = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k} ${v}`).join(' · ');
console.log(`charts: ${CHARTS.length} courses, ${steps} steps, ${Object.keys(byKind).length} kinds (${[...briefKinds].filter((k) => byKind[k]).length} of ${briefKinds.size} brief kinds, ${extraKinds.size} chart kinds), ${usedTo.size} outside addresses`);
console.log(`per agent:  ${[...yard.keys(), 'angel', 'any'].map((f) => `${f} ${byFor[f] || 0}`).join(' · ')}`);
console.log(`sea tools:  ${SEA_TOOLS.map((t) => `${t} ${toolCourse[t] || 0}`).join(' · ')}`);
console.log(`per kind:   ${line(byKind)}`);
console.log(`verbs:      ${line(verbs)}`);
console.log(`checks:     ${line(checks)}`);
console.log(`chart-kind tasks as briefFor sees them: ${line(recognised)}`);
for (const n of notes) console.log(n);
if (errors.length) { console.error(`\n${errors.length} error(s):`); for (const e of errors) console.error(`  ${e}`); process.exit(1); }
console.log('ok');

// Mare Liberum · the two buttons the law asks for: withdraw from a contract (§ 356a BGB, "Vertrag widerrufen") and cancel a
// contract (§ 312k BGB, "Verträge hier kündigen"). Each is a link in the foot of every page (step 1, node/skin.mjs) that
// leads straight to its confirmation page (step 2): a form that asks only what the law lets a trader ask, and one button
// labelled as the law says ("Widerruf bestätigen", "jetzt kündigen"). No login, no account, no script needed.
//   § 356a Abs. 2  the name, what identifies the contract (or the part withdrawn), the e-mail for the receipt; never a reason
//   § 312k Abs. 2  ordinary or extraordinary (and then, if the consumer gives one, the reason), the name, the contract, when
//                  it should end (none given: the earliest possible time, Abs. 5), the e-mail for the confirmation
// What is sent is kept with the exact time of its receipt in the node's own state (the kv; on a server with MARE_STATE its
// copy on disk, written at once), under legal:decl:<id>: never in the database, never on any public door. The confirmation
// page shows the whole declaration with its time and hands it over as a text file (§ 312k Abs. 3). The receipt on a durable
// medium (§ 356a Abs. 4, § 312k Abs. 4) goes by e-mail through an HTTP mail API once the operator switches one on
// (MARE_MAIL_KEY and MARE_MAIL_FROM; off while either is missing, or with MARE_MAIL=off); until then the operator sends
// it by hand, reading the declarations at GET /operator/declarations with the moderation key the sea already has (header
// x-mare-mod; its SHA-256 is MOD_KEY_SHA in node/flow.mjs).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SELLER } from './offers.mjs';
import { shell, BUTTON_DE, BUTTON_EN } from './legal.mjs';
import { MOD_KEY_SHA } from './flow.mjs';
import { netKey } from './guard.mjs';

// the button that sends, as the law names it (and its English equivalent)
export const CONFIRM = { withdrawal: { de: 'Widerruf bestätigen', en: 'Confirm withdrawal' }, termination: { de: 'jetzt kündigen', en: 'Cancel now' } };
// the confirmation pages, by path
export const DECLARE = {
  [BUTTON_DE.withdraw]: { kind: 'withdrawal', lang: 'de', other: BUTTON_EN.withdraw }, [BUTTON_EN.withdraw]: { kind: 'withdrawal', lang: 'en', other: BUTTON_DE.withdraw },
  [BUTTON_DE.cancel]: { kind: 'termination', lang: 'de', other: BUTTON_EN.cancel }, [BUTTON_EN.cancel]: { kind: 'termination', lang: 'en', other: BUTTON_DE.cancel },
};
export const OPERATOR_PATH = '/operator/declarations';
export const DECL = { prefix: 'legal:decl:', index: 'legal:decl:index', keepDays: 4 * 366, indexMax: 10_000, perHour: 10, perDay: 1000,
  fields: { name: 200, email: 254, contract: 500, reason: 1000 } };
export const DECL_ID = /^[wk]\d{8}[a-z2-9]{8}$/;
const DAY = 86400;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// text as a person typed it: no control or format characters, single spaces, at most n characters
const clean = (s, n) => String(s ?? '').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
const deDate = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
// the time of receipt in words: the local time in Köln, and UTC
function timeOf(iso, lang) {
  let local = null;
  try { local = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(new Date(iso)); } catch {}
  const utc = `${iso.slice(0, 19).replace('T', ' ')} UTC`;
  return local ? `${local} (${lang === 'de' ? 'Ortszeit Köln' : 'local time in Köln'}) · ${utc}` : utc;
}

// ------------------------------------------------------------------ the mail switch: off until the operator sets a key and a sender
export function mailConfig(env = globalThis.process?.env || {}) {
  const key = String(env.MARE_MAIL_KEY || '').trim(), from = String(env.MARE_MAIL_FROM || '').trim(), url = String(env.MARE_MAIL_URL || 'https://api.resend.com/emails').trim();
  const off = /^(off|0|false|no)$/i.test(String(env.MARE_MAIL || '').trim());
  const on = !off && !!key && !!from && /^https:\/\/[^\s]+$/.test(url);
  return { on, url, key: on ? key : '', from, bcc: String(env.MARE_MAIL_BCC ?? SELLER.email).trim(), replyTo: SELLER.email };
}
// one message through an HTTP mail API that takes { from, to, bcc, reply_to, subject, text } with a bearer key (the shape of Resend)
export async function sendMail(cfg, { to, subject, text }, get = (...a) => globalThis.fetch(...a)) {
  if (!cfg?.on) return { state: 'off' };
  try {
    const r = await get(cfg.url, { method: 'POST', headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json', 'user-agent': 'MareLiberum-Legal/1.0' },
      body: JSON.stringify({ from: cfg.from, to: [to], ...(cfg.bcc ? { bcc: [cfg.bcc] } : {}), reply_to: cfg.replyTo, subject, text }), signal: AbortSignal.timeout(10_000) });
    return r.ok ? { state: 'sent', at: new Date().toISOString() } : { state: 'failed', at: new Date().toISOString(), error: `status ${r.status}` };
  } catch (e) { return { state: 'failed', at: new Date().toISOString(), error: String(e?.message || 'failed').slice(0, 160) }; }
}

// ------------------------------------------------------------------ the words of each page
const W = {
  de: {
    withdrawal: { title: 'Vertrag widerrufen', lead: 'Hier widerrufen Sie einen Vertrag, den Sie als Verbraucher mit uns geschlossen haben (§ 356a BGB). Wir fragen nur, was wir dafür brauchen; einen Grund müssen Sie nicht nennen. Ihre Erklärung geht ab, sobald Sie unten auf „Widerruf bestätigen“ klicken.',
      fields: { name: 'Ihr Name', contract: 'Welcher Vertrag? Die Leistung, eine Bestellnummer oder was ihn sonst kenntlich macht; bei einem Teilwiderruf: welcher Teil', date: 'Bestellt oder bezahlt am (wenn bekannt)', email: 'E-Mail-Adresse für die Eingangsbestätigung' },
      done: 'Ihr Widerruf ist eingegangen', head: 'Widerrufserklärung', say: 'Hiermit widerrufe ich den folgenden Vertrag.', receipt: 'Eingangsbestätigung' },
    termination: { title: 'Verträge hier kündigen', lead: 'Hier kündigen Sie einen Vertrag mit uns, etwa einen Team-Hafen im Monatsabonnement oder die Jahresbegleitung des Kanzlei-Hafens (§ 312k BGB). Ihre Kündigung geht ab, sobald Sie unten auf „jetzt kündigen“ klicken.',
      fields: { type: 'Art der Kündigung', ordinary: 'ordentliche Kündigung', extraordinary: 'außerordentliche Kündigung (aus wichtigem Grund)', reason: 'Kündigungsgrund (bei außerordentlicher Kündigung; freiwillig)', name: 'Ihr Name', contract: 'Welcher Vertrag? Die Leistung, die Kennung des Hafens, eine Bestellnummer oder das Datum der Zahlung', effective: 'Beenden zum', earliest: 'nächstmöglichen Zeitpunkt', on: 'Datum', email: 'E-Mail-Adresse für die Kündigungsbestätigung' },
      done: 'Ihre Kündigung ist eingegangen', head: 'Kündigungserklärung', say: 'Hiermit kündige ich den folgenden Vertrag.', receipt: 'Kündigungsbestätigung' },
    required: 'Pflichtfeld', fix: 'Bitte ergänzen oder berichtigen:', id: 'Kennung', received: 'Eingegangen', sentBy: 'Abgegeben auf', button: 'mit der Schaltfläche', to: 'An', contractWord: 'Vertrag', reasonWord: 'Kündigungsgrund',
    follows: (kind, m) => `Eine ${kind === 'withdrawal' ? 'Eingangsbestätigung' : 'Kündigungsbestätigung'} mit diesem Inhalt, Datum und Uhrzeit des Eingangs folgt per E-Mail an ${m}.`,
    keep: 'Bitte speichern oder drucken Sie diese Seite. Ihre Erklärung als Textdatei:', file: 'Erklärung als Textdatei speichern',
    endsAt: 'Beendet werden soll der Vertrag', endsEarliest: 'zum nächstmöglichen Zeitpunkt (Team-Häfen: zum Ende des laufenden Abrechnungsmonats; Jahresbegleitung: zum Ende des Vertragsjahres)', endsOn: (d) => `zum ${deDate(d)}`,
    business: 'Unternehmer können diese Seite ebenso nutzen oder in Textform kündigen (AGB § 4 Absatz 5).', other: 'Lieber per E-Mail oder Brief?', english: 'English',
    busy: 'Gerade gehen von Ihrem Netz zu viele Erklärungen ein. Bitte versuchen Sie es in einer Stunde wieder, oder schreiben Sie uns eine E-Mail an', failed: 'Ihre Erklärung konnte gerade nicht gespeichert werden; sie ist nicht eingegangen. Bitte versuchen Sie es gleich noch einmal, oder schreiben Sie uns eine E-Mail an',
    links: [['/de/widerruf', 'Widerrufsbelehrung'], ['/de/agb', 'AGB'], ['/de/datenschutz', 'Datenschutz']],
  },
  en: {
    withdrawal: { title: 'Withdraw from contract', lead: 'Here you withdraw from a contract you concluded with us as a consumer (§ 356a BGB). We ask only for what we need for it; you do not have to give a reason. Your notice is sent as soon as you click “Confirm withdrawal” below.',
      fields: { name: 'Your name', contract: 'Which contract? The service, an order number or whatever else identifies it; for a partial withdrawal: which part', date: 'Ordered or paid on (if known)', email: 'Email address for the acknowledgement of receipt' },
      done: 'Your withdrawal has been received', head: 'Notice of withdrawal', say: 'I hereby withdraw from the following contract.', receipt: 'Acknowledgement of receipt' },
    termination: { title: 'Cancel contracts here', lead: 'Here you cancel a contract with us, such as a team harbour on a monthly subscription or the yearly support of the Kanzlei harbour (§ 312k BGB). Your cancellation is sent as soon as you click “Cancel now” below.',
      fields: { type: 'Kind of cancellation', ordinary: 'ordinary cancellation', extraordinary: 'extraordinary cancellation (for good cause)', reason: 'Reason (for an extraordinary cancellation; optional)', name: 'Your name', contract: 'Which contract? The service, the id of the harbour, an order number or the date of payment', effective: 'End the contract', earliest: 'at the earliest possible time', on: 'on the date', email: 'Email address for the confirmation of cancellation' },
      done: 'Your cancellation has been received', head: 'Notice of cancellation', say: 'I hereby cancel the following contract.', receipt: 'Confirmation of cancellation' },
    required: 'required', fix: 'Please add or correct:', id: 'Id', received: 'Received', sentBy: 'Sent on', button: 'with the button', to: 'To', contractWord: 'Contract', reasonWord: 'Reason',
    follows: (kind, m) => `An ${kind === 'withdrawal' ? 'acknowledgement of receipt' : 'confirmation of cancellation'} with this content and the date and time of receipt follows by email to ${m}.`,
    keep: 'Please save or print this page. Your declaration as a text file:', file: 'Save the declaration as a text file',
    endsAt: 'The contract is to end', endsEarliest: 'at the earliest possible time (team harbours: the end of the current billing month; yearly support: the end of the contract year)', endsOn: (d) => `on ${d}`,
    business: 'Businesses can use this page as well, or cancel in text form (terms § 4 paragraph 5).', other: 'Rather by email or letter?', english: 'Deutsch',
    busy: 'Too many declarations are arriving from your network right now. Please try again in an hour, or email us at', failed: 'Your declaration could not be stored just now; it has not been received. Please try again in a moment, or email us at',
    links: [['/de/widerruf#en', 'Right of withdrawal'], ['/terms', 'Terms'], ['/privacy', 'Privacy']],
  },
};
const whom = (lang) => { const p = String(SELLER.address).split(',').map((x) => x.trim()), country = lang === 'de' && p[p.length - 1] === 'Germany' ? 'Deutschland' : p[p.length - 1]; return `${SELLER.name}, ${SELLER.business}, ${p[0]}, ${p.slice(1, -1).join(', ')}, ${country}, ${SELLER.email}`; };
const mailto = () => `<a href="mailto:${esc(SELLER.email)}">${esc(SELLER.email)}</a>`;
function page(base, path, { title, h1, lead = '', body }) {
  const d = DECLARE[path];
  return shell({ base, path, lang: d.lang, robots: 'noindex', alt: d.lang === 'de' ? { en: d.other, de: path } : { en: path, de: d.other },
    title: `${title} · Mare Liberum`, desc: `${W[d.lang][d.kind].title} · Mare Liberum (${SELLER.business}, Köln)`, h1: esc(h1), lead, body });
}

// ------------------------------------------------------------------ step 2: the confirmation page with its form
export function declarePage(base, path, { values = {}, missing = [] } = {}) {
  const d = DECLARE[path]; if (!d) return null;
  const L = W[d.lang], T = L[d.kind], F = T.fields, v = (k) => esc(values[k] ?? '');
  const label = (k, req) => `<label for="f-${k}"><b>${esc(F[k])}</b>${req ? ` <small>(${esc(L.required)})</small>` : ''}</label>`;
  const text = (k, n, req = true, type = 'text', extra = '') => `<p>${label(k, req)}<br><input id="f-${k}" name="${k}" type="${type}" maxlength="${n}" value="${v(k)}"${req ? ' required' : ''}${extra}></p>`;
  const area = (k, n, req = true) => `<p>${label(k, req)}<br><textarea id="f-${k}" name="${k}" maxlength="${n}" rows="3"${req ? ' required' : ''}>${v(k)}</textarea></p>`;
  const fixes = missing.length ? `<div class="box" role="alert"><p style="margin:0">${esc(L.fix)} ${missing.map((m) => esc(F[m] || m)).join(' · ')}</p></div>\n` : '';
  const inputs = d.kind === 'withdrawal'
    ? `${text('name', DECL.fields.name)}\n${area('contract', DECL.fields.contract)}\n${text('date', 10, false, 'date')}\n${text('email', DECL.fields.email, true, 'email', ' autocomplete="email"')}`
    : `<fieldset><legend><b>${esc(F.type)}</b> <small>(${esc(L.required)})</small></legend>
<p><label><input type="radio" name="type" value="ordinary" required${values.type !== 'extraordinary' ? ' checked' : ''}> ${esc(F.ordinary)}</label><br><label><input type="radio" name="type" value="extraordinary"${values.type === 'extraordinary' ? ' checked' : ''}> ${esc(F.extraordinary)}</label></p></fieldset>
${area('reason', DECL.fields.reason, false)}
${text('name', DECL.fields.name)}
${area('contract', DECL.fields.contract)}
<fieldset><legend><b>${esc(F.effective)}</b></legend>
<p><label><input type="radio" name="when" value="earliest"${values.when !== 'date' ? ' checked' : ''}> ${esc(F.earliest)}</label><br><label><input type="radio" name="when" value="date"${values.when === 'date' ? ' checked' : ''}> ${esc(F.on)}</label> <input name="effective" type="date" value="${v('effective')}" aria-label="${esc(F.on)}"></p></fieldset>
${text('email', DECL.fields.email, true, 'email', ' autocomplete="email"')}`;
  const body = `${fixes}<form method="post" action="${esc(path)}" accept-charset="utf-8">
${inputs}
<p><button type="submit" name="confirm" value="1"><b>${esc(CONFIRM[d.kind][d.lang])}</b></button></p>
</form>
<p><small>${esc(L.to)}: ${esc(whom(d.lang))}. ${esc(L.other)} ${mailto()} · ${L.links.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join(' · ')} · <a href="${esc(d.other)}" hreflang="${d.lang === 'de' ? 'en' : 'de'}">${esc(L.english)}</a></small></p>
<p><small>${esc(L.business)}</small></p>`;
  return page(base, path, { title: T.title, h1: T.title, lead: `<p>${esc(T.lead)}</p>`, body });
}

// ------------------------------------------------------------------ the declaration as text: the page, the file and the e-mail say the same
export function declarationText(x, base) {
  const L = W[x.lang], T = L[x.kind], F = T.fields;
  const lines = [`${T.head} · Mare Liberum (${SELLER.business})`, '', `${L.id}: ${x.id}`, `${L.received}: ${timeOf(x.at, x.lang)}`,
    `${L.sentBy}: ${base}${x.page} ${L.button} „${CONFIRM[x.kind][x.lang]}“`, `${L.to}: ${whom(x.lang)}`, '', T.say];
  if (x.kind === 'termination') { lines.push(`${F.type}: ${x.type === 'extraordinary' ? F.extraordinary : F.ordinary}`); if (x.reason) lines.push(`${L.reasonWord}: ${x.reason}`); }
  lines.push(`${F.name}: ${x.name}`, `${L.contractWord}: ${x.contract}`);
  if (x.kind === 'withdrawal' && x.date) lines.push(`${F.date}: ${x.lang === 'de' ? deDate(x.date) : x.date}`);
  if (x.kind === 'termination') lines.push(`${L.endsAt}: ${x.effective ? L.endsOn(x.effective) : L.endsEarliest}`);
  lines.push(`${F.email}: ${x.email}`);
  return `${lines.join('\n')}\n`;
}

// ------------------------------------------------------------------ the store: the node's own state, never a public door
const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789';
const newId = (kind, iso) => `${kind === 'withdrawal' ? 'w' : 'k'}${iso.slice(0, 10).replace(/-/g, '')}${Array.from(randomBytes(8), (b) => ALPHA[b % 32]).join('')}`;
// one declaration after the other: the list the operator reads is never written by two at once
let line = Promise.resolve();
const serial = (fn) => { const run = line.then(fn, fn); line = run.catch(() => {}); return run; };
export const keep = (kv, x) => serial(async () => {
  const ttl = DECL.keepDays * DAY;
  await kv.set(`${DECL.prefix}${x.id}`, x, ttl);
  let list = null; try { list = await kv.get(DECL.index); } catch {}
  const next = [{ id: x.id, kind: x.kind, at: x.at }, ...(Array.isArray(list) ? list.filter((e) => e && e.id !== x.id) : [])].slice(0, DECL.indexMax);
  await kv.set(DECL.index, next, ttl);
});
// at most perHour declarations an hour from one network (an IPv4 address, an IPv6 /64), and perDay from all: counted under
// a hash, in memory only
const pace = new Map();
function tooMany(ip, t) {
  const hour = Math.floor(t / 3600e3), day = Math.floor(t / 864e5), k = `${createHash('sha256').update(`decl|${netKey(ip || 'unknown')}`).digest('hex').slice(0, 16)}|h${hour}`, all = `all|d${day}`;
  for (const [x] of pace) if (x !== all && !x.endsWith(`|h${hour}`)) pace.delete(x);
  const n = (pace.get(k) || 0) + 1, m = (pace.get(all) || 0) + 1;
  if (n > DECL.perHour || m > DECL.perDay) return true;
  pace.set(k, n); pace.set(all, m); return false;
}
// a page of another site may not send declarations through a visitor's browser: an Origin, when a browser names one, is
// this site or one of its subdomains
const sameSite = (origin, base) => { if (!origin || origin === 'null') return true; try { const o = new URL(origin).hostname, b = new URL(base).hostname; return o === b || o.endsWith(`.${b}`); } catch { return false; } };
// a form as a browser sends it (application/x-www-form-urlencoded), or the same fields as JSON
async function formOf(req) {
  const type = req.headers.get('content-type') || '', raw = await req.text().catch(() => '');
  if (/json/i.test(type)) { try { const j = JSON.parse(raw); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } }
  return Object.fromEntries(new URLSearchParams(raw));
}
const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

// GET: the confirmation page; POST: the declaration → a Response
export async function declareAnswer({ req, path, base, kv, ip, mail = mailConfig(), get, save, waitUntil = (p) => p, log = (...a) => console.error(...a), now = () => new Date().toISOString() }) {
  const d = DECLARE[path], L = W[d.lang], T = L[d.kind];
  if (req.method === 'GET' || req.method === 'HEAD') return new Response(declarePage(base, path), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
  const refuse = (status, words, extra = {}) => new Response(page(base, path, { title: T.title, h1: T.title, body: `<div class="box" role="alert"><p style="margin:0">${esc(words)} ${mailto()}.</p></div>` }), { status, headers: { ...HTML, ...extra } });
  if (!sameSite(req.headers.get('origin'), base)) return new Response(declarePage(base, path), { status: 403, headers: HTML });
  const f = await formOf(req), values = { name: clean(f.name, DECL.fields.name), email: clean(f.email, DECL.fields.email), contract: clean(f.contract, DECL.fields.contract) };
  if (d.kind === 'withdrawal') values.date = clean(f.date, 10);
  else { values.type = f.type === 'extraordinary' || f.type === 'ordinary' ? f.type : ''; values.reason = clean(f.reason, DECL.fields.reason); values.when = f.when === 'date' ? 'date' : 'earliest'; values.effective = clean(f.effective, 10); }
  const missing = ['name', 'contract'].filter((k) => !values[k]);
  if (!EMAIL.test(values.email)) missing.push('email');
  if (d.kind === 'withdrawal' && values.date && !okDate(values.date)) missing.push('date');
  if (d.kind === 'termination') { if (!values.type) missing.push('type'); if (values.when === 'date' && !okDate(values.effective)) missing.push('effective'); }
  if (missing.length) return new Response(declarePage(base, path, { values, missing }), { status: 422, headers: HTML });
  const at = now();
  if (tooMany(ip, Date.parse(at))) return refuse(429, L.busy, { 'retry-after': '3600' });
  const x = { v: 1, id: newId(d.kind, at), kind: d.kind, lang: d.lang, at, page: path, via: CONFIRM[d.kind][d.lang], name: values.name, contract: values.contract,
    ...(d.kind === 'withdrawal' ? (values.date ? { date: values.date } : {}) : { type: values.type, ...(values.type === 'extraordinary' && values.reason ? { reason: values.reason } : {}), ...(values.when === 'date' ? { effective: values.effective } : {}) }),
    email: values.email, mail: { state: mail?.on ? 'queued' : 'off' } };
  try { await keep(kv, x); } catch (e) { log('mare_legal', `${d.kind} not kept: ${String(e?.message || e).slice(0, 120)}`); return refuse(503, L.failed); }
  // the copy on disk is written at once, not with the next minute; the system journal names kind, id and time only
  try { const p = save?.(); if (p) waitUntil(Promise.resolve(p).catch(() => {})); } catch {}
  log('mare_legal', `${d.kind} ${x.id} received ${at}`);
  const text = declarationText(x, base);
  if (mail?.on) {
    const p = sendMail(mail, { to: x.email, subject: `${T.receipt}: ${T.head} ${x.id} · Mare Liberum`, text: `${T.receipt}\n\n${text}` }, get || undefined).then((m) => serial(async () => {
      const cur = await kv.get(`${DECL.prefix}${x.id}`).catch(() => null); await kv.set(`${DECL.prefix}${x.id}`, { ...(cur || x), mail: m }, DECL.keepDays * DAY);
      log('mare_legal', `${x.id} mail ${m.state}`);
    })).catch(() => {});
    try { waitUntil(p); } catch {}
  }
  const file = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`, name = `${x.kind === 'withdrawal' ? (d.lang === 'de' ? 'widerruf' : 'withdrawal') : (d.lang === 'de' ? 'kuendigung' : 'cancellation')}-${x.id}.txt`;
  const body = `<p class="pulse">${esc(L.received)}: ${esc(timeOf(at, d.lang))} · ${esc(L.id)}: <code>${esc(x.id)}</code></p>
<pre id="declaration">${esc(text)}</pre>
<p><b>${esc(L.follows(d.kind, x.email))}</b></p>
<p>${esc(L.keep)} <a href="${esc(file)}" download="${esc(name)}">${esc(L.file)}</a></p>
<p><small>${L.links.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join(' · ')}</small></p>`;
  return new Response(page(base, path, { title: T.done, h1: T.done, body }), { status: 200, headers: { ...HTML, 'x-declaration-id': x.id } });
}

// ------------------------------------------------------------------ the operator reads them with the moderation key, nobody else
const sameHash = (key, want) => { try { const a = Buffer.from(createHash('sha256').update(String(key)).digest('hex')), b = Buffer.from(String(want || '')); return a.length === b.length && timingSafeEqual(a, b); } catch { return false; } };
export async function operatorAnswer({ req, url, base, kv, keySha = MOD_KEY_SHA }) {
  const J = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
  const key = req.headers.get('x-mare-mod') || '';
  if (!key || !sameHash(key, keySha)) return new Response(JSON.stringify({ error: { code: 'PERMISSION_DENIED', message: 'operator key required (header x-mare-mod)' } }), { status: 403, headers: J });
  const id = url.searchParams.get('id');
  if (id) {
    const x = DECL_ID.test(id) ? await kv.get(`${DECL.prefix}${id}`).catch(() => null) : null;
    return new Response(JSON.stringify(x ? { declaration: x, text: declarationText(x, base) } : { error: { code: 'NOT_FOUND', message: 'no such declaration' } }), { status: x ? 200 : 404, headers: J });
  }
  const list = (await kv.get(DECL.index).catch(() => null)) || [], limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 1000);
  const out = []; for (const e of list.slice(0, limit)) { const x = await kv.get(`${DECL.prefix}${e.id}`).catch(() => null); if (x) out.push(x); }
  return new Response(JSON.stringify({ declarations: out, count: list.length, mail: mailConfig().on ? 'on' : 'off: confirm each declaration by email at once (MARE_MAIL_KEY and MARE_MAIL_FROM switch the automatic acknowledgement on)' }), { status: 200, headers: J });
}

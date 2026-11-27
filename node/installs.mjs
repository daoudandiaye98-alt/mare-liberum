// Mare Liberum · installations (since 4.0): measured, not guessed. Did a chat host build the sea in, and did it buy?
// An installation is a host program that takes the sea in through one of its entry routes, once per UTC day and caller:
//   routes   the skill (/skills/mare-liberum/SKILL.md, /skills/mare-liberum/, /skill.md, /SKILL.md and the Agent Skills index
//            and file under /.well-known/agent-skills/), llms.txt, and the MCP handshake (initialize at /mcp, /mcp/lean, /mcp/app)
//   host     chatgpt, claude, grok, gemini, cursor, copilot or other, by the client's name in the MCP handshake or its user agent
//            (node/seat.mjs hostOf); install_source is host and route together, as the contact book keeps it (chatgpt:/mcp)
//   never    crawlers and search engines, people in a browser, registries, the sea's own calls; a caller counted twice a day
//   keys     a key opened (GET /session?as=key, POST /session, /seat?as=key) counts for the host of the caller that opened it;
//   seats    a seat paid (node/seat.mjs, Stripe confirmed) counts for the host named in the seat's link
// One line per UTC day in the node's state (install:<day>: per host the installs, keys and seats, and the sources), the
// callers of the day only as a salted hash with a TTL of two days: no table, no migration, nothing about a person.
// GET /installs (JSON, per host today and 7 days, with key, with seat), /installs.txt (four lines), /pulse installations_today.
import { createHmac, randomBytes } from 'node:crypto';
import { HOSTS, hostOf } from './hosts.mjs';

export const INSTALL_ROUTES = /^\/(?:skills\/mare-liberum(?:\/SKILL\.md)?|skill\.md|SKILL\.md|llms\.txt|\.well-known\/agent-skills\/(?:index\.json|mare-liberum\/SKILL\.md)|mcp(?:\/lean|\/app)?)$/;
const NOT_HOSTS = new Set(['ai-crawler', 'crawler', 'search', 'search-ai', 'browser', 'self', 'registry']);
const DAY = 86_400, dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const blank = () => Object.fromEntries(HOSTS.map((h) => [h, 0]));
export const installSourceOf = (ua, path, name = '') => `${hostOf(ua, name)}:${String(path || '/').slice(0, 60)}`;

export function createInstalls({ kv, now = () => Date.now(), secret = randomBytes(32) }) {
  let chain = Promise.resolve();
  const serial = (fn) => { const run = chain.then(fn, fn); chain = run.then(() => {}, () => {}); return run; };
  const D = (d) => `install:${d}`, mac = (s) => createHmac('sha256', secret).update(s).digest('hex').slice(0, 24);
  const bump = (field, host, extra) => serial(async () => {
    const d = dayOf(now()), cur = (await kv.get(D(d))) || { installs: blank(), keys: blank(), seats: blank(), sources: {} };
    const h = HOSTS.includes(host) ? host : 'other'; cur[field][h] = (cur[field][h] || 0) + 1;
    if (extra) cur.sources[extra] = (cur.sources[extra] || 0) + 1;
    await kv.set(D(d), cur, 40 * DAY);
    return h;
  });
  return {
    // an entry route answered 200: an installation when the caller is a host program and new today; → its source or null
    async seen({ ua = '', ip = 'unknown', path, name = '', kind = 'unknown' } = {}) {
      if (NOT_HOSTS.has(kind) || !INSTALL_ROUTES.test(String(path || ''))) return null;
      const d = dayOf(now()), host = hostOf(ua, name), who = mac(`${d}|${ip}|${host}|${String(ua).slice(0, 200)}|${String(name).slice(0, 60)}`), k = `install:seen:${d}:${who}`;
      if (await kv.get(k)) return null;
      await kv.set(k, 1, 2 * DAY);
      const src = installSourceOf(ua, path, name);
      await bump('installs', host, src);
      return src;
    },
    key: (ua = '', name = '') => bump('keys', hostOf(ua, name)),
    seat: (host = 'other') => bump('seats', host),
    async report() {
      const t = now(), days = Array.from({ length: 7 }, (_, i) => dayOf(t - i * DAY * 1000)), rows = await Promise.all(days.map((d) => kv.get(D(d))));
      const sum = (field, n) => { const o = blank(); for (const r of rows.slice(0, n)) for (const h of HOSTS) o[h] += r?.[field]?.[h] || 0; return o; };
      const it = sum('installs', 1), i7 = sum('installs', 7), kt = sum('keys', 1), k7 = sum('keys', 7), st = sum('seats', 1), s7 = sum('seats', 7);
      const sources = Object.fromEntries(HOSTS.map((h) => [h, { today: it[h], days_7: i7[h], with_key_today: kt[h], with_key_7: k7[h], with_seat_today: st[h], with_seat_7: s7[h] }]));
      const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
      const top = Object.entries(rows[0]?.sources || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([source, n]) => ({ source, n }));
      return { today: days[0], sources, total: { today: total(it), days_7: total(i7), with_key_today: total(kt), with_key_7: total(k7), with_seat_today: total(st), with_seat_7: total(s7) }, top_sources_today: top };
    },
  };
}

// the four lines for a phone, in the words of /contacts.txt: installations, keys and sales per host, and the next step
export function installLines(r) {
  const row = (f7, f1) => HOSTS.map((h) => `${h} ${r.sources[h][f1]}/${r.sources[h][f7]}`).join(' · ');
  const t = r.total, best = (f) => HOSTS.filter((h) => h !== 'other').sort((a, b) => r.sources[b][f] - r.sources[a][f])[0];
  const next = t.with_seat_7 > 0 ? `${t.with_seat_7} Sitz${t.with_seat_7 === 1 ? '' : 'e'} in 7 Tagen: bei ${best('with_seat_7')} nachlegen, dort kauft man schon.`
    : t.with_key_7 > 0 ? `Schlüssel da, noch kein Sitz: ${best('with_key_7')} bekommt den Kaufweg erst bei 3 Calls im way_out; den Link POST /seat?as=host dort früher zeigen.`
    : t.days_7 > 0 ? `Installiert, aber kein Schlüssel: ${best('days_7')} liest uns ein, holt sich aber keinen Key; die erste Zeile der SKILL.md auf den Gratis-Start prüfen.`
    : 'Noch keine Installation in 7 Tagen: die 5 Einreichungen aus listings/today.md rausschicken.';
  return [
    `1 Installationen je Host (${r.today}, heute/7 Tage): ${row('days_7', 'today')} · gesamt ${t.today}/${t.days_7}`,
    `2 Schlüssel je Host (heute/7 Tage): ${row('with_key_7', 'with_key_today')} · gesamt ${t.with_key_today}/${t.with_key_7}`,
    `3 Verkäufe je Host, Sitze per Karte (heute/7 Tage): ${row('with_seat_7', 'with_seat_today')} · gesamt ${t.with_seat_today}/${t.with_seat_7}`,
    `4 Nächste Empfehlung: ${next}`,
  ];
}

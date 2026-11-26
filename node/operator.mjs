// Mare Liberum · the operator's page (GET /operator): make an operator key in the browser, and read the operator's doors with it
// The key the operator's doors ask for (header x-mare-mod; its SHA-256 is MOD_KEY_SHA in node/flow.mjs) is made and kept by the
// operator alone. This page makes one in the browser (32 random bytes, crypto.getRandomValues, base64url) and shows its SHA-256
// (crypto.subtle): only that checksum goes into the code. Nothing of section A leaves the page: no request, no storage, no log.
// Section B takes the key into a password field, keeps it in this page's memory only (no localStorage, no sessionStorage, no
// cookie, no address) and sends it only as the header x-mare-mod to this site's own doors /operator/digest,
// /operator/ledger.csv and /operator/declarations (same-origin fetch, no-store). Wrong keys: 403; 30 of them from one network in
// 10 minutes and its next tries wait (node/immune.mjs keyBraked). The page is noindex, no-store, no-referrer, in no sitemap
// and in no llms.txt, and no public page links to it. Its own CSP lets only its one inline script run (by the SHA-256 of
// that script, worked out below from the exact text served) and lets it talk only to this site. The new key stands in a
// password field (shown only on „Anzeigen“), so a screenshot or a screen share does not catch it; over plain http the page
// neither makes nor sends a key.
import { createHash } from 'node:crypto';
import { shell } from './legal.mjs';

export const OPERATOR_PAGE = '/operator';
// the doors the page reads, the only places its key goes
export const OPERATOR_READS = Object.freeze(['/operator/digest', '/operator/ledger.csv', '/operator/declarations']);
// the script of the page: in a closure, no global, no console, no storage, no address
export const OPERATOR_SCRIPT = `(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const READS = ${JSON.stringify(OPERATOR_READS)};
  const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
  const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  const say = (text) => { $('out').replaceChildren(); $('msg').textContent = text; };
  // copied without being shown: the field of the key stays a password field; where the clipboard refuses, it says so
  const copy = (id) => async () => { const el = $(id); try { await navigator.clipboard.writeText(el.value); $(id + '-ok').textContent = 'kopiert'; } catch { if (el.type === 'password') $(id + '-ok').textContent = 'nicht kopiert: bitte „Anzeigen“ wählen und von Hand kopieren'; else { $(id + '-ok').textContent = 'nicht kopiert: bitte von Hand kopieren'; el.select(); } } };
  const sayA = (text) => { $('make-msg').textContent = text; };
  // A: a new key, made here and shown once (as dots until „Anzeigen“); nothing is sent and nothing is kept. Only over https
  $('make').addEventListener('click', async () => {
    if (!isSecureContext || !crypto.subtle) { $('made').hidden = true; sayA('Nur über https: Ohne sichere Verbindung gibt der Browser die Funktionen für Zufall und Prüfsumme nicht frei. Es wurde kein Schlüssel erzeugt.'); return; }
    try {
      const raw = new Uint8Array(32); crypto.getRandomValues(raw);
      const key = b64url(raw), sum = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
      $('key').type = 'password'; $('show-key').textContent = 'Anzeigen'; $('show-key').setAttribute('aria-pressed', 'false'); $('key-ok').textContent = ''; $('sum-ok').textContent = '';
      $('key').value = key; $('sum').value = sum; $('made').hidden = false; sayA('');
    } catch { $('made').hidden = true; sayA('Der Browser konnte keinen Schlüssel erzeugen. Es wurde nichts gesendet.'); }
  });
  $('show-key').addEventListener('click', () => { const k = $('key'), shown = k.type === 'text'; k.type = shown ? 'password' : 'text'; $('show-key').textContent = shown ? 'Anzeigen' : 'Verbergen'; $('show-key').setAttribute('aria-pressed', shown ? 'false' : 'true'); });
  $('copy-key').addEventListener('click', copy('key'));
  $('copy-sum').addEventListener('click', copy('sum'));
  // B: the key in this page's memory only, sent only as x-mare-mod to this site's own operator doors
  const ask = async (path) => {
    if (!READS.includes(path)) return null;
    if (!isSecureContext) { say('Nur über https.'); return null; }
    const key = $('pw').value.trim();
    if (!key) { say('Bitte zuerst den Betreiber-Schlüssel eingeben.'); return null; }
    let r;
    try { r = await fetch(path, { method: 'GET', mode: 'same-origin', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { 'x-mare-mod': key } }); }
    catch { say('Keine Verbindung zum Knoten.'); return null; }
    if (r.status === 403) { say('403: Der Schlüssel stimmt nicht. Es wurde nichts gezeigt.'); return null; }
    if (r.status === 429) { say('429: Zu viele falsche Schlüssel aus diesem Netz. Bitte 10 Minuten warten.'); return null; }
    if (!r.ok) { say('Fehler ' + r.status + '.'); return null; }
    $('msg').textContent = ''; return r;
  };
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = String(text); if (cls) e.className = cls; return e; };
  const table = (head, rows) => { const t = el('table'), h = el('tr'); for (const x of head) h.append(el('th', x)); t.append(h); for (const r of rows) { const tr = el('tr'); for (const x of r) tr.append(el('td', x)); t.append(tr); } return t; };
  $('digest').addEventListener('click', async () => {
    const r = await ask('/operator/digest'); if (!r) return;
    const j = await r.json(), out = $('out'); out.replaceChildren();
    out.append(el('h3', 'Übersicht je Tag (UTC)'));
    out.append(table(['Tag', 'Widerrufe', 'Kündigungen', 'ohne Bestätigung', 'Kassenbuch: Zahlungen', 'USD', 'ohne Zuordnung', 'markiert', 'Zoll-Antworten', 'Fehler im Zahlungsweg'],
      (j.days || []).map((d) => [d.day, d.declarations.withdrawals, d.declarations.cancellations, d.declarations.open_without_receipt, d.ledger.transfers, d.ledger.usd, d.ledger.unmatched, d.ledger.flagged, d.toll.tolled_answers, Object.values(d.errors || {}).reduce((a, b) => a + (Number(b) || 0), 0)])));
    const b = (j.now && j.now.books) || {};
    out.append(el('p', 'Kette: Anbieter ' + (b.provider || '–') + ' · ' + (b.behind_blocks == null ? 'Stand unklar' : b.behind_blocks + ' Blöcke im Rückstand') + (b.last_error ? ' · letzter Fehler: ' + b.last_error.error : '')));
    const det = el('details'); det.append(el('summary', 'Alle Zahlen'), el('pre', JSON.stringify(j, null, 2))); out.append(det);
  });
  $('ledger').addEventListener('click', async () => {
    const r = await ask('/operator/ledger.csv'); if (!r) return;
    const url = URL.createObjectURL(await r.blob()), a = document.createElement('a');
    a.href = url; a.download = 'mare-kassenbuch-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    say('Das Kassenbuch wurde als CSV-Datei gespeichert.');
  });
  $('decl').addEventListener('click', async () => {
    const r = await ask('/operator/declarations'); if (!r) return;
    const j = await r.json(), out = $('out'); out.replaceChildren();
    out.append(el('h3', 'Erklärungen (' + (j.count || 0) + ')'), el('p', 'Bestätigung per E-Mail: ' + (j.mail || '–')));
    out.append(table(['Kennung', 'Art', 'Eingang', 'Name', 'Vertrag', 'E-Mail', 'Bestätigung'],
      (j.declarations || []).map((x) => [x.id, x.kind === 'withdrawal' ? 'Widerruf' : x.kind === 'termination' ? 'Kündigung' : x.kind, x.at, x.name, x.contract, x.email, (x.mail && x.mail.state) || '–'])));
  });
})();`;

// the page's own policy: only this one inline script runs (its SHA-256, from the exact text served), it talks only to this site,
// no form, no frame, no base, nothing loaded from elsewhere (styles inline, as on the legal pages)
export const OPERATOR_SCRIPT_SHA256 = createHash('sha256').update(OPERATOR_SCRIPT, 'utf8').digest('base64');
export const OPERATOR_CSP = `default-src 'none'; script-src 'sha256-${OPERATOR_SCRIPT_SHA256}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`;
export const OPERATOR_HEADERS = Object.freeze({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'content-security-policy': OPERATOR_CSP });

export function operatorPage(base) {
  const body = `<h2>A. Neuen Betreiber-Schlüssel erzeugen</h2>
<p>Der Schlüssel entsteht hier in diesem Browser aus 32 Zufallsbytes. Er wird nirgendwohin gesendet und nirgends gespeichert.</p>
<p><strong>Vorher Browser-Assistenten (z. B. Claude in Chrome) und Bildschirmfreigabe ausschalten.</strong></p>
<p><button type="button" id="make">Neuen Schlüssel erzeugen</button></p>
<p id="make-msg" role="status"></p>
<div id="made" hidden>
<p><label for="key"><b>Betreiber-Schlüssel</b></label><br><input id="key" type="password" readonly size="48" autocomplete="new-password" spellcheck="false"> <button type="button" id="show-key" aria-pressed="false">Anzeigen</button> <button type="button" id="copy-key">Kopieren</button> <small id="key-ok"></small></p>
<div class="box"><p style="margin:0">Speichern Sie den Schlüssel jetzt in einem Passwort-Manager. Er wird nur jetzt gezeigt und nirgendwohin gesendet. „Kopieren“ legt ihn in die Zwischenablage, ohne ihn anzuzeigen.</p></div>
<p><label for="sum"><b>Prüfsumme (SHA-256)</b></label><br><input id="sum" type="text" readonly size="70" autocomplete="off" spellcheck="false"> <button type="button" id="copy-sum">Kopieren</button> <small id="sum-ok"></small></p>
<p>Nur diese Prüfsumme geht an Claude. Sie ist kein Geheimnis: Aus ihr lässt sich der Schlüssel nicht zurückgewinnen.</p>
</div>
<h2>B. Anmelden</h2>
<p>Der Schlüssel bleibt nur im Speicher dieser Seite und geht nur als Kopfzeile an die Betreiber-Türen dieses Knotens.</p>
<p><label for="pw"><b>Betreiber-Schlüssel</b></label><br><input id="pw" type="password" autocomplete="current-password" size="48" spellcheck="false"></p>
<p><button type="button" id="digest">Übersicht</button> <button type="button" id="ledger">Kassenbuch (CSV)</button> <button type="button" id="decl">Erklärungen</button></p>
<p id="msg" role="status"></p>
<div id="out"></div>
<p lang="en"><small>English: section A makes a new operator key in this browser (only its SHA-256 goes to Claude); section B reads the operator doors with it.</small></p>
<script>${OPERATOR_SCRIPT}</script>`;
  // data-look: a look of its own, so the site's skin (node/skin.mjs) leaves it as it is: no script on this page but its own
  return shell({ base, path: OPERATOR_PAGE, lang: 'de', robots: 'noindex, nofollow', title: 'Betreiber · Mare Liberum', desc: 'Betreiber-Zugang von Mare Liberum', h1: 'Betreiber', lead: '<p>Für den Betreiber dieses Knotens: Schlüssel erzeugen und die Betreiber-Türen lesen.</p>', body })
    .replace('<html lang="de">', '<html lang="de" data-look="operator">');
}

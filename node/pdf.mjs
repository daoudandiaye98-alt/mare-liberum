// Mare Liberum · a PDF as text (since 3.59)
// The reader read web pages and text and answered a PDF with "not application/pdf". Agents read PDFs all day: papers,
// reports, forms, manuals, filings. Jina Reader, Firecrawl and url2md read them, and whoever puts the sea's reader in
// their place should not lose that. This file reads the text layer of a PDF with no package at all:
//   the objects of the file (also those packed into object streams), found by their own "n g obj", not by the xref
//   table, so a file cut short still gives the pages before the cut;
//   the page tree, with the resources a page inherits;
//   each font's way from codes to letters: its ToUnicode map first, then the named encodings (WinAnsi, MacRoman,
//   Standard), the Differences and, for Type 1 fonts, the encoding written in the font itself;
//   the text operators of every page and of the forms it draws, with the glyph widths, so that the gaps between words
//   and the steps between lines are measured, not guessed from the order of the bytes.
// Lines in a larger type become headings; the rest is joined into paragraphs. Nothing in the text is changed but the
// typographic ligatures (fi, fl, ...), which become their letters.
// What this does not do, and says so: read text that is only a picture (a scan has no text layer, and there is no OCR
// here), and open an encrypted file. It runs beside the node (node/aside.mjs), with a time limit and a memory of its own;
// every stream it unpacks is capped, so a small file that unpacks to gigabytes stops at the cap.
import { inflateSync } from 'node:zlib';
import { createHash, createCipheriv, createDecipheriv } from 'node:crypto';

const LIMITS = { pages: 400, chars: 200_000, stream: 16_000_000, total: 64_000_000, forms: 4 };

// ---- the lexer: PDF syntax, over bytes
const WS = new Uint8Array(256); for (const c of [0, 9, 10, 12, 13, 32]) WS[c] = 1;
const DL = new Uint8Array(256); for (const c of '()<>[]{}/%') DL[c.charCodeAt(0)] = 1;
class Name { constructor(v) { this.v = v; } }
class Ref { constructor(n) { this.n = n; } }
const KW_R = { t: 'kw', v: 'R' };

class Lexer {
  constructor(b, p = 0, end = b.length) { this.b = b; this.p = p; this.end = end; }
  skip() {
    const b = this.b, end = this.end; let p = this.p;
    for (;;) {
      while (p < end && WS[b[p]]) p++;
      if (p < end && b[p] === 0x25) { while (p < end && b[p] !== 10 && b[p] !== 13) p++; continue; }
      break;
    }
    this.p = p;
  }
  next() {
    this.skip();
    const b = this.b, end = this.end; let p = this.p;
    if (p >= end) return null;
    const c = b[p];
    if (c === 0x28) { this.p = p + 1; return { t: 'str', v: this.literal() }; }
    if (c === 0x3c) {
      if (b[p + 1] === 0x3c) { this.p = p + 2; return { t: '<<' }; }
      let q = p + 1; const hex = []; while (q < end && b[q] !== 0x3e) { const h = b[q]; if (!WS[h]) hex.push(h); q++; }
      this.p = q + 1; if (hex.length % 2) hex.push(0x30);
      const out = Buffer.alloc(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(String.fromCharCode(hex[2 * i], hex[2 * i + 1]), 16) || 0;
      return { t: 'str', v: out, hex: true };
    }
    if (c === 0x3e) { this.p = p + (b[p + 1] === 0x3e ? 2 : 1); return { t: '>>' }; }
    if (c === 0x5b) { this.p = p + 1; return { t: '[' }; }
    if (c === 0x5d) { this.p = p + 1; return { t: ']' }; }
    if (c === 0x7b || c === 0x7d) { this.p = p + 1; return { t: 'kw', v: String.fromCharCode(c) }; }
    if (c === 0x2f) {
      let q = p + 1; let s = '';
      while (q < end && !WS[b[q]] && !DL[b[q]]) { if (b[q] === 0x23 && q + 2 < end) { const h = parseInt(String.fromCharCode(b[q + 1], b[q + 2]), 16); if (!Number.isNaN(h)) { s += String.fromCharCode(h); q += 3; continue; } } s += String.fromCharCode(b[q]); q++; }
      this.p = q; return { t: 'name', v: s };
    }
    let q = p; while (q < end && !WS[b[q]] && !DL[b[q]]) q++;
    if (q === p) { this.p = p + 1; return { t: 'kw', v: String.fromCharCode(c) }; }
    const w = b.toString('latin1', p, q); this.p = q;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) return { t: 'num', v: Number(w) };
    if (/^[+-]?\d*\.\d*\.?[\d.]*$/.test(w)) return { t: 'num', v: Number.parseFloat(w) || 0 };
    return { t: 'kw', v: w };
  }
  literal() {
    const b = this.b, end = this.end; let p = this.p, depth = 1; const out = [];
    while (p < end) {
      const c = b[p++];
      if (c === 0x5c) {
        const e = b[p++];
        if (e === 0x6e) out.push(10); else if (e === 0x72) out.push(13); else if (e === 0x74) out.push(9); else if (e === 0x62) out.push(8); else if (e === 0x66) out.push(12);
        else if (e === 13) { if (b[p] === 10) p++; } else if (e === 10) { /* a line that goes on */ }
        else if (e >= 0x30 && e <= 0x37) { let v = e - 0x30; for (let k = 0; k < 2 && b[p] >= 0x30 && b[p] <= 0x37; k++) v = v * 8 + (b[p++] - 0x30); out.push(v & 255); }
        else if (e !== undefined) out.push(e);
        continue;
      }
      if (c === 0x28) depth++;
      else if (c === 0x29 && --depth === 0) break;
      out.push(c);
    }
    this.p = p; return Buffer.from(out);
  }
}

// one value; a number may turn out to be a reference "n g R"
function value(lx, tok = lx.next(), depth = 0) {
  if (!tok || depth > 64) return null;
  switch (tok.t) {
    case 'num': {
      if (Number.isInteger(tok.v) && tok.v >= 0) {
        const save = lx.p, a = lx.next();
        if (a?.t === 'num' && Number.isInteger(a.v)) { const r = lx.next(); if (r?.t === 'kw' && r.v === 'R') return new Ref(tok.v); }
        lx.p = save;
      }
      return tok.v;
    }
    case 'str': return tok.v;
    case 'name': return new Name(tok.v);
    case '[': { const arr = []; for (;;) { const t = lx.next(); if (!t || t.t === ']') break; arr.push(value(lx, t, depth + 1)); } return arr; }
    case '<<': {
      const d = Object.create(null);
      for (;;) { const k = lx.next(); if (!k || k.t === '>>') break; if (k.t !== 'name') continue; d[k.v] = value(lx, lx.next(), depth + 1); }
      return d;
    }
    case 'kw': return tok.v === 'true' ? true : tok.v === 'false' ? false : tok.v === 'null' ? null : { kw: tok.v };
    default: return null;
  }
}
const isDict = (x) => x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Name) && !(x instanceof Ref) && !Buffer.isBuffer(x) && !x.kw;
const nm = (x) => (x instanceof Name ? x.v : null);
const KW_STREAM = Buffer.from('stream'), KW_END = Buffer.from('endstream');

// ---- the objects of the file
function objects(buf) {
  const src = buf.toString('latin1'), map = new Map(), packed = [];
  const re = /(?<![\d.])(\d{1,7})\s+(\d{1,5})\s+obj\b/g; let m, trailer = null;
  while ((m = re.exec(src))) {
    const n = Number(m[1]), lx = new Lexer(buf, m.index + m[0].length), v = value(lx);
    let stream = null;
    if (isDict(v)) {
      lx.skip();
      if (buf.compare(KW_STREAM, 0, 6, lx.p, lx.p + 6) === 0) {
        let s = lx.p + 6; if (buf[s] === 13) s++; if (buf[s] === 10) s++;
        stream = { start: s, len: v.Length };
        re.lastIndex = s; // the data of a stream is not searched for objects
        const known = typeof v.Length === 'number' ? s + v.Length : -1;
        stream.end = known > 0 && known <= buf.length && src.slice(known, known + 12).trimStart().startsWith('endstream') ? known : -1;
        if (stream.end < 0) { const e = buf.indexOf(KW_END, s); stream.end = e < 0 ? buf.length : e; while (stream.end > s && (buf[stream.end - 1] === 10 || buf[stream.end - 1] === 13)) stream.end--; }
        re.lastIndex = stream.end;
      }
      if (nm(v.Type) === 'ObjStm' && stream) packed.push(n);
      if (nm(v.Type) === 'XRef' && v.Root) trailer = v;
    }
    map.set(n, { v, stream, num: n, gen: Number(m[2]) });
  }
  for (const t of src.matchAll(/trailer\s*<</g)) { const v = value(new Lexer(buf, t.index + 7)); if (isDict(v) && v.Root) trailer = v; }
  return { map, packed, trailer, src };
}

// ---- streams
function inflate(data) {
  try { return inflateSync(data, { maxOutputLength: LIMITS.stream }); }
  catch (e) {
    if (e?.code === 'ERR_BUFFER_TOO_LARGE') throw Object.assign(new Error('a stream of this PDF unpacks beyond the cap'), { big: true });
    // a stream with a broken end still gives what came before it
    try { return inflateSync(data, { maxOutputLength: LIMITS.stream, finishFlush: 2 }); } catch { return Buffer.alloc(0); }
  }
}
function ascii85(data) {
  const s = data.toString('latin1').replace(/\s+/g, '').replace(/^<~/, '').replace(/~>.*$/, ''), out = []; let i = 0;
  while (i < s.length) {
    if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
    const chunk = s.slice(i, i + 5), n = chunk.length; if (n < 2) break;
    let v = 0; for (let k = 0; k < 5; k++) v = v * 85 + ((k < n ? chunk.charCodeAt(k) : 117) - 33);
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; out.push(...bytes.slice(0, n - 1)); i += 5;
  }
  return Buffer.from(out);
}
function asciiHex(data) { const h = data.toString('latin1').replace(/[^0-9a-fA-F]/g, ''); return Buffer.from(h.length % 2 ? h + '0' : h, 'hex'); }

// ---- encryption: most encrypted PDFs on the web open without a password and only restrict printing or copying.
// The standard handler with the empty user password is opened (RC4 and AES-128, revisions 2 to 4; AES-256, revisions
// 5 and 6); a file that needs a password stays closed, and is said to be.
const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');
const hash = (alg, ...parts) => { const h = createHash(alg); for (const p of parts) h.update(p); return h.digest(); };
function rc4(key, data) {
  const S = new Uint8Array(256); for (let i = 0; i < 256; i++) S[i] = i;
  for (let i = 0, j = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 255; const t = S[i]; S[i] = S[j]; S[j] = t; }
  const out = Buffer.alloc(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + S[i]) & 255; const t = S[i]; S[i] = S[j]; S[j] = t; out[k] = data[k] ^ S[(S[i] + S[j]) & 255]; }
  return out;
}
function aes(key, data, iv = null, pad = true) {
  if (!iv) { if (data.length < 32) return Buffer.alloc(0); iv = data.subarray(0, 16); data = data.subarray(16); }
  data = data.subarray(0, data.length - (data.length % 16));
  const alg = key.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc';
  try { const d = createDecipheriv(alg, key, iv); d.setAutoPadding(pad); return Buffer.concat([d.update(data), d.final()]); }
  catch { try { const d = createDecipheriv(alg, key, iv); d.setAutoPadding(false); return Buffer.concat([d.update(data), d.final()]); } catch { return Buffer.alloc(0); } }
}
// ISO 32000-2, algorithm 2.B (revision 6)
function hash2B(pw, salt, udata) {
  let k = hash('sha256', pw, salt, udata), e = Buffer.from([0]);
  for (let i = 0; i < 64 || e[e.length - 1] > i - 32; i++) {
    const one = Buffer.concat([pw, k, udata]), k1 = Buffer.concat(new Array(64).fill(one));
    const c = createCipheriv('aes-128-cbc', k.subarray(0, 16), k.subarray(16, 32)); c.setAutoPadding(false);
    e = Buffer.concat([c.update(k1), c.final()]);
    let sum = 0; for (let j = 0; j < 16; j++) sum += e[j];
    k = hash(['sha256', 'sha384', 'sha512'][sum % 3], e);
  }
  return k.subarray(0, 32);
}
const LOCKED = 'this PDF is locked with a password; the reader opens only PDFs that open without one';
function security(doc, enc) {
  if (!isDict(enc) || nm(doc.get(enc.Filter)) !== 'Standard') return { error: 'this PDF is encrypted with a handler the reader does not know' };
  const V = Number(doc.get(enc.V)) || 0, R = Number(doc.get(enc.R)) || 0, O = doc.get(enc.O), U = doc.get(enc.U);
  if (!Buffer.isBuffer(O) || !Buffer.isBuffer(U)) return { error: LOCKED };
  const id = doc.get([].concat(doc.get(doc.trailer?.ID) || [])[0]), ID0 = Buffer.isBuffer(id) ? id : Buffer.alloc(0);
  let bits = Number(doc.get(enc.Length)) || 40, stm = 'V2', strm = 'V2';
  if (V >= 4) {
    const cf = doc.get(enc.CF) || {}, method = (n) => (!n || n === 'Identity' ? 'None' : nm(doc.get((doc.get(cf[n]) || {}).CFM)) || 'None');
    const sn = nm(doc.get(enc.StmF)), f = doc.get(cf[sn]) || {}; stm = method(sn); strm = method(nm(doc.get(enc.StrF)));
    const l = Number(doc.get(f.Length)); if (l) bits = l <= 32 ? l * 8 : l;
  }
  let key;
  if (R >= 5) {
    const vs = U.subarray(32, 40), ks = U.subarray(40, 48), UE = doc.get(enc.UE), empty = Buffer.alloc(0);
    const check = R === 5 ? hash('sha256', vs) : hash2B(empty, vs, empty);
    if (!check.subarray(0, 32).equals(U.subarray(0, 32)) || !Buffer.isBuffer(UE)) return { error: LOCKED };
    key = aes(R === 5 ? hash('sha256', ks) : hash2B(empty, ks, empty), UE.subarray(0, 32), Buffer.alloc(16), false);
    if (key.length !== 32) return { error: LOCKED };
  } else {
    const n = R === 2 ? 5 : Math.min(16, Math.max(5, bits / 8)), p = Buffer.alloc(4); p.writeInt32LE(Number(doc.get(enc.P)) | 0);
    let h = hash('md5', PAD, O.subarray(0, 32), p, ID0, R >= 4 && doc.get(enc.EncryptMetadata) === false ? Buffer.from([255, 255, 255, 255]) : Buffer.alloc(0));
    if (R >= 3) for (let i = 0; i < 50; i++) h = hash('md5', h.subarray(0, n));
    key = h.subarray(0, n);
    if (R === 2) { if (!rc4(key, PAD).equals(U.subarray(0, 32))) return { error: LOCKED }; }
    else { let x = rc4(key, hash('md5', PAD, ID0)); for (let i = 1; i <= 19; i++) x = rc4(key.map((b) => b ^ i), x); if (!x.subarray(0, 16).equals(U.subarray(0, 16))) return { error: LOCKED }; }
  }
  const objKey = (num, gen, salt) => hash('md5', key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255]), salt ? Buffer.from('sAlT') : Buffer.alloc(0)).subarray(0, Math.min(key.length + 5, 16));
  const run = (m, data, num, gen) => (m === 'None' ? data : m === 'AESV3' ? aes(key, data) : m === 'AESV2' ? aes(objKey(num, gen, true), data) : rc4(objKey(num, gen, false), data));
  return { stream: (d, num, gen) => run(stm, d, num, gen), string: (d, num, gen) => run(strm, d, num, gen) };
}

function makeDoc(buf) {
  const { map, packed, trailer, src } = objects(buf), cache = new Map(), budget = { used: 0 };
  const doc = { map, buf, src, trailer };
  doc.get = (x, depth = 0) => { let v = x; while (v instanceof Ref && depth++ < 32) v = map.get(v.n)?.v; return v instanceof Ref ? null : v; };
  doc.streamOf = (x) => { if (x instanceof Ref) return map.get(x.n)?.stream ? map.get(x.n) : null; return null; };
  doc.data = (x) => {
    const o = x instanceof Ref ? map.get(x.n) : x; if (!o?.stream) return null;
    if (cache.has(o)) return cache.get(o);
    let data = buf.subarray(o.stream.start, Math.max(o.stream.start, o.stream.end));
    if (doc.sec && o.num !== undefined && !o.inPack && nm(o.v.Type) !== 'XRef') data = doc.sec.stream(data, o.num, o.gen);
    const filters = [].concat(doc.get(o.v.Filter) ?? []).map((f) => nm(doc.get(f)));
    for (const f of filters) {
      if (f === 'FlateDecode' || f === 'Fl') data = inflate(data);
      else if (f === 'ASCII85Decode' || f === 'A85') data = ascii85(data);
      else if (f === 'ASCIIHexDecode' || f === 'AHx') data = asciiHex(data);
      else { data = null; break; } // pictures and the rare old filters: no text in them for this reader
      budget.used += data.length; if (budget.used > LIMITS.total) throw Object.assign(new Error('this PDF unpacks to more than the reader takes'), { big: true });
    }
    cache.set(o, data); return data;
  };
  if (trailer?.Encrypt) { const sec = security(doc, doc.get(trailer.Encrypt)); if (sec.error) doc.locked = sec.error; else doc.sec = sec; }
  if (doc.locked) return doc;
  // objects packed into object streams fill in what the file does not hold on its own
  for (const n of packed) {
    const o = map.get(n), data = doc.data(new Ref(n)); if (!data) continue;
    const count = doc.get(o.v.N), first = doc.get(o.v.First); if (!Number.isInteger(count) || !Number.isInteger(first)) continue;
    const lx = new Lexer(data), pairs = [];
    for (let i = 0; i < count; i++) { const a = lx.next(), b = lx.next(); if (a?.t !== 'num' || b?.t !== 'num') break; pairs.push([a.v, b.v]); }
    for (const [num, off] of pairs) if (!map.has(num) || map.get(num).inPack) map.set(num, { v: value(new Lexer(data, first + off)), stream: null, inPack: true });
  }
  return doc;
}

// ---- encodings
const WINANSI_HI = [0x20ac, 0, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0, 0x17d, 0, 0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0, 0x17e, 0x178];
const MACROMAN_HI = [0xc4, 0xc5, 0xc7, 0xc9, 0xd1, 0xd6, 0xdc, 0xe1, 0xe0, 0xe2, 0xe4, 0xe3, 0xe5, 0xe7, 0xe9, 0xe8, 0xea, 0xeb, 0xed, 0xec, 0xee, 0xef, 0xf1, 0xf3, 0xf2, 0xf4, 0xf6, 0xf5, 0xfa, 0xf9, 0xfb, 0xfc, 0x2020, 0xb0, 0xa2, 0xa3, 0xa7, 0x2022, 0xb6, 0xdf, 0xae, 0xa9, 0x2122, 0xb4, 0xa8, 0x2260, 0xc6, 0xd8, 0x221e, 0xb1, 0x2264, 0x2265, 0xa5, 0xb5, 0x2202, 0x2211, 0x220f, 0x3c0, 0x222b, 0xaa, 0xba, 0x3a9, 0xe6, 0xf8, 0xbf, 0xa1, 0xac, 0x221a, 0x192, 0x2248, 0x2206, 0xab, 0xbb, 0x2026, 0xa0, 0xc0, 0xc3, 0xd5, 0x152, 0x153, 0x2013, 0x2014, 0x201c, 0x201d, 0x2018, 0x2019, 0xf7, 0x25ca, 0xff, 0x178, 0x2044, 0x20ac, 0x2039, 0x203a, 0xfb01, 0xfb02, 0x2021, 0xb7, 0x201a, 0x201e, 0x2030, 0xc2, 0xca, 0xc1, 0xcb, 0xc8, 0xcd, 0xce, 0xcf, 0xcc, 0xd3, 0xd4, 0xf8ff, 0xd2, 0xda, 0xdb, 0xd9, 0x131, 0x2c6, 0x2dc, 0xaf, 0x2d8, 0x2d9, 0x2da, 0xb8, 0x2dd, 0x2db, 0x2c7];
const STANDARD_HI = { 0xa1: 0xa1, 0xa2: 0xa2, 0xa3: 0xa3, 0xa4: 0x2044, 0xa5: 0xa5, 0xa6: 0x192, 0xa7: 0xa7, 0xa8: 0xa4, 0xa9: 0x27, 0xaa: 0x201c, 0xab: 0xab, 0xac: 0x2039, 0xad: 0x203a, 0xae: 0xfb01, 0xaf: 0xfb02, 0xb1: 0x2013, 0xb2: 0x2020, 0xb3: 0x2021, 0xb4: 0xb7, 0xb6: 0xb6, 0xb7: 0x2022, 0xb8: 0x201a, 0xb9: 0x201e, 0xba: 0x201d, 0xbb: 0xbb, 0xbc: 0x2026, 0xbd: 0x2030, 0xbf: 0xbf, 0xc1: 0x60, 0xc2: 0xb4, 0xc3: 0x2c6, 0xc4: 0x2dc, 0xc5: 0xaf, 0xc6: 0x2d8, 0xc7: 0x2d9, 0xc8: 0xa8, 0xca: 0x2da, 0xcb: 0xb8, 0xcd: 0x2dd, 0xce: 0x2db, 0xcf: 0x2c7, 0xd0: 0x2014, 0xe1: 0xc6, 0xe3: 0xaa, 0xe8: 0x141, 0xe9: 0xd8, 0xea: 0x152, 0xeb: 0xba, 0xf1: 0xe6, 0xf5: 0x131, 0xf8: 0x142, 0xf9: 0xf8, 0xfa: 0x153, 0xfb: 0xdf };
function table(kind) {
  const t = new Array(256).fill('');
  for (let c = 32; c < 127; c++) t[c] = String.fromCharCode(c);
  if (kind === 'none') return new Array(256).fill('');
  if (kind === 'MacRomanEncoding') { for (let c = 128; c < 256; c++) t[c] = String.fromCodePoint(MACROMAN_HI[c - 128]); }
  else if (kind === 'StandardEncoding') { t[0x27] = '’'; t[0x60] = '‘'; for (const [c, u] of Object.entries(STANDARD_HI)) t[c] = String.fromCodePoint(u); }
  else { for (let c = 128; c < 160; c++) t[c] = WINANSI_HI[c - 128] ? String.fromCodePoint(WINANSI_HI[c - 128]) : ''; for (let c = 160; c < 256; c++) t[c] = String.fromCharCode(c); t[0xad] = '-'; }
  return t;
}
const TABLES = {};
const tableOf = (kind) => (TABLES[kind] ||= table(kind));

// glyph names: the names of the Latin-1 letters and signs, from the WinAnsi table, and the others agents meet in papers
const WINANSI_NAMES = 'space exclam quotedbl numbersign dollar percent ampersand quotesingle parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon semicolon less equal greater question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright asciicircum underscore grave a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde'.split(' ');
const LATIN1_NAMES = 'space exclamdown cent sterling currency yen brokenbar section dieresis copyright ordfeminine guillemotleft logicalnot hyphen registered macron degree plusminus twosuperior threesuperior acute mu paragraph periodcentered cedilla onesuperior ordmasculine guillemotright onequarter onehalf threequarters questiondown Agrave Aacute Acircumflex Atilde Adieresis Aring AE Ccedilla Egrave Eacute Ecircumflex Edieresis Igrave Iacute Icircumflex Idieresis Eth Ntilde Ograve Oacute Ocircumflex Otilde Odieresis multiply Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn germandbls agrave aacute acircumflex atilde adieresis aring ae ccedilla egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis eth ntilde ograve oacute ocircumflex otilde odieresis divide oslash ugrave uacute ucircumflex udieresis yacute thorn ydieresis'.split(' ');
const GLYPHS = Object.create(null);
WINANSI_NAMES.forEach((n, i) => { GLYPHS[n] = String.fromCharCode(32 + i); });
LATIN1_NAMES.forEach((n, i) => { if (i && GLYPHS[n] === undefined) GLYPHS[n] = String.fromCharCode(160 + i); });
Object.assign(GLYPHS, {
  quoteright: '’', quoteleft: '‘', quotedblleft: '“', quotedblright: '”', quotesinglbase: '‚', quotedblbase: '„',
  endash: '–', emdash: '—', bullet: '•', ellipsis: '…', dagger: '†', daggerdbl: '‡', perthousand: '‰',
  guilsinglleft: '‹', guilsinglright: '›', trademark: '™', Euro: '€', minus: '−', fraction: '⁄', florin: 'ƒ',
  fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi', ffl: 'ffl', dotlessi: 'ı', dotlessj: 'ȷ', OE: 'Œ', oe: 'œ', Lslash: 'Ł', lslash: 'ł',
  Scaron: 'Š', scaron: 'š', Zcaron: 'Ž', zcaron: 'ž', Ydieresis: 'Ÿ', circumflex: 'ˆ', tilde: '˜', caron: 'ˇ',
  breve: '˘', dotaccent: '˙', ring: '˚', ogonek: '˛', hungarumlaut: '˝', nbspace: ' ', sfthyphen: '­',
  visiblespace: '␣', arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓', infinity: '∞', lessequal: '≤',
  greaterequal: '≥', notequal: '≠', approxequal: '≈', element: '∈', summation: '∑', product: '∏', radical: '√',
  integral: '∫', partialdiff: '∂', nabla: '∇', degree: '°', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
  epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu1: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  periodcentered: '·', multiply: '×', divide: '÷', asteriskmath: '∗', openbullet: '◦',
});
function glyph(name) {
  if (!name) return '';
  if (GLYPHS[name] !== undefined) return GLYPHS[name];
  let m = /^uni([0-9A-Fa-f]{4})+$/.exec(name); if (m) return name.slice(3).match(/.{4}/g).map((h) => String.fromCharCode(parseInt(h, 16))).join('');
  m = /^u([0-9A-Fa-f]{4,6})$/.exec(name); if (m) { const c = parseInt(m[1], 16); return c <= 0x10ffff ? String.fromCodePoint(c) : ''; }
  const base = name.split(/[._]/)[0]; if (base !== name && GLYPHS[base] !== undefined) return GLYPHS[base];
  return '';
}

// ---- a ToUnicode map
function cmap(data) {
  const lx = new Lexer(data), map = new Map(), spaces = []; let tok;
  const toStr = (b) => { let s = ''; for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]); if (b.length % 2) s += String.fromCharCode(b[b.length - 1]); return s; };
  const code = (b) => { let v = 0; for (const x of b) v = v * 256 + x; return v; };
  const strs = () => { const a = lx.next(), b = lx.next(); return [a, b]; };
  while ((tok = lx.next())) {
    if (tok.t !== 'kw') continue;
    if (tok.v === 'begincodespacerange') { for (;;) { const [a, b] = strs(); if (a?.t !== 'str' || b?.t !== 'str') break; spaces.push({ len: a.v.length, lo: code(a.v), hi: code(b.v) }); } }
    else if (tok.v === 'beginbfchar') { for (;;) { const [a, b] = strs(); if (a?.t !== 'str' || b?.t !== 'str') break; map.set(`${a.v.length}:${code(a.v)}`, toStr(b.v)); } }
    else if (tok.v === 'beginbfrange') {
      for (;;) {
        const a = lx.next(); if (a?.t !== 'str') break; const b = lx.next(), d = lx.next(); if (b?.t !== 'str' || !d) break;
        const lo = code(a.v), hi = Math.min(code(b.v), lo + 65535), len = a.v.length;
        if (d.t === 'str') { const base = Buffer.from(d.v); for (let c = lo; c <= hi; c++) { const k = Buffer.from(base); let carry = c - lo; for (let i = k.length - 1; i >= 0 && carry; i--) { const s = k[i] + carry; k[i] = s & 255; carry = s >> 8; } map.set(`${len}:${c}`, toStr(k)); } }
        else if (d.t === '[') { for (let c = lo; ; c++) { const e = lx.next(); if (!e || e.t === ']') break; if (e.t === 'str' && c <= hi) map.set(`${len}:${c}`, toStr(e.v)); } }
      }
    }
  }
  return { map, spaces };
}

// ---- a font: from the bytes of a string to letters and widths
function fontOf(doc, fd) {
  const sub = nm(doc.get(fd.Subtype)), type0 = sub === 'Type0', type3 = sub === 'Type3';
  const tu = fd.ToUnicode instanceof Ref ? doc.data(fd.ToUnicode) : null, uni = tu ? cmap(tu) : null;
  const fm = type3 ? Math.abs(Number(doc.get(doc.get(fd.FontMatrix)?.[0])) || 0.001) : 0.001;
  let width, enc = null, codeLen = 1, ucs2 = false;
  if (type0) {
    const encName = nm(doc.get(fd.Encoding)) || ''; ucs2 = /UCS2|UTF16/.test(encName);
    const desc = doc.get([].concat(doc.get(fd.DescendantFonts) || [])[0]) || {}, dw = Number(doc.get(desc.DW)) || 1000, w = new Map();
    const W = [].concat(doc.get(desc.W) || []);
    for (let i = 0; i < W.length && w.size < 70000;) {
      const a = doc.get(W[i]), b = doc.get(W[i + 1]);
      if (Array.isArray(b)) { b.forEach((x, k) => w.set(a + k, Number(doc.get(x)) || 0)); i += 2; }
      else { const c = Number(doc.get(W[i + 2])) || 0; for (let k = a; k <= b && w.size < 70000; k++) w.set(k, c); i += 3; }
    }
    width = (c) => w.get(c) ?? dw; codeLen = 2;
  } else {
    const first = Number(doc.get(fd.FirstChar)) || 0, ws = [].concat(doc.get(fd.Widths) || []).map((x) => Number(doc.get(x)) || 0);
    const desc = doc.get(fd.FontDescriptor) || {}, missing = Number(doc.get(desc.MissingWidth)) || 0;
    const base = nm(doc.get(fd.BaseFont)) || '', mono = /Courier|Mono/i.test(base);
    width = (c) => { const v = ws[c - first]; return v || missing || (mono ? 600 : type3 ? 0 : 500); };
    // the letters: Differences over a base, the base named or written in a Type 1 font itself
    const e = doc.get(fd.Encoding); let baseKind = nm(e) || nm(doc.get(e?.BaseEncoding)) || null, diffs = isDict(e) ? [].concat(doc.get(e.Differences) || []) : [];
    let builtin = null;
    if (!baseKind && !uni) {
      const ff = desc.FontFile instanceof Ref ? doc.data(desc.FontFile) : null;
      if (ff) { builtin = new Array(256).fill(''); const head = ff.toString('latin1', 0, Math.min(ff.length, 60000)); for (const m of head.matchAll(/dup (\d{1,3}) ?\/([^\s/]+) put/g)) { const c = Number(m[1]); if (c < 256) builtin[c] = glyph(m[2]); } if (!/\/Encoding\s+StandardEncoding/.test(head) && builtin.some(Boolean)) baseKind = 'builtin'; else builtin = null; }
    }
    const symbolic = (Number(doc.get(desc.Flags)) || 0) & 4;
    enc = baseKind === 'builtin' ? builtin.slice() : tableOf(baseKind || (symbolic && /Symbol|Dingbat/i.test(base) ? 'none' : sub === 'Type1' && !baseKind && desc.FontFile3 ? 'StandardEncoding' : 'WinAnsiEncoding')).slice();
    let c = 0; for (const d of diffs) { const v = doc.get(d); if (typeof v === 'number') c = v; else if (v instanceof Name) { if (c < 256) enc[c] = glyph(v.v) || enc[c]; c++; } }
  }
  const lens = uni?.spaces?.length ? [...new Set(uni.spaces.map((s) => s.len))].sort((a, b) => a - b) : [codeLen];
  const inSpace = (len, v) => !uni?.spaces?.length || uni.spaces.some((s) => s.len === len && v >= s.lo && v <= s.hi);
  return {
    fm, type3,
    // the glyphs of one string: [letters, width in glyph units, is it the single-byte code 32]
    glyphs(bytes) {
      const out = [];
      for (let i = 0; i < bytes.length;) {
        let len = lens.find((l) => i + l <= bytes.length && inSpace(l, read(bytes, i, l))) || Math.min(lens[0], bytes.length - i) || 1;
        const v = read(bytes, i, len); i += len;
        let ch = uni?.map.get(`${len}:${v}`);
        if (ch === undefined) ch = type0 ? (ucs2 ? String.fromCharCode(v) : '') : enc ? enc[v] || '' : '';
        out.push([ch, width(v), len === 1 && v === 32]);
      }
      return out;
    },
  };
}
const read = (b, i, l) => { let v = 0; for (let k = 0; k < l; k++) v = v * 256 + b[i + k]; return v; };

// ---- one page: the text operators, measured
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const ID = [1, 0, 0, 1, 0, 0];

function pageText(doc, content, resources, fonts, out, depth = 0, ctm0 = ID) {
  const lx = new Lexer(content); let tok, ops = [];
  let ctm = ctm0.slice(); const stack = [];
  let tm = ID, tlm = ID, font = null, fs = 10, tc = 0, tw = 0, th = 1, tl = 0, rise = 0;
  const fontsOf = doc.get(resources?.Font) || {}, xobjects = doc.get(resources?.XObject) || {};
  const useFont = (key) => {
    // a font the file does not hold (a file cut short): its codes are read as WinAnsi, which most Latin text is
    const ref = fontsOf[key]; let fd = doc.get(ref); if (!isDict(fd)) fd = fonts.missing ||= Object.create(null);
    if (!fonts.has(fd)) { try { fonts.set(fd, fontOf(doc, fd)); } catch { fonts.set(fd, null); } }
    return fonts.get(fd);
  };
  const show = (items) => {
    if (!font) return;
    for (const it of items) {
      if (typeof it === 'number') { tm = mul([1, 0, 0, 1, (-it / 1000) * fs * th, 0], tm); continue; }
      if (!Buffer.isBuffer(it)) continue;
      for (const [ch, w, sp] of font.glyphs(it)) {
        const m = mul(mul([fs * th, 0, 0, fs, 0, rise], tm), ctm), size = Math.hypot(m[2], m[3]) || Math.abs(fs);
        const adv = (w * font.fm * fs + tc + (sp ? tw : 0)) * th;
        if (Math.abs(m[1]) <= Math.abs(m[0])) { const m2 = mul(mul([1, 0, 0, 1, adv, 0], tm), ctm); out.put(ch, m[4], m[5], m2[4], m2[5], size); }
        tm = mul([1, 0, 0, 1, adv, 0], tm);
      }
    }
  };
  while ((tok = lx.next())) {
    if (tok.t !== 'kw') { ops.push(value(lx, tok)); if (ops.length > 64) ops.shift(); continue; }
    const op = tok.v, a = ops; ops = [];
    switch (op) {
      case 'q': if (stack.length < 64) stack.push(ctm.slice()); break;
      case 'Q': ctm = stack.pop() || ctm0.slice(); break;
      case 'cm': if (a.length >= 6) ctm = mul(a.slice(-6).map(Number), ctm); break;
      case 'BT': tm = tlm = ID; break;
      case 'ET': break;
      case 'Tf': { const key = nm(a[a.length - 2]); fs = Number(a[a.length - 1]) || 0; font = key ? useFont(key) : null; break; }
      case 'Tc': tc = Number(a[0]) || 0; break;
      case 'Tw': tw = Number(a[0]) || 0; break;
      case 'Tz': th = (Number(a[0]) || 100) / 100; break;
      case 'TL': tl = Number(a[0]) || 0; break;
      case 'Ts': rise = Number(a[0]) || 0; break;
      case 'Td': tm = tlm = mul([1, 0, 0, 1, Number(a[0]) || 0, Number(a[1]) || 0], tlm); break;
      case 'TD': tl = -(Number(a[1]) || 0); tm = tlm = mul([1, 0, 0, 1, Number(a[0]) || 0, Number(a[1]) || 0], tlm); break;
      case 'Tm': if (a.length >= 6) tm = tlm = a.slice(-6).map(Number); break;
      case 'T*': tm = tlm = mul([1, 0, 0, 1, 0, -tl], tlm); break;
      case 'Tj': show([a[a.length - 1]]); break;
      case 'TJ': show([].concat(a[a.length - 1] || [])); break;
      case "'": tm = tlm = mul([1, 0, 0, 1, 0, -tl], tlm); show([a[a.length - 1]]); break;
      case '"': tw = Number(a[0]) || 0; tc = Number(a[1]) || 0; tm = tlm = mul([1, 0, 0, 1, 0, -tl], tlm); show([a[a.length - 1]]); break;
      case 'BI': { // an inline picture: its data is skipped, up to EI
        const b = lx.b; let p = lx.p; const idAt = b.indexOf('ID', p, 'latin1'); if (idAt < 0) { lx.p = lx.end; break; }
        p = idAt + 3; for (;;) { const e = b.indexOf('EI', p, 'latin1'); if (e < 0) { lx.p = lx.end; break; } if (WS[b[e - 1]] && (e + 2 >= b.length || WS[b[e + 2]] || DL[b[e + 2]])) { lx.p = e + 2; break; } p = e + 2; }
        break;
      }
      case 'Do': {
        if (depth >= LIMITS.forms) break;
        const key = nm(a[a.length - 1]), ref = xobjects[key], xo = doc.get(ref);
        if (!isDict(xo) || nm(doc.get(xo.Subtype)) !== 'Form') break;
        const data = doc.data(ref); if (!data) break;
        const matrix = [].concat(doc.get(xo.Matrix) || []).map((x) => Number(doc.get(x))); const at = matrix.length === 6 && matrix.every(Number.isFinite) ? mul(matrix, ctm) : ctm;
        pageText(doc, data, doc.get(xo.Resources) || resources, fonts, out, depth + 1, at);
        break;
      }
      default: break;
    }
  }
}

// ---- the letters of a page, as lines
function collector() {
  const lines = []; let cur = null, last = null;
  const flush = () => { if (cur && cur.text.trim()) lines.push(cur); cur = null; };
  return {
    lines,
    put(ch, x, y, x2, y2, size) {
      if (!ch) { last = { x2, y2, size }; return; }
      if (/^[\u0000-\u0008\u000b-\u001f]$/.test(ch)) return;
      if (last && cur) {
        const dy = y - last.y2, dx = x - last.x2, s = Math.max(size, last.size, 1);
        if (Math.abs(dy) > s * 0.55) { flush(); }
        // a step to the right wider than 0.15 of the type size is the gap between two words; a jump back to the left a new column
        else if ((dx > s * 0.15 || dx < -s * 1.5) && !/\s$/.test(cur.text) && !/^\s/.test(ch)) cur.text += ' ';
      }
      if (!cur) cur = { text: '', size, y, x, top: y, sizes: new Map() };
      cur.text += ch; cur.y = y;
      const k = Math.round(size * 2) / 2, n = (cur.sizes.get(k) || 0) + ch.length; cur.sizes.set(k, n);
      if (n > (cur.sizes.get(cur.size) || 0)) cur.size = k;
      last = { x2, y2, size };
    },
    end() { flush(); },
  };
}

const LIG = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };
const clean = (s) => s.replace(/[ﬀ-ﬆ]/g, (c) => LIG[c]).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
function str(x) {
  if (!Buffer.isBuffer(x)) return '';
  if (x[0] === 0xfe && x[1] === 0xff) { let s = ''; for (let i = 2; i + 1 < x.length; i += 2) s += String.fromCharCode((x[i] << 8) | x[i + 1]); return s.replace(/\u0000/g, '').trim(); }
  if (x[0] === 0xef && x[1] === 0xbb && x[2] === 0xbf) return x.subarray(3).toString('utf8').trim();
  return x.toString('latin1').replace(/\u0000/g, '').trim();
}

// the whole file: { pages, read, title, author, markdown, words, truncated } or { error }
export function pdfDigest(bytes, { pages: maxPages = LIMITS.pages, chars: maxChars = LIMITS.chars } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : bytes?.buffer ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) : Buffer.from(bytes || []);
  const at = buf.indexOf('%PDF-', 0, 'latin1'); if (at < 0 || at > 1024) return { error: 'this is not a PDF' };
  let doc; try { doc = makeDoc(buf); } catch (e) { return { error: e?.big ? e.message : 'this PDF could not be read' }; }
  const trailer = doc.trailer || {};
  if (doc.locked) return { error: doc.locked, encrypted: true };
  // the pages, in the order of the page tree; without a tree (a file cut short), every page object in the order of the file
  let root = doc.get(trailer.Root);
  if (!isDict(root)) for (const [, o] of doc.map) if (isDict(o.v) && nm(o.v.Type) === 'Catalog') root = o.v;
  const list = [], seen = new Set();
  const walk = (node, res, depth) => {
    const n = doc.get(node); if (!isDict(n) || seen.has(n) || depth > 48 || list.length >= maxPages) return; seen.add(n);
    const r = n.Resources !== undefined ? doc.get(n.Resources) : res;
    if (n.Kids !== undefined) { for (const k of [].concat(doc.get(n.Kids) || [])) walk(k, r, depth + 1); }
    else if (nm(n.Type) !== 'Pages') list.push({ page: n, res: r });
  };
  if (isDict(root)) walk(root.Pages, null, 0);
  let total = list.length; const counted = Number(doc.get(doc.get(root?.Pages)?.Count));
  if (Number.isInteger(counted) && counted > total) total = counted;
  if (!list.length) { for (const [, o] of doc.map) if (isDict(o.v) && nm(o.v.Type) === 'Page' && list.length < maxPages) list.push({ page: o.v, res: doc.get(o.v.Resources) }); total = list.length; }
  if (!list.length) return { error: 'no pages were found in this PDF' };
  const fonts = new Map(), pagesOut = []; let chars = 0, cut = false, pictures = 0;
  for (const { page, res } of list) {
    const col = collector();
    try {
      const contents = [].concat(page.Contents ?? []).flatMap((c) => (doc.get(c) && Array.isArray(doc.get(c)) ? doc.get(c) : [c]));
      const parts = contents.map((c) => doc.data(c)).filter(Boolean);
      const data = Buffer.concat(parts.flatMap((p) => [p, Buffer.from('\n')]));
      if (Object.keys(doc.get(res?.XObject) || {}).length) pictures++;
      pageText(doc, data, res, fonts, col);
    } catch (e) { if (e?.big) return { error: e.message }; }
    col.end(); pagesOut.push(col.lines);
    chars += col.lines.reduce((s, l) => s + l.text.length, 0);
    if (chars > maxChars) { cut = true; break; }
  }
  // the size of the body text: the size most letters are set in. A short line clearly larger is a heading, its level
  // by how much larger (1.6 times and more #, 1.3 ##, 1.18 ###); heading lines of one size that follow each other are one
  // heading, and a "heading" that runs long is a paragraph set large
  const bySize = new Map(); for (const ls of pagesOut) for (const l of ls) bySize.set(l.size, (bySize.get(l.size) || 0) + l.text.length);
  const body = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  const level = (s) => (s >= body * 1.6 ? 1 : s >= body * 1.3 ? 2 : s >= body * 1.18 ? 3 : 0);
  const blocks = []; let title = '';
  pagesOut.forEach((ls, pageNo) => {
    let para = '', prev = null, head = null;
    const end = () => { if (para.trim()) blocks.push(clean(para)); para = ''; };
    const endHead = () => {
      if (!head) return; const t = clean(head.text);
      if (t.length > 150 || /[.;:]\s+\p{Lu}/u.test(t)) blocks.push(t); else { blocks.push(`${'#'.repeat(head.level)} ${t}`); if (pageNo === 0 && (!title || head.size > title.size)) title = { text: t, size: head.size }; }
      head = null;
    };
    for (const l of ls) {
      const t = clean(l.text); if (!t) continue;
      const h = level(l.size);
      if (h && t.length <= 160 && /\p{L}/u.test(t)) {
        end();
        if (head && head.size === l.size && head.level === h && head.y - l.y <= l.size * 1.45 && head.y > l.y) { head.text += ` ${t}`; head.y = l.y; } else { endHead(); head = { level: h, size: l.size, text: t, y: l.y }; }
        prev = null; continue;
      }
      endHead();
      const step = prev ? prev.y - l.y : 0, lead = prev ? Math.max(prev.size, l.size) : 0;
      if (prev && (step > lead * 1.75 || step < -lead * 0.5)) end();
      para = para ? (/\p{Ll}-$/u.test(para) && /^\p{Ll}/u.test(t) ? para.slice(0, -1) + t : `${para} ${t}`) : t;
      prev = l;
    }
    endHead(); end();
  });
  const markdown = blocks.join('\n\n').slice(0, maxChars);
  const infoAt = trailer.Info instanceof Ref ? doc.map.get(trailer.Info.n) : null, info = doc.get(trailer.Info) || {};
  const said = (x) => { const v = doc.get(x); return str(doc.sec && Buffer.isBuffer(v) && infoAt && !infoAt.inPack && !(x instanceof Ref) ? doc.sec.string(v, infoAt.num, infoAt.gen) : v); };
  const author = said(info.Author) || undefined;
  title = said(info.Title) || title?.text || undefined;
  const words = markdown.split(/\s+/).filter(Boolean).length;
  if (!words) return { error: pictures ? 'this PDF holds pictures of text but no text layer (a scan); the reader does not read pictures' : 'this PDF holds no text the reader can read', pages: total, scanned: pictures > 0 || undefined };
  return { pages: total, read: pagesOut.length, title, author, markdown, words, truncated: cut || pagesOut.length < total || undefined };
}

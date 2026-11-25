// Mare Liberum · TOON (Token-Oriented Object Notation): the JSON data model in fewer tokens, lossless (since 3.35)
// Spec 4.4 (2026-10-08), https://github.com/toon-format/spec (MIT, Johann Schopplich). Encoder and decoder follow it to
// the letter; tools/toon-proof.mjs runs the spec's own conformance fixtures (vendored in tools/fixtures/toon, credited
// there) and the sea's real answers through both. No dependencies.
//   toToon(value, { delimiter: ',' | '\t' | '|', indent: 2 })   value → TOON text (throws ToonError where TOON cannot say it)
//   fromToon(text, { strict: true, indent: 2 })                  TOON text → value (throws ToonError on every error of §14)
// Host types (§3, documented as the spec asks): the value is first read the way JSON.stringify reads it: toJSON() is
// honoured (a Date becomes its ISO 8601 string), Number/String/Boolean wrappers are unwrapped, members whose value is
// undefined, a function or a symbol are left out of objects and become null in arrays, NaN and ±Infinity become null, -0
// becomes 0. Beyond JSON: a BigInt in the safe integer range becomes a number, else its decimal string (quoted); a Set
// becomes an array, a Map an object with String(key). So TOON of a value decodes to exactly what JSON.stringify of it says.
// A string with an unpaired surrogate cannot be said in TOON (§3): toToon throws, and the caller sends JSON instead.
// Decoder (§13.2): numbers are IEEE-754 doubles (a token beyond their range, e.g. 1e400, is an error: no silent Infinity);
// every key, __proto__ included, becomes an own member; keys keep the order of the document; nesting deeper than 512 is
// an error rather than a full stack.
export const TOON = Object.freeze({
  spec: '4.4', date: '2026-10-08', url: 'https://github.com/toon-format/spec/blob/v4.4.0/SPEC.md', home: 'https://toonformat.dev',
  media: 'text/toon', type: 'text/toon; charset=utf-8', ext: '.toon', implementation: 'node/toon.mjs (Mare Liberum, no dependencies)',
});
// TOON is sent only where it pays: at least this share fewer tokens than the compact JSON of the same answer (the research
// for 3.35: against compact JSON TOON saves on tables only, and costs accuracy in agentic use, arXiv 2605.29676). Read by
// node/toondoor.mjs, node/leanmcp.mjs and node/squeeze.mjs
export const TOON_MIN_GAIN = 0.2;
export class ToonError extends Error { constructor(m, line) { super(line ? `toon: ${m} (line ${line})` : `toon: ${m}`); this.name = 'ToonError'; this.line = line || null; } }

const KEY_OK = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const NUM_LIKE = /^[+-]?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/i;
const NEEDS_Q = /[:"\\[\]{}\u0000-\u001f]/;
const NUM = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
const DELIMS = new Set([',', '\t', '|']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// every key an own member, __proto__ included (§15)
const put = (o, k, v) => { if (k === '__proto__') Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); else o[k] = v; };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPrim = (v) => v === null || typeof v !== 'object';
const wellFormed = (s) => (typeof s.isWellFormed === 'function' ? s.isWellFormed() : !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s));

// ------------------------------------------------------------------ host value → the JSON data model (§3)
const MAX = BigInt(Number.MAX_SAFE_INTEGER), MIN = -MAX;
function norm(v, key, depth) {
  if (depth > 512) throw new ToonError('nesting deeper than 512');
  if (v !== null && typeof v === 'object' && typeof v.toJSON === 'function') v = v.toJSON(key);
  if (v instanceof Number || v instanceof String || v instanceof Boolean) v = v.valueOf();
  switch (typeof v) {
    case 'string': case 'boolean': return v;
    case 'number': return Number.isFinite(v) ? (v === 0 ? 0 : v) : null;
    case 'bigint': return v >= MIN && v <= MAX ? Number(v) : String(v);
    case 'object': {
      if (v === null) return null;
      if (Array.isArray(v) || v instanceof Set) return [...v].map((x, i) => { const y = norm(x, String(i), depth + 1); return y === undefined ? null : y; });
      const o = {};
      if (v instanceof Map) { for (const [k, x] of v) { const y = norm(x, String(k), depth + 1); if (y !== undefined) put(o, String(k), y); } return o; }
      for (const k of Object.keys(v)) { const y = norm(v[k], k, depth + 1); if (y !== undefined) put(o, k, y); }
      return o;
    }
    default: return undefined; // undefined, function, symbol
  }
}

// ------------------------------------------------------------------ encoder (§2, §5–§12)
const escape = (s) => {
  if (!wellFormed(s)) throw new ToonError('a string with an unpaired surrogate cannot be encoded (§3)');
  return s.replace(/[\\"\u0000-\u001f]/g, (c) => (c === '\\' ? '\\\\' : c === '"' ? '\\"' : c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
};
// §7.2: a string value is quoted only where it must be
function quoteValue(s, del, root) {
  if (s === '') return true;
  const f = s[0], l = s[s.length - 1];
  return f === ' ' || f === '\t' || l === ' ' || l === '\t' || s === 'true' || s === 'false' || s === 'null' || NUM_LIKE.test(s) || NEEDS_Q.test(s)
    || s.includes(del) || f === '-' || f === '#' || (root && f === '\ufeff');
}
// §2: canonical decimal between 1e-6 and 1e21, the shortest digits that read back as the same number (ECMAScript's own)
const numText = (n) => (n === 0 ? '0' : String(n));
function prim(v, del, root = false) {
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'number') return numText(v);
  const s = escape(v); // throws on an unpaired surrogate, quoted or not
  return quoteValue(v, del, root) ? `"${s}"` : s;
}
const keyText = (k) => (KEY_OK.test(k) ? k : `"${escape(k)}"`);

// §9.3: the field tree of uniform objects (elements of an array, or the values of an object), or null when they are not
function shapeOf(objs) {
  const first = objs[0];
  if (!isObj(first)) return null;
  const ks = Object.keys(first);
  if (!ks.length) return null;
  for (const o of objs) {
    if (!isObj(o)) return null;
    const ok = Object.keys(o);
    if (ok.length !== ks.length) return null;
    for (const k of ok) if (!own(first, k)) return null;
  }
  const tree = [];
  for (const k of ks) {
    const col = objs.map((o) => o[k]);
    if (col.every(isPrim)) tree.push({ k, sub: null });
    else if (col.every((x) => isObj(x) && Object.keys(x).length)) { const sub = shapeOf(col); if (!sub) return null; tree.push({ k, sub }); }
    else return null;
  }
  return tree;
}
// §9.5: an object of at least two uniform non-empty objects
const keyedShape = (o) => { const vs = Object.values(o); return vs.length >= 2 ? shapeOf(vs) : null; };

export function toToon(value, opts = {}) {
  const del = opts.delimiter ?? ',', ind = opts.indent ?? opts.indentSize ?? 2;
  if (!DELIMS.has(del)) throw new ToonError('delimiter must be ",", "\\t" or "|"');
  if (!Number.isInteger(ind) || ind < 1) throw new ToonError('indent must be a positive whole number');
  const sym = del === ',' ? '' : del, pad = (d) => ' '.repeat(d * ind), out = [];
  const fields = (tree) => `{${tree.map((f) => keyText(f.k) + (f.sub ? fields(f.sub) : '')).join(del)}}`;
  const cells = (o, tree, acc) => { for (const f of tree) { if (f.sub) cells(o[f.k], f.sub, acc); else acc.push(prim(o[f.k], del)); } return acc; };
  // an array: key is the encoded key or '' (keyless); lead is what stands before it on its line; its content is at depth fd + 1;
  // keyless inside a list, the tabular form is not available (§9.4)
  function arr(key, a, fd, lead, where) {
    if (!a.length) { out.push(where === 'field' ? `${lead}${key}: []` : where === 'root' ? '[]' : `${lead}[0${sym}]:`); return; }
    if (a.every(isPrim)) { out.push(`${lead}${key}[${a.length}${sym}]: ${a.map((x) => prim(x, del)).join(del)}`); return; }
    const tree = where === 'item' ? null : shapeOf(a);
    if (tree) { out.push(`${lead}${key}[${a.length}${sym}]${fields(tree)}:`); for (const o of a) out.push(pad(fd + 1) + cells(o, tree, []).join(del)); return; }
    out.push(`${lead}${key}[${a.length}${sym}]:`);
    for (const x of a) item(x, fd + 1);
  }
  // one element of a list-form array, its hyphen at depth h (§9.4, §10)
  function item(x, h) {
    const lead = `${pad(h)}- `;
    if (isPrim(x)) { out.push(lead + prim(x, del)); return; }
    if (Array.isArray(x)) { arr('', x, h, lead, 'item'); return; }
    const ks = Object.keys(x);
    if (!ks.length) { out.push(`${pad(h)}-`); return; }
    field(ks[0], x[ks[0]], h + 1, lead);
    for (const k of ks.slice(1)) field(k, x[k], h + 1, pad(h + 1));
  }
  // one member of an object standing at depth fd (§8); a scope it opens has its content at fd + 1
  function field(k, v, fd, lead) {
    const kt = keyText(k);
    if (isPrim(v)) { out.push(`${lead}${kt}: ${prim(v, del)}`); return; }
    if (Array.isArray(v)) { arr(kt, v, fd, lead, 'field'); return; }
    const tree = keyedShape(v);
    if (tree) { keyed(kt, v, tree, fd, lead); return; }
    out.push(`${lead}${kt}:`);
    for (const k2 of Object.keys(v)) field(k2, v[k2], fd + 1, pad(fd + 1));
  }
  function keyed(kt, o, tree, fd, lead) {
    const ks = Object.keys(o);
    out.push(`${lead}${kt}[${ks.length}:${sym}]${fields(tree)}:`);
    for (const k of ks) out.push(`${pad(fd + 1)}${keyText(k)}: ${cells(o[k], tree, []).join(del)}`);
  }
  const v = norm(value, '', 0) ?? null;
  if (isPrim(v)) return prim(v, del, true);
  if (Array.isArray(v)) arr('', v, 0, '', 'root');
  else { const tree = keyedShape(v); if (tree) keyed('', v, tree, 0, ''); else for (const k of Object.keys(v)) field(k, v[k], 0, ''); }
  return out.join('\n');
}

// ------------------------------------------------------------------ decoder (§4–§14)
// scan a line for its first unquoted occurrences; a " opens a quoted span anywhere, the next unescaped " closes it (§5.2)
function firstUnquoted(s, chars, from = 0) {
  let q = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === '"') q = false; continue; }
    if (c === '"') { q = true; continue; }
    if (chars.includes(c)) return i;
  }
  return -1;
}
const trimSp = (s) => { let a = 0, b = s.length; while (a < b && s[a] === ' ') a++; while (b > a && s[b - 1] === ' ') b--; return s.slice(a, b); };
const HEX = /^[0-9a-fA-F]{4}$/;
// a quoted span starting at s[i] === '"': its value and the index after the closing quote (§7.1)
function readQuoted(s, i, ln) {
  let out = '';
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === '"') return { value: out, end: j + 1 };
    if (c !== '\\') { out += c; continue; }
    const e = s[++j];
    if (e === '\\') out += '\\'; else if (e === '"') out += '"'; else if (e === 'n') out += '\n'; else if (e === 'r') out += '\r'; else if (e === 't') out += '\t';
    else if (e === 'u') { const h = s.slice(j + 1, j + 5); if (!HEX.test(h)) throw new ToonError('\\u needs four hex digits', ln); const cp = parseInt(h, 16); if (cp >= 0xd800 && cp <= 0xdfff) throw new ToonError('a surrogate escape is not a scalar value', ln); out += String.fromCharCode(cp); j += 4; }
    else throw new ToonError(`invalid escape \\${e ?? ''}`, ln);
  }
  throw new ToonError('unterminated string', ln);
}
// a whole token that starts with a quote must end with its closing quote (§7.4)
function quotedToken(t, ln) { const { value, end } = readQuoted(t, 0, ln); if (end !== t.length) throw new ToonError('characters after a closing quote', ln); return value; }
function token(raw, ln) {
  const t = trimSp(raw);
  if (t[0] === '"') return quotedToken(t, ln);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (NUM.test(t)) { const n = Number(t); if (!Number.isFinite(n)) throw new ToonError(`number out of range: ${t.slice(0, 40)}`, ln); return n === 0 ? 0 : n; }
  return t;
}
function keyToken(raw, ln) { const t = trimSp(raw); return t[0] === '"' ? quotedToken(t, ln) : t; }
// split on the active delimiter outside quotes, empty tokens kept (§11.2)
function splitCells(s, del) {
  const cells = []; let q = false, from = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === del) { cells.push(s.slice(from, i)); from = i + 1; }
  }
  cells.push(s.slice(from));
  return cells;
}
// §6: a header line → { key, keyed, n, del, fields, rest }; anything that is not the grammar throws
function parseHeader(c, ln) {
  let i = 0, key = '';
  if (c[0] === '"') { const q = readQuoted(c, 0, ln); key = q.value; i = q.end; if (c[i] !== '[') throw new ToonError('a header key must touch its bracket', ln); }
  else { i = firstUnquoted(c, '['); key = c.slice(0, i); if (/[ \t]$/.test(key)) throw new ToonError('whitespace before a bracket segment', ln); }
  const hasKey = c[0] === '"' || key.length > 0;
  let j = i + 1; const m = /^(0|[1-9][0-9]*)/.exec(c.slice(j));
  if (!m) throw new ToonError('malformed array length', ln);
  j += m[1].length;
  let keyed = false; if (c[j] === ':') { keyed = true; j++; }
  let del = ','; if (c[j] === '\t' || c[j] === '|') { del = c[j]; j++; }
  if (c[j] !== ']') throw new ToonError('malformed bracket segment', ln);
  j++;
  let fields = null;
  if (c[j] === '{') { const r = parseFields(c, j, del, ln); fields = r.fields; j = r.end; }
  if (c[j] !== ':') throw new ToonError('a header ends with a colon', ln);
  if (keyed && !fields) throw new ToonError('a keyed header needs a field list', ln);
  const rest = c.slice(j + 1);
  if (fields && trimSp(rest) !== '') throw new ToonError('nothing may follow a header with a field list', ln);
  return { key: hasKey ? key : null, keyed, n: Number(m[1]), del, fields, rest };
}
// a field list at c[i] === '{', with nested groups; the delimiter is the header's (§6, §9.3)
function parseFields(c, i, del, ln) {
  const fields = [], names = new Set(); let j = i + 1;
  const other = [',', '\t', '|'].filter((d) => d !== del);
  for (;;) {
    while (c[j] === ' ') j++;
    let name;
    if (c[j] === '"') { const q = readQuoted(c, j, ln); name = q.value; j = q.end; }
    else {
      // an unquoted name is any token (§7.4); a quote inside it opens a span in which braces and delimiters are content
      const a = j;
      while (j < c.length && c[j] !== del && c[j] !== '{' && c[j] !== '}') {
        if (c[j] === '"') { j = readQuoted(c, j, ln).end; continue; }
        if (other.includes(c[j])) throw new ToonError('a field list mixes delimiters', ln);
        j++;
      }
      name = trimSp(c.slice(a, j)); if (!name) throw new ToonError('empty field entry', ln);
      if (c[j] === '{' && /[ \t]$/.test(c.slice(a, j))) throw new ToonError('whitespace before a nested field group', ln);
    }
    let sub = null;
    if (c[j] === '{') { const r = parseFields(c, j, del, ln); sub = r.fields; j = r.end; }
    while (c[j] === ' ') j++;
    // a repeated name keeps its cell; the row writes it again, last write wins (§14.4), strict mode refuses it (§14.2)
    fields.push({ name, sub, ...(names.has(name) ? { dup: true } : {}) }); names.add(name);
    if (c[j] === del) { j++; continue; }
    if (c[j] === '}') return { fields, end: j + 1 };
    throw new ToonError('malformed field list', ln);
  }
}
const leafCount = (fs) => fs.reduce((n, f) => n + (f.sub ? leafCount(f.sub) : 1), 0);
const hasDup = (fs) => fs.some((f) => f.dup || (f.sub && hasDup(f.sub)));

export function fromToon(text, opts = {}) {
  const strict = opts.strict !== false, ind = opts.indent ?? opts.indentSize ?? 2;
  if (typeof text !== 'string') throw new ToonError('a TOON document is text');
  // §12 line preparation: BOM, CR, trailing spaces, comment lines, blank lines
  let src = text.startsWith('\ufeff') ? text.slice(1) : text;
  const L = [];
  src.split('\n').forEach((raw, n) => {
    let s = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    s = s.replace(/ +$/, '');
    if (/^ *#/.test(s)) return; // §5.1
    const ws = /^[ \t]*/.exec(s)[0], content = s.slice(ws.length), ln = n + 1;
    if (!content) { if (ws.includes('\t') && strict) throw new ToonError('a line of tabs', ln); L.push({ blank: true, ln }); return; }
    let depth;
    if (ws.includes('\t')) {
      if (strict) throw new ToonError('tabs in indentation', ln);
      const t = ws.split('').filter((x) => x === '\t').length; depth = t + Math.floor((ws.length - t) / ind);
    } else {
      if (ws.length % ind) { if (strict) throw new ToonError(`indentation is not a multiple of ${ind}`, ln); depth = Math.floor(ws.length / ind); }
      else depth = ws.length / ind;
    }
    L.push({ blank: false, depth, c: content, ln });
  });
  let i = 0;
  const next = () => { while (i < L.length && L[i].blank) i++; return i < L.length ? L[i] : null; };
  const blankBetween = (a, b) => { for (let k = a; k < b; k++) if (L[k].blank) return true; return false; };
  // a header span (§12): no blank line from its first item to the last line of its content
  const span = (start) => { if (!strict || start < 0) return; let end = i; while (end > start && L[end - 1]?.blank) end--; if (blankBetween(start, end)) throw new ToonError('a blank line inside an array', L[start].ln); };
  const err = (m, l) => { throw new ToonError(m, l?.ln); };
  const count = (got, n, what, l) => { if (strict && got !== n) err(`${what}: declared ${n}, found ${got}`, l); };
  let level = 0;
  const deeper = (l) => { if (++level > 512) err('nesting deeper than 512', l); };
  const classify = (c) => {
    const colon = firstUnquoted(c, ':'), br = firstUnquoted(c, '[');
    if (colon < 0) return 'scalar';
    if (br >= 0 && br < colon) return 'header';
    return 'kv';
  };
  // the first line of a nested scope: at exactly depth c, or (non-strict, §14.4) deeper, which then becomes its depth
  const scopeDepth = (c, hdr) => {
    const l = next();
    if (!l || l.depth < c) return -1;
    if (l.depth > c) { if (strict) err('indentation jumps a level', l); return l.depth; }
    return c;
  };
  const afterScope = (c, m) => { if (m > c) { const l = next(); if (l && l.depth >= c && l.depth < m) err('a line between two depths', l); } };
  // build one object from a row's cells along the field tree (§9.3)
  const rowObject = (fs, cells, at, ln) => { const o = {}; for (const f of fs) { if (f.sub) { const r = rowObject(f.sub, cells, at, ln); put(o, f.name, r.o); at = r.at; } else put(o, f.name, token(cells[at++], ln)); } return { o, at }; };
  const dupCheck = (fs, l) => { if (strict && hasDup(fs)) err('a field name repeats in a field list', l); };
  // an array or keyed object whose header stands at depth fd (content at fd + 1)
  function body(h, fd, l) {
    deeper(l);
    try {
      if (h.keyed) {
        dupCheck(h.fields, l);
        const o = {}, seen = new Set(), w = leafCount(h.fields), c = scopeDepth(fd + 1); let got = 0, start = -1;
        if (c >= 0) for (let r = next(); r && r.depth >= c; r = next()) {
          if (r.depth > c) err('an over-indented line', r);
          const at = firstUnquoted(r.c, ':'); if (at < 0) err('an entry row needs a colon', r);
          if (start < 0) start = i;
          const k = keyToken(r.c.slice(0, at), r.ln), rest = trimSp(r.c.slice(at + 1)), cells = rest === '' ? [] : splitCells(rest, h.del);
          if (cells.length !== w) err(`entry row has ${cells.length} cells, the header ${w}`, r);
          if (seen.has(k) && strict) err(`duplicate key ${k}`, r); seen.add(k);
          i++; put(o, k, rowObject(h.fields, cells, 0, r.ln).o); got++;
        }
        span(start); count(got, h.n, 'entries', l); if (c >= 0) afterScope(fd + 1, c);
        return o;
      }
      if (h.fields) {
        dupCheck(h.fields, l);
        const a = [], w = leafCount(h.fields), c = scopeDepth(fd + 1); let start = -1;
        if (c >= 0) for (let r = next(); r && r.depth >= c; r = next()) {
          if (r.depth > c) err('an over-indented line', r);
          const colon = firstUnquoted(r.c, ':'), d = firstUnquoted(r.c, h.del);
          if (colon >= 0 && (d < 0 || colon < d)) break; // not a row: the rows end (§9.3)
          if (start < 0) start = i;
          const cells = splitCells(r.c, h.del);
          if (cells.length !== w) err(`row has ${cells.length} cells, the header ${w}`, r);
          i++; a.push(rowObject(h.fields, cells, 0, r.ln).o);
        }
        span(start); count(a.length, h.n, 'rows', l); if (c >= 0) afterScope(fd + 1, c);
        return a;
      }
      const rest = trimSp(h.rest);
      if (rest !== '') { const a = splitCells(rest, h.del).map((x) => token(x, l.ln)); count(a.length, h.n, 'values', l); return a; }
      // list form (§9.2, §9.4)
      const a = [], c = scopeDepth(fd + 1); let start = -1;
      if (c >= 0) for (let r = next(); r && r.depth >= c; r = next()) {
        if (r.depth > c) err('an over-indented line', r);
        if (!(r.c === '-' || r.c.startsWith('- '))) break;
        if (start < 0) start = i;
        a.push(listItem(r, c));
      }
      span(start); count(a.length, h.n, 'items', l); if (c >= 0) afterScope(fd + 1, c);
      return a;
    } finally { level--; }
  }
  // one list item, its hyphen at depth h
  function listItem(r, h) {
    i++;
    if (r.c === '-') return {};
    const c = r.c.slice(1).replace(/^ +/, '');
    if (c === '[]') return [];
    const kind = classify(c);
    if (kind === 'header' && c[0] === '[') {
      const hd = parseHeader(c, r.ln);
      if (hd.fields) err('a keyless header with fields stands only at the root', r);
      return body(hd, h, r);
    }
    if (kind === 'scalar') return token(c, r.ln);
    // an object: its first field on the hyphen line stands at h + 1 (§10)
    const o = {}, seen = new Set();
    field(c, h + 1, r, o, seen);
    members(h + 1, o, seen);
    return o;
  }
  // the members of an object at depth d (the first may be read already)
  function members(d, o, seen) {
    for (let l = next(); l && l.depth >= d; l = next()) {
      if (l.depth > d) err('an over-indented line', l);
      if (classify(l.c) === 'scalar') err('a line without a colon inside an object', l);
      i++; field(l.c, d, l, o, seen);
    }
    return o;
  }
  // one member line standing at depth fd: key: value, key:, key: [], or key[N…]…: (§8, §9)
  function field(c, fd, l, o, seen) {
    let k, v;
    if (classify(c) === 'header') {
      const h = parseHeader(c, l.ln);
      if (h.key === null) err('a keyless header stands only at the root or as a list item', l);
      k = h.key; v = body(h, fd, l);
    } else {
      const at = firstUnquoted(c, ':'); k = keyToken(c.slice(0, at), l.ln);
      const rest = trimSp(c.slice(at + 1));
      if (rest === '[]') v = [];
      else if (rest !== '') v = token(rest, l.ln);
      else {
        const m = scopeDepth(fd + 1);
        if (m < 0) v = {};
        else { deeper(l); try { v = members(m, {}, new Set()); } finally { level--; } afterScope(fd + 1, m); }
      }
    }
    if (seen.has(k) && strict) err(`duplicate key ${k}`, l);
    seen.add(k); put(o, k, v);
  }
  // §5 the root form
  const first = next();
  if (!first) return {};
  if (first.depth > 0) err('the first line is indented', first);
  const kind = classify(first.c);
  let root;
  if (kind === 'header' && first.c[0] === '[') {
    const h = parseHeader(first.c, first.ln);
    i++; root = body(h, 0, first);
  } else if (first.c === '[]') { i++; root = []; }
  else {
    const rest = L.slice(i + 1).filter((x) => !x.blank);
    if (kind === 'scalar' && !rest.length) return token(first.c, first.ln);
    root = members(0, {}, new Set());
  }
  const left = next();
  if (left) err(left.depth > 0 ? 'an over-indented line' : Array.isArray(root) || (first.c[0] === '[') ? 'content after the root' : 'a line that belongs to no object', left);
  return root;
}

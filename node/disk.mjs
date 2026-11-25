// Mare Liberum · a memory that survives a restart
// A node that stands alone keeps the living sea in its own memory. This keeps a copy of it on disk: read once when
// the node starts, written again a moment after something changed, and once more when the node is asked to stop.
//   one line per name: [name, the time it ends (0 = never), value]
//   names that end within two minutes are not written (locks, rate marks); names that have ended are let go
//   names another memory keeps (skip) are left to it: after a restart they are read from there, fresh
// A name that must not wait for the next copy (since 3.37: the state of a payment of the toll, node/toll.mjs) is written at
// once with setNow: one line added to <file>.now and flushed to the disk before setNow returns. That file is read after the
// copy (its newest line of a name wins) and emptied of what the next copy holds.
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, openSync, writeSync, fsyncSync, closeSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname } from 'node:path';
import { once } from 'node:events';

export function diskKv(file, { everyMs = 60000, minTtlMs = 120000, skip = () => false, log = () => {}, now = Date.now } = {}) {
  const m = new Map();
  let dirty = false, writing = null, loaded = 0, lastSave = null, atOnce = 0;
  const jfile = `${file}.now`;
  try { mkdirSync(dirname(file), { recursive: true }); } catch {}

  // read the copy line by line; a line that cannot be read is left out, the rest stays. Then the names written at once since
  // that copy: the newest line of each wins (one that has ended takes the name away)
  const ready = (async () => {
    const t = now();
    if (existsSync(file)) {
      try {
        for await (const line of createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity })) {
          if (!line) continue;
          try { const [k, e, v] = JSON.parse(line); if (typeof k === 'string' && v !== undefined && (!e || e > t) && !m.has(k)) { m.set(k, { v, e: e || 0 }); loaded++; } } catch {}
        }
      } catch (e) { log('mare_disk_read', e?.message); }
    }
    if (existsSync(jfile)) {
      try {
        for await (const line of createInterface({ input: createReadStream(jfile, 'utf8'), crlfDelay: Infinity })) {
          if (!line) continue;
          try { const [k, e, v] = JSON.parse(line); if (typeof k !== 'string' || v === undefined) continue; if (e && e <= t) m.delete(k); else { if (!m.has(k)) loaded++; m.set(k, { v, e: e || 0 }); } dirty = true; } catch {}
        }
      } catch (e) { log('mare_disk_read', e?.message); }
    }
    return loaded;
  })();
  const sizeOf = (f) => { try { return statSync(f).size; } catch { return 0; } };
  // after a copy: the lines written at once before it began are in it now and go; the ones written meanwhile stay
  const fold = (j0) => {
    if (!j0) return;
    try { const rest = readFileSync(jfile).subarray(j0); if (!rest.length) writeFileSync(jfile, ''); else { writeFileSync(`${jfile}.tmp`, rest); renameSync(`${jfile}.tmp`, jfile); } } catch (e) { log('mare_disk_write', e?.message); }
  };

  // one pass over everything: what has ended is let go, the rest is written beside the old copy and then takes its place
  function save() {
    if (writing) return writing;
    writing = (async () => {
      dirty = false;
      const j0 = sizeOf(jfile);
      const t = now(), tmp = `${file}.tmp`, out = createWriteStream(tmp);
      let failed = null; out.on('error', (e) => { failed = e; });
      let n = 0, i = 0;
      for (const [k, x] of m) {
        if (failed) break;
        if (x.e && x.e <= t) { m.delete(k); continue; }
        if ((x.e && x.e - t < minTtlMs) || skip(k)) continue;
        let line; try { line = JSON.stringify([k, x.e, x.v]); } catch { continue; }
        if (!out.write(`${line}\n`)) await Promise.race([once(out, 'drain'), once(out, 'error').catch(() => {})]);
        n++;
        if (++i % 250 === 0) await new Promise((r) => setImmediate(r)); // callers are answered while the copy is written
      }
      await new Promise((res) => out.end(res));
      if (failed) throw failed;
      renameSync(tmp, file);
      fold(j0);
      lastSave = { at: new Date(t).toISOString(), names: n };
      return n;
    })().catch((e) => { dirty = true; log('mare_disk_write', e?.message); return 0; }).finally(() => { writing = null; });
    return writing;
  }
  const timer = setInterval(() => { if (dirty) save(); }, everyMs); timer.unref?.();

  return {
    async get(k) { const x = m.get(k); if (!x) return null; if (x.e && x.e < now()) { m.delete(k); return null; } return structuredClone(x.v); },
    async set(k, v, ttl) { m.set(k, { v: structuredClone(v), e: ttl ? now() + ttl * 1000 : 0 }); dirty = true; },
    // at once: the name is on the disk when this returns (true), or the write failed and says so (false; it is in memory)
    setNow(k, v, ttl) {
      const e = ttl ? now() + ttl * 1000 : 0, x = structuredClone(v);
      m.set(k, { v: x, e }); dirty = true;
      let line; try { line = `${JSON.stringify([k, e, x])}\n`; } catch { return false; }
      try { const fd = openSync(jfile, 'a'); try { writeSync(fd, line); fsyncSync(fd); } finally { closeSync(fd); } atOnce++; return true; } catch (err) { log('mare_disk_write', err?.message); return false; }
    },
    ready, save,
    // the last pass, for the moment the node is asked to stop
    async close() { clearInterval(timer); if (writing) await writing; return save(); },
    state: () => ({ names: m.size, loaded, lastSave, waiting: dirty, atOnce }),
  };
}

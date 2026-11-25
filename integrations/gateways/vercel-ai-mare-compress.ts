/**
 * Mare Liberum /compress as Vercel AI SDK middleware: long tool results reach the model smaller, without loss.
 *
 * What it does: in transformParams, every tool result of the prompt (messages with role "tool", parts of
 * type "tool-result" whose output is text, JSON or text content) of at least minChars characters (default
 * 2,000) goes to POST https://mareliberum.dev/compress, which gives it back made smaller by lossless steps
 * only (HTML as Markdown, JSON minified or as TOON, whitespace, a line said twice said once). The answer
 * replaces the output only when it is smaller in UTF-8 bytes; a JSON output that comes back smaller (as TOON)
 * is passed on as text. In every other case the original stays.
 *
 * What leaves your program: the text of those tool results and nothing else of the call (no prompt, no key).
 * mareliberum.dev keeps none of it: nothing sent to /compress is stored or logged, only its size is counted
 * (https://mareliberum.dev/engine). Leave this middleware out for tool results you may not send to a third
 * party.
 *
 * Fails open: an error, a timeout (timeoutMs per text, default 4,000), a busy or resting /compress or an
 * answer that is not smaller keeps the original output; transformParams never throws. Answers are remembered
 * in memory (256 texts, by SHA-256 of the text), so a conversation sent again sends no text twice and keeps
 * the same prefix for prompt caching. No packages: fetch and Web Crypto, as in Node 18+, edge runtimes and
 * browsers (pass your own fetch behind a proxy).
 *
 * Use (AI SDK 7; for AI SDK 6 pass { specificationVersion: 'v3' }; the tool results are the same in 5, 6 and 7):
 *
 *   import { wrapLanguageModel } from 'ai';
 *   import { mareCompress } from './vercel-ai-mare-compress';
 *
 *   const model = wrapLanguageModel({ model: yourModel, middleware: mareCompress() });
 */
export const MARE_COMPRESS_URL = 'https://mareliberum.dev/compress';
const MAX_BYTES = 1024 * 1024; // the most /compress takes

export type MareCompressOptions<V extends 'v3' | 'v4'> = {
  url?: string;
  minChars?: number;
  timeoutMs?: number;
  maxTexts?: number; // at most this many texts sent per call (default 8)
  fetch?: typeof fetch;
  specificationVersion?: V;
};

export function mareCompress<V extends 'v3' | 'v4' = 'v4'>(opts: MareCompressOptions<V> = {}) {
  const url = opts.url ?? MARE_COMPRESS_URL, minChars = opts.minChars ?? 2000, timeoutMs = opts.timeoutMs ?? 4000, maxTexts = opts.maxTexts ?? 8;
  const send = opts.fetch ?? globalThis.fetch;
  const memory = new Map<string, string | null>();
  const utf8 = new TextEncoder(), bytes = (s: string) => utf8.encode(s).length;
  const keyOf = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(s))), (b) => b.toString(16).padStart(2, '0')).join('');

  // one text through /compress: the smaller text, or null to keep the original
  async function squeeze(text: string, body: { text: string } | { json: unknown }, left: { n: number }): Promise<string | null> {
    if (text.length < minChars || bytes(text) > MAX_BYTES) return null;
    const key = await keyOf(text);
    if (memory.has(key)) { const v = memory.get(key) ?? null; memory.delete(key); memory.set(key, v); return v; }
    if (left.n <= 0) return null;
    left.n--;
    let out: string | null = null;
    try {
      const r = await send(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) return null; // not remembered: the next call asks again
      const a: any = await r.json();
      out = a && typeof a.out === 'string' && a.lossy === false && a.tokens?.saved > 0 && bytes(a.out) < bytes(text) ? a.out : null;
    } catch {
      return null;
    }
    memory.set(key, out);
    if (memory.size > 256) memory.delete(memory.keys().next().value as string);
    return out;
  }

  // a tool result's output, smaller, or null to keep it
  async function squeezeOutput(o: any, left: { n: number }): Promise<any | null> {
    if (o?.type === 'text' && typeof o.value === 'string') {
      const out = await squeeze(o.value, { text: o.value }, left);
      return out == null ? null : { ...o, value: out };
    }
    if (o?.type === 'json' && o.value !== undefined) {
      const out = await squeeze(JSON.stringify(o.value), { json: o.value }, left);
      return out == null ? null : { type: 'text', value: out, ...(o.providerOptions ? { providerOptions: o.providerOptions } : {}) };
    }
    if (o?.type === 'content' && Array.isArray(o.value)) {
      let changed = false;
      const value: any[] = [];
      for (const c of o.value) {
        const out = c?.type === 'text' && typeof c.text === 'string' ? await squeeze(c.text, { text: c.text }, left) : null;
        if (out != null) { value.push({ ...c, text: out }); changed = true; } else value.push(c);
      }
      return changed ? { ...o, value } : null;
    }
    return null;
  }

  return {
    specificationVersion: (opts.specificationVersion ?? 'v4') as V,
    async transformParams({ params }: { params: any; type?: 'generate' | 'stream'; model?: unknown }): Promise<any> {
      try {
        if (!Array.isArray(params?.prompt)) return params;
        const left = { n: maxTexts };
        let changed = false;
        const prompt: any[] = [];
        for (const m of params.prompt) {
          if (m?.role !== 'tool' || !Array.isArray(m.content)) { prompt.push(m); continue; }
          let touched = false;
          const content: any[] = [];
          for (const p of m.content) {
            const output = p?.type === 'tool-result' ? await squeezeOutput(p.output, left) : null;
            if (output) { content.push({ ...p, output }); touched = true; } else content.push(p);
          }
          prompt.push(touched ? { ...m, content } : m);
          changed ||= touched;
        }
        return changed ? { ...params, prompt } : params;
      } catch {
        return params; // fail open: the call goes on as it came
      }
    },
  };
}

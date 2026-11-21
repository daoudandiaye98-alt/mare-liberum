// Mare Liberum · the database tells a node where it is
// A node on its own server makes a secret of its own; the sea's database stores only the SHA-256 of it (mare.keys).
// A server that proves it holds such a secret is told the address of the database and the public key to send along.
// Nothing in this file is secret: the proof is the server's own secret, and the database is the one that checks it.
// Deployed as a Supabase Edge Function named "mare-node-config" (it does its own check, so it runs without a JWT).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST { secret }" }, 405);
  let secret = "";
  try { secret = String((await req.json())?.secret ?? ""); } catch { /* not JSON */ }
  if (secret.length < 32 || secret.length > 256) return json({ error: "not allowed" }, 403);
  const url = Deno.env.get("SUPABASE_URL") ?? "", key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !key) return json({ error: "not ready" }, 503);
  // the database itself says whether it knows this secret: the long memory answers only to a writer
  let ok = false;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/mare_mem_get`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ secret, ks: [] }),
    });
    await r.body?.cancel();
    ok = r.ok;
  } catch { /* the database did not answer */ }
  if (!ok) return json({ error: "not allowed" }, 403);
  return json({ url, key });
});

// Mare Liberum · the card till: a node that proves its secret has one Stripe Shared Payment Token charged (MPP, since 3.48)
// The restricted Stripe key (STRIPE_MPP_KEY: PaymentIntents write) lives only in this function's secrets. The node never sees
// it: the node sends its own secret (checked by the database, as in mare-node-config), the token, the challenge id and the
// amount; this function creates and confirms one PaymentIntent (idempotent per challenge and token) and answers its status.
// Only amounts of 0.50 to 100.00 USD are taken. Nothing here is secret; deployed as the Edge Function "mare-mpp" (it does
// its own check, so it runs without a JWT).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const SPT = /^spt_[A-Za-z0-9]{8,64}$/, CH = /^[A-Za-z0-9_-]{8,64}$/;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST { secret, spt, challenge, amount, currency }" }, 405);
  let b: Record<string, unknown> | null = null;
  try { b = await req.json(); } catch { /* not JSON */ }
  const secret = String(b?.secret ?? "");
  if (secret.length < 32 || secret.length > 256) return json({ error: "not allowed" }, 403);
  const spt = String(b?.spt ?? ""), ch = String(b?.challenge ?? ""), amount = Number(b?.amount), currency = String(b?.currency ?? "");
  if (!SPT.test(spt) || !CH.test(ch) || !Number.isSafeInteger(amount) || amount < 50 || amount > 10_000 || currency !== "usd") return json({ error: "bad request" }, 400);
  const url = Deno.env.get("SUPABASE_URL") ?? "", anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "", key = Deno.env.get("STRIPE_MPP_KEY") ?? "";
  if (!url || !anon || !key) return json({ error: "not ready" }, 503);
  // the database itself says whether it knows this secret: the long memory answers only to a writer
  let ok = false;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/mare_mem_get`, {
      method: "POST",
      headers: { apikey: anon, authorization: `Bearer ${anon}`, "content-type": "application/json" },
      body: JSON.stringify({ secret, ks: [] }),
    });
    await r.body?.cancel();
    ok = r.ok;
  } catch { /* the database did not answer */ }
  if (!ok) return json({ error: "not allowed" }, 403);
  const form = new URLSearchParams({
    amount: String(amount),
    currency,
    confirm: "true",
    "payment_method_data[shared_payment_granted_token]": spt,
    "automatic_payment_methods[enabled]": "true",
    "automatic_payment_methods[allow_redirects]": "never",
    description: String(b?.description ?? "Mare Liberum").slice(0, 200),
    "metadata[challenge_id]": ch,
    "metadata[source]": "mare-mpp",
  });
  let r: Response;
  try {
    r = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": `${ch}_${spt}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch { return json({ ok: false, message: "Stripe did not answer" }, 502); }
  let p: Record<string, any> | null = null;
  try { p = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) return json({ ok: false, status: r.status, code: p?.error?.code ?? null, message: String(p?.error?.message ?? "Stripe refused the payment").slice(0, 300) }, 402);
  return json({ ok: p?.status === "succeeded", status: p?.status ?? null, id: p?.id ?? null, amount: p?.amount_received ?? null, currency: p?.currency ?? null });
});

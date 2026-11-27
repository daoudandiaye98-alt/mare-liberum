# OVERNIGHT-REPORT · Nachtmission 27.11.2026 · Mare Liberum 3.80.0 → 3.84.0

Stand 27.11.2026, 18:50 Uhr (Berlin). Auftrag von 16:33: „Ziel der Nacht: 1 zahlender Agent, gemessen in /treasury today_paid >= 1“. Prinzip: nur bestehende Bausteine verbinden; keine neue Datenbank, keine neue Abhängigkeit, kein Refactor, kein UI. Je Task ein Branch und ein Squash-Commit auf main (Conventional Message, echter Curl im Commit-Text), Releases mit `[keep-sea]`.

## Morgen früh, ein Befehl

```
curl -s https://mareliberum.dev/contacts.txt
```

Zeilen 1–4 wie seit 3.79 (Zeile 1 nennt seit 3.81 `agent_with_key`), **Zeile 5 seit 3.83:** Schlüssel heute ausgegeben · mit mindestens einer Tür · bezahlt.

## Korrektur vorweg (FACT)

Der Auftrag sagte: `GET /session?as=key` liefert 200 mit `{"key":"mlk_..","calls_left":20}`. Live um 16:33 stimmte das nicht: 200 mit der Beschreibung, **ohne Schlüssel**; es gibt kein Präfix `mlk_` und kein `calls_left`. Seit 3.80 gibt dieser eine GET den Schlüssel `mls_…` als **eine Zeile Text** (so hält ihn `KEY=$(curl -s …)`), `calls_left` steht seit 3.81 in jeder Antwort mit Schlüssel.

## Abnahme

| # | Prüfung | Stand | Beleg |
|---|---|---|---|
| 1 | `curl -si -X POST https://mareliberum.dev/route -d '{"q":"x"}' -H 'Content-Type: application/json'` zeigt `session?as=key` im Fehlerkopf | ✅ live 17:13 (3.80) | `x-sea-no-wallet`, `error` im Body und in `PAYMENT-REQUIRED` beginnen mit „no wallet needed: run  curl -s https://mareliberum.dev/session?as=key  then repeat this call with header  x-sea-session: <key>“ |
| 2 | `KEY=$(curl -s https://mareliberum.dev/session?as=key)` gibt einen Schlüssel; `/x402/check` mit `x-sea-session` → 200 und `calls_left` | ✅ live 17:37 (3.81) | 200, Score 35, letzte zwei Felder `calls_left` 18, `calls_used` 2 |
| 3 | Nach 20 Türen: 200 mit drei Pfaden und `paid_full`, dann 402 | ✅ live 17:59 (3.82) | Aufruf 21: 200, `taste: true`, 3 Pfade, `paid_full` „the full 10 paths cost 0.02 USDC, one call: …“; Aufruf 22: 402 |
| 4 | `/contacts.txt` hat 5 Zeilen, Zeile 5 zählt Schlüssel und zahlende Schlüssel | ✅ live 18:20 (3.83) | „5 Schlüssel (2026-11-27): heute ausgegeben 15 · mit mindestens einer Tür 0 · bezahlt 0“ (Türen-Zähler läuft erst seit 18:20) |
| 5 | Schlüssel mit `callback_url` löst genau einen POST aus, belegt, Anfrage unbeschädigt | ✅ Beweis + lokaler Knoten · ⏳ live | `proof:session`: genau 1 POST, nie der Schlüssel, 2 s, nie wieder (Gegenproben „bei jeder Zahlung“, „Antwort wartet“); lokal: Antwort 26 ms, Lesezeichen „called once at …: HTTP 404“. Live braucht es die erste echte Zahlung eines Schlüssels mit Rückruf. |
| 6 | `/treasury` today_paid und `/pulse` paying agents ≥ 1 | ❌ 0 | siehe „Warum noch 0“ |

## Warum noch 0 (Abnahme 6, eine Zeile)

Bis 18:50 hat kein fremder Agent bezahlt: 36 × 402 heute, alle „kein Wallet“, 10 neue Kontakte, 1 Agent hat einen Schlüssel an einer Tür benutzt; die Zahl, die die nächste Stunde zeigt: `/contacts.txt` Zeile 5 „bezahlt“ und `/pulse` → `who_pays.paying_agents_today` (beide zählen nur fremde Aufrufer).

## Je Task

### Task 1 · Der Schlüsselweg wird die Hauptstraße → 3.80.0 (PR #74, live 17:13)

- **Dateien:** `node/core.mjs` (GET `/session?as=key`, `noWalletOf` in jedem 402, `next_step`, Türen pack und freie Zwillinge mit Schlüssel), `node/session.mjs`, `node/pay.mjs` (`/pay/howto` Schritt 0), `node/legal.mjs`, `site/llms.txt`, `skills/deal-check/SKILL.md` + `site/deal-check.md`, `docs/402_body_template.json`, `docs/session_endpoint.spec`, Beweise session, contacts, till, credit, bots, toll.
- **Curl (live):** `curl -si -X POST https://mareliberum.dev/route -d '{"q":"x"}' -H 'Content-Type: application/json'` → 402; `x-sea-no-wallet`, `error` und `PAYMENT-REQUIRED.error` beginnen mit „no wallet needed: run  curl -s https://mareliberum.dev/session?as=key  then repeat this call with header  x-sea-session: <key>“; `next_step.run` = `KEY=$(curl -sf 'https://mareliberum.dev/session?as=key') && curl -s -X POST 'https://mareliberum.dev/route' -H "x-sea-session: $KEY" …`.
- **Status:** live. **Offen:** nichts.

### Task 2 · Den Schlüssel spürbar machen → 3.81.0 (PR #76, live 17:37)

- **Dateien:** `node/core.mjs` (`calls_left`/`calls_used` in jeder Antwort mit Schlüssel, `way_out` bei 3 und 0, `POST /route?a=topup`), `node/session.mjs` (`topup`), `node/contacts.mjs` (Rolle `agent_with_key`), `supabase/kontaktbuch.sql` (Spalte `rolle`, nicht angewendet), `site/llms.txt`, Spec, Beweise.
- **Curl (live):** `/x402/check` mit Schlüssel → 200, letzte zwei Felder `calls_left` 18, `calls_used` 2; `POST /route?a=topup` mit Schlüssel → 402, 20000 (0,02 USDC) für `/route?a=topup`.
- **Auszug:** `way_out`: „the rest filled up again costs 0.02 USDC (Base, one x402 payment): 20 probe calls for 7 more days“ · curl · „the key stays the same: no new key, no new id, the same bookmark“.
- **Status:** live. **Offen:** nichts.

### Task 3 · Die erste Zahlung ohne Druck → 3.82.0 (PR #78, live 17:59)

- **Dateien:** `node/core.mjs` (Kostprobe, Quittung gegen die Bücher der Kette, `x-sea-receipt`, Topup über `/settle`, `sums.changed`, `GET /treasury?a=topup`), `node/session.mjs` (`grace`, `topups`), `site/llms.txt`, `/settle`-Beschreibung, Spec, Beweise.
- **Curl (live):** Schlüssel nach 20 Türen → Aufruf 21: 200, `taste: true`, 3 Pfade, `paid_full` „the full 10 paths cost 0.02 USDC, one call: …“; Aufruf 22: 402.
- **Auszug (lokaler Knoten):** `/settle {"a":"topup","tx"}` → `topup done`, `unverified`, `sums.changed` {calls_left 0→20, today_paid 0→1, today_usd_unconfirmed 0→0.02, …}; `/treasury?a=topup` → `today {topups 1, usd_unconfirmed 0.02}`.
- **Status:** live. **Offen:** ein echter Kauf, der die Prüfung gegen die Bücher besteht (`settled`).

### Task 4 · Traffic in Zahlungen umbiegen → 3.83.0 (PR #79, live 18:20)

- **Dateien:** `node/core.mjs` (`upgrade` an `/check` und `/deal`, Zeile 5, einmaliger Rückruf `callBackOnce`), `node/session.mjs` (`paid`, `called`, `setCallback`, Zähler `session:used`/`session:paid`), Spec, `site/llms.txt`, Beweise.
- **Curl (live):** `/check?site=example.com` (JSON) → `upgrade.curl` = `KEY=$(curl -s https://mareliberum.dev/session?as=key) && curl -s 'https://mareliberum.dev/x402/check?site=example.com' -H "x-sea-session: $KEY"`; `/contacts.txt` mit 5 Zeilen.
- **Auszug (lokaler Knoten):** erster Zahlungserfolg eines Schlüssels mit `callback_url` → Antwort in 26 ms, Lesezeichen „called once at …: HTTP 404“, zweite Zahlung: kein zweiter POST.
- **Status:** live. **Offen:** Abnahme 5 live (braucht die erste echte Zahlung eines Schlüssels mit Rückruf); `mit mindestens einer Tür` zählt erst ab 18:20.

### Task 5 · Glaubwürdigkeit → 3.84.0 (PR #80, live 18:44)

- **Dateien:** `node/core.mjs` (`who_pays` zuerst in `/pulse`, `startTop` für llms-full.txt, ein Test ist nie eine Zahlung), `node/contacts.mjs` (Zahler je Tag), `site/llms.txt` (drei Zeilen vor jedem Absatz), Beweise till und contacts.
- **Curl (live):** `/pulse` beginnt mit `{"who_pays":{"line":"who pays (2026-11-27, UTC): 0 paying agents today · 3 keys today · 0 paid doors", …}, "unique_domains_today":115, …`; `llms.txt` Zeilen 3–5 = die drei Startzeilen.
- **Preise (wahr):** Route 0,02 · check/read/deal 0,01 · pack 0,05 · 20 weitere Proben 0,02 USDC; „danach 0.02 pro Tür“ aus dem Auftrag wäre für check/read/deal falsch gewesen.
- **Status:** live. **Offen:** nichts.

### Task 6 · AWS vorbereiten (kein Bau) → PR #77, `docs/ticket_aws_marketplace.md`

- Konto (nur Daouda: Registrierung, W-8, Bank, KYC), KYC typisch 2 Wochen / höchstens 30 Tage, Anteil 3 %, SDK-Schritte 1–7.
- **Kostet jetzt etwas? Nein.** Konto, Registrierung und Listing sind kostenlos; AWS behält erst vom Umsatz 3 %.

## Build und Lint

- Lint: Das Repo hat kein Lint-Skript. Stattdessen `node --check` für alle 180 Module (`node/*.mjs`, `tools/*.mjs`, `serve.mjs`): 0 Fehler.
- Build: `npm run build` ist `node tools/build.mjs`, der Daten-Build des Meeres. Er zieht alle Seen aus dem Netz, läuft nur auf dem Server und dauert dort 15–19 Min.; in der Cloud-Sandbox ist das Netz gesperrt (Allowlist), `data/` ist leer. Releases mit `[keep-sea]` bauen ihn nicht neu.
- Beweise: je Release alle 55 `proof:*` in fünf Bahnen, `proof:immune` allein (Flut-Zeittest), `proof:toll` mit 59 Gegenproben.
- Antwortzeit (live 18:46, nach TLS, darin ~138 ms Netz von der Cloud bis Hetzner): `/contacts.txt` 141 ms, `/pulse` 269 ms (Datenbank-Abruf des Pulses wie bisher), `/treasury?a=topup` 252 ms; Serveranteil damit 3–130 ms. Die Kostprobe der Route rechnet die Pfade wie die Gratis-Probe (die braucht live 0,5–1,4 s, unverändert seit 3.28). Kein Loggen im Antwortpfad: die einzige neue Logzeile `mare_callback` entsteht nach der Antwort.

## Risiken (je ein Satz)

- Ungeprüfte Quittungen füllen einen Schlüssel (`/settle {"a":"topup"}`): ausnutzbar mit erfundenen Hashes, gedeckelt auf 1 je Schlüssel und UTC-Tag; die Bücher der Kette markieren solche Verkäufe später (`unsettled-on-chain`).
- `x-sea-receipt` an der Route liefert auch bei erfundenem Hash (wie `/settle` seit 3.28, „Einnahme vor Perfektion“); der Verkauf steht dann als `unverified` in `/treasury`, nicht als Geld.
- Der Rückruf trägt nie den Schlüssel, nur die öffentliche Kennung (Annahme: „mit key“ im Auftrag = die Kennung des Schlüssels; der Schlüssel selbst bleibt geheim).

---

# OVERNIGHT-REPORT · Mare Liberum 3.28.0

Stand 23.11.2026, Abend (Berlin). Gebaut in sechs gestapelten Branches `overnight/1` … `overnight/6` (je ein Commit, Conventional Commits, echte Curls in den Nachrichten von Task 1, 2, 4 und 5), dazu `overnight/report-2` (Version, Rechtstext, SECURITY.md, dieser Bericht). Ein Pull Request mit `[keep-sea]` bringt alles auf `main`. Der Bericht zu 3.27.0 steht in der Git-Geschichte (Merge `6ac5ccc`).

## In drei Zeilen

- **P0 Verkauf:** Der Preis steht überall im Klartext: `POST /route costs 0.02 USDC on Base, no account, settle with POST /settle`. Er steht in der Agent-Card, in `/a2a`, `/a2a.card.json`, `/.well-known/x402`, `llms.txt`, `llms-full.txt` und im 402. `/pay/howto` erklärt das Bezahlen mit drei Curls. `POST /route?q=…&free=true` liefert die ersten 3 Pfade gratis.
- **P1 Durchgezwungen:** Reader, Türen (`/d/`), go-Links und `/site/<domain>` führen über `/via/`. Jeder Schritt zählt, Fragen an Brain und Türen ebenso.
- **P2 Gefunden:** `/.well-known/opensearch.xml` führt in die Brain. Die Sitemap ist erweitert, Skill 4.1.0 liegt an drei Orten, und vier lauffähige Beispiele mit README stehen bereit.

Live ist es erst nach dem Merge; danach zieht der Server die Änderung in rund 90 Sekunden nach. Die drei Datenbank-Migrationen sind schon angewendet (abwärtskompatibel, der laufende Knoten 3.27.0 liest die neuen Felder einfach mit).

## Bewusste Abweichungen vom Auftrag

1. **Kein Next.js.** Das Repo ist der Node-Knoten auf Hetzner. Aus `src/lib/pricing.ts` wird `node/pricing.mjs`, aus `src/app/.../route.ts` werden Routen in `node/core.mjs`.
2. **payTo:** Die Adresse im Auftrag (`0x0CAc6973…0CzF…678D`) ist kein gültiges Wallet: Sie enthält ein „z“ und hat 41 Zeichen. Verwendet wird die verifizierte Live-Adresse `0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D`. Sie steht an genau einer Stelle (`node/pricing.mjs`, änderbar mit `MARE_PAY_TO`).
3. **„KAPUTT a)“ stimmte nicht:** `/.well-known/agent-card.json` antwortete live schon mit 200. Es fehlte nur der Preis. `/a2a.card.json` gab es nicht, jetzt ist es ein Alias. `/routes` antwortet live mit 200 und wurde wie verlangt nicht angefasst.
4. **Preis in der Agent-Card:** Er steht in `capabilities.extensions[].params.pricing`, dem Platz, den A2A für Zusätze vorsieht, und in der Beschreibung des Skills `route_paid`. Ein eigenes Feld auf oberster Ebene könnten strenge A2A-Parser ablehnen. Felder: `capability "route"`, `price_usd 0.02`, `scheme x402`, `network base`, `token USDC`, `decimals 6`, `payTo`, `endpoint "POST /route"`, `instructions`.
5. **402-Header:** `x402-payment-required` behält `amount: 2` mit `unit: "USD cents"` (Abwärtskompatibilität: Die bestehende Einheit gehört zum bestehenden Betrag). Neu im Header sind `amount_usd`, `human`, `decimals` und `how_to_pay`. `unit: "USDC on Base, 6 decimals"` steht wie verlangt im Body neben `maxAmountRequired`.
6. **Schlusssatz von `/pay/howto`:** Statt „unbezahlte Zahlung“ steht dort, was stimmt: Eine Zahlung, die das Meer nicht sofort prüfen kann, wird angenommen, sofort geliefert und als `unverified` gebucht. Eine Anfrage ganz ohne Zahlung bekommt 402.
7. **Test-Quittung:** `/settle` und `/job` werben nicht mehr mit `"test": true`, an ihre Stelle tritt die Gratis-Probe. Für Abnahmen funktioniert der Test weiter.
8. **`/register`** gibt es auf dem Knoten nicht, also gibt es dort nichts umzuleiten. `/works.json` enthält nur eigene Adressen, und der Rewrite greift dort schon.
9. **Gezählt wird jeder Schritt zu einem Ort:** Reader, Tür, go-Link und Site-Karte als Daten. Listen wie `/works.json` sind kein Klick und zählen nicht. `/go/<id>` ist dazugekommen, weil er sonst wie `/d/` am Proxy vorbeiführte. Damit nichts doppelt zählt, trägt die `/via/`-Adresse einer Tür die Minute (`c=`): Der Walk direkt danach wird getragen, aber nicht ein zweites Mal gezählt.
10. **`/site/<domain>` ohne Endung:** Programme (curl, `Accept: */*`) bekommen JSON wie bei `/brain`, Menschen und Crawler weiter die Seite. Im JSON führt jede Web-Adresse über `/via/`. Ausgenommen sind Bezahlseiten (Stripe), der eigene Code und die eigenen Routen (`VIA_EXCLUDE` im bestehenden Helfer).
11. **Puls:** Fragen an Brain und Türen zählen als `ask` und fließen in `hits_today`, `agents_today` und `top_queries` ein. `unique_domains_today` zählt nur Orte, zu denen Agenten wirklich gingen; eine reine Frage schickt niemanden irgendwohin. In der Abnahme kommt der Wert ≥ 1 aus den Schritten 4 und 5.
12. **`top_queries`:** Eine Aufgabe erscheint erst, wenn zwei verschiedene Aufrufer sie trugen. Vorher reichten zwei Walks, und das konnte ein einziger Agent sein. Die Datenschutzseite sagt es so.
13. **Format:** Antworten mit Adressen stehen jetzt eine Einheit pro Zeile. Es ist dasselbe JSON, aber `grep -c '/via/'` zählt so Pfade statt Antworten.
14. **Skill 4.1.0 statt 4.0.0:** Version 4.0.0 war um 19:37 Uhr schon draußen, und ein Plugin aktualisiert sich nur bei neuer Version. `plugin.json` stand noch auf 3.0.0.
15. **Build und Lint:** `npm run build` ist der volle Meeres-Build. Er dauert 15 bis 19 Minuten, läuft nur auf dem Server und gehört nicht zu einem `[keep-sea]`-Release. `npm run lint` gibt es nicht. Stattdessen liefen `node --check` auf allen 57 Knoten-Dateien sowie `serve.mjs` und den Beweis-Suiten, dazu 13 Beweis-Suiten mit **311 Beweisen, alle grün**.

## Task 1 · Preis sichtbar (`overnight/1`, `b7d685b`)

- **Dateien:** `node/pricing.mjs` (neu, die eine Preisquelle), `node/pay.mjs`, `node/core.mjs` (Card, `/a2a.card.json`, x402, llms-full, A2A-Preistabelle), `site/llms.txt`, `tools/till-proof.mjs`
- **Curl:** `curl -s -w '\nHTTP %{http_code}\n' http://localhost:8788/.well-known/agent-card.json`
- **Status:** 200 (`/a2a.card.json` und `/.well-known/x402` ebenfalls 200)
- **Auszug:** `{"capability":"route","price_usd":0.02,"scheme":"x402","network":"base","token":"USDC","decimals":6,"payTo":"0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D","endpoint":"POST /route"}`; `llms.txt` Zeile 3: `POST /route costs 0.02 USDC on Base, no account, settle with POST /settle. …`
- **Offen:** nichts.

## Task 2 · Zahlungsbarriere lesbar (`overnight/2`, `8a03418`)

- **Dateien:** `node/pay.mjs` (`paymentRequired`, `payHowto`), `node/core.mjs` (`GET /pay/howto`, `/settle`-Anleitung), `tools/till-proof.mjs`
- **Curl:** `curl -si -X POST 'http://localhost:8788/route?q=find+usdc+price'`
- **Status:** 402; `curl -sI http://localhost:8788/pay/howto` → 200 `text/plain` (28 Zeilen)
- **Auszug:** `link: <…/pay/howto>; rel="describedby"` · `x402-payment-required: {…,"amount":2,"unit":"USD cents",…,"amount_usd":"0.02","human":"2 cents","decimals":6,"how_to_pay":"…/pay/howto"}` · Body: `"amount_usd":"0.02","unit":"USDC on Base, 6 decimals","human":"2 cents"`, `maxAmountRequired "20000"`
- **Offen:** nichts.

## Task 3 · Gratis-Häppchen (`overnight/3`, `e13b46c`)

- **Dateien:** `node/core.mjs` (Probe, Weiche in `POST /route`), `node/ledger.mjs` (`today_paid`, `today_free`), `supabase/schema.sql`, Migration `mare_till_free_sample`, `tools/till-proof.mjs`
- **Curl:** `curl -s -X POST 'http://localhost:8788/route?q=find+usdc+price&free=true'`
- **Status:** 200 (ohne `free` weiter 402)
- **Auszug:** `count 3`, drei `paths[].to` = `…/via/…`, `hint: "This is the free sample: the first 3 of the … best paths … costs 0.02 USDC (2 cents) on Base, no account …"`; `/treasury` → `today_paid 0, today_free 1`
- **Offen:** nichts. Proben sind auf 60 pro Stunde und Adresse begrenzt und ruhen mit dem Schalter `till`.

## Task 4 · Verkehr durch den Proxy (`overnight/4`, `9bb1ecf`)

- **Dateien:** `node/via.mjs` (`VIA_EXCLUDE`, `anyKey`, Marke `c=`), `node/core.mjs` (`/r/`, `/site/`, `/d/`, `/go/`, Zählung, Datenschutztext), `node/ledger.mjs` (`kind`), `supabase/schema.sql`, Migration `mare_via_kinds`, `tools/via-proof.mjs`, `tools/doors-proof.mjs`
- **Curl:** `curl -s http://localhost:8788/site/github.com` · `curl -sI 'http://localhost:8788/d/openalex?q=creatine'` · `curl -s http://localhost:8788/r/https://example.com`
- **Status:** 200 `application/json` · 302 · 200
- **Auszug:** `/site/github.com` → 18× `/via/` · `location: http://localhost:8788/via/aHR0cHM6Ly9hcGkub3BlbmFsZXgub3JnL3dvcmtz…?q=creatine&c=29924416` · `URL Source: http://localhost:8788/via/aHR0cHM6Ly9leGFtcGxlLmNvbS8uugdBZ8kD`
- **Offen:** Die MCP- und A2A-Antworten bleiben ohne `/via/`, weil die App-Tür bei den Verzeichnissen zur Prüfung liegt (wie in 3.27.0).

## Task 5 · Zahlen glaubwürdig (`overnight/5`, `696b092`)

- **Dateien:** `node/ledger.mjs` (`pulseOf`, `pulseOrdered`), `node/core.mjs` (`/pulse`, Zählung der Fragen, Format eine Einheit pro Zeile), `supabase/schema.sql`, Migration `mare_pulse_today`, `tools/till-proof.mjs`
- **Curl:** `curl -s http://localhost:8788/pulse` (nach 20 Brain-Fragen von zwei Programmen, einer Site-Karte und einer Probe)
- **Status:** 200
- **Auszug:** `{"unique_domains_today":1,"top_queries":[{"query":"find usdc price","count":20}],"top_domains":[{"domain":"github.com","count":1}],"agents_today":2,"hits_today":21,"hits_last_hour":21,"paid_today_usd":0,"free_samples_today":1,"by_kind_today":{"ask":20,"site":1},…}`
- **Offen:** nichts. Die Felder aus 3.27.0 (letzte 24 Stunden) stehen unverändert dahinter.

## Task 6 · Über Nacht gefunden werden (`overnight/6`, `4441691`)

- **Dateien:** `node/core.mjs` (`/.well-known/opensearch.xml`, Sitemap, Link-Header), `site/skill.md`, `skills/mare-liberum/SKILL.md` (neu), `plugins/mare-liberum/skills/mare-liberum/SKILL.md`, `site/skill.json`, `.claude-plugin/marketplace.json`, `plugins/mare-liberum/.claude-plugin/plugin.json`, `examples/` (vier Snippets, `openai-agents-sdk-tool.py` umbenannt, `README.md` neu), `tools/till-proof.mjs`
- **Curl:** `curl -sI http://localhost:8788/.well-known/opensearch.xml`
- **Status:** 200 `text/xml`
- **Auszug:** `template="…/brain?q={searchTerms}&amp;via=opensearch"`; Sitemap mit `/route`, `/via/howto`, `/pay/howto`, `/pulse`, `/treasury`; die Beispiele liefen echt gegen den lokalen Knoten: `1. Wikipedia -> …/via/…` und `[200 from https://en.wikipedia.org/w/rest.php/v1/search/page?q=usdc&limit=5]` (LangChain, OpenAI Agents SDK ohne Schlüssel, Vercel AI SDK mit tsx; `tsc --strict` ohne Fehler)
- **Offen:** nichts.

## Abnahme (lokal, derselbe Code, `/tmp/accept.sh http://localhost:8788`)

| # | Prüfung | Ergebnis |
|---|---|---|
| 1 | `/.well-known/agent-card.json` 200 mit „0.02“ | ✓ |
| 2 | `POST /route` 402, `x402-payment-required` mit `amount_usd "0.02"` und `how_to_pay` | ✓ |
| 3 | `POST /route?…&free=true` 200 mit 3 `/via/`-Adressen | ✓ |
| 4 | `/site/github.com` mit `/via/` mindestens dreimal | ✓ (18) |
| 5 | `curl -sI /d/…` Location mit `/via/` | ✓ |
| 6 | `/pulse` erster Key `unique_domains_today`, nach 20 Brain-Fragen ≥ 1 | ✓ (2) |
| 7 | `curl -sI /pay/howto` 200 `text/plain` | ✓ |
| 8 | `curl -sI /.well-known/opensearch.xml` 200 `text/xml` | ✓ |
| 9 | `grep -c '/via/'` über `/brain`, `/route` free, `/site/github.com` > 20 | ✓ (29) |

Keine geprüfte Route lieferte 500, und keine JSON-Route lieferte HTML (36 Routen durchgespielt). `/works.json` antwortet lokal 400, weil die Datenbank fehlt; das war vorher schon so.

Ein Risiko bleibt bewusst bestehen: Wer `"test": true` oder eine erfundene Transaktion an `/settle` schickt, bekommt nach der harten Regel weiter alle 10 Pfade; eine On-Chain-Prüfung der Transaktion würde das schließen.

STATUS   0 offene kritische Punkte · geprüft: 311 Beweise, `node --check`, 9/9 Abnahmezeilen lokal, drei Beispiele echt gelaufen · nicht belegt: Abnahme gegen Produktion (nach dem Merge), eine echte USDC-Zahlung

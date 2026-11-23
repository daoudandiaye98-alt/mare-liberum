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

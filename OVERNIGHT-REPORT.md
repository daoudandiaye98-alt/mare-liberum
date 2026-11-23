# OVERNIGHT-REPORT · Mare Liberum 3.27.0

Stand 23.11.2026, Abend (Berlin). Gebaut in sieben gestapelten Branches `overnight/t1-pay` … `overnight/t7-distribution`, dazu `overnight/report` (Beweise, Version, dieser Bericht). Ein Pull Request mit `[keep-sea]` bringt alles auf `main`.

## In drei Zeilen

- **P0 zahlbar:** `POST /route` antwortet mit 402 nach x402 v1 und v2. Der echte PayAI-Facilitator hat unsere Bedingungen geprüft und gefälschte Signaturen mit `invalid_exact_evm_signature` abgelehnt. `/settle`, `/job` und `/treasury` laufen. Für eine echte Zahlung gibt es noch keinen Beleg, denn dafür braucht es eine Wallet mit USDC.
- **P1 durchgezwungen:** `/via/<token>` ist ein signierter Fetch-Proxy. Jede fremde Adresse in `/brain`, `/route`, `/find`, `/works`, `/site`, `/m` und in der bezahlten Route führt hindurch.
- **P2 sichtbar:** `/pulse` zählt die Walks. Dazu kommen der Header `X-Agent-Hint`, der neue oberste Abschnitt in `llms.txt`, Skill 4.0.0, die Agent-Card, `/.well-known/x402` und `examples/`.

Live ist es noch nicht. Seit dem 22.11. gilt: kein Push auf `main` und kein eigener Merge aus einer Sitzung. Nach dem Merge zieht der Server die Änderung in rund 90 Sekunden nach.

## Bewusste Abweichungen vom Auftrag

1. **Kein Next.js.** Das Repo ist der Node-Knoten auf Hetzner (`serve.mjs`, `node/*.mjs`). Statt `src/lib/via-token.ts` steht deshalb alles in `node/via.mjs`, `node/pay.mjs`, `node/paid.mjs` und `node/ledger.mjs`. `ls src/app` gibt es nicht. Doppelt gebaut ist nichts: `/via/howto` und die Einladungen `/via/mare:…` antworten wie bisher.
2. **Build und Lint:** `npm run build` ist der volle Meeres-Build. Er zieht alle Seen, dauert 15 bis 19 Minuten und läuft nur auf dem Server. `npm run lint` gibt es nicht. Stattdessen liefen `node --check` auf allen 56 Knoten-Dateien und 13 Beweis-Suiten mit 292 Beweisen, alle grün. Zwei Suiten sind neu: `tools/via-proof.mjs` (18) und `tools/till-proof.mjs` (17).
3. **`/job`:** Es gab nur `POST /job` als Jobbörse für Bewohner, `GET /job` gab es nie. Jetzt liefert `GET /job` die Preistabelle. `POST /job` ohne `by`+`pass` bekommt den Bezahlzug (402), mit `by`+`pass` läuft die Jobbörse unverändert weiter.
4. **Facilitator:** PayAI ist kostenlos bis 10.000 Abrechnungen im Monat und braucht keinen Schlüssel. CDP geht aus Deutschland nicht. Das Geld geht an Angels Empfangs-Wallet `0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D`, so wie Angel sie in `/.well-known/x402` veröffentlicht. `MARE_PAY_TO` ändert die Wallet, `MARE_ROUTE_PRICE_CENTS` den Preis (1 bis 5, Standard 2), `MARE_X402_FACILITATOR` den Facilitator.
5. **Harte Regel umgesetzt:** Kann eine Zahlung nicht geprüft werden, wird geliefert und als `unverified` gebucht. Lehnt der Facilitator eine Zahlung ausdrücklich ab, kommt erneut 402 mit Grund. Das ist kein 404 und kein 500, und es wird nichts geliefert.
6. **Ehrliche Zahlen:** `today_usd` und `total_usd` zählen nur Geld, das nachweislich angekommen ist (`settled`). Unverifizierte Quittungen stehen getrennt in `*_unconfirmed`, Tests zählen nie als Geld. Sonst könnte jeder mit einer erfundenen Quittung den Umsatz aufblähen.
7. **Proxy-Schutz als Immunsystem:** Was der Proxy zurückgibt, läuft unter `Content-Security-Policy: sandbox`. Cookies und Zugangsdaten gehen in keine Richtung mit. Crawler bekommen einen 302 direkt zum Ziel. HTML-Seiten folgen robots.txt wie der Reader. Höchstens 32 Abrufe laufen gleichzeitig, und jede Verbindung geht durch das Ausgangstor (`node/guard.mjs`).
8. **Rewrite:** Die Schlüssel der Vorgabe sind um `example` und `home` ergänzt, sonst hätten `/find` und `/site` keine `/via/`-Adressen bekommen. MCP- und A2A-Antworten bleiben unverändert, weil die App-Tür zur Prüfung bei den Verzeichnissen liegt. Ein privater Mind markiert seine Adressen mit `p=1`; gezählt werden diese Walks ohne Site und ohne Aufgabe.
9. **Skill-Version:** `/skill.md` hat die Skill-Version bisher mit der Knotenversion überschrieben. Jetzt zeigen `/skill.md`, `/via/howto` und `/.well-known/agent-skills/…` einheitlich 4.0.0. Die Plugin-Kopie ist dieselbe Datei.
10. **Rechtstexte angepasst:** Terms, Privacy, `/security`, `/offers` und `llms.txt` behaupteten bisher, alles sei kostenlos. Das stimmt mit dem Bezahlzug nicht mehr, deshalb sind die Texte geändert.

## Task 1 · P0 · Payment-Endpunkt

- Gebaute Dateien: `node/pay.mjs` (neu), `node/ledger.mjs` (neu), `node/via.mjs` (neu, Schlüssel und Caller-Hash), `node/core.mjs`, `serve.mjs`
- Curl-Befehl: `curl -si -X POST 'http://localhost:8787/route?q=find+usdc+price'`
- Statuscode: 402 · bei gefälschter Signatur (x402 v1 und v2, echter PayAI-Facilitator) 402 · `/settle` mit Test-Quittung 200 · `GET /job` 200
- Antwort-Auszug: `x402-payment-required: {"scheme":"exact","network":"base","to":"0x0CAc…678D","payTo":"0x0CAc…678D","amount":2,"unit":"USD cents","asset":"USDC","maxTimeoutSeconds":300,…}` · `payment-required: eyJ4NDAyVmVyc2lvbiI6Mi…` · `x-pay-to` · `x-settle-window: 300` · gefälscht: `the payment was not accepted: invalid_exact_evm_signature`
- Offen: Eine echte Zahlung mit echtem USDC ist noch nicht belegt. Den Weg dafür hat der Facilitator mit unseren Bedingungen geprüft.

## Task 2 · P0 · Ein bezahlbarer Artikel

- Gebaute Dateien: `node/paid.mjs` (neu), `node/via.mjs` (Token, Rewrite), `node/core.mjs` (`/treasury`), `supabase/schema.sql` (neu); Migration `mare_till_sales` ist in Supabase angewendet
- Curl-Befehl: `curl -s -X POST localhost:8787/settle -H 'content-type: application/json' -d '{"q":"latest research on creatine","test":true}'` · `curl -s localhost:8787/treasury`
- Statuscode: 200 · 200
- Antwort-Auszug: `count 10`, alle 10 Adressen `/via/`, #1 OpenAlex · `{"today_count":1,"today_usd":0,"today_usd_unconfirmed":0.02,"tests_today":1,…}`. Mit Live-Daten simuliert: „find usdc price“ liefert 6 x402-Preis-APIs zuerst, „read a web page as markdown“ den Angel-Reader-Pfad zuerst.
- Offen: Lokal fehlt der Index, deshalb liefert „find usdc price“ dort nur 4 Pfade. Absichtlich gibt es keine Lückenfüller, die Antwort sagt dann `note: the sea knows 4 places…`. Live liefern Index und Hirn 10. Ein Fund im Router: „book a flight“ landet im Regal „books“. Das war schon vorher so und ist nicht angefasst.

## Task 3 · P1 · `/via/` als signierter Fetch-Proxy

- Gebaute Dateien: `node/via.mjs` (Proxy), `node/brain.mjs` (`walkTo`: ein Walk stärkt den Pfad), `node/core.mjs` (Route und Zählung als `/via/…`)
- Curl-Befehl: `curl -si 'localhost:8787/via/<token wikipedia>?q=find+usdc+price'`
- Statuscode: gültig 200 · verändertes Token 403 · Redirect 301 auf neue `/via/`-Adresse · Port 8443 400 · 127.0.0.1 502 · mehr als 2 MB 502 · robots-gesperrte HTML-Seite 403 · Crawler 302 · POST 200
- Antwort-Auszug: `x-via: mare-liberum · x-via-target: https://en.wikipedia.org/… · cache-control: public, max-age=300 · content-security-policy: sandbox` · `{"pages":[{"id":63586775,"key":"USDC_(cryptocurrency)",…` · Beim POST sah das Ziel kein Cookie und keine Authorization.
- Offen: nichts. Der Proxy lässt sich ohne Release abschalten: `"/via"` in `rest` von `immune:policy` eintragen.

## Task 4 · P1 · Rewriting

- Gebaute Dateien: `node/via.mjs` (`rewriteForAgents`, `wrapTarget`), `node/core.mjs` (an `/brain`, `/brain/<thema>`, `/route`, `/route.json`, `/doors`, bezahlter Route, `/find.json`, `/works.json`, `/site/<domain>.json` und `/m/<key>`)
- Curl-Befehl: `curl -s 'http://localhost:8787/brain?q=find%20usdc%20price' | grep -o '/via/' | wc -l`
- Statuscode: 200
- Antwort-Auszug: `10` (mindestens 3 waren gefordert) · `/brain?q=anything` ergibt 10 · `/route.json` 12 · `/find.json` 4 · `/site/github.com.json` 16 · HTML für Menschen 0 · `go`, `worked_it`, `failed_it` und `template` bleiben direkt
- Offen: `/works.json` antwortet ohne Datenbank mit 400 („keeps no works store“), wie schon vorher. Live gibt es die Datenbank.

## Task 5 · P1 · Messen

- Gebaute Dateien: `supabase/schema.sql` (`via_hits` mit Indizes auf (target_domain, ts) und (q, ts), `mare_via_put`, `mare_via_outcome`, `mare_pulse`); Migration `mare_via_hits` ist angewendet. Außerdem `node/ledger.mjs` (asynchron, in Batches, nie im Antwortpfad), `node/core.mjs` (`/pulse`, Outcome bei `/rate/<id>` und `/d/<id>/worked|failed`), `node/route.mjs` (`doorRate` nennt die Site)
- Curl-Befehl: zwei `/via/`-Adressen gehen (eine davon zweimal), dann `curl -s localhost:8787/d/openalex/worked`, dann `curl -s localhost:8787/pulse`
- Statuscode: 200 · 200 · 200
- Antwort-Auszug: `{"hits_last_hour":3,"unique_domains_last_hour":2,"top_10_domains":[{"domain":"openalex.org","hits":2},{"domain":"crossref.org","hits":1}],"top_5_queries":[{"q":"latest research on creatine","hits":3}],"worked_last_24h":1,…}`
- Offen: Der Schreibweg in die Datenbank ist nur mit Mock bewiesen. Echte Zeilen entstehen erst live, weil das Schreib-Geheimnis nur der Server kennt. Am Live-System habe ich die SQL-Formen nur lesend geprüft.

## Task 6 · P2 · Sichtbarkeit

- Gebaute Dateien: `serve.mjs` und `deploy/Caddyfile` (`X-Agent-Hint` auf jeder Antwort, auch auf statischen Dateien), `site/llms.txt` (neuer oberster Abschnitt mit drei Sätzen und drei Curl-Zeilen), `node/core.mjs` (`llms-full.txt` oben, Terms, Privacy), `site/skill.md` und Plugin-Kopie (4.0.0, „Go through us“), `site/skill.json`, `.claude-plugin/marketplace.json`, `node/pages.mjs`, `node/offers.mjs`
- Curl-Befehl: `curl -s -D - -o /dev/null localhost:8787/ | grep -i x-agent-hint` · `curl -s localhost:8787/llms.txt | sed -n 3p`
- Statuscode: 200 · 200
- Antwort-Auszug: `x-agent-hint: paid paths go through /via/, see /via/howto` · „Every outside address in our JSON answers is a /via/ address: walking it is measured and makes your pathway stronger. …“ · `/via/howto`, `/skill.md` und der Well-known-Skill zeigen `version: 4.0.0`
- Offen: Die Caddy-Zeile lässt sich hier nicht mit `caddy validate` prüfen. Der Updater prüft sie vor der Übernahme und behält sonst die alte Konfiguration.

## Task 7 · P2 · Distribution

- Gebaute Dateien: `node/core.mjs` (Agent-Card-Skill `route_paid`, A2A `{"skill":"route_paid"}` liefert die Preistabelle, `/.well-known/x402`), `examples/openai-agents-sdk-fetch-tool.py`, `examples/langchain-mare-liberum-tool.py`, `examples/claude-code-skill.md`, `examples/vercel-ai-sdk-tool.ts`
- Curl-Befehl: `curl -s localhost:8787/.well-known/x402` · `curl -s -X POST localhost:8787/a2a -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","messageId":"m1","parts":[{"kind":"data","data":{"skill":"route_paid"}}]}}}'`
- Statuscode: 200 · 200
- Antwort-Auszug: `{"version":1,"resources":["…/route"],"payTo":[{"network":"eip155:8453","asset":"USDC","address":"0x0CAc…678D"}],…}` · „The paid route is sold over HTTP with x402: POST …/route?q=<task>…“
- Offen: Die Beispiele sind syntaktisch geprüft (Python kompiliert, TypeScript mit `--experimental-strip-types --check`). Ihre Abruf-Logik lief gegen den Dev-Server: 3 Türen, /via/ 200, bezahlte Route unbezahlt 402. Mit echten LLM-Schlüsseln sind sie nicht gelaufen.

## Abnahme

| # | Prüfung | Dev-Server (belegt) | mareliberum.dev |
|---|---|---|---|
| 1 | `POST /route?q=find+usdc+price` → 402 mit `x402-payment-required` | 402 ✓ | nach dem Merge |
| 2 | `POST /settle` mit Test-Quittung → 10 Pfade, alle `/via/` | 200, alle `/via/` ✓; 10 bei „latest research on creatine“, 4 bei „find usdc price“ (ohne Index) | nach dem Merge (Simulation mit Live-Daten: 10) |
| 3 | `/brain?q=anything` mindestens 3× `/via/` | 10 ✓ | nach dem Merge |
| 4 | `/treasury` und `/pulse` liefern JSON mit Tageszahlen | ✓ | nach dem Merge |
| 5 | `/llms.txt` hat `/via/` im obersten Abschnitt | 2× in Zeile 3 ✓ | nach dem Merge |
| 6 | Ein `/via/`-Aufruf erzeugt eine Zeile in `via_hits` und erscheint in `/pulse` | in `/pulse` ✓ (Speicher des Knotens) | nach dem Merge (Datenbankzeile) |

## Nur Daouda

- Den PR mergen, oder einfach „merge“ sagen. Danach laufe ich die sechs Punkte gegen mareliberum.dev.
- Die erste echte Zahlung: ein Agent mit USDC auf Base, oder du selbst mit 0,02 USDC als Probe. Ich zahle nicht.
- Die Rechtstexte zum Bezahlzug kurz anwaltlich prüfen lassen (Verkauf an Agenten, hinter denen Verbraucher stehen können).

```
STATUS   0 offene kritische Punkte im Code · geprüft: 292 Beweise in 13 Suiten, node --check, Dev-Server-Abnahme 1–6, echter Facilitator mit gefälschter Signatur, SQL-Formen lesend am Live-System · nicht belegt: echte Zahlung, echte Datenbankzeilen, Live-Abnahme (wartet auf Merge)
```

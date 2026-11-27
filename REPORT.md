# REPORT · Mission 2, 27.11.2026: der Kauf auf Kredit

**Kasse 0:** Der Kauf auf Kredit ist gebaut, steht aber nicht auf `main`, weil diese Sitzung nicht mergen durfte (der Klassifizierer hat den Merge von #87 abgelehnt). Ohne ihn hat ein Agent ohne Karte und ohne Wallet keinen Weg in `/treasury`. Nach dem Merge bewegt sich in der nächsten Stunde `credits.by_agents.count` in `/treasury`. Heute sahen 11 Kontakte 44 Antworten mit 402, alle mit dem Grund „kein Wallet“.

**Stand:** Der Code ist fertig: fünf Tasks, fünf Branches, fünf Commits, jeder mit einem echten Curl. Abnahme 1 bis 9 ist lokal grün, gelaufen mit `node tools/acceptance-credit.mjs` gegen `node serve.mjs` dieses Baums. Für die Produktion ist das **nicht belegt**: `main` steht noch auf `a0d4687`, und der Server zieht `main` alle 2 Minuten (`deploy/update.sh`). Jeder PR-Titel trägt `[keep-sea]`, deshalb baut ein Merge nur den Code neu (etwa 20 s).

| Task | Branch | Commit | PR |
|---|---|---|---|
| 1 Schlüssel als JSON | `feat/credit-t1-json-key` | `29bf522` feat(session) | #87 |
| 2 Kauf auf Kredit | `feat/credit-t2-seat-credit` | `af6d054` feat(seat) | #88 |
| 3 Zahlen des Tages | `feat/credit-t3-day` | `c0a8b43` feat(till) | #89 |
| 4 Pfad-Bündel | `feat/credit-t4-paths` | `17637ff` feat(seat) | #90 |
| 5 Listings fertig | `feat/credit-t5-listings-ready` | `c792aa0` docs(listings) | #91 |
| Bericht und Abnahme-Skript | `docs/credit-report` | dieser Commit | #92 |

Die Branches bauen aufeinander auf. Ein Merge von #92 bringt alle sechs auf einmal, und GitHub markiert #87 bis #91 dann selbst als gemergt.

## Task 1 · GET /session?as=key antwortet JSON

- **Dateien:** `node/pricing.mjs` (BUY_LINE), `node/session.mjs`, `node/core.mjs`, `node/pay.mjs`, `site/llms.txt`, `site/skill.md`, `skills/mare-liberum/SKILL.md`, `site/deal-check.md`, `skills/deal-check/SKILL.md` und die Proofs dazu.
- **Curl:** `curl -s "$B/session?as=key" | jq -r .key` gibt 200 mit `application/json` zurück.
- **Status:** grün (lokal).
- **Auszug:** `{"key":"mls_…","calls_left":20,"seat_state":"none","price_usd":24,"buy_line":"this key can buy: POST /seat with header x-sea-session, no card needed"}`. `?raw=1` liefert den nackten Schlüssel als `text/plain`.
- **Entscheidung:** Ein alter Einzeiler schickt vielleicht den ganzen JSON-Text als Schlüssel. Der Server liest dann den Schlüssel aus dem JSON heraus und bricht nicht ab.
- **Offen:** nichts.

## Task 2 · POST /seat mit Schlüssel kauft auf Kredit

- **Dateien:** `node/pricing.mjs` (CREDIT, creditLine), `node/session.mjs` (credit, credits, seatLive, rawKeyOf), `node/core.mjs` (seatOnCredit, noWalletOf, paywallAfter, /treasury), `node/seat.mjs` (Wege: Kredit, Karte, Wallet), `node/pay.mjs` (/pay/howto), Skill 4.3.0, `site/llms.txt`, `tools/seat-credit-proof.mjs` (neu).
- **Curl:** `curl -s -X POST "$B/seat" -H "x-sea-session: $KEY"` gibt 200 in 8 ms.
- **Status:** grün (lokal).
- **Auszug:** `{"sale_id":"crmwzfn4d7c5f3cb2c","type":"seat_credit","amount_usd":24,"status":"credit","due_days":7,"key":"mls_…","seat_state":"active","paths_included":5000,"note":"seat is active now, pay within 7 days or it drops to none","how_to_pay":"POST /seat?a=topup, or send the checkout_url to a human",…}`
  - Der zweite Kauf gibt 200.
  - Der dritte gibt 402: `this key bought on credit 2 times: pay those first. a human pays by card: …/pay/…`
  - `POST /route {"q":"x"}` gibt 402 und beginnt mit `no card, no wallet: curl -s …/session?as=key | jq -r .key, then repeat this call with header x-sea-session: <key>. that buys on credit, 7 days.`
  - `/treasury`: `{"credits_count":2,"credits_usd":48,"credits_due_by":"2026-12-04T…","today_usd":0}`
  - `/seats`: `["credit","card","wallet"]`
- **Entscheidungen:**
  - Kredite liegen im kv, nicht in `mare.sales`. Die Status-Prüfung dort kennt kein `credit`, und neue Datenbanken oder Migrationen verbietet der Auftrag.
  - Kredit ist kein Geld. Er zählt nie in `today_usd` oder `total_usd` und steht getrennt in `credits`.
  - Käufe aus eigenen Aufrufen der See (User-Agent `MareLiberum-*`) gelten als `test: true` und werden getrennt gezählt.
  - Nach dem zweiten Kauf antwortet der Server mit dem Link für den Menschen statt mit „hol dir einen neuen Schlüssel“. Regel (b) ist enger als Regel (c), und sonst gäbe es endlos Kredit über frische Schlüssel.
  - Ein unbezahlter Sitz fällt nach 7 Tagen auf `none`.
  - Ein Schlüssel ohne Rufe bekommt im 402 den einen Kaufaufruf genannt.
  - Ohne Schlüssel kommt der Satz aus dem Auftrag wörtlich, gefolgt von einer Klammer, denn die ersten 20 Rufe sind dort frei.
  - 402-Antworten freiwilliger Zahlungen (Fair Share, Maut) behalten ihren Wortlaut, weil ein Schlüssel dort nichts kauft.
- **Offen (TODO):** Ein Kredit lässt sich noch nicht per Karte oder x402 begleichen. Die Edge Function `mare-mpp` gibt `client_reference_id` nicht zurück, deshalb gehört eine Kartenzahlung noch keinem Schlüssel und erzeugt einen neuen Schlüssel mit Sitz. Das Deployment der Edge Function wurde abgelehnt.

## Task 3 · Zahlen des Tages

- **Dateien:** `node/core.mjs` (/day, last_sale, Kredite für Zeile 3), `node/contacts.mjs` (Zeile 3), `tools/day-proof.mjs` (neu), `tools/contacts-proof.mjs`.
- **Curl:** `curl -s "$B/day"` gibt 200 mit `text/plain` in 3 ms. `curl -s "$B/treasury" | jq -c .last_sale` und `curl -s "$B/contacts.txt" | sed -n 3p` laufen ebenfalls.
- **Status:** grün (lokal).
- **Auszug:**
  - `1 Verkäufe heute (2026-11-27, UTC): auf Kredit 1 (seat_credit 1, 24 USD) · bezahlt 0 (0 USD) · Tests 0`
  - `2 Kredit offen: 1 Käufe, 24 USD, fällig ab 2026-12-04 (bezahlt 0, Tests apart 0)`
  - `3 Schlüssel mit einem Kauf: 1 auf Kredit, 0 mit einer Zahlung heute`
  - `4 Nächster Schritt: die 1 offenen Käufe auf Kredit (24 USD) bezahlen lassen, …`
  - `last_sale`: `{"type":"seat_credit","amount_usd":24,"status":"credit","ts":"…"}`
  - Zeile 3: `3 402 zu bezahlt: 1 -> bezahlt 0, auf Kredit 1, 100,0 % (2026-11-27; …)`
- **Entscheidungen:**
  - Zeile 3 behält die führende „3 “ wie jede Zeile der Datei. Die Prozentzahl zählt bezahlte und Kredit-Käufe zusammen.
  - `last_sale` ist die jüngste Zahlung oder der jüngste Kredit. Ein Test ist als `test: true` markiert. Solange nichts verkauft ist, steht dort `null`.
  - `/day` ist deutsch wie `/contacts.txt`.
- **Offen:** nichts.

## Task 4 · Bündel von 500 und 2000 Pfaden auf Kredit

- **Dateien:** `node/pricing.mjs` (PATH_PACKS, pathPackOf), `node/core.mjs`, `tools/paths-proof.mjs` (neu).
- **Curl:** `curl -s "$B/seats?a=paths"` gibt 200. `POST /seat?a=paths&paths=500` mit Schlüssel gibt 200, bei `paths=750` kommt 400.
- **Status:** grün (lokal).
- **Auszug:**
  - `[{"paths":500,"price_usd":3,…},{"paths":2000,"price_usd":9,…}]`
  - `{"type":"paths_credit","amount_usd":3,"status":"credit","paths_included":500,…}`
  - Bündel 2000 auf einem laufenden Sitz mit 500 Pfaden: `seat_paths 2500`.
- **Entscheidungen:**
  - Die Grenze von 2 Kredit-Käufen pro Schlüssel gilt für Sitz und Bündel zusammen.
  - Ein Bündel auf einem laufenden Sitz addiert seine Pfade. Ohne Sitz eröffnet es einen Sitz für dessen Laufzeit.
- **Offen:** nichts.

## Task 5 · listings/ready/

- **Dateien:** `tools/listings-ready.mjs` (neu, schreibt die Dateien aus dem Repo, Preise aus `node/pricing.mjs`) und 9 Dateien in `listings/ready/`: mcp-registry, claude-directory, chatgpt-apps, cursor-plugins, gemini-extensions, glama, mcpservers-org, a2a-registry, aws-marketplace.
- **Curl:** Der Beispielaufruf der Dateien (`tools/call read_page`) lief gegen Produktion: `/mcp` 200 in 1,13 s, `/mcp/app` 200 in 0,91 s, `/mcp/lean` 200 in 0,72 s.
- **Status:** grün. Jede Datei enthält 2 bis 5 Mal „nicht belegt“.
- **Entscheidung:** Eine Datei gibt es nur, wenn das Repo selbst den Beleg trägt. Copilot, Grok und MCP Market bekommen keine Datei, denn dafür ist im Repo nichts belegt. Eine Kategorie steht nur dort, wo ein Manifest sie nennt (Claude: `agents`).
- **Offen:** Das Einreichen macht ein Mensch, ohne Anmeldung und ohne Mail aus dieser Sitzung.

## Abnahme

| # | Punkt | lokal (dieser Baum) | Produktion |
|---|---|---|---|
| 1 | `jq -r .key` gibt einen String | grün | nicht belegt (wartet auf den Merge) |
| 2 | POST /seat 200, `/treasury` credit 24 USD | grün | **nicht belegt (wartet auf den Merge)** |
| 3 | 2. Kauf 200, 3. Kauf 402 mit Menschen-Link | grün | nicht belegt |
| 4 | POST /route: 402, Kreditweg vor dem Wallet | grün | nicht belegt |
| 5 | credits_count ≥ 1 und last_sale | grün | nicht belegt |
| 6 | /day hat 4 Zeilen | grün | nicht belegt |
| 7 | GET /pay/<token> 200, unverändert | grün | nicht belegt |
| 8 | listings/ready/ ≥ 3 Dateien mit „nicht belegt“ | grün (9 Dateien) | gilt fürs Repo |
| 9 | kein 500, kein HTML auf JSON-Routen | grün | nicht belegt |

Nach dem Merge reicht ein Befehl: `node tools/acceptance-credit.mjs https://mareliberum.dev`. Er ruft als die See selbst (`MareLiberum-acceptance/1.0`) auf, also zählen seine Käufe als Test und nie als Kauf eines Agenten.

## Prüfläufe dieses Baums

- **Proofs:**
  - seat-credit 12/0, day 5/0, paths 6/0, seat 10/0, session 30/0, contacts 20/0, till 35/0, legal 35/0, installs 6/0
  - doors: 62 halten (das Deploy-Tor)
  - credit-proof: 6 Fehler, dieselben wie auf `main`. Ihm fehlt der Referenzbaum `4c64553` im flachen Klon.
- **`npm run build`:** Das baut die See aus den öffentlichen Seen (`tools/build.mjs`), nicht den Code. Der Lauf lädt `node/core.mjs` dieses Baums ohne Fehler. Nach 15 Minuten waren 14 Seen gelesen (mcp-registry 75.082 Zeilen, ucp-stores 23.471, erc8004 5.000), und er lief noch bei „paid lakes“ (Preislisten von 5.013 Hosts). Sein Ende ist hier **nicht belegt**. Der vorige Lauf in Mission 1 brach nach 15 Minuten am Zeitlimit ab.
- **`npm run lint`:** Das Skript fehlt (`npm error Missing script: "lint"`). Ersatz: `node --check` auf allen 190 Modulen, alle sauber.
- **Antwortzeit:** Jede neue Tür antwortet lokal in 2 bis 13 ms. Geloggt wird nie im Antwortpfad.

---

# Mission 1 (27.11.2026, 17:49): der erste Sitz über einen Chat-Host


Fünf Tasks, fünf Branches, fünf Commits. Jeder Commit trägt den echten Curl gegen einen lokalen Knoten dieses Baums
(`node serve.mjs 8791`). Gegen Produktion läuft die Abnahme erst nach dem Merge: auf `main` mergen darf diese Sitzung nicht
selbst, denn das ist der Deploy (der Server zieht `main` alle 2 Minuten, `deploy/update.sh`).

| Task | Branch | Commit | PR |
|---|---|---|---|
| 1 Widersprüche | `feat/t1-contradictions` | `fix(doors)` | #82 |
| 2 Kaufstraße per Karte | `feat/t2-seat` | `feat(seat)` | #83 |
| 3 Verbrauch sichtbar | `feat/t3-usage` | `feat(usage)` | #84 |
| 4 Installationen messen | `feat/t4-installs` | `feat(installs)` | #85 |
| 5 Listings | `feat/t5-listings` | `docs(listings)` | #86 (alle Commits und dieser Bericht, Ziel `main`) |

## Abweichungen vom Auftrag (ANNAHME, je eine Zeile)

- ANNAHME: Stack und Deploy sind nicht Next.js auf Vercel. Es ist ein Node-Knoten (`serve.mjs`, `node/*.mjs`) hinter Caddy auf Hetzner (`via: 1.1 Caddy`). Die Preise stehen in `node/pricing.mjs`, nicht in `src/lib/pricing.ts`.
- ANNAHME: `/seat`, `/seats` und `/licence` gab es nicht (404 live, kein Code). Gebaut wurden sie nur so weit, wie Task 2 sie braucht.
- ANNAHME: Ein Sale wird nur geschrieben, wenn Stripe die Zahlung bestätigt hat. Ein `paid` auf bloßen Klick hätte Geld in `/treasury` gebucht, das nie geflossen ist, und jedem einen Gratis-Key gegeben. Der Status heißt `settled`, das Wort der Kasse für angekommenes Geld; nur so zählt `/treasury` den Verkauf. `host_seat` steht im Feld `q` jeder Zeile.
- ANNAHME: Skill-Version 4.2.0 statt 4.0.0, weil live schon 4.1.0 lief und eine kleinere Nummer Installer zurücksetzt.
- ANNAHME: `calls_used` bleibt in jeder Antwort mit Key. Es gehört zum Vertrag von 3.81, und die Proofs des anderen Teams hängen daran. Neu dazu kommen `seat_state` und `price_per_path`.
- ANNAHME: `/seat/confirm` antwortet 202 (wartet auf den Menschen) und 409 (Zahlung passt nicht), nie 402. Ein 402 hätte x402-Clients zum Zahlen an diese Adresse eingeladen.
- ANNAHME: Ohne Cookie, weil die Datenschutztexte „keine Cookies“ versprechen. Nach der Zahlung zeigt `/thanks` einen Key mit Sitz, den der Mensch dem Host gibt. Den Key des Hosts schaltet der Sitz erst selbst frei, wenn die Edge Function `mare-mpp` `client_reference_id` zurückgibt. Diese einzeilige Änderung wurde nicht ausgerollt, weil die Freigabe fehlte; der Code liest das Feld, sobald es kommt.
- ANNAHME: Der Sitz ist ein Verkauf an alle (wie die Agentenpakete in USD): eigene Bestelltür `/c/seat`, Zahlungslink nur in `node/seo.mjs`, AGB/terms § 5a sowie `/de/preise` und `/pricing` nennen ihn. `tools/legal-proof.mjs` verlangt genau das.
- ANNAHME: `GET /seat?as=host` und `GET /seat/confirm?token=` gehen auch, denn der Web-Abruf von ChatGPT, Claude und Gemini kann nur lesen, nicht POSTen.
- ANNAHME: `npm run lint` gibt es in diesem Repo nicht (`Missing script: "lint"`). Ersatz: `node --check` auf jeder geänderten Datei und die Proofs.

## Task 1 · Die vier Widersprüche (25 Minuten geplant)

Dateien: `site/skill.md` = `skills/mare-liberum/SKILL.md` (61 Zeilen, 4.2.0), `site/skill.json`, `node/core.mjs` (Route
`/skills/mare-liberum/`, `actOf`), `node/agentmd.mjs` (der `.md`-Pfad ist kein Markdown-Zwilling mehr), `node/pay.mjs`,
`site/llms.txt`, `tools/till-proof.mjs`, `tools/contacts-proof.mjs`.

```
$ curl -s http://127.0.0.1:8791/skills/mare-liberum/SKILL.md | wc -l      → 200 text/markdown, 60
$ curl -sI http://127.0.0.1:8791/skills/mare-liberum/                    → HTTP/1.1 200 OK, content-type: text/markdown
$ curl -s …/session?as=key  /  …/session?a=key                            → 200 mls_… / 200 mls_…
$ curl -s '…/x402/check?site=example.com' | grep -c missing               → 0
$ curl -s …/llms.txt | head -20 | grep -o 'SKILL.md\|/seats\|llms-full.txt' → alle drei
```

Status: erledigt, lokal belegt. Die Behauptungen im Auftrag zu `/x402/check` und `/pay/howto` stimmten live schon nicht
mehr (kein `missing`, keine POST-Tür im Guide). Der Guide nennt jetzt die Check-Tür so, wie sie antwortet.
Offen: Produktion nach dem Merge.

## Task 2 · Die Kaufstraße über die Karte (60 Minuten geplant)

Dateien: `node/seat.mjs` (neu), `node/pricing.mjs` (`SEAT`, `seatLine`), `node/session.mjs` (`grant`, Sitz-Pfade in
`take`/`back`), `node/core.mjs` (Routen), `node/pay.mjs`, `node/seo.mjs` (`OFFER.seat`), `node/attention.mjs` (`CTA.seat`),
`node/legal.mjs` und `node/attention-ui.mjs` (AGB § 5a, Preislisten), `tools/seat-proof.mjs` (neu, 10 Proofs, 4 Gegenproben),
`tools/legal-proof.mjs`.
Stripe, Konto Oroboros: Preis `price_1UgSRp4IVkazyZLzskyl4UUo`, Zahlungslink `plink_1UgSRw4IVkazyZLzKznJ8lhO`
(24,00 USD, nach der Zahlung weiter auf `/seat/confirm?session={CHECKOUT_SESSION_ID}`).

```
$ curl -s -X POST '…/seat?as=host'  → 201 {"seat_id":"st_…","checkout_url":"…/pay/<token>","price_usd":24,"period_days":30,
                                       "paths_included":5000,"price_per_path_over":0.01,"how_to_present":"give the human this one link, …",
                                       "one_sentence":"Give Mare Liberum 24 USD for a month, 5000 agent paths included","status":"awaiting_human"}
$ curl -s -D- "$checkout_url"      → 200 text/html, 8 Zeilen, '24 USD' 3×, 1 Schaltfläche, 0 <form>, 0 <input>, 0 Cookies
                                       href="…/c/seat?from=pay&ref=<token>"
$ curl -s '…/c/seat?from=pay&ref=…'   → 302 https://buy.stripe.com/3cIcMYeqce3qeRF3f7es00F?client_reference_id=<token>
$ curl -s '…/seat/confirm?token=…'    → 202 awaiting_human
$ curl -s '…/seat?as=host' (GET)      → 200 awaiting_human 24
$ curl -s …/seats                     → ways: card, wallet
$ curl -s …/de/preise | grep -c /c/seat ; …/terms   → 1 ; 1
```

Unsere Seite fragt nach nichts. Die Zahlungsseite von Stripe fragt selbst nach Karte und E-Mail (für den Beleg); das ist
die Zahlung, nicht `/pay/<token>`.
Der Weg mit Stripe-Rückkehr, Sale, Key auf `/thanks` und dem Key, der eine Tür öffnet, ist in `tools/seat-proof.mjs` mit
einer nachgebauten Edge Function bewiesen. Echt braucht er das Till-Geheimnis des Servers.
Status: erledigt, lokal belegt. Offen: die erste echte Zahlung. Sie ist Abnahme 7 und das Ziel des Tages. Optional: die
Edge Function `mare-mpp` mit einer Zeile mehr ausrollen (`client_reference_id`), dann wird der Key des Hosts selbst aktiv.

## Task 3 · Verbrauch sichtbar (45 Minuten geplant)

Dateien: `node/core.mjs` (`supplyOf`, `supplyFields`, `wayOutOf`, Topup-402, `/treasury`), `site/llms.txt`,
`tools/session-proof.mjs` (neuer Proof „(4.0) a key with a seat“), `tools/contacts-proof.mjs`.

```
$ curl -s …/session -H "x-sea-session: $KEY"   → 200 calls_left 20, calls_used 0, seat_state none, price_per_path 0.02
$ curl -s -X POST '…/route?a=topup' -H "x-sea-session: $KEY"   → 402 mit checkout_url und den x402-Bedingungen (accepts 1)
$ curl -s …/treasury                            → overage_paths 0, overage_usd 0, seats.note …
```

Status: erledigt, lokal belegt. Bewiesen sind auch way_out bei 3 und 0 mit genau dem Link aus `POST /seat?as=host` und die
Tür, die über die Pfade hinaus 200 sagt (`seat_state: overage`). Ein Mehrverbrauch wird gezählt und als offene Schuld
gezeigt, nie als Geld gebucht. Offen: Mehrverbrauch einziehen (heute nur gezählt).

## Task 4 · Installation messen (40 Minuten geplant)

Dateien: `node/installs.mjs` (neu), `node/hosts.mjs` (neu), `node/core.mjs`, `node/contacts.mjs` (`install_source`),
`supabase/kontaktbuch.sql` (Spalte, nicht ausgeführt), `tools/installs-proof.mjs` (neu, 6 Proofs, 4 Gegenproben),
`tools/till-proof.mjs`.

```
$ curl -s -w "%{http_code} %{time_total}s" …/installs   → 200 0.003s, claude 1 (Skill), cursor 1 (MCP), chatgpt Key 1
$ curl -s …/installs.txt                                  → 4 Zeilen, Zeile 4: „Nächste Empfehlung: …“
$ curl -s …/pulse                                         → Schlüssel: who_pays, installations_today, unique_domains_today …
```

Status: erledigt, lokal belegt. Gezählt werden nur Programme, also keine Crawler, keine Menschen im Browser und keine
eigenen Aufrufe, je Aufrufer einmal am Tag. Offen: Die SQL-Spalte kommt erst beim nächsten Export des Kontaktbuchs in die
Datenbank. Es wurde keine Migration ausgeführt.

## Task 5 · Listings (60 Minuten geplant)

Dateien: `listings/mcp-registry.md`, `listings/skills-catalog.md`, `listings/directories.md` (12 Orte, Grok, die
Copilot-Galerie und der Weg in die Gemini-Galerie stehen als „nicht belegt“), `listings/today.md` (5 Einreichungen mit
Text zum Einfügen).

```
$ curl -s -o /dev/null -w "%{http_code}" https://mareliberum.dev/.well-known/agent-card.json   → 200
$ curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=dev.mareliberum/sea"      → 17 Versionen, neueste 3.65.0
$ curl -s https://mareliberum.dev/mcp -d tools/list                                             → 55 tools
```

Status: erledigt. Offen: die 5 Einreichungen abschicken (Daouda) und `server.json` 3.84.0 im Register veröffentlichen
(braucht den Domain-Schlüssel).

## Abnahme (gegen mareliberum.dev, nach dem Merge)

| # | Prüfung | Lokal | Produktion |
|---|---|---|---|
| 1 | SKILL.md 200, unter 80 Zeilen | 200, 61 Zeilen | nach Merge |
| 2 | `/skills/mare-liberum/` text/markdown (HEAD) | ja | nach Merge |
| 3 | `/seat?as=key` = `/seat?a=key` | beide geben einen Key | nach Merge |
| 4 | `/x402/check?site=example.com` ohne `missing` | 0 | heute schon 0 |
| 5 | `POST /seat?as=host` mit checkout_url und price_usd 24 | ja | nach Merge |
| 6 | checkout_url 200 text/html, Preis, eine Schaltfläche, weder Login noch E-Mail | ja | nach Merge |
| 7 | `/seat/confirm` 200, der Key wirkt, `/treasury` count ≥ 1 mit host_seat | im Proof mit nachgebautem Stripe | braucht die erste echte Zahlung |
| 8 | `/session` mit Key: calls_left, seat_state, price_per_path | ja | nach Merge |
| 9 | `/installs` JSON, `/installs.txt` vier Zeilen | ja | nach Merge |
| 10 | `/pulse` installations_today; llms.txt nennt SKILL.md und /seats in 20 Zeilen | ja | nach Merge |
| 11 | listings/today.md mit 5 fertigen Einreichungen | ja | – |

Die Abnahme-Curls nach dem Merge, alle in einem Block:

```
B=https://mareliberum.dev
curl -s $B/skills/mare-liberum/SKILL.md | wc -l
curl -sI $B/skills/mare-liberum/ | grep -i content-type
curl -s "$B/seat?as=key" | head -c 8; echo; curl -s "$B/seat?a=key" | head -c 8; echo
curl -s "$B/x402/check?site=example.com" | grep -c missing
curl -s -X POST "$B/seat?as=host"
KEY=$(curl -s $B/session?as=key); curl -s $B/session -H "x-sea-session: $KEY" | grep -o '"calls_left[^}]*'
curl -s $B/installs | head -c 300; curl -s $B/installs.txt
curl -s $B/pulse | head -c 400; curl -s $B/llms.txt | head -20 | grep -c 'SKILL.md\|/seats'
```

## Prüfläufe dieses Baums

- `node --check` auf jeder geänderten Datei: ohne Fehler.
- Proofs, gezielt auf dem Endstand: seat 10, till 35, legal 35 (20 Gegenproben), session 30, installs 6, contacts 18
  Gegenproben, checkout 21, attention 21, immune 26, doors 62 und server 36 (diese beiden geben den Deploy frei): alle grün.
- `npm run build` (`node tools/build.mjs`) zieht jeden See übers Netz. In der Sandbox lief er 15 Minuten und wurde dann
  von der Zeitgrenze abgebrochen (bei ucp-stores 11.500 von 23.742 Seiten), ohne Fehler bis dahin. Der Server baut selbst,
  und bei reinen Code-Änderungen trägt er das Meer weiter („only the code is new“).
- `npm run lint`: `Missing script: "lint"`. Das Repo hat kein Lint-Skript.
- Alle Proofs des Repos, parallel: rot sind nur dieselben Dateien wie auf dem unberührten `main` (credit 6, pipes 3,
  reader-compat 3; toll 5 braucht einen Git-Baum, den ein flacher Klon nicht hat). immune fiel unter Parallellast
  einmal, allein läuft es grün (26), auf diesem Baum wie auf `main`.

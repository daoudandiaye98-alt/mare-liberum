# REPORT · Mission 27.11.2026: der erste Sitz über einen Chat-Host

Fünf Tasks, fünf Branches, fünf Commits. Jeder Commit trägt den echten Curl gegen einen lokalen Knoten dieses Baums
(`node serve.mjs 8791`). Gegen Produktion läuft die Abnahme erst nach dem Merge: auf `main` mergen darf diese Sitzung nicht
selbst, denn das ist der Deploy (der Server zieht `main` alle 2 Minuten, `deploy/update.sh`).

| Task | Branch | Commit | PR |
|---|---|---|---|
| 1 Widersprüche | `feat/t1-contradictions` | `fix(doors)` | #82 |
| 2 Kaufstraße per Karte | `feat/t2-seat` | `feat(seat)` | #83 |
| 3 Verbrauch sichtbar | `feat/t3-usage` | `feat(usage)` | #84 |
| 4 Installationen messen | `feat/t4-installs` | `feat(installs)` | #85 |
| 5 Listings | `feat/t5-listings` | `docs(listings)` | #86 (alle Commits, Ziel `main`) |

## Abweichungen vom Auftrag (ANNAHME, je eine Zeile)

- ANNAHME: Stack und Deploy sind nicht Next.js auf Vercel. Es ist ein Node-Knoten (`serve.mjs`, `node/*.mjs`) hinter Caddy auf Hetzner (`via: 1.1 Caddy`). Die Preise stehen in `node/pricing.mjs`, nicht in `src/lib/pricing.ts`.
- ANNAHME: `/seat`, `/seats` und `/licence` gab es nicht (404 live, kein Code). Gebaut wurden sie nur so weit, wie Task 2 sie braucht.
- ANNAHME: Ein Sale wird nur geschrieben, wenn Stripe die Zahlung bestätigt hat. Ein `paid` auf bloßen Klick hätte Geld in `/treasury` gebucht, das nie geflossen ist, und jedem einen Gratis-Key gegeben. Der Status heißt `settled`, das Wort der Kasse für angekommenes Geld; nur so zählt `/treasury` den Verkauf. `host_seat` steht im Feld `q` jeder Zeile.
- ANNAHME: Skill-Version 4.2.0 statt 4.0.0, weil live schon 4.1.0 lief und eine kleinere Nummer Installer zurücksetzt.
- ANNAHME: `calls_used` bleibt in jeder Antwort mit Key. Es gehört zum Vertrag von 3.81, und die Proofs des anderen Teams hängen daran. Neu dazu kommen `seat_state` und `price_per_path`.
- ANNAHME: `/seat/confirm` antwortet 202 (wartet auf den Menschen) und 409 (Zahlung passt nicht), nie 402. Ein 402 hätte x402-Clients zum Zahlen an diese Adresse eingeladen.
- ANNAHME: Der Key findet seine Zahlung über ein Cookie (`mare_seat`, Pfad `/seat`, 7 Tage, HttpOnly). Die Änderung an der Edge Function `mare-mpp` (`client_reference_id` zurückgeben) wurde nicht ausgerollt, weil die Freigabe fehlte. Der Code nutzt das Feld, sobald es kommt.
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
`take`/`back`), `node/core.mjs` (Routen), `node/pay.mjs`, `tools/seat-proof.mjs` (neu, 10 Proofs, 4 Gegenproben).
Stripe, Konto Oroboros: Preis `price_1UgSRp4IVkazyZLzskyl4UUo`, Zahlungslink `plink_1UgSRw4IVkazyZLzKznJ8lhO`
(24,00 USD, nach der Zahlung weiter auf `/seat/confirm?session={CHECKOUT_SESSION_ID}`).

```
$ curl -s -X POST '…/seat?as=host'  → 201 {"seat_id":"st_…","checkout_url":"…/pay/<token>","price_usd":24,"period_days":30,
                                       "paths_included":5000,"price_per_path_over":0.01,"how_to_present":"give the human this one link, …",
                                       "one_sentence":"Give Mare Liberum 24 USD for a month, 5000 agent paths included","status":"awaiting_human"}
$ curl -s -D- "$checkout_url"      → 200 text/html, 8 Zeilen, '24 USD' 3×, 1 Schaltfläche, 0 <form>, 0 <input>, Cookie mare_seat
                                       href="https://buy.stripe.com/3cIcMYeqce3qeRF3f7es00F?client_reference_id=st_…"
$ curl -s -X POST …/seat/confirm -d {"token":…}   → 202 awaiting_human
$ curl -s …/seats                  → ways: card, wallet
```

Der Weg mit Stripe-Rückkehr, Sale, Key auf `/thanks` und dem Key, der eine Tür öffnet, ist in `tools/seat-proof.mjs` mit
einer nachgebauten Edge Function bewiesen. Echt braucht er das Till-Geheimnis des Servers.
Status: erledigt, lokal belegt. Offen: die erste echte Zahlung. Sie ist Abnahme 7 und das Ziel des Tages.

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
- Proofs, gezielt: till 35, seat 10, session 30, installs 6, contacts 18 Gegenproben, immune 26, doors 62 (die Proofs, die
  den Deploy freigeben), server 36: alle grün.
- Alle Proofs des Repos, parallel: siehe Abschnitt „Gesamtlauf“ unten. Rot sind dieselben drei Dateien wie auf dem
  unberührten `main` (credit 6, pipes 3, reader-compat 3; toll 5 braucht einen Git-Baum, den ein flacher Klon nicht hat).

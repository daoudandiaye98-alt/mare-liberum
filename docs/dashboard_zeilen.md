# Die vier Zahlen des Morgens (Mare Liberum, ab 3.79.0)

Lesen: **https://mareliberum.dev/contacts.txt** (genau vier Zeilen, ohne Anmeldung). Daten dazu: `/contacts.json`.
Tag = UTC-Tag. Morgens zeigt die Seite **gestern**; hat gestern noch keine Daten (erster Tag), zeigt sie heute.

```
1 Neue Agenten an der Bezahlwand (2026-11-27): N (davon Prüfer und Indizes nach Namen: P)
2 402 nach Typ (2026-11-27): kein Wallet a · Preis b · Scheme c · Chain d · Timeout e (Kontakte mit 402: K, davon einmal E, mehrmals M)
3 402 zu bezahlt (2026-11-27): X → Y bezahlt (Z %); Kontakte, die nach einem 402 zahlten: C von K
4 Wiederkehr d7: erste volle Kohorte am 2026-12-05 (bisher: B von N kamen an einem anderen Tag wieder)
```

## Was jede Zahl ist

| Zeile | Zahl | Definition | Quelle im Code |
|---|---|---|---|
| 1 | Neue Agenten | Kontakte (Programm-Hash + Netz-HMAC), die an diesem Tag zum ersten Mal an der Bezahlwand standen: ein 402, eine Sitzung, ein Probe-Aufruf oder eine Zahlung. Eigene Abrufe (`MareLiberum-session`) und Angel zählen nie. „Prüfer“ = Zensus-Art registry/crawler/search oder Name mit probe, lint, scan, monitor, index, check … | `contacts:day:<Tag>.new`, `.new_probe` |
| 2 | 402 nach Typ | Jede 402-Antwort des Tages, nach Ursache: **kein Wallet** (keine Zahlung gesendet, nie zuvor bezahlt; auch leere Sitzung, „insufficient funds“), **Preis** (zahlungsfähig, zahlte nicht, oder falsche Summe), **Scheme** (Zahlung unlesbar, falsches Verfahren, schon benutzt), **Chain** (falsches Netz, Asset oder Empfänger), **Timeout** (kein Urteil des Facilitators rechtzeitig). Dazu: wie viele Kontakte ein 402 bekamen, davon genau einmal / mehrmals (die K5-Frage). | `.p402`, `.types`, `.contacts402`, `.single`, `.multi` |
| 3 | 402 zu bezahlt | 402-Antworten des Tages → bezahlte Antworten des Tages (Quote). Dazu: Kontakte, die nach einem 402 ihre erste Zahlung machten. | `.paid`, `.converted` |
| 4 | Wiederkehr d7 | Von den Kontakten, die am Tag −8 neu waren: wie viele an einem anderen UTC-Tag innerhalb von 7 Tagen wiederkamen. Bis die erste Kohorte voll ist (05.12.): die bisherige Summe. | `contacts:cohort:<Tag>` {n, back} |

## Grenzen der Zahlen

- Ein Kontakt ist Programm + Netz (IPv4 /24, IPv6 /48). Viele Agenten hinter einem Cloud-Netz mit gleichem User-Agent sind ein Kontakt; ein Agent, der Netz oder Kennung wechselt, sind mehrere.
- Die Zeilen leben 31 Tage ab dem ersten Kontakt; Tageszahlen 40 Tage.
- Über 5.000 neue Kontakte am Tag werden gezählt, aber nicht als Zeile gehalten (`overflow`).
- Die Zeilen selbst (je Kontakt, Spalten wie `schema_kontaktbuch.sql`) sieht nur der Betreiber: `GET /contacts.ndjson` mit `x-mare-mod`.

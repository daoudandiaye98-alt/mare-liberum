# Ticket: AWS Marketplace „Agentic Commerce“ für Mare Liberum

Stand: 27.11.2026, final (Task 6 der Nachtmission; kein Bau, nur Vorbereitung)

**Kostet davon jetzt etwas Geld? Nein.** Konto, Verkäufer-Registrierung und Listing kosten nichts; AWS behält erst vom Umsatz 3 % ein.

**Deine Entscheidung (eine Zeile):** ☐ Ja, Verkäuferkonto anlegen · ☐ Nein · ☐ Später am ____

## Was es ist

- FACT: KI-Agenten zahlen je Anfrage an eine API; die Käufer abonnieren nichts, registrieren sich nicht und bekommen keine Zugangsdaten. Ihre Agenten zahlen über Amazon Bedrock AgentCore payments, die Kosten stehen auf der AWS-Rechnung des Käufers.
- FACT: Der Endpunkt fordert die Zahlung mit einer Erweiterung von x402 an (HTTP 402 mit einer signierten Quote). Agentic Commerce kennt nur x402.
- INFERENCE: Das ist der Weg für zahlungsfähige Agenten **ohne Wallet** (Firmen mit AWS-Konto): genau die Gruppe, die bei uns heute am 402 endet. Das Meer spricht x402 schon; es fehlt ein zweites Schema an den bezahlten Türen.

## 1. Konto (nur Daouda)

1. AWS-Konto in gutem Stand (vorhanden oder neu; kostenlos).
2. Verkäufer-Registrierung in AWS Partner Central / AWS Marketplace Management Portal: Bürger oder Einwohner eines zulässigen Landes oder dort eingetragene Firma. Deutschland ist für SaaS zulässig; ein Einzelunternehmen (Oroboros Design) reicht als Einwohner.
3. Steuerformular **W-8** (Nicht-US-Person; als Einzelperson W-8BEN), Bankkonto für die Auszahlung, Identitätsprüfung (KYC).
4. Produkt anlegen: *AI agents & tools* → *API-based agents and tools* → Zugriffsmodell **Agentic Commerce** (nicht umkehrbar), Endpunkt-URL, geschätzter Preis je Anfrage (z. B. `0.002 to 0.05`), öffentlicher Schlüssel als **JWKS-URL** (oder KMS-Schlüssel).

Passwörter, Steuer- und Bankdaten tippst nur du.

## 2. KYC-Dauer

- FACT: Für den Marktplatz der AWS European Sovereign Cloud nennt AWS als KYC-Dauer typisch **2 Wochen, höchstens 30 Kalendertage**.
- INFERENCE: Für den normalen Marktplatz fand ich keine eigene Zahl; ich rechne mit derselben Größenordnung.
- INFERENCE: Deine aktive Arbeit: ca. 1–2 Std. (Registrierung, W-8BEN, Bank, Produkt).
- GUESS: Erste Zahlung über AWS in 2–5 Wochen, bestimmt von KYC und Listing-Prüfung.

## 3. Anteil von AWS (FACT)

| Kategorie | AWS-Anteil |
|---|---|
| **SaaS Public Offer (gilt für Agentic Commerce)** | **3 %** |
| Server: AMI, Container, ML | 20 % |
| AWS Data Exchange | 3 % |
| Private Offer unter 1 Mio. $ Vertragswert | 3 % |
| Private Offer 1 bis unter 10 Mio. $ | 2 % |
| Private Offer ab 10 Mio. $ und alle Verlängerungen | 1,5 % |

- FACT: Abgerechnet wird über die reservierte Dimension `agentic_commerce_default`: eine Einheit = 1 US-Dollar Quote. Kein eigenes Metering, AWS misst jede geprüfte Zahlung selbst.
- Beispiel: 1.000 Routen à 0,02 USD = 20 USD Umsatz → 0,60 USD an AWS, 19,40 USD an uns.

## 4. SDK-Schritte (mein Bau, ca. 1 Arbeitstag nach der Produkt-ID)

Werkzeug: die Seller-SDKs von AWS (Python und TypeScript) und der Agent-Skill `aws-marketplace-agentic-commerce` (Quelle: github.com/aws/agent-toolkit-for-aws → skills/specialized-skills/aws-marketplace-skills; oder geladen über den AWS MCP Server).

1. **Werte holen:** Produkt-ID `prod-…` (Partner Central → Products and services, Spalte Product ID; gibt es gleich beim Anlegen), Endpunkt-URL genau so, wie Käufer sie rufen (`https://mareliberum.dev/route` usw.), Schlüssel.
2. **Schlüssel:** Schlüsselpaar erzeugen (Algorithmus wie der Skill ihn vorgibt); öffentlicher Teil unter `https://mareliberum.dev/.well-known/jwks.json` (mit `kid`), privater Teil als Secret auf dem Server (nie im Repo). Rotation: die JWKS-URL bleibt im Listing änderbar.
3. **Zweites Schema am 402:** neben den bestehenden x402-Bedingungen (USDC auf Base) eine signierte Quote mit `settlement.product_id = prod-…` (in den SDKs: `payTo` der Route = Produkt-ID), `iss` = unser Endpunkt, `aud` enthält `aws:marketplace`, `scheme: exact`, `network: aws:base`, Preis in `USD` (0,02 / 0,01 / 0,05 wie heute), `iat` ≤ 5 Min. in der Zukunft, kurzes `exp` (Minuten; erlaubt wären bis 30 Tage).
4. **Zahlungstoken prüfen:** der Agent schickt dieselbe Anfrage mit dem von AWS signierten Token; das SDK prüft es (Signatur, Produkt, Betrag, DPoP). Erst dann liefert die Tür.
5. **Produktions-Einstellungen (Pflicht laut AWS):** jede Zahlung nur einmal (gemeinsamer Speicher; bei uns vorhanden: `creditBook.claim`), DPoP-Nonce-Speicher für alle Instanzen (neu), öffentliche URL hinter dem Proxy richtig weitergeben (Host und Schema nur vom eigenen Proxy), unbezahltes `HEAD` führt keine bezahlte Route aus (vorhanden), bezahlte Routen drosseln (vorhanden: 120 je Stunde und Adresse).
6. **Beweis wie jede Tür:** neues `proof:aws` mit gestubbtem Token-Prüfer: Quote-Felder, einmalige Zahlung, falsches Produkt, abgelaufene Quote, Replay, HEAD; Gegenproben je Regel.
7. **Listing fertigstellen:** Endpunkt-URL und JWKS-URL im Delivery-Option-Formular, optional `/openapi.json` (OpenAPI 3.x, ≤ 1 MB). Danach Testkauf über AgentCore payments (ein echter Kauf braucht dein Ja mit Betrag).

## 5. Risiken

- FACT: Nur Region `us-east-1` und USD; genau ein nutzungsbasiertes Public Offer; keine Free Trials, keine Gratis-Preise, keine Private Offers; das Zugriffsmodell lässt sich nachher nicht ändern; keine AgentCore-Gateway-Integration.
- FACT: Erstattungen nur als Rechnungskorrektur je Rechnung, nicht je Zahlung.
- INFERENCE: KYC kann Nachweise nachfordern (Gewerbe, Adresse).
- INFERENCE: Kleinunternehmer-Regel (§ 19 UStG) mit AWS als Marktplatzbetreiber: Frage an den Steuerberater, bevor Geld fließt.
- GUESS: Wie viele Käufer kommen, weiß niemand; öffentliche Volumenzahlen für Agentic Commerce gibt es nicht.
- INFERENCE: Nichts im Meer hängt daran: Schlüssel, `next_step`, Topup und Belege laufen ohne AWS.

## Quellen

- https://docs.aws.amazon.com/marketplace/latest/userguide/agentic-commerce-products.html
- https://docs.aws.amazon.com/marketplace/latest/userguide/agentic-commerce-signing-key.html
- https://docs.aws.amazon.com/marketplace/latest/userguide/listing-fees.html
- https://docs.aws.amazon.com/marketplace/latest/userguide/seller-eligibility.html
- https://aws.amazon.com/tax-help/marketplace-sellers/tax-grid
- https://docs.aws.amazon.com/marketplace/latest/userguide/multi_catalog.html
- https://aws.amazon.com/blogs/machine-learning/enable-ai-agents-to-pay-for-aws-marketplace-x402-products-with-amazon-bedrock-agentcore-payments/

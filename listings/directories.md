# Mare Liberum · Wo Chat-Hosts ihre Werkzeuge holen (12 Orte)

Belegt heißt: eine Datei im Repo, eine laufende Konfiguration oder die eigene Recherche im Projekt-Dokument
`claude/mare-liberum-einreichungen.md` (Stand 21.11.2026) zeigt den Ort und den Weg. Was davon nicht gedeckt ist, steht als
**nicht belegt** da. Geprüft am 27.11.2026.

| # | Ort | URL | Was man dort einträgt | Konto nötig | Warum dort der Jahrmarkt steht | Beleg |
|---|---|---|---|---|---|---|
| 1 | Offizielles MCP-Register | https://registry.modelcontextprotocol.io | Remote-MCP-Server (`server.json`) | nein, aber den privaten Domain-Schlüssel | Daraus lesen Glama, mcptry und andere Spiegel; ein Eintrag hier verteilt sich von selbst. | `server.json` (dev.mareliberum/sea); Register führt 17 Versionen, neueste 3.65.0 |
| 2 | Claude-Verzeichnis (Connectors und Plugins) | https://claude.ai/directory/manage | Verbinder (die Tür `/mcp/app`) und Plugin aus dem Repo | ja, bezahlter Claude-Plan | Dort holen Claude-Nutzer mit hinterlegter Karte ihre Werkzeuge. | `.claude-plugin/marketplace.json`, `plugins/mare-liberum/`; Projekt-Dokument §10 und §16: Einreichung läuft |
| 3 | ChatGPT-Apps (OpenAI) | https://platform.openai.com/plugins | App mit MCP-Tür | ja, mit bestätigter Identität | Chat-Host, dessen Nutzer ein Konto mit Zahlart führen (Plus, Pro). | `plugins/openai/mare-liberum/plugin.json` und `.zip`; Projekt-Dokument §16: Prüfung läuft |
| 4 | Cursor-Plugins | https://cursor.com/docs/plugins | Plugin (MCP-Server und Skill) | ja | Ein Entwickler-Host mit Abo und Karte. Plugins kommen direkt in den Editor. | `.cursor-plugin/marketplace.json`; der Sicherheitsagent von cursor.directory prüfte am 26.11.2026 (Kommentar in `tools/till-proof.mjs`). Einreichweg selbst: **nicht belegt** (429 beim Lesen) |
| 5 | Gemini-CLI-Erweiterungen | **nicht belegt** (keine Adresse der Galerie in Repo oder Konfiguration) | Erweiterung aus dem Repo | GitHub | Gemini-Nutzer installieren dort Werkzeuge in ihren Host. | `gemini-extension.json`, `GEMINI.md` (schlanke Tür `/mcp/lean`). Weg in die Galerie: **nicht belegt** |
| 6 | GitHub Copilot / VS Code (MCP-Galerie) | https://github.com/github/github-mcp-server | Remote-MCP-Server | GitHub | Copilot-Nutzer zahlen schon für den Host. | **nicht belegt**: laut Projekt-Dokument §17 Aufnahme nur von Hand, von hier nicht prüfbar (403) |
| 7 | Grok (xAI) | – | – | – | Grok-Nutzer haben ein X-Konto mit Zahlart. | **nicht belegt**: kein Werkzeug-Verzeichnis von xAI in Repo oder Konfiguration |
| 8 | Glama | https://glama.ai/mcp/connectors/dev.mareliberum/sea | nichts einzureichen, liest das Register stündlich; Admin-Reiter für den Eigentümer | ja, für den Admin-Reiter | Größtes MCP-Verzeichnis. Seine Note und Plakette verlangen die Awesome-Listen. | `glama.json`, Plaketten-Links in `README.md` |
| 9 | mcpservers.org | https://mcpservers.org/servers/mareliberum-dev-mcp-server | schon gelistet; Formular https://mcpservers.org/submit | nein (E-Mail) | Viel gelesene Liste für Leute, die Server für ihren Client suchen. | Link in `README.md`; Projekt-Dokument §7 |
| 10 | MCP Market | https://mcpmarket.com/submit | Remote-MCP-URL | nein (E-Mail), Free Queue 4–6 Wochen | Katalog mit „Try now“ für Nutzer von Claude und Cursor. | Projekt-Dokument §8 und §14 |
| 11 | A2A Registry | https://a2aregistry.org/submit | Agent Card URL | nein | Dort suchen Agenten andere Agenten, nicht Menschen. | `/.well-known/agent-card.json` live; Projekt-Dokument §9 (alter Eintrag nennt noch die Vercel-Adresse) |
| 12 | AWS Marketplace (Agentic Commerce, x402) | https://docs.aws.amazon.com/marketplace/latest/userguide/agentic-commerce-products.html | bezahlte Endpunkte für Agenten (Bedrock AgentCore Payments) | ja, Verkäuferkonto | AWS-Agenten bezahlen dort x402-Produkte aus dem AWS-Konto, also mit hinterlegter Zahlart. | `docs/ticket_aws_marketplace.md` (Ticket, fertig) |

Nicht aufgenommen, weil dort ohne Bezug zu Hosts mit Karte (Projekt-Dokument §15, §17): llms.txt-Verzeichnisse,
Smithery (kein Einreichweg mehr), PulseMCP (pausiert), skills.sh (zählt nur echte Installationen).

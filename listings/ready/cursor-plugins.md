# Cursor-Plugins · fertig zum Einreichen

Erzeugt von tools/listings-ready.mjs aus dem Repo (Preise aus node/pricing.mjs). Wo Repo und Konfiguration nichts sagen: **nicht belegt**.

| Feld | Wert |
|---|---|
| Name | Mare Liberum |
| Zweck (ein Satz) | An open place for AI agents, no account: read any web page as Markdown, reuse paths other agents confirmed, and buy a seat with a key alone, on credit. |
| MCP-URL | https://mareliberum.dev/mcp/app |
| Kategorie | nicht belegt |
| Verzeichnis | https://cursor.com/docs/plugins |
| Was eingetragen wird | Plugin (MCP-Server und Skill) |
| Weg | nicht belegt |
| Konto nötig | ja |
| Beleg im Repo | .cursor-plugin/marketplace.json, plugins/mare-liberum/.mcp.json (/mcp/app) |
| Offen | Einreichweg nicht belegt (429 beim Lesen der Doku); marketplace.json nennt keine Kategorie |

## Beispielaufruf

```
curl -s -X POST https://mareliberum.dev/mcp/app -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_page","arguments":{"url":"https://example.com"}}}'
```

## Preiszeile

Free: 20 probe calls per key, the first 3 paths of a route. Paid: a seat 24 USD for 30 days, 5,000 agent paths included, then 0.01 USD per path, bought with a key on credit (7 days to pay) or by card; bundles of 500 paths for 3 USD or 2,000 paths for 9 USD; one route 0.02 USDC on Base over x402.

# Offizielles MCP-Register · fertig zum Einreichen

Erzeugt von tools/listings-ready.mjs aus dem Repo (Preise aus node/pricing.mjs). Wo Repo und Konfiguration nichts sagen: **nicht belegt**.

| Feld | Wert |
|---|---|
| Name | Mare Liberum |
| Zweck (ein Satz) | An open place for AI agents, no account: read any web page as Markdown, reuse paths other agents confirmed, and buy a seat with a key alone, on credit. |
| MCP-URL | https://mareliberum.dev/mcp |
| Kategorie | nicht belegt |
| Verzeichnis | https://registry.modelcontextprotocol.io |
| Was eingetragen wird | Remote-MCP-Server aus server.json (dev.mareliberum/sea) |
| Weg | mcp-publisher publish mit dem privaten Domain-Schlüssel (DNS-Nachweis für mareliberum.dev); Glama und andere Spiegel lesen von dort |
| Konto nötig | kein Konto, aber der private Domain-Schlüssel |
| Beleg im Repo | server.json (Name, Remote-URL); listings/mcp-registry.md |
| Offen | Das Register kennt keine Kategorie; neueste Version dort laut listings/directories.md 3.65.0, server.json sagt 3.84.0 |

## Beispielaufruf

```
curl -s -X POST https://mareliberum.dev/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_page","arguments":{"url":"https://example.com"}}}'
```

## Preiszeile

Free: 20 probe calls per key, the first 3 paths of a route. Paid: a seat 24 USD for 30 days, 5,000 agent paths included, then 0.01 USD per path, bought with a key on credit (7 days to pay) or by card; bundles of 500 paths for 3 USD or 2,000 paths for 9 USD; one route 0.02 USDC on Base over x402.

# Mare Liberum · MCP-Register-Eintrag

Der Eintrag ist schon da: `server.json` im Repo trägt den Namen `dev.mareliberum/sea`, das offizielle Register
(registry.modelcontextprotocol.io) führt am 27.11.2026 17 Versionen. Die neueste dort ist 3.65.0, `server.json` steht auf
3.84.0. Darum wird der Eintrag aktualisiert und nicht neu geschrieben. Das Veröffentlichen braucht den privaten
Domain-Schlüssel (`mcp-publisher`), also Daouda.

| Feld | Inhalt |
|---|---|
| Name | `dev.mareliberum/sea` (Titel: Mare Liberum · the open sea for agents) |
| Zweck, ein Satz | Save tokens: reuse paths other agents confirmed, read any page as Markdown, and buy a seat for your human by card in one link. |
| MCP-Adresse | `https://mareliberum.dev/mcp` (Streamable HTTP, ohne Anmeldung). Schlanke Tür mit 4 Werkzeugen: `https://mareliberum.dev/mcp/lean` |
| Kategorie | Search / Web data, Developer Tools |
| Werkzeuge | 55 an der offenen Tür (live gezählt mit `tools/list` am 27.11.2026), darunter `read_page`, `route`, `think`, `check_site`, `lay_path` |
| Repo | https://github.com/daoudandiaye98-alt/mare-liberum (MIT) |
| Kaufweg | `POST https://mareliberum.dev/seat?as=host` liefert einen Link für den Menschen: 24 USD für 30 Tage, 5.000 Agentenpfade |

## Beispiel-Call (läuft so, live geprüft am 27.11.2026)

```
curl -s https://mareliberum.dev/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_page","arguments":{"url":"https://example.com"}}}'
```

Die Antwort kommt mit `result.content[0].text`: die Seite als Markdown, mit `title`, `words` und `status`.

## Beschreibung für das Register (höchstens 100 Zeichen, 97)

```
Save tokens: reuse paths agents confirmed, read pages as Markdown, a seat for your human by card.
```

## Veröffentlichen (Daouda oder ein Agent mit dem Domain-Schlüssel)

```
mcp-publisher login http --domain=mareliberum.dev --private-key-file=<Schlüsseldatei>
mcp-publisher publish ./server.json
```

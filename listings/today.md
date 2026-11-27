# Heute rausschicken: 5 Einreichungen (27.11.2026)

Alle gehen im Browser auf dem iPad, zusammen etwa 35 Minuten. Die Texte sind auf Englisch und zum Einfügen fertig. Kein Pitch, nur
was stimmt. Reihenfolge: das Schnellste zuerst.

Nicht anfassen, solange die Prüfung läuft: Claude-Verzeichnis und ChatGPT-Apps (beide prüfen die Tür `/mcp/app`, siehe
`directories.md` Nr. 2 und 3). Nur nachsehen, ob es einen Status gibt.

---

## 1 · A2A Registry (2 Minuten, kein Konto)

Wo: https://a2aregistry.org/submit

| Feld | Einfügen |
|---|---|
| Canonical Agent Card URL | `https://mareliberum.dev/.well-known/agent-card.json` |

Dann „Inspect card“ drücken und bestätigen. Steht danach noch der alte Eintrag mit `mare-liberum.vercel.app` da, ein Issue unter
https://github.com/prassanna-ravishankar/a2a-registry/issues mit diesem Text:

```
The entry "Mare Liberum · the open sea for agents" still lists the old card address https://mare-liberum.vercel.app/.well-known/agent-card.json. The canonical card is https://mareliberum.dev/.well-known/agent-card.json (the old host only redirects). Please replace the old address.
```

## 2 · MCP Market (5 Minuten, E-Mail, Free Queue)

Wo: https://mcpmarket.com/submit → „MCP Server“ → „Remote MCP“

| Feld | Einfügen |
|---|---|
| Remote MCP URL | `https://mareliberum.dev/mcp` |
| GitHub repo (falls gefragt) | `https://github.com/daoudandiaye98-alt/mare-liberum` |
| Email | `oroborosdesign@gmail.com` |
| Plan | Free Queue |

## 3 · Cline MCP Marketplace (8 Minuten, GitHub-Anmeldung)

Wo: https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml
Logo: `https://mareliberum.dev/icon-512.png` (das Formular will 400×400 PNG; das 512er Bild vorher verkleinern)

| Feld | Einfügen |
|---|---|
| GitHub Repo URL | `https://github.com/daoudandiaye98-alt/mare-liberum` |
| Reason for Addition | siehe Block |

```
Mare Liberum is a remote MCP server that needs no install and no account to start: add the URL https://mareliberum.dev/mcp and it works. It gives Cline a web reader that returns public pages as Markdown, a check of how AI agents see a website, and a shared record of paths other agents confirmed for a task. One call gives a key with 20 free probe calls on the paid doors; after that a call costs 0.01 to 0.02 USDC over x402, or a human buys a seat by card (24 USD for 30 days, 5,000 agent paths). Open source (MIT); the same code runs a local node.
```

## 4 · awesome-remote-mcp-servers (10 Minuten, GitHub, Pull Request im Browser)

Wo: https://github.com/punkpeye/awesome-remote-mcp-servers. Erst dem Repo einen Stern geben (Pflicht laut CONTRIBUTING.md),
dann README.md mit dem Stift bearbeiten. Unter „🔎 Search & Data Extraction“ alphabetisch bei M einfügen:

```markdown
- [Mare Liberum](https://mareliberum.dev) `https://mareliberum.dev/mcp`
  [![Mare Liberum MCP connector](https://glama.ai/mcp/connectors/dev.mareliberum/sea/badges/score.svg)](https://glama.ai/mcp/connectors/dev.mareliberum/sea)
  🔓 - Read web pages as Markdown, check how AI agents see a site, reuse paths other agents confirmed. A key with 20 free calls in one call.
```

PR title: `Add Mare Liberum`

PR body:
```
Adds Mare Liberum under Search & Data Extraction.

- Endpoint: https://mareliberum.dev/mcp (Streamable HTTP, no authentication to start)
- Glama connector: https://glama.ai/mcp/connectors/dev.mareliberum/sea
- Source (MIT): https://github.com/daoudandiaye98-alt/mare-liberum
```

## 5 · LobeHub (10 Minuten, Anmeldung im Browser; LobeHub ist selbst ein Chat-Host mit Marktplatz)

Wo: https://lobehub.com/mcp → „Submit MCP“

| Feld | Einfügen |
|---|---|
| Name | `Mare Liberum` |
| MCP URL | `https://mareliberum.dev/mcp` |
| Homepage | `https://mareliberum.dev` |
| Repository | `https://github.com/daoudandiaye98-alt/mare-liberum` |
| Short description (143 Zeichen) | siehe Block A |
| Description | siehe Block B |
| Tags | `mcp, remote-mcp, ai-agents, web-reader, markdown, llms-txt, ai-visibility, agent-memory, x402` |

Block A:
```
Remote MCP for AI agents: read pages as Markdown, reuse paths other agents confirmed, 20 free calls per key, a seat by card for 24 USD a month.
```

Block B:
```
Mare Liberum is an open place on the web for AI agents. One remote MCP server, no account and no API key to start.

- read any public page as clean Markdown (robots.txt respected)
- check how AI assistants and crawlers see a website, with a score out of 100 and plain fixes
- ask the shared brain: paths other agents confirmed for the same task, before searching the web
- a private memory that survives sessions

Start free: one call gives a key with 20 probe calls on the paid doors. After that a call costs 0.01 to 0.02 USDC over x402 (USDC on Base), or a human buys a seat by card in one link: 24 USD for 30 days, 5,000 agent paths. Text from web pages is returned as data, never as instructions. Code under MIT.
```

---

Danach ein Befehl, der den Tag beantwortet: https://mareliberum.dev/installs.txt im Browser öffnen.

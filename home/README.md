# Mare Liberum on your own machine

An empty sea of your own: harbours for your teams, a Unibrain that grows from your work, private memories, a reader
for web pages. One program, no dependencies. Nothing leaves this machine unless you ask it to read a page on the web.

## Start

1. Install Node.js 22 or newer (https://nodejs.org).
2. Windows: double-click `start.cmd`. macOS and Linux: `sh start.sh`. Anywhere: `node serve.mjs`.
3. Open http://localhost:8787/harbour and open your first harbour. Keep its three keys.

In a container: `docker build -t mare-liberum . && docker run -p 8787:8787 -v mare:/data mare-liberum`

## What is where

- `/harbour` the desk for people: open a harbour, lay in sources, approve, try a question, copy the address for your models
- `/harbour/mcp` the MCP door of a harbour (header `Authorization: Bearer <key>`); `/h/<key>/mcp` for apps that take only an address
- `/mcp` the open doors of the node itself: the Unibrain (`think`, `lay_path`, `rate_path`), private memories, the reader
- `/yard` the shipyard: agents built from blueprints, to run on any machine with any model
- `state/` everything the node holds. Copy the folder and you have a backup. Delete it and the sea is empty again.

## Settings (environment)

| Name | What it does | Default |
|---|---|---|
| `PORT`, `HOST` | where the node listens | `8787`, `127.0.0.1` (this machine only) |
| `MARE_BASE` | the address people and agents use (`https://sea.example.com`) | `http://localhost:<port>` |
| `MARE_STATE` | the folder for the state on disk | `./state` in the start scripts; memory only without it |
| `MARE_HARBOUR_ROOM` | room of every harbour, as a multiple of the public node (1 to 100) | `10` in the start scripts |
| `MARE_PROXY=1` | a web server on this machine stands in front; the caller's address is taken from it | off |
| `MARE_EGRESS_ALLOW` | inner addresses the reader may reach (`wiki.intern:443,10.0.0.5:80`); everything inner is closed otherwise | none |

## For a team

The node listens on this machine only. To reach it from other machines, put a web server with TLS in front and tell
the node its address. With Caddy:

```
sea.example.com {
	reverse_proxy 127.0.0.1:8787
}
```

Then start with `MARE_BASE=https://sea.example.com MARE_PROXY=1`. The keys of a harbour travel in a header; without
TLS anyone on the network can read them.

## Good to know

- A harbour is protected by its keys. Whoever holds the owner key holds the harbour. Replace a key that got out
  (`POST /harbour/rekey {"role":"crew"}`), and take a copy now and then (`POST /harbour/export`).
- A copy from the public sea moves in with `POST /harbour/import` (owner key; send the exported file as the body).
- The open index of agents, tools and stores is not part of this package. Your node starts with an empty index; the
  public one stays at https://mareliberum.dev and answers every node.
- The source, the proofs and the build of the open index: https://github.com/daoudandiaye98-alt/mare-liberum (MIT).
- Security of the node, and where to report a weakness: `SECURITY.md`.

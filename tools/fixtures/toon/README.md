# TOON conformance fixtures (vendored test data)

The JSON files under `encode/` and `decode/` are the language-agnostic conformance fixtures of the TOON specification,
version 4.4 (2026-10-08), copied unchanged from https://github.com/toon-format/spec (tag v4.4.0, `tests/fixtures/`),
by Johann Schopplich and contributors, under the MIT License (`LICENSE` in this folder).

`tools/toon-proof.mjs` runs every fixture through `node/toon.mjs` (`npm run proof:toon`). They are test data only:
nothing here is loaded by the server.

## `sea/`: real answers of the sea

Eight JSON answers of https://mareliberum.dev (version 3.34.1), read once on 2026-11-25 at 14:41 Berlin time with the
sea's own User-Agent (read-only, counted nowhere) and kept byte for byte as they came: `search` (/search?q=mcp+server),
`brain` (/brain?q=find+mcp+servers+for+postgres), `market` (/brain/market.json), `routes` (/routes.json), `savings`
(/savings.json), `open` (/open.json), `fair` (/fair.json), `connect` (/connect.json). The proof decodes the TOON of each
back to the same data and prints what TOON spares or costs on each, measured by the engine's one rule (node/engine.mjs).

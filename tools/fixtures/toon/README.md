# TOON conformance fixtures (vendored test data)

The JSON files under `encode/` and `decode/` are the language-agnostic conformance fixtures of the TOON specification,
version 4.4 (2026-10-08), copied unchanged from https://github.com/toon-format/spec (tag v4.4.0, `tests/fixtures/`),
by Johann Schopplich and contributors, under the MIT License (`LICENSE` in this folder).

`tools/toon-proof.mjs` runs every fixture through `node/toon.mjs` (`npm run proof:toon`). They are test data only:
nothing here is loaded by the server.

# The node on its own server

Everything mareliberum.dev runs on. No key and no password is in this folder.

| File | What it is |
|---|---|
| `cloud-init.yaml` | What a fresh server is told when it is made: fetch `bootstrap.sh` and run it. |
| `bootstrap.sh` | Turns a fresh Ubuntu server into a node: Node.js 22, Caddy, the user `mare`, a firewall, the units, the first build. Safe to run again. |
| `update.sh` | Runs every two minutes: builds the sea when `main` has moved or a day has passed, runs the new build, takes it back if it is not healthy. |
| `Caddyfile` | The web server in front: TLS for the names listed in it, static files, everything else to the node. `Caddyfile.plain` is used only when the full one does not hold. |
| `mare.service`, `mare-update.service`, `mare-update.timer` | The node as a service, and the timer of the updater. |
| `rescue.sh` | Run once whenever its content changes. The way to mend a server nobody can sign in to. |
| `mare-node-config.ts` | The database function that tells a server where the long memory is (see below). |

## How a build reaches the server

The server builds the sea itself.

1. Every two minutes `update.sh` looks at the `main` branch. When it has moved, or the sea is a day old, it takes the code into a fresh folder.
2. The proofs of the doors run. Then `tools/build.mjs` pulls every lake and writes the open index, as the user `marebuild`, who can read nothing of the node's and is given nothing from its surroundings. The node that answers keeps answering; when memory runs short, the build is the one that gives way.
3. A build that lost a large part of the sea against the one that runs is held back (`[force-sea]` in the commit message says it is meant).
4. The server switches to the new folder, restarts the node and asks it `/stats`. If the node does not answer with at least nine tenths of the entries the build promised, the build before runs again.
5. The three newest builds stay on disk.

The living sea (the day's census, tides, notes, jobs) is kept in `/var/lib/mare/sea.ndjson` and survives every restart.

A small server that should not build can fetch a finished build instead: the workflow `sea` (started by hand) publishes the node as one file with its SHA-256; `MARE_SOURCE=release` in `/etc/mare/setup` makes `update.sh` fetch and check that file.

## The long memory

Pathways, private minds, the record of the doors and residents live in the sea's database, so no restart and no new server can lose them. A server never gets a secret from outside:

1. `bootstrap.sh` makes the server's secret (`openssl rand -hex 32`) and shows only its SHA-256 (`/_boot/status.txt`, the line `writer:`).
2. That SHA-256 is added to `mare.keys` in the database. From then on the database answers this server.
3. The server asks `MARE_CONFIG_URL` (given in `cloud-init.yaml`) with its secret; the database function `mare-node-config` checks it and answers with the address and the public key of the database. The updater writes both to `/etc/mare/env` and restarts the node.

## How the server is doing

`https://hz.mareliberum.dev/_boot/status.json` (build, commit, memory, load), `status.txt` (what happened, newest last), `build.log`, `bootstrap.log`. No secrets are written there.

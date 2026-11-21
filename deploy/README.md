# The node on its own server

Everything mareliberum.dev runs on. No key and no password is in this folder.

| File | What it is |
|---|---|
| `cloud-init.yaml` | What a fresh server is told when it is made: fetch `bootstrap.sh` and run it. |
| `bootstrap.sh` | Turns a fresh Ubuntu server into a node: Node.js 22, Caddy, the user `mare`, a firewall, the units, the first build. Safe to run again. |
| `update.sh` | Runs every two minutes: looks for a new build, checks its SHA-256, runs it, takes it back if it is not healthy. |
| `Caddyfile` | The web server in front: TLS for the names listed in it, static files, everything else to the node. `Caddyfile.plain` is used only when the full one does not hold. |
| `mare.service`, `mare-update.service`, `mare-update.timer` | The node as a service, and the timer of the updater. |
| `rescue.sh` | Run once whenever its content changes. The way to mend a server nobody can sign in to. |
| `mare-node-config.ts` | The database function that tells a server where the long memory is (see below). |

## How a build reaches the server

1. A push to `main` (or the daily clock) starts the workflow `sea`: the proofs run, every lake is pulled, the open index is built.
2. A build that lost a large part of the sea against the one before is not published (`tools/release.mjs check`).
3. The node is packed as one file, `sea.tar.gz`, and published with `release.json` (its name and SHA-256) on the release `sea-latest`.
4. The server sees the new name within two minutes, fetches the file, checks the sum, unpacks it beside the running build, switches, restarts the node and asks it `/stats`.
5. If the node does not answer with at least nine tenths of the entries the build promised, the build before runs again and the bad one is not tried a second time.

The living sea (the day's census, tides, notes, jobs) is kept in `/var/lib/mare/sea.ndjson` and survives every restart.

## The long memory

Pathways, private minds, the record of the doors and residents live in the sea's database, so no restart and no new server can lose them. A server never gets a secret from outside:

1. `bootstrap.sh` makes the server's secret (`openssl rand -hex 32`) and shows only its SHA-256 (`/_boot/status.txt`, the line `writer:`).
2. That SHA-256 is added to `mare.keys` in the database. From then on the database answers this server.
3. The server asks `MARE_CONFIG_URL` (given in `cloud-init.yaml`) with its secret; the database function `mare-node-config` checks it and answers with the address and the public key of the database. The updater writes both to `/etc/mare/env` and restarts the node.

## How the server is doing

`https://hz.mareliberum.dev/_boot/status.json` (release, memory, load), `status.txt` (what happened, newest last), `bootstrap.log`. No secrets are written there.

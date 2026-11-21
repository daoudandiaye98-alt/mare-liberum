#!/bin/sh
# Mare Liberum on your own machine: an empty sea, its state in the folder state/ beside this file
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js 22 or newer is needed: https://nodejs.org"; exit 1; }
echo "Mare Liberum starts. Open http://localhost:${PORT:-8787}/harbour"
MARE_STATE="${MARE_STATE:-./state}" MARE_HARBOUR_ROOM="${MARE_HARBOUR_ROOM:-10}" exec node serve.mjs "$@"

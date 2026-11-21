#!/usr/bin/env bash
# Mare Liberum · fetch the newest build of the sea and run it (as root, every two minutes, by a timer)
#   the build is one file made in the open (GitHub Actions, workflow "sea") and published with its SHA-256;
#   a build that does not come up healthy is taken back and the one before it runs on.
set -uo pipefail
REPO="${MARE_REPO:-daoudandiaye98-alt/mare-liberum}"
FROM="${MARE_RELEASE_URL:-https://github.com/$REPO/releases/download/sea-latest}"
RAW="${MARE_RAW_URL:-https://raw.githubusercontent.com/$REPO/main/deploy}"
ROOT="${MARE_ROOT:-/srv/mare}"; REL="$ROOT/releases"; CUR="$ROOT/current"; BOOT="$ROOT/boot"
OPS="${MARE_OPS:-/var/lib/mare-ops}"; ENVF="${MARE_ENV:-/etc/mare/env}"; SETUP="${MARE_SETUP:-/etc/mare/setup}"
PORT="${MARE_PORT:-8787}"; SYS="${MARE_SYSTEMCTL:-systemctl}"
mkdir -p "$REL" "$BOOT" "$OPS"
exec 9>"$OPS/update.lock"; flock -n 9 || exit 0
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$BOOT/status.txt"; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# ---- the rescue line: a file in the repository that is run once whenever its content has changed
if curl -fsSL -m 30 -o "$tmp/rescue.sh" "$RAW/rescue.sh" 2>/dev/null; then
  sum=$(sha256sum "$tmp/rescue.sh" | cut -d' ' -f1)
  if [ "$(cat "$OPS/rescue.sha" 2>/dev/null)" != "$sum" ]; then
    echo "$sum" > "$OPS/rescue.sha"
    if [ -f "$OPS/rescue.seen" ]; then say "rescue: running ${sum:0:12}"; bash "$tmp/rescue.sh" >> "$BOOT/rescue.log" 2>&1; say "rescue: ended with $?"; fi
    touch "$OPS/rescue.seen"   # the file as it was when the server was made is not run
  fi
fi

# ---- the long memory: once the database knows this server's secret, it hands over its address and public key
if [ -f "$ENVF" ] && [ -f "$SETUP" ] && ! grep -q '^MARE_DB_KEY=' "$ENVF"; then
  cfg=$(grep '^MARE_CONFIG_URL=' "$SETUP" | cut -d= -f2-)
  secret=$(grep '^MARE_DB_SECRET=' "$ENVF" | cut -d= -f2-)
  if [ -n "$cfg" ] && [ -n "$secret" ]; then
    if jq -n --arg s "$secret" '{secret:$s}' | curl -fsS -m 30 -H 'content-type: application/json' --data-binary @- -o "$tmp/cfg.json" "$cfg" 2>/dev/null \
       && u=$(jq -er '.url' "$tmp/cfg.json") && k=$(jq -er '.key' "$tmp/cfg.json") && [[ "$u" == https://* ]]; then
      { echo "MARE_DB_URL=$u"; echo "MARE_DB_KEY=$k"; } >> "$ENVF"
      say "long memory: the database knows this server; address and key are set"
      [ -e "$CUR" ] && $SYS restart mare
    fi
  fi
  unset secret k
fi

# ---- how the server is doing, for anyone who asks (no secrets)
status() {
  local mem act
  act=$($SYS is-active mare 2>/dev/null || true)
  mem=$($SYS show mare -p MemoryCurrent --value 2>/dev/null || echo 0); [[ "$mem" =~ ^[0-9]+$ ]] || mem=0
  jq -n --arg at "$(date -u +%FT%TZ)" --arg rel "$(cat "$OPS/release-id" 2>/dev/null)" --arg bad "$(cat "$OPS/release-bad" 2>/dev/null)" --arg act "$act" \
        --arg load "$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)" --arg up "$(cut -d' ' -f1 /proc/uptime 2>/dev/null)" \
        --arg free "$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null)" --arg disk "$(df -m "$ROOT" 2>/dev/null | awk 'NR==2 {print $4}')" \
        --argjson mem "$((mem / 1048576))" --arg mem_long "$(grep -q '^MARE_DB_KEY=' "$ENVF" 2>/dev/null && echo on || echo off)" \
        '{at:$at, release:$rel, heldBack:$bad, node:$act, nodeMemoryMB:$mem, freeMemoryMB:($free|tonumber? // null), load:$load, uptimeSeconds:($up|tonumber? // null), freeDiskMB:($disk|tonumber? // null), longMemory:$mem_long}' > "$BOOT/status.json.tmp" 2>/dev/null \
    && mv "$BOOT/status.json.tmp" "$BOOT/status.json"
  tail -n 400 "$BOOT/status.txt" > "$BOOT/status.txt.tmp" 2>/dev/null && cat "$BOOT/status.txt.tmp" > "$BOOT/status.txt"; rm -f "$BOOT/status.txt.tmp"
}

# ---- is there a newer build?
if ! curl -fsSL --retry 2 -m 60 -o "$tmp/release.json" "$FROM/release.json" 2>/dev/null; then status; exit 0; fi
id=$(jq -er '.id' "$tmp/release.json" 2>/dev/null) || { status; exit 0; }
sum=$(jq -er '.sha256' "$tmp/release.json" 2>/dev/null) || { status; exit 0; }
[[ "$id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$ ]] || { say "update: a build with a strange name is left alone"; status; exit 0; }
if [ "$(cat "$OPS/release-id" 2>/dev/null)" = "$id" ] || [ "$(cat "$OPS/release-bad" 2>/dev/null)" = "$id" ]; then status; exit 0; fi

say "update: build $id found"
if ! curl -fSL --retry 3 -m 1200 -o "$tmp/sea.tar.gz" "$FROM/sea.tar.gz" 2>/dev/null; then say "update: the build could not be fetched; next try in two minutes"; status; exit 0; fi
if ! echo "$sum  $tmp/sea.tar.gz" | sha256sum -c - >/dev/null 2>&1; then say "update: the file does not match its sum yet; next try in two minutes"; status; exit 0; fi
dir="$REL/$id"; rm -rf "$dir"; mkdir -p "$dir"
if ! tar -xzf "$tmp/sea.tar.gz" -C "$dir" --no-same-owner; then say "update: the build could not be unpacked"; rm -rf "$dir"; status; exit 1; fi
want=$(jq -er '.entries' "$dir/data/build.json" 2>/dev/null || echo 0)
if [ ! -f "$dir/serve.mjs" ] || [ ! -f "$dir/data/sea.tsv.gz" ] || [ "$want" -lt 1000 ]; then say "update: build $id is not whole (entries: $want); left alone"; echo "$id" > "$OPS/release-bad"; rm -rf "$dir"; status; exit 1; fi
chmod -R a+rX "$dir"

# the pieces of this folder travel with the build: units, the web server's config, this script
apply() {
  local d="$1/deploy" changed=0
  [ -d "$d" ] || return 0
  [ "${MARE_APPLY:-1}" = 1 ] || return 0
  for u in mare.service mare-update.service mare-update.timer; do
    if [ -f "$d/$u" ] && ! cmp -s "$d/$u" "/etc/systemd/system/$u"; then install -m 644 "$d/$u" "/etc/systemd/system/$u"; changed=1; fi
  done
  [ $changed = 1 ] && $SYS daemon-reload
  if [ -f "$d/Caddyfile" ] && ! cmp -s "$d/Caddyfile" /etc/caddy/Caddyfile; then
    if caddy validate --config "$d/Caddyfile" --adapter caddyfile > "$BOOT/caddy-check.txt" 2>&1; then install -m 644 "$d/Caddyfile" /etc/caddy/Caddyfile && $SYS reload caddy && say "update: the web server has its new config"; elif ! grep -q "does not hold: $(sha256sum "$d/Caddyfile" | cut -c1-12)" "$BOOT/status.txt" 2>/dev/null; then say "update: the new web server config does not hold: $(sha256sum "$d/Caddyfile" | cut -c1-12) (see /_boot/caddy-check.txt); the old one stays"; fi
  fi
  if [ -f "$d/update.sh" ] && bash -n "$d/update.sh" 2>/dev/null && ! cmp -s "$d/update.sh" /usr/local/bin/mare-update; then install -m 755 "$d/update.sh" /usr/local/bin/mare-update; fi
  return 0
}

healthy() {
  local i n
  for i in $(seq 1 90); do
    n=$(curl -fsS -m 5 --noproxy '*' -A 'MareLiberum-self/1.0 (update check)' "http://127.0.0.1:$PORT/stats" 2>/dev/null | jq -r '.entries' 2>/dev/null)
    if [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -ge $((want * 9 / 10)) ]; then return 0; fi
    sleep 2
  done
  return 1
}

prev=$(readlink -f "$CUR" 2>/dev/null || true)
ln -sfn "$dir" "$CUR.new" && mv -T "$CUR.new" "$CUR"
apply "$dir"
$SYS enable mare >/dev/null 2>&1
$SYS restart mare
if healthy; then
  echo "$id" > "$OPS/release-id"
  say "update: build $id runs ($want entries)"
  # the three newest builds stay; older ones make room
  ls -1dt "$REL"/*/ 2>/dev/null | tail -n +4 | while read -r old; do [ "$(readlink -f "$old")" != "$(readlink -f "$CUR")" ] && rm -rf "$old"; done
else
  say "update: build $id did not come up healthy; taking it back"
  echo "$id" > "$OPS/release-bad"
  if [ -n "$prev" ] && [ -d "$prev" ]; then ln -sfn "$prev" "$CUR.new" && mv -T "$CUR.new" "$CUR"; $SYS restart mare; say "update: the build before runs again"; fi
fi
status

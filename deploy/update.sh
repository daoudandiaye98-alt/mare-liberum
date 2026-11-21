#!/usr/bin/env bash
# Mare Liberum · get the newest build of the sea and run it (as root, every two minutes, by a timer)
#   the server builds the sea itself: when the main branch has moved, or once a day, it takes the code, pulls every
#   lake and writes the open index (as a user of its own, without rights), then switches to the new build;
#   a build that lost a large part of the sea, or does not come up healthy, is taken back and the one before runs on.
#   MARE_SOURCE=release in /etc/mare/setup makes the server fetch a finished build instead (workflow "sea", release
#   "sea-latest", checked against its SHA-256) — for a small server that should not build.
set -uo pipefail
REPO="${MARE_REPO:-daoudandiaye98-alt/mare-liberum}"
GIT="${MARE_GIT_URL:-https://github.com/$REPO}"
FROM="${MARE_RELEASE_URL:-https://github.com/$REPO/releases/download/sea-latest}"
RAW="${MARE_RAW_URL:-https://raw.githubusercontent.com/$REPO/main/deploy}"
ROOT="${MARE_ROOT:-/srv/mare}"; REL="$ROOT/releases"; CUR="$ROOT/current"; BOOT="$ROOT/boot"
OPS="${MARE_OPS:-/var/lib/mare-ops}"; ENVF="${MARE_ENV:-/etc/mare/env}"; SETUP="${MARE_SETUP:-/etc/mare/setup}"
PORT="${MARE_PORT:-8787}"; SYS="${MARE_SYSTEMCTL:-systemctl}"; BUILDER="${MARE_BUILDER-marebuild}"
EVERY="${MARE_REFRESH_HOURS:-24}"; AGAIN="${MARE_RETRY_MINUTES:-120}"; WAIT="${MARE_HEALTH_TRIES:-90}"
SOURCE="${MARE_SOURCE:-$(grep -s '^MARE_SOURCE=' "$SETUP" | cut -d= -f2-)}"; SOURCE="${SOURCE:-build}"
mkdir -p "$REL" "$BOOT" "$OPS"
exec 9>"$OPS/update.lock"; flock -n 9 || exit 0
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$BOOT/status.txt"; }
now() { date +%s; }
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

# ---- the long memory: once the database knows this server's secret, it tells the server its address and public key
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
        --arg free "$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null)" --arg swap "$(awk '/SwapTotal/ {t=$2} /SwapFree/ {f=$2} END {printf "%d", (t-f)/1024}' /proc/meminfo 2>/dev/null)" \
        --arg disk "$(df -m "$ROOT" 2>/dev/null | awk 'NR==2 {print $4}')" --arg src "$SOURCE" --arg sha "$(cat "$OPS/built-sha" 2>/dev/null)" --arg peak "$(cat "$OPS/build-peak-mb" 2>/dev/null)" \
        --argjson mem "$((mem / 1048576))" --arg mem_long "$(grep -q '^MARE_DB_KEY=' "$ENVF" 2>/dev/null && echo on || echo off)" \
        '{at:$at, release:$rel, commit:$sha, heldBack:$bad, source:$src, node:$act, nodeMemoryMB:$mem, freeMemoryMB:($free|tonumber? // null), swapUsedMB:($swap|tonumber? // null), lastBuildPeakMB:($peak|tonumber? // null), load:$load, uptimeSeconds:($up|tonumber? // null), freeDiskMB:($disk|tonumber? // null), longMemory:$mem_long}' > "$BOOT/status.json.tmp" 2>/dev/null \
    && mv "$BOOT/status.json.tmp" "$BOOT/status.json"
  tail -n 400 "$BOOT/status.txt" > "$BOOT/status.txt.tmp" 2>/dev/null && cat "$BOOT/status.txt.tmp" > "$BOOT/status.txt"; rm -f "$BOOT/status.txt.tmp"
}
entries_of() { jq -er '.entries' "$1/data/build.json" 2>/dev/null || echo 0; }
whole() { [ -f "$1/serve.mjs" ] && { [ -f "$1/data/sea.tsv.gz" ] || [ -f "$1/data/sea.tsv" ]; } && [ "$(entries_of "$1")" -ge 1000 ]; }

# ---- a finished build, fetched (MARE_SOURCE=release)
fetch_release() {
  curl -fsSL --retry 2 -m 60 -o "$tmp/release.json" "$FROM/release.json" 2>/dev/null || return 1
  id=$(jq -er '.id' "$tmp/release.json" 2>/dev/null) || return 1
  local sum; sum=$(jq -er '.sha256' "$tmp/release.json" 2>/dev/null) || return 1
  [[ "$id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$ ]] || { say "update: a build with a strange name is left alone"; return 1; }
  if [ "$(cat "$OPS/release-id" 2>/dev/null)" = "$id" ] || [ "$(cat "$OPS/release-bad" 2>/dev/null)" = "$id" ]; then return 1; fi
  say "update: build $id found"
  curl -fSL --retry 3 -m 1200 -o "$tmp/sea.tar.gz" "$FROM/sea.tar.gz" 2>/dev/null || { say "update: the build could not be fetched; next try in two minutes"; return 1; }
  echo "$sum  $tmp/sea.tar.gz" | sha256sum -c - >/dev/null 2>&1 || { say "update: the file does not match its sum yet; next try in two minutes"; return 1; }
  dir="$REL/$id"; rm -rf "$dir"; mkdir -p "$dir"
  tar -xzf "$tmp/sea.tar.gz" -C "$dir" --no-same-owner || { say "update: the build could not be unpacked"; rm -rf "$dir"; return 1; }
  if ! whole "$dir"; then say "update: build $id is not whole (entries: $(entries_of "$dir")); left alone"; echo "$id" > "$OPS/release-bad"; rm -rf "$dir"; return 1; fi
  return 0
}

# ---- a build made here (the default): when main has moved, or the sea is a day old
as_builder() { if [ -n "$BUILDER" ] && id "$BUILDER" >/dev/null 2>&1; then runuser -u "$BUILDER" -- "$@"; else "$@"; fi; }
# what a build is given from this script's surroundings: the path to its tools and nothing else (MARE_KEEP_ENV names more, for machines behind a proxy)
clean=(env -i PATH="$PATH" HOME=/nonexistent); for v in ${MARE_KEEP_ENV:-}; do [ -n "${!v:-}" ] && clean+=("$v=${!v}"); done
fetch_build() {
  local head last tried age since why sha stamp log peak before lost
  head=$(git ls-remote "$GIT" refs/heads/main 2>/dev/null | cut -f1); [[ "$head" =~ ^[0-9a-f]{40}$ ]] || return 1
  last=$(cat "$OPS/built-sha" 2>/dev/null); tried=$(cat "$OPS/tried-sha" 2>/dev/null)
  age=$(( $(now) - $(cat "$OPS/built-at" 2>/dev/null || echo 0) )); since=$(( $(now) - $(cat "$OPS/tried-at" 2>/dev/null || echo 0) ))
  if [ "$head" != "$last" ] && [ "$head" != "$tried" ]; then why="main moved to ${head:0:7}"
  elif [ "$age" -ge $((EVERY * 3600)) ] && [ "$since" -ge $((AGAIN * 60)) ]; then why="the sea is $((age / 3600)) hours old"
  elif [ "$head" != "$last" ] && [ "$since" -ge $((AGAIN * 60)) ]; then why="trying ${head:0:7} again"
  else return 1; fi
  echo "$head" > "$OPS/tried-sha"; now > "$OPS/tried-at"
  stamp=$(date -u +%Y%m%d-%H%M%S); id="$stamp-${head:0:7}"; dir="$REL/$id"; log="$BOOT/build.log"
  say "build: $id ($why)"
  rm -rf "$dir"
  if ! git clone -q --depth 1 --branch main "$GIT" "$dir" > "$log" 2>&1; then say "build: the code could not be fetched"; rm -rf "$dir"; return 1; fi
  sha=$(git -C "$dir" rev-parse HEAD 2>/dev/null)
  # what the builds before learned about the stores' home pages travels on, so no store is read twice
  if [ -f "$OPS/store-pages.json" ] && [ "$(stat -c %s "$OPS/store-pages.json")" -gt "$(stat -c %s "$dir/store-pages.json" 2>/dev/null || echo 0)" ]; then cp "$OPS/store-pages.json" "$dir/store-pages.json"; fi
  [ -n "$BUILDER" ] && id "$BUILDER" >/dev/null 2>&1 && chown -R "$BUILDER" "$dir"
  if ! (cd "$dir" && as_builder "${clean[@]}" node tools/doors-proof.mjs >> "$log" 2>&1); then say "build: $id is held back, a proof does not hold (see /_boot/build.log)"; rm -rf "$dir"; return 1; fi
  # the build runs beside the node that answers, at a lower priority; its memory is watched and written down
  # (when memory runs short, the build is the one that gives way, never the node)
  local run=(nice -n 10); command -v choom >/dev/null 2>&1 && run+=(choom -n 800 --); [ -n "$BUILDER" ] && id "$BUILDER" >/dev/null 2>&1 && run+=(runuser -u "$BUILDER" --)
  # the build may use half of the machine's memory, at most 3 GB
  local heap; heap=$(awk '/MemTotal/ {h = int($2 / 2048); if (h > 3072) h = 3072; if (h < 1024) h = 1024; print h}' /proc/meminfo 2>/dev/null); heap="${MARE_BUILD_HEAP_MB:-${heap:-2048}}"
  run+=("${clean[@]}" NODE_OPTIONS="--max-old-space-size=$heap ${MARE_NODE_OPTIONS:-}" node tools/build.mjs)
  ( cd "$dir" && exec "${run[@]}" >> "$log" 2>&1 ) &
  local pid=$! top=0 rss
  while kill -0 "$pid" 2>/dev/null; do rss=$(ps -o rss= --ppid "$pid" -p "$pid" 2>/dev/null | sort -n | tail -1 | tr -d ' '); [[ "$rss" =~ ^[0-9]+$ ]] && [ "$rss" -gt "$top" ] && top=$rss; sleep 3; done
  wait "$pid"; local ended=$?
  echo $((top / 1024)) > "$OPS/build-peak-mb"
  if [ $ended -ne 0 ] || ! whole "$dir"; then say "build: $id did not finish (exit $ended, entries: $(entries_of "$dir"), peak $((top / 1024)) MB; see /_boot/build.log)"; rm -rf "$dir"; return 1; fi
  [ -f "$dir/store-pages.json" ] && cp "$dir/store-pages.json" "$OPS/store-pages.json"
  # nothing large may be lost against the build that runs now
  before=$(readlink -f "$CUR" 2>/dev/null || true)
  if [ -n "$before" ] && [ -f "$before/data/build.json" ] && ! git -C "$dir" log -1 --format=%B 2>/dev/null | grep -q '\[force-sea\]'; then
    lost=$(cd "$dir" && as_builder "${clean[@]}" node -e 'import("./tools/release.mjs").then(async ({ compare }) => { const fs = await import("node:fs"); const j = (f) => JSON.parse(fs.readFileSync(f, "utf8")); console.log(compare(j("data/build.json"), j(process.argv[1])).join("; ")); })' "$before/data/build.json" 2>> "$log")
    if [ -n "$lost" ]; then say "build: $id is held back, it lost part of the sea ($lost); the build before runs on"; rm -rf "$dir"; return 1; fi
  fi
  # the node reads the compressed index; the plain copy and the lakes' raw rows make room
  rm -f "$dir"/data/*.ndjson; [ -f "$dir/data/sea.tsv.gz" ] && rm -f "$dir/data/sea.tsv"
  rm -rf "$dir/.git"; chown -R root:root "$dir" 2>/dev/null || true
  echo "$sha" > "$tmp/sha"
  say "build: $id is ready ($(entries_of "$dir") entries, peak $((top / 1024)) MB)"
  return 0
}

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
  local i n want="$1"
  for i in $(seq 1 "$WAIT"); do
    n=$(curl -fsS -m 5 --noproxy '*' -A 'MareLiberum-self/1.0 (update check)' "http://127.0.0.1:$PORT/stats" 2>/dev/null | jq -r '.entries' 2>/dev/null)
    if [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -ge $((want * 9 / 10)) ]; then return 0; fi
    sleep 2
  done
  return 1
}

id=""; dir=""
if [ "$SOURCE" = release ]; then fetch_release || { status; exit 0; }; else fetch_build || { status; exit 0; }; fi
chmod -R a+rX "$dir"
want=$(entries_of "$dir")
prev=$(readlink -f "$CUR" 2>/dev/null || true)
ln -sfn "$dir" "$CUR.new" && mv -T "$CUR.new" "$CUR"
apply "$dir"
$SYS enable mare >/dev/null 2>&1
$SYS restart mare
if healthy "$want"; then
  echo "$id" > "$OPS/release-id"; [ -f "$tmp/sha" ] && { cat "$tmp/sha" > "$OPS/built-sha"; now > "$OPS/built-at"; }
  say "update: build $id runs ($want entries)"
  # the three newest builds stay; older ones make room
  ls -1dt "$REL"/*/ 2>/dev/null | tail -n +4 | while read -r old; do [ "$(readlink -f "$old")" != "$(readlink -f "$CUR")" ] && rm -rf "$old"; done
else
  say "update: build $id did not come up healthy; taking it back"
  echo "$id" > "$OPS/release-bad"
  if [ -n "$prev" ] && [ -d "$prev" ]; then ln -sfn "$prev" "$CUR.new" && mv -T "$CUR.new" "$CUR"; $SYS restart mare; say "update: the build before runs again"; fi
fi
status

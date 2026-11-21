#!/usr/bin/env bash
# Mare Liberum · the rescue line
# The server looks at this file every two minutes and runs it once whenever its content has changed. It is the way
# to mend a server that cannot be reached any other way. Normally it does nothing.
#
# 2026-11-21 (1) · the first builds of the sea took longer than the half hour the updater was given, and were cut
#   off shortly before the end. The updater got three hours and its newest script.
# 2026-11-21 (2) · the updater then gave the build a heap of 1459 MB, and the build broke off (exit 134). The newest
#   script was installed here, because it travels with a build that succeeds.
# 2026-11-21 (3) · two lakes do not answer this evening (they were asked seven times in three hours), so the builds
#   are held back, and with them the web server's config. The config is needed now: it opens the road for callers the
#   old host hands over (/_forwarded). So it is installed here, with the updater's newest script. The commit that
#   brings this is not built at once: the updater tries it by itself when the lakes had two hours of rest.
# 2026-11-21 (4) · a look from the server itself: does the old host hand callers on? It is asked the way a caller
#   with an old address asks (the sea's name, the old host's address); the answers are written to
#   /_boot/forward-check.txt. Nothing is changed. The commit that brings this look is not built at once.
BOOT=/srv/mare/boot; OPS=/var/lib/mare-ops
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$BOOT/status.txt"; }
t=$(mktemp -d)
{
  date -u +%FT%TZ
  for p in /stats / "/e/04c4e6-90.myshopify.com:ucp:store" "/search?q=weather&pageSize=1" /robots.txt /google7333cfe4c3fb5c26.html; do
    curl -sS -m 30 -A 'MareLiberum-self/1.0 (forward check)' --resolve mareliberum.dev:443:76.76.21.21 -o "$t/body" -D "$t/head" -w "%{http_code} %{size_download}b %{time_total}s $p\n" "https://mareliberum.dev$p" 2>&1
    grep -i '^server:\|^via:\|^x-robots-tag:\|^x-vercel-error:\|^location:' "$t/head" 2>/dev/null | tr -d '\r' | sed 's/^/   /'
    head -c 160 "$t/body" 2>/dev/null | tr '\n' ' ' | sed 's/^/   /'; echo
  done
} > "$BOOT/forward-check.txt" 2>&1
say "rescue: asked the old host under the sea's name (see /_boot/forward-check.txt)"
head=$(git ls-remote https://github.com/daoudandiaye98-alt/mare-liberum refs/heads/main 2>/dev/null | cut -f1)
if [[ "$head" =~ ^[0-9a-f]{40}$ ]] && [ "$(cat "$OPS/built-sha" 2>/dev/null)" != "$head" ]; then
  echo "$head" > "$OPS/tried-sha"; date +%s > "$OPS/tried-at"
  say "rescue: ${head:0:7} is built when the lakes had two hours of rest"
fi
rm -rf "$t"
exit 0

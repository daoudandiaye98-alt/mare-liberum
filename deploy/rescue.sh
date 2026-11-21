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
RAW="https://raw.githubusercontent.com/daoudandiaye98-alt/mare-liberum/main/deploy"
BOOT=/srv/mare/boot; OPS=/var/lib/mare-ops
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$BOOT/status.txt"; }
head=$(git ls-remote https://github.com/daoudandiaye98-alt/mare-liberum refs/heads/main 2>/dev/null | cut -f1)
[[ "$head" =~ ^[0-9a-f]{40}$ ]] && RAW="https://raw.githubusercontent.com/daoudandiaye98-alt/mare-liberum/$head/deploy"
t=$(mktemp -d)
if curl -fsSL --retry 3 -m 60 -o "$t/update.sh" "$RAW/update.sh" && bash -n "$t/update.sh" && grep -q 'HEAD_SHA' "$t/update.sh" && ! cmp -s "$t/update.sh" /usr/local/bin/mare-update; then
  install -m 755 "$t/update.sh" /usr/local/bin/mare-update && say "rescue: the updater has its newest script"
fi
if curl -fsSL --retry 3 -m 60 -o "$t/Caddyfile" "$RAW/Caddyfile" && grep -q '_forwarded' "$t/Caddyfile" && ! cmp -s "$t/Caddyfile" /etc/caddy/Caddyfile; then
  if caddy validate --config "$t/Caddyfile" --adapter caddyfile > "$BOOT/caddy-check.txt" 2>&1; then
    install -m 644 "$t/Caddyfile" /etc/caddy/Caddyfile && systemctl reload caddy && say "rescue: the web server has its new config"
  else
    say "rescue: the new web server config does not hold (see /_boot/caddy-check.txt); the old one stays"
  fi
fi
if [[ "$head" =~ ^[0-9a-f]{40}$ ]] && [ "$(cat "$OPS/built-sha" 2>/dev/null)" != "$head" ]; then
  echo "$head" > "$OPS/tried-sha"; date +%s > "$OPS/tried-at"
  say "rescue: ${head:0:7} is built when the lakes had two hours of rest"
fi
rm -rf "$t"
exit 0

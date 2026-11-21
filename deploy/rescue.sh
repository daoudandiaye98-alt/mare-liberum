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
# 2026-11-21 (5) · the sea gets its immune system, and the server its armour. This run takes away what the server
#   showed about its own making, puts on the armour (deploy/harden.sh: sign-in, updates, network, the inside, the
#   log), sets the watch (a node that hangs is started again) and hands the updater its newest script — which can
#   carry the sea on when only the code changed ([keep-sea]) and installs only what the repository gave it. The
#   updater is then started again in place and builds the commit that brought this.
BOOT=/srv/mare/boot; OPS=/var/lib/mare-ops
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$BOOT/status.txt"; }
head=$(git ls-remote https://github.com/daoudandiaye98-alt/mare-liberum refs/heads/main 2>/dev/null | cut -f1)
[[ "$head" =~ ^[0-9a-f]{40}$ ]] || { say "rescue: main could not be asked; nothing was done"; exit 0; }
RAW="https://raw.githubusercontent.com/daoudandiaye98-alt/mare-liberum/$head/deploy"
t=$(mktemp -d)
get() { curl -fsSL --retry 3 -m 60 -o "$t/$1" "$RAW/$1"; }

# what the server showed about its own making is no longer shown
rm -f "$BOOT/writer.sha256" "$BOOT/bootstrap.log" "$BOOT/bootstrap-first.log" "$BOOT/caddy-check.txt" "$BOOT/forward-check.txt"

# the armour (what it prints stays on the server; what is in force is said in the status)
if get harden.sh && bash -n "$t/harden.sh"; then
  sha256sum "$t/harden.sh" | cut -d' ' -f1 > "$OPS/harden.sha"
  bash "$t/harden.sh" >> "$OPS/harden.log" 2>&1 || say "rescue: the armour ended with an error (see the server's own log)"
else say "rescue: the armour could not be fetched"; fi

# the watch
if get watch.sh && bash -n "$t/watch.sh" && get mare-watch.service && get mare-watch.timer; then
  install -m 755 "$t/watch.sh" /usr/local/bin/mare-watch
  install -m 644 "$t/mare-watch.service" /etc/systemd/system/mare-watch.service; install -m 644 "$t/mare-watch.timer" /etc/systemd/system/mare-watch.timer
  systemctl daemon-reload; systemctl enable --now mare-watch.timer >/dev/null 2>&1 && say "rescue: the watch looks at the node every half minute"
else say "rescue: the watch could not be fetched"; fi

# the updater's newest script comes last: the updater is started again in place and goes on with the newest commit
if get update.sh && bash -n "$t/update.sh" && grep -q 'keep-sea' "$t/update.sh" && grep -q 'unchanged()' "$t/update.sh" && ! cmp -s "$t/update.sh" /usr/local/bin/mare-update; then
  install -m 755 "$t/update.sh" /usr/local/bin/mare-update && say "rescue: the updater has its newest script and starts again"
  rm -rf "$t"
  systemctl restart --no-block mare-update.service
  exit 0
fi
rm -rf "$t"
exit 0

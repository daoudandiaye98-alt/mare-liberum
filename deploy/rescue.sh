#!/usr/bin/env bash
# Mare Liberum · the rescue line
# The server looks at this file every two minutes and runs it once whenever its content has changed. It is the way
# to mend a server that cannot be reached any other way. Normally it does nothing.
#
# 2026-11-21 · the first builds of the sea took longer than the half hour the updater was given, and were cut off
#   shortly before the end. The updater gets three hours and its newest script (more helpers for name lookups, a
#   status once a minute while it builds), and starts again in place of the run that carries the old limit.
RAW="https://raw.githubusercontent.com/daoudandiaye98-alt/mare-liberum/main/deploy"
unit=/etc/systemd/system/mare-update.service
if grep -q '^TimeoutStartSec=1800$' "$unit" 2>/dev/null; then
  t=$(mktemp -d)
  if curl -fsSL --retry 3 -m 60 -o "$t/update.sh" "$RAW/update.sh" && bash -n "$t/update.sh" && grep -q 'UV_THREADPOOL_SIZE' "$t/update.sh"; then install -m 755 "$t/update.sh" /usr/local/bin/mare-update; echo "rescue: the updater has its newest script"; fi
  if curl -fsSL --retry 3 -m 60 -o "$t/unit" "$RAW/mare-update.service" && grep -q '^ExecStart=/usr/local/bin/mare-update$' "$t/unit" && ! grep -q '^TimeoutStartSec=1800$' "$t/unit"; then install -m 644 "$t/unit" "$unit"; fi
  # whatever the fetch brought: the old limit goes
  grep -q '^TimeoutStartSec=1800$' "$unit" && sed -i 's/^TimeoutStartSec=.*/TimeoutStartSec=3h/' "$unit"
  rm -rf "$t"
  systemctl daemon-reload
  echo "$(date -u +%FT%TZ) rescue: the updater has three hours for a build now and starts again" | tee -a /srv/mare/boot/status.txt
  systemctl restart --no-block mare-update.service
fi
exit 0

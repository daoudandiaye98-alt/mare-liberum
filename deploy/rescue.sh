#!/usr/bin/env bash
# Mare Liberum · the rescue line
# The server looks at this file every two minutes and runs it once whenever its content has changed. It is the way
# to mend a server that cannot be reached any other way. Normally it does nothing.
#
# 2026-11-21 (1) · the first builds of the sea took longer than the half hour the updater was given, and were cut
#   off shortly before the end. The updater got three hours and its newest script.
# 2026-11-21 (2) · the updater then gave the build a heap of 1459 MB, and the build broke off (exit 134): the sea
#   alone needs 1392 MB while it is written. The script that mends this travels with a build that succeeds, and no
#   build succeeds with the script that is installed. So the newest script is installed here, and the updater starts
#   again in place of the run that carries the old one.
RAW="https://raw.githubusercontent.com/daoudandiaye98-alt/mare-liberum/main/deploy"
t=$(mktemp -d)
if curl -fsSL --retry 3 -m 60 -o "$t/update.sh" "$RAW/update.sh" && bash -n "$t/update.sh" \
   && grep -q 'UV_THREADPOOL_SIZE' "$t/update.sh" && ! grep -q 'int(\$2 / 2048) - 450' "$t/update.sh" \
   && ! cmp -s "$t/update.sh" /usr/local/bin/mare-update; then
  install -m 755 "$t/update.sh" /usr/local/bin/mare-update
  rm -rf "$t"
  echo "$(date -u +%FT%TZ) rescue: the updater has its newest script (the build gets its room back) and starts again" | tee -a /srv/mare/boot/status.txt
  systemctl restart --no-block mare-update.service
fi
rm -rf "$t"
exit 0

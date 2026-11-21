#!/usr/bin/env bash
# Mare Liberum · the watch
# Every half minute the node is asked one small thing. A node that does not answer three times in a row, although it
# has been running for five minutes, is started again: a node that hangs never stays hung. At most one restart in
# ten minutes, and while the updater is at work the watch keeps its hands off (the updater waits for the node itself).
set -u
OPS="${MARE_OPS:-/var/lib/mare-ops}"; BOOT="${MARE_BOOT:-/srv/mare/boot}"; PORT="${MARE_PORT:-8787}"; SYS="${MARE_SYSTEMCTL:-systemctl}"
miss="$OPS/watch-misses"; last="$OPS/watch-restart"
if curl -fsS -m 10 -o /dev/null --noproxy '*' -A 'MareLiberum-self/1.0 (watch)' "http://127.0.0.1:$PORT/robots.txt" 2>/dev/null; then rm -f "$miss"; exit 0; fi
n=$(( $(cat "$miss" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$miss"
[ "$n" -ge 3 ] || exit 0
$SYS is-active --quiet mare-update.service 2>/dev/null && exit 0
# a node that was started less than five minutes ago is still reading the sea
since=$($SYS show mare -p ActiveEnterTimestampMonotonic --value 2>/dev/null); up=$(awk '{printf "%d", $1 * 1000000}' /proc/uptime 2>/dev/null)
if [[ "$since" =~ ^[0-9]+$ ]] && [[ "$up" =~ ^[0-9]+$ ]] && [ $(( (up - since) / 1000000 )) -lt 300 ]; then exit 0; fi
if [ -f "$last" ] && [ $(( $(date +%s) - $(cat "$last" 2>/dev/null || echo 0) )) -lt 600 ]; then exit 0; fi
date +%s > "$last"; rm -f "$miss"
echo "$(date -u +%FT%TZ) watch: the node did not answer three times in a row; it is started again" >> "$BOOT/status.txt"
$SYS restart mare
exit 0

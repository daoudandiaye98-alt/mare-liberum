#!/usr/bin/env bash
# Mare Liberum · make a fresh server into a node (Ubuntu or Debian, as root). Safe to run again.
#   a web server with TLS in front (Caddy), the node behind it (Node.js, one process, user "mare"),
#   and a timer that builds the sea from the open repository whenever it has moved, and once a day.
#   No key and no password is in this file.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
REPO="${MARE_REPO:-daoudandiaye98-alt/mare-liberum}"
RAW="https://raw.githubusercontent.com/$REPO/main/deploy"
BOOT=/srv/mare/boot
mkdir -p "$BOOT" /srv/mare/releases /etc/mare /var/lib/mare /var/lib/mare-ops
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$BOOT/status.txt"; }
say "bootstrap: start on $(hostname), $(. /etc/os-release && echo "$PRETTY_NAME"), $(nproc) CPU, $(awk '/MemTotal/ {printf "%d MB", $2/1024}' /proc/meminfo)"

# while the server is being made, its log can be read by address on port 8080; the web server takes over afterwards (port 80)
if ! command -v caddy >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  mkdir -p /srv/mare/early/_boot && ln -sfn "$BOOT/bootstrap.log" /srv/mare/early/_boot/bootstrap.log && ln -sfn "$BOOT/status.txt" /srv/mare/early/_boot/status.txt
  ( cd /srv/mare/early && exec python3 -m http.server 8080 >/dev/null 2>&1 ) &
  echo $! > /run/mare-early.pid
fi
# the package manager may be busy right after a server is made: wait for it, and try again when the network stumbles
apt_do() { local i; for i in 1 2 3 4 5; do apt-get -o DPkg::Lock::Timeout=600 "$@" && return 0; sleep 15; done; return 1; }

# room to breathe on a small machine
if ! swapon --show | grep -q . ; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab && sysctl -q -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/60-mare.conf && say "swap: 4 GB" || say "swap: not set"
fi

say "packages"
apt_do update -qq
apt_do install -y -qq ca-certificates curl jq tar gzip xz-utils openssl ufw gnupg git >/dev/null
apt-get -o DPkg::Lock::Timeout=600 install -y -qq debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades >/dev/null 2>&1 || true

# Node.js 22: from the NodeSource repository; when that does not work, the build from nodejs.org, checked against its list of sums
if ! node -v 2>/dev/null | grep -q '^v2[2-9]\.'; then
  if curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource.sh && bash /tmp/nodesource.sh >/dev/null 2>&1 && apt_do install -y -qq nodejs >/dev/null 2>&1 && node -v | grep -q '^v22\.'; then :; else
    say "node: taking the build from nodejs.org"
    arch=$(uname -m); case "$arch" in x86_64) a=x64 ;; aarch64) a=arm64 ;; *) say "node: unknown machine $arch"; exit 1 ;; esac
    curl -fsSL -o /tmp/SHASUMS256.txt https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
    f=$(awk -v a="linux-$a.tar.xz" '$2 ~ a"$" {print $2}' /tmp/SHASUMS256.txt | head -1)
    curl -fsSL -o "/tmp/$f" "https://nodejs.org/dist/latest-v22.x/$f"
    (cd /tmp && grep " $f\$" SHASUMS256.txt | sha256sum -c - >/dev/null)
    rm -rf /opt/node && mkdir -p /opt/node && tar -xJf "/tmp/$f" -C /opt/node --strip-components=1 && ln -sfn /opt/node/bin/node /usr/local/bin/node
  fi
fi
say "node: $(node -v)"

# Caddy: from its own repository; when that does not work, the one that comes with the system
if ! command -v caddy >/dev/null 2>&1; then
  if curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
     && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list \
     && apt_do update -qq && apt_do install -y -qq caddy >/dev/null 2>&1; then :; else
    rm -f /etc/apt/sources.list.d/caddy-stable.list; apt_do update -qq; apt_do install -y -qq caddy >/dev/null
  fi
fi
say "caddy: $(caddy version | head -1)"

id mare >/dev/null 2>&1 || useradd --system --home /var/lib/mare --shell /usr/sbin/nologin mare
# the sea is built by a user of its own that can read nothing of the node's (it reads the open web)
id marebuild >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin marebuild
chown -R mare:mare /var/lib/mare && chmod 750 /var/lib/mare
chmod 755 /srv/mare /srv/mare/releases "$BOOT"

# what the node is told. The secret of this server is made here, once, and is written nowhere else; the log shows only its SHA-256.
if [ ! -f /etc/mare/env ]; then
  umask 077
  { echo "MARE_BASE=${MARE_BASE:-https://mareliberum.dev}"; echo "HOST=127.0.0.1"; echo "PORT=8787"; echo "MARE_PROXY=1"; echo "MARE_STATE=/var/lib/mare"; echo "MARE_DB_SECRET=$(openssl rand -hex 32)"; } > /etc/mare/env
  umask 022
fi
chown root:mare /etc/mare/env && chmod 640 /etc/mare/env
( . /etc/mare/env; printf '%s' "$MARE_DB_SECRET" | sha256sum | cut -d' ' -f1 > "$BOOT/writer.sha256" )
say "writer: sha256 $(cat "$BOOT/writer.sha256")"

# the pieces of this folder, straight from the repository for the first run; every later build brings its own
for f in Caddyfile Caddyfile.plain mare.service mare-update.service mare-update.timer update.sh; do curl -fsSL --retry 5 -m 60 -o "/tmp/mare-$f" "$RAW/$f"; done
install -m 755 /tmp/mare-update.sh /usr/local/bin/mare-update
install -m 644 /tmp/mare-mare.service /etc/systemd/system/mare.service
install -m 644 /tmp/mare-mare-update.service /etc/systemd/system/mare-update.service
install -m 644 /tmp/mare-mare-update.timer /etc/systemd/system/mare-update.timer
if caddy validate --config /tmp/mare-Caddyfile --adapter caddyfile > "$BOOT/caddy-check.txt" 2>&1; then install -m 644 /tmp/mare-Caddyfile /etc/caddy/Caddyfile; say "caddy: config holds"
else install -m 644 /tmp/mare-Caddyfile.plain /etc/caddy/Caddyfile; say "caddy: the full config does NOT hold (see /_boot/caddy-check.txt); running the plain one, by address only"; fi

# only the doors of the web are open; sign-in by password is off (a key given when the server was made still works)
mkdir -p /etc/ssh/sshd_config.d && printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\n' > /etc/ssh/sshd_config.d/00-mare.conf && (systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true)
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null; ufw --force enable >/dev/null
say "firewall: 22, 80, 443 open; password sign-in off"

systemctl daemon-reload
if [ -f /run/mare-early.pid ]; then kill "$(cat /run/mare-early.pid)" 2>/dev/null || true; rm -f /run/mare-early.pid; fi
install -m 644 "$BOOT/bootstrap.log" "$BOOT/bootstrap-first.log" 2>/dev/null || true
systemctl enable caddy >/dev/null 2>&1; systemctl restart caddy; sleep 2; say "caddy: $(systemctl is-active caddy)"
systemctl enable --now mare-update.timer >/dev/null 2>&1
say "bootstrap: done; the first build of the sea starts now (about a quarter of an hour; see /_boot/build.log and /_boot/status.json)"
systemctl start --no-block mare-update.service || true

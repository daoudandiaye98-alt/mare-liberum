#!/usr/bin/env bash
# Mare Liberum · the server's own armour
# Run as root, as often as one likes: every step sets a state, none depends on the one before, and a step that does
# not hold is said and left as it was. Nothing here closes a door the sea needs (22, 80, 443).
#   sign-in      keys only, three tries, no forwarding of screens or agents
#   updates      security updates of the system, of Node.js and of the web server install themselves; the server
#                restarts at night when an update asks for it
#   network      the kernel's quiet defaults against forged and redirected packets; sign-in tries are slowed
#   the inside   the programs of the sea (the node, the build) cannot reach the cloud's service address or the web
#                server's control port, whatever they are tricked into
#   the log      has a ceiling
BOOT="${MARE_BOOT:-/srv/mare/boot}"
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$BOOT/status.txt"; }
done_=()

# ---- sign-in (the first file read wins, so this one comes first)
if command -v sshd >/dev/null 2>&1; then
  f=/etc/ssh/sshd_config.d/00-mare.conf; old=$(cat "$f" 2>/dev/null)
  mkdir -p /etc/ssh/sshd_config.d
  printf '%s\n' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PermitRootLogin prohibit-password' 'PermitEmptyPasswords no' 'MaxAuthTries 3' 'LoginGraceTime 30' 'X11Forwarding no' 'AllowAgentForwarding no' 'ClientAliveInterval 300' 'ClientAliveCountMax 2' > "$f"
  if sshd -t 2>/dev/null; then [ "$old" = "$(cat "$f")" ] || { systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true; }; done_+=(sign-in)
  else printf '%s\n' "$old" > "$f"; say "armour: the sign-in rules did not hold and were taken back"; fi
fi

# ---- updates
if command -v unattended-upgrade >/dev/null 2>&1 || apt-get -o DPkg::Lock::Timeout=120 install -y -qq unattended-upgrades >/dev/null 2>&1; then
  printf '%s\n' 'APT::Periodic::Update-Package-Lists "1";' 'APT::Periodic::Unattended-Upgrade "1";' 'APT::Periodic::AutocleanInterval "7";' > /etc/apt/apt.conf.d/20auto-upgrades
  printf '%s\n' '// Mare Liberum: Node.js and the web server come from their makers and are kept current like the system' 'Unattended-Upgrade::Origins-Pattern { "site=deb.nodesource.com"; "site=dl.cloudsmith.io"; };' 'Unattended-Upgrade::Automatic-Reboot "true";' 'Unattended-Upgrade::Automatic-Reboot-Time "03:40";' 'Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";' > /etc/apt/apt.conf.d/52mare-upgrades
  systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true; done_+=(updates)
else say "armour: unattended-upgrades could not be installed"; fi

# ---- network
printf '%s\n' 'net.ipv4.tcp_syncookies=1' 'net.ipv4.conf.all.rp_filter=1' 'net.ipv4.conf.default.rp_filter=1' 'net.ipv4.conf.all.accept_redirects=0' 'net.ipv4.conf.default.accept_redirects=0' 'net.ipv6.conf.all.accept_redirects=0' 'net.ipv6.conf.default.accept_redirects=0' 'net.ipv4.conf.all.send_redirects=0' 'net.ipv4.conf.default.send_redirects=0' 'net.ipv4.conf.all.accept_source_route=0' 'net.ipv6.conf.all.accept_source_route=0' 'net.ipv4.icmp_echo_ignore_broadcasts=1' 'net.ipv4.tcp_max_syn_backlog=4096' 'net.core.somaxconn=4096' 'kernel.kptr_restrict=2' 'kernel.dmesg_restrict=1' 'fs.protected_hardlinks=1' 'fs.protected_symlinks=1' > /etc/sysctl.d/60-mare.conf
sysctl -q -p /etc/sysctl.d/60-mare.conf >/dev/null 2>&1 && done_+=(network)
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then ufw limit 22/tcp >/dev/null 2>&1 && done_+=(sign-in-pace); fi

# ---- the inside
if id mare >/dev/null 2>&1 && id marebuild >/dev/null 2>&1 && { command -v nft >/dev/null 2>&1 || apt-get -o DPkg::Lock::Timeout=120 install -y -qq nftables >/dev/null 2>&1; }; then
  mkdir -p /etc/mare
  cat > /etc/mare/guard.nft <<'NFT'
# Mare Liberum: the programs of the sea never call the cloud's service address or the web server's control port
table inet mare_guard
delete table inet mare_guard
table inet mare_guard {
	chain out {
		type filter hook output priority 0; policy accept;
		meta skuid { mare, marebuild } ip daddr 169.254.0.0/16 reject
		meta skuid { mare, marebuild } oifname "lo" tcp dport 2019 reject
	}
}
NFT
  cat > /etc/systemd/system/mare-guard.service <<'UNIT'
[Unit]
Description=Mare Liberum · the programs of the sea do not call inwards
After=network-pre.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/nft -f /etc/mare/guard.nft
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
  if nft -c -f /etc/mare/guard.nft 2>/dev/null && nft -f /etc/mare/guard.nft 2>/dev/null; then systemctl daemon-reload; systemctl enable mare-guard.service >/dev/null 2>&1; done_+=(inside); else say "armour: the rule for the inside did not hold and is not in force"; fi
fi

# ---- the log
mkdir -p /etc/systemd/journald.conf.d && printf '%s\n' '[Journal]' 'SystemMaxUse=400M' 'MaxRetentionSec=30day' > /etc/systemd/journald.conf.d/mare.conf && done_+=(log)
journalctl --vacuum-size=400M >/dev/null 2>&1 || true

say "armour: in force — ${done_[*]}"
exit 0

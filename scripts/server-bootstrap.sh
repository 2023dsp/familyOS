#!/usr/bin/env bash
# FamilyOS — one-shot Hetzner bootstrap.
#
# Run this on a fresh Ubuntu 22.04+ VPS as root. It installs Docker,
# Caddy (for HTTPS), clones the repo, writes a production .env, starts
# the stack, and authorises the GitHub Actions deploy key.
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/2023dsp/familyOS/main/scripts/server-bootstrap.sh) \
#        --domain ournest.davide-n8n.xyz \
#        --family-password 'YOUR_FAMILY_PASSWORD' \
#        --session-secret 'YOUR_SESSION_SECRET' \
#        --deploy-key 'ssh-ed25519 AAAA... familyos-deploy@hetzner'
#
# After it finishes the app is live on https://<domain>, and pushes to main
# automatically redeploy via .github/workflows/deploy.yml.

set -euo pipefail

REPO_URL="https://github.com/2023dsp/familyOS.git"
APP_DIR="/opt/familyos"

DOMAIN=""
FAMILY_PW=""
SESSION_SECRET=""
DEPLOY_KEY=""
FAMILY_NAMES="Davide & Luize"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --family-password) FAMILY_PW="$2"; shift 2 ;;
    --session-secret) SESSION_SECRET="$2"; shift 2 ;;
    --deploy-key) DEPLOY_KEY="$2"; shift 2 ;;
    --family-names) FAMILY_NAMES="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -z "$DOMAIN" ]] && { echo "Missing --domain"; exit 1; }
[[ -z "$FAMILY_PW" ]] && { echo "Missing --family-password"; exit 1; }
[[ -z "$SESSION_SECRET" ]] && { echo "Missing --session-secret"; exit 1; }

echo "==> Updating apt + installing prereqs"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates git ufw debian-keyring debian-archive-keyring apt-transport-https gpg

if ! command -v docker >/dev/null; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
fi

if ! command -v caddy >/dev/null; then
  echo "==> Installing Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Configuring firewall"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [[ -n "$DEPLOY_KEY" ]]; then
  echo "==> Installing GitHub Actions deploy public key"
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  touch /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
  if ! grep -qF "$DEPLOY_KEY" /root/.ssh/authorized_keys; then
    echo "$DEPLOY_KEY" >> /root/.ssh/authorized_keys
  fi
fi

echo "==> Cloning / updating repo"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" reset --hard origin/main
fi

echo "==> Writing $APP_DIR/.env"
cat > "$APP_DIR/.env" <<ENV
DATABASE_URL=postgresql://familyos:familyos@db:5432/familyos?schema=public
FAMILY_ACCESS_PASSWORD=$FAMILY_PW
SESSION_SECRET=$SESSION_SECRET
SESSION_DAYS=30
NEXT_PUBLIC_APP_NAME=FamilyOS
NEXT_PUBLIC_FAMILY_NAMES=$FAMILY_NAMES
APP_PORT=3000
NODE_ENV=production
ENV
chmod 600 "$APP_DIR/.env"

echo "==> Writing /etc/caddy/Caddyfile"
cat > /etc/caddy/Caddyfile <<CADDY
{
  email admin@$DOMAIN
}

$DOMAIN {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

echo "==> Building + starting Docker stack"
cd "$APP_DIR"
docker compose pull || true
docker compose up -d --build

echo "==> Done."
echo "App should be live in a minute at https://$DOMAIN"
echo "Tail logs with: docker compose -f $APP_DIR/docker-compose.yml logs -f"

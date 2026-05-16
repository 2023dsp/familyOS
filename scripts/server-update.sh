#!/usr/bin/env bash
# FamilyOS — pull latest code and rebuild containers.
# Invoked by .github/workflows/deploy.yml on every push to main.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/familyos}"
cd "$APP_DIR"
git fetch --all --prune
git reset --hard origin/main
docker compose pull || true
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "Update complete."

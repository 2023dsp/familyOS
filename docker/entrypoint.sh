#!/bin/sh
set -e

echo "FamilyOS · syncing database schema (prisma db push)…"
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "FamilyOS · seeding templates / family members…"
  node prisma/seed.cjs || echo "Seed step finished (errors ignored)."
fi

echo "FamilyOS · starting server on port ${PORT:-3000}"
exec "$@"

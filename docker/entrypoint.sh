#!/bin/sh
set -e

echo "FamilyOS · running database migrations…"
node node_modules/prisma/build/index.js migrate deploy

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "FamilyOS · seeding templates / family members…"
  node node_modules/tsx/dist/cli.mjs prisma/seed.ts || echo "Seed step finished (errors ignored)."
fi

echo "FamilyOS · starting server on port ${PORT:-3000}"
exec "$@"

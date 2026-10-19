#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -d prisma/migrations ]] && find prisma/migrations -type f -print -quit | grep -q .; then
  echo "Prisma migrations are forbidden; Supabase SQL migrations are the only schema authority." >&2
  exit 1
fi

if rg -n 'prisma (migrate|db push)' package.json prisma.config.ts >/dev/null; then
  echo "Prisma migrate/db push commands are forbidden." >&2
  exit 1
fi

echo "Supabase SQL is the sole schema migration authority."

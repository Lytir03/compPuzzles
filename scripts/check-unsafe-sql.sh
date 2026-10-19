#!/usr/bin/env bash
set -Eeuo pipefail

if git grep -nE '\$(queryRawUnsafe|executeRawUnsafe)' -- '*.ts' '*.tsx'; then
  echo "Unsafe Prisma raw SQL APIs are forbidden in runtime TypeScript." >&2
  exit 1
fi

echo "No unsafe Prisma raw SQL APIs found."

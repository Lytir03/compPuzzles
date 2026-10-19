#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${ALLOW_RETENTION_DELETE:-}" != "DELETE_EXPIRED_PRIVATE_DATA" ]]; then
  echo "Set ALLOW_RETENTION_DELETE=DELETE_EXPIRED_PRIVATE_DATA to continue." >&2
  exit 1
fi

if [[ -z "${MIGRATION_DATABASE_URL:-}" ]]; then
  echo "MIGRATION_DATABASE_URL is required for this protected manual operation." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Required command not found: psql" >&2
  exit 1
fi

psql "${MIGRATION_DATABASE_URL}" \
  --set=ON_ERROR_STOP=1 \
  --file="$(dirname "$0")/retention.sql"

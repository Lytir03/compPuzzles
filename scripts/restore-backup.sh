#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${ALLOW_DATABASE_RESTORE:-}" != "I_UNDERSTAND_THIS_REPLACES_DATABASE" ]]; then
  echo "Set ALLOW_DATABASE_RESTORE=I_UNDERSTAND_THIS_REPLACES_DATABASE to continue." >&2
  exit 1
fi

backup_key="${1:-}"
if [[ -z "${backup_key}" ]]; then
  echo "Usage: scripts/restore-backup.sh <R2 object key>" >&2
  exit 1
fi

required=(
  RESTORE_DATABASE_URL
  BACKUP_AGE_IDENTITY_FILE
  R2_BUCKET
  R2_ENDPOINT_URL
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
done

for command_name in aws age pg_restore psql; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command not found: ${command_name}" >&2
    exit 1
  fi
done

if [[ ! -r "${BACKUP_AGE_IDENTITY_FILE}" ]]; then
  echo "Age identity file is not readable." >&2
  exit 1
fi

case "${backup_key}" in
  "${R2_BACKUP_PREFIX:-comppuzzles/database}"/daily/*.dump.age|"${R2_BACKUP_PREFIX:-comppuzzles/database}"/weekly/*.dump.age) ;;
  *)
    echo "Refusing to restore an object outside the configured backup prefix." >&2
    exit 1
    ;;
esac

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
manifest="$(aws s3 cp \
  "s3://${R2_BUCKET}/${backup_key}.json" - \
  --endpoint-url "${R2_ENDPOINT_URL}" \
  --only-show-errors)"
if [[ -z "${manifest}" || "${manifest}" != *'"migrationsSha256"'* || "${manifest}" != *'"rowCounts"'* ]]; then
  echo "Backup manifest is missing or invalid; refusing restore." >&2
  exit 1
fi
echo "Verified backup manifest metadata before restore."
existing_rows="$(psql "${RESTORE_DATABASE_URL}" --tuples-only --no-align --command='select (select count(*) from public."Puzzle") + (select count(*) from public."AccountProfile") + (select count(*) from auth.users)')"
if [[ "${existing_rows}" != "0" ]]; then
  echo "Restore database is not empty; refusing to merge backup data." >&2
  exit 1
fi

echo "Restoring encrypted object into the explicitly configured restore database."
aws s3 cp \
  "s3://${R2_BUCKET}/${backup_key}" - \
  --endpoint-url "${R2_ENDPOINT_URL}" \
  --only-show-errors \
  | age --decrypt --identity "${BACKUP_AGE_IDENTITY_FILE}" \
  | pg_restore \
      --dbname="${RESTORE_DATABASE_URL}" \
      --data-only \
      --disable-triggers \
      --no-owner \
      --no-privileges \
      --exit-on-error

# Identity, usernames and attempts are intentionally absent from beta backups.
# A recovered competitive actor must never become active or linkable by
# accident; a returning user receives a fresh Competitor after registration.
psql "${RESTORE_DATABASE_URL}" --set=ON_ERROR_STOP=1 --command='update public."Competitor" c set "status" = '\''DELETED'\'' where not exists (select 1 from public."AccountProfile" p where p."competitorId" = c."id");'
echo "Restore finished with retained competitive actors pseudonymized and inactive."

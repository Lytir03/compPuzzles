#!/usr/bin/env bash
set -Eeuo pipefail

required=(
  BACKUP_DATABASE_URL
  BACKUP_AGE_RECIPIENT
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

for command_name in pg_dump psql age aws sha256sum; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command not found: ${command_name}" >&2
    exit 1
  fi
done

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
backup_prefix="${R2_BACKUP_PREFIX:-comppuzzles/database}"
backup_prefix="${backup_prefix#/}"
backup_prefix="${backup_prefix%/}"
timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
daily_key="${backup_prefix}/daily/comppuzzles-${timestamp}.dump.age"
partial_key="${daily_key}.partial"
manifest_key="${daily_key}.json"
migration_hash="$(sha256sum supabase/migrations/*.sql | sha256sum | cut -d ' ' -f 1)"
git_commit="${GITHUB_SHA:-local}"
server_version="$(psql "${BACKUP_DATABASE_URL}" --tuples-only --no-align --set=ON_ERROR_STOP=1 --command='show server_version')"
row_counts="$(psql "${BACKUP_DATABASE_URL}" --tuples-only --no-align --set=ON_ERROR_STOP=1 --command='select json_build_object('\''puzzles'\'', (select count(*) from public."Puzzle"), '\''competitors'\'', (select count(*) from public."Competitor"), '\''matches'\'', (select count(*) from public."Match"), '\''ratingChanges'\'', (select count(*) from public."RatingChange"));')"

cleanup_partial() {
  aws s3 rm "s3://${R2_BUCKET}/${partial_key}" \
    --endpoint-url "${R2_ENDPOINT_URL}" \
    --only-show-errors >/dev/null 2>&1 || true
}
trap cleanup_partial EXIT

echo "Creating encrypted database backup: s3://${R2_BUCKET}/${daily_key}"
pg_dump \
  --dbname="${BACKUP_DATABASE_URL}" \
  --format=custom \
  --data-only \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --enable-row-security \
  --strict-names \
  --table='public."Competitor"' \
  --table='public."PlayerGameRating"' \
  --table='public."Puzzle"' \
  --table='public."SudokuPuzzle"' \
  --table='public."CrosswordPuzzle"' \
  --table='public."NonogramPuzzle"' \
  --table='public."Match"' \
  --table='public."MatchParticipant"' \
  --table='public."RatingChange"' \
  --table='private."SudokuPuzzleSecret"' \
  --table='private."CrosswordPuzzleSecret"' \
  --table='private."NonogramPuzzleSecret"' \
  | age --recipient "${BACKUP_AGE_RECIPIENT}" \
  | aws s3 cp \
      - "s3://${R2_BUCKET}/${partial_key}" \
      --endpoint-url "${R2_ENDPOINT_URL}" \
      --only-show-errors \
      --content-type "application/octet-stream"

aws s3 cp \
  "s3://${R2_BUCKET}/${partial_key}" \
  "s3://${R2_BUCKET}/${daily_key}" \
  --endpoint-url "${R2_ENDPOINT_URL}" \
  --only-show-errors \
  --metadata-directive REPLACE \
  --metadata "git-commit=${git_commit},migrations-sha256=${migration_hash}"
cleanup_partial
trap - EXIT

printf '{"createdAt":"%s","gitCommit":"%s","migrationsSha256":"%s","postgresVersion":"%s","rowCounts":%s}\n' \
  "${timestamp}" "${git_commit}" "${migration_hash}" "${server_version}" "${row_counts}" \
  | aws s3 cp \
      - "s3://${R2_BUCKET}/${manifest_key}" \
      --endpoint-url "${R2_ENDPOINT_URL}" \
      --only-show-errors \
      --content-type "application/json"

# Keep a separate weekly object so daily pruning cannot remove the last four
# restore points. Sunday is 7 in POSIX date's UTC weekday numbering.
if [[ "$(date -u +%u)" == "7" ]]; then
  weekly_key="${backup_prefix}/weekly/comppuzzles-${timestamp}.dump.age"
  aws s3 cp \
    "s3://${R2_BUCKET}/${daily_key}" \
    "s3://${R2_BUCKET}/${weekly_key}" \
    --endpoint-url "${R2_ENDPOINT_URL}" \
    --only-show-errors
  aws s3 cp \
    "s3://${R2_BUCKET}/${manifest_key}" \
    "s3://${R2_BUCKET}/${weekly_key}.json" \
    --endpoint-url "${R2_ENDPOINT_URL}" \
    --only-show-errors
  echo "Created weekly restore point: s3://${R2_BUCKET}/${weekly_key}"
fi

prune_prefix() {
  local object_prefix="$1"
  local keep="$2"
  local keys
  local index=0

  keys="$(aws s3api list-objects-v2 \
    --bucket "${R2_BUCKET}" \
    --prefix "${object_prefix}" \
    --endpoint-url "${R2_ENDPOINT_URL}" \
    --query "reverse(sort_by(Contents[?ends_with(Key, '.dump.age')],&LastModified))[].Key" \
    --output text)"

  if [[ -z "${keys}" || "${keys}" == "None" ]]; then
    return
  fi

  for key in ${keys}; do
    index=$((index + 1))
    if (( index <= keep )); then
      continue
    fi
    case "${key}" in
      "${backup_prefix}"/daily/*.dump.age|"${backup_prefix}"/weekly/*.dump.age)
        aws s3 rm \
          "s3://${R2_BUCKET}/${key}" \
          --endpoint-url "${R2_ENDPOINT_URL}" \
          --only-show-errors
        aws s3 rm \
          "s3://${R2_BUCKET}/${key}.json" \
          --endpoint-url "${R2_ENDPOINT_URL}" \
          --only-show-errors || true
        ;;
      *)
        echo "Refusing to prune unexpected key: ${key}" >&2
        exit 1
        ;;
    esac
  done
}

prune_prefix "${backup_prefix}/daily/" 7
prune_prefix "${backup_prefix}/weekly/" 4
echo "Backup complete; it contains no Auth/profile/attempt PII and retains 7 daily plus 4 weekly objects."

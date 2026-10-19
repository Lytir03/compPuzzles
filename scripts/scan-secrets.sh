#!/usr/bin/env bash
set -Eeuo pipefail

patterns=(
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
  'SUPABASE_SERVICE_ROLE_KEY[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'AWS_SECRET_ACCESS_KEY[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'RESEND_API_KEY[[:space:]]*=[[:space:]]*re_[A-Za-z0-9]+'
  'TURNSTILE_SECRET_KEY[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'UPSTASH_REDIS_REST_TOKEN[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'AUTH_FLOW_HMAC_SECRET[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'PRACTICE_API_SECRET[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'REALTIME_REDIS_KEY_SECRET[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'REALTIME_JWS_PRIVATE_KEY[[:space:]]*=[[:space:]]*[^#[:space:]]+'
  'sb_secret_[A-Za-z0-9_-]+'
)

for pattern in "${patterns[@]}"; do
  set +e
  matches="$(git grep -lE -e "${pattern}" -- . \
    ':(exclude)package-lock.json' \
    ':(exclude).env.example' \
    ':(exclude)scripts/scan-secrets.sh' 2>&1)"
  status=$?
  set -e
  if (( status == 0 )); then
    printf '%s\n' "${matches}"
    echo "Potential committed secret found in the listed files (values withheld)." >&2
    exit 1
  fi
  if (( status != 1 )); then
    printf '%s\n' "${matches}" >&2
    echo "Secret scan could not complete." >&2
    exit "${status}"
  fi
done

echo "No blocked secret patterns found."

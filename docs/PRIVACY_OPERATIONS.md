# Privacy operations

The legal pages are operational templates, not a substitute for Italian legal
or tax advice. Production environment validation prevents public deployment
without a real controller name, country and privacy/security contacts.

## Processor and transfer register

Record purpose, data categories, region, retention, DPA date, subprocessor link,
transfer mechanism and owner for Netlify, Supabase, Railway, Upstash, Resend,
Cloudflare R2, Sentry and GitHub. Verify at launch and annually, and whenever a
provider announces a material change. Netlify's US transit requires the DPA and
an active DPF and/or SCC basis; record the verification evidence and date.

## Data-subject requests

1. Acknowledge requests sent to `NEXT_PUBLIC_PRIVACY_EMAIL` without requesting
   unnecessary identity documents.
2. Verify the requester through the signed-in account or proportionate
   re-authentication.
3. Use self-service export/correction/deletion where available; manually review
   exceptional requests.
4. Record request type, dates and outcome without retaining the exported data in
   support systems.
5. Immediate account deletion removes Auth/profile/private attempts and
   pseudonymises the retained competitive audit. A later signup is a new
   competitor and is never re-linked.

## Retention

The Supabase migration schedules `private.apply_retention()` daily through
`pg_cron`. `scripts/run-retention.sh` is a guarded manual wrapper for restore
drills or a missed cron run. The function deletes practice attempts older than
90 days and clears detailed puzzle/solve/disconnect telemetry while preserving
the minimal match/rating audit. Re-review it with every schema migration; CI
must test the cutoff, idempotence and role grants.

Keep security/Sentry data for no more than 30 days, disable Sentry default PII,
replay and profiling, and sample performance conservatively. Logs must never
contain email, passwords, cookies, tokens, puzzle answers, mine maps or raw
payloads.

## Incident minimum

Contain and rotate affected credentials, preserve redacted evidence, determine
data/categories/people/regions involved, and document the decision on regulator
or user notification. Italian/EU breach deadlines require rapid escalation;
obtain qualified advice rather than delaying while the technical investigation
continues.

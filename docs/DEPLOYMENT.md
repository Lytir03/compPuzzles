# Beta deployment runbook

## Environment boundaries

Keep production and staging projects separate. Enable MFA on GitHub, Netlify,
Supabase, Railway, Cloudflare, Resend, Upstash and Sentry; store recovery codes
offline. Use exact production origins and redirect allowlists—never wildcard
origins.

### Netlify web/BFF

Configure the public site/app/realtime URLs, the Railway `REALTIME_INTERNAL_URL`, server-only Supabase URL and
publishable key, Turnstile site and secret keys, the auth-flow HMAC secret,
the practice API secret shared only with Railway, Upstash REST credentials, realtime ticket
signing key, legal contact fields and the PII-minimised Sentry DSN. Set:

```text
ADS_ENABLED=false
ADS_PLACEHOLDERS_ENABLED=false
CSP_ENFORCE=true
```

Never add `DATABASE_URL`, a Supabase service-role/secret key, R2 secret key or
the database migration credential to Netlify. Scope the Supabase publishable
key, Turnstile secret, Upstash token, HMAC secrets, practice secret, Ed25519
private key and server Sentry DSN to **Functions/runtime only**, never Builds.
The production build runs `scripts/validate-build-env.mjs` and deliberately
fails if a runtime secret leaks into its environment. `/health/ready` and every
request-scoped Supabase client run the full cold-start validation, including an
Ed25519 signing self-test.

Deploy previews and branch deploys receive public values only. They compile the
site but authenticated/practice functionality is intentionally unavailable;
never expose production runtime secrets to code from a pull request. A
functional preview needs an isolated staging Supabase/Upstash/Railway set with
independently rotated credentials.

Netlify Free has a hard monthly credit limit. Disable automatic spending,
prefer PR previews over repeated production deploys and alert at 70% and 85%.
Requests may transit the United States: accept Netlify's DPA, record the active
EU–US DPF/SCC mechanism and re-check it at launch and annually.

### Supabase EU

- Require email confirmation and use only the production HTTPS callback URL.
- Set the hosted Auth minimum password length to 12 without composition rules.
  The local stack encodes the same minimum and CI calls the public Auth endpoint
  to prove an 11-character password is rejected and an unverified account gets
  no session. Leaked-password protection is a later paid-plan enhancement and
  is not claimed for the free beta.
- Enable Cloudflare Turnstile in the Supabase Auth dashboard with the same
  production secret used by the BFF. This keeps direct calls to the public Auth
  API from bypassing CAPTCHA; smoke-test sign-up, sign-in, resend, forgot-password
  and password re-authentication after every key rotation.
- Configure Resend as custom SMTP; set verification/reset links to one hour.
- Restrict the Data API to the `api` schema and verify RLS with real `anon`,
  `authenticated` and runtime-role credentials before each release. The
  protected migration workflow also probes hosted PostgREST and fails unless
  `Accept-Profile: public` returns `PGRST106` while `api` succeeds; configure
  `SUPABASE_URL` and the publishable key in that GitHub environment.
- Keep migration/owner credentials in protected CI environment secrets only.
- Provision the three restricted LOGIN roles from the protected environment
  with `scripts/provision-runtime-roles.sql`; `supabase/roles.sql` deliberately
  contains no password substitution because the local CLI executes it automatically.
- Configure staging and production as the two hosted free-tier projects; use
  Supabase CLI locally.
- After migrations and role provisioning, run the protected
  `publish-puzzles.yml` workflow with the exact reviewed main SHA. Its only
  database credential is the restricted puzzle-writer URL; a clean deployment
  must have a non-empty launch catalog before Railway serves public traffic.

Before sending mail, verify the domain and publish SPF, DKIM and a DMARC policy.
Test delivery, expiry, resend and anti-enumeration behavior using non-admin
accounts.

### Railway realtime

Deploy `Dockerfile.realtime` through `railway.json` to one EU replica. Configure
the restricted realtime database URL, exact app origin, Upstash credentials,
ticket verification public keys and key IDs, and the exact same
`PRACTICE_API_SECRET` configured on Netlify. Generate that secret from at least
32 random bytes, never expose it as `NEXT_PUBLIC_*`, and rotate both services in
one release. Do not provide the ticket private key or migration-owner credential.

Railway checks `/health/ready`; `/health/live` confirms process liveness. During
shutdown readiness must turn false before Socket.IO drains and Prisma closes.
The standalone process sends error-only, payload-redacted events to Sentry and
writes structured JSON lifecycle logs; configure `SENTRY_DSN` and
`SENTRY_ENVIRONMENT` only on Railway.
Alert at 70% and 85% of the monthly resource budget. If the beta no longer fits
the agreed credit, disable ranked admission rather than silently incurring
pay-as-you-go cost.

## Release order

1. Run CI, RLS tests and the secret/unsafe-SQL checks on the exact commit.
2. Dispatch `deploy-database.yml`; it must create a successful encrypted
   pre-migration backup before the separately protected migration job can run.
3. Provision/rotate restricted role credentials and dispatch
   `publish-puzzles.yml`; verify every launch mode has published rows.
4. Deploy Railway and confirm both health endpoints and ticket verification.
5. Deploy Netlify and smoke-test sign-up, email confirmation, reset, logout,
   practice, ranked reconnect, account export and deletion.
6. Confirm CSP has no required violations, then keep `CSP_ENFORCE=true`.
7. Confirm legal controller/contact values and IT/EN routes, security.txt,
   retention job, R2 lifecycle/permissions and Sentry redaction.
8. In staging, pass the 30-minute load gate with 100 connected sockets and 25
   simultaneous matches; record memory, connections, duplicate-match/rating
   checks and keep both below 70% of the selected plan limits. This is a manual
   release gate until dedicated load infrastructure exists, not a unit-test
   substitute.

Configure GitHub environments `production-backup`, `production-database` and
`production-puzzle-writer` with required reviewers, main-only deployment
branches and no self-review. The workflows additionally require the exact full
main SHA and confirmation phrases; never weaken the environment rules because
the YAML checks are defense in depth, not the approval boundary.

The public beta is intentionally without an SLA. Advertising remains a
separate, later release gate.

## Rollback

Roll back application deploys first. Do not reverse a destructive SQL migration
blindly. If data restore is required, use the isolated procedure in
`docs/BACKUPS.md` and apply the matching migrations before data restore.
Identity data is absent from the beta backup, and the restore script deactivates
every retained competitor before the isolated database can be used.

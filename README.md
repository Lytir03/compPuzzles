# CompPuzzles

CompPuzzles is a light-mode competitive puzzle web app. Players can race live
in ranked Sudoku and Nonogram matches, or practise no-guess logic puzzles.
The public release target is a free beta with no prizes, no active advertising
and no service-level guarantee.

## Local development

Requirements:

- Node.js `22.23.2` (see `.node-version`)
- Docker Desktop
- Supabase CLI for the local Auth/Postgres/Mailpit stack

Install the locked dependencies and start the isolated Supabase stack:

```bash
npm ci
npm run db:start
npm run setup:local
```

The setup command refuses to overwrite an existing `.env.local`; it imports
only the local publishable key/URLs and generates independent local secrets and
an Ed25519 ticket pair. Then run web and realtime in separate terminals:

```bash
npm run dev:web
```

```bash
npm run dev:realtime
```

Open [http://localhost:3000](http://localhost:3000). The Supabase CLI output
shows the local Mailpit URL used to inspect verification and reset emails.
The project uses local ports `55321`–`55324`, so it can coexist with another
Supabase workspace using the CLI defaults. The old owner-credential Docker
Compose database has been removed; the Supabase migration is the sole schema
authority.

## Verification

```bash
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run test:auth-e2e
npm run test:ranked-e2e
npm run test:rls
npm run build
scripts/check-unsafe-sql.sh
scripts/scan-secrets.sh
```

CI also applies migrations to an isolated database, runs a production build,
audits production dependencies and performs CodeQL analysis.

`test:ranked-e2e` starts a temporary realtime process on port 4100 and checks
both games with disposable accounts, reconnects and duplicate submissions.
Run it against a fresh, unseeded local Supabase stack; it refuses hosted
services and removes its fixtures afterward. Set `SUPABASE_TEST_WORKDIR` to
use a separate local Supabase project without changing your development DB.

## Production shape

- **Netlify:** Next.js web/BFF. It must not receive a PostgreSQL URL, Supabase
  service-role key or backup credentials.
- **Supabase EU:** Postgres, Auth and RLS-protected Data API.
- **Railway EU:** one Socket.IO realtime replica using a restricted runtime DB
  role. Health endpoints are `/health/live` and `/health/ready`.
- **Upstash:** distributed rate limits, one-time realtime ticket consumption and
  short-lived revocation state—not match persistence.
- **Resend:** verification and password-reset email through Supabase SMTP.
- **Cloudflare R2:** client-side `age`-encrypted backups only.
- **Sentry:** error monitoring with PII disabled and no session replay.

See [deployment](docs/DEPLOYMENT.md), [backup/restore](docs/BACKUPS.md),
[privacy operations](docs/PRIVACY_OPERATIONS.md) and
[advertising/consent](docs/ADS_AND_CONSENT.md).

## Security reporting

Use the address configured as `NEXT_PUBLIC_SECURITY_EMAIL`, also published at
`/.well-known/security.txt`. Never include passwords, active authentication
links, tokens or another player’s private data in a report.

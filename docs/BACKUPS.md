# Encrypted backup and restore

The backup job streams a custom-format, data-only `pg_dump` through `age`
directly to a private Cloudflare R2 bucket. It deliberately excludes Auth,
account profiles, usernames, pending signups, private attempts and queue rows.
Only puzzles/secrets and pseudonymous competitive facts are retained. This
privacy-first beta policy means a disaster recovery preserves the puzzle and
Elo audit corpus, but players must register again. No plaintext dump or
decryption key is written to CI storage.

## One-time setup

1. Generate an age identity offline with `age-keygen`. Keep the private identity
   offline; store only its public recipient in GitHub's protected
   `production-backup` environment.
2. Create a private R2 bucket and a token limited to object list/read/write/delete
   for that bucket and prefix.
3. Create a PostgreSQL backup role with the minimum read/lock privileges needed
   by `pg_dump`; it must not own schema, bypass RLS or read Auth/profile tables.
4. Add `BACKUP_DATABASE_URL`, `BACKUP_AGE_RECIPIENT`, `R2_BUCKET`,
   `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` as protected
   GitHub environment secrets.

`.github/workflows/backup.yml` runs daily. The script retains seven daily and
four Sunday restore points by deleting only `.dump.age` objects beneath the
configured prefix. Also set an R2 lifecycle hard cap so an interrupted job
cannot leave objects indefinitely.

Manual runs are accepted only from the exact full SHA on `main` with the
`RUN_PRODUCTION_BACKUP` confirmation. Keep `production-backup` main-only with a
required reviewer and no self-review; otherwise a branch could execute modified
backup code while holding the database, R2 and age-recipient settings.

Uploads first use a `.partial` object and are promoted only after the full
encrypted pipeline succeeds. Each restore point has a JSON manifest containing
the Git commit, migration hash, PostgreSQL version and non-PII row counts; the
restore refuses an object without that manifest.

## Monthly restore drill

Use a new, isolated database with no production traffic. Apply the exact
reviewed Supabase migrations first; the restore script then refuses a database
that already contains account or puzzle rows. Download neither the plaintext
dump nor private identity into the repository.

```bash
export RESTORE_DATABASE_URL='postgresql://...isolated-restore-database...'
export BACKUP_AGE_IDENTITY_FILE='/offline/path/comppuzzles-age-key.txt'
export R2_BUCKET='...'
export R2_ENDPOINT_URL='https://<account>.r2.cloudflarestorage.com'
export AWS_ACCESS_KEY_ID='...'
read -rs AWS_SECRET_ACCESS_KEY # Enter the restore credential without echoing it.
export AWS_SECRET_ACCESS_KEY
export ALLOW_DATABASE_RESTORE='I_UNDERSTAND_THIS_REPLACES_DATABASE'
scripts/restore-backup.sh 'comppuzzles/database/daily/<object>.dump.age'
```

After restore:

1. verify every restored competitor is `DELETED` and no Auth/profile row exists;
2. run any newer forward migrations;
3. run RLS and integrity tests with real restricted roles;
4. verify puzzle counts, rating audit totals and that deleted identities remain
   unlinked;
5. destroy the isolated restore database and record the drill date/outcome.

R2 must still enforce a 28-day hard lifecycle. The selected dump has no account
PII and the restore script fails closed, then deactivates all retained actors.

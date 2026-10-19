-- Run manually as the Supabase database owner from a protected CI environment.
-- psql variables must be supplied without committing passwords:
--   psql "$MIGRATION_DATABASE_URL" \
--     -v realtime_password="$REALTIME_DB_PASSWORD" \
--     -v writer_password="$PUZZLE_WRITER_DB_PASSWORD" \
--     -v backup_password="$BACKUP_DB_PASSWORD" \
--     -f scripts/provision-runtime-roles.sql

alter role comppuzzles_realtime login password :'realtime_password';
alter role comppuzzles_puzzle_writer login password :'writer_password';
alter role comppuzzles_backup login password :'backup_password';

alter role comppuzzles_realtime set statement_timeout = '15s';
alter role comppuzzles_realtime set idle_in_transaction_session_timeout = '15s';
alter role comppuzzles_puzzle_writer set statement_timeout = '10min';
alter role comppuzzles_backup set statement_timeout = '30min';

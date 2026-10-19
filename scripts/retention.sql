-- The canonical retention logic lives in the reviewed Supabase migration and
-- is scheduled there with pg_cron. This wrapper exists for an operator to run
-- the same idempotent function manually after a restore or missed cron run.
SELECT private.apply_retention();

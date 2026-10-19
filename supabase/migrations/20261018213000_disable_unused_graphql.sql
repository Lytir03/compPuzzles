-- Supabase owns GraphQL's grants. Revoking as postgres does not remove grants
-- made by supabase_admin. Disable the unused resolver instead; Supabase may
-- retain a harmless graphql_public placeholder reporting "not enabled".
drop extension if exists pg_graphql;

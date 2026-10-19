begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(92);

-- The local pg_prove connection is intentionally not a superuser and custom
-- NOLOGIN roles are not inherited. Grant temporary membership to the current
-- test runner so SET LOCAL ROLE exercises their real grants and RLS policies;
-- the surrounding transaction rolls this membership back with the fixtures.
do $$
begin
  execute format(
    'grant comppuzzles_realtime, comppuzzles_puzzle_writer, comppuzzles_backup to %I',
    session_user
  );
  grant usage on schema extensions
    to comppuzzles_realtime, comppuzzles_puzzle_writer, comppuzzles_backup;
end;
$$;

-- Fixed identities keep every assertion deterministic. The normal auth trigger
-- creates PendingSignup, AccountProfile, Competitor and the two initial ratings,
-- so these fixtures also exercise the real account-activation path.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000a1',
    'authenticated',
    'authenticated',
    'rls-alice@example.test',
    extensions.crypt('fixture-password-123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'rls_alice',
      'terms_version', '2026-08-17',
      'terms_accepted_at', (now() - interval '1 minute')::text,
      'age_attested_at', (now() - interval '1 minute')::text
    ),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000a2',
    'authenticated',
    'authenticated',
    'rls-bob@example.test',
    extensions.crypt('fixture-password-123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'rls_bob',
      'terms_version', '2026-08-17',
      'terms_accepted_at', (now() - interval '1 minute')::text,
      'age_attested_at', (now() - interval '1 minute')::text
    ),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000a3',
    'authenticated',
    'authenticated',
    'rls-charlie@example.test',
    extensions.crypt('fixture-password-123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'rls_charlie',
      'terms_version', '2026-08-17',
      'terms_accepted_at', (now() - interval '1 minute')::text,
      'age_attested_at', (now() - interval '1 minute')::text
    ),
    now(),
    now()
  );

-- A real password sign-in creates a new auth.sessions row. Deletion tests vary
-- only the signed JWT claims so refresh/non-password sessions cannot satisfy
-- the database-side recent-reauthentication gate.
insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '70000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-0000000000a1',
  now(),
  now()
);

update public."Competitor"
set "status" = 'DELETED'
where "id" = (
  select "competitorId"
  from public."AccountProfile"
  where "authUserId" = '00000000-0000-4000-8000-0000000000a3'
);

insert into public."Puzzle" ("id", "gameType", "difficulty", "status")
values
  ('rls-sudoku-puzzle', 'SUDOKU', 'EASY', 'PUBLISHED'),
  ('rls-nonogram-puzzle', 'NONOGRAM', 'EASY', 'PUBLISHED'),
  ('rls-crossword-puzzle', 'CROSSWORD', 'EASY', 'ARCHIVED');

insert into public."SudokuPuzzle" ("id", "puzzleId", "grid", "difficultyScore")
values ('rls-sudoku-row', 'rls-sudoku-puzzle', repeat('0', 36), 18);

insert into private."SudokuPuzzleSecret" ("puzzleId", "solution")
values ('rls-sudoku-puzzle', '123456234561345612456123561234612345');

insert into public."NonogramPuzzle" ("id", "puzzleId", "width", "height", "rowClues", "colClues")
values (
  'rls-nonogram-row',
  'rls-nonogram-puzzle',
  5,
  5,
  '[[1],[1],[1],[1],[1]]'::jsonb,
  '[[1],[1],[1],[1],[1]]'::jsonb
);

insert into private."NonogramPuzzleSecret" ("puzzleId", "solutionGrid")
values ('rls-nonogram-puzzle', '[[true,false,false,false,false],[false,true,false,false,false],[false,false,true,false,false],[false,false,false,true,false],[false,false,false,false,true]]'::jsonb);

insert into public."CrosswordPuzzle" (
  "id", "puzzleId", "title", "width", "height", "grid", "clues"
)
values (
  'rls-crossword-row',
  'rls-crossword-puzzle',
  'Archived RLS fixture',
  2,
  2,
  '[[true,true],[true,true]]'::jsonb,
  '{"across":[],"down":[]}'::jsonb
);

insert into private."CrosswordPuzzleSecret" ("puzzleId", "answers")
values ('rls-crossword-puzzle', '{"across":[],"down":[]}'::jsonb);

insert into public."Match" (
  "id", "gameType", "difficulty", "modeId", "puzzleId", "status",
  "startedAt", "completedAt", "winnerCompetitorId", "createdAt"
)
values (
  '10000000-0000-4000-8000-000000000001',
  'SUDOKU',
  'EASY',
  'SUDOKU_9X9_EASY',
  'rls-sudoku-puzzle',
  'COMPLETED',
  now() - interval '9 minutes',
  now() - interval '5 minutes',
  (select "competitorId" from public."AccountProfile" where "authUserId" = '00000000-0000-4000-8000-0000000000a1'),
  now() - interval '10 minutes'
);

insert into public."MatchParticipant" (
  "id", "matchId", "competitorId", "startingRating", "endingRating",
  "result", "completionTimeMs", "mistakes"
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    (select "competitorId" from public."AccountProfile" where "authUserId" = '00000000-0000-4000-8000-0000000000a1'),
    400, 416, 'WIN', 90000, 0
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    (select "competitorId" from public."AccountProfile" where "authUserId" = '00000000-0000-4000-8000-0000000000a2'),
    400, 384, 'LOSS', 120000, 1
  );

insert into public."RatingChange" (
  "id", "competitorId", "matchId", "gameType", "ratingBefore", "ratingAfter", "delta"
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    (select "competitorId" from public."AccountProfile" where "authUserId" = '00000000-0000-4000-8000-0000000000a1'),
    '10000000-0000-4000-8000-000000000001', 'SUDOKU', 400, 416, 16
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    (select "competitorId" from public."AccountProfile" where "authUserId" = '00000000-0000-4000-8000-0000000000a2'),
    '10000000-0000-4000-8000-000000000001', 'SUDOKU', 400, 384, -16
  );

insert into public."PuzzleAttempt" (
  "id", "authUserId", "assignmentId", "puzzleId", "durationMs", "completed", "mistakes", "expiresAt"
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-0000000000a1',
    '50000000-0000-4000-8000-000000000001',
    'rls-sudoku-puzzle', 90000, true, 0, now() + interval '30 minutes'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-0000000000a2',
    '50000000-0000-4000-8000-000000000002',
    'rls-sudoku-puzzle', 120000, true, 1, now() + interval '30 minutes'
  );

insert into public."MatchmakingQueueEntry" (
  "id", "competitorId", "modeId", "gameType", "difficulty", "rating"
)
values (
  '60000000-0000-4000-8000-000000000001',
  (select "competitorId" from public."AccountProfile" where "authUserId" = '00000000-0000-4000-8000-0000000000a2'),
  'NONOGRAM_5X5', 'NONOGRAM', 'EASY', 400
);

-- Schema, view and role invariants.
select extensions.is(
  (select count(*)::integer from pg_roles where rolname in (
    'comppuzzles_realtime', 'comppuzzles_puzzle_writer', 'comppuzzles_backup'
  )),
  3,
  'all restricted runtime roles exist'
);
select extensions.ok(
  not exists (
    select 1 from pg_roles
    where rolname in ('comppuzzles_realtime', 'comppuzzles_puzzle_writer', 'comppuzzles_backup')
      and rolsuper
  ),
  'runtime roles are not superusers'
);
select extensions.ok(
  not exists (
    select 1 from pg_roles
    where rolname in ('comppuzzles_realtime', 'comppuzzles_puzzle_writer', 'comppuzzles_backup')
      and rolbypassrls
  ),
  'runtime roles cannot bypass RLS'
);
select extensions.ok(
  not exists (
    select 1 from pg_roles
    where rolname in ('comppuzzles_realtime', 'comppuzzles_puzzle_writer', 'comppuzzles_backup')
      and rolcanlogin
  ),
  'source-controlled runtime roles are NOLOGIN'
);
select extensions.ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p')
      and c.relname in (
        'Competitor', 'AccountProfile', 'PlayerGameRating', 'Puzzle',
        'SudokuPuzzle', 'CrosswordPuzzle', 'NonogramPuzzle', 'Match',
        'MatchParticipant', 'PuzzleAttempt', 'RatingChange', 'MatchmakingQueueEntry',
        'PendingSignup', 'UsernameClaim', 'ReservedUsername',
        'SudokuPuzzleSecret', 'CrosswordPuzzleSecret', 'NonogramPuzzleSecret'
      )
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ),
  'every application table has ENABLE and FORCE ROW LEVEL SECURITY'
);
select extensions.ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api'
      and c.relkind = 'v'
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)
  ),
  'all API views use security_invoker'
);
select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'api'
      and column_name in (
        'auth_user_id', 'competitor_id', 'email', 'solution', 'solution_grid', 'answers'
      )
  ),
  'API views expose no account UUID, competitor UUID, email or puzzle answer'
);
select extensions.ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('api', 'private')
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) option
        where option = 'search_path=""'
      )
  ),
  'every SECURITY DEFINER function pins an empty search_path'
);

-- Grants that form the browser-facing boundary.
select extensions.ok(has_schema_privilege('anon', 'api', 'USAGE'), 'anon can use only the API schema');
select extensions.ok(has_table_privilege('anon', 'api.public_profiles', 'SELECT'), 'anon can read public profiles');
select extensions.ok(not has_table_privilege('anon', 'api.my_account_profile', 'SELECT'), 'anon cannot read account views');
select extensions.ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon cannot use the private schema');
select extensions.ok(not has_table_privilege('anon', 'private."SudokuPuzzleSecret"', 'SELECT'), 'anon cannot read puzzle secrets');
select extensions.ok(
  not exists (select 1 from pg_extension where extname = 'pg_graphql'),
  'the unused GraphQL extension is disabled'
);
select extensions.ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('graphql', 'graphql_public')
      and (p.proname = 'resolve' or case when p.prokind = 'f' then pg_get_functiondef(p.oid) else '' end like '%graphql.resolve%')
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  'browser roles cannot execute a reflected GraphQL resolver or wrapper'
);
select extensions.ok(not has_table_privilege('anon', 'public."Match"', 'SELECT'), 'anon cannot read match tables');
select extensions.ok(not has_function_privilege('anon', 'api.export_my_data()', 'EXECUTE'), 'anon cannot export account data');
select extensions.ok(has_table_privilege('authenticated', 'api.my_account_profile', 'SELECT'), 'authenticated can read its account view');
select extensions.ok(has_table_privilege('authenticated', 'public."Match"', 'SELECT'), 'authenticated has RLS-filtered match SELECT');
select extensions.ok(has_table_privilege('authenticated', 'public."RatingChange"', 'SELECT'), 'authenticated has RLS-filtered rating audit SELECT');
select extensions.ok(not has_table_privilege('authenticated', 'public."PuzzleAttempt"', 'SELECT'), 'attempt rows are not exposed directly to authenticated');
select extensions.ok(not has_table_privilege('authenticated', 'private."SudokuPuzzleSecret"', 'SELECT'), 'authenticated cannot read puzzle answers');
select extensions.ok(not has_table_privilege('authenticated', 'public."AccountProfile"', 'INSERT'), 'authenticated cannot insert profiles');
select extensions.ok(has_function_privilege('authenticated', 'api.export_my_data()', 'EXECUTE'), 'authenticated can call its export function');
select extensions.ok(
  has_function_privilege('authenticated', 'api.delete_my_account()', 'EXECUTE')
    and to_regprocedure('api.delete_my_account(text,text)') is null,
  'authenticated can call only the recent-password-session deletion RPC'
);
select extensions.ok(
  position(
    'pg_try_advisory_xact_lock'
    in pg_get_functiondef('api.delete_my_account()'::regprocedure)
  ) > 0,
  'account deletion rejects concurrent calls with a nonblocking advisory lock'
);

select set_config('request.jwt.claims', '{}', true);
set local role anon;
select extensions.is((select count(*)::integer from api.public_profiles), 4, 'anon sees ratings only for active public profiles');
select extensions.is((select count(*)::integer from api.public_profiles where is_viewer), 0, 'anon is never marked as the viewer');
reset role;

-- Authenticated user A can see its own private projections and only a match in
-- which it participates.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}',
  true
);
set local role authenticated;
select extensions.is((select username from api.my_account_profile), 'rls_alice', 'user A sees only its account profile');
select extensions.is((select count(*)::integer from api.my_game_ratings), 2, 'user A sees its two initial ratings');
select extensions.is((select count(*)::integer from api.public_profiles where is_viewer), 2, 'user A is marked viewer only on its ratings');
select extensions.is((select count(*)::integer from public."Match"), 1, 'user A can read its match');
select extensions.is((select count(*)::integer from public."MatchParticipant"), 2, 'user A can read both participants in its match');
select extensions.is((select count(*)::integer from public."RatingChange"), 2, 'user A can read rating changes for its match');
select extensions.is((select count(*)::integer from api.my_match_history), 1, 'user A sees one history row');
select extensions.is((select count(*)::integer from api.my_match_detail), 2, 'user A sees both sides of match detail');
select extensions.is(api.export_my_data() #>> '{account,email}', 'rls-alice@example.test', 'user A export contains only its email');
select extensions.throws_ok(
  $$select api.delete_my_account()$$,
  'P0001',
  'Recent password authentication required',
  'a generic stolen JWT cannot delete an account'
);
reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-0000000000a1',
    'role', 'authenticated',
    'session_id', '70000000-0000-4000-8000-000000000001',
    'iat', floor(extract(epoch from now()))::bigint,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'token_refresh',
      'timestamp', floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
set local role authenticated;
select extensions.throws_ok(
  $$select api.delete_my_account()$$,
  'P0001',
  'Recent password authentication required',
  'a freshly refreshed session is not a recent password reauthentication'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}',
  true
);
set local role authenticated;
select extensions.is((select username from api.my_account_profile), 'rls_bob', 'user B cannot receive user A account data');
select extensions.is((select count(*)::integer from public."Match"), 1, 'user B can read the shared match');
select extensions.is((select count(*)::integer from api.my_match_detail), 2, 'user B sees both sides of its match detail');
reset role;

-- Deleted/non-participant user C is denied by both active-profile and match
-- participant policies.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}',
  true
);
set local role authenticated;
select extensions.is((select count(*)::integer from api.my_account_profile), 0, 'deleted user has no account projection');
select extensions.is((select count(*)::integer from public."Match"), 0, 'non-participant cannot read a match');
select extensions.is((select count(*)::integer from public."MatchParticipant"), 0, 'non-participant cannot read match participants');
select extensions.is((select count(*)::integer from api.my_match_history), 0, 'non-participant has no match history');
select extensions.is((select count(*)::integer from api.my_match_detail), 0, 'non-participant has no match detail');
reset role;

-- Railway realtime: competitive mutations and active puzzle answer keys are
-- available, but Auth and archived Crossword data are not.
select extensions.ok(has_schema_privilege('comppuzzles_realtime', 'private', 'USAGE'), 'realtime can use private puzzle-answer schema');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'public."AccountProfile"', 'SELECT'), 'realtime can resolve auth user to competitor');
select extensions.ok(not has_table_privilege('comppuzzles_realtime', 'public."AccountProfile"', 'UPDATE'), 'realtime cannot mutate profiles');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'public."Puzzle"', 'SELECT'), 'realtime can select active puzzle handouts');
select extensions.ok(not has_table_privilege('comppuzzles_realtime', 'public."CrosswordPuzzle"', 'SELECT'), 'realtime cannot read archived Crossword rows');
select extensions.ok(not has_table_privilege('comppuzzles_realtime', 'private."CrosswordPuzzleSecret"', 'SELECT'), 'realtime cannot read Crossword answers');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'private."SudokuPuzzleSecret"', 'SELECT'), 'realtime can validate Sudoku answers');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'private."NonogramPuzzleSecret"', 'SELECT'), 'realtime can validate Nonogram answers');
select extensions.ok(not has_table_privilege('comppuzzles_realtime', 'auth.users', 'SELECT'), 'realtime cannot read auth users');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'public."PlayerGameRating"', 'SELECT,INSERT,UPDATE,DELETE'), 'realtime controls ratings through RLS');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'public."Match"', 'SELECT,INSERT,UPDATE,DELETE'), 'realtime controls matches through RLS');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'public."PuzzleAttempt"', 'SELECT,INSERT,UPDATE,DELETE'), 'realtime controls private attempts through RLS');
select extensions.ok(has_table_privilege('comppuzzles_realtime', 'public."MatchmakingQueueEntry"', 'SELECT,INSERT,UPDATE,DELETE'), 'realtime controls queue rows through RLS');

set local role comppuzzles_realtime;
select extensions.is((select count(*)::integer from public."Puzzle"), 2, 'realtime RLS excludes archived Crossword parent rows');
select extensions.is((select count(*)::integer from public."AccountProfile"), 3, 'realtime can resolve every account mapping');
select extensions.is((select count(*)::integer from private."SudokuPuzzleSecret"), 1, 'realtime sees Sudoku solution rows');
select extensions.is((select count(*)::integer from private."NonogramPuzzleSecret"), 1, 'realtime sees Nonogram solution rows');
reset role;

-- Puzzle writer: puzzle-only DML, including the archived Crossword import
-- path, and no user/competitive data.
select extensions.ok(not has_table_privilege('comppuzzles_puzzle_writer', 'public."Competitor"', 'SELECT'), 'puzzle writer cannot read competitors');
select extensions.ok(not has_table_privilege('comppuzzles_puzzle_writer', 'auth.users', 'SELECT'), 'puzzle writer cannot read auth users');
select extensions.ok(has_table_privilege('comppuzzles_puzzle_writer', 'public."Puzzle"', 'SELECT,INSERT,UPDATE,DELETE'), 'puzzle writer controls puzzle parents');
select extensions.ok(has_table_privilege('comppuzzles_puzzle_writer', 'public."SudokuPuzzle"', 'SELECT,INSERT,UPDATE,DELETE'), 'puzzle writer controls Sudoku handouts');
select extensions.ok(has_table_privilege('comppuzzles_puzzle_writer', 'public."CrosswordPuzzle"', 'SELECT,INSERT,UPDATE,DELETE'), 'puzzle writer can maintain archived Crossword imports');
select extensions.ok(has_table_privilege('comppuzzles_puzzle_writer', 'public."NonogramPuzzle"', 'SELECT,INSERT,UPDATE,DELETE'), 'puzzle writer controls Nonogram handouts');
select extensions.ok(
  has_table_privilege('comppuzzles_puzzle_writer', 'private."SudokuPuzzleSecret"', 'SELECT,INSERT,UPDATE,DELETE')
    and has_table_privilege('comppuzzles_puzzle_writer', 'private."CrosswordPuzzleSecret"', 'SELECT,INSERT,UPDATE,DELETE')
    and has_table_privilege('comppuzzles_puzzle_writer', 'private."NonogramPuzzleSecret"', 'SELECT,INSERT,UPDATE,DELETE'),
  'puzzle writer controls only puzzle answer tables in private'
);

set local role comppuzzles_puzzle_writer;
select extensions.is((select count(*)::integer from public."Puzzle"), 3, 'puzzle writer sees every puzzle including archived Crossword');
select extensions.is(
  (
    (select count(*) from private."SudokuPuzzleSecret")
    + (select count(*) from private."CrosswordPuzzleSecret")
    + (select count(*) from private."NonogramPuzzleSecret")
  )::integer,
  3,
  'puzzle writer sees all three answer-table fixtures'
);
reset role;

-- Backup is deliberately pseudonymous: it can preserve competitive and puzzle
-- integrity but receives no account mapping, private attempt, queue or Auth PII.
select extensions.ok(has_schema_privilege('comppuzzles_backup', 'private', 'USAGE'), 'backup can use private puzzle-answer schema');
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'public."AccountProfile"', 'SELECT'), 'backup cannot read account mappings');
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'public."PuzzleAttempt"', 'SELECT'), 'backup cannot read private attempts');
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'public."MatchmakingQueueEntry"', 'SELECT'), 'backup cannot read matchmaking queue metadata');
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'private."PendingSignup"', 'SELECT'), 'backup cannot read pending signup PII');
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'private."UsernameClaim"', 'SELECT'), 'backup cannot read username-to-auth mappings');
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'auth.users', 'SELECT'), 'backup cannot read Auth users');
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'auth.identities', 'SELECT'), 'backup cannot read Auth identities');
select extensions.ok(has_table_privilege('comppuzzles_backup', 'public."Competitor"', 'SELECT'), 'backup can read pseudonymous competitors');
select extensions.ok(
  has_table_privilege('comppuzzles_backup', 'public."PlayerGameRating"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'public."Match"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'public."MatchParticipant"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'public."RatingChange"', 'SELECT'),
  'backup can read competitive audit tables'
);
select extensions.ok(
  has_table_privilege('comppuzzles_backup', 'public."Puzzle"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'public."SudokuPuzzle"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'public."CrosswordPuzzle"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'public."NonogramPuzzle"', 'SELECT'),
  'backup can read all puzzle handout tables'
);
select extensions.ok(
  has_table_privilege('comppuzzles_backup', 'private."SudokuPuzzleSecret"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'private."CrosswordPuzzleSecret"', 'SELECT')
    and has_table_privilege('comppuzzles_backup', 'private."NonogramPuzzleSecret"', 'SELECT'),
  'backup can read puzzle answer tables'
);
select extensions.ok(not has_table_privilege('comppuzzles_backup', 'public."Puzzle"', 'INSERT'), 'backup is read-only');
select extensions.ok(not has_schema_privilege('comppuzzles_backup', 'api', 'USAGE'), 'backup cannot call browser API views/functions');

set local role comppuzzles_backup;
select extensions.is((select count(*)::integer from public."Competitor"), 3, 'backup RLS sees all pseudonymous competitors');
select extensions.is((select count(*)::integer from public."Match"), 1, 'backup RLS sees competitive history');
select extensions.is(
  (
    (select count(*) from private."SudokuPuzzleSecret")
    + (select count(*) from private."CrosswordPuzzleSecret")
    + (select count(*) from private."NonogramPuzzleSecret")
  )::integer,
  3,
  'backup RLS sees all answer keys needed for puzzle restore'
);
reset role;

-- Account deletion is irreversible, so exercise it after every other fixture
-- assertion. The action checks the textual confirmation; the database itself
-- additionally requires a newly-created password-authenticated session.
create temporary table deletion_target on commit drop as
select "competitorId" from public."AccountProfile"
where "authUserId" = '00000000-0000-4000-8000-0000000000a1';
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-0000000000a1',
    'role', 'authenticated',
    'session_id', '70000000-0000-4000-8000-000000000001',
    'iat', floor(extract(epoch from now()))::bigint,
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
set local role authenticated;
select extensions.is(
  api.delete_my_account(),
  true,
  'a recent password-authenticated session atomically deletes the account'
);
reset role;
select extensions.ok(
  (select count(*) = 0 from auth.users where id = '00000000-0000-4000-8000-0000000000a1')
    and (select count(*) = 0 from public."AccountProfile" where "authUserId" = '00000000-0000-4000-8000-0000000000a1')
    and (select count(*) = 0 from private."UsernameClaim" where "authUserId" = '00000000-0000-4000-8000-0000000000a1')
    and (select c."status" = 'DELETED' from public."Competitor" c join deletion_target d on d."competitorId" = c."id"),
  'deletion removes every live identity mapping and retains only a deleted competitor'
);

select * from extensions.finish();
rollback;

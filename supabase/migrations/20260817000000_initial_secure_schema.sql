-- compPuzzles secure Supabase baseline.
-- This migration intentionally starts from a clean pre-production Supabase
-- project. Export puzzle rows first; account/rating/match data is reset.

create schema if not exists private;
create schema if not exists api;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

revoke all on schema private from public, anon, authenticated;
revoke all on schema api from public;

create or replace function private.is_finite_float(value double precision)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select value is not null
    and value <> 'NaN'::double precision
    and value <> 'Infinity'::double precision
    and value <> '-Infinity'::double precision
$$;

create type public."GameType" as enum ('SUDOKU', 'CROSSWORD', 'NONOGRAM');
create type public."Difficulty" as enum ('EASY', 'MEDIUM', 'HARD');
create type public."PuzzleStatus" as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public."MatchStatus" as enum ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'CANCELLED');
create type public."MatchResult" as enum ('WIN', 'LOSS', 'DRAW', 'ABANDONED');
create type public."DisconnectStatus" as enum ('CONNECTED', 'DISCONNECTED', 'RECONNECTED', 'ABANDONED');
create type public."CompetitorStatus" as enum ('ACTIVE', 'DELETED');

create table public."Competitor" (
  "id" uuid primary key default extensions.gen_random_uuid(),
  "status" public."CompetitorStatus" not null default 'ACTIVE',
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null default now()
);

create table public."AccountProfile" (
  "authUserId" uuid primary key references auth.users(id) on delete cascade,
  "competitorId" uuid not null unique references public."Competitor"("id") on delete restrict,
  "username" text not null,
  "usernameCanonical" text not null unique,
  "avatarUrl" text,
  "termsVersion" text not null,
  "termsAcceptedAt" timestamptz(3) not null,
  "ageAttestedAt" timestamptz(3) not null,
  "usernameChangedAt" timestamptz(3) not null default now(),
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null default now(),
  constraint "AccountProfile_username_format" check (
    "username" = "usernameCanonical"
    and "usernameCanonical" ~ '^[a-z0-9_-]{3,20}$'
  )
);

create table private."PendingSignup" (
  "authUserId" uuid primary key references auth.users(id) on delete cascade,
  "username" text not null,
  "usernameCanonical" text not null,
  "termsVersion" text not null,
  "termsAcceptedAt" timestamptz(3) not null,
  "ageAttestedAt" timestamptz(3) not null,
  "createdAt" timestamptz(3) not null default now()
);

create table private."UsernameClaim" (
  "usernameCanonical" text primary key,
  "authUserId" uuid not null unique references auth.users(id) on delete cascade,
  "createdAt" timestamptz(3) not null default now()
);

create table private."ReservedUsername" (
  "usernameCanonical" text primary key
);

insert into private."ReservedUsername" ("usernameCanonical") values
  ('admin'), ('administrator'), ('api'), ('auth'), ('comppuzzles'),
  ('deleted'), ('help'), ('moderator'), ('null'), ('official'), ('root'),
  ('security'), ('staff'), ('support'), ('system'), ('undefined');

create table public."PlayerGameRating" (
  "id" uuid primary key default extensions.gen_random_uuid(),
  "competitorId" uuid not null references public."Competitor"("id") on delete restrict,
  "gameType" public."GameType" not null,
  "rating" double precision not null default 400,
  "ratingDeviation" double precision not null default 350,
  "volatility" double precision not null default 0.06,
  "peakRating" double precision not null default 400,
  "gamesPlayed" integer not null default 0,
  "wins" integer not null default 0,
  "losses" integer not null default 0,
  "draws" integer not null default 0,
  "createdAt" timestamptz(3) not null default now(),
  "updatedAt" timestamptz(3) not null default now(),
  unique ("competitorId", "gameType"),
  constraint "PlayerGameRating_numbers" check (
    private.is_finite_float("rating") and private.is_finite_float("ratingDeviation")
    and private.is_finite_float("volatility") and private.is_finite_float("peakRating")
    and "ratingDeviation" >= 0
    and "gamesPlayed" >= 0 and "wins" >= 0 and "losses" >= 0 and "draws" >= 0
    and "gamesPlayed" = "wins" + "losses" + "draws"
  )
);

create table public."Puzzle" (
  "id" text primary key,
  "gameType" public."GameType" not null,
  "difficulty" public."Difficulty" not null,
  "status" public."PuzzleStatus" not null default 'PUBLISHED',
  "metadata" jsonb,
  "createdAt" timestamptz(3) not null default now()
);

create table public."SudokuPuzzle" (
  "id" text primary key,
  "puzzleId" text not null unique references public."Puzzle"("id") on delete cascade,
  "grid" text not null,
  "difficultyScore" integer,
  "createdAt" timestamptz(3) not null default now(),
  constraint "SudokuPuzzle_grid" check (
    "grid" ~ '^[0-6]{36}$' or "grid" ~ '^[0-9]{81}$'
  )
);

create table private."SudokuPuzzleSecret" (
  "puzzleId" text primary key references public."SudokuPuzzle"("puzzleId") on delete cascade,
  "solution" text not null,
  constraint "SudokuPuzzleSecret_solution" check (
    "solution" ~ '^[1-6]{36}$' or "solution" ~ '^[1-9]{81}$'
  )
);

create table public."CrosswordPuzzle" (
  "id" text primary key,
  "puzzleId" text not null unique references public."Puzzle"("id") on delete cascade,
  "title" text not null,
  "width" integer not null check ("width" between 2 and 100),
  "height" integer not null check ("height" between 2 and 100),
  "grid" jsonb not null,
  "clues" jsonb not null,
  "author" text,
  "source" text,
  "createdAt" timestamptz(3) not null default now()
);

create table private."CrosswordPuzzleSecret" (
  "puzzleId" text primary key references public."CrosswordPuzzle"("puzzleId") on delete cascade,
  "answers" jsonb not null
);

create table public."NonogramPuzzle" (
  "id" text primary key,
  "puzzleId" text not null unique references public."Puzzle"("id") on delete cascade,
  "width" integer not null check ("width" in (5, 10)),
  "height" integer not null check ("height" in (5, 10)),
  "rowClues" jsonb not null,
  "colClues" jsonb not null,
  "createdAt" timestamptz(3) not null default now()
);

create table private."NonogramPuzzleSecret" (
  "puzzleId" text primary key references public."NonogramPuzzle"("puzzleId") on delete cascade,
  "solutionGrid" jsonb not null
);

create table public."Match" (
  "id" uuid primary key default extensions.gen_random_uuid(),
  "gameType" public."GameType" not null,
  "difficulty" public."Difficulty" not null,
  "modeId" text not null,
  "puzzleId" text references public."Puzzle"("id") on delete set null,
  "status" public."MatchStatus" not null default 'WAITING',
  "startedAt" timestamptz(3),
  "completedAt" timestamptz(3),
  "winnerCompetitorId" uuid references public."Competitor"("id") on delete set null,
  "detailPurgedAt" timestamptz(3),
  "createdAt" timestamptz(3) not null default now(),
  constraint "Match_ranked_mode" check ("modeId" in (
    'SUDOKU_6X6_CHALLENGE', 'SUDOKU_9X9_EASY', 'SUDOKU_9X9_HARD',
    'NONOGRAM_5X5', 'NONOGRAM_10X10'
  )),
  constraint "Match_time_order" check (
    ("startedAt" is null or "startedAt" >= "createdAt")
    and ("completedAt" is null or ("startedAt" is not null and "completedAt" >= "startedAt"))
  )
);

create table public."MatchParticipant" (
  "id" uuid primary key default extensions.gen_random_uuid(),
  "matchId" uuid not null references public."Match"("id") on delete cascade,
  "competitorId" uuid not null references public."Competitor"("id") on delete restrict,
  "startingRating" double precision not null,
  "endingRating" double precision,
  "result" public."MatchResult",
  "completionTimeMs" integer,
  "mistakes" integer default 0,
  "disconnectStatus" public."DisconnectStatus" default 'CONNECTED',
  "disconnectDeadlineAt" timestamptz(3),
  "detailPurgedAt" timestamptz(3),
  "createdAt" timestamptz(3) not null default now(),
  unique ("matchId", "competitorId"),
  constraint "MatchParticipant_numbers" check (
    private.is_finite_float("startingRating")
    and ("endingRating" is null or private.is_finite_float("endingRating"))
    and ("completionTimeMs" is null or "completionTimeMs" between 0 and 86400000)
    and ("mistakes" is null or "mistakes" between 0 and 100000)
  )
);

create table public."PuzzleAttempt" (
  "id" uuid primary key default extensions.gen_random_uuid(),
  "authUserId" uuid not null references public."AccountProfile"("authUserId") on delete cascade,
  "assignmentId" uuid not null unique default extensions.gen_random_uuid(),
  "puzzleId" text not null references public."Puzzle"("id") on delete restrict,
  "matchId" uuid references public."Match"("id") on delete set null,
  "durationMs" integer,
  "completed" boolean not null default false,
  "mistakes" integer not null default 0,
  "submittedAt" timestamptz(3),
  "expiresAt" timestamptz(3) not null default (now() + interval '30 minutes'),
  "createdAt" timestamptz(3) not null default now(),
  constraint "PuzzleAttempt_numbers" check (
    ("durationMs" is null or "durationMs" between 0 and 86400000)
    and "mistakes" between 0 and 100000
  )
);

create table public."RatingChange" (
  "id" uuid primary key default extensions.gen_random_uuid(),
  "competitorId" uuid not null references public."Competitor"("id") on delete restrict,
  "matchId" uuid not null references public."Match"("id") on delete cascade,
  "gameType" public."GameType" not null,
  "ratingBefore" double precision not null,
  "ratingAfter" double precision not null,
  "delta" double precision not null,
  "rdBefore" double precision,
  "rdAfter" double precision,
  "createdAt" timestamptz(3) not null default now(),
  unique ("competitorId", "matchId"),
  constraint "RatingChange_numbers" check (
    private.is_finite_float("ratingBefore") and private.is_finite_float("ratingAfter")
    and private.is_finite_float("delta")
    and ("rdBefore" is null or (private.is_finite_float("rdBefore") and "rdBefore" >= 0))
    and ("rdAfter" is null or (private.is_finite_float("rdAfter") and "rdAfter" >= 0))
  )
);

create table public."MatchmakingQueueEntry" (
  "id" uuid primary key default extensions.gen_random_uuid(),
  "competitorId" uuid not null unique references public."Competitor"("id") on delete cascade,
  "modeId" text not null,
  "gameType" public."GameType" not null,
  "difficulty" public."Difficulty" not null,
  "rating" double precision not null,
  "region" text,
  "queuedAt" timestamptz(3) not null default now(),
  constraint "MatchmakingQueueEntry_ranked_mode" check ("modeId" in (
    'SUDOKU_6X6_CHALLENGE', 'SUDOKU_9X9_EASY', 'SUDOKU_9X9_HARD',
    'NONOGRAM_5X5', 'NONOGRAM_10X10'
  )),
  constraint "MatchmakingQueueEntry_rating" check (private.is_finite_float("rating"))
);

create index "AccountProfile_usernameCanonical_idx" on public."AccountProfile"("usernameCanonical");
create index "Competitor_status_idx" on public."Competitor"("status");
create index "PlayerGameRating_gameType_rating_idx" on public."PlayerGameRating"("gameType", "rating" desc);
create index "Puzzle_gameType_difficulty_status_idx" on public."Puzzle"("gameType", "difficulty", "status");
create index "Match_gameType_status_idx" on public."Match"("gameType", "status");
create index "Match_modeId_status_idx" on public."Match"("modeId", "status");
create index "Match_puzzleId_idx" on public."Match"("puzzleId");
create index "MatchParticipant_competitorId_idx" on public."MatchParticipant"("competitorId");
create index "MatchParticipant_disconnectDeadlineAt_idx" on public."MatchParticipant"("disconnectDeadlineAt");
create index "PuzzleAttempt_authUserId_createdAt_idx" on public."PuzzleAttempt"("authUserId", "createdAt" desc);
create index "PuzzleAttempt_expiresAt_idx" on public."PuzzleAttempt"("expiresAt");
create index "RatingChange_competitorId_gameType_createdAt_idx" on public."RatingChange"("competitorId", "gameType", "createdAt" desc);
create index "MatchmakingQueueEntry_modeId_queuedAt_idx" on public."MatchmakingQueueEntry"("modeId", "queuedAt");
create index "PendingSignup_createdAt_idx" on private."PendingSignup"("createdAt");

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new."updatedAt" := now();
  return new;
end;
$$;

create trigger competitor_set_updated_at before update on public."Competitor"
for each row execute function private.set_updated_at();
create trigger account_profile_set_updated_at before update on public."AccountProfile"
for each row execute function private.set_updated_at();
create trigger rating_set_updated_at before update on public."PlayerGameRating"
for each row execute function private.set_updated_at();

create or replace function private.activate_verified_account(target_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending private."PendingSignup"%rowtype;
  new_competitor_id uuid;
begin
  if exists (
    select 1 from public."AccountProfile" p where p."authUserId" = target_auth_user_id
  ) then
    return;
  end if;

  select * into pending
  from private."PendingSignup"
  where "authUserId" = target_auth_user_id
  for update;

  if not found then
    raise exception 'Verified account has no valid pending signup';
  end if;

  insert into public."Competitor" default values returning "id" into new_competitor_id;

  insert into public."AccountProfile" (
    "authUserId", "competitorId", "username", "usernameCanonical",
    "termsVersion", "termsAcceptedAt", "ageAttestedAt"
  ) values (
    target_auth_user_id, new_competitor_id, pending."username", pending."usernameCanonical",
    pending."termsVersion", pending."termsAcceptedAt", pending."ageAttestedAt"
  );

  insert into public."PlayerGameRating" ("competitorId", "gameType") values
    (new_competitor_id, 'SUDOKU'),
    (new_competitor_id, 'NONOGRAM');

  delete from private."PendingSignup" where "authUserId" = target_auth_user_id;
end;
$$;

create or replace function private.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical text;
  terms_version text;
  terms_at timestamptz;
  age_at timestamptz;
begin
  if tg_op = 'INSERT' then
    canonical := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
    terms_version := trim(coalesce(new.raw_user_meta_data ->> 'terms_version', ''));

    if canonical !~ '^[a-z0-9_-]{3,20}$' then
      raise exception 'Invalid username';
    end if;
    if exists (
      select 1 from private."ReservedUsername" r where r."usernameCanonical" = canonical
    ) then
      raise exception 'Username is reserved';
    end if;
    if terms_version = '' then
      raise exception 'Terms acceptance is required';
    end if;
    if terms_version <> '2026-08-17' then
      raise exception 'Unsupported terms version';
    end if;

    begin
      terms_at := (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz;
      age_at := (new.raw_user_meta_data ->> 'age_attested_at')::timestamptz;
    exception when others then
      raise exception 'Invalid signup attestations';
    end;
    if terms_at < now() - interval '1 hour' or terms_at > now() + interval '5 minutes'
       or age_at < now() - interval '1 hour' or age_at > now() + interval '5 minutes' then
      raise exception 'Stale signup attestations';
    end if;

    insert into private."UsernameClaim" ("usernameCanonical", "authUserId")
      values (canonical, new.id);
    insert into private."PendingSignup" (
      "authUserId", "username", "usernameCanonical", "termsVersion",
      "termsAcceptedAt", "ageAttestedAt"
    ) values (
      new.id, canonical, canonical, terms_version, terms_at, age_at
    );
  end if;

  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    perform private.activate_verified_account(new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_change
after insert or update of email_confirmed_at on auth.users
for each row execute function private.handle_auth_user_change();

create or replace function private.current_competitor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p."competitorId"
  from public."AccountProfile" p
  join public."Competitor" c on c."id" = p."competitorId"
  where p."authUserId" = (select auth.uid()) and c."status" = 'ACTIVE'
$$;

create or replace function private.is_match_participant(target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."MatchParticipant" mp
    where mp."matchId" = target_match_id
      and mp."competitorId" = private.current_competitor_id()
  )
$$;

create or replace function private.cleanup_unverified_signups()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare deleted_count integer;
begin
  delete from auth.users u
  using private."PendingSignup" p
  where u.id = p."authUserId"
    and u.email_confirmed_at is null
    and p."createdAt" < now() - interval '7 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function private.apply_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public."PuzzleAttempt"
  where "createdAt" < now() - interval '90 days';

  update public."MatchParticipant" mp
  set "completionTimeMs" = null,
      "mistakes" = null,
      "disconnectStatus" = null,
      "disconnectDeadlineAt" = null,
      "detailPurgedAt" = now()
  from public."Match" m
  where m."id" = mp."matchId"
    and m."completedAt" < now() - interval '90 days'
    and mp."detailPurgedAt" is null;

  update public."Match"
  set "puzzleId" = null, "detailPurgedAt" = now()
  where "completedAt" < now() - interval '90 days'
    and "detailPurgedAt" is null;
end;
$$;

select cron.schedule(
  'comppuzzles-clean-unverified', '17 * * * *',
  'select private.cleanup_unverified_signups()'
);
select cron.schedule(
  'comppuzzles-retention', '31 2 * * *',
  'select private.apply_retention()'
);

-- Browser-facing API views. Only the `api` schema is exposed by PostgREST.
create view api.public_profiles
with (security_invoker = true)
as
select
  p."username" as username,
  p."avatarUrl" as avatar_url,
  p."createdAt" as joined_at,
  (p."authUserId" = (select auth.uid())) as is_viewer,
  r."gameType"::text as game_type,
  r."rating" as rating,
  r."ratingDeviation" as rating_deviation,
  r."peakRating" as peak_rating,
  r."gamesPlayed" as games_played,
  r."wins" as wins,
  r."losses" as losses,
  r."draws" as draws
from public."AccountProfile" p
join public."Competitor" c on c."id" = p."competitorId"
join public."PlayerGameRating" r on r."competitorId" = c."id"
where c."status" = 'ACTIVE';

create view api.my_account_profile
with (security_invoker = true)
as
select
  p."username" as username,
  p."avatarUrl" as avatar_url,
  c."status"::text as competitor_status,
  p."usernameChangedAt" as username_changed_at,
  p."createdAt" as created_at
from public."AccountProfile" p
join public."Competitor" c on c."id" = p."competitorId"
where p."authUserId" = (select auth.uid());

create view api.my_game_ratings
with (security_invoker = true)
as
select
  r."gameType"::text as game_type,
  r."rating" as rating,
  r."ratingDeviation" as rating_deviation,
  r."volatility" as volatility,
  r."peakRating" as peak_rating,
  r."gamesPlayed" as games_played,
  r."wins" as wins,
  r."losses" as losses,
  r."draws" as draws
from public."PlayerGameRating" r
where r."competitorId" = private.current_competitor_id();

create view api.my_match_history
with (security_invoker = true)
as
select
  m."id" as match_id,
  m."gameType"::text as game_type,
  m."difficulty"::text as difficulty,
  m."modeId" as mode_id,
  m."puzzleId" as puzzle_id,
  mine."result"::text as result,
  opponent_profile."username" as opponent_username,
  mine."startingRating" as starting_rating,
  mine."endingRating" as ending_rating,
  mine."completionTimeMs" as completion_time_ms,
  opponent."completionTimeMs" as opponent_completion_time_ms,
  mine."mistakes" as mistakes,
  m."completedAt" as completed_at
from public."MatchParticipant" mine
join public."Match" m on m."id" = mine."matchId"
left join public."MatchParticipant" opponent
  on opponent."matchId" = mine."matchId" and opponent."competitorId" <> mine."competitorId"
left join public."AccountProfile" opponent_profile
  on opponent_profile."competitorId" = opponent."competitorId"
where mine."competitorId" = private.current_competitor_id()
  and m."status" = 'COMPLETED';

create view api.my_match_detail
with (security_invoker = true)
as
select
  m."id" as match_id,
  m."gameType"::text as game_type,
  m."difficulty"::text as difficulty,
  m."modeId" as mode_id,
  m."puzzleId" as puzzle_id,
  m."startedAt" as started_at,
  m."completedAt" as completed_at,
  (mp."competitorId" = m."winnerCompetitorId") as is_winner,
  (mp."competitorId" = private.current_competitor_id()) as is_viewer,
  coalesce(profile."username", 'Deleted player') as username,
  mp."result"::text as result,
  mp."startingRating" as starting_rating,
  mp."endingRating" as ending_rating,
  mp."completionTimeMs" as completion_time_ms,
  mp."mistakes" as mistakes,
  mp."disconnectStatus"::text as disconnect_status
from public."Match" m
join public."MatchParticipant" mp on mp."matchId" = m."id"
left join public."AccountProfile" profile on profile."competitorId" = mp."competitorId"
where private.is_match_participant(m."id") and m."status" = 'COMPLETED';

create or replace function api.change_my_username(new_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  canonical text := lower(trim(coalesce(new_username, '')));
begin
  if caller is null then raise exception 'Not authenticated'; end if;
  if canonical !~ '^[a-z0-9_-]{3,20}$' then raise exception 'Invalid username'; end if;
  if exists (select 1 from private."ReservedUsername" r where r."usernameCanonical" = canonical) then
    raise exception 'Username is reserved';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(canonical, 0));
  perform 1
  from public."AccountProfile" p
  where p."authUserId" = caller
    and p."usernameChangedAt" <= now() - interval '30 days'
  for update;
  if not found then raise exception 'Username cannot be changed yet'; end if;

  delete from private."UsernameClaim" where "authUserId" = caller;
  insert into private."UsernameClaim" ("usernameCanonical", "authUserId") values (canonical, caller);
  update public."AccountProfile"
    set "username" = canonical, "usernameCanonical" = canonical, "usernameChangedAt" = now()
    where "authUserId" = caller;
  return canonical;
end;
$$;

create or replace function api.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'account', jsonb_build_object(
      'email', u.email,
      'username', p."username",
      'createdAt', p."createdAt",
      'termsVersion', p."termsVersion",
      'termsAcceptedAt', p."termsAcceptedAt",
      'ageAttestedAt', p."ageAttestedAt"
    ),
    'ratings', coalesce((
      select jsonb_agg(to_jsonb(r) - 'id' - 'competitorId')
      from public."PlayerGameRating" r where r."competitorId" = p."competitorId"
    ), '[]'::jsonb),
    'practiceAttempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'puzzleId', a."puzzleId", 'durationMs', a."durationMs",
        'completed', a."completed", 'mistakes', a."mistakes",
        'submittedAt', a."submittedAt", 'createdAt', a."createdAt"
      ) order by a."createdAt" desc)
      from public."PuzzleAttempt" a where a."authUserId" = p."authUserId"
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'gameType', m."gameType", 'modeId', m."modeId", 'result', mp."result",
        'startingRating', mp."startingRating", 'endingRating', mp."endingRating",
        'completedAt', m."completedAt"
      ) order by m."completedAt" desc)
      from public."MatchParticipant" mp
      join public."Match" m on m."id" = mp."matchId"
      where mp."competitorId" = p."competitorId"
    ), '[]'::jsonb)
  )
  from public."AccountProfile" p
  join auth.users u on u.id = p."authUserId"
  where p."authUserId" = (select auth.uid())
$$;

drop function if exists api.delete_my_account(text, text);

create or replace function api.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  claims jsonb := (select auth.jwt());
  session_id_text text;
  issued_at bigint;
  password_authenticated_at bigint;
  target_competitor uuid;
begin
  if caller is null then raise exception 'Not authenticated'; end if;

  -- Fail fast instead of allowing concurrent destructive calls for one account
  -- to occupy the PostgREST connection pool while waiting on row locks.
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('delete-account:' || caller::text, 0)
  ) then
    raise exception 'Account deletion is already in progress';
  end if;

  -- The BFF performs signInWithPassword immediately before this call. Do not
  -- accept a merely refreshed/stolen bearer JWT: bind the request to a real,
  -- newly-created auth.sessions row and a recent password AMR entry. Refreshing
  -- an old session changes neither the session creation time nor its password
  -- authentication timestamp.
  session_id_text := claims ->> 'session_id';
  begin
    issued_at := (claims ->> 'iat')::bigint;
    select (entry ->> 'timestamp')::bigint
      into password_authenticated_at
      from jsonb_array_elements(coalesce(claims -> 'amr', '[]'::jsonb)) entry
      where entry ->> 'method' = 'password'
        and entry ->> 'timestamp' ~ '^[0-9]{1,12}$'
      order by (entry ->> 'timestamp')::bigint desc
      limit 1;
  exception when others then
    raise exception 'Recent password authentication required';
  end;

  if session_id_text is null
    or session_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or issued_at is null
    or password_authenticated_at is null
    or issued_at < pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.now()))::bigint - 120
    or issued_at > pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.now()))::bigint + 30
    or password_authenticated_at < pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.now()))::bigint - 120
    or password_authenticated_at > pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.now()))::bigint + 30
    or not exists (
      select 1
      from auth.sessions s
      where s.id = session_id_text::uuid
        and s.user_id = caller
        and s.created_at >= pg_catalog.now() - interval '2 minutes'
        and s.created_at <= pg_catalog.now() + interval '30 seconds'
    )
  then
    raise exception 'Recent password authentication required';
  end if;

  select p."competitorId" into target_competitor
    from public."AccountProfile" p where p."authUserId" = caller for update;
  if found then
    update public."Competitor" set "status" = 'DELETED' where "id" = target_competitor;
    delete from public."MatchmakingQueueEntry" where "competitorId" = target_competitor;
  end if;
  delete from public."PuzzleAttempt" where "authUserId" = caller;
  delete from public."AccountProfile" where "authUserId" = caller;
  delete from private."UsernameClaim" where "authUserId" = caller;
  delete from auth.users where id = caller;
  return true;
end;
$$;

-- Runtime roles are NOLOGIN group roles in source control. Production infra
-- grants LOGIN/passwords separately; no credential is committed.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'comppuzzles_realtime') then
    create role comppuzzles_realtime nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'comppuzzles_puzzle_writer') then
    create role comppuzzles_puzzle_writer nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'comppuzzles_backup') then
    create role comppuzzles_backup nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;

alter table public."Competitor" enable row level security; alter table public."Competitor" force row level security;
alter table public."AccountProfile" enable row level security; alter table public."AccountProfile" force row level security;
alter table public."PlayerGameRating" enable row level security; alter table public."PlayerGameRating" force row level security;
alter table public."Puzzle" enable row level security; alter table public."Puzzle" force row level security;
alter table public."SudokuPuzzle" enable row level security; alter table public."SudokuPuzzle" force row level security;
alter table public."CrosswordPuzzle" enable row level security; alter table public."CrosswordPuzzle" force row level security;
alter table public."NonogramPuzzle" enable row level security; alter table public."NonogramPuzzle" force row level security;
alter table public."Match" enable row level security; alter table public."Match" force row level security;
alter table public."MatchParticipant" enable row level security; alter table public."MatchParticipant" force row level security;
alter table public."PuzzleAttempt" enable row level security; alter table public."PuzzleAttempt" force row level security;
alter table public."RatingChange" enable row level security; alter table public."RatingChange" force row level security;
alter table public."MatchmakingQueueEntry" enable row level security; alter table public."MatchmakingQueueEntry" force row level security;
alter table private."PendingSignup" enable row level security; alter table private."PendingSignup" force row level security;
alter table private."UsernameClaim" enable row level security; alter table private."UsernameClaim" force row level security;
alter table private."ReservedUsername" enable row level security; alter table private."ReservedUsername" force row level security;
alter table private."SudokuPuzzleSecret" enable row level security; alter table private."SudokuPuzzleSecret" force row level security;
alter table private."CrosswordPuzzleSecret" enable row level security; alter table private."CrosswordPuzzleSecret" force row level security;
alter table private."NonogramPuzzleSecret" enable row level security; alter table private."NonogramPuzzleSecret" force row level security;

create policy competitor_public_read on public."Competitor" for select to anon, authenticated
  using ("status" = 'ACTIVE');
create policy profile_public_read on public."AccountProfile" for select to anon, authenticated
  using (exists (select 1 from public."Competitor" c where c."id" = "competitorId" and c."status" = 'ACTIVE'));
create policy rating_public_read on public."PlayerGameRating" for select to anon, authenticated
  using (exists (select 1 from public."Competitor" c where c."id" = "competitorId" and c."status" = 'ACTIVE'));
create policy match_participant_read on public."Match" for select to authenticated
  using (private.is_match_participant("id"));
create policy participant_match_read on public."MatchParticipant" for select to authenticated
  using (private.is_match_participant("matchId"));
create policy rating_change_match_read on public."RatingChange" for select to authenticated
  using (private.is_match_participant("matchId"));
create policy attempt_owner_read on public."PuzzleAttempt" for select to authenticated
  using ("authUserId" = (select auth.uid()));

create policy realtime_competitor_all on public."Competitor" for all to comppuzzles_realtime using (true) with check (true);
create policy realtime_profile_select on public."AccountProfile" for select to comppuzzles_realtime using (true);
create policy realtime_rating_all on public."PlayerGameRating" for all to comppuzzles_realtime using (true) with check (true);
create policy realtime_puzzle_select on public."Puzzle" for select to comppuzzles_realtime
  using ("gameType" in ('SUDOKU', 'NONOGRAM'));
create policy realtime_sudoku_select on public."SudokuPuzzle" for select to comppuzzles_realtime using (true);
create policy realtime_nonogram_select on public."NonogramPuzzle" for select to comppuzzles_realtime using (true);
create policy realtime_match_all on public."Match" for all to comppuzzles_realtime using (true) with check (true);
create policy realtime_participant_all on public."MatchParticipant" for all to comppuzzles_realtime using (true) with check (true);
create policy realtime_attempt_all on public."PuzzleAttempt" for all to comppuzzles_realtime using (true) with check (true);
create policy realtime_change_all on public."RatingChange" for all to comppuzzles_realtime using (true) with check (true);
create policy realtime_queue_all on public."MatchmakingQueueEntry" for all to comppuzzles_realtime using (true) with check (true);
create policy realtime_sudoku_secret_select on private."SudokuPuzzleSecret" for select to comppuzzles_realtime using (true);
create policy realtime_nonogram_secret_select on private."NonogramPuzzleSecret" for select to comppuzzles_realtime using (true);

create policy writer_puzzle_all on public."Puzzle" for all to comppuzzles_puzzle_writer using (true) with check (true);
create policy writer_sudoku_all on public."SudokuPuzzle" for all to comppuzzles_puzzle_writer using (true) with check (true);
create policy writer_crossword_all on public."CrosswordPuzzle" for all to comppuzzles_puzzle_writer using (true) with check (true);
create policy writer_nonogram_all on public."NonogramPuzzle" for all to comppuzzles_puzzle_writer using (true) with check (true);
create policy writer_sudoku_secret_all on private."SudokuPuzzleSecret" for all to comppuzzles_puzzle_writer using (true) with check (true);
create policy writer_crossword_secret_all on private."CrosswordPuzzleSecret" for all to comppuzzles_puzzle_writer using (true) with check (true);
create policy writer_nonogram_secret_all on private."NonogramPuzzleSecret" for all to comppuzzles_puzzle_writer using (true) with check (true);

create policy backup_competitor_read on public."Competitor" for select to comppuzzles_backup using (true);
create policy backup_rating_read on public."PlayerGameRating" for select to comppuzzles_backup using (true);
create policy backup_puzzle_read on public."Puzzle" for select to comppuzzles_backup using (true);
create policy backup_sudoku_read on public."SudokuPuzzle" for select to comppuzzles_backup using (true);
create policy backup_crossword_read on public."CrosswordPuzzle" for select to comppuzzles_backup using (true);
create policy backup_nonogram_read on public."NonogramPuzzle" for select to comppuzzles_backup using (true);
create policy backup_match_read on public."Match" for select to comppuzzles_backup using (true);
create policy backup_participant_read on public."MatchParticipant" for select to comppuzzles_backup using (true);
create policy backup_change_read on public."RatingChange" for select to comppuzzles_backup using (true);
create policy backup_sudoku_secret_read on private."SudokuPuzzleSecret" for select to comppuzzles_backup using (true);
create policy backup_crossword_secret_read on private."CrosswordPuzzleSecret" for select to comppuzzles_backup using (true);
create policy backup_nonogram_secret_read on private."NonogramPuzzleSecret" for select to comppuzzles_backup using (true);

grant usage on schema api to anon, authenticated;
grant select on api.public_profiles to anon, authenticated;
grant select on api.my_account_profile, api.my_game_ratings, api.my_match_history, api.my_match_detail to authenticated;
grant execute on function api.change_my_username(text), api.export_my_data(), api.delete_my_account() to authenticated;

-- This product does not use Supabase GraphQL. Deny both the PostgREST wrapper
-- and the reflected resolver even if a hosted project accidentally keeps
-- graphql_public in its exposed-schema list. pg_graphql installation is
-- optional on newer projects, so keep the hardening conditional.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'graphql_public') then
    execute 'revoke all on schema graphql_public from anon, authenticated';
    execute 'revoke execute on all functions in schema graphql_public from anon, authenticated';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'graphql') then
    execute 'revoke usage on schema graphql from anon, authenticated';
    execute 'revoke execute on all functions in schema graphql from anon, authenticated';
  end if;
end
$$;

grant usage on schema public, private to comppuzzles_realtime, comppuzzles_puzzle_writer, comppuzzles_backup;
grant select on public."Competitor", public."AccountProfile" to comppuzzles_realtime;
grant select, insert, update, delete on public."PlayerGameRating", public."Match", public."MatchParticipant",
  public."PuzzleAttempt", public."RatingChange", public."MatchmakingQueueEntry" to comppuzzles_realtime;
grant select on public."Puzzle", public."SudokuPuzzle", public."NonogramPuzzle",
  private."SudokuPuzzleSecret", private."NonogramPuzzleSecret" to comppuzzles_realtime;
grant select, insert, update, delete on public."Puzzle", public."SudokuPuzzle", public."CrosswordPuzzle",
  public."NonogramPuzzle", private."SudokuPuzzleSecret", private."CrosswordPuzzleSecret",
  private."NonogramPuzzleSecret" to comppuzzles_puzzle_writer;
grant select on public."Competitor", public."PlayerGameRating", public."Puzzle",
  public."SudokuPuzzle", public."CrosswordPuzzle", public."NonogramPuzzle",
  public."Match", public."MatchParticipant", public."RatingChange",
  private."SudokuPuzzleSecret", private."CrosswordPuzzleSecret",
  private."NonogramPuzzleSecret" to comppuzzles_backup;

-- Underlying grants required by security-invoker views. `public` is not an
-- exposed PostgREST schema; only the safe `api` projections are reachable.
grant select on public."Competitor", public."AccountProfile", public."PlayerGameRating" to anon, authenticated;
grant select on public."Match", public."MatchParticipant", public."RatingChange" to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema api from public, anon;
grant execute on function private.current_competitor_id(), private.is_match_participant(uuid) to authenticated;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

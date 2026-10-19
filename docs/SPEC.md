# Product Spec — Competitive Puzzle Platform MVP

> Source of truth for product scope, rules, and phased build order.
> CLAUDE.md summarizes the operating rules derived from this doc — if the two
> ever conflict, this doc wins on product/business logic; CLAUDE.md wins on
> engineering process and conventions.

# BUILD PROMPT — Competitive Puzzle Platform MVP

You are a senior full-stack engineer and product-minded technical lead.

Your job is to design and implement the MVP of a web-based competitive puzzle platform: essentially a "Chess.com for puzzle games."

The core idea is that users do not simply solve puzzles alone. They compete against other players in live or asynchronous ranked matches, gain or lose rating, climb leaderboards, and build a persistent competitive profile.

For the MVP, support three games:

1. Sudoku
2. Mini Crosswords
3. Nonograms

The product should be built as a WEBSITE only.

Do not build native iOS or Android apps.

The first objective is not massive scale. The goal is a polished, testable MVP that demonstrates whether users enjoy competitive ranked puzzle solving.

---

# 1. PRODUCT VISION

Traditional puzzle websites optimize around:

* solving today's puzzle,
* streaks,
* personal best times,
* static leaderboards.

This product should optimize around:

> "I want to play one more match because I want to increase my rating."

The main emotional loop should feel closer to Chess.com, ranked gaming, or Duolingo leagues than to a static Sudoku website.

A user should be able to:

1. create an account,
2. choose a game,
3. enter ranked matchmaking,
4. compete against another player on equivalent puzzle conditions,
5. immediately see who won,
6. gain or lose rating,
7. queue again.

The competitive experience is the product.

The puzzles themselves are the medium.

---

# 2. MVP SCOPE

Build only what is necessary for the competitive loop.

MVP features:

* authentication,
* player profiles,
* separate rating per game,
* matchmaking,
* ranked games,
* unranked/private games,
* puzzle generation/content,
* live match state,
* match results,
* match history,
* leaderboard,
* basic statistics,
* reconnect/resume support,
* anti-cheat foundations,
* responsive desktop/mobile-web interface.

Do NOT initially build:

* native apps,
* social feeds,
* clans,
* elaborate achievements,
* cosmetics,
* tournaments,
* chat,
* AI tutors,
* user-created puzzles,
* marketplace,
* ads,
* subscriptions,
* complicated progression systems.

Architect the code so these could be added later.

---

# 3. CORE GAME MODES

## Sudoku

Initial mode:

### Ranked Sprint

Two players receive puzzles of equivalent difficulty.

Preferably both players receive the exact same puzzle unless this introduces obvious cheating/exploit concerns.

Winner is determined primarily by:

1. correct completion,
2. completion time.

Rules:

* incorrect board cannot win,
* optionally add penalties for submitted mistakes,
* timer begins simultaneously,
* both players see opponent progress only in abstract form, e.g. percentage complete, NOT exact cells.

Example UI:

Player A
62% complete

Player B
54% complete

Do not reveal opponent moves.

Initial Sudoku board sizes:

* standard 9×9 only.

Initial difficulty buckets:

* Easy
* Medium
* Hard

Ranked matchmaking may determine difficulty automatically rather than asking the player every time.

---

## Mini Crosswords

Use short crossword grids rather than full NYT-sized crosswords.

Ideal approximate solve duration:

2–8 minutes.

Ranked mode:

Two players receive the same crossword.

Winner:

* first player to correctly complete the crossword.

Tie handling:

* completion timestamp,
* potentially mistakes as secondary metric.

Important:

Crosswords require content rather than pure generation.

Design a clean data model supporting:

* puzzle,
* clue,
* answer,
* grid,
* difficulty,
* author/source,
* publication status.

For development, include seed/demo crossword content.

Keep puzzle ingestion separated from match logic so a larger puzzle catalog can be imported later.

---

## Nonograms

Use relatively small boards initially.

Examples:

* 5×5
* 10×10
* potentially 15×15 later.

Competitive rule:

Both users solve the same puzzle.

First correct completion wins.

Support equivalent difficulty buckets.

Nonograms are useful for the MVP because puzzles can be procedurally generated and validated.

---

# 4. MATCH FLOW

The primary user journey should be extremely fast.

Target:

Homepage → Play → Matchmaking → Game

with minimal friction.

Example:

1. User opens dashboard.
2. Clicks "Sudoku".
3. Clicks "Ranked".
4. Enters matchmaking queue.
5. Match found.
6. 3-second countdown.
7. Puzzle begins.
8. User solves puzzle.
9. Result screen appears.
10. Rating change animates.
11. User sees:

WIN
1482 → 1496
+14

12. Large button:

PLAY AGAIN

The result screen should encourage immediate requeueing.

---

# 5. RATING SYSTEM

Each game has an independent rating.

Example:

User: Gabriel

Sudoku: 1642
Crosswords: 1284
Nonograms: 1510

Do not initially create one universal rating.

Use an established rating system.

Prefer Glicko-2 or a similarly robust rating model rather than implementing naïve Elo if practical.

However, the frontend can simply call it "Rating."

Store at minimum:

* current rating,
* rating deviation / uncertainty if using Glicko,
* games played,
* wins,
* losses,
* draws if applicable,
* peak rating.

Initial provisional rating:

400.

Players with few games should have higher rating uncertainty.

Matchmaking should primarily consider rating distance.

Example widening search:

0–10 seconds:
±100

10–20 seconds:
±200

20–30 seconds:
±350

30+ seconds:
allow broader matching.

Exact values should be configurable.

---

# 6. RANK TIERS

In addition to numerical ratings, show visual competitive tiers.

Example:

Bronze
< 1000

Silver
1000–1299

Gold
1300–1499

Platinum
1500–1699

Diamond
1700–1899

Master
1900–2099

Grandmaster
2100+

These thresholds should be configuration-driven, not hardcoded throughout the application.

Numerical rating remains the true ranking system.

---

# 7. LEADERBOARDS

Provide:

Global leaderboard

Filtered by:

* Sudoku,
* Crosswords,
* Nonograms.

Fields:

Rank
Username
Rating
Games Played
Win Rate

Potential later filters:

* country,
* university,
* friends,
* weekly leaderboard.

Do not build these filters yet unless trivial.

---

# 8. PLAYER PROFILE

Profile page should show:

Username
Avatar placeholder
Join date

For each game:

Rating
Rank tier
Peak rating
Games played
Wins
Losses
Win percentage
Average solve time

Also show recent matches.

Example:

Sudoku
1642 — Platinum

Last matches:

WIN vs puzzleKing21 +13
LOSS vs Marta92 -11
WIN vs LogicLord +9

---

# 9. MATCHMAKING

Implement server-controlled matchmaking.

Do not trust the client to determine opponents or results.

Basic architecture:

Player enters queue.

Queue entry stores:

* user ID,
* game type,
* rating,
* queue timestamp,
* optional region.

Matchmaker pairs appropriate players.

Once matched:

create Match record,
assign puzzle,
notify both clients,
begin countdown.

Use WebSockets or an appropriate realtime mechanism.

Design for race-condition safety.

A player must not accidentally enter multiple simultaneous ranked matches.

---

# 10. REALTIME MATCH STATE

The server should be authoritative.

Client may send:

* player progress,
* moves,
* completion event.

Server validates completion.

For Sudoku:

server must independently verify:

* all cells filled,
* solution valid.

Never trust:

client message:

"I won."

For Nonograms:

server validates final grid.

For Crosswords:

server validates answer grid.

Opponent progress may be broadcast as percentage only.

---

# 11. ANTI-CHEAT FOUNDATIONS

Do not overengineer anti-cheat for MVP.

However, design around the assumption that cheating will eventually matter.

Log:

* match duration,
* move timestamps,
* error counts,
* suspiciously fast solutions,
* disconnects,
* client metadata where appropriate.

Potential suspicious pattern:

A user repeatedly solving Hard Sudoku in 15 seconds.

Create an internal:

suspicion_score

or equivalent future-compatible data structure.

Do not automatically ban players in MVP.

Admin should later be able to review suspicious accounts.

Never expose puzzle answers or solutions unnecessarily to the client before match completion.

---

# 12. DISCONNECT HANDLING

Competitive games must handle network interruptions.

Rules:

If user briefly disconnects:

allow reconnect to active match.

Server retains match state.

Use a configurable grace period.

Example:

30 seconds.

If player fails to reconnect:

opponent wins by abandonment.

Do not penalize users for server-side failures.

Architect distinction between:

player disconnect
server failure
match cancellation.

---

# 13. PUZZLE SYSTEM

Create a shared Puzzle abstraction.

Suggested conceptual schema:

Puzzle

id
game_type
difficulty
content
solution
metadata
created_at
status

Game-specific representations may live in separate tables/models if cleaner.

Examples:

SudokuPuzzle

grid
solution
difficulty_score

CrosswordPuzzle

grid
clues
answers
author
source

NonogramPuzzle

row_clues
column_clues
solution_grid

Puzzle assignment should happen server-side.

Puzzle should be reusable across different matches.

Avoid showing the same user the same ranked puzzle repeatedly when possible.

Track:

PuzzleAttempt

user_id
puzzle_id
match_id
duration
completed
mistakes

---

# 14. SUDOKU PUZZLE GENERATION

Implement or integrate a reliable Sudoku generator.

Requirements:

* valid puzzles,
* exactly one solution,
* configurable difficulty,
* reasonable generation speed.

Separate generation from gameplay.

Ideally pre-generate puzzles and store them in the database.

Do NOT generate expensive puzzles synchronously every time matchmaking happens.

Create a script or worker that can generate puzzle batches.

Example:

generate:

100 Easy
100 Medium
100 Hard

for development/testing.

---

# 15. NONOGRAM GENERATION

Implement basic Nonogram generation.

Generate a binary grid.

Derive row and column clues.

Ensure resulting puzzles are reasonably solvable.

For the initial MVP, puzzle-quality perfection is less important than Sudoku.

The system should support manually curated puzzles later.

---

# 16. CROSSWORD CONTENT

Do NOT attempt to generate a sophisticated production crossword generator initially.

Instead:

create a puzzle import format.

Example JSON:

{
"title": "Demo Mini #1",
"width": 5,
"height": 5,
"grid": [...],
"clues": {
"across": [...],
"down": [...]
},
"solution": [...]
}

Seed development database with enough sample crosswords to test multiplayer gameplay.

Make the architecture able to import additional legally obtained/custom-authored crossword content later.

---

# 17. TECH STACK

Prefer a modern TypeScript stack.

Recommended default:

Frontend:
Next.js
React
TypeScript
Tailwind CSS

Backend:
Next.js server functionality OR separate Node backend if architectural separation is clearly beneficial.

Database:
PostgreSQL

ORM:
Prisma or equivalent mature TypeScript ORM.

Authentication:
Auth.js / Clerk / Supabase Auth or another well-supported solution.

Realtime:
WebSockets.

Possible options:

Socket.IO
native WebSockets
Supabase Realtime

Select one and explain the choice.

**Decisions locked in:** Auth = Supabase email/password with mandatory email
verification and a server-only Next.js BFF. Realtime = Socket.IO with one-use
Ed25519 admission tickets. Crossword is archived and unavailable.

Deployment target: **public beta without an SLA**. Netlify hosts the web/BFF,
Supabase EU hosts Auth/Postgres/Data API, and one Railway EU process hosts
Socket.IO. Upstash provides distributed security state. Advertising stays
disabled until a separate legal/consent release gate.

Avoid unnecessary microservices.

This is an MVP.

Prefer a modular monolith.

---

# 18. CODE ORGANIZATION

Keep game logic isolated.

Suggested structure:

/games
/sudoku
engine.ts
validator.ts
generator.ts
rating.ts
components/

/crossword
validator.ts
parser.ts
components/

/nonogram
generator.ts
validator.ts
components/

/matchmaking

/rating

/realtime

/auth

/database

Avoid putting game-specific rules inside generic matchmaking code.

Matchmaking should interact with games via common interfaces.

Example conceptual interface:

GameDefinition

createMatch()
validateMove()
validateCompletion()
calculateProgress()
determineWinner()

Do not force abstractions when they make code harder to understand.

---

# 19. DATABASE

Design the database properly before implementation.

Likely entities:

User
PlayerGameRating
Puzzle
SudokuPuzzle
CrosswordPuzzle
NonogramPuzzle
Match
MatchParticipant
PuzzleAttempt
RatingChange
MatchmakingQueueEntry

Possible fields:

User:
id
username
email
created_at

PlayerGameRating:
user_id
game_type
rating
rating_deviation
peak_rating
games_played

Match:
id
game_type
puzzle_id
status
started_at
completed_at
winner_user_id

MatchParticipant:
match_id
user_id
starting_rating
ending_rating
result
completion_time
disconnect_status

RatingChange:
user_id
match_id
before
after
delta

Think carefully about database constraints and indexes.

---

# 20. MATCH HISTORY

Every ranked result must be auditable.

Store enough data to reconstruct:

players,
ratings before game,
result,
rating change,
puzzle,
timestamps.

This prevents rating inconsistencies.

Rating updates should happen inside a database transaction.

A match should never award rating twice.

---

# 21. USER INTERFACE

Visual inspiration:

Chess.com competitive clarity,
modern gaming dashboards,
clean SaaS interface.

Do NOT clone Chess.com's exact design.

Dashboard should emphasize:

PLAY.

Main dashboard:

Welcome back, Gabriel

Sudoku
Rating 1642
[PLAY RANKED]

Crosswords
Rating 1284
[PLAY RANKED]

Nonograms
Rating 1510
[PLAY RANKED]

Below:

Recent matches
Leaderboard preview

Keep interface simple and addictive rather than dense.

---

# 22. LANDING PAGE

Unauthenticated homepage should immediately explain:

"Compete. Solve. Climb."

Possible hero:

COMPETITIVE PUZZLES

Play Sudoku, Crosswords and Nonograms against real players.

Solve faster.
Win matches.
Increase your rating.

[PLAY FREE]

Below:

Ranked matchmaking
Skill ratings
Global leaderboards
Multiple puzzle games

Do not spend excessive development time on marketing pages.

---

# 23. RESPONSIVENESS

Website must work well on:

desktop,
tablet,
mobile browsers.

Puzzle interactions must be touch-friendly.

Sudoku:

large tappable cells.

Crossword:

easy clue navigation.

Nonogram:

comfortable tap/drag controls.

Mobile web is important even though there is no native app.

---

# 24. ADMIN / DEVELOPMENT TOOLS

Create minimal internal tools/scripts for:

seed users,
seed puzzles,
generate Sudoku,
generate Nonograms,
reset development DB,
simulate rating matches.

Optional development-only match testing page.

Do not spend time building a polished admin dashboard yet.

---

# 25. TESTING

Write meaningful automated tests for logic that matters.

Especially:

Sudoku validation
Nonogram validation
Crossword validation
rating calculations
match completion
duplicate completion requests
rating transaction safety
matchmaking rules

Game logic should be unit-testable independently from UI.

Also implement basic integration tests for:

user enters queue
two users matched
game begins
winner submitted
result validated
rating changes.

---

# 26. SECURITY

Follow basic production security practices.

Important:

never trust client-side win calculation,
never send protected solutions prematurely,
validate all API inputs,
rate-limit sensitive endpoints,
prevent users from modifying ratings,
prevent matchmaking spoofing,
protect websocket events,
use secure authentication.

---

# 27. ANALYTICS EVENTS

Build basic analytics hooks.

Track events such as:

signup
login
matchmaking_started
match_found
match_started
match_completed
match_abandoned
play_again_clicked

Important product metrics later:

matches per user
day-1 retention
day-7 retention
average sessions
play-again rate
match completion rate
queue abandonment rate
games per session

Do not tightly couple analytics vendor code to game logic.

---

# 28. MVP SUCCESS CRITERIA

The MVP succeeds technically if:

Two users can sign up.

Both can queue for Sudoku.

They are matched.

They receive a puzzle.

They solve it in realtime.

The server identifies the winner.

Their ratings update correctly.

They can immediately play again.

The same infrastructure works for Crosswords and Nonograms.

Leaderboards reflect ratings.

Match histories are persistent.

The site works reasonably well on mobile browsers.

---

# 29. BUILD ORDER

Implement incrementally.

PHASE 1 — Foundation

Set up:

Next.js
TypeScript
database
authentication
schema
user profiles

PHASE 2 — Sudoku single-player engine

Build:

Sudoku rendering
input
validation
timer
generator
puzzle storage

PHASE 3 — Multiplayer infrastructure

Build:

WebSocket connection
queue
matchmaking
match state
reconnect

PHASE 4 — Ranked Sudoku

Implement:

match lifecycle
server validation
rating system
results
leaderboard

At this point, create a fully functional Sudoku vertical.

DO NOT begin other games until Sudoku ranked play works end-to-end.

PHASE 5 — Nonograms

Reuse:

matchmaking
ratings
match lifecycle

Add Nonogram-specific engine/UI.

PHASE 6 — Crosswords

Add:

crossword puzzle model
import
crossword UI
validation
ranked multiplayer.

PHASE 7 — Polish

Improve:

mobile UX
loading states
reconnect behavior
result animations
profile
leaderboards
match history.

---

# 30. IMPORTANT PRODUCT DECISIONS

Make these assumptions unless strong technical reasons indicate otherwise:

1. Ranked matches are primarily 1v1.

2. Each puzzle game has independent rating.

3. Ranked users play the same puzzle whenever appropriate.

4. The server determines the winner.

5. Numerical rating matters more than XP.

6. Competitive progression is the central mechanic.

7. The MVP starts completely free.

8. Do not add monetization yet.

9. Do not build native apps.

10. Prioritize Sudoku as the first fully polished game.

---

# 31. DEVELOPMENT STYLE

Do not attempt to implement everything in one enormous uncontrolled pass.

Before coding:

1. inspect existing repository,
2. describe proposed architecture,
3. identify major technical decisions,
4. create implementation phases.

Then begin implementing Phase 1.

After each phase:

* run tests,
* run lint,
* run typecheck,
* ensure app starts,
* briefly document what changed,
* continue unless blocked by a genuinely necessary decision.

Prefer:

simple,
readable,
typed,
maintainable code.

Avoid:

premature abstraction,
microservices,
unnecessary dependencies,
huge files,
fake placeholder architecture.

When possible, build real functioning vertical slices.

---

# 32. FIRST DELIVERABLE

Begin by producing:

1. proposed system architecture,
2. repository/file structure,
3. database schema,
4. realtime architecture,
5. rating-system choice,
6. matchmaking algorithm,
7. implementation roadmap.

Then implement the foundation and the Sudoku vertical.

The first major milestone is:

> Two browser sessions can enter ranked Sudoku matchmaking, play against one another, finish the puzzle, receive a verified result, and see their ratings update.

Do not move on to Crosswords or Nonograms until this milestone works reliably.

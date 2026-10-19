import type { Difficulty, GameType } from "@/database/generated/client/enums";

export interface PuzzleAssignment {
  puzzleId: string;
  /** Given/clue state shown to the client — never the solution. */
  clientPayload: string;
}

export interface CompletionCheck {
  complete: boolean;
  correct: boolean;
}

/**
 * Shared interface every game implements, per CLAUDE.md's code-organization
 * rules — matchmaking and the realtime server talk to games only through
 * this, never embedding game-specific rules.
 *
 * `determineWinner` from CLAUDE.md's original list is deliberately not
 * here: "first correct completion wins, tie-broken by time then mistakes,
 * opponent wins on abandonment" is identical across Sudoku/Crossword/
 * Nonogram per docs/SPEC.md (§3, §151-171, §202-207) — making every game
 * "implement" an identical copy would be exactly the kind of forced
 * abstraction CLAUDE.md itself warns against. It lives once, shared, in
 * matchmaking/determineWinner.ts.
 */
export interface GameDefinition {
  gameType: GameType;

  /**
   * Picks (or generates) a puzzle for a new match. Both players get the
   * same one. Puzzle reuse is intentional; the server chooses from the
   * published pool without exposing private solution records.
   */
  createMatch(difficulty: Difficulty, participantCompetitorIds: string[]): Promise<PuzzleAssignment>;

  /** Re-fetches an existing puzzle's client payload (reconnect-resume, submit validation). */
  getPuzzlePayload(puzzleId: string): Promise<string>;

  /** 0-100, for the abstract opponent-progress broadcast (SPEC §10) — never exact cells/moves. */
  calculateProgress(clientPayload: string, currentPayload: string): number;

  /**
   * Authoritative completion check. Never trusts a client "I won" message.
   * Takes `puzzleId` rather than the client payload because not every game
   * can self-verify from what the client was given: Sudoku (uniqueness) and
   * Nonogram (clue-derivation) can, but Crossword's black-square layout
   * doesn't determine which words are correct — it genuinely needs the
   * stored answer key (SPEC §10, "server validates answer grid"). Async so
   * each implementation can fetch whatever server-only data it needs.
   */
  validateCompletion(puzzleId: string, submittedPayload: string): Promise<CompletionCheck>;

  /** Only meaningful for games with server-checkable individual moves. */
  validateMove?(clientPayload: string, move: unknown): boolean;
}

const registry = new Map<GameType, GameDefinition>();

export function registerGameDefinition(definition: GameDefinition): void {
  registry.set(definition.gameType, definition);
}

export function getGameDefinition(gameType: GameType): GameDefinition {
  const definition = registry.get(gameType);
  if (!definition) {
    throw new Error(`No GameDefinition registered for ${gameType}`);
  }
  return definition;
}

import { sudokuGameDefinition } from "@/games/sudoku/gameDefinition";
import { registerGameDefinition } from "./gameDefinition";

// Crossword/Nonogram register here too once their GameDefinitions exist
// (Phase 5/6) — nothing else in matchmaking/realtime should need to change.
let registered = false;

export function ensureGamesRegistered(): void {
  if (registered) return;
  registerGameDefinition(sudokuGameDefinition);
  registered = true;
}

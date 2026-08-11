import { nonogramGameDefinition } from "@/games/nonogram/gameDefinition";
import { sudokuGameDefinition } from "@/games/sudoku/gameDefinition";
import { registerGameDefinition } from "./gameDefinition";

// Crossword registers here too once its GameDefinition exists (Phase 6) —
// nothing else in matchmaking/realtime should need to change.
let registered = false;

export function ensureGamesRegistered(): void {
  if (registered) return;
  registerGameDefinition(sudokuGameDefinition);
  registerGameDefinition(nonogramGameDefinition);
  registered = true;
}

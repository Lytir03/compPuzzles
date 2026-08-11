import { crosswordGameDefinition } from "@/games/crossword/gameDefinition";
import { nonogramGameDefinition } from "@/games/nonogram/gameDefinition";
import { sudokuGameDefinition } from "@/games/sudoku/gameDefinition";
import { registerGameDefinition } from "./gameDefinition";

let registered = false;

export function ensureGamesRegistered(): void {
  if (registered) return;
  registerGameDefinition(sudokuGameDefinition);
  registerGameDefinition(nonogramGameDefinition);
  registerGameDefinition(crosswordGameDefinition);
  registered = true;
}

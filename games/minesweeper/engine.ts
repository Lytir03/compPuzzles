export interface MinesweeperDimensions {
  width: number;
  height: number;
}

/** Row-major mine map. True means the cell contains a mine. */
export type MineMap = boolean[];

export const HIDDEN = -2;
export const FLAGGED = -1;

/** Hidden/flagged markers or a revealed adjacent-mine count from 0 through 8. */
export type MinesweeperView = number[];

export interface MinesweeperPuzzlePayload extends MinesweeperDimensions {
  mineCount: number;
  openingCell: number;
  seed: number;
}

export function cellIndex(dims: MinesweeperDimensions, row: number, col: number): number {
  return row * dims.width + col;
}

export function cellCoordinates(
  dims: MinesweeperDimensions,
  index: number,
): { row: number; col: number } {
  return { row: Math.floor(index / dims.width), col: index % dims.width };
}

export function neighbors(dims: MinesweeperDimensions, index: number): number[] {
  const { row, col } = cellCoordinates(dims, index);
  const result: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow < 0 || nextRow >= dims.height || nextCol < 0 || nextCol >= dims.width) continue;
      result.push(cellIndex(dims, nextRow, nextCol));
    }
  }

  return result;
}

export function adjacentMineCount(
  mines: MineMap,
  dims: MinesweeperDimensions,
  index: number,
): number {
  return neighbors(dims, index).filter((neighbor) => mines[neighbor]).length;
}

export function isValidMineMap(mines: unknown, dims: MinesweeperDimensions): mines is MineMap {
  return (
    Array.isArray(mines) &&
    mines.length === dims.width * dims.height &&
    mines.every((cell) => typeof cell === "boolean")
  );
}

export function encodePuzzlePayload(payload: MinesweeperPuzzlePayload): string {
  return JSON.stringify(payload);
}

export function decodePuzzlePayload(payload: string): MinesweeperPuzzlePayload {
  return JSON.parse(payload) as MinesweeperPuzzlePayload;
}

import { EMPTY, gridFromString } from "./engine";

/**
 * Pure — no server/DB dependency — so it can run both server-side (as part
 * of gameDefinition.ts's GameDefinition) and client-side (the ranked match
 * UI computes its own progress locally before emitting match:progress).
 */
export function calculateProgress(clientPayload: string, currentPayload: string): number {
  const given = gridFromString(clientPayload);
  const current = gridFromString(currentPayload);

  let editableTotal = 0;
  let editableFilled = 0;
  for (let i = 0; i < given.length; i++) {
    if (given[i] !== EMPTY) continue;
    editableTotal++;
    if (current[i] !== EMPTY) editableFilled++;
  }

  return editableTotal === 0 ? 100 : Math.round((editableFilled / editableTotal) * 100);
}

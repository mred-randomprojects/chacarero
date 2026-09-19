import { BOARD_SIZE } from "../game";
import type { MoveKind } from "../game";

/**
 * Builds the list of squares a pawn visits to go from `from` to `to`.
 * Forward/backward walk the ring one square at a time; a jump is one leap.
 */
export function pawnPath(from: number, to: number, kind: MoveKind): number[] {
  if (from === to) return [from];
  if (kind === "jump") return [from, to];
  const path = [from];
  let current = from;
  const step = kind === "forward" ? 1 : -1;
  while (current !== to) {
    current = (current + step + BOARD_SIZE) % BOARD_SIZE;
    path.push(current);
  }
  return path;
}


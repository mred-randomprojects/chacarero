import { BOARD_SIZE } from "../game";
import type { LastMove, MoveKind } from "../game";

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

/**
 * Joins the moves of one action into a single route, e.g. a roll onto Suerte
 * followed by "Retroceda 3" becomes 12 → 13 → 14 → 15 → 14 → 13 → 12, which
 * a plain from/to comparison would miss entirely.
 */
export function routeFor(moves: readonly LastMove[], playerId: string): { route: number[]; jump: boolean } | null {
  const own = moves.filter((m) => m.playerId === playerId);
  if (own.length === 0) return null;
  const route: number[] = [];
  let jump = false;
  for (const move of own) {
    const segment = pawnPath(move.from, move.to, move.kind);
    if (route.length > 0) segment.shift();
    route.push(...segment);
    if (move.kind === "jump") jump = true;
  }
  return route.length > 1 ? { route, jump } : null;
}

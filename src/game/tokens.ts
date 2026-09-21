/**
 * The pieces players move around the board. A token is one identity: its
 * colour is the player's colour everywhere (pawn, cards, prompts, map pins)
 * and its icon stands in for the player wherever the HUD needs a glyph.
 * There are more tokens than seats so a full table still gets a choice.
 */

export type TokenId = "tractor" | "vaca" | "caballo" | "mate" | "bota" | "oveja" | "gallo" | "sombrero";

export interface Token {
  readonly id: TokenId;
  /** Display name, as the players call the piece. */
  readonly name: string;
  readonly color: string;
  /** Emoji used as the player's glyph in the HUD. */
  readonly icon: string;
}

export const TOKENS: readonly Token[] = [
  { id: "tractor", name: "Tractor", color: "#dc2626", icon: "🚜" },
  { id: "vaca", name: "Vaca", color: "#1d4ed8", icon: "🐄" },
  { id: "caballo", name: "Caballo", color: "#92400e", icon: "🐎" },
  { id: "mate", name: "Mate", color: "#16a34a", icon: "🧉" },
  { id: "bota", name: "Bota", color: "#7c3aed", icon: "👢" },
  { id: "oveja", name: "Oveja", color: "#0891b2", icon: "🐑" },
  { id: "gallo", name: "Gallo", color: "#f59e0b", icon: "🐓" },
  { id: "sombrero", name: "Sombrero", color: "#db2777", icon: "👒" },
];

export const TOKEN_IDS: readonly TokenId[] = TOKENS.map((t) => t.id);

const TOKENS_BY_ID: ReadonlyMap<TokenId, Token> = new Map(TOKENS.map((t) => [t.id, t]));

export function getToken(id: TokenId): Token {
  const token = TOKENS_BY_ID.get(id);
  if (!token) throw new Error(`Unknown token ${id}`);
  return token;
}

export function isTokenId(value: unknown): value is TokenId {
  return typeof value === "string" && TOKENS_BY_ID.has(value as TokenId);
}

/** The first token nobody has picked yet (null only when all eight are taken). */
export function firstFreeToken(taken: readonly TokenId[]): TokenId | null {
  return TOKENS.find((t) => !taken.includes(t.id))?.id ?? null;
}

/**
 * Messages between the browser and the room server. Client → server messages
 * are validated with Zod because they come from the network; server → client
 * carries the engine's own types, which the server produced itself.
 */
import { z } from "zod";
import type { ActionRequest, DeedId, GameState, TokenId } from "../game";
import { DEAL_DEEDS_MAX, DEEDS, TOKEN_IDS } from "../game";

const deedIds = DEEDS.map((d) => d.id) as [DeedId, ...DeedId[]];
const DeedIdSchema = z.enum(deedIds);
const TokenIdSchema = z.enum(TOKEN_IDS as [TokenId, ...TokenId[]]);
const PlayerId = z.string().min(8).max(64);
const Name = z.string().trim().min(1).max(16);
const Code = z.string().trim().toUpperCase().length(4);
/** Far above any cash a game can hold; the engine checks the real balance. */
const MAX_CASH = 100_000_000;
const TradeOfferSchema = z.object({ deeds: z.array(DeedIdSchema).max(deedIds.length).readonly(), cash: z.number().int().nonnegative().max(MAX_CASH) });

export const ActionRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rollDice") }),
  z.object({ type: z.literal("movePawn") }),
  z.object({ type: z.literal("drawCard") }),
  z.object({ type: z.literal("acknowledgeCard") }),
  z.object({ type: z.literal("buy") }),
  z.object({ type: z.literal("decline") }),
  z.object({ type: z.literal("choosePay") }),
  z.object({ type: z.literal("chooseDraw") }),
  z.object({ type: z.literal("payBail") }),
  z.object({ type: z.literal("spendJailCard") }),
  z.object({ type: z.literal("endTurn") }),
  z.object({ type: z.literal("bid"), amount: z.number().int().positive() }),
  z.object({ type: z.literal("passBid") }),
  z.object({ type: z.literal("buildChacra"), deedId: DeedIdSchema }),
  z.object({ type: z.literal("buildEstancia"), deedId: DeedIdSchema }),
  z.object({ type: z.literal("sellBuilding"), deedId: DeedIdSchema }),
  z.object({ type: z.literal("mortgage"), deedId: DeedIdSchema }),
  z.object({ type: z.literal("unmortgage"), deedId: DeedIdSchema }),
  z.object({ type: z.literal("settlePayment") }),
  z.object({ type: z.literal("declareBankruptcy") }),
  z.object({ type: z.literal("proposeTrade"), toId: PlayerId, gives: TradeOfferSchema, receives: TradeOfferSchema }),
  z.object({ type: z.literal("acceptTrade") }),
  z.object({ type: z.literal("rejectTrade") }),
  z.object({ type: z.literal("cancelTrade") }),
  z.object({ type: z.literal("counterTrade"), gives: TradeOfferSchema, receives: TradeOfferSchema }),
]);

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("createRoom"), playerId: PlayerId, name: Name }),
  z.object({ type: z.literal("join"), playerId: PlayerId, name: Name, code: Code }),
  z.object({ type: z.literal("leave"), playerId: PlayerId }),
  z.object({ type: z.literal("updateName"), playerId: PlayerId, name: Name }),
  z.object({ type: z.literal("chooseToken"), playerId: PlayerId, token: TokenIdSchema }),
  z.object({ type: z.literal("startGame"), playerId: PlayerId, startingCash: z.number().int().min(1_000).max(1_000_000), dealDeeds: z.number().int().min(0).max(DEAL_DEEDS_MAX).default(0) }),
  z.object({ type: z.literal("newGame"), playerId: PlayerId }),
  z.object({ type: z.literal("shake"), playerId: PlayerId, shaking: z.boolean() }),
  /** The player is at the trade screen: the clock must not decide for them meanwhile. */
  z.object({ type: z.literal("composing"), playerId: PlayerId, composing: z.boolean() }),
  z.object({ type: z.literal("action"), playerId: PlayerId, seq: z.number().int().nonnegative(), action: ActionRequestSchema }),
  z.object({ type: z.literal("heartbeat"), playerId: PlayerId }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export interface RoomPlayer {
  readonly playerId: string;
  readonly name: string;
  readonly token: TokenId;
  /** The token's colour. */
  readonly color: string;
  readonly connected: boolean;
}

export type RoomStatus = "lobby" | "playing" | "finished";

/** Everything a client needs to render a room; sent whole after every change. */
export interface RoomView {
  readonly code: string;
  readonly hostId: string;
  readonly status: RoomStatus;
  readonly players: readonly RoomPlayer[];
  readonly game: GameState | null;
  /** Increments on every game state change; clients replay only consecutive steps. */
  readonly seq: number;
  /** The request that produced this state, so clients can voice it (dice throw). */
  readonly lastAction: ActionRequest["type"] | null;
  /** Who did it. */
  readonly lastActorId: string | null;
  /** Epoch ms when the current decision's default fires, or null. */
  readonly deadline: number | null;
  /** Whose hands are rattling the dice, if anyone's. */
  readonly shakingPlayerId: string | null;
  /** Server clock at send time, for countdown offset correction. */
  readonly now: number;
}

export type ServerMessage =
  | { readonly type: "room"; readonly you: string; readonly room: RoomView }
  | { readonly type: "left" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "roomNotFound"; readonly code: string };

/** Parses a raw socket payload into a client message, or null when malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const result = ClientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

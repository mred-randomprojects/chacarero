import type { CampoDeed, Deed, DeedId, Province } from "../types";
import { DEEDS, PROVINCE_NAMES, camposOf, deedName, getDeed } from "../deeds";
import { MAX_CHACRAS_PER_CAMPO, MORTGAGE_INTEREST } from "../constants";
import type { GameState, Holding, Player, Trade, TradeOffer } from "./state";
import { getPlayer } from "./state";

export type RuleCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const OK: RuleCheck = { ok: true };
function fail(reason: string): { readonly ok: false; readonly reason: string } {
  return { ok: false, reason };
}

export function holdingOf(state: GameState, deedId: DeedId): Holding | undefined {
  return state.holdings[deedId];
}

/** All deed ids owned by a player, in board order. */
export function deedsOwnedBy(state: GameState, playerId: string): readonly DeedId[] {
  return DEEDS.filter((d) => state.holdings[d.id]?.ownerId === playerId).map((d) => d.id);
}

/** The player owning every zone of a province, if any. */
export function provinceOwner(state: GameState, province: Province): string | null {
  const campos = camposOf(province);
  const first = campos[0];
  const firstHolding = first ? state.holdings[first.id] : undefined;
  if (!firstHolding) return null;
  return campos.every((c) => state.holdings[c.id]?.ownerId === firstHolding.ownerId) ? firstHolding.ownerId : null;
}

/** Number of chacras on a holding, counting an estancia as a full set for the even-build rule. */
function buildLevel(holding: Holding | undefined): number {
  if (!holding) return 0;
  return holding.estancia ? MAX_CHACRAS_PER_CAMPO + 1 : holding.chacras;
}

/**
 * Rent owed by a visitor landing on a deed, or 0 when nobody collects
 * (unowned, mortgaged, owner in jail, or the visitor is the owner).
 */
export function rentFor(state: GameState, deedId: DeedId, visitorId: string, diceTotal: number): number {
  const holding = state.holdings[deedId];
  if (!holding || holding.mortgaged || holding.ownerId === visitorId) return 0;
  const owner = getPlayer(state, holding.ownerId);
  if (owner.inJail || owner.bankrupt) return 0;
  const deed = getDeed(deedId);
  switch (deed.kind) {
    case "campo": {
      if (holding.estancia) return deed.rent.estancia;
      if (holding.chacras > 0) return deed.rent.chacras[holding.chacras - 1] ?? deed.rent.campo;
      return deed.rent.campo;
    }
    case "ferrocarril": {
      const owned = deedsOwnedBy(state, owner.id).filter((id) => getDeed(id).kind === "ferrocarril").length;
      return deed.rentByCount[Math.min(owned, 4) - 1] ?? 0;
    }
    case "compania": {
      const owned = deedsOwnedBy(state, owner.id).filter((id) => getDeed(id).kind === "compania").length;
      return diceTotal * (deed.diceMultiplierByCount[Math.min(owned, 3) - 1] ?? 0);
    }
  }
}

type OwnedCampo =
  | { readonly ok: true; readonly deed: CampoDeed; readonly holding: Holding }
  | { readonly ok: false; readonly reason: string };

function ownedCampo(state: GameState, player: Player, deedId: DeedId): OwnedCampo {
  const deed = getDeed(deedId);
  if (deed.kind !== "campo") return fail("Solo se construye en campos");
  const holding = state.holdings[deedId];
  if (!holding || holding.ownerId !== player.id) return fail("No es tu campo");
  return { ok: true, deed, holding };
}

/** Whether `player` may add one chacra to `deedId` right now. */
export function canBuildChacra(state: GameState, player: Player, deedId: DeedId): RuleCheck {
  const owned = ownedCampo(state, player, deedId);
  if (!owned.ok) return owned;
  const { deed, holding } = owned;
  if (provinceOwner(state, deed.province) !== player.id) return fail("Necesitás todas las zonas de la provincia");
  if (holding.estancia) return fail("Ya tiene una estancia");
  if (holding.chacras >= MAX_CHACRAS_PER_CAMPO) return fail("Ya tiene 4 chacras; construí una estancia");
  const siblings = camposOf(deed.province);
  if (siblings.some((c) => state.holdings[c.id]?.mortgaged)) return fail("Hay una zona hipotecada en la provincia");
  const lowest = Math.min(...siblings.map((c) => buildLevel(state.holdings[c.id])));
  if (holding.chacras > lowest) return fail("Construí parejo: primero las otras zonas");
  if (state.bank.chacras <= 0) return fail("El Banco no tiene más chacras");
  if (player.cash < deed.chacraCost) return fail("No te alcanza la plata");
  return OK;
}

/** Whether `player` may replace the 4 chacras on `deedId` with an estancia. */
export function canBuildEstancia(state: GameState, player: Player, deedId: DeedId): RuleCheck {
  const owned = ownedCampo(state, player, deedId);
  if (!owned.ok) return owned;
  const { deed, holding } = owned;
  if (holding.estancia) return fail("Ya tiene una estancia");
  if (holding.chacras < MAX_CHACRAS_PER_CAMPO) return fail("Necesitás 4 chacras primero");
  const siblings = camposOf(deed.province);
  const lowest = Math.min(...siblings.map((c) => buildLevel(state.holdings[c.id])));
  if (lowest < MAX_CHACRAS_PER_CAMPO) return fail("Construí parejo: las otras zonas necesitan 4 chacras");
  if (state.bank.estancias <= 0) return fail("El Banco no tiene más estancias");
  if (player.cash < deed.estanciaCost) return fail("No te alcanza la plata");
  return OK;
}

/** Whether `player` may sell one building (chacra, or the estancia) back to the bank. */
export function canSellBuilding(state: GameState, player: Player, deedId: DeedId): RuleCheck {
  const owned = ownedCampo(state, player, deedId);
  if (!owned.ok) return owned;
  const { deed, holding } = owned;
  if (!holding.estancia && holding.chacras === 0) return fail("No hay nada construido");
  if (holding.estancia && state.bank.chacras < MAX_CHACRAS_PER_CAMPO) {
    return fail("El Banco no tiene chacras para reemplazar la estancia");
  }
  const siblings = camposOf(deed.province);
  const highest = Math.max(...siblings.map((c) => buildLevel(state.holdings[c.id])));
  if (buildLevel(holding) < highest) return fail("Vendé parejo: primero las zonas con más construido");
  return OK;
}

/** Cash the bank pays for selling one building on `deedId` (half price). */
export function sellValue(deed: Deed, holding: Holding): number {
  if (deed.kind !== "campo") return 0;
  return (holding.estancia ? deed.estanciaCost : deed.chacraCost) / 2;
}

export function canMortgage(state: GameState, player: Player, deedId: DeedId): RuleCheck {
  const holding = state.holdings[deedId];
  if (!holding || holding.ownerId !== player.id) return fail("No es tu propiedad");
  if (holding.mortgaged) return fail("Ya está hipotecada");
  if (holding.chacras > 0 || holding.estancia) return fail("Vendé las construcciones antes de hipotecar");
  return OK;
}

export function canUnmortgage(state: GameState, player: Player, deedId: DeedId): RuleCheck {
  const holding = state.holdings[deedId];
  if (!holding || holding.ownerId !== player.id) return fail("No es tu propiedad");
  if (!holding.mortgaged) return fail("No está hipotecada");
  if (player.cash < unmortgageCost(deedId)) return fail("No te alcanza la plata");
  return OK;
}

/** Cash received when mortgaging: the mortgage value minus the bank's 10 % up front. */
export function mortgageProceeds(deedId: DeedId): number {
  const { mortgage } = getDeed(deedId);
  return Math.round(mortgage * (1 - MORTGAGE_INTEREST));
}

/** Cash paid to lift a mortgage: the mortgage value plus 10 %. */
export function unmortgageCost(deedId: DeedId): number {
  const { mortgage } = getDeed(deedId);
  return Math.round(mortgage * (1 + MORTGAGE_INTEREST));
}

/**
 * Whether players may build, mortgage or trade right now: not while a deed is
 * being auctioned, not while a trade is on the table, not after the game.
 */
export function canManageHoldings(state: GameState): boolean {
  const { type } = state.phase;
  return type !== "auction" && type !== "awaitingTradeResponse" && type !== "gameOver";
}

// ---------- trades ----------

/**
 * Whether the player who must act may put a trade on the table: between
 * steps only, never with the dice in the air, a card face up or an auction
 * or another trade under way.
 */
export function canProposeTrade(state: GameState): boolean {
  switch (state.phase.type) {
    case "awaitingRoll":
    case "awaitingJailDecision":
    case "awaitingBuyDecision":
    case "awaitingPayment":
    case "turnEnd":
      return true;
    default:
      return false;
  }
}

/**
 * Whether a deed may change hands between players. Buildings only go to and
 * from the bank, and the even-build rule spans the province, so a campo can
 * be traded only while its whole province is bare.
 */
export function canTradeDeed(state: GameState, deedId: DeedId): RuleCheck {
  const deed = getDeed(deedId);
  if (deed.kind !== "campo") return OK;
  const built = camposOf(deed.province).find((c) => {
    const holding = state.holdings[c.id];
    return holding !== undefined && (holding.estancia || holding.chacras > 0);
  });
  if (!built) return OK;
  return fail(built.id === deedId ? "Vendé las construcciones antes de canjear" : `Hay construcciones en ${PROVINCE_NAMES[deed.province]}; vendelas antes de canjear`);
}

/** Bank fee for taking over a mortgaged deed: 10 % of the mortgage value, paid on the spot. */
export function mortgageTransferFee(deedId: DeedId): number {
  const { mortgage } = getDeed(deedId);
  return Math.round(mortgage * MORTGAGE_INTEREST);
}

function transferFees(state: GameState, deeds: readonly DeedId[]): number {
  return deeds.reduce((sum, id) => sum + (state.holdings[id]?.mortgaged ? mortgageTransferFee(id) : 0), 0);
}

/** How much cash each side gains (or loses, negative) if the trade goes through, bank fees included. */
export function tradeBalance(state: GameState, trade: Trade): { readonly from: number; readonly to: number } {
  return {
    from: trade.receives.cash - trade.gives.cash - transferFees(state, trade.receives.deeds),
    to: trade.gives.cash - trade.receives.cash - transferFees(state, trade.gives.deeds),
  };
}

function checkOffer(state: GameState, owner: Player, offer: TradeOffer): RuleCheck {
  if (!Number.isInteger(offer.cash) || offer.cash < 0) return fail("La plata tiene que ser un número entero");
  for (const id of offer.deeds) {
    const holding = state.holdings[id];
    if (!holding || holding.ownerId !== owner.id) return fail(`${deedName(getDeed(id))} no es de ${owner.name}`);
    const tradeable = canTradeDeed(state, id);
    if (!tradeable.ok) return fail(`${deedName(getDeed(id))}: ${tradeable.reason.charAt(0).toLowerCase()}${tradeable.reason.slice(1)}`);
  }
  return OK;
}

/**
 * Whether a trade is well formed and both sides can honour it right now:
 * two different solvent players, only their own bare deeds, at least one
 * deed changing hands (cash for nothing would be a loan, which the rules
 * forbid), and nobody left short of cash once fees are paid.
 */
export function checkTrade(state: GameState, trade: Trade): RuleCheck {
  const from = state.players.find((p) => p.id === trade.fromId);
  const to = state.players.find((p) => p.id === trade.toId);
  if (!from || !to) return fail("Ese jugador no está en la mesa");
  if (from.id === to.id) return fail("No podés canjear con vos mismo");
  if (from.bankrupt || to.bankrupt) return fail(`${(from.bankrupt ? from : to).name} ya quebró`);
  const all = [...trade.gives.deeds, ...trade.receives.deeds];
  if (all.length === 0) return fail("Un canje tiene que incluir al menos una escritura");
  if (new Set(all).size !== all.length) return fail("Hay una escritura repetida");
  const gives = checkOffer(state, from, trade.gives);
  if (!gives.ok) return gives;
  const receives = checkOffer(state, to, trade.receives);
  if (!receives.ok) return receives;
  const balance = tradeBalance(state, trade);
  if (from.cash + balance.from < 0) return fail(`A ${from.name} no le alcanza la plata`);
  if (to.cash + balance.to < 0) return fail(`A ${to.name} no le alcanza la plata`);
  return OK;
}

/** Whether the player still has something to sell or mortgage. */
export function canRaiseCash(state: GameState, playerId: string): boolean {
  return deedsOwnedBy(state, playerId).some((id) => {
    const holding = state.holdings[id];
    return holding !== undefined && (!holding.mortgaged || holding.chacras > 0 || holding.estancia);
  });
}

/** Chacras and estancias a player has on the board. */
export function buildingCount(state: GameState, playerId: string): { chacras: number; estancias: number } {
  let chacras = 0;
  let estancias = 0;
  for (const id of deedsOwnedBy(state, playerId)) {
    const holding = state.holdings[id];
    if (!holding) continue;
    if (holding.estancia) estancias += 1;
    else chacras += holding.chacras;
  }
  return { chacras, estancias };
}

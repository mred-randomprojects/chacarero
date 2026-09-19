/**
 * Game actions. Every function takes a state and returns a new state; nothing
 * is mutated. Preconditions throw, so the UI should only offer actions the
 * current phase allows.
 *
 * The turn flow is driven by `continueTurn`: after anything happens, it
 * settles pending debts first, then pending auctions, and only then hands the
 * dice back (or ends the turn).
 */
import type { Card, Deck, DeedId, Square } from "../types";
import { ALL_CARDS } from "../cards";
import { JAIL_INDEX, getSquare, salidaCrossings } from "../board";
import { BOARD_SIZE, JAIL_BAIL, MAX_CHACRAS_PER_CAMPO, MAX_JAIL_TURNS, SALIDA_BONUS, DOUBLES_TO_JAIL } from "../constants";
import { deedName, getDeed } from "../deeds";
import { pesos } from "../describe";
import type { Auction, Creditor, Debt, GameState, Holding, MoveKind, Phase, Player } from "./state";
import { activePlayer, currentPlayer, getPlayer } from "./state";
import {
  buildingCount,
  canBuildChacra,
  canBuildEstancia,
  canMortgage,
  canRaiseCash,
  canSellBuilding,
  canUnmortgage,
  mortgageProceeds,
  rentFor,
  sellValue,
  unmortgageCost,
} from "./rules";

export type Dice = readonly [number, number];

/** Smallest amount a bid must exceed the previous one by. */
export const MIN_BID_INCREMENT = 100;

const CARDS_BY_ID: ReadonlyMap<string, Card> = new Map(ALL_CARDS.map((c) => [c.id, c]));

// ---------- small helpers ----------

function expectPhase<T extends Phase["type"]>(state: GameState, ...types: readonly T[]): Extract<Phase, { type: T }> {
  const phase = state.phase;
  if (!(types as readonly string[]).includes(phase.type)) {
    throw new Error(`Acción no permitida en la fase ${phase.type}`);
  }
  return phase as Extract<Phase, { type: T }>;
}

function log(state: GameState, text: string, playerId: string = currentPlayer(state).id): GameState {
  return { ...state, log: [...state.log, { turn: state.turn, playerId, text }] };
}

function updatePlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function setPhase(state: GameState, phase: Phase): GameState {
  return { ...state, phase };
}

function setHolding(state: GameState, deedId: DeedId, holding: Holding | undefined): GameState {
  const holdings = { ...state.holdings };
  if (holding) holdings[deedId] = holding;
  else delete holdings[deedId];
  return { ...state, holdings };
}

function creditorName(state: GameState, to: Creditor): string {
  return to.type === "bank" ? "el Banco" : getPlayer(state, to.playerId).name;
}

function diceTotal(state: GameState): number {
  return state.dice ? state.dice[0] + state.dice[1] : 0;
}

function solventPlayers(state: GameState): readonly Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

// ---------- money ----------

/** The bank pays a player. Tracked per turn so a third doubles can claw it back. */
function bankPays(state: GameState, playerId: string, amount: number): GameState {
  const player = getPlayer(state, playerId);
  return updatePlayer(state, playerId, { cash: player.cash + amount, bankIncomeThisTurn: player.bankIncomeThisTurn + amount });
}

function transfer(state: GameState, fromId: string, amount: number, to: Creditor, reason: string): GameState {
  const from = getPlayer(state, fromId);
  let next = updatePlayer(state, fromId, { cash: from.cash - amount });
  if (to.type === "player") {
    const creditor = getPlayer(next, to.playerId);
    next = updatePlayer(next, to.playerId, { cash: creditor.cash + amount });
  }
  return log(next, `${from.name} paga ${pesos(amount)} a ${creditorName(state, to)} (${reason}).`, fromId);
}

/**
 * Makes a player pay. If they cannot cover it the debt is queued; the game
 * will stop at `awaitingPayment` so they can sell or mortgage (or go bust).
 */
function charge(state: GameState, debtorId: string, amount: number, to: Creditor, reason: string): GameState {
  if (amount <= 0) return state;
  const debtor = getPlayer(state, debtorId);
  if (debtor.cash >= amount) return transfer(state, debtorId, amount, to, reason);
  const debt: Debt = { debtorId, amount, to, reason };
  const next = log(state, `${debtor.name} no tiene ${pesos(amount)} para ${reason}; tiene que vender o hipotecar.`, debtorId);
  return { ...next, pendingDebts: [...next.pendingDebts, debt] };
}

// ---------- turn flow ----------

/** Decides what comes after the current move is fully resolved. */
function finishMove(state: GameState): GameState {
  const player = currentPlayer(state);
  if (player.bankrupt) return setPhase(state, { type: "turnEnd" });
  if (state.rollAgain && !player.inJail) return setPhase(state, { type: "awaitingRoll" });
  return setPhase(state, { type: "turnEnd" });
}

/** Central scheduler: debts first, then auctions, then the move goes on. */
function continueTurn(state: GameState): GameState {
  const [debt] = state.pendingDebts;
  if (debt) {
    return setPhase(state, { type: "awaitingPayment", debtorId: debt.debtorId, amount: debt.amount, to: debt.to, reason: debt.reason });
  }
  if (state.phase.type === "auction") return state;
  const [deedId, ...rest] = state.pendingAuctions;
  if (deedId) return startAuction({ ...state, pendingAuctions: rest }, deedId);
  return finishMove(state);
}

// ---------- movement ----------

function setPosition(state: GameState, playerId: string, to: number, kind: MoveKind): GameState {
  const from = getPlayer(state, playerId).position;
  const next = updatePlayer(state, playerId, { position: to });
  return { ...next, lastMove: { playerId, from, to, kind } };
}

function moveBy(state: GameState, steps: number): GameState {
  const player = currentPlayer(state);
  const crossings = salidaCrossings(player.position, steps);
  const position = ((player.position + steps) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
  let next = setPosition(state, player.id, position, steps >= 0 ? "forward" : "backward");
  if (crossings > 0) {
    next = bankPays(next, player.id, SALIDA_BONUS * crossings);
    next = log(next, `${player.name} pasa por la Salida y cobra ${pesos(SALIDA_BONUS * crossings)}.`);
  }
  return next;
}

function moveTo(state: GameState, square: number, collectSalida: boolean, direction: MoveKind): GameState {
  const player = currentPlayer(state);
  const forward = (square - player.position + BOARD_SIZE) % BOARD_SIZE;
  if (collectSalida) return moveBy(state, forward);
  return setPosition(state, player.id, square, direction);
}

function sendToJail(state: GameState, why: string): GameState {
  const player = currentPlayer(state);
  let next = setPosition(state, player.id, JAIL_INDEX, "jump");
  next = updatePlayer(next, player.id, { inJail: true, jailTurns: 0, doublesThisTurn: 0 });
  next = log(next, `${player.name} marcha preso (${why}).`);
  return { ...next, rollAgain: false };
}

// ---------- landing ----------

function resolveLanding(state: GameState): GameState {
  const player = currentPlayer(state);
  const square: Square = getSquare(player.position);
  switch (square.kind) {
    case "salida":
    case "comisaria":
    case "descanso":
    case "libreEstacionamiento":
      return continueTurn(log(state, `${player.name} cae en ${square.name}.`));
    case "marchePreso":
      return continueTurn(sendToJail(state, "cayó en Marche preso"));
    case "impuesto":
      return continueTurn(charge(log(state, `${player.name} cae en ${square.name}.`), player.id, -square.amount, { type: "bank" }, square.name.toLowerCase()));
    case "premio": {
      let next = bankPays(state, player.id, square.amount);
      next = log(next, `${player.name} cae en ${square.name} y cobra ${pesos(square.amount)}.`);
      return continueTurn(next);
    }
    case "suerte":
    case "destino":
      return drawCard(log(state, `${player.name} cae en ${square.name}.`), square.kind);
    case "campo":
    case "ferrocarril":
    case "compania":
      return resolveDeedLanding(state, square.deedId);
  }
}

function resolveDeedLanding(state: GameState, deedId: DeedId): GameState {
  const player = currentPlayer(state);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  const name = deedName(deed);
  if (!holding) {
    const next = log(state, `${player.name} cae en ${name}, que está libre.`);
    return setPhase(next, { type: "awaitingBuyDecision", deedId });
  }
  if (holding.ownerId === player.id) {
    return continueTurn(log(state, `${player.name} cae en ${name}, que es suyo.`));
  }
  const owner = getPlayer(state, holding.ownerId);
  const rent = rentFor(state, deedId, player.id, diceTotal(state));
  if (rent === 0) {
    const why = holding.mortgaged ? "está hipotecada" : owner.inJail ? `${owner.name} está preso y no cobra` : "no corresponde alquiler";
    return continueTurn(log(state, `${player.name} cae en ${name} de ${owner.name}: ${why}.`));
  }
  let next = log(state, `${player.name} cae en ${name} de ${owner.name}.`);
  let reason = `alquiler de ${name}`;
  if (deed.kind === "compania" && state.dice) {
    // Company rent depends on the dice that brought the visitor here, so spell it out.
    reason = `alquiler de ${name}: dados ${state.dice[0]}+${state.dice[1]} = ${diceTotal(state)} × ${rent / diceTotal(state)}`;
  }
  next = charge(next, player.id, rent, { type: "player", playerId: owner.id }, reason);
  return continueTurn(next);
}

// ---------- cards ----------

function drawCard(state: GameState, deck: Deck): GameState {
  const ids = state.decks[deck];
  const [topId, ...rest] = ids;
  if (topId === undefined) throw new Error(`El mazo de ${deck} está vacío`);
  const card = CARDS_BY_ID.get(topId);
  if (!card) throw new Error(`Unknown card ${topId}`);
  const keep = card.effect.type === "getOutOfJail";
  const decks = { ...state.decks, [deck]: keep ? rest : [...rest, topId] };
  const player = currentPlayer(state);
  let next: GameState = { ...state, decks, lastCard: card };
  next = log(next, `${player.name} levanta ${deck === "suerte" ? "Suerte" : "Destino"}: "${card.text}"`);
  return applyCard(next, card);
}

function applyCard(state: GameState, card: Card): GameState {
  const player = currentPlayer(state);
  const effect = card.effect;
  switch (effect.type) {
    case "collect":
      return continueTurn(bankPays(state, player.id, effect.amount));
    case "pay":
      return continueTurn(charge(state, player.id, effect.amount, { type: "bank" }, "la tarjeta"));
    case "collectFromEachPlayer": {
      let next = state;
      for (const other of state.players) {
        if (other.id === player.id || other.bankrupt) continue;
        next = charge(next, other.id, effect.amount, { type: "player", playerId: player.id }, `el cumpleaños de ${player.name}`);
      }
      return continueTurn(next);
    }
    case "moveTo":
      return resolveLanding(moveTo(state, effect.square, effect.collectSalida, effect.direction));
    case "moveBy":
      return resolveLanding(moveBy(state, effect.steps));
    case "goToJail":
      return continueTurn(sendToJail(state, "por la tarjeta"));
    case "getOutOfJail": {
      const next = updatePlayer(state, player.id, { getOutOfJailCards: player.getOutOfJailCards + 1 });
      return continueTurn(log(next, `${player.name} se guarda la tarjeta para salir de la Comisaría.`));
    }
    case "payPerBuilding": {
      const { chacras, estancias } = buildingCount(state, player.id);
      const amount = chacras * effect.perChacra + estancias * effect.perEstancia;
      if (amount === 0) return continueTurn(log(state, `${player.name} no tiene construcciones; no paga nada.`));
      return continueTurn(charge(state, player.id, amount, { type: "bank" }, `${chacras} chacras y ${estancias} estancias`));
    }
    case "payOrDraw":
      return setPhase(state, { type: "awaitingPayOrDraw", amount: effect.amount, deck: effect.deck });
  }
}

// ---------- public actions ----------

/** Rolls the dice (or uses the given ones) and moves the current player. */
export function roll(state: GameState, random: () => number = Math.random, forced?: Dice): GameState {
  const phase = expectPhase(state, "awaitingRoll", "awaitingJailDecision");
  const dice: Dice = forced ?? [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
  const doubles = dice[0] === dice[1];
  const player = currentPlayer(state);
  let next: GameState = { ...state, dice, lastCard: null, rollAgain: false };
  next = log(next, `${player.name} tira ${dice[0]} y ${dice[1]}${doubles ? " (¡doble!)" : ""}.`);

  if (phase.type === "awaitingJailDecision") {
    if (doubles) {
      next = updatePlayer(next, player.id, { inJail: false, jailTurns: 0 });
      next = log(next, `${player.name} saca doble y sale de la Comisaría.`);
      return resolveLanding(moveBy(next, dice[0] + dice[1]));
    }
    const jailTurns = player.jailTurns + 1;
    if (jailTurns >= MAX_JAIL_TURNS) {
      next = updatePlayer(next, player.id, { inJail: false, jailTurns: 0 });
      next = log(next, `${player.name} cumplió ${MAX_JAIL_TURNS} turnos preso y sale.`);
      return resolveLanding(moveBy(next, dice[0] + dice[1]));
    }
    next = updatePlayer(next, player.id, { jailTurns });
    return setPhase(log(next, `${player.name} sigue preso (${jailTurns}/${MAX_JAIL_TURNS}).`), { type: "turnEnd" });
  }

  if (doubles) {
    const doublesThisTurn = player.doublesThisTurn + 1;
    next = updatePlayer(next, player.id, { doublesThisTurn });
    if (doublesThisTurn >= DOUBLES_TO_JAIL) {
      next = sendToJail(next, "tres dobles seguidos");
      // Rulebook: everything collected from the bank this turn goes back.
      const owed = getPlayer(next, player.id).bankIncomeThisTurn;
      if (owed > 0) {
        next = log(next, `${player.name} tiene que devolver los ${pesos(owed)} que cobró del Banco en este turno.`);
        next = charge(next, player.id, owed, { type: "bank" }, "devolución por tres dobles seguidos");
      }
      return continueTurn(next);
    }
    next = { ...next, rollAgain: true };
  }
  return resolveLanding(moveBy(next, dice[0] + dice[1]));
}

/** Buys the deed the current player is standing on. */
export function buy(state: GameState): GameState {
  const { deedId } = expectPhase(state, "awaitingBuyDecision");
  const player = currentPlayer(state);
  const deed = getDeed(deedId);
  if (player.cash < deed.price) throw new Error("No te alcanza la plata");
  let next = updatePlayer(state, player.id, { cash: player.cash - deed.price });
  next = setHolding(next, deedId, { ownerId: player.id, chacras: 0, estancia: false, mortgaged: false });
  next = log(next, `${player.name} compra ${deedName(deed)} por ${pesos(deed.price)}.`);
  return continueTurn(next);
}

/** Declines to buy: the bank auctions the deed to everyone, decliner included. */
export function decline(state: GameState): GameState {
  const { deedId } = expectPhase(state, "awaitingBuyDecision");
  const next = log(state, `${currentPlayer(state).name} no compra ${deedName(getDeed(deedId))}; sale a remate.`);
  return startAuction(next, deedId);
}

/** For "Pague $200 o levante una tarjeta de Suerte": pay. */
export function choosePay(state: GameState): GameState {
  const { amount } = expectPhase(state, "awaitingPayOrDraw");
  return continueTurn(charge(state, currentPlayer(state).id, amount, { type: "bank" }, "la tarjeta"));
}

/** For "Pague $200 o levante una tarjeta de Suerte": draw instead. */
export function chooseDraw(state: GameState): GameState {
  const { deck } = expectPhase(state, "awaitingPayOrDraw");
  return drawCard(state, deck);
}

export function payBail(state: GameState): GameState {
  expectPhase(state, "awaitingJailDecision");
  const player = currentPlayer(state);
  if (player.cash < JAIL_BAIL) throw new Error("No te alcanza para la fianza");
  let next = transfer(state, player.id, JAIL_BAIL, { type: "bank" }, "fianza");
  next = updatePlayer(next, player.id, { inJail: false, jailTurns: 0 });
  return setPhase(next, { type: "awaitingRoll" });
}

export function useJailCard(state: GameState): GameState {
  expectPhase(state, "awaitingJailDecision");
  const player = currentPlayer(state);
  if (player.getOutOfJailCards <= 0) throw new Error("No tenés tarjeta");
  // The card goes back to the bottom of the Suerte deck; both decks' cards are interchangeable.
  const cardId = ALL_CARDS.find((c) => c.effect.type === "getOutOfJail" && !state.decks.suerte.includes(c.id) && !state.decks.destino.includes(c.id))?.id;
  const decks = cardId ? { ...state.decks, suerte: [...state.decks.suerte, cardId] } : state.decks;
  let next: GameState = { ...state, decks };
  next = updatePlayer(next, player.id, { inJail: false, jailTurns: 0, getOutOfJailCards: player.getOutOfJailCards - 1 });
  next = log(next, `${player.name} usa su tarjeta y sale de la Comisaría.`);
  return setPhase(next, { type: "awaitingRoll" });
}

/** Ends the turn and hands the dice to the next solvent player. */
export function endTurn(state: GameState): GameState {
  expectPhase(state, "turnEnd");
  const solvent = solventPlayers(state);
  const winner = solvent.length === 1 ? solvent[0] : undefined;
  if (winner) {
    return setPhase(log(state, `¡${winner.name} se queda con todo el campo!`), { type: "gameOver", winnerId: winner.id });
  }
  let index = state.currentPlayerIndex;
  for (let i = 0; i < state.players.length; i++) {
    index = (index + 1) % state.players.length;
    if (!state.players[index]?.bankrupt) break;
  }
  const current = currentPlayer(state);
  let next = updatePlayer(state, current.id, { doublesThisTurn: 0, bankIncomeThisTurn: 0 });
  next = { ...next, currentPlayerIndex: index, turn: state.turn + 1, lastCard: null, rollAgain: false };
  const nextPlayer = updatePlayer(next, currentPlayer(next).id, { bankIncomeThisTurn: 0 });
  return setPhase(nextPlayer, currentPlayer(nextPlayer).inJail ? { type: "awaitingJailDecision" } : { type: "awaitingRoll" });
}

// ---------- auctions ----------

function startAuction(state: GameState, deedId: DeedId): GameState {
  const current = currentPlayer(state);
  const solvent = solventPlayers(state);
  const startIndex = solvent.findIndex((p) => p.id === current.id);
  // Bidding starts with the player after the one on turn and goes around.
  const order = solvent.map((_, i) => solvent[(startIndex + 1 + i) % solvent.length]).filter((p): p is Player => p !== undefined);
  const first = order[0];
  if (!first) throw new Error("No hay nadie para rematar");
  const auction: Auction = { deedId, highestBid: 0, highestBidderId: null, bidders: order.map((p) => p.id), turnBidderId: first.id };
  const next = log(state, `Remate de ${deedName(getDeed(deedId))}. Empieza ${first.name}.`);
  return setPhase(next, { type: "auction", auction });
}

/** Next bidder after `afterId` who is not already the highest bidder, or null if nobody is left to outbid. */
function nextBidder(auction: Auction, afterId: string): string | null {
  const { bidders, highestBidderId } = auction;
  const start = bidders.indexOf(afterId);
  for (let i = 1; i <= bidders.length; i++) {
    const candidate = bidders[(start + i) % bidders.length];
    if (candidate !== undefined && candidate !== highestBidderId) return candidate;
  }
  return null;
}

function finishAuction(state: GameState, auction: Auction): GameState {
  const deed = getDeed(auction.deedId);
  let next: GameState = setPhase(state, { type: "turnEnd" });
  if (auction.highestBidderId === null) {
    next = log(next, `Nadie ofertó por ${deedName(deed)}; queda en el Banco.`);
    return continueTurn(next);
  }
  const winner = getPlayer(next, auction.highestBidderId);
  next = updatePlayer(next, winner.id, { cash: winner.cash - auction.highestBid });
  next = setHolding(next, auction.deedId, { ownerId: winner.id, chacras: 0, estancia: false, mortgaged: false });
  next = log(next, `${winner.name} se lleva ${deedName(deed)} en el remate por ${pesos(auction.highestBid)}.`, winner.id);
  return continueTurn(next);
}

function advanceAuction(state: GameState, auction: Auction, afterId: string): GameState {
  const next = nextBidder(auction, afterId);
  if (next === null) return finishAuction(state, auction);
  return setPhase(state, { type: "auction", auction: { ...auction, turnBidderId: next } });
}

/** The bidder on turn raises the price to `amount`. */
export function bid(state: GameState, amount: number): GameState {
  const { auction } = expectPhase(state, "auction");
  const bidder = getPlayer(state, auction.turnBidderId);
  if (!Number.isInteger(amount)) throw new Error("La oferta tiene que ser un número entero");
  if (amount < auction.highestBid + MIN_BID_INCREMENT) throw new Error(`La oferta mínima es ${pesos(auction.highestBid + MIN_BID_INCREMENT)}`);
  if (amount > bidder.cash) throw new Error("No te alcanza la plata para esa oferta");
  const next = log(state, `${bidder.name} ofrece ${pesos(amount)} por ${deedName(getDeed(auction.deedId))}.`, bidder.id);
  return advanceAuction(next, { ...auction, highestBid: amount, highestBidderId: bidder.id }, bidder.id);
}

/** The bidder on turn drops out of the auction. */
export function passBid(state: GameState): GameState {
  const { auction } = expectPhase(state, "auction");
  const bidder = getPlayer(state, auction.turnBidderId);
  const remaining = auction.bidders.filter((id) => id !== bidder.id);
  const next = log(state, `${bidder.name} pasa.`, bidder.id);
  const updated: Auction = { ...auction, bidders: remaining };
  if (remaining.length === 0) return finishAuction(next, updated);
  // Keep `afterId` as the leaver so the rotation continues from their old slot.
  const nextId = nextBidderAfterLeaving(updated, auction.bidders, bidder.id);
  if (nextId === null) return finishAuction(next, updated);
  return setPhase(next, { type: "auction", auction: { ...updated, turnBidderId: nextId } });
}

function nextBidderAfterLeaving(auction: Auction, previousOrder: readonly string[], leaverId: string): string | null {
  const start = previousOrder.indexOf(leaverId);
  for (let i = 1; i <= previousOrder.length; i++) {
    const candidate = previousOrder[(start + i) % previousOrder.length];
    if (candidate !== undefined && candidate !== leaverId && auction.bidders.includes(candidate) && candidate !== auction.highestBidderId) return candidate;
  }
  return null;
}

// ---------- building & mortgages (own turn, or while settling a debt) ----------

function actor(state: GameState): Player {
  if (state.phase.type === "gameOver") throw new Error("La partida terminó");
  if (state.phase.type === "auction") throw new Error("No durante el remate");
  return activePlayer(state);
}

export function buildChacra(state: GameState, deedId: DeedId): GameState {
  const player = actor(state);
  const check = canBuildChacra(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  let next = updatePlayer(state, player.id, { cash: player.cash - deed.chacraCost });
  next = setHolding(next, deedId, { ...holding, chacras: holding.chacras + 1 });
  next = { ...next, bank: { ...next.bank, chacras: next.bank.chacras - 1 } };
  return log(next, `${player.name} construye una chacra en ${deedName(deed)} (${pesos(deed.chacraCost)}).`, player.id);
}

export function buildEstancia(state: GameState, deedId: DeedId): GameState {
  const player = actor(state);
  const check = canBuildEstancia(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  let next = updatePlayer(state, player.id, { cash: player.cash - deed.estanciaCost });
  next = setHolding(next, deedId, { ...holding, chacras: 0, estancia: true });
  next = { ...next, bank: { chacras: next.bank.chacras + MAX_CHACRAS_PER_CAMPO, estancias: next.bank.estancias - 1 } };
  return log(next, `${player.name} levanta una estancia en ${deedName(deed)} (${pesos(deed.estanciaCost)}).`, player.id);
}

export function sellBuilding(state: GameState, deedId: DeedId): GameState {
  const player = actor(state);
  const check = canSellBuilding(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  const value = sellValue(deed, holding);
  let next = updatePlayer(state, player.id, { cash: player.cash + value });
  if (holding.estancia) {
    next = setHolding(next, deedId, { ...holding, estancia: false, chacras: MAX_CHACRAS_PER_CAMPO });
    next = { ...next, bank: { chacras: next.bank.chacras - MAX_CHACRAS_PER_CAMPO, estancias: next.bank.estancias + 1 } };
    return log(next, `${player.name} vende la estancia de ${deedName(deed)} al Banco por ${pesos(value)}.`, player.id);
  }
  next = setHolding(next, deedId, { ...holding, chacras: holding.chacras - 1 });
  next = { ...next, bank: { ...next.bank, chacras: next.bank.chacras + 1 } };
  return log(next, `${player.name} vende una chacra de ${deedName(deed)} al Banco por ${pesos(value)}.`, player.id);
}

export function mortgage(state: GameState, deedId: DeedId): GameState {
  const player = actor(state);
  const check = canMortgage(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const holding = state.holdings[deedId];
  if (!holding) throw new Error("unreachable");
  const proceeds = mortgageProceeds(deedId);
  let next = updatePlayer(state, player.id, { cash: player.cash + proceeds });
  next = setHolding(next, deedId, { ...holding, mortgaged: true });
  return log(next, `${player.name} hipoteca ${deedName(getDeed(deedId))} y recibe ${pesos(proceeds)}.`, player.id);
}

export function unmortgage(state: GameState, deedId: DeedId): GameState {
  const player = actor(state);
  const check = canUnmortgage(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const holding = state.holdings[deedId];
  if (!holding) throw new Error("unreachable");
  const cost = unmortgageCost(deedId);
  let next = updatePlayer(state, player.id, { cash: player.cash - cost });
  next = setHolding(next, deedId, { ...holding, mortgaged: false });
  return log(next, `${player.name} levanta la hipoteca de ${deedName(getDeed(deedId))} por ${pesos(cost)}.`, player.id);
}

// ---------- debts ----------

/** Pays the pending debt once the debtor has raised enough cash. */
export function settlePayment(state: GameState): GameState {
  const { debtorId, amount, to, reason } = expectPhase(state, "awaitingPayment");
  const debtor = getPlayer(state, debtorId);
  if (debtor.cash < amount) throw new Error(`Todavía te faltan ${pesos(amount - debtor.cash)}`);
  let next = transfer(state, debtorId, amount, to, reason);
  next = { ...next, pendingDebts: next.pendingDebts.slice(1) };
  return continueTurn(next);
}

/**
 * The debtor gives up: everything goes to the creditor, or back to the bank
 * (which then auctions the deeds). Only allowed once there is nothing left
 * to sell or mortgage.
 */
export function declareBankruptcy(state: GameState): GameState {
  const { debtorId, to, amount } = expectPhase(state, "awaitingPayment");
  const player = getPlayer(state, debtorId);
  if (player.cash >= amount) throw new Error("Te alcanza para pagar");
  if (canRaiseCash(state, player.id)) throw new Error("Todavía podés vender o hipotecar");

  let next = state;
  let cashToCreditor = player.cash;
  const holdings = { ...state.holdings };
  const toBank: DeedId[] = [];
  let { chacras, estancias } = state.bank;
  for (const [id, holding] of Object.entries(state.holdings) as [DeedId, Holding][]) {
    if (holding.ownerId !== player.id) continue;
    const deed = getDeed(id);
    if (deed.kind === "campo") {
      // Buildings are sold back to the bank at half price; the cash goes to the creditor.
      cashToCreditor += holding.estancia ? (deed.estanciaCost + MAX_CHACRAS_PER_CAMPO * deed.chacraCost) / 2 : (holding.chacras * deed.chacraCost) / 2;
      if (holding.estancia) estancias += 1;
      else chacras += holding.chacras;
    }
    if (to.type === "player") holdings[id] = { ownerId: to.playerId, chacras: 0, estancia: false, mortgaged: holding.mortgaged };
    else {
      delete holdings[id];
      toBank.push(id);
    }
  }
  next = { ...next, holdings, bank: { chacras, estancias } };
  next = updatePlayer(next, player.id, { cash: 0, bankrupt: true, getOutOfJailCards: 0 });
  if (to.type === "player") {
    const creditor = getPlayer(next, to.playerId);
    next = updatePlayer(next, to.playerId, {
      cash: creditor.cash + cashToCreditor,
      getOutOfJailCards: creditor.getOutOfJailCards + player.getOutOfJailCards,
    });
  }
  next = log(next, `${player.name} quiebra. Sus propiedades pasan a ${creditorName(state, to)}.`, player.id);
  // A bankrupt player's other debts die with them.
  next = { ...next, pendingDebts: next.pendingDebts.filter((d) => d.debtorId !== player.id) };
  if (toBank.length > 0) {
    next = log(next, `El Banco remata ${toBank.length} propiedad${toBank.length > 1 ? "es" : ""}.`, player.id);
    next = { ...next, pendingAuctions: [...next.pendingAuctions, ...toBank] };
  }
  if (solventPlayers(next).length <= 1) return setPhase(next, { type: "turnEnd" });
  return continueTurn(next);
}

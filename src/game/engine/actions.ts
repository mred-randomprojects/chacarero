/**
 * Game actions. Every function takes a state and returns a new state; nothing
 * is mutated. Preconditions throw, so the UI should only offer actions the
 * current phase allows (see `availableActions` in ui.ts).
 */
import type { Card, Deck, DeedId, Square } from "../types";
import { ALL_CARDS } from "../cards";
import { JAIL_INDEX, getSquare, salidaCrossings } from "../board";
import { BOARD_SIZE, JAIL_BAIL, MAX_CHACRAS_PER_CAMPO, MAX_JAIL_TURNS, SALIDA_BONUS, DOUBLES_TO_JAIL } from "../constants";
import { deedName, getDeed } from "../deeds";
import { pesos } from "../describe";
import type { Creditor, GameState, Holding, MoveKind, Phase, Player } from "./state";
import { currentPlayer, getPlayer } from "./state";
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

// ---------- money ----------

/** Adds cash to a player (the bank pays). */
function credit(state: GameState, playerId: string, amount: number): GameState {
  const player = getPlayer(state, playerId);
  return updatePlayer(state, playerId, { cash: player.cash + amount });
}

/**
 * Makes the current player pay. If they cannot cover it, the game enters
 * `awaitingPayment` so they can sell or mortgage first (or go bankrupt).
 */
function charge(state: GameState, amount: number, to: Creditor, reason: string): GameState {
  const player = currentPlayer(state);
  if (amount <= 0) return state;
  if (player.cash < amount) {
    const next = log(state, `${player.name} no tiene ${pesos(amount)} para ${reason}; tiene que vender o hipotecar.`);
    return setPhase(next, { type: "awaitingPayment", amount, to, reason });
  }
  return transfer(state, player.id, amount, to, reason);
}

function transfer(state: GameState, fromId: string, amount: number, to: Creditor, reason: string): GameState {
  let next = updatePlayer(state, fromId, { cash: getPlayer(state, fromId).cash - amount });
  if (to.type === "player") next = credit(next, to.playerId, amount);
  return log(next, `${getPlayer(state, fromId).name} paga ${pesos(amount)} a ${creditorName(state, to)} (${reason}).`, fromId);
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
    next = credit(next, player.id, SALIDA_BONUS * crossings);
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

/** Decides what comes after the current move is fully resolved. */
function finishMove(state: GameState): GameState {
  const player = currentPlayer(state);
  if (player.bankrupt) return setPhase(state, { type: "turnEnd" });
  if (state.rollAgain && !player.inJail) return setPhase(state, { type: "awaitingRoll" });
  return setPhase(state, { type: "turnEnd" });
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
      return finishMove(log(state, `${player.name} cae en ${square.name}.`));
    case "marchePreso":
      return finishMove(sendToJail(state, "cayó en Marche preso"));
    case "impuesto":
      return finishMoveAfterCharge(charge(log(state, `${player.name} cae en ${square.name}.`), -square.amount, { type: "bank" }, square.name.toLowerCase()));
    case "premio": {
      let next = credit(state, player.id, square.amount);
      next = log(next, `${player.name} cae en ${square.name} y cobra ${pesos(square.amount)}.`);
      return finishMove(next);
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

/** After `charge`, continue the move unless we are now waiting for the player to raise cash. */
function finishMoveAfterCharge(state: GameState): GameState {
  return state.phase.type === "awaitingPayment" ? state : finishMove(state);
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
    return finishMove(log(state, `${player.name} cae en ${name}, que es suyo.`));
  }
  const owner = getPlayer(state, holding.ownerId);
  const rent = rentFor(state, deedId, player.id, diceTotal(state));
  if (rent === 0) {
    const why = holding.mortgaged ? "está hipotecada" : owner.inJail ? `${owner.name} está preso y no cobra` : "no corresponde alquiler";
    return finishMove(log(state, `${player.name} cae en ${name} de ${owner.name}: ${why}.`));
  }
  const next = log(state, `${player.name} cae en ${name} de ${owner.name}.`);
  return finishMoveAfterCharge(charge(next, rent, { type: "player", playerId: owner.id }, `alquiler de ${name}`));
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
      return finishMove(credit(state, player.id, effect.amount));
    case "pay":
      return finishMoveAfterCharge(charge(state, effect.amount, { type: "bank" }, "la tarjeta"));
    case "collectFromEachPlayer": {
      let next = state;
      for (const other of state.players) {
        if (other.id === player.id || other.bankrupt) continue;
        const paid = Math.min(other.cash, effect.amount);
        next = transfer(next, other.id, paid, { type: "player", playerId: player.id }, "regalo de cumpleaños");
      }
      return finishMove(next);
    }
    case "moveTo":
      return resolveLanding(moveTo(state, effect.square, effect.collectSalida, effect.direction));
    case "moveBy":
      return resolveLanding(moveBy(state, effect.steps));
    case "goToJail":
      return finishMove(sendToJail(state, "por la tarjeta"));
    case "getOutOfJail": {
      const next = updatePlayer(state, player.id, { getOutOfJailCards: player.getOutOfJailCards + 1 });
      return finishMove(log(next, `${player.name} se guarda la tarjeta para salir de la Comisaría.`));
    }
    case "payPerBuilding": {
      const { chacras, estancias } = buildingCount(state, player.id);
      const amount = chacras * effect.perChacra + estancias * effect.perEstancia;
      if (amount === 0) return finishMove(log(state, `${player.name} no tiene construcciones; no paga nada.`));
      return finishMoveAfterCharge(charge(state, amount, { type: "bank" }, `${chacras} chacras y ${estancias} estancias`));
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
      return setPhase(sendToJail(next, "tres dobles seguidos"), { type: "turnEnd" });
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
  return finishMove(next);
}

/** Leaves the deed with the bank. */
export function decline(state: GameState): GameState {
  const { deedId } = expectPhase(state, "awaitingBuyDecision");
  return finishMove(log(state, `${currentPlayer(state).name} no compra ${deedName(getDeed(deedId))}.`));
}

/** For "Pague $200 o levante una tarjeta de Suerte": pay. */
export function choosePay(state: GameState): GameState {
  const { amount } = expectPhase(state, "awaitingPayOrDraw");
  return finishMoveAfterCharge(charge(state, amount, { type: "bank" }, "la tarjeta"));
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
  const solvent = state.players.filter((p) => !p.bankrupt);
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
  let next = updatePlayer(state, current.id, { doublesThisTurn: 0 });
  next = { ...next, currentPlayerIndex: index, turn: state.turn + 1, lastCard: null, rollAgain: false };
  const nextPlayer = currentPlayer(next);
  return setPhase(next, nextPlayer.inJail ? { type: "awaitingJailDecision" } : { type: "awaitingRoll" });
}

// ---------- building & mortgages (allowed in the player's own turn, any phase but gameOver) ----------

function expectOwnTurnFreePhase(state: GameState): Player {
  if (state.phase.type === "gameOver") throw new Error("La partida terminó");
  return currentPlayer(state);
}

export function buildChacra(state: GameState, deedId: DeedId): GameState {
  const player = expectOwnTurnFreePhase(state);
  const check = canBuildChacra(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  let next = updatePlayer(state, player.id, { cash: player.cash - deed.chacraCost });
  next = setHolding(next, deedId, { ...holding, chacras: holding.chacras + 1 });
  next = { ...next, bank: { ...next.bank, chacras: next.bank.chacras - 1 } };
  return log(next, `${player.name} construye una chacra en ${deedName(deed)} (${pesos(deed.chacraCost)}).`);
}

export function buildEstancia(state: GameState, deedId: DeedId): GameState {
  const player = expectOwnTurnFreePhase(state);
  const check = canBuildEstancia(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  let next = updatePlayer(state, player.id, { cash: player.cash - deed.estanciaCost });
  next = setHolding(next, deedId, { ...holding, chacras: 0, estancia: true });
  next = { ...next, bank: { chacras: next.bank.chacras + MAX_CHACRAS_PER_CAMPO, estancias: next.bank.estancias - 1 } };
  return log(next, `${player.name} levanta una estancia en ${deedName(deed)} (${pesos(deed.estanciaCost)}).`);
}

export function sellBuilding(state: GameState, deedId: DeedId): GameState {
  const player = expectOwnTurnFreePhase(state);
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
    return log(next, `${player.name} vende la estancia de ${deedName(deed)} al Banco por ${pesos(value)}.`);
  }
  next = setHolding(next, deedId, { ...holding, chacras: holding.chacras - 1 });
  next = { ...next, bank: { ...next.bank, chacras: next.bank.chacras + 1 } };
  return log(next, `${player.name} vende una chacra de ${deedName(deed)} al Banco por ${pesos(value)}.`);
}

export function mortgage(state: GameState, deedId: DeedId): GameState {
  const player = expectOwnTurnFreePhase(state);
  const check = canMortgage(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const holding = state.holdings[deedId];
  if (!holding) throw new Error("unreachable");
  const proceeds = mortgageProceeds(deedId);
  let next = updatePlayer(state, player.id, { cash: player.cash + proceeds });
  next = setHolding(next, deedId, { ...holding, mortgaged: true });
  return log(next, `${player.name} hipoteca ${deedName(getDeed(deedId))} y recibe ${pesos(proceeds)}.`);
}

export function unmortgage(state: GameState, deedId: DeedId): GameState {
  const player = expectOwnTurnFreePhase(state);
  const check = canUnmortgage(state, player, deedId);
  if (!check.ok) throw new Error(check.reason);
  const holding = state.holdings[deedId];
  if (!holding) throw new Error("unreachable");
  const cost = unmortgageCost(deedId);
  let next = updatePlayer(state, player.id, { cash: player.cash - cost });
  next = setHolding(next, deedId, { ...holding, mortgaged: false });
  return log(next, `${player.name} levanta la hipoteca de ${deedName(getDeed(deedId))} por ${pesos(cost)}.`);
}

// ---------- debts ----------

/** Pays the pending debt once the player has raised enough cash. */
export function settlePayment(state: GameState): GameState {
  const { amount, to, reason } = expectPhase(state, "awaitingPayment");
  const player = currentPlayer(state);
  if (player.cash < amount) throw new Error(`Todavía te faltan ${pesos(amount - player.cash)}`);
  return finishMove(transfer(state, player.id, amount, to, reason));
}

/**
 * Gives up: everything goes to the creditor (or back to the bank). Only
 * allowed once there is nothing left to sell or mortgage.
 */
export function declareBankruptcy(state: GameState): GameState {
  const { to, amount } = expectPhase(state, "awaitingPayment");
  const player = currentPlayer(state);
  if (player.cash >= amount) throw new Error("Te alcanza para pagar");
  if (canRaiseCash(state, player.id)) throw new Error("Todavía podés vender o hipotecar");

  let next = state;
  let cashToCreditor = player.cash;
  const holdings = { ...state.holdings };
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
    else delete holdings[id];
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
  next = log(next, `${player.name} quiebra. Sus propiedades pasan a ${creditorName(state, to)}.`);
  return setPhase(next, { type: "turnEnd" });
}

/**
 * Game actions. Every function takes a state and returns a new state; nothing
 * is mutated. Preconditions throw, so the UI should only offer actions the
 * current phase allows.
 *
 * A turn is deliberately split into small steps the player triggers one by
 * one, like at a real table: roll the dice, move the pawn, read the card,
 * apply it. Between steps the game waits. After anything happens,
 * `continueTurn` settles pending debts first, then pending auctions, and
 * only then hands the dice back (or ends the turn).
 *
 * Every action also records `events` so the UI can replay what happened
 * with a banner and an animation per step.
 */
import type { Card, Deck, DeedId, Square } from "../types";
import { ALL_CARDS } from "../cards";
import { JAIL_INDEX, getSquare, salidaCrossings } from "../board";
import { BOARD_SIZE, JAIL_BAIL, MAX_CHACRAS_PER_CAMPO, MAX_JAIL_TURNS, SALIDA_BONUS, DOUBLES_TO_JAIL } from "../constants";
import { deedName, getDeed } from "../deeds";
import { describeOffer, pesos } from "../describe";
import type { Auction, Creditor, Debt, GameEvent, GameState, Holding, MoveKind, Party, Phase, Player, Trade, TradeOffer } from "./state";
import { activePlayer, currentPlayer, getPlayer } from "./state";
import {
  buildingCount,
  canBuildChacra,
  canBuildEstancia,
  canMortgage,
  canProposeTrade,
  canRaiseCash,
  canSellBuilding,
  canUnmortgage,
  checkTrade,
  mortgageProceeds,
  mortgageTransferFee,
  rentFor,
  sellValue,
  unmortgageCost,
} from "./rules";

export type Dice = readonly [number, number];

/** Smallest amount a bid must exceed the previous one by. */
export const MIN_BID_INCREMENT = 100;

const BANK: Party = { type: "bank" };
const CARDS_BY_ID: ReadonlyMap<string, Card> = new Map(ALL_CARDS.map((c) => [c.id, c]));

// ---------- small helpers ----------

function expectPhase<T extends Phase["type"]>(state: GameState, ...types: readonly T[]): Extract<Phase, { type: T }> {
  const phase = state.phase;
  if (!(types as readonly string[]).includes(phase.type)) {
    throw new Error(`Acción no permitida en la fase ${phase.type}`);
  }
  return phase as Extract<Phase, { type: T }>;
}

/** Records an event and its text in the log. */
function emit(state: GameState, event: GameEvent, playerId: string = currentPlayer(state).id): GameState {
  return {
    ...state,
    events: [...state.events, event],
    log: [...state.log, { turn: state.turn, playerId, text: event.text }],
  };
}

function log(state: GameState, text: string, playerId: string = currentPlayer(state).id): GameState {
  return emit(state, { type: "log", playerId, text }, playerId);
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

function partyName(state: GameState, party: Party): string {
  return party.type === "bank" ? "el Banco" : getPlayer(state, party.playerId).name;
}

/** "al Banco" / "a Beto". */
function toParty(state: GameState, party: Party): string {
  return party.type === "bank" ? "al Banco" : `a ${getPlayer(state, party.playerId).name}`;
}

function player(id: string): Party {
  return { type: "player", playerId: id };
}

function diceTotal(state: GameState): number {
  return state.dice ? state.dice[0] + state.dice[1] : 0;
}

function solventPlayers(state: GameState): readonly Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

/** Every public action starts here so `moves` and `events` only hold what this action did. */
function begin(state: GameState): GameState {
  return state.moves.length === 0 && state.events.length === 0 ? state : { ...state, moves: [], events: [] };
}

// ---------- money ----------

/** The bank pays a player. Tracked per turn so a third doubles can claw it back. */
function bankPays(state: GameState, playerId: string, amount: number, text: string): GameState {
  const target = getPlayer(state, playerId);
  const next = updatePlayer(state, playerId, { cash: target.cash + amount, bankIncomeThisTurn: target.bankIncomeThisTurn + amount });
  return emit(next, { type: "transfer", from: BANK, to: player(playerId), amount, text }, playerId);
}

function transfer(state: GameState, fromId: string, amount: number, to: Creditor, reason: string): GameState {
  const from = getPlayer(state, fromId);
  let next = updatePlayer(state, fromId, { cash: from.cash - amount });
  if (to.type === "player") {
    const creditor = getPlayer(next, to.playerId);
    next = updatePlayer(next, to.playerId, { cash: creditor.cash + amount });
  }
  const text = `${from.name} paga ${pesos(amount)} ${toParty(state, to)} (${reason}).`;
  return emit(next, { type: "transfer", from: player(fromId), to, amount, text }, fromId);
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

/**
 * Puts a payment on a player's account without moving the money: the game
 * stops at `awaitingPayment` so they pay it themselves (or raise the cash
 * first). Rent works this way — the table asks before the bills fly.
 */
function bill(state: GameState, debtorId: string, amount: number, to: Creditor, reason: string): GameState {
  if (amount <= 0) return state;
  const debt: Debt = { debtorId, amount, to, reason };
  return { ...state, pendingDebts: [...state.pendingDebts, debt] };
}

// ---------- turn flow ----------

/** Decides what comes after the current move is fully resolved. */
function finishMove(state: GameState): GameState {
  const current = currentPlayer(state);
  if (current.bankrupt) return setPhase(state, { type: "turnEnd" });
  if (state.rollAgain && !current.inJail) return setPhase(state, { type: "awaitingRoll" });
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

function setPosition(state: GameState, playerId: string, to: number, kind: MoveKind, text: string): GameState {
  const from = getPlayer(state, playerId).position;
  const next = updatePlayer(state, playerId, { position: to });
  const move = { playerId, from, to, kind };
  return emit({ ...next, lastMove: move, moves: [...next.moves, move] }, { type: "move", ...move, text }, playerId);
}

function moveBy(state: GameState, steps: number): GameState {
  const current = currentPlayer(state);
  const crossings = salidaCrossings(current.position, steps);
  const position = ((current.position + steps) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
  const square = getSquare(position);
  const verb = steps >= 0 ? "avanza" : "retrocede";
  let next = setPosition(state, current.id, position, steps >= 0 ? "forward" : "backward", `${current.name} ${verb} ${Math.abs(steps)} hasta ${square.name}.`);
  if (crossings > 0) {
    next = bankPays(next, current.id, SALIDA_BONUS * crossings, `${current.name} pasa por la Salida y cobra ${pesos(SALIDA_BONUS * crossings)}.`);
  }
  return next;
}

function moveTo(state: GameState, square: number, collectSalida: boolean, direction: MoveKind): GameState {
  const current = currentPlayer(state);
  const forward = (square - current.position + BOARD_SIZE) % BOARD_SIZE;
  if (collectSalida) return moveBy(state, forward);
  return setPosition(state, current.id, square, direction, `${current.name} va hasta ${getSquare(square).name}.`);
}

function sendToJail(state: GameState, why: string): GameState {
  const current = currentPlayer(state);
  let next = setPosition(state, current.id, JAIL_INDEX, "jump", `${current.name} marcha preso (${why}).`);
  next = updatePlayer(next, current.id, { inJail: true, jailTurns: 0, doublesThisTurn: 0 });
  next = emit(next, { type: "jail", playerId: current.id, text: `${current.name} queda preso en la Comisaría.` });
  return { ...next, rollAgain: false };
}

// ---------- landing ----------

function resolveLanding(state: GameState): GameState {
  const current = currentPlayer(state);
  const square: Square = getSquare(current.position);
  switch (square.kind) {
    case "salida":
    case "comisaria":
    case "descanso":
    case "libreEstacionamiento":
      return continueTurn(log(state, `${current.name} cae en ${square.name}.`));
    case "marchePreso":
      return continueTurn(sendToJail(state, "cayó en Marche preso"));
    case "impuesto":
      return continueTurn(charge(log(state, `${current.name} cae en ${square.name}.`), current.id, -square.amount, BANK, square.name.toLowerCase()));
    case "premio":
      return continueTurn(bankPays(state, current.id, square.amount, `${current.name} cae en ${square.name} y cobra ${pesos(square.amount)}.`));
    case "suerte":
    case "destino":
      return setPhase(log(state, `${current.name} cae en ${square.name}.`), { type: "awaitingDraw", deck: square.kind });
    case "campo":
    case "ferrocarril":
    case "compania":
      return resolveDeedLanding(state, square.deedId);
  }
}

function resolveDeedLanding(state: GameState, deedId: DeedId): GameState {
  const current = currentPlayer(state);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  const name = deedName(deed);
  if (!holding) {
    const next = log(state, `${current.name} cae en ${name}, que está libre.`);
    return setPhase(next, { type: "awaitingBuyDecision", deedId });
  }
  if (holding.ownerId === current.id) {
    return continueTurn(log(state, `${current.name} cae en ${name}, que es suyo.`));
  }
  const owner = getPlayer(state, holding.ownerId);
  const rent = rentFor(state, deedId, current.id, diceTotal(state));
  if (rent === 0) {
    const why = holding.mortgaged ? "está hipotecada" : owner.inJail ? `${owner.name} está preso y no cobra` : "no corresponde alquiler";
    return continueTurn(log(state, `${current.name} cae en ${name} de ${owner.name}: ${why}.`));
  }
  let next = log(state, `${current.name} cae en ${name} de ${owner.name}.`);
  let reason = `alquiler de ${name}`;
  if (deed.kind === "compania" && state.dice) {
    // Company rent depends on the dice that brought the visitor here, so spell it out.
    reason = `alquiler de ${name}: dados ${state.dice[0]}+${state.dice[1]} = ${diceTotal(state)} × ${rent / diceTotal(state)}`;
  }
  next = bill(next, current.id, rent, player(owner.id), reason);
  return continueTurn(next);
}

// ---------- cards ----------

/** Turns the top card face up and waits for the player to read it. */
function revealCard(state: GameState, deck: Deck): GameState {
  const ids = state.decks[deck];
  const [topId, ...rest] = ids;
  if (topId === undefined) throw new Error(`El mazo de ${deck} está vacío`);
  const card = CARDS_BY_ID.get(topId);
  if (!card) throw new Error(`Unknown card ${topId}`);
  const keep = card.effect.type === "getOutOfJail";
  const decks = { ...state.decks, [deck]: keep ? rest : [...rest, topId] };
  const current = currentPlayer(state);
  let next: GameState = { ...state, decks, lastCard: card };
  next = emit(next, { type: "card", playerId: current.id, deck, cardId: card.id, text: `${current.name} levanta ${deck === "suerte" ? "Suerte" : "Destino"}: "${card.text}"` });
  return setPhase(next, { type: "awaitingCardAck", card });
}

function applyCard(state: GameState, card: Card): GameState {
  const current = currentPlayer(state);
  const effect = card.effect;
  switch (effect.type) {
    case "collect":
      return continueTurn(bankPays(state, current.id, effect.amount, `${current.name} cobra ${pesos(effect.amount)} del Banco.`));
    case "pay":
      return continueTurn(charge(state, current.id, effect.amount, BANK, "la tarjeta"));
    case "collectFromEachPlayer": {
      let next = state;
      for (const other of state.players) {
        if (other.id === current.id || other.bankrupt) continue;
        next = charge(next, other.id, effect.amount, player(current.id), `el cumpleaños de ${current.name}`);
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
      const next = updatePlayer(state, current.id, { getOutOfJailCards: current.getOutOfJailCards + 1 });
      return continueTurn(log(next, `${current.name} se guarda la tarjeta para salir de la Comisaría.`));
    }
    case "payPerBuilding": {
      const { chacras, estancias } = buildingCount(state, current.id);
      const amount = chacras * effect.perChacra + estancias * effect.perEstancia;
      if (amount === 0) return continueTurn(log(state, `${current.name} no tiene construcciones; no paga nada.`));
      return continueTurn(charge(state, current.id, amount, BANK, `${chacras} chacras y ${estancias} estancias`));
    }
    case "payOrDraw":
      return setPhase(state, { type: "awaitingPayOrDraw", amount: effect.amount, deck: effect.deck });
  }
}

// ---------- public actions: the turn, step by step ----------

/**
 * Throws the dice. The pawn does not move yet: the player (or a countdown)
 * calls `movePawn` next, unless the roll itself settled things (staying in
 * jail, or a third doubles).
 */
export function rollDice(input: GameState, random: () => number = Math.random, forced?: Dice): GameState {
  const state = begin(input);
  const phase = expectPhase(state, "openingRoll", "awaitingRoll", "awaitingJailDecision");
  const dice: Dice = forced ?? [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
  const doubles = dice[0] === dice[1];
  const current = currentPlayer(state);
  let next: GameState = { ...state, dice, lastCard: null, rollAgain: false };
  if (phase.type === "openingRoll") return openingRoll(next, phase, dice);
  next = log(next, `${current.name} tira ${dice[0]} y ${dice[1]}${doubles ? " (¡doble!)" : ""}.`);

  if (phase.type === "awaitingJailDecision") {
    if (doubles) {
      next = updatePlayer(next, current.id, { inJail: false, jailTurns: 0 });
      next = log(next, `${current.name} saca doble y sale de la Comisaría.`);
      return setPhase(next, { type: "awaitingMove" });
    }
    const jailTurns = current.jailTurns + 1;
    if (jailTurns >= MAX_JAIL_TURNS) {
      next = updatePlayer(next, current.id, { inJail: false, jailTurns: 0 });
      next = log(next, `${current.name} cumplió ${MAX_JAIL_TURNS} turnos preso y sale.`);
      return setPhase(next, { type: "awaitingMove" });
    }
    next = updatePlayer(next, current.id, { jailTurns });
    return setPhase(log(next, `${current.name} sigue preso (${jailTurns}/${MAX_JAIL_TURNS}).`), { type: "turnEnd" });
  }

  if (doubles) {
    const doublesThisTurn = current.doublesThisTurn + 1;
    next = updatePlayer(next, current.id, { doublesThisTurn });
    if (doublesThisTurn >= DOUBLES_TO_JAIL) {
      next = sendToJail(next, "tres dobles seguidos");
      // Rulebook: everything collected from the bank this turn goes back.
      const owed = getPlayer(next, current.id).bankIncomeThisTurn;
      if (owed > 0) {
        next = log(next, `${current.name} tiene que devolver los ${pesos(owed)} que cobró del Banco en este turno.`);
        next = charge(next, current.id, owed, BANK, "devolución por tres dobles seguidos");
      }
      return continueTurn(next);
    }
    next = { ...next, rollAgain: true };
  }
  return setPhase(next, { type: "awaitingMove" });
}

/**
 * One throw of the opening round. When every contender has thrown, the
 * highest starts; a tie sends the tied players into another round.
 */
function openingRoll(state: GameState, phase: Extract<Phase, { type: "openingRoll" }>, dice: Dice): GameState {
  const current = currentPlayer(state);
  const total = dice[0] + dice[1];
  const rolls = { ...phase.rolls, [current.id]: total };
  let next = log(state, `${current.name} saca ${dice[0]} y ${dice[1]}: ${total}.`);
  const pending = phase.contenders.filter((id) => rolls[id] === undefined);
  const [nextId] = pending;
  if (nextId !== undefined) {
    next = { ...next, currentPlayerIndex: next.players.findIndex((p) => p.id === nextId) };
    return setPhase(next, { type: "openingRoll", contenders: phase.contenders, rolls });
  }
  const best = Math.max(...phase.contenders.map((id) => rolls[id] ?? 0));
  const winners = phase.contenders.filter((id) => rolls[id] === best);
  const [winnerId] = winners;
  if (winners.length > 1 || winnerId === undefined) {
    const names = winners.map((id) => getPlayer(next, id).name);
    next = log(next, `Empate en ${best} entre ${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}: tiran de nuevo.`);
    next = { ...next, currentPlayerIndex: next.players.findIndex((p) => p.id === winners[0]) };
    return setPhase(next, { type: "openingRoll", contenders: winners, rolls: {} });
  }
  const winner = getPlayer(next, winnerId);
  next = { ...next, currentPlayerIndex: next.players.findIndex((p) => p.id === winnerId) };
  next = emit(next, { type: "turn", playerId: winnerId, text: `¡Empieza ${winner.name} con ${best}!` }, winnerId);
  return setPhase(next, { type: "awaitingRoll" });
}

/** Walks the pawn as many squares as the dice show and resolves where it lands. */
export function movePawn(input: GameState): GameState {
  const state = begin(input);
  expectPhase(state, "awaitingMove");
  return resolveLanding(moveBy(state, diceTotal(state)));
}

/** Lifts the top card of the deck the pawn landed on. */
export function drawCard(input: GameState): GameState {
  const state = begin(input);
  const { deck } = expectPhase(state, "awaitingDraw");
  return revealCard(state, deck);
}

/** The player has read the face-up card; apply it. */
export function acknowledgeCard(input: GameState): GameState {
  const state = begin(input);
  const { card } = expectPhase(state, "awaitingCardAck");
  return applyCard(state, card);
}

/**
 * Convenience for tests and bots: roll, move and read any cards in one go,
 * exactly as if the player clicked through every step.
 */
export function roll(state: GameState, random: () => number = Math.random, forced?: Dice): GameState {
  let next = rollDice(state, random, forced);
  if (next.phase.type === "awaitingMove") next = movePawn(next);
  while (next.phase.type === "awaitingDraw" || next.phase.type === "awaitingCardAck") {
    next = next.phase.type === "awaitingDraw" ? drawCard(next) : acknowledgeCard(next);
  }
  return next;
}

/** Buys the deed the current player is standing on. */
export function buy(input: GameState): GameState {
  const state = begin(input);
  const { deedId } = expectPhase(state, "awaitingBuyDecision");
  const current = currentPlayer(state);
  const deed = getDeed(deedId);
  if (current.cash < deed.price) throw new Error("No te alcanza la plata");
  let next = transfer(state, current.id, deed.price, BANK, `compra de ${deedName(deed)}`);
  next = setHolding(next, deedId, { ownerId: current.id, chacras: 0, estancia: false, mortgaged: false });
  next = emit(next, { type: "deed", deedId, from: BANK, to: player(current.id), text: `${current.name} recibe la escritura de ${deedName(deed)}.` });
  return continueTurn(next);
}

/** Declines to buy: the bank auctions the deed to everyone, decliner included. */
export function decline(input: GameState): GameState {
  const state = begin(input);
  const { deedId } = expectPhase(state, "awaitingBuyDecision");
  const next = log(state, `${currentPlayer(state).name} no compra ${deedName(getDeed(deedId))}; sale a remate.`);
  return startAuction(next, deedId);
}

/** For "Pague $200 o levante una tarjeta de Suerte": pay. */
export function choosePay(input: GameState): GameState {
  const state = begin(input);
  const { amount } = expectPhase(state, "awaitingPayOrDraw");
  return continueTurn(charge(state, currentPlayer(state).id, amount, BANK, "la tarjeta"));
}

/** For "Pague $200 o levante una tarjeta de Suerte": draw instead. */
export function chooseDraw(input: GameState): GameState {
  const state = begin(input);
  const { deck } = expectPhase(state, "awaitingPayOrDraw");
  return revealCard(state, deck);
}

export function payBail(input: GameState): GameState {
  const state = begin(input);
  expectPhase(state, "awaitingJailDecision");
  const current = currentPlayer(state);
  if (current.cash < JAIL_BAIL) throw new Error("No te alcanza para la fianza");
  let next = transfer(state, current.id, JAIL_BAIL, BANK, "fianza");
  next = updatePlayer(next, current.id, { inJail: false, jailTurns: 0 });
  return setPhase(next, { type: "awaitingRoll" });
}

export function spendJailCard(input: GameState): GameState {
  const state = begin(input);
  expectPhase(state, "awaitingJailDecision");
  const current = currentPlayer(state);
  if (current.getOutOfJailCards <= 0) throw new Error("No tenés tarjeta");
  // The card goes back to the bottom of the Suerte deck; both decks' cards are interchangeable.
  const cardId = ALL_CARDS.find((c) => c.effect.type === "getOutOfJail" && !state.decks.suerte.includes(c.id) && !state.decks.destino.includes(c.id))?.id;
  const decks = cardId ? { ...state.decks, suerte: [...state.decks.suerte, cardId] } : state.decks;
  let next: GameState = { ...state, decks };
  next = updatePlayer(next, current.id, { inJail: false, jailTurns: 0, getOutOfJailCards: current.getOutOfJailCards - 1 });
  next = log(next, `${current.name} usa su tarjeta y sale de la Comisaría.`);
  return setPhase(next, { type: "awaitingRoll" });
}

/** Ends the turn and hands the dice to the next solvent player. */
export function endTurn(input: GameState): GameState {
  const state = begin(input);
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
  const upcoming = currentPlayer(next);
  next = updatePlayer(next, upcoming.id, { bankIncomeThisTurn: 0 });
  next = emit(next, { type: "turn", playerId: upcoming.id, text: `Turno de ${upcoming.name}.` }, upcoming.id);
  return setPhase(next, upcoming.inJail ? { type: "awaitingJailDecision" } : { type: "awaitingRoll" });
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
  next = transfer(next, winner.id, auction.highestBid, BANK, `remate de ${deedName(deed)}`);
  next = setHolding(next, auction.deedId, { ownerId: winner.id, chacras: 0, estancia: false, mortgaged: false });
  next = emit(next, { type: "deed", deedId: auction.deedId, from: BANK, to: player(winner.id), text: `${winner.name} se lleva ${deedName(deed)} en el remate por ${pesos(auction.highestBid)}.` }, winner.id);
  return continueTurn(next);
}

function advanceAuction(state: GameState, auction: Auction, afterId: string): GameState {
  const next = nextBidder(auction, afterId);
  if (next === null) return finishAuction(state, auction);
  return setPhase(state, { type: "auction", auction: { ...auction, turnBidderId: next } });
}

/** The bidder on turn raises the price to `amount`. */
export function bid(input: GameState, amount: number): GameState {
  const state = begin(input);
  const { auction } = expectPhase(state, "auction");
  const bidder = getPlayer(state, auction.turnBidderId);
  if (!Number.isInteger(amount)) throw new Error("La oferta tiene que ser un número entero");
  if (amount < auction.highestBid + MIN_BID_INCREMENT) throw new Error(`La oferta mínima es ${pesos(auction.highestBid + MIN_BID_INCREMENT)}`);
  if (amount > bidder.cash) throw new Error("No te alcanza la plata para esa oferta");
  const next = log(state, `${bidder.name} ofrece ${pesos(amount)} por ${deedName(getDeed(auction.deedId))}.`, bidder.id);
  return advanceAuction(next, { ...auction, highestBid: amount, highestBidderId: bidder.id }, bidder.id);
}

/** The bidder on turn drops out of the auction. */
export function passBid(input: GameState): GameState {
  const state = begin(input);
  const { auction } = expectPhase(state, "auction");
  const bidder = getPlayer(state, auction.turnBidderId);
  const remaining = auction.bidders.filter((id) => id !== bidder.id);
  const next = log(state, `${bidder.name} pasa.`, bidder.id);
  const updated: Auction = { ...auction, bidders: remaining };
  if (remaining.length === 0) return finishAuction(next, updated);
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
  if (state.phase.type === "awaitingTradeResponse") throw new Error("Hay un canje pendiente");
  return activePlayer(state);
}

export function buildChacra(input: GameState, deedId: DeedId): GameState {
  const state = begin(input);
  const who = actor(state);
  const check = canBuildChacra(state, who, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  let next = transfer(state, who.id, deed.chacraCost, BANK, `una chacra en ${deedName(deed)}`);
  next = setHolding(next, deedId, { ...holding, chacras: holding.chacras + 1 });
  return emit(next, { type: "building", deedId, chacras: holding.chacras + 1, estancia: false, text: `${who.name} construye una chacra en ${deedName(deed)}.` }, who.id);
}

export function buildEstancia(input: GameState, deedId: DeedId): GameState {
  const state = begin(input);
  const who = actor(state);
  const check = canBuildEstancia(state, who, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  let next = transfer(state, who.id, deed.estanciaCost, BANK, `la estancia de ${deedName(deed)}`);
  next = setHolding(next, deedId, { ...holding, chacras: 0, estancia: true });
  return emit(next, { type: "building", deedId, chacras: 0, estancia: true, text: `${who.name} levanta una estancia en ${deedName(deed)}.` }, who.id);
}

export function sellBuilding(input: GameState, deedId: DeedId): GameState {
  const state = begin(input);
  const who = actor(state);
  const check = canSellBuilding(state, who, deedId);
  if (!check.ok) throw new Error(check.reason);
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  if (deed.kind !== "campo" || !holding) throw new Error("unreachable");
  const value = sellValue(deed, holding);
  let next: GameState;
  if (holding.estancia) {
    next = setHolding(state, deedId, { ...holding, estancia: false, chacras: MAX_CHACRAS_PER_CAMPO });
    next = emit(next, { type: "building", deedId, chacras: MAX_CHACRAS_PER_CAMPO, estancia: false, text: `${who.name} vende la estancia de ${deedName(deed)} al Banco.` }, who.id);
  } else {
    next = setHolding(state, deedId, { ...holding, chacras: holding.chacras - 1 });
    next = emit(next, { type: "building", deedId, chacras: holding.chacras - 1, estancia: false, text: `${who.name} vende una chacra de ${deedName(deed)} al Banco.` }, who.id);
  }
  return bankPays(next, who.id, value, `El Banco le paga ${pesos(value)} a ${who.name}.`);
}

export function mortgage(input: GameState, deedId: DeedId): GameState {
  const state = begin(input);
  const who = actor(state);
  const check = canMortgage(state, who, deedId);
  if (!check.ok) throw new Error(check.reason);
  const holding = state.holdings[deedId];
  if (!holding) throw new Error("unreachable");
  const proceeds = mortgageProceeds(deedId);
  let next = setHolding(state, deedId, { ...holding, mortgaged: true });
  next = emit(next, { type: "mortgage", deedId, mortgaged: true, text: `${who.name} hipoteca ${deedName(getDeed(deedId))}.` }, who.id);
  return bankPays(next, who.id, proceeds, `El Banco le presta ${pesos(proceeds)} a ${who.name}.`);
}

export function unmortgage(input: GameState, deedId: DeedId): GameState {
  const state = begin(input);
  const who = actor(state);
  const check = canUnmortgage(state, who, deedId);
  if (!check.ok) throw new Error(check.reason);
  const holding = state.holdings[deedId];
  if (!holding) throw new Error("unreachable");
  const cost = unmortgageCost(deedId);
  let next = transfer(state, who.id, cost, BANK, `levantar la hipoteca de ${deedName(getDeed(deedId))}`);
  next = setHolding(next, deedId, { ...holding, mortgaged: false });
  return emit(next, { type: "mortgage", deedId, mortgaged: false, text: `${deedName(getDeed(deedId))} vuelve a estar libre de hipoteca.` }, who.id);
}

// ---------- trades ----------

/**
 * Puts a trade on the table. Only the player who must act right now may
 * propose (their own turn, or while settling a debt); the game pauses until
 * the other player accepts, rejects or counters, then picks up where it was.
 */
export function proposeTrade(input: GameState, toId: string, gives: TradeOffer, receives: TradeOffer): GameState {
  const state = begin(input);
  const from = actor(state);
  if (!canProposeTrade(state)) throw new Error("Terminá la jugada antes de proponer un canje");
  const trade: Trade = { fromId: from.id, toId, gives, receives };
  const check = checkTrade(state, trade);
  if (!check.ok) throw new Error(check.reason);
  const to = getPlayer(state, toId);
  const next = log(state, `${from.name} le propone un canje a ${to.name}: da ${describeOffer(gives)} a cambio de ${describeOffer(receives)}.`, from.id);
  return setPhase(next, { type: "awaitingTradeResponse", trade, resume: state.phase });
}

/** Moves deeds from one player to another; the receiver pays the bank's fee on mortgaged ones. */
function handOver(state: GameState, deeds: readonly DeedId[], giver: Player, receiver: Player): GameState {
  let next = state;
  for (const deedId of deeds) {
    const holding = next.holdings[deedId];
    if (!holding) throw new Error("unreachable");
    const name = deedName(getDeed(deedId));
    next = setHolding(next, deedId, { ...holding, ownerId: receiver.id });
    next = emit(next, { type: "deed", deedId, from: player(giver.id), to: player(receiver.id), text: `${name} pasa de ${giver.name} a ${receiver.name}.` }, receiver.id);
    if (holding.mortgaged) next = transfer(next, receiver.id, mortgageTransferFee(deedId), BANK, `10 % por recibir ${name} hipotecada`);
  }
  return next;
}

/** The other player takes the deal: cash and deeds cross the table, then the game resumes. */
export function acceptTrade(input: GameState): GameState {
  const state = begin(input);
  const { trade, resume } = expectPhase(state, "awaitingTradeResponse");
  const check = checkTrade(state, trade);
  if (!check.ok) throw new Error(check.reason);
  const from = getPlayer(state, trade.fromId);
  const to = getPlayer(state, trade.toId);
  let next = log(state, `${to.name} acepta el canje.`, to.id);
  if (trade.gives.cash > 0) next = transfer(next, from.id, trade.gives.cash, player(to.id), "canje");
  if (trade.receives.cash > 0) next = transfer(next, to.id, trade.receives.cash, player(from.id), "canje");
  next = handOver(next, trade.gives.deeds, from, to);
  next = handOver(next, trade.receives.deeds, to, from);
  return setPhase(next, resume);
}

export function rejectTrade(input: GameState): GameState {
  const state = begin(input);
  const { trade, resume } = expectPhase(state, "awaitingTradeResponse");
  const to = getPlayer(state, trade.toId);
  return setPhase(log(state, `${to.name} rechaza el canje.`, to.id), resume);
}

/** The proposer takes the offer back. */
export function cancelTrade(input: GameState): GameState {
  const state = begin(input);
  const { trade, resume } = expectPhase(state, "awaitingTradeResponse");
  const from = getPlayer(state, trade.fromId);
  return setPhase(log(state, `${from.name} retira el canje.`, from.id), resume);
}

/** The other player answers with a different deal; roles swap and the proposer now has to answer. */
export function counterTrade(input: GameState, gives: TradeOffer, receives: TradeOffer): GameState {
  const state = begin(input);
  const { trade, resume } = expectPhase(state, "awaitingTradeResponse");
  const counter: Trade = { fromId: trade.toId, toId: trade.fromId, gives, receives };
  const check = checkTrade(state, counter);
  if (!check.ok) throw new Error(check.reason);
  const from = getPlayer(state, counter.fromId);
  const next = log(state, `${from.name} contraoferta: da ${describeOffer(gives)} a cambio de ${describeOffer(receives)}.`, from.id);
  return setPhase(next, { type: "awaitingTradeResponse", trade: counter, resume });
}

// ---------- debts ----------

/** Pays the pending debt once the debtor has raised enough cash. */
export function settlePayment(input: GameState): GameState {
  const state = begin(input);
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
export function declareBankruptcy(input: GameState): GameState {
  const state = begin(input);
  const { debtorId, to, amount } = expectPhase(state, "awaitingPayment");
  const debtor = getPlayer(state, debtorId);
  if (debtor.cash >= amount) throw new Error("Te alcanza para pagar");
  if (canRaiseCash(state, debtor.id)) throw new Error("Todavía podés vender o hipotecar");

  let next = emit(state, { type: "bankrupt", playerId: debtor.id, text: `${debtor.name} quiebra. Sus propiedades pasan a ${partyName(state, to)}.` }, debtor.id);
  let cashToCreditor = debtor.cash;
  const toBank: DeedId[] = [];
  for (const [id, holding] of Object.entries(state.holdings) as [DeedId, Holding][]) {
    if (holding.ownerId !== debtor.id) continue;
    const deed = getDeed(id);
    if (deed.kind === "campo" && (holding.estancia || holding.chacras > 0)) {
      // Buildings are sold back to the bank at half price; the cash goes to the creditor.
      cashToCreditor += holding.estancia ? (deed.estanciaCost + MAX_CHACRAS_PER_CAMPO * deed.chacraCost) / 2 : (holding.chacras * deed.chacraCost) / 2;
      next = setHolding(next, id, { ...holding, chacras: 0, estancia: false });
      next = emit(next, { type: "building", deedId: id, chacras: 0, estancia: false, text: `Las construcciones de ${deedName(deed)} vuelven al Banco.` }, debtor.id);
    }
    if (to.type === "player") {
      next = setHolding(next, id, { ownerId: to.playerId, chacras: 0, estancia: false, mortgaged: holding.mortgaged });
      next = emit(next, { type: "deed", deedId: id, from: player(debtor.id), to, text: `${deedName(deed)} pasa a ${partyName(state, to)}.` }, debtor.id);
    } else {
      next = setHolding(next, id, undefined);
      toBank.push(id);
      next = emit(next, { type: "deed", deedId: id, from: player(debtor.id), to: BANK, text: `${deedName(deed)} vuelve al Banco.` }, debtor.id);
    }
  }
  next = updatePlayer(next, debtor.id, { cash: 0, bankrupt: true, getOutOfJailCards: 0 });
  if (cashToCreditor > 0) {
    if (to.type === "player") {
      const creditor = getPlayer(next, to.playerId);
      next = updatePlayer(next, to.playerId, { cash: creditor.cash + cashToCreditor });
    }
    next = emit(next, { type: "transfer", from: player(debtor.id), to, amount: cashToCreditor, text: `${partyName(state, to)} se queda con los ${pesos(cashToCreditor)} de ${debtor.name}.` }, debtor.id);
  }
  if (to.type === "player" && debtor.getOutOfJailCards > 0) {
    const creditor = getPlayer(next, to.playerId);
    next = updatePlayer(next, to.playerId, { getOutOfJailCards: creditor.getOutOfJailCards + debtor.getOutOfJailCards });
  }
  // A bankrupt player's other debts die with them.
  next = { ...next, pendingDebts: next.pendingDebts.filter((d) => d.debtorId !== debtor.id) };
  if (toBank.length > 0) {
    next = log(next, `El Banco remata ${toBank.length} propiedad${toBank.length > 1 ? "es" : ""}.`, debtor.id);
    next = { ...next, pendingAuctions: [...next.pendingAuctions, ...toBank] };
  }
  if (solventPlayers(next).length <= 1) return setPhase(next, { type: "turnEnd" });
  return continueTurn(next);
}

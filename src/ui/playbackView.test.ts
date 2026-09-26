import { describe, expect, it } from "vitest";
import type { GameState, NewPlayer } from "../game";
import { acknowledgeCard, buy, createGame, decline, drawCard, movePawn, proposeTrade, rejectTrade, rollDice } from "../game";
import type { ViewState } from "./playbackView";
import { applyEvent, beginReplay, viewOf } from "./playbackView";

const players: readonly NewPlayer[] = [
  { id: "ana", name: "Ana", token: "tractor" },
  { id: "beto", name: "Beto", token: "vaca" },
];

function game(): GameState {
  return createGame({ players, openingRoll: false, random: () => 0.5 });
}

/** Replays `after` over `view` step by step, returning the view after each event and at the end. */
function replay(view: ViewState, after: GameState): { steps: ViewState[]; end: ViewState } {
  let current = beginReplay(view, after);
  const steps: ViewState[] = [current];
  for (const event of after.events) {
    current = applyEvent(current, event, after);
    steps.push(current);
  }
  return { steps, end: viewOf(after) };
}

describe("playback view: step by step", () => {
  it("hands the turn to the next player only once the replay is over", () => {
    let state = createGame({ players, random: () => 0.5 });
    expect(state.phase.type).toBe("openingRoll");
    const thrown = rollDice(state, undefined, [2, 1]);
    expect(thrown.currentPlayerIndex).toBe(1);
    const { steps, end } = replay(viewOf(state), thrown);
    for (const step of steps) expect(step.currentPlayerId).toBe("ana");
    expect(end.currentPlayerId).toBe("beto");
    state = thrown;
  });

  it("moves a pawn only when its move event is applied, never when the state arrives", () => {
    const rolled = rollDice(game(), undefined, [1, 2]);
    const landed = movePawn(rolled);
    expect(landed.players[0]?.position).toBe(3);
    const { steps, end } = replay(viewOf(rolled), landed);
    // Before the move event: still on the Tranquera. After it: on the square. The banner after does not move it again.
    expect(steps[0]?.positions["ana"]).toBe(0);
    expect(steps[1]?.positions["ana"]).toBe(3);
    expect(steps[2]?.positions["ana"]).toBe(3);
    expect(end.positions["ana"]).toBe(3);
    expect(end.positions["beto"]).toBe(0);
  });

  it("lifts a free deed only once the pawn has arrived and the replay is over", () => {
    const rolled = rollDice(game(), undefined, [1, 2]);
    const landed = movePawn(rolled); // 3: Purmamarca, free
    expect(landed.phase).toEqual({ type: "awaitingBuyDecision", deedId: "purmamarca" });
    const { steps, end } = replay(viewOf(rolled), landed);
    // Not at the start of the replay, not after the move, not after the landing banner.
    for (const step of steps) expect(step.deedOnOffer).toBeNull();
    for (const step of steps) expect(step.phase.type).toBe("awaitingMove");
    // Only when the table has caught up.
    expect(end.deedOnOffer).toBe("purmamarca");
    expect(end.phase.type).toBe("awaitingBuyDecision");
  });

  it("drops the lifted deed the moment it is bought, and keeps it up while it is auctioned", () => {
    const landed = movePawn(rollDice(game(), undefined, [1, 2]));
    const offered = viewOf(landed);
    expect(offered.deedOnOffer).toBe("purmamarca");
    const bought = buy(landed);
    expect(beginReplay(offered, bought).deedOnOffer).toBeNull();
    const auctioned = decline(landed);
    const auction = replay(offered, auctioned);
    for (const step of auction.steps) expect(step.deedOnOffer).toBe("purmamarca");
    expect(auction.end.deedOnOffer).toBe("purmamarca");
  });

  it("keeps the deed up through a trade proposed during the decision, and after the answer", () => {
    let state = movePawn(rollDice(game(), undefined, [1, 2]));
    state = { ...state, holdings: { "cachi": { ownerId: "ana", chacras: 0, estancia: false, mortgaged: false } } };
    const offered = viewOf(state);
    const proposed = proposeTrade(state, "beto", { deeds: ["cachi"], cash: 0 }, { deeds: [], cash: 500 });
    const during = replay(offered, proposed);
    for (const step of during.steps) expect(step.deedOnOffer).toBe("purmamarca");
    expect(during.end.deedOnOffer).toBe("purmamarca");
    const resumed = replay(during.end, rejectTrade(proposed));
    expect(resumed.end.deedOnOffer).toBe("purmamarca");
    expect(resumed.end.phase.type).toBe("awaitingBuyDecision");
  });

  it("puts the card on the table when it is drawn, not before, and takes it down when it is applied", () => {
    let state: GameState = { ...game(), decks: { suerte: ["suerte-02"], yeta: [] } };
    state = movePawn(rollDice(state, undefined, [4, 6])); // 10: Suerte
    expect(state.phase).toEqual({ type: "awaitingDraw", deck: "suerte" });
    const walked = replay(viewOf(game()), state);
    for (const step of walked.steps) expect(step.cardOnTable).toBeNull();
    expect(walked.end.cardOnTable).toBeNull();
    const drawn = drawCard(state);
    const { steps, end } = replay(walked.end, drawn);
    expect(steps[0]?.cardOnTable).toBeNull();
    expect(steps.at(-1)?.cardOnTable?.id).toBe("suerte-02");
    expect(end.cardOnTable?.id).toBe("suerte-02");
    const applied = acknowledgeCard(drawn);
    expect(beginReplay(end, applied).cardOnTable).toBeNull();
  });

  it("moves cash and deeds only as their events play", () => {
    const landed = movePawn(rollDice(game(), undefined, [1, 2]));
    const bought = buy(landed);
    const { steps, end } = replay(viewOf(landed), bought);
    expect(steps[0]?.cash["ana"]).toBe(35_000);
    expect(steps[0]?.holdings["purmamarca"]).toBeUndefined();
    const afterTransfer = steps[1];
    expect(afterTransfer?.cash["ana"]).toBe(35_000 - 1_200);
    expect(afterTransfer?.holdings["purmamarca"]).toBeUndefined();
    expect(steps[2]?.holdings["purmamarca"]?.ownerId).toBe("ana");
    expect(end.holdings["purmamarca"]?.ownerId).toBe("ana");
  });
});

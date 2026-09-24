import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { soundsForTransition } from "./audio/gameSounds";
import { sfx } from "./audio/sfx";
import type { DeedId, GameState, TradeOffer } from "./game";
import { BOARD_SIZE, JAIL_INDEX, currentPlayer, getPlayer, getSquare } from "./game";
import { layoutIndexFor } from "./scene/buildingSpots";
import { boardToWorld } from "./scene/tileGeometry";
import type { PawnView, SeatView } from "./scene/Board";
import type { Anchors } from "./scene/anchors";
import { deedAnchor, moneyAnchor } from "./scene/anchors";
import { BOARD_LAYOUT, SLAB_MARGIN, TABLE_Y } from "./scene/Board";
import type { CameraView } from "./scene/cameraViews";
import { OVERVIEW, TOP_DOWN, backOffView, pawnView, seatView, squareView, viewsMatch } from "./scene/cameraViews";
import type { FlightStyle, FlightView } from "./scene/CameraRig";
import type { DiceThrow } from "./scene/Dice";
import { diceHurry } from "./scene/pawnKnocks";
import { cameraTracker } from "./scene/pawnTracker";
import { Scene } from "./scene/Scene";
import { seatSides } from "./scene/seats";
import { Vector3 } from "three";
import type { Session } from "./session/types";
import { ActionBar } from "./ui/ActionBar";
import { Banner } from "./ui/Banner";
import { CameraBar } from "./ui/CameraBar";
import { LogPanel } from "./ui/LogPanel";
import { MoneyFlights } from "./ui/MoneyFlights";
import { PlayerCards } from "./ui/PlayerCards";
import { Prompt } from "./ui/Prompt";
import { UI_KEYS, actionForKey } from "./ui/hotkeys";
import { Key } from "./ui/Key";
import { canAct, primaryAction, tradeProposer } from "./ui/perspective";
import type { BoardTab } from "./ui/BoardMap";
import { BoardMap } from "./ui/BoardMap";
import type { Settings } from "./ui/settings";
import { SettingsPanel } from "./ui/SettingsPanel";
import { SquarePanel } from "./ui/SquarePanel";
import { LiftedDeed } from "./ui/LiftedDeed";
import { TopBar } from "./ui/TopBar";
import type { TradeOutcomeView } from "./ui/TradeOutcome";
import { TradeOutcome } from "./ui/TradeOutcome";
import type { TradeDraft, TradeScreenMode } from "./ui/TradeScreen";
import { TradeScreen } from "./ui/TradeScreen";
import { usePlayback } from "./ui/usePlayback";

const ERROR_MS = 3_500;
/** Space/Enter pressed this soon after a prompt appears are taken as leftover banner-hurrying, not as the decision. */
const PROMPT_GRACE_MS = 400;

export interface GameScreenProps {
  readonly session: Session;
  readonly settings: Settings;
  readonly onSettings: (settings: Settings) => void;
  /** Whether this screen may restart after game over (host online; always locally). */
  readonly canRestart: boolean;
}

interface Flight {
  readonly id: number;
  readonly view: FlightView;
  readonly seconds?: number;
  readonly style?: FlightStyle;
}

/** The turn-to-turn flight: long enough to read as a swoop from one pawn to the next. */
const TURN_FLIGHT_SECONDS = 1.5;
/** When a Suerte/Destino card rises: at least this much further back, and far enough that a card
 * held `CARD_AHEAD` units in front of the camera (see Effects) floats above `CARD_CLEARANCE`. */
const CARD_BACK_OFF = 1.35;
const CARD_AHEAD = 9;
const CARD_CLEARANCE = 2.8;

/** The trade screen's contents; `id` remounts it so a fresh draft starts clean. Watching reads the live draft at render. */
interface OpenTrade {
  readonly id: number;
  readonly mode: Exclude<TradeScreenMode, { kind: "watch" }> | { readonly kind: "watch" };
}

const NO_OFFER: TradeOffer = { deeds: [], cash: 0 };

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
}

/** Inside a modal, or on a focused prompt button, the browser's own Space/Enter handling is the right one. */
function ownsSpace(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLElement && event.target.closest(".modal-backdrop, .prompt, .trade-screen") !== null;
}

/**
 * The table itself, for one session. Every state change (seq) arrives with
 * its events; a dice roll first flies the dice, then the events replay one
 * by one, and only then does the prompt for the next decision appear.
 */
export function GameScreen({ session, settings, onSettings, canRestart }: GameScreenProps) {
  const { game, you, seq, dispatch } = session;
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [throwing, setThrowing] = useState<DiceThrow | null>(null);
  /** The Catastro / map / list overlay, by tab; null when closed. */
  const [overlay, setOverlay] = useState<BoardTab | null>(null);
  const showList = overlay !== null;
  const [showSettings, setShowSettings] = useState(false);
  const [trade, setTrade] = useState<OpenTrade | null>(null);
  const [outcome, setOutcome] = useState<TradeOutcomeView | null>(null);
  const tradeCounter = useRef(0);
  const [goTo, setGoTo] = useState<Flight | null>(null);
  const goToCounter = useRef(0);
  /** The user took the camera (drag, wheel, a camera key); the director lets go until the next turn. */
  const [freeLook, setFreeLook] = useState(false);
  const playback = usePlayback(game, { bannerSeconds: settings.bannerSeconds });
  const { view, walk, enqueue, reset, hurry } = playback;
  const busy = playback.busy || throwing !== null;
  const previous = useRef<{ game: GameState; seq: number } | null>(null);
  const pendingReplay = useRef<GameState | null>(null);

  // Errors from the session (server refusals) and from here (toasts) share one banner.
  useEffect(() => {
    if (session.error) {
      setError(session.error);
      session.clearError();
    }
  }, [session]);

  useEffect(() => {
    if (!error) return;
    sfx.play("error", { volume: 0.6 });
    const id = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(id);
  }, [error]);

  const seats = useMemo<readonly SeatView[]>(() => {
    const sides = seatSides(game.players.length);
    return game.players.map((p, i) => ({
      playerId: p.id,
      side: sides[i] ?? 0,
      plate: {
        name: p.name,
        color: p.color,
        cash: view.cash[p.id] ?? p.cash,
        inJail: p.inJail,
        jailCards: p.getOutOfJailCards,
        bankrupt: p.bankrupt,
        isCurrent: p.id === view.currentPlayerId,
      },
    }));
  }, [game, view.cash, view.currentPlayerId]);

  const sideOf = useCallback((playerId: string) => seats.find((s) => s.playerId === playerId)?.side ?? 0, [seats]);
  const anchors = useMemo<Anchors>(() => ({ layout: BOARD_LAYOUT, slabMargin: SLAB_MARGIN, sides: new Map(seats.map((seat) => [seat.playerId, seat.side])), tableY: TABLE_Y }), [seats]);
  /** The player the table shows on turn: the real one only once the replay has caught up. */
  const shownPlayer = game.players.find((p) => p.id === view.currentPlayerId) ?? currentPlayer(game);
  const currentSide = sideOf(shownPlayer.id);
  const mySide = you ? sideOf(you) : currentSide;

  /** Where the last flight was sent, while nothing else has moved the camera since (a chase, the user). */
  const lastFlight = useRef<CameraView | null>(null);
  const flyTo = useCallback((cameraView: CameraView, seconds?: number, style?: FlightStyle) => {
    lastFlight.current = cameraView;
    goToCounter.current += 1;
    setGoTo({ id: goToCounter.current, view: cameraView, ...(seconds === undefined ? {} : { seconds }), ...(style === undefined ? {} : { style }) });
  }, []);
  /** Where the camera is right now (the rig writes it every frame). */
  const here = useCallback((): CameraView => ({ position: cameraTracker.position.toArray(), target: cameraTracker.target.toArray() }), []);
  /** Already there, or already on the way there: flying again would only restart the same flight with a hitch. */
  const heading = useCallback((target: CameraView) => viewsMatch(here(), target) || (lastFlight.current !== null && viewsMatch(lastFlight.current, target)), [here]);
  const takeCamera = useCallback(() => {
    lastFlight.current = null;
    setFreeLook(true);
  }, []);

  /**
   * A peek at a player's side of the table (their deeds and money): an
   * instant snap there, and the same key snaps back to where the camera was.
   * Not a flight, and not a hand-over: the play goes on from wherever it is —
   * and any flight the play makes ends the peek (its way back is stale).
   */
  const [peek, setPeek] = useState<{ readonly side: number; readonly back: CameraView } | null>(null);
  const peekSeat = useCallback(
    (side: number) => {
      if (peek && peek.side === side) {
        setPeek(null);
        flyTo(peek.back, 0);
        return;
      }
      const back = peek ? peek.back : here();
      setPeek({ side, back });
      flyTo(seatView(BOARD_LAYOUT, SLAB_MARGIN, side), 0);
    },
    [flyTo, here, peek],
  );
  const flyToSeat = peekSeat;

  /** Every shot the director (or a deliberate look) makes goes through here, so a peek never outlives it. */
  const shot = useCallback(
    (cameraView: CameraView, seconds?: number, style?: FlightStyle) => {
      setPeek(null);
      flyTo(cameraView, seconds, style);
    },
    [flyTo],
  );
  /**
   * The director pushes the camera in towards a point on the table: it moves
   * along the line it already looks down, stopping `distance` away, and looks
   * at the point. Reads as "the camera leans in", from any angle.
   */
  const pushIn = useCallback(
    (point: readonly [number, number, number], distance: number, seconds: number) => {
      const at = new Vector3(point[0], point[1], point[2]);
      const away = cameraTracker.position.clone().sub(at);
      if (away.length() < 1e-3) away.set(0, 1, 1);
      away.setLength(distance);
      const eye = at.clone().add(away);
      eye.y = Math.max(2.2, eye.y);
      shot({ position: [eye.x, eye.y, eye.z], target: point }, seconds);
    },
    [shot],
  );
  /** A deliberate look somewhere: the director steps aside until the next turn. */
  const lookAt = useCallback(
    (cameraView: CameraView, seconds?: number) => {
      setFreeLook(true);
      shot(cameraView, seconds);
    },
    [shot],
  );
  const focusSquare = useCallback((index: number) => lookAt(squareView(BOARD_LAYOUT, index), 0.45), [lookAt]);

  /**
   * The director's home shot is the pawn of the player on turn: the camera
   * swoops there when a turn starts (a screen that took the camera re-joins),
   * and comes back to it whenever a replay ends and the table waits for the
   * next decision — after paying, buying, an auction, a trade. Nothing flies
   * when the camera already stands there (the opening throws all happen at
   * Salida; a landing was just framed).
   */
  const currentPlayerId = currentPlayer(game).id;
  const shownPlayerId = shownPlayer.id;
  const shownPosition = view.positions[shownPlayer.id] ?? shownPlayer.position;
  const opening = view.phase.type === "openingRoll";
  const director = settings.followTurn;
  const directorCue = useCallback(
    (seconds = TURN_FLIGHT_SECONDS, style: FlightStyle = "arc") => {
      setFreeLook(false);
      const target = pawnView(BOARD_LAYOUT, shownPosition);
      if (heading(target)) return;
      shot(target, seconds, style);
    },
    [shot, heading, shownPosition],
  );
  const mounted = useRef(false);
  const turnKey = `${shownPlayerId}|${opening}|${director}`;
  const seenTurn = useRef<string | null>(null);
  useEffect(() => {
    const newTurn = seenTurn.current !== turnKey;
    seenTurn.current = turnKey;
    const first = !mounted.current;
    mounted.current = true;
    if (!director) {
      // Director off: sit at your own seat once, when the table appears, and otherwise leave the camera alone.
      if (first && you !== null) flyTo(seatView(BOARD_LAYOUT, SLAB_MARGIN, mySide), 0);
      return;
    }
    if (newTurn) {
      directorCue();
      return;
    }
    // Back to the pawn once the action has been shown (or the table was reset under it);
    // a screen that took the camera keeps it, and a card held up to the screen keeps its shot.
    if (!busy && !freeLook && view.cardOnTable === null) directorCue(0.7, "direct");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the turn the table shows changing, the opening ending, the director being switched, a replay ending, or the shown pawn being put elsewhere
  }, [turnKey, busy, shownPosition]);

  /**
   * A new seq means something happened. Consecutive steps are replayed; a
   * jump (reconnect, joined mid-game) is shown as-is. A dice roll flies the
   * dice first and replays once they have settled.
   */
  useEffect(() => {
    const before = previous.current;
    previous.current = { game, seq };
    if (!before || before.seq === seq) return;
    if (seq !== before.seq + 1 || game.events.length === 0) {
      reset(game);
      return;
    }
    soundsForTransition(before.game, game, session.lastAction).forEach((name, i) => setTimeout(() => sfx.play(name), i * 140));
    if (before.game.phase.type === "awaitingTradeResponse" && (session.lastAction === "acceptTrade" || session.lastAction === "rejectTrade")) {
      const { trade: settled } = before.game.phase;
      setOutcome({ id: seq, kind: session.lastAction === "acceptTrade" ? "accepted" : "rejected", fromId: settled.fromId, toId: settled.toId });
    }
    if (session.lastAction === "rollDice" && game.dice) {
      pendingReplay.current = game;
      setShaking(false);
      setThrowing({ id: seq, values: game.dice, seed: seq });
      return;
    }
    enqueue(game);
  }, [game, seq, session.lastAction, enqueue, reset]);

  // A free deed on offer (or under the hammer) is lifted in front of everyone; the table's own view says when.
  const offeredDeed = view.deedOnOffer;

  // The pawn stopped: settle the camera on that square before the landing is announced —
  // unless the pawn is about to move again (marched to jail from Marche preso: the wide
  // shot of the leap comes next) or just leapt (the wide shot holds until the jail lean-in).
  const onPawnArrive = useCallback(
    (pawnId: string, square: number) => {
      playback.onPawnArrive();
      if (!director || freeLook || pawnId !== shownPlayerId || walk?.jump) return;
      const events = game.events;
      const index = events.findIndex((e) => e.type === "move" && e.playerId === pawnId && e.to === square);
      const next = index >= 0 ? events[index + 1] : undefined;
      if (next?.type === "move" && next.playerId === pawnId) return;
      shot(pawnView(BOARD_LAYOUT, square), 0.6);
    },
    [playback, director, freeLook, shownPlayerId, walk?.jump, game.events, shot],
  );

  // Once the table has caught up with a move, the square the pawn stopped on is the one to look at.
  useEffect(() => {
    if (busy) return;
    const landing = game.moves.at(-1)?.to;
    if (landing !== undefined) setSelected(landing);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the replay of the latest state ends
  }, [busy, seq]);

  /**
   * The camera is the audience: it chases whatever moves (a walking pawn,
   * bills or a deed in flight) and leans in on what happens in place (a
   * building dropping, someone marched to jail, a bankruptcy).
   */
  const current = playback.current;
  // A walk is chased from behind; a leap (to jail) is watched from a wide shot instead, so the
  // camera never swings across the board after it.
  const chasing = settings.followPawn && !(director && freeLook) && walk !== null && !walk.jump ? walk.id : null;
  // A chase moves the camera on its own: the last flight no longer says where it is.
  useEffect(() => {
    if (chasing !== null) lastFlight.current = null;
  }, [chasing]);
  /** A shot that keeps both ends of a flight in view (the piles, the pawn, the seat), from the side the camera is on. */
  const frameBoth = useCallback(
    (a: Vector3, b: Vector3, seconds: number) => {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const span = a.distanceTo(b);
      const distance = Math.min(22, Math.max(7, span * 0.85 + 5));
      const dir = cameraTracker.position.clone().sub(mid);
      dir.y = 0;
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
      dir.setLength(distance * 0.7);
      const eye = mid.clone().add(dir);
      eye.y = mid.y + distance * 0.72;
      shot({ position: [eye.x, eye.y, eye.z], target: [mid.x, mid.y, mid.z] }, seconds);
    },
    [shot],
  );
  useEffect(() => {
    if (!current || !director || freeLook) return;
    switch (current.type) {
      case "move": {
        // A leap across the board: both squares in one wide shot from above.
        const from = BOARD_LAYOUT.tiles[current.from];
        const to = BOARD_LAYOUT.tiles[current.to];
        if (current.kind === "jump" && from && to) frameBoth(new Vector3(...boardToWorld(from.center, 0.2)), new Vector3(...boardToWorld(to.center, 0.2)), 0.5);
        break;
      }
      case "card":
        // The card comes up to the screen: back off so it floats clear of the table, still looking at the same spot.
        shot(backOffView(here(), CARD_BACK_OFF, CARD_AHEAD, CARD_CLEARANCE), 0.7);
        break;
      case "transfer":
        frameBoth(moneyAnchor(anchors, current.from), moneyAnchor(anchors, current.to), 0.5);
        break;
      case "deed":
        frameBoth(deedAnchor(anchors, current.from), deedAnchor(anchors, current.to), 0.5);
        break;
      case "building": {
        const tile = BOARD_LAYOUT.tiles[layoutIndexFor(current.deedId)];
        if (tile) pushIn(boardToWorld(tile.center, 0.2), 5.5, 0.55);
        break;
      }
      case "jail": {
        const tile = BOARD_LAYOUT.tiles[JAIL_INDEX];
        if (tile) pushIn(boardToWorld(tile.center, 0.2), 7, 0.6);
        break;
      }
      case "bankrupt": {
        const at = deedAnchor(anchors, { type: "player", playerId: current.playerId });
        pushIn([at.x, at.y, at.z], 9, 0.8);
        break;
      }
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one cue per replayed event
  }, [current]);

  const onDiceSettled = useCallback(
    (id: number) => {
      if (!throwing || throwing.id !== id) return;
      setThrowing(null);
      const pending = pendingReplay.current;
      pendingReplay.current = null;
      if (pending) enqueue(pending);
    },
    [throwing, enqueue],
  );

  const canRoll = !busy && (game.phase.type === "openingRoll" || game.phase.type === "awaitingRoll" || game.phase.type === "awaitingJailDecision") && (you === null || currentPlayerId === you);

  // When the current prompt became answerable, so a key still hammering through the banners does not answer it.
  const promptReadyAt = useRef(0);
  useEffect(() => {
    promptReadyAt.current = Date.now();
  }, [busy, seq]);

  // Trades: whoever must act may propose one; the other party answers from the prompt. A draft never outlives the state it was written against.
  const proposer = busy ? null : tradeProposer(game, you);
  const openTrade = useCallback(
    (draft: Omit<TradeDraft, "me" | "counter">) => {
      if (!proposer) return;
      tradeCounter.current += 1;
      setTrade({ id: tradeCounter.current, mode: { kind: "compose", draft: { ...draft, me: proposer, counter: false } } });
    },
    [proposer],
  );
  const proposeTrade = useCallback(() => openTrade({ partnerId: null, gives: NO_OFFER, receives: NO_OFFER }), [openTrade]);
  const tradeDeed = useCallback(
    (deedId: DeedId) => {
      const owner = game.holdings[deedId]?.ownerId;
      if (!owner || !proposer) return;
      if (owner === proposer) openTrade({ partnerId: null, gives: { deeds: [deedId], cash: 0 }, receives: NO_OFFER });
      else openTrade({ partnerId: owner, gives: NO_OFFER, receives: { deeds: [deedId], cash: 0 } });
    },
    [game.holdings, proposer, openTrade],
  );
  const counterTrade = useCallback(() => {
    if (game.phase.type !== "awaitingTradeResponse") return;
    const { trade: pending } = game.phase;
    tradeCounter.current += 1;
    setTrade({ id: tradeCounter.current, mode: { kind: "compose", draft: { me: pending.toId, partnerId: pending.fromId, gives: pending.receives, receives: pending.gives, counter: true } } });
  }, [game.phase]);
  // While the trade screen is open the clock must not decide for us (watching someone else's is not deciding anything).
  const composing = trade !== null && trade.mode.kind !== "watch";
  useEffect(() => {
    if (!composing) return;
    session.setComposing(true);
    return () => session.setComposing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session identity changes with every state; only the flag matters
  }, [composing]);
  const reviewTrade = useCallback(() => {
    if (game.phase.type !== "awaitingTradeResponse") return;
    tradeCounter.current += 1;
    setTrade({ id: tradeCounter.current, mode: { kind: "review", trade: game.phase.trade } });
  }, [game.phase]);
  // A state change invalidates any draft.
  useEffect(() => setTrade(null), [seq]);
  // Someone else putting a deal together: everyone watches it being built (they can close it and come back with V).
  const sharedDraft = session.tradeDraft !== null && session.tradeDraft.fromId !== you ? session.tradeDraft : null;
  const watchTrade = useCallback(() => {
    tradeCounter.current += 1;
    const id = tradeCounter.current;
    // A proposal being looked at gives way: the counter-offer being built is the newer news.
    setTrade((current) => (current === null || current.mode.kind === "review" ? { id, mode: { kind: "watch" } } : current));
  }, []);
  const watching = sharedDraft !== null;
  const tradeMode: TradeScreenMode | null = trade === null ? null : trade.mode.kind !== "watch" ? trade.mode : sharedDraft ? { kind: "watch", draft: sharedDraft } : null;
  useEffect(() => {
    if (watching) watchTrade();
    else setTrade((current) => (current?.mode.kind === "watch" ? null : current));
  }, [watching, watchTrade]);
  // Once the table has announced the proposal, the player who must answer sees it big.
  const proposalShown = view.phase.type === "awaitingTradeResponse" ? view.phase.trade : null;
  useEffect(() => {
    if (proposalShown && (you === null || you === proposalShown.toId)) reviewTrade();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the table shows a proposal
  }, [proposalShown]);

  const startShake = useCallback(() => {
    if (!canRoll) return;
    setShaking(true);
    session.setShaking(true);
  }, [canRoll, session]);

  const releaseDice = useCallback(() => {
    if (!shaking) return;
    setShaking(false);
    sfx.play("diceThrow");
    dispatch({ type: "rollDice" });
  }, [shaking, dispatch]);

  const onSelect = useCallback((index: number) => setSelected((current) => (current === index ? null : index)), []);
  const closePanel = useCallback(() => setSelected(null), []);

  // Keyboard: space/enter hurry a replay (2×), shake the dice (hold space) or press the prompt's highlighted button;
  // digits sit at a player's seat, 0/T/M views, L list, C trade, coma settings.
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (isTyping(event) || ownsSpace(event)) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        // The key's auto-repeat never does more than the first press did: a held Space hurries once.
        if (event.repeat) return;
        if (throwing) {
          diceHurry.requested += 1;
          return;
        }
        if (playback.busy) {
          hurry();
          return;
        }
        if (canRoll) {
          if (event.key === " ") startShake();
          return;
        }
        if (busy || showList || showSettings || trade !== null || Date.now() - promptReadyAt.current < PROMPT_GRACE_MS) return;
        const action = primaryAction(game, you);
        if (action) dispatch(action);
        return;
      }
      if (event.key === "Escape") {
        setOverlay(null);
        setShowSettings(false);
        setTrade(null);
        closePanel();
        if (peek) peekSeat(peek.side);
        return;
      }
      const key = event.key.toLowerCase();
      if (key >= "1" && key <= "6") {
        const seat = seats[Number(key) - 1];
        if (seat) flyToSeat(seat.side);
      } else if (key === UI_KEYS.overview) lookAt(OVERVIEW);
      else if (key === UI_KEYS.topDown) lookAt(TOP_DOWN);
      else if (key === UI_KEYS.mySeat) flyToSeat(mySide);
      else if (key === UI_KEYS.map) setOverlay((v) => (v ? null : "catastro"));
      else if (key === UI_KEYS.trade) proposeTrade();
      else if (key === UI_KEYS.settings) setShowSettings((v) => !v);
      else if (key === "v" && sharedDraft && trade === null) watchTrade();
      else if (busy || showList || showSettings || trade !== null || Date.now() - promptReadyAt.current < PROMPT_GRACE_MS) return;
      else if (key === "o" && game.phase.type === "awaitingTradeResponse" && canAct(game, you, { type: "counterTrade", gives: NO_OFFER, receives: NO_OFFER })) counterTrade();
      else if (key === "v" && game.phase.type === "awaitingTradeResponse") reviewTrade();
      else {
        // The letter printed on the button: buy, auction, pay, bid, pass, accept, reject…
        const action = actionForKey(game, you, key);
        if (action) dispatch(action);
      }
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key === " ") releaseDice();
    };
    const onBlur = () => releaseDice();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [seats, startShake, releaseDice, lookAt, flyToSeat, mySide, closePanel, playback.busy, busy, canRoll, hurry, proposeTrade, counterTrade, reviewTrade, watchTrade, sharedDraft, game, you, dispatch, showList, showSettings, trade, throwing, peek, peekSeat]);

  const pawns = useMemo<readonly PawnView[]>(
    () =>
      game.players.map((p) => ({
        id: p.id,
        token: p.token,
        color: p.color,
        // Where the table shows the pawn: it moves when its move event plays, not when the state arrives.
        position: view.positions[p.id] ?? p.position,
        route: walk?.playerId === p.id ? walk.route : null,
        routeId: walk?.playerId === p.id ? walk.id : 0,
        jump: walk?.playerId === p.id ? walk.jump : false,
        dimmed: p.bankrupt,
      })),
    [game, walk, view.positions],
  );

  const colorOf = useCallback((playerId: string) => game.players.find((p) => p.id === playerId)?.color ?? "#000000", [game]);

  // The squares the pawn is about to cross: with the dice on the table, the next N; while it walks, what is left of its route.
  const path = useMemo<readonly number[]>(() => {
    if (walk) return walk.route.slice(1);
    if (game.phase.type !== "awaitingMove" || !game.dice) return [];
    const from = currentPlayer(game).position;
    const steps = game.dice[0] + game.dice[1];
    return Array.from({ length: steps }, (_, i) => (from + i + 1) % BOARD_SIZE);
  }, [walk, game]);

  const shown = selected ?? hovered;
  const openCatastro = () => setOverlay("catastro");
  /** Where selling and mortgaging happen: the list tab. */
  const openList = () => setOverlay("list");
  const diceShaking = shaking || (session.shakingPlayerId !== null && session.shakingPlayerId !== you);

  // The dice on the felt: everyone looks at them where they landed, then they come up to the camera.
  const onDiceLanded = useCallback(
    (_id: number, at: Vector3) => {
      if (director && !freeLook) pushIn([at.x, at.y, at.z], 7, 0.7);
    },
    [director, freeLook, pushIn],
  );
  const [doublesFlash, setDoublesFlash] = useState<number | null>(null);
  const onDicePresenting = useCallback((id: number, doubles: boolean) => {
    if (!doubles) return;
    setDoublesFlash(id);
    sfx.play("auctionWon", { volume: 0.7 });
  }, []);
  useEffect(() => {
    if (doublesFlash === null) return;
    const timer = setTimeout(() => setDoublesFlash(null), 1_600);
    return () => clearTimeout(timer);
  }, [doublesFlash]);

  return (
    <div className="app">
      <Scene
        hovered={hovered}
        selected={selected}
        path={path}
        onHover={setHovered}
        onSelect={onSelect}
        onFocus={focusSquare}
        pawns={pawns}
        seats={seats}
        holdings={view.holdings}
        colorOf={colorOf}
        onPawnArrive={onPawnArrive}
        goTo={goTo}
        chase={chasing}
        onUserControl={takeCamera}
        cardOnTable={view.cardOnTable}
        throwerId={session.shakingPlayerId ?? shownPlayerId}
        shaking={diceShaking}
        throwing={throwing}
        onDiceLanded={onDiceLanded}
        onDicePresenting={onDicePresenting}
        onDiceSettled={onDiceSettled}
      />
      <div className="left-column">
        <TopBar state={game} roomCode={session.roomCode} connection={session.connection} onShowList={openCatastro} onTrade={proposer ? proposeTrade : null} onSettings={() => setShowSettings(true)} onLeave={session.leave} />
        <LogPanel state={game} />
      </div>
      <PlayerCards state={game} cash={view.cash} currentId={view.currentPlayerId} you={you} offline={session.offline} onFocus={(playerId) => flyToSeat(sideOf(playerId))} />
      <MoneyFlights />
      {offeredDeed === null && (
        <SquarePanel state={game} you={you} square={shown === null ? null : getSquare(shown)} pinned={selected !== null} busy={busy} dispatch={dispatch} onTradeDeed={tradeDeed} onClose={closePanel} />
      )}
      <ActionBar
        state={game}
        shownPlayer={shownPlayer}
        cardOnTable={view.cardOnTable}
        you={you}
        busy={busy}
        shaking={shaking}
        canRoll={canRoll}
        onShakeStart={startShake}
        onShakeEnd={releaseDice}
        onTrade={proposer ? proposeTrade : null}
        dispatch={dispatch}
        deadline={session.deadline}
      />
      <div className="stage">
        <Banner state={game} event={playback.current} onHurry={hurry} />
        <Prompt
          state={game}
          you={you}
          busy={busy}
          deadline={session.deadline}
          dispatch={dispatch}
          onNewGame={session.newGame}
          onManage={openList}
          onTrade={proposeTrade}
          onCounter={counterTrade}
          onReview={reviewTrade}
          canRestart={canRestart}
        />
      </div>
      <CameraBar
        mode={!director ? "off" : freeLook ? "free" : "following"}
        onFollow={() => directorCue()}
        onToggleDirector={() => onSettings({ ...settings, followTurn: !settings.followTurn })}
        onMySeat={() => flyToSeat(mySide)}
        onOverview={() => lookAt(OVERVIEW)}
        onTopDown={() => lookAt(TOP_DOWN)}
      />
      {overlay && (
        <BoardMap
          state={game}
          tab={overlay}
          onTab={setOverlay}
          dispatch={dispatch}
          you={you}
          busy={busy}
          onClose={() => setOverlay(null)}
          onSelect={(index) => {
            setSelected(index);
            setOverlay(null);
          }}
        />
      )}
      {showSettings && <SettingsPanel settings={settings} onChange={onSettings} onClose={() => setShowSettings(false)} />}
      {sharedDraft && trade === null && (
        <button type="button" className="watch-trade" onClick={watchTrade}>
          ⇄ {getPlayer(game, sharedDraft.fromId).name} está armando {sharedDraft.counter ? "una contraoferta" : "un canje"} · Ver <Key k="v" />
        </button>
      )}
      {trade && tradeMode && (
        <TradeScreen
          key={trade.id}
          state={game}
          mode={tradeMode}
          you={you}
          busy={busy}
          dispatch={dispatch}
          onSubmit={(toId, gives, receives) =>
            dispatch(trade.mode.kind === "compose" && trade.mode.draft.counter ? { type: "counterTrade", gives, receives } : { type: "proposeTrade", toId, gives, receives })
          }
          onCounter={counterTrade}
          onClose={() => setTrade(null)}
          onDraftChange={(partnerId, gives, receives) => session.setComposing(true, { toId: partnerId, gives, receives, counter: trade.mode.kind === "compose" && trade.mode.draft.counter })}
        />
      )}
      <LiftedDeed state={game} deedId={offeredDeed} />
      {outcome && <TradeOutcome key={outcome.id} outcome={outcome} state={game} onDone={() => setOutcome(null)} />}
      {doublesFlash !== null && (
        <div key={doublesFlash} className="doubles-flash" aria-live="polite">
          ¡DOBLES!
        </div>
      )}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

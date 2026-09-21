import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { soundsForTransition } from "./audio/gameSounds";
import { sfx } from "./audio/sfx";
import type { DeedId, GameState, TradeOffer } from "./game";
import { BOARD_SIZE, currentPlayer, getSquare } from "./game";
import type { PawnView, SeatView } from "./scene/Board";
import { BOARD_LAYOUT, SLAB_MARGIN } from "./scene/Board";
import type { CameraView } from "./scene/cameraViews";
import { OVERVIEW, TOP_DOWN, pawnView, seatView, squareView } from "./scene/cameraViews";
import type { FlightStyle } from "./scene/CameraRig";
import type { DiceThrow } from "./scene/Dice";
import { effectsBus } from "./scene/effectsBus";
import { diceHurry } from "./scene/pawnKnocks";
import { Scene } from "./scene/Scene";
import { seatSides } from "./scene/seats";
import type { Session } from "./session/types";
import { ActionBar } from "./ui/ActionBar";
import { Banner } from "./ui/Banner";
import { CameraBar } from "./ui/CameraBar";
import { LogPanel } from "./ui/LogPanel";
import { MoneyFlights } from "./ui/MoneyFlights";
import { PlayerCards } from "./ui/PlayerCards";
import { Prompt } from "./ui/Prompt";
import { primaryAction, tradeProposer } from "./ui/perspective";
import { BoardMap } from "./ui/BoardMap";
import type { Settings } from "./ui/settings";
import { SettingsPanel } from "./ui/SettingsPanel";
import { SquarePanel } from "./ui/SquarePanel";
import { TopBar } from "./ui/TopBar";
import type { TradeDraft, TradeScreenMode } from "./ui/TradeScreen";
import { TradeScreen } from "./ui/TradeScreen";
import { usePlayback } from "./ui/usePlayback";

const ERROR_MS = 3_500;
/** Space/Enter pressed this soon after a prompt appears are taken as leftover banner-skipping, not as the decision. */
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
  readonly view: CameraView;
  readonly seconds?: number;
  readonly style?: FlightStyle;
}

/** The turn-to-turn flight: long enough to read as a swoop from one pawn to the next. */
const TURN_FLIGHT_SECONDS = 1.5;

/** The trade screen's contents; `id` remounts it so a fresh draft starts clean. */
interface OpenTrade {
  readonly id: number;
  readonly mode: TradeScreenMode;
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
  const [showList, setShowList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [trade, setTrade] = useState<OpenTrade | null>(null);
  const tradeCounter = useRef(0);
  const [goTo, setGoTo] = useState<Flight | null>(null);
  const goToCounter = useRef(0);
  /** The user took the camera (drag, wheel, a camera key); the director lets go until the next turn. */
  const [freeLook, setFreeLook] = useState(false);
  const playback = usePlayback(game, { bannerSeconds: settings.bannerSeconds });
  const { view, walk, enqueue, reset, skip, onPawnArrive } = playback;
  const busy = playback.busy || throwing !== null;
  const previous = useRef<{ game: GameState; seq: number } | null>(null);
  const pendingReplay = useRef<{ before: GameState; after: GameState } | null>(null);

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
        isCurrent: i === game.currentPlayerIndex,
      },
    }));
  }, [game, view.cash]);

  const sideOf = useCallback((playerId: string) => seats.find((s) => s.playerId === playerId)?.side ?? 0, [seats]);
  const currentSide = sideOf(currentPlayer(game).id);
  const mySide = you ? sideOf(you) : currentSide;

  const flyTo = useCallback((cameraView: CameraView, seconds?: number, style?: FlightStyle) => {
    goToCounter.current += 1;
    setGoTo({ id: goToCounter.current, view: cameraView, ...(seconds === undefined ? {} : { seconds }), ...(style === undefined ? {} : { style }) });
  }, []);
  /** A deliberate look somewhere: the director steps aside until the next turn. */
  const lookAt = useCallback(
    (cameraView: CameraView, seconds?: number) => {
      setFreeLook(true);
      flyTo(cameraView, seconds);
    },
    [flyTo],
  );
  const flyToSeat = useCallback((side: number) => lookAt(seatView(BOARD_LAYOUT, SLAB_MARGIN, side)), [lookAt]);
  const focusSquare = useCallback((index: number) => lookAt(squareView(BOARD_LAYOUT, index), 0.45), [lookAt]);

  /**
   * The director: at the start of every turn, everyone's camera swoops to a
   * close-up of the pawn whose turn it is (during the opening throws, to the
   * thrower's seat). A screen that took the camera re-joins here.
   */
  const currentPlayerId = currentPlayer(game).id;
  const currentPosition = currentPlayer(game).position;
  const opening = game.phase.type === "openingRoll";
  const director = settings.followTurn;
  const directorCue = useCallback(() => {
    setFreeLook(false);
    flyTo(opening ? seatView(BOARD_LAYOUT, SLAB_MARGIN, currentSide) : pawnView(BOARD_LAYOUT, currentPosition), TURN_FLIGHT_SECONDS, "arc");
  }, [flyTo, opening, currentSide, currentPosition]);
  useEffect(() => {
    if (director) directorCue();
    else if (you !== null) flyTo(seatView(BOARD_LAYOUT, SLAB_MARGIN, mySide));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the turn changing or the director being switched
  }, [currentPlayerId, director]);

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
    soundsForTransition(before.game, game).forEach((name, i) => setTimeout(() => sfx.play(name), i * 140));
    const landing = game.moves.at(-1)?.to;
    if (landing !== undefined) setSelected(landing);
    if (session.lastAction === "rollDice" && game.dice) {
      pendingReplay.current = { before: before.game, after: game };
      setShaking(false);
      setThrowing({ id: seq, values: game.dice, seed: seq });
      return;
    }
    enqueue(before.game, game);
  }, [game, seq, session.lastAction, enqueue, reset]);

  // A free deed on offer (or under the hammer): lift it from the bank pile in front of everyone until it is decided.
  const offeredDeed = !busy && game.phase.type === "awaitingBuyDecision" ? game.phase.deedId : !busy && game.phase.type === "auction" ? game.phase.auction.deedId : null;
  useEffect(() => {
    if (!offeredDeed) return;
    void effectsBus.request({ kind: "presentDeed", deedId: offeredDeed });
    return () => {
      void effectsBus.request({ kind: "hideDeed" });
    };
  }, [offeredDeed]);

  const onDiceSettled = useCallback(
    (id: number) => {
      if (!throwing || throwing.id !== id) return;
      setThrowing(null);
      const pending = pendingReplay.current;
      pendingReplay.current = null;
      if (pending) enqueue(pending.before, pending.after);
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
  const reviewTrade = useCallback(() => {
    if (game.phase.type !== "awaitingTradeResponse") return;
    tradeCounter.current += 1;
    setTrade({ id: tradeCounter.current, mode: { kind: "review", trade: game.phase.trade } });
  }, [game.phase]);
  // A state change invalidates any draft; once the proposal has been announced, the player who must answer sees it big.
  useEffect(() => {
    if (busy) return;
    if (game.phase.type === "awaitingTradeResponse" && (you === null || you === game.phase.trade.toId)) reviewTrade();
    else setTrade(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the state settles
  }, [seq, busy]);

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

  // Keyboard: space/enter skip a replay, shake the dice (hold space) or press the prompt's highlighted button;
  // digits sit at a player's seat, 0/T/M views, L list, C trade, coma settings.
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (isTyping(event) || ownsSpace(event)) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (throwing) {
          diceHurry.requested += 1;
          return;
        }
        if (playback.busy) {
          skip();
          return;
        }
        if (event.repeat) return;
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
        setShowList(false);
        setShowSettings(false);
        setTrade(null);
        closePanel();
        return;
      }
      const key = event.key.toLowerCase();
      if (key >= "1" && key <= "6") {
        const seat = seats[Number(key) - 1];
        if (seat) flyToSeat(seat.side);
      } else if (key === "0") lookAt(OVERVIEW);
      else if (key === "t") lookAt(TOP_DOWN);
      else if (key === "m") flyToSeat(mySide);
      else if (key === "l") setShowList((v) => !v);
      else if (key === "c") proposeTrade();
      else if (key === ",") setShowSettings((v) => !v);
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
  }, [seats, startShake, releaseDice, lookAt, flyToSeat, mySide, closePanel, playback.busy, busy, canRoll, skip, proposeTrade, game, you, dispatch, showList, showSettings, trade, throwing]);

  const pawns = useMemo<readonly PawnView[]>(
    () =>
      game.players.map((p) => ({
        id: p.id,
        token: p.token,
        color: p.color,
        position: p.position,
        route: walk?.playerId === p.id ? walk.route : null,
        routeId: walk?.playerId === p.id ? walk.id : 0,
        jump: walk?.playerId === p.id ? walk.jump : false,
        dimmed: p.bankrupt,
      })),
    [game, walk],
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
  const openList = () => setShowList(true);
  const shakingSeat = session.shakingPlayerId ? sideOf(session.shakingPlayerId) : currentSide;
  const diceShaking = shaking || (session.shakingPlayerId !== null && session.shakingPlayerId !== you);

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
        followPawn={settings.followPawn && walk !== null && !(director && freeLook)}
        onUserControl={() => setFreeLook(true)}
        diceSide={shakingSeat}
        throwerId={session.shakingPlayerId ?? currentPlayerId}
        shaking={diceShaking}
        throwing={throwing}
        onDiceSettled={onDiceSettled}
      />
      <div className="left-column">
        <TopBar state={game} roomCode={session.roomCode} connection={session.connection} onShowList={openList} onTrade={proposer ? proposeTrade : null} onSettings={() => setShowSettings(true)} onLeave={session.leave} />
        <LogPanel state={game} />
      </div>
      <PlayerCards state={game} cash={view.cash} you={you} offline={session.offline} />
      <MoneyFlights />
      {offeredDeed === null && (
        <SquarePanel state={game} you={you} square={shown === null ? null : getSquare(shown)} pinned={selected !== null} busy={busy} dispatch={dispatch} onTradeDeed={tradeDeed} onClose={closePanel} />
      )}
      <ActionBar state={game} you={you} busy={busy} shaking={shaking} canRoll={canRoll} onShakeStart={startShake} onShakeEnd={releaseDice} onTrade={proposer ? proposeTrade : null} dispatch={dispatch} />
      <div className="stage">
        <Banner state={game} event={playback.current} onSkip={skip} />
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
        onFollow={directorCue}
        onToggleDirector={() => onSettings({ ...settings, followTurn: !settings.followTurn })}
        onMySeat={() => flyToSeat(mySide)}
        onOverview={() => lookAt(OVERVIEW)}
        onTopDown={() => lookAt(TOP_DOWN)}
      />
      {showList && (
        <BoardMap
          state={game}
          dispatch={dispatch}
          you={you}
          busy={busy}
          onClose={() => setShowList(false)}
          onSelect={(index) => {
            setSelected(index);
            setShowList(false);
          }}
        />
      )}
      {showSettings && <SettingsPanel settings={settings} onChange={onSettings} onClose={() => setShowSettings(false)} />}
      {trade && (
        <TradeScreen
          key={trade.id}
          state={game}
          mode={trade.mode}
          you={you}
          busy={busy}
          dispatch={dispatch}
          onSubmit={(toId, gives, receives) =>
            dispatch(trade.mode.kind === "compose" && trade.mode.draft.counter ? { type: "counterTrade", gives, receives } : { type: "proposeTrade", toId, gives, receives })
          }
          onCounter={counterTrade}
          onClose={() => setTrade(null)}
        />
      )}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

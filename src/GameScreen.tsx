import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { soundsForTransition } from "./audio/gameSounds";
import { sfx } from "./audio/sfx";
import type { DeedId, GameState, TradeOffer } from "./game";
import { currentPlayer, getSquare } from "./game";
import type { PawnView, SeatView } from "./scene/Board";
import { BOARD_LAYOUT, SLAB_MARGIN } from "./scene/Board";
import type { CameraView } from "./scene/cameraViews";
import { OVERVIEW, TOP_DOWN, seatView, squareView } from "./scene/cameraViews";
import type { DiceThrow } from "./scene/Dice";
import { Scene } from "./scene/Scene";
import { seatSides } from "./scene/seats";
import type { Session } from "./session/types";
import { ActionBar } from "./ui/ActionBar";
import { Banner } from "./ui/Banner";
import { CameraBar } from "./ui/CameraBar";
import { LogPanel } from "./ui/LogPanel";
import { PlayersPanel } from "./ui/PlayersPanel";
import { Prompt } from "./ui/Prompt";
import { primaryAction, tradeProposer } from "./ui/perspective";
import { PropertiesList } from "./ui/PropertiesList";
import type { Settings } from "./ui/settings";
import { SettingsPanel } from "./ui/SettingsPanel";
import { SquarePanel } from "./ui/SquarePanel";
import type { TradeDraft } from "./ui/TradeDialog";
import { TradeDialog } from "./ui/TradeDialog";
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
}

/** The trade dialog's contents; `id` remounts it so a fresh draft starts clean. */
interface OpenTrade {
  readonly id: number;
  readonly draft: TradeDraft;
}

const NO_OFFER: TradeOffer = { deeds: [], cash: 0 };

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
}

/** Inside a modal, or on a focused prompt button, the browser's own Space/Enter handling is the right one. */
function ownsSpace(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLElement && event.target.closest(".modal-backdrop, .prompt") !== null;
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

  const flyTo = useCallback((cameraView: CameraView, seconds?: number) => {
    goToCounter.current += 1;
    setGoTo(seconds === undefined ? { id: goToCounter.current, view: cameraView } : { id: goToCounter.current, view: cameraView, seconds });
  }, []);
  const flyToSeat = useCallback((side: number) => flyTo(seatView(BOARD_LAYOUT, SLAB_MARGIN, side)), [flyTo]);
  const focusSquare = useCallback((index: number) => flyTo(squareView(BOARD_LAYOUT, index), 0.45), [flyTo]);

  // Sit at your own seat online; at a shared table, with whoever is on turn.
  const currentPlayerId = currentPlayer(game).id;
  useEffect(() => {
    if (you !== null && !settings.followTurn) return;
    flyToSeat(you !== null && !settings.followTurn ? mySide : currentSide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the player changing
  }, [currentPlayerId, settings.followTurn]);
  useEffect(() => {
    if (you !== null) flyToSeat(mySide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the table appears
  }, []);

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

  const canRoll = !busy && (game.phase.type === "awaitingRoll" || game.phase.type === "awaitingJailDecision") && (you === null || currentPlayerId === you);

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
      setTrade({ id: tradeCounter.current, draft: { ...draft, me: proposer, counter: false } });
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
    setTrade({ id: tradeCounter.current, draft: { me: pending.toId, partnerId: pending.fromId, gives: pending.receives, receives: pending.gives, counter: true } });
  }, [game.phase]);
  useEffect(() => setTrade(null), [seq]);

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
      } else if (key === "0") flyTo(OVERVIEW);
      else if (key === "t") flyTo(TOP_DOWN);
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
  }, [seats, startShake, releaseDice, flyTo, flyToSeat, mySide, closePanel, playback.busy, busy, canRoll, skip, proposeTrade, game, you, dispatch, showList, showSettings, trade]);

  const pawns = useMemo<readonly PawnView[]>(
    () =>
      game.players.map((p) => ({
        id: p.id,
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

  const shown = selected ?? hovered;
  const openList = () => setShowList(true);
  const shakingSeat = session.shakingPlayerId ? sideOf(session.shakingPlayerId) : currentSide;
  const diceShaking = shaking || (session.shakingPlayerId !== null && session.shakingPlayerId !== you);

  return (
    <div className="app">
      <Scene
        hovered={hovered}
        selected={selected}
        onHover={setHovered}
        onSelect={onSelect}
        onFocus={focusSquare}
        pawns={pawns}
        seats={seats}
        holdings={view.holdings}
        colorOf={colorOf}
        onPawnArrive={onPawnArrive}
        goTo={goTo}
        followPawn={settings.followPawn && walk !== null}
        diceSide={shakingSeat}
        shaking={diceShaking}
        throwing={throwing}
        onDiceSettled={onDiceSettled}
      />
      <div className="left-column">
        <PlayersPanel
          state={game}
          cash={view.cash}
          you={you}
          offline={session.offline}
          roomCode={session.roomCode}
          connection={session.connection}
          onShowList={openList}
          onTrade={proposer ? proposeTrade : null}
          onLeave={session.leave}
        />
        <LogPanel state={game} />
      </div>
      <SquarePanel state={game} you={you} square={shown === null ? null : getSquare(shown)} pinned={selected !== null} busy={busy} dispatch={dispatch} onTradeDeed={tradeDeed} onClose={closePanel} />
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
          canRestart={canRestart}
        />
      </div>
      <CameraBar
        followTurn={settings.followTurn}
        onToggleFollow={() => onSettings({ ...settings, followTurn: !settings.followTurn })}
        onMySeat={() => flyToSeat(mySide)}
        onOverview={() => flyTo(OVERVIEW)}
        onTopDown={() => flyTo(TOP_DOWN)}
        onSettings={() => setShowSettings(true)}
      />
      {showList && (
        <PropertiesList
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
        <TradeDialog
          key={trade.id}
          state={game}
          draft={trade.draft}
          busy={busy}
          onSubmit={(toId, gives, receives) => dispatch(trade.draft.counter ? { type: "counterTrade", gives, receives } : { type: "proposeTrade", toId, gives, receives })}
          onClose={() => setTrade(null)}
        />
      )}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

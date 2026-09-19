import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { soundsForTransition } from "./audio/gameSounds";
import { sfx } from "./audio/sfx";
import type { GameState, NewPlayer } from "./game";
import { createGame, currentPlayer, getSquare, rollDice } from "./game";
import type { PawnView, SeatView } from "./scene/Board";
import { BOARD_LAYOUT, SLAB_MARGIN } from "./scene/Board";
import type { CameraView } from "./scene/cameraViews";
import { OVERVIEW, TOP_DOWN, seatView, squareView } from "./scene/cameraViews";
import type { DiceThrow } from "./scene/Dice";
import { Scene } from "./scene/Scene";
import { seatSides } from "./scene/seats";
import type { Act } from "./ui/ActionBar";
import { ActionBar } from "./ui/ActionBar";
import { Banner } from "./ui/Banner";
import { CameraBar } from "./ui/CameraBar";
import { LogPanel } from "./ui/LogPanel";
import { PlayersPanel } from "./ui/PlayersPanel";
import { Prompt } from "./ui/Prompt";
import { PropertiesList } from "./ui/PropertiesList";
import type { Settings } from "./ui/settings";
import { loadSettings, saveSettings } from "./ui/settings";
import { SettingsPanel } from "./ui/SettingsPanel";
import { Setup } from "./ui/Setup";
import { SquarePanel } from "./ui/SquarePanel";
import { usePlayback } from "./ui/usePlayback";

const ERROR_MS = 3_500;

declare global {
  interface Window {
    /** Dev-only hook to inspect or replace the game state from the console, or run an action through the UI. */
    __chacarero?: { getGame: () => GameState | null; setGame: (state: GameState) => void; act: (action: (state: GameState) => GameState) => void };
  }
}

interface Flight {
  readonly id: number;
  readonly view: CameraView;
  readonly seconds?: number;
}

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  /** True when the player pinned a square themselves (pauses countdowns); auto-selection after a move does not. */
  const [pinnedByUser, setPinnedByUser] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [throwing, setThrowing] = useState<DiceThrow | null>(null);
  const throwCounter = useRef(0);
  const [showList, setShowList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [goTo, setGoTo] = useState<Flight | null>(null);
  const goToCounter = useRef(0);
  const playback = usePlayback(game, { bannerSeconds: settings.bannerSeconds });
  const { view, walk, enqueue, reset, skip, onPawnArrive } = playback;
  const busy = playback.busy || throwing !== null;
  /** Set by `act` so the game effect can tell replayed changes from injected ones. */
  const fromAct = useRef(false);

  const actRef = useRef<Act>(() => null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__chacarero = { getGame: () => game, setGame, act: (action) => void actRef.current(action) };
    return () => {
      delete window.__chacarero;
    };
  }, [game]);

  // A state that did not come through `act` (dev hook, new game) is shown as is.
  useEffect(() => {
    if (fromAct.current) {
      fromAct.current = false;
      return;
    }
    if (game) reset(game);
  }, [game, reset]);

  useEffect(() => {
    saveSettings(settings);
    sfx.setVolume(settings.soundVolume);
    sfx.setMuted(settings.muted);
  }, [settings]);

  // The audio context needs a user gesture; the first pointer/key event unlocks it.
  useEffect(() => {
    const unlock = () => {
      sfx.unlock();
      sfx.preload();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    sfx.play("error", { volume: 0.6 });
    const id = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(id);
  }, [error]);

  const seats = useMemo<readonly SeatView[]>(() => {
    if (!game) return [];
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

  const currentSide = game ? (seats[game.currentPlayerIndex]?.side ?? 0) : 0;

  const flyTo = useCallback((cameraView: CameraView, seconds?: number) => {
    goToCounter.current += 1;
    setGoTo(seconds === undefined ? { id: goToCounter.current, view: cameraView } : { id: goToCounter.current, view: cameraView, seconds });
  }, []);

  const flyToSeat = useCallback((side: number) => flyTo(seatView(BOARD_LAYOUT, SLAB_MARGIN, side)), [flyTo]);
  const focusSquare = useCallback((index: number) => flyTo(squareView(BOARD_LAYOUT, index), 0.45), [flyTo]);

  // Sit at the current player's side whenever the turn changes (if following).
  const currentPlayerId = game ? currentPlayer(game).id : null;
  useEffect(() => {
    if (!game || !settings.followTurn || currentPlayerId === null) return;
    flyToSeat(currentSide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the player changing
  }, [currentPlayerId, settings.followTurn, game === null]);

  const start = useCallback((players: readonly NewPlayer[], startingCash: number) => {
    setGame(createGame({ players, startingCash }));
    setSelected(null);
    setThrowing(null);
    setShaking(false);
    sfx.play("open");
  }, []);

  /** Applies an engine action; its events are replayed one by one, and a thrown precondition becomes a toast. */
  const act = useCallback<Act>(
    (action) => {
      if (!game) return null;
      try {
        const next = action(game);
        fromAct.current = true;
        setGame(next);
        soundsForTransition(game, next).forEach((name, i) => setTimeout(() => sfx.play(name), i * 140));
        enqueue(game, next);
        const landing = next.moves.at(-1)?.to;
        if (landing !== undefined) {
          setSelected(landing);
          setPinnedByUser(false);
        }
        return next;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    [game, enqueue],
  );

  actRef.current = act;

  const canRoll = game !== null && !busy && (game.phase.type === "awaitingRoll" || game.phase.type === "awaitingJailDecision");

  const startShake = useCallback(() => {
    if (!canRoll) return;
    setShaking(true);
  }, [canRoll]);

  const releaseDice = useCallback(() => {
    if (!shaking) return;
    setShaking(false);
    sfx.play("diceThrow");
    throwCounter.current += 1;
    setThrowing({ id: throwCounter.current, values: [rollDie(), rollDie()] });
  }, [shaking]);

  const onDiceSettled = useCallback(
    (id: number) => {
      if (!throwing || throwing.id !== id || !game) return;
      const values = throwing.values;
      setThrowing(null);
      act((s) => rollDice(s, undefined, values));
    },
    [throwing, game, act],
  );

  const onSelect = useCallback((index: number) => {
    setSelected((current) => {
      const next = current === index ? null : index;
      setPinnedByUser(next !== null);
      return next;
    });
  }, []);

  const closePanel = useCallback(() => {
    setSelected(null);
    setPinnedByUser(false);
  }, []);

  // Keyboard: space shakes/throws (or skips a replay), digits sit at a player's seat, 0/T/M views, L list, coma settings.
  useEffect(() => {
    if (!game) return;
    const onDown = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (playback.busy) {
          skip();
          return;
        }
        if (event.key === " " && !event.repeat) startShake();
        return;
      }
      if (event.key === "Escape") {
        setShowList(false);
        setShowSettings(false);
        closePanel();
        return;
      }
      const key = event.key.toLowerCase();
      if (key >= "1" && key <= "6") {
        const seat = seats[Number(key) - 1];
        if (seat) flyToSeat(seat.side);
      } else if (key === "0") flyTo(OVERVIEW);
      else if (key === "t") flyTo(TOP_DOWN);
      else if (key === "m") flyToSeat(currentSide);
      else if (key === "l") setShowList((v) => !v);
      else if (key === ",") setShowSettings((v) => !v);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key === " ") releaseDice();
    };
    // Losing focus mid-shake would otherwise leave the dice rattling forever.
    const onBlur = () => releaseDice();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [game, seats, startShake, releaseDice, flyTo, flyToSeat, currentSide, closePanel, playback.busy, skip]);

  const pawns = useMemo<readonly PawnView[]>(
    () =>
      game
        ? game.players.map((p) => ({
            id: p.id,
            color: p.color,
            position: p.position,
            route: walk?.playerId === p.id ? walk.route : null,
            routeId: walk?.playerId === p.id ? walk.id : 0,
            jump: walk?.playerId === p.id ? walk.jump : false,
            dimmed: p.bankrupt,
          }))
        : [],
    [game, walk],
  );

  const colorOf = useCallback((playerId: string) => game?.players.find((p) => p.id === playerId)?.color ?? "#000000", [game]);

  if (!game) return <Setup onStart={start} />;

  const shown = selected ?? hovered;
  const openList = () => setShowList(true);

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
        diceSide={currentSide}
        shaking={shaking}
        throwing={throwing}
        onDiceSettled={onDiceSettled}
      />
      <div className="left-column">
        <PlayersPanel state={game} cash={view.cash} onShowList={openList} />
        <LogPanel state={game} />
      </div>
      <SquarePanel
        state={game}
        square={shown === null ? null : getSquare(shown)}
        pinned={selected !== null}
        busy={busy}
        act={act}
        onClose={closePanel}
      />
      <ActionBar state={game} busy={busy} shaking={shaking} canRoll={canRoll} onShakeStart={startShake} onShakeEnd={releaseDice} act={act} />
      <div className="stage">
        <Banner state={game} event={playback.current} onSkip={skip} />
        <Prompt
          state={game}
          busy={busy}
          inspecting={pinnedByUser || showList || showSettings}
          countdownScale={settings.countdownScale}
          act={act}
          onNewGame={() => setGame(null)}
          onManage={openList}
        />
      </div>
      <CameraBar
        followTurn={settings.followTurn}
        onToggleFollow={() => setSettings((s) => ({ ...s, followTurn: !s.followTurn }))}
        onMySeat={() => flyToSeat(currentSide)}
        onOverview={() => flyTo(OVERVIEW)}
        onTopDown={() => flyTo(TOP_DOWN)}
        onSettings={() => setShowSettings(true)}
      />
      {showList && (
        <PropertiesList
          state={game}
          act={act}
          busy={busy}
          onClose={() => setShowList(false)}
          onSelect={(index) => {
            setSelected(index);
            setPinnedByUser(true);
            setShowList(false);
          }}
        />
      )}
      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

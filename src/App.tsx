import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, NewPlayer } from "./game";
import { createGame, currentPlayer, getSquare, roll } from "./game";
import type { PawnView, SeatView } from "./scene/Board";
import { BOARD_LAYOUT, SLAB_MARGIN } from "./scene/Board";
import type { CameraView } from "./scene/cameraViews";
import { OVERVIEW, TOP_DOWN, seatView } from "./scene/cameraViews";
import type { DiceThrow } from "./scene/Dice";
import { Scene } from "./scene/Scene";
import { seatSides } from "./scene/seats";
import type { Act } from "./ui/ActionBar";
import { ActionBar } from "./ui/ActionBar";
import { CameraBar } from "./ui/CameraBar";
import { LogPanel } from "./ui/LogPanel";
import { PlayersPanel } from "./ui/PlayersPanel";
import { PropertiesList } from "./ui/PropertiesList";
import { Setup } from "./ui/Setup";
import { SquarePanel } from "./ui/SquarePanel";

const ERROR_MS = 3_500;

declare global {
  interface Window {
    /** Dev-only hook to inspect or replace the game state from the console. */
    __chacarero?: { getGame: () => GameState | null; setGame: (state: GameState) => void };
  }
}

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function moved(before: GameState, after: GameState): boolean {
  const move = after.lastMove;
  return move !== null && move !== before.lastMove && move.from !== move.to;
}

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [throwing, setThrowing] = useState<DiceThrow | null>(null);
  const throwCounter = useRef(0);
  const [showList, setShowList] = useState(false);
  const [followTurn, setFollowTurn] = useState(true);
  const [goTo, setGoTo] = useState<{ id: number; view: CameraView } | null>(null);
  const goToCounter = useRef(0);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__chacarero = { getGame: () => game, setGame };
    return () => {
      delete window.__chacarero;
    };
  }, [game]);

  useEffect(() => {
    if (!error) return;
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
        cash: p.cash,
        inJail: p.inJail,
        jailCards: p.getOutOfJailCards,
        bankrupt: p.bankrupt,
        isCurrent: i === game.currentPlayerIndex,
      },
    }));
  }, [game]);

  const currentSide = game ? (seats[game.currentPlayerIndex]?.side ?? 0) : 0;

  const flyTo = useCallback((view: CameraView) => {
    goToCounter.current += 1;
    setGoTo({ id: goToCounter.current, view });
  }, []);

  const flyToSeat = useCallback((side: number) => flyTo(seatView(BOARD_LAYOUT, SLAB_MARGIN, side)), [flyTo]);

  // Sit at the current player's side whenever the turn changes (if following).
  const currentPlayerId = game ? currentPlayer(game).id : null;
  useEffect(() => {
    if (!game || !followTurn || currentPlayerId === null) return;
    flyToSeat(currentSide);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the player changing
  }, [currentPlayerId, followTurn, game === null]);

  const start = useCallback((players: readonly NewPlayer[]) => {
    setGame(createGame({ players }));
    setSelected(null);
    setBusy(false);
    setThrowing(null);
    setShaking(false);
  }, []);

  /** Applies an engine action; a thrown precondition becomes a toast instead of a crash. */
  const act = useCallback<Act>(
    (action) => {
      if (!game) return null;
      try {
        const next = action(game);
        setGame(next);
        if (moved(game, next)) {
          setBusy(true);
          setSelected(next.lastMove?.to ?? null);
        }
        return next;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    [game],
  );

  const canRoll = game !== null && !busy && !throwing && (game.phase.type === "awaitingRoll" || game.phase.type === "awaitingJailDecision");

  const startShake = useCallback(() => {
    if (!canRoll) return;
    setShaking(true);
  }, [canRoll]);

  const releaseDice = useCallback(() => {
    if (!shaking) return;
    setShaking(false);
    throwCounter.current += 1;
    setThrowing({ id: throwCounter.current, values: [rollDie(), rollDie()] });
    setBusy(true);
  }, [shaking]);

  const onDiceSettled = useCallback(
    (id: number) => {
      if (!throwing || throwing.id !== id || !game) return;
      const values = throwing.values;
      setThrowing(null);
      const next = act((s) => roll(s, undefined, values));
      if (!next || !moved(game, next)) setBusy(false);
    },
    [throwing, game, act],
  );

  const onPawnArrive = useCallback(() => setBusy(false), []);

  const onSelect = useCallback((index: number) => {
    setSelected((current) => (current === index ? null : index));
  }, []);

  // Keyboard: space shakes/throws, digits sit at a player's seat, 0/T/M views, L list.
  useEffect(() => {
    if (!game) return;
    const onDown = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      if (event.key === " ") {
        event.preventDefault();
        if (!event.repeat) startShake();
        return;
      }
      if (event.key === "Escape") {
        setShowList(false);
        setSelected(null);
        return;
      }
      const key = event.key.toLowerCase();
      if (key >= "1" && key <= "6") {
        const seat = seats[Number(key) - 1];
        if (seat) flyToSeat(seat.side);
      }
      else if (key === "0") flyTo(OVERVIEW);
      else if (key === "t") flyTo(TOP_DOWN);
      else if (key === "m") flyToSeat(currentSide);
      else if (key === "l") setShowList((v) => !v);
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
  }, [game, seats, startShake, releaseDice, flyTo, flyToSeat, currentSide]);

  const pawns = useMemo<readonly PawnView[]>(
    () =>
      game
        ? game.players.map((p) => ({
            id: p.id,
            color: p.color,
            position: p.position,
            moveKind: game.lastMove?.playerId === p.id ? game.lastMove.kind : "forward",
            dimmed: p.bankrupt,
          }))
        : [],
    [game],
  );

  const colorOf = useCallback((playerId: string) => game?.players.find((p) => p.id === playerId)?.color ?? "#000000", [game]);

  if (!game) return <Setup onStart={start} />;

  const shown = selected ?? hovered;

  return (
    <div className="app">
      <Scene
        hovered={hovered}
        selected={selected}
        onHover={setHovered}
        onSelect={onSelect}
        pawns={pawns}
        seats={seats}
        holdings={game.holdings}
        colorOf={colorOf}
        onPawnArrive={onPawnArrive}
        goTo={goTo}
        diceSide={currentSide}
        shaking={shaking}
        throwing={throwing}
        onDiceSettled={onDiceSettled}
      />
      <div className="left-column">
        <PlayersPanel state={game} onShowList={() => setShowList(true)} />
        <LogPanel state={game} />
      </div>
      <SquarePanel
        state={game}
        square={shown === null ? null : getSquare(shown)}
        pinned={selected !== null}
        busy={busy}
        act={act}
        onClose={() => setSelected(null)}
      />
      <ActionBar
        state={game}
        busy={busy}
        shaking={shaking}
        canRoll={canRoll}
        onShakeStart={startShake}
        onShakeEnd={releaseDice}
        act={act}
        onNewGame={() => setGame(null)}
      />
      <CameraBar
        followTurn={followTurn}
        onToggleFollow={() => setFollowTurn((v) => !v)}
        onMySeat={() => flyToSeat(currentSide)}
        onOverview={() => flyTo(OVERVIEW)}
        onTopDown={() => flyTo(TOP_DOWN)}
      />
      {showList && <PropertiesList state={game} onClose={() => setShowList(false)} onSelect={(index) => { setSelected(index); setShowList(false); }} />}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

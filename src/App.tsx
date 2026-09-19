import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameState, NewPlayer } from "./game";
import { createGame, getSquare } from "./game";
import type { PawnView } from "./scene/Board";
import { Scene } from "./scene/Scene";
import type { Act } from "./ui/ActionBar";
import { ActionBar } from "./ui/ActionBar";
import { LogPanel } from "./ui/LogPanel";
import { PlayersPanel } from "./ui/PlayersPanel";
import { Setup } from "./ui/Setup";
import { SquarePanel } from "./ui/SquarePanel";

const ERROR_MS = 3_500;

declare global {
  interface Window {
    /** Dev-only hook to inspect or replace the game state from the console. */
    __chacarero?: { getGame: () => GameState | null; setGame: (state: GameState) => void };
  }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

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

  const start = useCallback((players: readonly NewPlayer[]) => {
    setGame(createGame({ players }));
    setSelected(null);
    setBusy(false);
  }, []);

  /** Applies an engine action; a thrown precondition becomes a toast instead of a crash. */
  const act = useCallback<Act>(
    (action) => {
      if (!game) return;
      try {
        const next = action(game);
        setGame(next);
        const move = next.lastMove;
        if (move && move !== game.lastMove && move.from !== move.to) {
          setBusy(true);
          setSelected(move.to);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [game],
  );

  const onPawnArrive = useCallback(() => setBusy(false), []);

  const onSelect = useCallback((index: number) => {
    setSelected((current) => (current === index ? null : index));
  }, []);

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
        holdings={game.holdings}
        colorOf={colorOf}
        onPawnArrive={onPawnArrive}
      />
      <PlayersPanel state={game} />
      <LogPanel state={game} />
      <SquarePanel
        state={game}
        square={shown === null ? null : getSquare(shown)}
        pinned={selected !== null}
        busy={busy}
        act={act}
        onClose={() => setSelected(null)}
      />
      <ActionBar state={game} busy={busy} act={act} onNewGame={() => setGame(null)} />
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

import { useCallback, useState } from "react";
import { getSquare } from "./game";
import type { PawnState } from "./scene/Board";
import { Scene } from "./scene/Scene";
import { Hud } from "./ui/Hud";
import { SquarePanel } from "./ui/SquarePanel";

const PLAYER_PAWN: PawnState = { id: "jugador", color: "#1d4ed8", steps: 0 };

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export default function App() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pawn, setPawn] = useState<PawnState>(PLAYER_PAWN);
  const [dice, setDice] = useState<readonly [number, number] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);

  const roll = useCallback(() => {
    if (rolling) return;
    const result: [number, number] = [rollDie(), rollDie()];
    setDice(result);
    setRolling(true);
    setLanded(null);
    setPawn((current) => ({ ...current, steps: current.steps + result[0] + result[1] }));
  }, [rolling]);

  const onPawnArrive = useCallback((_pawnId: string, square: number) => {
    setRolling(false);
    setLanded(square);
    setSelected(square);
  }, []);

  const onSelect = useCallback((index: number) => {
    setSelected((current) => (current === index ? null : index));
  }, []);

  const shown = selected ?? hovered;

  return (
    <div className="app">
      <Scene
        hovered={hovered}
        selected={selected}
        onHover={setHovered}
        onSelect={onSelect}
        pawns={[pawn]}
        onPawnArrive={onPawnArrive}
      />
      <Hud dice={dice} rolling={rolling} landed={landed === null ? null : getSquare(landed)} onRoll={roll} />
      <SquarePanel square={shown === null ? null : getSquare(shown)} pinned={selected !== null} onClose={() => setSelected(null)} />
    </div>
  );
}

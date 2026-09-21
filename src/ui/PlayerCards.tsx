import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "../game";
import { currentPlayer, pesos } from "../game";
import { partyKey } from "./partyKey";
import { TokenIcon } from "./TokenIcon";

export interface PlayerCardsProps {
  readonly state: GameState;
  /** Cash as the table shows it right now (lags the real state during a replay). */
  readonly cash: Readonly<Record<string, number>>;
  readonly you: string | null;
  readonly offline: ReadonlySet<string>;
}

const COUNT_MS = 650;

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/** Tweens a number towards `value` so the cash figure counts instead of jumping. */
function useCountingNumber(value: number): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const start = useRef(0);
  useEffect(() => {
    if (shown === value) return;
    from.current = shown;
    start.current = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start.current) / COUNT_MS);
      const next = from.current + (value - from.current) * easeOutCubic(k);
      setShown(k >= 1 ? value : Math.round(next / 10) * 10);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart the tween only when the target moves
  }, [value]);
  return shown;
}

interface CardProps {
  readonly player: GameState["players"][number];
  readonly cash: number;
  readonly isCurrent: boolean;
  readonly isYou: boolean;
  readonly away: boolean;
}

function PlayerCard({ player, cash, isCurrent, isYou, away }: CardProps) {
  const shown = useCountingNumber(player.bankrupt ? 0 : cash);
  const classes = ["player-card", isCurrent ? "current" : "", player.bankrupt ? "bankrupt" : "", away ? "away" : "", isYou ? "you" : ""].filter(Boolean).join(" ");
  const status = player.bankrupt ? "quebró" : [player.inJail ? "preso" : "", away ? "ausente" : "", player.getOutOfJailCards > 0 ? `🎫${player.getOutOfJailCards}` : ""].filter(Boolean).join(" · ");
  return (
    <div className={classes} data-party={partyKey({ type: "player", playerId: player.id })} style={{ "--player-color": player.color } as CSSProperties}>
      <TokenIcon token={player.token} size={40} className="pc-token" />
      <div className="pc-body">
        <div className="pc-name">
          {player.name}
          {isYou && <span className="pc-you">vos</span>}
        </div>
        <div className="pc-cash">{player.bankrupt ? "—" : pesos(shown)}</div>
        {status && <div className="pc-status">{status}</div>}
      </div>
    </div>
  );
}

/**
 * The row of player cards floating at the bottom of the screen: token,
 * name, cash and status per player, the one on turn lit up, plus the bank
 * at the end so money flights have somewhere to go.
 */
export function PlayerCards({ state, cash, you, offline }: PlayerCardsProps) {
  const current = currentPlayer(state);
  return (
    <div className="player-cards">
      {state.players.map((player) => (
        <PlayerCard key={player.id} player={player} cash={cash[player.id] ?? player.cash} isCurrent={player.id === current.id} isYou={player.id === you} away={offline.has(player.id)} />
      ))}
      <div className="player-card bank" data-party={partyKey({ type: "bank" })}>
        <span className="pc-bank-icon">🏦</span>
        <div className="pc-body">
          <div className="pc-name">Banco</div>
          <div className="pc-status">
            {state.bank.chacras} chacras · {state.bank.estancias} estancias
          </div>
        </div>
      </div>
    </div>
  );
}

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "../game";
import { kickVotesNeeded, pesos } from "../game";
import type { KickVote } from "../net/protocol";
import { partyKey } from "./partyKey";
import { TokenIcon } from "./TokenIcon";

export interface PlayerCardsProps {
  readonly state: GameState;
  /** Cash as the table shows it right now (lags the real state during a replay). */
  readonly cash: Readonly<Record<string, number>>;
  /** Whose turn the table shows (lags the same way). */
  readonly currentId: string;
  readonly you: string | null;
  readonly offline: ReadonlySet<string>;
  /** Look at that player's side of the table (their deeds and money). */
  readonly onFocus: (playerId: string) => void;
  /** The vote in progress to take an absent player out. */
  readonly kickVote: KickVote | null;
  /** Votes on taking an absent player out; null where the table cannot vote (hot-seat). */
  readonly onVoteKick: ((targetId: string, yes: boolean) => void) | null;
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
  /** 1-based seat number: the key that also looks at this player. */
  readonly seat: number;
  readonly onFocus: () => void;
}

function PlayerCard({ player, cash, isCurrent, isYou, away, seat, onFocus }: CardProps) {
  const shown = useCountingNumber(player.bankrupt ? 0 : cash);
  const classes = ["player-card", isCurrent ? "current" : "", player.bankrupt ? "bankrupt" : "", away ? "away" : "", isYou ? "you" : ""].filter(Boolean).join(" ");
  const status = player.expelled ? "afuera" : player.bankrupt ? "quebró" : [player.inJail ? "preso" : "", away ? "ausente" : "", player.getOutOfJailCards > 0 ? `🎫${player.getOutOfJailCards}` : ""].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      className={classes}
      data-party={partyKey({ type: "player", playerId: player.id })}
      style={{ "--player-color": player.color } as CSSProperties}
      title={`Ver lo que tiene ${player.name} [${seat}]`}
      onClick={onFocus}
    >
      <TokenIcon token={player.token} size={40} className="pc-token" />
      <div className="pc-body">
        <div className="pc-name">
          {player.name}
          {isYou && <span className="pc-you">vos</span>}
        </div>
        <div className="pc-cash">{player.bankrupt ? "—" : pesos(shown)}</div>
        {status && <div className="pc-status">{status}</div>}
      </div>
      <kbd className="key pc-key">{seat}</kbd>
    </button>
  );
}

/** Above an absent player's card: the way to start a vote to take them out. No key on purpose: nobody should be voted out by a stray keystroke. */
function KickStart({ name, onStart }: { readonly name: string; readonly onStart: () => void }) {
  return (
    <button type="button" className="kick-start" title={`${name} no está: la mesa puede votar para sacarlo de la partida (lo suyo vuelve al Banco)`} onClick={onStart}>
      Votar para sacarlo
    </button>
  );
}

/** The vote in progress, above the absent player's card: the count and this screen's yes / no. */
function KickBubble({ state, name, vote, you, onVote }: { readonly state: GameState; readonly name: string; readonly vote: KickVote; readonly you: string | null; readonly onVote: (yes: boolean) => void }) {
  const needed = kickVotesNeeded(state, vote.targetId);
  const mine = you === null ? null : vote.yes.includes(you) ? "sí" : vote.no.includes(you) ? "no" : null;
  return (
    <div className="kick-bubble" role="group" aria-label={`Votación para sacar a ${name}`}>
      <p>
        ¿Sacamos a <strong>{name}</strong>? Lo suyo vuelve al Banco.
      </p>
      <p className="kick-count">
        {vote.yes.length} de {needed} votos
        {vote.no.length > 0 && ` · ${vote.no.length} en contra`}
      </p>
      {mine === null ? (
        <div className="kick-buttons">
          <button type="button" className="danger" onClick={() => onVote(true)}>
            Sí, sacarlo
          </button>
          <button type="button" onClick={() => onVote(false)}>
            No, esperarlo
          </button>
        </div>
      ) : (
        <p className="kick-count">Votaste {mine}.</p>
      )}
    </div>
  );
}

/**
 * The row of player cards floating at the bottom of the screen: token,
 * name, cash and status per player, the one on turn lit up, plus the bank
 * at the end so money flights have somewhere to go.
 */
export function PlayerCards({ state, cash, currentId, you, offline, onFocus, kickVote, onVoteKick }: PlayerCardsProps) {
  // Only someone still in the game has a say.
  const canVote = onVoteKick !== null && you !== null && state.phase.type !== "gameOver" && state.players.some((p) => p.id === you && !p.bankrupt);
  return (
    <div className="player-cards">
      {state.players.map((player, i) => {
        const away = offline.has(player.id);
        const votable = canVote && away && !player.bankrupt && player.id !== you;
        return (
          <div key={player.id} className="player-seat">
            {votable && onVoteKick && (kickVote?.targetId === player.id ? <KickBubble state={state} name={player.name} vote={kickVote} you={you} onVote={(yes) => onVoteKick(player.id, yes)} /> : kickVote === null && <KickStart name={player.name} onStart={() => onVoteKick(player.id, true)} />)}
            <PlayerCard player={player} cash={cash[player.id] ?? player.cash} isCurrent={player.id === currentId} isYou={player.id === you} away={away} seat={i + 1} onFocus={() => onFocus(player.id)} />
          </div>
        );
      })}
      <div className="player-card bank" data-party={partyKey({ type: "bank" })}>
        <span className="pc-bank-icon">🏦</span>
        <div className="pc-body">
          <div className="pc-name">Banco</div>
        </div>
      </div>
    </div>
  );
}

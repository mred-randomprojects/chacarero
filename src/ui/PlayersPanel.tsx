import type { GameState } from "../game";
import { currentPlayer, pesos } from "../game";

/** Top-left list of players with cash and status; the current one is highlighted. */
export function PlayersPanel({ state }: { readonly state: GameState }) {
  const current = currentPlayer(state);
  return (
    <div className="players">
      <h1>Chacarero</h1>
      <ul>
        {state.players.map((player) => (
          <li key={player.id} className={`${player.id === current.id ? "current" : ""} ${player.bankrupt ? "bankrupt" : ""}`}>
            <span className="dot" style={{ background: player.color }} />
            <span className="name">{player.name}</span>
            <span className="status">
              {player.bankrupt ? "quebró" : player.inJail ? "preso" : ""}
              {player.getOutOfJailCards > 0 && !player.bankrupt ? ` 🎫${player.getOutOfJailCards}` : ""}
            </span>
            <span className="cash">{player.bankrupt ? "—" : pesos(player.cash)}</span>
          </li>
        ))}
      </ul>
      <p className="turn">Turno {state.turn}</p>
    </div>
  );
}

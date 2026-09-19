import type { Deed, GameState, Square } from "../game";
import {
  PROVINCE_COLORS,
  buildChacra,
  buildEstancia,
  canBuildChacra,
  canBuildEstancia,
  canMortgage,
  canSellBuilding,
  canUnmortgage,
  currentPlayer,
  describeSquare,
  getDeed,
  getPlayer,
  mortgage,
  mortgageProceeds,
  pesos,
  sellBuilding,
  sellValue,
  unmortgage,
  unmortgageCost,
} from "../game";
import type { Act } from "./ActionBar";

export interface SquarePanelProps {
  readonly state: GameState;
  readonly square: Square | null;
  readonly pinned: boolean;
  readonly busy: boolean;
  readonly act: Act;
  readonly onClose: () => void;
}

function DeedDetails({ deed }: { readonly deed: Deed }) {
  if (deed.kind === "campo") {
    return (
      <table className="rent">
        <tbody>
          <tr>
            <th>Campo solo</th>
            <td>{pesos(deed.rent.campo)}</td>
          </tr>
          {deed.rent.chacras.map((rent, i) => (
            <tr key={i}>
              <th>
                {i + 1} {i === 0 ? "chacra" : "chacras"}
              </th>
              <td>{pesos(rent)}</td>
            </tr>
          ))}
          <tr>
            <th>Estancia</th>
            <td>{pesos(deed.rent.estancia)}</td>
          </tr>
          <tr className="sep">
            <th>Cada chacra</th>
            <td>{pesos(deed.chacraCost)}</td>
          </tr>
          <tr>
            <th>Estancia (más 4 chacras)</th>
            <td>{pesos(deed.estanciaCost)}</td>
          </tr>
          <tr>
            <th>Hipoteca</th>
            <td>{pesos(deed.mortgage)}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (deed.kind === "ferrocarril") {
    return (
      <table className="rent">
        <tbody>
          {deed.rentByCount.map((rent, i) => (
            <tr key={i}>
              <th>
                Con {i + 1} {i === 0 ? "ferrocarril" : "ferrocarriles"}
              </th>
              <td>{pesos(rent)}</td>
            </tr>
          ))}
          <tr className="sep">
            <th>Hipoteca</th>
            <td>{pesos(deed.mortgage)}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  return (
    <table className="rent">
      <tbody>
        {deed.diceMultiplierByCount.map((mult, i) => (
          <tr key={i}>
            <th>
              Con {i + 1} {i === 0 ? "compañía" : "compañías"}
            </th>
            <td>dados × {mult}</td>
          </tr>
        ))}
        <tr className="sep">
          <th>Hipoteca</th>
          <td>{pesos(deed.mortgage)}</td>
        </tr>
      </tbody>
    </table>
  );
}

interface OwnerActionsProps {
  readonly state: GameState;
  readonly deed: Deed;
  readonly busy: boolean;
  readonly act: Act;
}

/** Build / sell / mortgage buttons, shown when the current player owns the deed. */
function OwnerActions({ state, deed, busy, act }: OwnerActionsProps) {
  const player = currentPlayer(state);
  const holding = state.holdings[deed.id];
  if (!holding || holding.ownerId !== player.id || state.phase.type === "gameOver") return null;
  const chacra = canBuildChacra(state, player, deed.id);
  const estancia = canBuildEstancia(state, player, deed.id);
  const sell = canSellBuilding(state, player, deed.id);
  const mort = canMortgage(state, player, deed.id);
  const unmort = canUnmortgage(state, player, deed.id);
  const blockers = [
    deed.kind === "campo" && !chacra.ok && !holding.estancia ? `Chacra: ${chacra.reason}` : null,
    deed.kind === "campo" && !estancia.ok && holding.chacras === 4 ? `Estancia: ${estancia.reason}` : null,
    !holding.mortgaged && !mort.ok ? `Hipoteca: ${mort.reason}` : null,
  ].filter((b): b is string => b !== null);
  return (
    <div className="owner-actions">
      {deed.kind === "campo" && (
        <>
          <button type="button" disabled={busy || !chacra.ok} title={chacra.ok ? "" : chacra.reason} onClick={() => act((s) => buildChacra(s, deed.id))}>
            Chacra +{pesos(deed.chacraCost)}
          </button>
          <button type="button" disabled={busy || !estancia.ok} title={estancia.ok ? "" : estancia.reason} onClick={() => act((s) => buildEstancia(s, deed.id))}>
            Estancia +{pesos(deed.estanciaCost)}
          </button>
          <button type="button" disabled={busy || !sell.ok} title={sell.ok ? "" : sell.reason} onClick={() => act((s) => sellBuilding(s, deed.id))}>
            Vender {holding.estancia ? "estancia" : "chacra"} {sell.ok ? `(${pesos(sellValue(deed, holding))})` : ""}
          </button>
        </>
      )}
      {holding.mortgaged ? (
        <button type="button" disabled={busy || !unmort.ok} title={unmort.ok ? "" : unmort.reason} onClick={() => act((s) => unmortgage(s, deed.id))}>
          Levantar hipoteca ({pesos(unmortgageCost(deed.id))})
        </button>
      ) : (
        <button type="button" disabled={busy || !mort.ok} title={mort.ok ? "" : mort.reason} onClick={() => act((s) => mortgage(s, deed.id))}>
          Hipotecar (+{pesos(mortgageProceeds(deed.id))})
        </button>
      )}
      {blockers.length > 0 && (
        <ul className="blockers">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Side panel describing the hovered or selected square, with owner actions. */
export function SquarePanel({ state, square, pinned, busy, act, onClose }: SquarePanelProps) {
  if (!square) {
    return (
      <aside className="panel panel-empty">
        <p>Pasá el mouse por un casillero para ver su escritura. Hacé clic para fijarla.</p>
      </aside>
    );
  }
  const deed = square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania" ? getDeed(square.deedId) : null;
  const holding = deed ? state.holdings[deed.id] : undefined;
  const owner = holding ? getPlayer(state, holding.ownerId) : null;
  const band = deed?.kind === "campo" ? PROVINCE_COLORS[deed.province] : deed?.kind === "ferrocarril" ? "#2b2b2b" : deed ? "#7a5230" : "#1f5e2e";

  return (
    <aside className={`panel${pinned ? " pinned" : ""}`}>
      <div className="panel-band" style={{ background: band }} />
      <header>
        <span className="badge">{square.index}</span>
        <h2>{square.name}</h2>
        {pinned && (
          <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        )}
      </header>
      {deed && (
        <p className="price">
          Valor <strong>{pesos(deed.price)}</strong>
          {owner && (
            <span className="owner">
              {" · "}
              <span className="dot" style={{ background: owner.color }} /> {owner.name}
              {holding?.mortgaged ? " (hipotecada)" : ""}
              {holding?.estancia ? " · estancia" : holding && holding.chacras > 0 ? ` · ${holding.chacras} chacra${holding.chacras > 1 ? "s" : ""}` : ""}
            </span>
          )}
        </p>
      )}
      <p className="description">{describeSquare(square)}</p>
      {deed && <OwnerActions state={state} deed={deed} busy={busy} act={act} />}
      {deed && <DeedDetails deed={deed} />}
    </aside>
  );
}

import type { Deed, Square } from "../game";
import { PROVINCE_COLORS, describeSquare, getDeed, pesos } from "../game";

export interface SquarePanelProps {
  readonly square: Square | null;
  readonly pinned: boolean;
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

/** Side panel describing the hovered or selected square. */
export function SquarePanel({ square, pinned, onClose }: SquarePanelProps) {
  if (!square) {
    return (
      <aside className="panel panel-empty">
        <p>Pasá el mouse por un casillero para ver su escritura. Hacé clic para fijarla.</p>
      </aside>
    );
  }
  const deed = square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania" ? getDeed(square.deedId) : null;
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
        </p>
      )}
      <p className="description">{describeSquare(square)}</p>
      {deed && <DeedDetails deed={deed} />}
    </aside>
  );
}

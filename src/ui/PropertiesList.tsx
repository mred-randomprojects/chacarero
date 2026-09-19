import type { GameState, Province } from "../game";
import { DEEDS, PROVINCE_COLORS, PROVINCE_NAMES, SQUARES, deedName, getPlayer, pesos, provinceOwner, rentFor } from "../game";

export interface PropertiesListProps {
  readonly state: GameState;
  readonly onClose: () => void;
  readonly onSelect: (squareIndex: number) => void;
}

const SQUARE_INDEX = new Map(
  SQUARES.flatMap((square) => (square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania" ? [[square.deedId, square.index] as const] : [])),
);

/** Modal with every deed on the board: owner, buildings, mortgage and the rent a visitor would pay now. */
export function PropertiesList({ state, onClose, onSelect }: PropertiesListProps) {
  const groups: { readonly label: string; readonly color: string; readonly ids: readonly (typeof DEEDS)[number]["id"][] }[] = [];
  const byProvince = new Map<Province, (typeof DEEDS)[number]["id"][]>();
  for (const deed of DEEDS) {
    if (deed.kind !== "campo") continue;
    const list = byProvince.get(deed.province) ?? [];
    list.push(deed.id);
    byProvince.set(deed.province, list);
  }
  for (const [province, ids] of byProvince) {
    const owner = provinceOwner(state, province);
    const suffix = owner ? ` — completa: ${getPlayer(state, owner).name}` : "";
    groups.push({ label: `${PROVINCE_NAMES[province]}${suffix}`, color: PROVINCE_COLORS[province], ids });
  }
  groups.push({ label: "Ferrocarriles", color: "#2b2b2b", ids: DEEDS.filter((d) => d.kind === "ferrocarril").map((d) => d.id) });
  groups.push({ label: "Compañías", color: "#7a5230", ids: DEEDS.filter((d) => d.kind === "compania").map((d) => d.id) });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Propiedades</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal-body">
          {groups.map((group) => (
            <section key={group.label}>
              <h3>
                <span className="swatch" style={{ background: group.color }} /> {group.label}
              </h3>
              <table>
                <tbody>
                  {group.ids.map((id) => {
                    const deed = DEEDS.find((d) => d.id === id);
                    if (!deed) return null;
                    const holding = state.holdings[id];
                    const owner = holding ? getPlayer(state, holding.ownerId) : null;
                    const buildings = holding?.estancia ? "estancia" : holding && holding.chacras > 0 ? `${holding.chacras} chacra${holding.chacras > 1 ? "s" : ""}` : "";
                    const rent = owner ? rentFor(state, id, "__visitor__", 7) : 0;
                    return (
                      <tr key={id} onClick={() => onSelect(SQUARE_INDEX.get(id) ?? 0)}>
                        <td className="name">{deedName(deed)}</td>
                        <td className="price">{pesos(deed.price)}</td>
                        <td className="owner">
                          {owner ? (
                            <>
                              <span className="dot" style={{ background: owner.color }} /> {owner.name}
                            </>
                          ) : (
                            <span className="free">libre</span>
                          )}
                        </td>
                        <td className="state">
                          {holding?.mortgaged ? <span className="mortgaged">hipotecada</span> : buildings}
                        </td>
                        <td className="rent">{owner && !holding?.mortgaged ? `alq. ${deed.kind === "compania" ? "dados × " + (rent / 7) : pesos(rent)}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

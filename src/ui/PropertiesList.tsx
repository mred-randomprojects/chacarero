import type { GameState, Province } from "../game";
import {
  DEEDS,
  PROVINCE_COLORS,
  PROVINCE_NAMES,
  SQUARES,
  activePlayer,
  canBuildChacra,
  canBuildEstancia,
  canMortgage,
  canSellBuilding,
  canUnmortgage,
  deedName,
  getPlayer,
  mortgageProceeds,
  pesos,
  provinceOwner,
  rentFor,
  unmortgageCost,
} from "../game";
import type { Dispatch } from "./ActionBar";

export interface PropertiesListProps {
  readonly state: GameState;
  readonly onClose: () => void;
  readonly onSelect: (squareIndex: number) => void;
  /** When given, the active player's rows get build/sell/mortgage buttons. */
  readonly dispatch?: Dispatch;
  readonly you?: string | null;
  readonly busy?: boolean;
}

const SQUARE_INDEX = new Map(
  SQUARES.flatMap((square) => (square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania" ? [[square.deedId, square.index] as const] : [])),
);

/** Modal with every deed on the board: owner, buildings, mortgage and the rent a visitor would pay now. */
export function PropertiesList({ state, onClose, onSelect, dispatch, you = null, busy = false }: PropertiesListProps) {
  const canManage = dispatch !== undefined && state.phase.type !== "auction" && state.phase.type !== "gameOver";
  const active = canManage ? activePlayer(state) : null;
  const me = active && (you === null || active.id === you) ? active : null;
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
                        {me && (
                          <td className="quick" onClick={(event) => event.stopPropagation()}>
                            {holding && holding.ownerId === me.id && dispatch && (
                              <QuickActions state={state} me={me} deedId={id} dispatch={dispatch} busy={busy} />
                            )}
                          </td>
                        )}
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

interface QuickActionsProps {
  readonly state: GameState;
  readonly me: ReturnType<typeof activePlayer>;
  readonly deedId: (typeof DEEDS)[number]["id"];
  readonly dispatch: Dispatch;
  readonly busy: boolean;
}

/** Compact build / sell / mortgage buttons for one of the active player's deeds. */
function QuickActions({ state, me, deedId, dispatch, busy }: QuickActionsProps) {
  const deed = DEEDS.find((d) => d.id === deedId);
  const holding = state.holdings[deedId];
  if (!deed || !holding) return null;
  const chacra = canBuildChacra(state, me, deedId);
  const estancia = canBuildEstancia(state, me, deedId);
  const sell = canSellBuilding(state, me, deedId);
  const mort = canMortgage(state, me, deedId);
  const unmort = canUnmortgage(state, me, deedId);
  return (
    <span className="quick-actions">
      {deed.kind === "campo" && (
        <>
          <button type="button" disabled={busy || !chacra.ok} title={chacra.ok ? `Chacra: ${pesos(deed.chacraCost)}` : chacra.reason} onClick={() => dispatch({ type: "buildChacra", deedId })}>
            +🏠
          </button>
          <button type="button" disabled={busy || !estancia.ok} title={estancia.ok ? `Estancia: ${pesos(deed.estanciaCost)}` : estancia.reason} onClick={() => dispatch({ type: "buildEstancia", deedId })}>
            +🏡
          </button>
          <button type="button" disabled={busy || !sell.ok} title={sell.ok ? "Vender una construcción (mitad de precio)" : sell.reason} onClick={() => dispatch({ type: "sellBuilding", deedId })}>
            −🏠
          </button>
        </>
      )}
      {holding.mortgaged ? (
        <button type="button" disabled={busy || !unmort.ok} title={unmort.ok ? `Levantar hipoteca: ${pesos(unmortgageCost(deedId))}` : unmort.reason} onClick={() => dispatch({ type: "unmortgage", deedId })}>
          Levantar {pesos(unmortgageCost(deedId))}
        </button>
      ) : (
        <button type="button" disabled={busy || !mort.ok} title={mort.ok ? `Hipotecar: recibís ${pesos(mortgageProceeds(deedId))}` : mort.reason} onClick={() => dispatch({ type: "mortgage", deedId })}>
          Hipotecar +{pesos(mortgageProceeds(deedId))}
        </button>
      )}
    </span>
  );
}

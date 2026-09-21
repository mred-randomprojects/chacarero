import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { Deed, DeedId, GameState, Player, Trade, TradeOffer } from "../game";
import { DEEDS, PROVINCE_NAMES, ZONE_NAMES, canTradeDeed, checkTrade, deedName, getDeed, getPlayer, mortgageTransferFee, pesos, tradeBalance } from "../game";
import { bandColor } from "../scene/cardTextures";
import type { Dispatch } from "./ActionBar";
import { DeedDetails } from "./DeedDetails";
import { TokenIcon } from "./TokenIcon";

/** A trade being put together on this screen, before it is sent. */
export interface TradeDraft {
  /** Who is putting the offer together: the proposer, or the responder making a counter-offer. */
  readonly me: string;
  /** The other party; null lets the proposer pick one. */
  readonly partnerId: string | null;
  /** What `me` hands over. */
  readonly gives: TradeOffer;
  /** What `me` asks for. */
  readonly receives: TradeOffer;
  /** Answering a proposal with a different deal: the partner is fixed and the button says so. */
  readonly counter: boolean;
}

export type TradeScreenMode =
  | { readonly kind: "compose"; readonly draft: TradeDraft }
  /** A proposal on the table, seen by the player who must answer it (or by the proposer, who may withdraw). */
  | { readonly kind: "review"; readonly trade: Trade };

export interface TradeScreenProps {
  readonly state: GameState;
  readonly mode: TradeScreenMode;
  readonly you: string | null;
  readonly busy: boolean;
  readonly dispatch: Dispatch;
  readonly onSubmit: (toId: string, gives: TradeOffer, receives: TradeOffer) => void;
  /** Review mode: answer with a different deal. */
  readonly onCounter: () => void;
  readonly onClose: () => void;
}

const CASH_STEPS = [500, 1_000, 5_000] as const;

/** Face value of one side: the deeds' printed prices plus the cash. What was actually paid never matters. */
function offerValue(offer: TradeOffer): number {
  return offer.deeds.reduce((sum, id) => sum + getDeed(id).price, 0) + offer.cash;
}

// ---------- the fixed grid every deed has a slot in ----------

interface Slot {
  readonly deed: Deed;
  readonly column: number;
  readonly row: number;
}

const PROVINCE_ORDER = ["formosa", "rioNegro", "salta", "mendoza", "santaFe", "tucuman", "cordoba", "buenosAires"] as const;
const ZONE_ROW = { sur: 0, centro: 1, norte: 2 } as const;

/** Columns are provinces in board order, then the railways and the companies; rows are zones. Same for every player. */
const SLOTS: readonly Slot[] = (() => {
  const slots: Slot[] = [];
  let rail = 0;
  let company = 0;
  for (const deed of DEEDS) {
    if (deed.kind === "campo") {
      const column = PROVINCE_ORDER.indexOf(deed.province);
      // Two-zone provinces skip the middle row so "norte" always sits on top.
      const row = deed.province === "rioNegro" || deed.province === "tucuman" ? (deed.zone === "sur" ? 0 : 2) : ZONE_ROW[deed.zone];
      slots.push({ deed, column, row });
    } else if (deed.kind === "ferrocarril") slots.push({ deed, column: 8, row: rail++ });
    else slots.push({ deed, column: 9, row: company++ });
  }
  return slots;
})();
const GRID_COLUMNS = 10;
const GRID_ROWS = 4;

function shortName(deed: Deed): string {
  if (deed.kind === "campo") return ZONE_NAMES[deed.zone].replace("Zona ", "");
  return deed.name.replace(/^Ferrocarril General /, "").replace(/^Compañía /, "").replace("Bartolomé ", "B. ");
}

function columnLabel(column: number): string {
  if (column === 8) return "FF.CC.";
  if (column === 9) return "Cías.";
  const province = PROVINCE_ORDER[column];
  return province ? PROVINCE_NAMES[province].replace("Buenos Aires", "Bs. As.") : "";
}

interface DeedGridProps {
  readonly state: GameState;
  readonly owner: Player;
  readonly selected: readonly DeedId[];
  /** Null makes the grid read-only (review mode). */
  readonly onToggle: ((id: DeedId) => void) | null;
  readonly onHover: (id: DeedId | null) => void;
}

/**
 * The player's deeds as a minimap: every deed of the game has a fixed slot,
 * lit when this player holds it, a ghost otherwise. Hover shows the card
 * big; a click puts it on (or takes it off) the table.
 */
function DeedGrid({ state, owner, selected, onToggle, onHover }: DeedGridProps) {
  return (
    <div className="deed-grid" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`, gridTemplateRows: `auto repeat(${GRID_ROWS}, 1fr)` }} onMouseLeave={() => onHover(null)}>
      {Array.from({ length: GRID_COLUMNS }, (_, column) => (
        <div key={column} className="deed-grid-label" style={{ gridColumn: column + 1, gridRow: 1 }}>
          {columnLabel(column)}
        </div>
      ))}
      {SLOTS.map(({ deed, column, row }) => {
        const holding = state.holdings[deed.id];
        const owned = holding?.ownerId === owner.id;
        const tradeable = owned ? canTradeDeed(state, deed.id) : null;
        const blocked = tradeable !== null && !tradeable.ok;
        const picked = selected.includes(deed.id);
        const style = { gridColumn: column + 1, gridRow: GRID_ROWS + 1 - row, "--band": bandColor(deed) } as CSSProperties;
        if (!owned) {
          return <div key={deed.id} className="deed-slot ghost" style={style} title={`${deedName(deed)}: ${holding ? `de ${getPlayer(state, holding.ownerId).name}` : "libre"}`} />;
        }
        return (
          <button
            key={deed.id}
            type="button"
            className={`deed-slot owned${picked ? " picked" : ""}${blocked ? " blocked" : ""}${holding?.mortgaged ? " mortgaged" : ""}${onToggle === null ? " static" : ""}`}
            style={style}
            title={blocked ? `${deedName(deed)}: ${tradeable.reason}` : deedName(deed)}
            disabled={blocked}
            onMouseEnter={() => onHover(deed.id)}
            onFocus={() => onHover(deed.id)}
            onClick={() => onToggle?.(deed.id)}
          >
            <span className="deed-slot-band" />
            <span className="deed-slot-name">{shortName(deed)}</span>
            <span className="deed-slot-price">{pesos(deed.price)}</span>
            {holding?.mortgaged && <span className="deed-slot-flag">HIP.</span>}
            {picked && <span className="deed-slot-check">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------- one side of the table ----------

interface SideProps {
  readonly state: GameState;
  readonly owner: Player;
  readonly title: string;
  readonly offer: TradeOffer;
  readonly onChange: ((offer: TradeOffer) => void) | null;
  readonly onHover: (id: DeedId | null) => void;
}

function Side({ state, owner, title, offer, onChange, onHover }: SideProps) {
  const toggle = (id: DeedId) => onChange?.({ ...offer, deeds: offer.deeds.includes(id) ? offer.deeds.filter((d) => d !== id) : [...offer.deeds, id] });
  const setCash = (cash: number) => onChange?.({ ...offer, cash: Math.min(owner.cash, Math.max(0, Math.floor(cash))) });
  const value = offerValue(offer);
  return (
    <section className="trade-side-panel" style={{ "--player-color": owner.color } as CSSProperties}>
      <header>
        <TokenIcon token={owner.token} size={34} />
        <div>
          <h3>{title}</h3>
          <p>
            {owner.name} · tiene {pesos(owner.cash)}
          </p>
        </div>
      </header>
      <DeedGrid state={state} owner={owner} selected={offer.deeds} onToggle={onChange ? toggle : null} onHover={onHover} />
      <div className="trade-cash">
        <label>
          <span>Plata</span>
          <input type="number" inputMode="numeric" min={0} max={owner.cash} step={100} value={offer.cash === 0 ? "" : offer.cash} placeholder="0" disabled={!onChange} onChange={(e) => setCash(Number(e.target.value) || 0)} />
        </label>
        {onChange && (
          <div className="cash-steps">
            {CASH_STEPS.map((step) => (
              <button key={step} type="button" disabled={offer.cash + step > owner.cash} onClick={() => setCash(offer.cash + step)}>
                +{pesos(step)}
              </button>
            ))}
            <button type="button" disabled={offer.cash === 0} onClick={() => setCash(0)}>
              Nada
            </button>
          </div>
        )}
      </div>
      <ul className="trade-picked">
        {offer.deeds.map((id) => (
          <li key={id}>
            <span className="swatch" style={{ background: bandColor(getDeed(id)) }} />
            {deedName(getDeed(id))}
            {state.holdings[id]?.mortgaged && <span className="mortgaged"> hipotecada · {pesos(mortgageTransferFee(id))} al Banco</span>}
          </li>
        ))}
        {offer.cash > 0 && <li>💵 {pesos(offer.cash)}</li>}
        {offer.deeds.length === 0 && offer.cash === 0 && <li className="offer-nothing">nada</li>}
      </ul>
      <p className="trade-value">
        Valor <strong>{pesos(value)}</strong>
      </p>
    </section>
  );
}

/** A deed, big, the way it is printed: band, name, price and the ladder. */
function DeedPreview({ state, deedId }: { readonly state: GameState; readonly deedId: DeedId }) {
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId];
  return (
    <div className="deed-preview" style={{ "--band": bandColor(deed) } as CSSProperties}>
      <div className="deed-preview-band">
        {deed.kind === "campo" ? (
          <>
            <strong>{PROVINCE_NAMES[deed.province]}</strong>
            <span>{ZONE_NAMES[deed.zone]}</span>
          </>
        ) : (
          <>
            <span>{deed.kind === "ferrocarril" ? "Ferrocarril" : "Compañía"}</span>
            <strong>{shortName(deed)}</strong>
          </>
        )}
      </div>
      <p className="deed-preview-price">{pesos(deed.price)}</p>
      <DeedDetails deed={deed} />
      {holding?.mortgaged && <p className="deed-preview-flag">Hipotecada: quien la recibe paga {pesos(mortgageTransferFee(deedId))} al Banco.</p>}
    </div>
  );
}

/** How the two sides compare, at face value. */
function Fairness({ a, b, aName, bName }: { readonly a: number; readonly b: number; readonly aName: string; readonly bName: string }) {
  const total = a + b;
  const share = total === 0 ? 0.5 : a / total;
  const diff = a - b;
  const verdict = total === 0 ? "Nada sobre la mesa todavía." : Math.abs(diff) < Math.max(200, total * 0.05) ? "Parejo." : diff > 0 ? `${aName} da ${pesos(diff)} más.` : `${bName} da ${pesos(-diff)} más.`;
  return (
    <div className="fairness">
      <div className="fairness-bar" aria-hidden>
        <div className="fairness-a" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="fairness-values">
        <span>{pesos(a)}</span>
        <span>{pesos(b)}</span>
      </div>
      <p>{verdict}</p>
    </div>
  );
}

/**
 * The trade table, full screen: first pick who to deal with, then two
 * halves ("Ofrecés" / "Pedís") with each player's deeds on a fixed grid,
 * cash on both sides, a big preview of whatever the mouse is on, and the
 * face-value of each side so the fairness of the deal is plain. The same
 * screen shows a proposal to the player who must answer it.
 */
export function TradeScreen({ state, mode, you, busy, dispatch, onSubmit, onCounter, onClose }: TradeScreenProps) {
  const review = mode.kind === "review" ? mode.trade : null;
  const draft: TradeDraft = mode.kind === "compose" ? mode.draft : { me: mode.trade.fromId, partnerId: mode.trade.toId, gives: mode.trade.gives, receives: mode.trade.receives, counter: false };
  const me = getPlayer(state, draft.me);
  const partners = useMemo(() => state.players.filter((p) => p.id !== me.id && !p.bankrupt), [state.players, me.id]);
  const [partnerId, setPartnerId] = useState<string | null>(draft.partnerId);
  const [gives, setGives] = useState<TradeOffer>(draft.gives);
  const [receives, setReceives] = useState<TradeOffer>(draft.receives);
  const [hovered, setHovered] = useState<DeedId | null>(null);
  const partner = partnerId ? state.players.find((p) => p.id === partnerId) : undefined;

  const trade: Trade | null = partner ? { fromId: me.id, toId: partner.id, gives, receives } : null;
  const check = trade ? checkTrade(state, trade) : { ok: false as const, reason: "Elegí con quién canjear" };
  const balance = trade ? tradeBalance(state, trade) : null;
  const empty = gives.deeds.length + receives.deeds.length === 0 && gives.cash === 0 && receives.cash === 0;
  const editable = review === null;
  // Review: the responder answers; the proposer may only withdraw; anyone else just looks.
  const responder = review !== null && you !== null ? review.toId === you : review !== null && you === null;
  const proposer = review !== null && you !== null && review.fromId === you;

  const title = review ? "Propuesta de canje" : draft.counter ? "Contraoferta" : "Canje";
  const previewId = hovered ?? gives.deeds[0] ?? receives.deeds[0] ?? null;

  return (
    <div className="trade-screen" role="dialog" aria-label={title}>
      <header className="trade-header">
        <h2>{title}</h2>
        {partner && !review && !draft.counter && partners.length > 1 && (
          <button type="button" className="link-button" onClick={() => setPartnerId(null)}>
            cambiar de jugador
          </button>
        )}
        <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </header>

      {!partner ? (
        <div className="partner-choice">
          <h3>¿Con quién negociás?</h3>
          {partners.length === 0 && <p className="trade-problem">No queda nadie con quien canjear.</p>}
          <div className="partner-buttons">
            {partners.map((p) => (
              <button key={p.id} type="button" className="partner-button" style={{ "--player-color": p.color } as CSSProperties} onClick={() => setPartnerId(p.id)}>
                <TokenIcon token={p.token} size={64} />
                <strong>{p.name}</strong>
                <span>
                  {pesos(p.cash)} · {DEEDS.filter((d) => state.holdings[d.id]?.ownerId === p.id).length} escrituras
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="trade-table">
            <Side state={state} owner={me} title={review ? `${me.name} da` : "Ofrecés"} offer={gives} onChange={editable ? setGives : null} onHover={setHovered} />
            <div className="trade-middle">
              <div className="trade-preview-slot">{previewId ? <DeedPreview state={state} deedId={previewId} /> : <p className="trade-preview-hint">Pasá el mouse por una escritura para verla grande; clic para ponerla en la mesa.</p>}</div>
              <Fairness a={offerValue(gives)} b={offerValue(receives)} aName={me.name} bName={partner.name} />
              {balance && (
                <p className="trade-balance">
                  Después: <strong>{me.name}</strong> {pesos(me.cash + balance.from)} · <strong>{partner.name}</strong> {pesos(partner.cash + balance.to)}
                </p>
              )}
              {!check.ok && !empty && <p className="trade-problem">{check.reason}</p>}
            </div>
            <Side state={state} owner={partner} title={review ? `${partner.name} da` : "Pedís"} offer={receives} onChange={editable ? setReceives : null} onHover={setHovered} />
          </div>
          <footer className="trade-footer">
            {review ? (
              responder ? (
                <>
                  <button type="button" className="primary big" disabled={busy || !check.ok} title={check.ok ? "" : check.reason} onClick={() => dispatch({ type: "acceptTrade" })}>
                    🤝 Aceptar el canje
                  </button>
                  <button type="button" className="big" disabled={busy} onClick={onCounter}>
                    Contraofertar
                  </button>
                  <button type="button" className="danger big" disabled={busy} onClick={() => dispatch({ type: "rejectTrade" })}>
                    Rechazar
                  </button>
                </>
              ) : proposer ? (
                <>
                  <p className="waiting-for">Esperando a que {partner.name} conteste…</p>
                  <button type="button" disabled={busy} onClick={() => dispatch({ type: "cancelTrade" })}>
                    Retirar la propuesta
                  </button>
                  <button type="button" onClick={onClose}>
                    Mirar la mesa
                  </button>
                </>
              ) : (
                <>
                  <p className="waiting-for">Esperando a que {partner.name} conteste…</p>
                  <button type="button" onClick={onClose}>
                    Mirar la mesa
                  </button>
                </>
              )
            ) : (
              <>
                <button type="button" className="primary big" disabled={busy || !check.ok} title={check.ok ? "" : check.reason} onClick={() => onSubmit(partner.id, gives, receives)}>
                  {draft.counter ? "Mandar la contraoferta" : `Proponerle el canje a ${partner.name}`}
                </button>
                <button type="button" onClick={onClose}>
                  {draft.counter ? "Volver" : "Cancelar"}
                </button>
              </>
            )}
          </footer>
        </>
      )}
    </div>
  );
}


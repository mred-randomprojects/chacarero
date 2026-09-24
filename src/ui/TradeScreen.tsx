import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DeedId, GameState, Player, Trade, TradeOffer } from "../game";
import { DEEDS, canTradeDeed, checkTrade, deedName, getDeed, getPlayer, mortgageTransferFee, pesos, tradeBalance } from "../game";
import type { SharedTradeDraft } from "../net/protocol";
import { bandColor } from "../scene/cardTextures";
import type { Dispatch } from "./ActionBar";
import { DeedCard, Hand } from "./DeedCard";
import { GRID_COLUMNS, GRID_ROWS, SLOTS, columnLabel, shortName } from "./deedGrid";
import { Key } from "./Key";
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
  | { readonly kind: "review"; readonly trade: Trade }
  /** Someone else's deal, still being put together, watched live and read-only. */
  | { readonly kind: "watch"; readonly draft: SharedTradeDraft };

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
  /** Compose mode: the deal as it stands after every change, for the other screens to watch. */
  readonly onDraftChange?: (partnerId: string | null, gives: TradeOffer, receives: TradeOffer) => void;
}

const CASH_STEPS = [500, 1_000, 5_000] as const;

/** Face value of one side: the deeds' printed prices plus the cash. What was actually paid never matters. */
function offerValue(offer: TradeOffer): number {
  return offer.deeds.reduce((sum, id) => sum + getDeed(id).price, 0) + offer.cash;
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
      <div className="trade-hand">
        <Hand state={state} deeds={offer.deeds} cash={offer.cash} width={92} {...(onChange ? { onRemove: toggle } : {})} empty="Nada sobre la mesa" />
        {offer.deeds.some((id) => state.holdings[id]?.mortgaged) && (
          <p className="mortgaged">Hipotecada: quien la recibe le paga al Banco el 10 % ({offer.deeds.filter((id) => state.holdings[id]?.mortgaged).map((id) => pesos(mortgageTransferFee(id))).join(", ")}).</p>
        )}
      </div>
      <p className="trade-value">
        Valor <strong>{pesos(value)}</strong>
      </p>
    </section>
  );
}

/** A deed, big, exactly as printed on the table. */
function DeedPreview({ state, deedId }: { readonly state: GameState; readonly deedId: DeedId }) {
  const holding = state.holdings[deedId];
  return (
    <div className="deed-preview">
      <DeedCard state={state} deedId={deedId} width={250} />
      {holding?.mortgaged && <p className="deed-preview-flag">Hipotecada: quien la recibe paga {pesos(mortgageTransferFee(deedId))} al Banco.</p>}
    </div>
  );
}

/** What each side puts on the table, at face value, side by side; the reader does the comparing. */
function Fairness({ a, b, aPlayer, bPlayer }: { readonly a: number; readonly b: number; readonly aPlayer: Player; readonly bPlayer: Player }) {
  const total = a + b;
  const share = total === 0 ? 0.5 : a / total;
  return (
    <div className="fairness">
      <div className="fairness-bar" aria-hidden>
        <div className="fairness-a" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="fairness-values">
        {[
          { player: aPlayer, value: a },
          { player: bPlayer, value: b },
        ].map(({ player, value }) => (
          <span key={player.id}>
            <small>
              <TokenIcon token={player.token} size={16} /> {player.name} da
            </small>
            <strong>{pesos(value)}</strong>
          </span>
        ))}
      </div>
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
export function TradeScreen({ state, mode, you, busy, dispatch, onSubmit, onCounter, onClose, onDraftChange }: TradeScreenProps) {
  const review = mode.kind === "review" ? mode.trade : null;
  const watched = mode.kind === "watch" ? mode.draft : null;
  const draft: TradeDraft =
    mode.kind === "compose"
      ? mode.draft
      : mode.kind === "review"
        ? { me: mode.trade.fromId, partnerId: mode.trade.toId, gives: mode.trade.gives, receives: mode.trade.receives, counter: false }
        : { me: mode.draft.fromId, partnerId: mode.draft.toId, gives: mode.draft.gives, receives: mode.draft.receives, counter: mode.draft.counter };
  const me = getPlayer(state, draft.me);
  const partners = useMemo(() => state.players.filter((p) => p.id !== me.id && !p.bankrupt), [state.players, me.id]);
  const [ownPartnerId, setPartnerId] = useState<string | null>(draft.partnerId);
  const [ownGives, setGives] = useState<TradeOffer>(draft.gives);
  const [ownReceives, setReceives] = useState<TradeOffer>(draft.receives);
  // Watching, the deal is whatever the composer has right now; otherwise it is this screen's own.
  const partnerId = watched ? watched.toId : ownPartnerId;
  const gives = watched ? watched.gives : ownGives;
  const receives = watched ? watched.receives : ownReceives;
  const [hovered, setHovered] = useState<DeedId | null>(null);
  const composing = mode.kind === "compose";
  useEffect(() => {
    if (composing) onDraftChange?.(ownPartnerId, ownGives, ownReceives);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report the deal when it changes, not when the callback's identity does
  }, [composing, ownPartnerId, ownGives, ownReceives]);
  const partner = partnerId ? state.players.find((p) => p.id === partnerId) : undefined;

  const trade: Trade | null = partner ? { fromId: me.id, toId: partner.id, gives, receives } : null;
  const check = trade ? checkTrade(state, trade) : { ok: false as const, reason: "Elegí con quién canjear" };
  const balance = trade ? tradeBalance(state, trade) : null;
  const empty = gives.deeds.length + receives.deeds.length === 0 && gives.cash === 0 && receives.cash === 0;
  const editable = composing;
  // Review: the responder answers; the proposer may only withdraw; anyone else just looks.
  const responder = review !== null && you !== null ? review.toId === you : review !== null && you === null;
  const proposer = review !== null && you !== null && review.fromId === you;

  const title = watched ? `${me.name} arma ${draft.counter ? "una contraoferta" : "un canje"}` : review ? "Propuesta de canje" : draft.counter ? "Contraoferta" : "Canje";
  const previewId = hovered ?? gives.deeds[0] ?? receives.deeds[0] ?? null;

  return (
    <div className="trade-screen" role="dialog" aria-label={title}>
      <header className="trade-header">
        <h2>{title}</h2>
        {partner && editable && !draft.counter && partners.length > 1 && (
          <button type="button" className="link-button" onClick={() => setPartnerId(null)}>
            cambiar de jugador
          </button>
        )}
        <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </header>

      {!partner && watched ? (
        <div className="partner-choice">
          <h3>{me.name} está eligiendo con quién negociar…</h3>
          <div className="trade-footer">
            <button type="button" onClick={onClose}>
              Mirar la mesa
            </button>
          </div>
        </div>
      ) : !partner ? (
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
            <Side state={state} owner={me} title={editable ? "Ofrecés" : `${me.name} da`} offer={gives} onChange={editable ? setGives : null} onHover={setHovered} />
            <div className="trade-middle">
              <div className="trade-preview-slot">{previewId ? <DeedPreview state={state} deedId={previewId} /> : <p className="trade-preview-hint">{editable ? "Pasá el mouse por una escritura para verla grande; clic para ponerla en la mesa." : "Pasá el mouse por una escritura para verla grande."}</p>}</div>
              <Fairness a={offerValue(gives)} b={offerValue(receives)} aPlayer={me} bPlayer={partner} />
              {balance && (
                <p className="trade-balance">
                  Después: <strong>{me.name}</strong> {pesos(me.cash + balance.from)} · <strong>{partner.name}</strong> {pesos(partner.cash + balance.to)}
                </p>
              )}
              {!check.ok && !empty && <p className="trade-problem">{check.reason}</p>}
            </div>
            <Side state={state} owner={partner} title={editable ? "Pedís" : `${partner.name} da`} offer={receives} onChange={editable ? setReceives : null} onHover={setHovered} />
          </div>
          <footer className="trade-footer">
            {watched ? (
              <>
                <p className="waiting-for">
                  {me.name} todavía no lo mandó: lo ves mientras lo arma{you === partner.id ? "; cuando lo mande, te toca contestar" : ""}.
                </p>
                <button type="button" onClick={onClose}>
                  Mirar la mesa
                </button>
              </>
            ) : review ? (
              responder ? (
                <>
                  <button type="button" className="primary big" disabled={busy || !check.ok} title={check.ok ? "" : check.reason} onClick={() => dispatch({ type: "acceptTrade" })}>
                    🤝 Aceptar el canje <Key k="a" />
                  </button>
                  <button type="button" className="big" disabled={busy} onClick={onCounter}>
                    Contraofertar <Key k="o" />
                  </button>
                  <button type="button" className="danger big" disabled={busy} onClick={() => dispatch({ type: "rejectTrade" })}>
                    Rechazar <Key k="x" />
                  </button>
                </>
              ) : proposer ? (
                <>
                  <p className="waiting-for">Esperando a que {partner.name} conteste…</p>
                  <button type="button" disabled={busy} onClick={() => dispatch({ type: "cancelTrade" })}>
                    Retirar la propuesta <Key k="x" />
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


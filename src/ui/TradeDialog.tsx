import { useMemo, useState } from "react";
import type { Deed, DeedId, GameState, Player, TradeOffer } from "../game";
import { PROVINCE_COLORS, canTradeDeed, checkTrade, deedName, deedsOwnedBy, getDeed, getPlayer, mortgageTransferFee, pesos, tradeBalance } from "../game";

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

export interface TradeDialogProps {
  readonly state: GameState;
  readonly draft: TradeDraft;
  readonly busy: boolean;
  readonly onSubmit: (toId: string, gives: TradeOffer, receives: TradeOffer) => void;
  readonly onClose: () => void;
}

const CASH_STEPS = [100, 500, 1_000, 5_000] as const;

function deedColor(deed: Deed): string {
  if (deed.kind === "campo") return PROVINCE_COLORS[deed.province];
  return deed.kind === "ferrocarril" ? "#2b2b2b" : "#7a5230";
}

/** The deeds and cash of one side of a trade, as a compact list. */
export function OfferItems({ state, offer, receiver }: { readonly state: GameState; readonly offer: TradeOffer; readonly receiver: string }) {
  if (offer.deeds.length === 0 && offer.cash === 0) return <p className="offer-nothing">nada</p>;
  return (
    <ul className="offer-items">
      {offer.deeds.map((id) => {
        const deed = getDeed(id);
        const mortgaged = state.holdings[id]?.mortgaged === true;
        return (
          <li key={id}>
            <span className="swatch" style={{ background: deedColor(deed) }} />
            <span className="offer-name">{deedName(deed)}</span>
            {mortgaged && (
              <span className="mortgaged" title={`${receiver} paga ${pesos(mortgageTransferFee(id))} al Banco al recibirla`}>
                hipotecada · {pesos(mortgageTransferFee(id))} al Banco
              </span>
            )}
          </li>
        );
      })}
      {offer.cash > 0 && (
        <li>
          <span className="offer-cash">💵 {pesos(offer.cash)}</span>
        </li>
      )}
    </ul>
  );
}

interface OfferEditorProps {
  readonly state: GameState;
  readonly owner: Player;
  readonly offer: TradeOffer;
  readonly onChange: (offer: TradeOffer) => void;
}

/** One column of the dialog: tick the deeds and type the cash `owner` hands over. */
function OfferEditor({ state, owner, offer, onChange }: OfferEditorProps) {
  const deeds = deedsOwnedBy(state, owner.id);
  const toggle = (id: DeedId) => onChange({ ...offer, deeds: offer.deeds.includes(id) ? offer.deeds.filter((d) => d !== id) : [...offer.deeds, id] });
  const setCash = (cash: number) => onChange({ ...offer, cash: Math.min(owner.cash, Math.max(0, Math.floor(cash))) });
  return (
    <div className="offer-editor">
      <h4>
        <span className="dot" style={{ background: owner.color }} /> {owner.name} da
      </h4>
      {deeds.length === 0 ? (
        <p className="offer-nothing">No tiene escrituras.</p>
      ) : (
        <ul className="offer-deeds">
          {deeds.map((id) => {
            const deed = getDeed(id);
            const tradeable = canTradeDeed(state, id);
            const mortgaged = state.holdings[id]?.mortgaged === true;
            return (
              <li key={id} className={tradeable.ok ? "" : "blocked"} title={tradeable.ok ? "" : tradeable.reason}>
                <label>
                  <input type="checkbox" aria-label={deedName(deed)} checked={offer.deeds.includes(id)} disabled={!tradeable.ok} onChange={() => toggle(id)} />
                  <span className="swatch" style={{ background: deedColor(deed) }} />
                  <span className="offer-name">{deedName(deed)}</span>
                  {mortgaged && <span className="mortgaged">hipotecada</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <label className="offer-cash-field">
        <span>Plata (tiene {pesos(owner.cash)})</span>
        <input type="number" inputMode="numeric" min={0} max={owner.cash} step={100} value={offer.cash === 0 ? "" : offer.cash} placeholder="0" onChange={(e) => setCash(Number(e.target.value) || 0)} />
      </label>
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
    </div>
  );
}

/**
 * Modal to put a trade together: pick the other player, tick the deeds each
 * side hands over, type the cash, see what both would be left with, and
 * send it. The same dialog serves a counter-offer, with the partner fixed.
 */
export function TradeDialog({ state, draft, busy, onSubmit, onClose }: TradeDialogProps) {
  const me = getPlayer(state, draft.me);
  const partners = useMemo(() => state.players.filter((p) => p.id !== me.id && !p.bankrupt), [state.players, me.id]);
  const [partnerId, setPartnerId] = useState<string | null>(draft.partnerId ?? partners[0]?.id ?? null);
  const [gives, setGives] = useState<TradeOffer>(draft.gives);
  const [receives, setReceives] = useState<TradeOffer>(draft.receives);
  const partner = partnerId ? state.players.find((p) => p.id === partnerId) : undefined;

  const choosePartner = (id: string) => {
    setPartnerId(id);
    // Their deeds are not the previous partner's.
    setReceives({ deeds: [], cash: 0 });
  };

  const trade = partner ? { fromId: me.id, toId: partner.id, gives, receives } : null;
  const check = trade ? checkTrade(state, trade) : { ok: false as const, reason: "No hay con quién canjear" };
  const balance = trade ? tradeBalance(state, trade) : null;
  const empty = gives.deeds.length + receives.deeds.length === 0 && gives.cash === 0 && receives.cash === 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal trade-dialog" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{draft.counter ? "Contraoferta" : "Canje"}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal-body">
          {!draft.counter && partners.length > 1 && (
            <div className="partner-picker">
              <span>Con</span>
              {partners.map((p) => (
                <button key={p.id} type="button" className={p.id === partnerId ? "selected" : ""} onClick={() => choosePartner(p.id)}>
                  <span className="dot" style={{ background: p.color }} /> {p.name}
                </button>
              ))}
            </div>
          )}
          {partner ? (
            <>
              <div className="trade-sides editing">
                <OfferEditor state={state} owner={me} offer={gives} onChange={setGives} />
                <div className="trade-arrow">⇄</div>
                <OfferEditor state={state} owner={partner} offer={receives} onChange={setReceives} />
              </div>
              {balance && (
                <p className="trade-balance">
                  Después del canje: <strong>{me.name}</strong> {pesos(me.cash + balance.from)}
                  {balance.from !== 0 && ` (${balance.from > 0 ? "+" : "−"}${pesos(balance.from)})`} · <strong>{partner.name}</strong> {pesos(partner.cash + balance.to)}
                  {balance.to !== 0 && ` (${balance.to > 0 ? "+" : "−"}${pesos(balance.to)})`}
                  {[...gives.deeds, ...receives.deeds].some((id) => state.holdings[id]?.mortgaged) && ". Quien recibe una escritura hipotecada le paga al Banco el 10 % de la hipoteca."}
                </p>
              )}
              {!check.ok && !empty && <p className="trade-problem">{check.reason}</p>}
            </>
          ) : (
            <p className="trade-problem">No hay con quién canjear.</p>
          )}
          <div className="buttons">
            <button type="button" className="primary" disabled={busy || !check.ok || !partner} onClick={() => partner && onSubmit(partner.id, gives, receives)}>
              {draft.counter ? "Mandar contraoferta" : `Proponerle el canje a ${partner?.name ?? "…"}`}
            </button>
            <button type="button" onClick={onClose}>
              {draft.counter ? "Volver" : "Cancelar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

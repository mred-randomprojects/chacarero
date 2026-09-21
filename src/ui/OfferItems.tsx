import type { GameState, TradeOffer } from "../game";
import { deedName, getDeed, mortgageTransferFee, pesos } from "../game";
import { bandColor } from "../scene/cardTextures";

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
            <span className="swatch" style={{ background: bandColor(deed) }} />
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

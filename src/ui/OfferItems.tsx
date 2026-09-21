import type { GameState, TradeOffer } from "../game";
import { Hand } from "./DeedCard";

/** The deeds and cash of one side of a trade, as a small fan of real cards. */
export function OfferItems({ state, offer }: { readonly state: GameState; readonly offer: TradeOffer; readonly receiver?: string }) {
  return <Hand state={state} deeds={offer.deeds} cash={offer.cash} width={64} />;
}

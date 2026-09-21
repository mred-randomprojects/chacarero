import type { CSSProperties } from "react";
import type { DeedId, GameState } from "../game";
import { deedName, getPlayer, pesos } from "../game";
import { bandColor } from "../scene/cardTextures";
import { GRID_COLUMNS, GRID_ROWS, SLOTS, columnLabel, shortName } from "./deedGrid";
import { TokenIcon } from "./TokenIcon";

export interface CatastroProps {
  readonly state: GameState;
  readonly onHover: (deedId: DeedId | null) => void;
  readonly onSelect: (deedId: DeedId) => void;
}

/**
 * The land registry: every deed of the game in its fixed slot (the same
 * grid as the trade screen), for the whole table at once. A held deed is
 * lit and carries its owner's token icon and colour on the left — the band
 * across the top is the property's colour, never the player's — with its
 * buildings and mortgage; a free one is a ghost that still reads. Hover
 * shows the card big beside the grid; a click opens the square's panel.
 */
export function Catastro({ state, onHover, onSelect }: CatastroProps) {
  return (
    <div className="deed-grid catastro" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`, gridTemplateRows: `auto repeat(${GRID_ROWS}, 1fr)` }} onMouseLeave={() => onHover(null)}>
      {Array.from({ length: GRID_COLUMNS }, (_, column) => (
        <div key={column} className="deed-grid-label" style={{ gridColumn: column + 1, gridRow: 1 }}>
          {columnLabel(column)}
        </div>
      ))}
      {SLOTS.map(({ deed, column, row }) => {
        const holding = state.holdings[deed.id];
        const owner = holding ? getPlayer(state, holding.ownerId) : null;
        const style = { gridColumn: column + 1, gridRow: GRID_ROWS + 1 - row, "--band": bandColor(deed), ...(owner ? { "--player-color": owner.color } : {}) } as CSSProperties;
        const title = owner ? `${deedName(deed)}: de ${owner.name}${holding?.mortgaged ? " (hipotecada)" : ""}` : `${deedName(deed)}: libre`;
        return (
          <button
            key={deed.id}
            type="button"
            className={`deed-slot ${owner ? "owned held" : "ghost free"}${holding?.mortgaged ? " mortgaged" : ""}`}
            style={style}
            title={title}
            onMouseEnter={() => onHover(deed.id)}
            onFocus={() => onHover(deed.id)}
            onClick={() => onSelect(deed.id)}
          >
            <span className="deed-slot-band" />
            {owner && (
              <span className="deed-slot-owner">
                <TokenIcon token={owner.token} size={20} title={owner.name} />
              </span>
            )}
            {holding && deed.kind === "campo" && (holding.estancia || holding.chacras > 0) && (
              <span className="deed-slot-buildings" aria-label={holding.estancia ? "estancia" : `${holding.chacras} chacras`}>
                {holding.estancia ? <i className="estancia" /> : Array.from({ length: holding.chacras }, (_, i) => <i key={i} className="chacra" />)}
              </span>
            )}
            <span className="deed-slot-name">{shortName(deed)}</span>
            <span className="deed-slot-price">{pesos(deed.price)}</span>
            {holding?.mortgaged && <span className="deed-slot-flag">HIP.</span>}
          </button>
        );
      })}
    </div>
  );
}

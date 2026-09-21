import type { CSSProperties } from "react";
import type { DeedId, GameState } from "../game";
import { deedName, getDeed } from "../game";
import { deedCardDataUrl } from "../scene/cardTextures";

const BARE = { ownerId: "", chacras: 0, estancia: false, mortgaged: false } as const;

export interface DeedCardProps {
  readonly state: GameState;
  readonly deedId: DeedId;
  /** CSS width; the card keeps the printed 240:340 proportions. */
  readonly width: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly onClick?: () => void;
  readonly title?: string;
}

/** A deed exactly as it is printed on the table (same artwork), as an image. */
export function DeedCard({ state, deedId, width, className = "", style, onClick, title }: DeedCardProps) {
  const deed = getDeed(deedId);
  const holding = state.holdings[deedId] ?? BARE;
  const src = deedCardDataUrl(deed, holding, width > 160 ? 3 : 2);
  const label = title ?? deedName(deed);
  if (onClick) {
    return (
      <button type="button" className={`deed-card ${className}`} style={{ width, ...style }} onClick={onClick} title={label}>
        <img src={src} alt={label} width={width} height={Math.round((width * 340) / 240)} draggable={false} />
      </button>
    );
  }
  return <img className={`deed-card ${className}`} src={src} alt={label} title={label} width={width} height={Math.round((width * 340) / 240)} style={style} draggable={false} />;
}

export interface HandProps {
  readonly state: GameState;
  readonly deeds: readonly DeedId[];
  readonly cash: number;
  /** Card width in px. */
  readonly width?: number;
  /** Clicking a card takes it back off the table. */
  readonly onRemove?: (deedId: DeedId) => void;
  readonly empty?: string;
}

/** Deeds held like a hand of cards, fanned; the cash beside them as a chip. */
export function Hand({ state, deeds, cash, width = 96, onRemove, empty = "nada" }: HandProps) {
  const n = deeds.length;
  if (n === 0 && cash === 0) return <p className="offer-nothing">{empty}</p>;
  return (
    <div className="hand">
      {deeds.map((id, i) => {
        const offset = i - (n - 1) / 2;
        const style: CSSProperties = {
          transform: `rotate(${offset * 5}deg) translateY(${Math.abs(offset) * 6}px)`,
          marginLeft: i === 0 ? 0 : -width * 0.42,
          zIndex: i,
        };
        const extra = onRemove ? { title: `${deedName(getDeed(id))} · sacar de la mesa`, onClick: () => onRemove(id) } : {};
        return <DeedCard key={id} state={state} deedId={id} width={width} className="hand-card" style={style} {...extra} />;
      })}
      {cash > 0 && <span className="hand-cash">💵 ${cash.toLocaleString("es-AR")}</span>}
    </div>
  );
}

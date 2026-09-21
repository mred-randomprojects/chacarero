import type { CSSProperties } from "react";
import type { TokenId } from "../game";
import { TOKENS, getToken } from "../game";

export interface TokenIconProps {
  readonly token: TokenId;
  /** Diameter in px. */
  readonly size?: number;
  readonly className?: string;
  readonly title?: string;
}

/** A player's glyph: the token's emoji on a disc of the token's colour. */
export function TokenIcon({ token, size = 22, className = "", title }: TokenIconProps) {
  const t = getToken(token);
  return (
    <span className={`token-icon ${className}`} style={{ background: t.color, width: size, height: size, fontSize: size * 0.62 }} title={title ?? t.name} aria-label={t.name}>
      {t.icon}
    </span>
  );
}

export interface TokenPickerProps {
  readonly value: TokenId;
  /** Tokens other players hold, keyed by token, with the holder's name. */
  readonly taken: ReadonlyMap<TokenId, string>;
  readonly onChange: (token: TokenId) => void;
  readonly disabled?: boolean;
}

/** All the pieces in a row; the chosen one is ringed, the ones others hold are greyed out. */
export function TokenPicker({ value, taken, onChange, disabled = false }: TokenPickerProps) {
  return (
    <div className="token-picker" role="radiogroup" aria-label="Ficha">
      {TOKENS.map((token) => {
        const holder = taken.get(token.id);
        const blocked = holder !== undefined;
        return (
          <button
            key={token.id}
            type="button"
            role="radio"
            aria-checked={token.id === value}
            className={`token-option${token.id === value ? " selected" : ""}${blocked ? " taken" : ""}`}
            disabled={disabled || blocked}
            title={blocked ? `${token.name}: la tiene ${holder}` : token.name}
            style={{ "--token-color": token.color } as CSSProperties}
            onClick={() => onChange(token.id)}
          >
            <TokenIcon token={token.id} size={46} title={blocked ? `${token.name}: la tiene ${holder}` : token.name} />
            <span className="token-option-name">{token.name}</span>
          </button>
        );
      })}
    </div>
  );
}

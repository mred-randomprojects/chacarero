import { Key } from "./Key";

export type CameraMode = "following" | "free" | "off";

export interface CameraBarProps {
  /** `following`: the director drives; `free`: the user took the camera until the next turn; `off`: director disabled. */
  readonly mode: CameraMode;
  /** Re-join the director's view now. */
  readonly onFollow: () => void;
  readonly onToggleDirector: () => void;
  readonly onMySeat: () => void;
  readonly onOverview: () => void;
  readonly onTopDown: () => void;
}

/** Bottom-right camera controls; every button also has a keyboard shortcut (the full list lives in Ajustes). */
export function CameraBar({ mode, onFollow, onToggleDirector, onMySeat, onOverview, onTopDown }: CameraBarProps) {
  return (
    <div className="camera-bar">
      <button type="button" onClick={onMySeat} title="Sentarse en el lugar del jugador de turno (M)">
        Mi lugar <Key k="m" />
      </button>
      <button type="button" onClick={onOverview} title="Vista general (0)">
        General <Key k="0" />
      </button>
      <button type="button" onClick={onTopDown} title="Desde arriba (T)">
        Arriba <Key k="t" />
      </button>
      {mode === "free" ? (
        <button type="button" className="rejoin" onClick={onFollow} title="Volver a ver lo mismo que la mesa">
          ↩ Volver a la partida
        </button>
      ) : (
        <button
          type="button"
          className={mode === "following" ? "active" : ""}
          onClick={onToggleDirector}
          title="La cámara sigue la partida (el peón de turno, los dados, las tarjetas); arrastrá para mirar libremente"
        >
          {mode === "following" ? "Sigue la partida" : "Cámara libre"}
        </button>
      )}
    </div>
  );
}

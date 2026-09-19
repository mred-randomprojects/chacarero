export interface CameraBarProps {
  readonly followTurn: boolean;
  readonly onToggleFollow: () => void;
  readonly onMySeat: () => void;
  readonly onOverview: () => void;
  readonly onTopDown: () => void;
  readonly onSettings: () => void;
}

/** Bottom-right camera controls; every button also has a keyboard shortcut. */
export function CameraBar({ followTurn, onToggleFollow, onMySeat, onOverview, onTopDown, onSettings }: CameraBarProps) {
  return (
    <div className="camera-bar">
      <button type="button" onClick={onMySeat} title="Sentarse en el lugar del jugador de turno (M)">
        Mi lugar
      </button>
      <button type="button" onClick={onOverview} title="Vista general (0)">
        General
      </button>
      <button type="button" onClick={onTopDown} title="Desde arriba (T)">
        Arriba
      </button>
      <button type="button" className={followTurn ? "active" : ""} onClick={onToggleFollow} title="Girar la cámara al jugador de turno">
        {followTurn ? "Sigue el turno" : "Cámara fija"}
      </button>
      <button type="button" onClick={onSettings} title="Ajustes (,)" aria-label="Ajustes">
        ⚙
      </button>
      <span className="hint">
        ⌥+arrastrar mueve la mesa · ⌥+clic centra · doble clic en una escritura acerca · rueda zoom · ← → ↑ ↓ girar · + − zoom · 1-6 lugar de
        cada jugador · M mi lugar · 0 general · T arriba · L propiedades · espacio dados
      </span>
    </div>
  );
}

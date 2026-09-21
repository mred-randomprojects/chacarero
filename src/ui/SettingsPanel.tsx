import { DECISION_SECONDS } from "../game";
import type { Settings } from "./settings";

export interface SettingsPanelProps {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
  readonly onClose: () => void;
}

/** Preferences modal: banners, countdowns, sound and camera behaviour. */
export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Ajustes</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal-body">
          <label>
            <span>Duración de los avisos: {settings.bannerSeconds.toFixed(1)} s</span>
            <input type="range" min={1} max={15} step={0.5} value={settings.bannerSeconds} onChange={(e) => set("bannerSeconds", Number(e.target.value))} />
          </label>
          <label>
            <span>
              Tiempo para decidir: {settings.countdownScale === 0 ? "sin límite" : `×${settings.countdownScale.toFixed(1)}`}
            </span>
            <input type="range" min={0} max={4} step={0.25} value={settings.countdownScale} onChange={(e) => set("countdownScale", Number(e.target.value))} />
            <small>Cada decisión tiene {DECISION_SECONDS / 60} minutos, multiplicados por este valor; al terminarse, la mesa decide sola.</small>
          </label>
          <label>
            <span>Volumen: {Math.round(settings.soundVolume * 100)} %</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.soundVolume} onChange={(e) => set("soundVolume", Number(e.target.value))} />
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.muted} onChange={(e) => set("muted", e.target.checked)} /> Silenciar
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.followTurn} onChange={(e) => set("followTurn", e.target.checked)} /> La cámara sigue la partida (se acerca al peón de turno; si la agarrás, te suelta hasta el turno siguiente)
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.followPawn} onChange={(e) => set("followPawn", e.target.checked)} /> La cámara sigue al peón cuando se mueve
          </label>
          <p className="controls">
            <strong>Controles.</strong> Arrastrar gira la cámara · rueda acerca · ⌥+arrastrar mueve la mesa · ⌥+clic centra · doble clic en un
            casillero o una escritura acerca · ← → ↑ ↓ giran e inclinan · + − acercan · 1-6 el lugar de cada jugador · M mi lugar · 0 general ·
            T desde arriba · L propiedades · C canje · espacio mezcla los dados · Enter / espacio apuran un aviso o aprietan el botón destacado.
          </p>
          <p className="credits">Sonidos: Kenney.nl (CC0).</p>
        </div>
      </div>
    </div>
  );
}

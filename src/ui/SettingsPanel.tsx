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
            <small>Comprar 20 s · remate 15 s · pagar o levantar 12 s · fin de turno 8 s, multiplicados por este valor.</small>
          </label>
          <label>
            <span>Volumen: {Math.round(settings.soundVolume * 100)} %</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.soundVolume} onChange={(e) => set("soundVolume", Number(e.target.value))} />
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.muted} onChange={(e) => set("muted", e.target.checked)} /> Silenciar
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.followTurn} onChange={(e) => set("followTurn", e.target.checked)} /> La cámara se sienta con el jugador de turno
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.followPawn} onChange={(e) => set("followPawn", e.target.checked)} /> La cámara sigue al peón cuando se mueve
          </label>
          <p className="credits">Sonidos: Kenney.nl (CC0).</p>
        </div>
      </div>
    </div>
  );
}

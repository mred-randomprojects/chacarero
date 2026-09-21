import type { DeedId, Party } from "../game";

/** One-off animations the UI asks the scene to play. */
export type SceneEffect =
  | { readonly kind: "money"; readonly from: Party; readonly to: Party; readonly amount: number }
  | { readonly kind: "deed"; readonly deedId: DeedId; readonly from: Party; readonly to: Party }
  | { readonly kind: "building"; readonly deedId: DeedId; readonly chacras: number; readonly estancia: boolean; readonly removed: boolean }
  | { readonly kind: "revealCard"; readonly deck: "suerte" | "destino"; readonly cardId: string; readonly playerId: string }
  | { readonly kind: "hideCard" }
  /** Lifts a deed from the bank pile up in front of the camera (a free deed on offer); stays until `hideDeed`. */
  | { readonly kind: "presentDeed"; readonly deedId: DeedId }
  | { readonly kind: "hideDeed" };

export interface ActiveEffect {
  readonly id: number;
  readonly effect: SceneEffect;
  readonly resolve: () => void;
}

type Listener = (active: readonly ActiveEffect[]) => void;

/**
 * Bridge between the React UI and the Three.js scene: the UI requests an
 * effect and awaits its promise; the scene renders it and resolves when the
 * animation ends. A plain singleton avoids threading refs through the
 * Canvas boundary.
 */
class EffectsBus {
  private active: ActiveEffect[] = [];
  private listeners = new Set<Listener>();
  private nextId = 1;

  request(effect: SceneEffect): Promise<void> {
    return new Promise((resolve) => {
      const id = this.nextId++;
      const entry: ActiveEffect = {
        id,
        effect,
        resolve: () => {
          this.active = this.active.filter((e) => e.id !== id);
          this.notify();
          resolve();
        },
      };
      this.active = [...this.active, entry];
      this.notify();
      // Safety net: never leave the UI waiting on an animation that failed to mount.
      setTimeout(() => {
        if (this.active.some((e) => e.id === id)) entry.resolve();
      }, 6_000);
    });
  }

  /** Cancels everything in flight, resolving their promises. */
  flush(): void {
    const pending = this.active;
    this.active = [];
    this.notify();
    for (const entry of pending) entry.resolve();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.active);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.active);
  }
}

export const effectsBus = new EffectsBus();

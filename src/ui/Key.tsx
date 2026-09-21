import { keyLabel } from "./hotkeys";

/** The keyboard shortcut printed on a button: "Comprar [C]". */
export function Key({ k }: { readonly k: string }) {
  return <kbd className="key">{keyLabel(k)}</kbd>;
}

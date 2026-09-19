# Chacarero

El clásico juego argentino de compra-venta de campos, con tablero hexagonal
de 42 casilleros, en una escena Three.js.

**Demo:** https://mred-randomprojects.github.io/chacarero/

Se juega en "modo mesa": de 2 a 6 jugadores por turnos en la misma pantalla.
Tirás los dados, comprás campos, cobrás alquileres, levantás tarjetas de
Suerte y Destino, construís chacras y estancias, hipotecás cuando no te
alcanza y, si no hay más remedio, quebrás. Gana el último que queda.
El modo multijugador online (servidor WebSocket) es el siguiente paso.

## Desarrollo

```bash
bun install
bun run dev        # http://localhost:5173/chacarero/
bun run test       # vitest
bun run typecheck
bun run lint
bun run build
```

Cada push a `main` despliega a GitHub Pages.

## Estructura

- `src/game/` — datos y tipos del juego, sin dependencias de UI: los 42
  casilleros, las 29 escrituras con sus tablas de alquiler, las 32 tarjetas y
  las constantes del reglamento. Todo con tests.
- `src/game/engine/` — el motor: `GameState` inmutable y funciones puras
  (`roll`, `buy`, `buildChacra`, `mortgage`, `declareBankruptcy`…) que devuelven
  el estado siguiente. Es lo que el servidor va a ejecutar; la UI solo despacha.
- `src/scene/` — geometría del anillo hexagonal (`hexLayout.ts`), las caras de
  los casilleros dibujadas en canvas, y los componentes de react-three-fiber.
- `src/ui/` — HUD y panel de escrituras.
- `docs/REGLAS.md` — reglas completas. `docs/FUENTES.md` — de dónde sale cada
  número y qué falta verificar.

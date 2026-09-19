# Chacarero

El clásico juego argentino de compra-venta de campos, con tablero hexagonal
de 42 casilleros, en una escena Three.js.

**Demo:** https://mred-randomprojects.github.io/chacarero/

Por ahora es el tablero completo con las escrituras, un peón y los dados:
girá el tablero, pasá el mouse por los casilleros para leer las escrituras y
tirá los dados para mover el peón. El motor de juego (compras, alquileres,
tarjetas, hipotecas) viene después.

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
- `src/scene/` — geometría del anillo hexagonal (`hexLayout.ts`), las caras de
  los casilleros dibujadas en canvas, y los componentes de react-three-fiber.
- `src/ui/` — HUD y panel de escrituras.
- `docs/REGLAS.md` — reglas completas. `docs/FUENTES.md` — de dónde sale cada
  número y qué falta verificar.

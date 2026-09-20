# Chacarero

El clásico juego argentino de compra-venta de campos, con tablero hexagonal
de 42 casilleros, en una escena Three.js.

**Demo:** https://mred-randomprojects.github.io/chacarero/

Se juega **online** (armás una mesa, pasás el link, cada uno desde su pantalla)
o en **modo mesa** (todos por turnos en la misma pantalla, sin servidor ni
internet). Tirás los dados,
comprás campos, cobrás alquileres, levantás tarjetas de Suerte y Destino,
construís chacras y estancias, hipotecás cuando no te alcanza y, si no hay
más remedio, quebrás. Gana el último que queda.

Online, el servidor es el único que mueve la partida: tira los dados, aplica
las jugadas, lleva el reloj de cada decisión (y decide por vos si te fuiste) y
manda la mesa entera a todos después de cada cambio. Cada pantalla reproduce
lo mismo, paso a paso. Si refrescás, volvés a tu silla.

## Controles

- **El turno, paso a paso**: mantené apretado el botón (o la barra
  espaciadora) para mezclar los dados, soltá para tirar; después movés el
  peón con un clic; si caés en Suerte o Destino la tarjeta se levanta de la
  mesa y la aplicás cuando la leíste. Cada cosa que pasa se anuncia de a una
  y se ve en la mesa: los billetes vuelan de una pila a otra, las escrituras
  van del Banco a tu lado, las chacras caen sobre el campo. `Enter` o un clic
  en el aviso apura el paso.
- **Cámara**: arrastrá para girar, rueda para acercar (hasta pegar la nariz a
  los billetes). `⌥ Option/Alt + arrastrar` agarra la mesa y la desliza;
  `⌥ + clic` centra la vista en ese punto; doble clic en un casillero o en una
  escritura acerca la cámara ahí. Teclado: `← → ↑ ↓` giran e inclinan, `+ −`
  acercan, `1`–`6` te sientan en el lugar de cada jugador, `M` en el del
  jugador de turno, `0` vista general, `T` desde arriba. La cámara sigue al
  peón mientras camina y se sienta con el jugador de turno (ambas cosas se
  apagan en Ajustes).
- **Ajustes** (`,` o el engranaje): ritmo de los avisos, tiempo para decidir
  (o sin límite), volumen, y qué hace la cámara sola.
- **Sonido**: dados que se mezclan y rebotan, pasos del peón, cartas, plata,
  martillo del remate, la puerta de la Comisaría y una fanfarria al ganar.
  Muestras CC0 de [Kenney](https://kenney.nl).
- **Decisiones**: cada decisión (tirar, mover, comprar o no, pagar o levantar
  tarjeta, rematar, canjear, pagar una deuda, terminar el turno) tiene 3
  minutos y una acción por defecto (no comprar → remate, pagar, pasar,
  rechazar, terminar), así un jugador que se fue no traba la mesa. El tiempo
  se multiplica o se apaga en Ajustes; en modo mesa también con la casilla al
  armar la partida.
- **Al armar la partida** (modo mesa o sala online): plata inicial y,
  opcionalmente, **escrituras repartidas** (2, 3 o 4 por jugador, gratis y al
  azar, antes de la primera tirada). Es la variante del reglamento para
  acortar la partida, y hace que haya canjes y construcciones desde el primer
  turno.
- **Propiedades**: cada jugador tiene su plata y sus escrituras sobre la mesa,
  de su lado (los billetes son decorativos: la cifra del cartel es la que
  vale). Hacé clic en una escritura (en la mesa o en el tablero) para
  construir, vender o hipotecar. `L` abre la lista completa de propiedades.
- **Canjes**: en tu turno (o mientras juntás plata para una deuda) podés
  proponerle un canje a otro jugador con `C`, el botón **Canjear** o desde
  la escritura que querés. Elegís qué escrituras y cuánta plata da cada uno;
  el otro ve la propuesta en su pantalla y la acepta, la rechaza o manda una
  contraoferta. Mientras tanto la mesa espera (si nadie contesta, se
  rechaza). Las escrituras y los billetes vuelan de un lado al otro cuando
  se cierra el trato.

## Desarrollo

```bash
bun install
bun run server:dev # servidor de mesas en ws://localhost:9902/ws
bun run dev        # cliente en http://localhost:5173/chacarero/
bun run test       # vitest (motor, sala, sonidos, escena)
bun run typecheck
bun run lint
bun run build
```

### Probar rápido

- **Todo en una pantalla, sin servidor**: menú → *Jugar en esta pantalla*,
  marcá *Sin tiempo para decidir* y repartí 3 escrituras por jugador. Con eso
  podés probar canjes (`C`), construcciones, hipotecas y remates desde el
  primer turno, sin apuro. En desarrollo, `window.__chacarero.getGame()` /
  `setGame(estado)` en la consola permiten inspeccionar o reemplazar el
  estado de la partida local.
- **Online desde una sola PC**: levantá el servidor, armá una mesa y usá
  *Abrir otra pestaña como otro jugador* en la sala (solo en desarrollo), o
  abrí a mano `?mesa=CODIGO&jugador=otro`: cada pestaña con un `jugador`
  distinto es una silla distinta. Así se ve la propuesta de canje de un lado
  y la respuesta del otro.

Cada push a `main` despliega el cliente a GitHub Pages; el servidor de mesas
se despliega al droplet con `./deploy.sh` (ver `deploy/README.md`).

## Estructura

- `src/game/` — datos y tipos del juego, sin dependencias de UI: los 42
  casilleros, las 29 escrituras con sus tablas de alquiler, las 32 tarjetas y
  las constantes del reglamento. Todo con tests.
- `src/game/engine/` — el motor: `GameState` inmutable y funciones puras
  (`rollDice`, `movePawn`, `buy`, `buildChacra`, `mortgage`, `proposeTrade`,
  `declareBankruptcy`…) que devuelven el estado siguiente y registran eventos.
  `actionRequest.ts` y `timing.ts` son lo que comparten el servidor y el modo
  mesa: qué jugada puede mandar quién, cuánto dura cada decisión y qué pasa si
  nadie decide.
- `server/` — la sala (Bun + WebSocket): `room.ts` es lógica pura con tests
  (entrar, reconectar, empezar, jugadas con número de secuencia, relojes) e
  `index.ts` la sirve junto con el cliente compilado.
- `src/net/` — protocolo (Zod), cliente WebSocket con reconexión, identidad
  del navegador. `src/session/` — la sesión local y la online detrás de una
  misma interfaz.
- `src/scene/` — geometría del anillo hexagonal (`hexLayout.ts`), las caras de
  los casilleros dibujadas en canvas, y los componentes de react-three-fiber.
- `src/ui/` — HUD y panel de escrituras.
- `docs/REGLAS.md` — reglas completas. `docs/FUENTES.md` — de dónde sale cada
  número y qué falta verificar.

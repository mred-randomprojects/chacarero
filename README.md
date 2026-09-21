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

- **Fichas**: al armar la mesa cada jugador elige su ficha (tractor, vaca,
  caballo, mate, bota, oveja, gallo o sombrero); la ficha fija el color y el
  ícono con que el juego te muestra en todos lados, y una ficha tomada queda
  bloqueada para los demás. Un clic en la tarjeta de un jugador (abajo), o su
  número, muestra al instante su lado de la mesa (sus escrituras y su plata);
  el mismo clic, la misma tecla o `Escape` vuelven al instante a donde estaba
  la cámara. Es un vistazo, no un vuelo: la partida sigue.
- **Quién empieza**: antes del primer turno cada uno tira una vez; el más
  alto empieza y los empatados vuelven a tirar.
- **El turno, paso a paso**: mantené apretado el botón (o la barra
  espaciadora): los dados vuelan de la mesa a tus manos y se mezclan delante
  de la cámara; soltá para tirar. Caen al lado de tu peón (si le pegan a una
  ficha, la sacuden), quedan un momento en el paño para que todos los lean y
  recién después suben a la cámara (un doble brilla en dorado); los
  casilleros que vas a recorrer se iluminan en orden y movés el peón con un
  clic, con la cámara pegada atrás, salto a salto. Si caés en Suerte o
  Destino, levantás la tarjeta: sale del mazo, se da vuelta frente a la
  cámara (la cámara retrocede para que se vea entera) y la aplicás cuando la
  leíste. Si caés en una escritura libre, la escritura sube grande a la
  pantalla (siempre del mismo tamaño) con todo lo que dice al lado: comprás o
  la mandás a remate. Si caés en una escritura ajena, nadie te saca la plata
  solo: la mesa se detiene con el alquiler **en grande** y pagás con `Pagar
  [P]` (antes podés vender, hipotecar o negociar). Cada cosa que pasa se
  anuncia de a una y se ve en la mesa: los billetes vuelan de una pila a otra
  (y entre las tarjetas de los jugadores, abajo de la pantalla), las
  escrituras van del Banco a tu lado, las chacras caen sobre el campo.
  `Espacio`, `Enter` o un clic en el aviso apuran lo que queda de la jugada al
  doble de velocidad: nada se saltea, el peón camina todos los casilleros.
- **Teclas**: cada botón muestra la suya (`Comprar [C]`, `Mandar a remate
  [R]`, `Pagar [P]`, `Ofertar [B]`, `Pasar [X]`, `Aceptar [A]`, `Rechazar
  [X]`, `Contraofertar [O]`, `Negociar [N]`, `Catastro [L]`…). **Espacio / Enter**
  solo hacen el paso inofensivo del momento: mover el peón, levantar o
  aplicar la tarjeta, terminar el turno; nunca compran, ofertan ni aceptan un
  canje. (Con los dados en la mano, Espacio los mezcla; durante un aviso, lo
  apura.)
- **Cámara**: por defecto todas las pantallas ven lo mismo: al empezar cada
  turno la cámara vuela (sube, y baja) hasta el peón del jugador de turno,
  lo sigue de cerca salto a salto (también para atrás, también el segundo
  movimiento de una misma jugada), se queda en el casillero donde cae, acompaña
  los billetes y las escrituras que cruzan la mesa, y las tarjetas y los dados
  se le ponen enfrente. El peón del jugador de turno es el centro: después de
  cada jugada (pagar, comprar, un remate, un canje) la cámara vuelve a él. Ir
  preso se ve desde arriba, de un lado al otro del tablero, sin marearse.
  Nunca se va sola al lugar de un jugador. Si arrastrás
  o usás la rueda (un clic no cuenta), esa pantalla queda libre hasta el turno
  siguiente (o hasta apretar *Volver a la partida*); el botón *Sigue la
  partida* la apaga del todo. `⌥ Option/Alt +
  arrastrar` agarra la mesa y la desliza; `⌥ + clic` centra la vista en ese
  punto; doble clic en un casillero o en una escritura acerca la cámara ahí.
  Teclado: `← → ↑ ↓` giran e inclinan, `+ −` acercan, `1`–`6` te sientan en
  el lugar de cada jugador, `M` en el del jugador de turno, `0` vista
  general, `T` desde arriba.
- **Catastro** (`L` o el botón): todas las escrituras en su casillero fijo
  (la misma grilla de la pantalla de canje), cada una con la ficha y el color
  de su dueño (la banda de arriba es siempre el color de la propiedad), sus
  chacras y estancias, hipotecada si lo está; las libres se leen en gris.
  Pasás el mouse y la escritura se ve grande al costado, con las cuentas
  debajo (escrituras libres, lo que tiene cada uno); clic en una abre su
  casillero. La segunda pestaña es el **Mapa** 2D del tablero (dueños con su
  ficha, pines de los jugadores donde están parados) y la tercera la lista
  completa para construir e hipotecar.
- **Ajustes** (`,` o el engranaje): ritmo de los avisos, tiempo para decidir
  (o sin límite), volumen, qué hace la cámara sola, y la lista de controles.
- **Sonido**: dados que se mezclan y rebotan, pasos del peón, cartas, plata,
  martillo del remate, la puerta de la Comisaría, una fanfarria al ganar y el
  trombón triste de un canje rechazado. Muestras CC0 de
  [Kenney](https://kenney.nl); el trombón es sintetizado.
- **Decisiones**: cada decisión (tirar, mover, levantar o aplicar la tarjeta,
  comprar o no, pagar, rematar, canjear, pagar una deuda, terminar el turno)
  tiene 3 minutos y una acción por defecto (no comprar → remate, pagar,
  pasar, rechazar, terminar), así un jugador que se fue no traba la mesa. El
  reloj no se muestra hasta el último minuto, para que nadie juegue apurado;
  mientras alguien tiene abierta la pantalla de canje, su reloj espera. El
  tiempo se multiplica o se apaga en Ajustes; en modo mesa también con la
  casilla al armar la partida.
- **Al armar la partida** (modo mesa o sala online): plata inicial y,
  opcionalmente, **escrituras repartidas** (2, 3 o 4 por jugador, gratis y al
  azar, antes de la primera tirada). Es la variante del reglamento para
  acortar la partida, y hace que haya canjes y construcciones desde el primer
  turno.
- **Propiedades**: cada jugador tiene su plata y sus escrituras sobre la mesa,
  de su lado (los billetes son decorativos: la cifra del cartel es la que
  vale). Hacé clic en una escritura (en la mesa o en el tablero) para
  construir, vender o hipotecar. `L` abre la lista completa de propiedades.
- **Canjes**: en cualquier momento de tu turno (con los dados en la mesa,
  con una tarjeta levantada, y sobre todo antes de pagar una deuda) podés
  proponerle un canje a otro jugador con `N`, el botón **Negociar** o desde
  la escritura que querés. La pantalla de canje ocupa todo: primero elegís
  con quién (una ficha grande por jugador), después dos mitades, *Ofrecés* y
  *Pedís*, con las escrituras de cada uno en una grilla fija (las que tiene,
  encendidas; el resto, en sombra), plata de cada lado, la escritura grande
  al pasar el mouse, y el valor de tabla de cada lado con una barra que dice
  quién da más. El otro ve la propuesta en la misma pantalla y la acepta
  (apretón de manos y papelitos), la rechaza (trombón triste) o manda una
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
- **Verificar la cámara y las animaciones sin mirar**: en desarrollo,
  `window.__chacareroFrames.run(60)` mueve la escena con un temporizador (una
  pestaña oculta no anima con `requestAnimationFrame`), y
  `window.__chacarero.trackers` expone la posición de la cámara y de lo que se
  está moviendo, para muestrear desde la consola o un script.
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
- `src/ui/` — HUD: tarjetas de jugadores, barra superior, avisos y prompts,
  pantalla de canje, mapa 2D, panel de escrituras.
- `docs/GUIDELINES.md` — las reglas de cómo tiene que sentirse y construirse el
  juego (una sola escena 3D, la cámara como público, paso a paso, nada se
  teletransporta, teclas seguras). Leerlas antes de tocar algo.
- `docs/NEXT_FEATURES.md` — el último lote de funciones pedidas, con su
  estado y las notas de implementación para quien siga.
- `docs/REGLAS.md` — reglas completas. `docs/FUENTES.md` — de dónde sale cada
  número y qué falta verificar.

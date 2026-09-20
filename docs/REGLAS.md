# Reglas de Chacarero

Chacarero es un juego de compra-venta de campos para 2 a 6 jugadores. Se gana
siendo el último que queda sin quebrar. Estas reglas describen el juego tal
como lo implementa este repo; son una reescritura propia del reglamento
tradicional (ver [FUENTES.md](FUENTES.md)).

## Componentes

- Tablero hexagonal de 42 casilleros, numerados del 0 (Salida) al 41 en sentido
  horario. Cada lado tiene 6 casilleros y hay uno en cada esquina.
- 29 escrituras: 22 campos (8 provincias divididas en zonas Sur, Centro y Norte;
  Río Negro y Tucumán solo tienen Sur y Norte), 4 ferrocarriles y 3 compañías
  (Compañía Petrolera, Bodega e Ingenio).
- 16 tarjetas de Suerte y 16 de Destino.
- 32 chacras y 12 estancias.
- 2 dados y billetes de $10, $50, $100, $200, $500, $1.000, $2.000 y $5.000.

## Preparación

- Cada jugador recibe **$35.000**. Con menos de 5 jugadores conviene repartir
  más plata para que la partida no se estire.
- Uno hace de banquero (puede jugar igual). El Banco es dueño de todas las
  escrituras, chacras y estancias al empezar.
- Tira cada uno los dados; el más alto empieza.

## El turno

1. Tirá los dados y avanzá esa cantidad de casilleros desde donde estés.
2. Resolvé el casillero donde caíste (ver más abajo).
3. Si sacaste doble, volvés a tirar. Al **tercer doble seguido** vas preso
   directamente a la Comisaría y **devolvés al Banco todo lo que te pagó en
   ese turno** (Salida, premios, tarjetas). Si ya lo gastaste, quedás en deuda
   y tenés que vender o hipotecar.

Cada vez que pasás o caés en la **Salida**, el Banco te paga **$5.000**.

## Casilleros

### Campos, ferrocarriles y compañías

- Si la propiedad no tiene dueño podés comprársela al Banco por el valor que
  figura en el tablero. Al comprar recibís la escritura.
- Si no la comprás, **sale a remate**: ofertan todos los jugadores (vos
  también), empezando por el siguiente, de a $100 como mínimo. Se la lleva la
  oferta más alta cuando nadie más quiere subir; si nadie oferta, queda en el
  Banco.
- Si tiene dueño, le pagás el alquiler que marca la escritura. **El dueño tiene
  que reclamarlo antes de que se vuelvan a tirar los dados**; si no, lo pierde.
- Ferrocarriles: $500 con uno, $1.000 con dos, $2.000 con tres, $4.000 con los
  cuatro (del mismo dueño).
- Compañías: lo que marcaron los dados × 100 con una, × 200 con dos, × 300 con
  las tres.
- Los ferrocarriles y compañías no admiten chacras ni estancias.

### Suerte y Destino

Levantá la primera tarjeta del mazo, hacé lo que dice y devolvela abajo del
mazo. Las tarjetas para salir de la Comisaría se guardan hasta usarlas o
venderlas a otro jugador. Si una tarjeta te manda a una propiedad ajena, pagás
el alquiler normalmente.

### Premios e impuestos

Se cobran o pagan al Banco. Al igual que los alquileres, un premio que no
reclamás antes de la próxima tirada se pierde. Está prohibido avisarle a otro
jugador que le corresponde un premio: multa de $800.

### Comisaría (casillero 14)

- Caer ahí "de visita" no tiene efecto.
- Vas preso al caer en **Marche preso** (35), al sacar tres dobles seguidos o
  por tarjeta. Vas directo, sin cobrar la Salida.
- Preso no cobrás alquileres. Salís pagando **$1.000** antes de tirar, sacando
  doble, usando una tarjeta de salida, o automáticamente después de **3 turnos**
  (pagando la fianza).

### Descanso (21)

Podés quedarte hasta tres turnos sin tirar. Hay que avisar antes de tirar los
dados; si tirás y sacás doble, seguís jugando normalmente.

### Libre estacionamiento (28)

No pasa nada. Al turno siguiente seguís normal.

## Construir

- Para poner chacras en una provincia hay que tener **todas sus zonas**.
- Las chacras se compran solo al Banco, en tu turno, sin necesidad de caer en
  el casillero. Cada escritura dice cuánto cuesta cada chacra en ese campo.
- Se construye parejo: entre dos zonas de la misma provincia nunca puede haber
  más de una chacra de diferencia. Máximo 4 chacras por zona.
- Con 4 chacras en una zona podés pasar a **estancia**: devolvés las 4 chacras
  y pagás el valor de la estancia (igual al de una chacra). Una estancia por
  zona como máximo.
- Si al Banco se le acaban las chacras o estancias, tiene prioridad quien está
  de turno.
- Las chacras y estancias se pueden revender al Banco solo por la **mitad** de
  lo pagado.

## Hipotecas y ventas

- Las escrituras se pueden comprar y vender entre jugadores al precio que
  acuerden. Las chacras y estancias no: solo van y vuelven del Banco.
- En este juego eso se hace con un **canje**: el jugador de turno (o el que
  está juntando plata para pagar una deuda) propone qué escrituras y cuánta
  plata da cada lado; el otro acepta, rechaza o contraoferta. Tiene que haber
  al menos una escritura en juego (plata por nada sería un préstamo, y eso
  está prohibido). Un campo no se puede canjear mientras haya chacras o
  estancias en cualquier zona de su provincia: primero se venden al Banco. La
  partida espera hasta que el canje se resuelve.
- El Banco presta el valor de hipoteca que figura al dorso de la escritura
  (la mitad del precio), cobrando **10 % de interés** por adelantado. Una
  propiedad hipotecada no cobra alquiler. Para levantarla se devuelve el
  préstamo más otro 10 %.
- Si vendés una propiedad hipotecada, el comprador paga 10 % al Banco en el
  momento y, si no la levanta enseguida, otro 10 % cuando lo haga. (Acá el
  10 % se cobra al cerrar el canje y levantarla cuesta lo de siempre.)
- Nadie puede prestarle plata a otro jugador ni hacer alianzas.

## Deudas y quiebra

Si no te alcanza para pagar (un alquiler, un impuesto, una tarjeta, el
cumpleaños de otro), el juego se frena hasta que juntes la plata: vendés
chacras y estancias al Banco (a mitad de precio) o hipotecás. Esto vale
también cuando le debés a alguien en el turno de otro. Si ya no te queda nada
para vender ni hipotecar, quedaste en quiebra: todo lo tuyo pasa al acreedor
(las construcciones se liquidan al Banco y la plata va al acreedor). Si el
acreedor es el Banco, tus escrituras se rematan una por una.

Las escrituras hipotecadas se heredan hipotecadas.

## Para acortar la partida

Se puede repartir más plata al empezar, o repartir escrituras entre los
jugadores antes de la primera tirada. Las dos cosas se eligen al armar la
partida: las escrituras se reparten gratis y al azar, 2, 3 o 4 por jugador.

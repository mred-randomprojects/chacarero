# Fuentes de los datos

Chacarero es una reimplementación del clásico juego argentino de compra-venta
de campos. Ni el nombre ni el arte original se usan: la marca *El Estanciero*
pertenece a la familia Klavins (Yetem) y está licenciada a ToyCo, así que este
proyecto usa un nombre propio y arte propio. Las mecánicas y los números del
juego no son protegibles y se documentan acá con sus fuentes.

## Layout del tablero (42 casilleros, hexagonal)

- [Wikipedia en español](https://es.wikipedia.org/wiki/Estanciero_(juego)):
  orden de las propiedades y precios de compra.
- Redibujo vectorial de la edición hexagonal actual, en
  [Grupo-Prog/Proyecto-EstancieroWebApp-Frontend](https://github.com/Grupo-Prog/Proyecto-EstancieroWebApp-Frontend/tree/main/frontend/src/assets/board):
  posición de las esquinas, casilleros especiales y numeración 0-41.
- Seeds SQL de dos proyectos universitarios (UTN FRC) que transcribieron el
  juego completo:
  [FrancoL42/Estanciero](https://github.com/FrancoL42/Estanciero/blob/main/src/main/resources/Data.sql)
  y [nahuelubal/ElEstanciero-Game](https://github.com/nahuelubal/ElEstanciero-Game/blob/main/src/main/resources/data.sql).

## Escrituras

Los alquileres por campo / 1-4 chacras / estancia, el costo de las chacras y
las hipotecas salen del seed de nahuelubal, contrastados con FrancoL42 (base y
1 chacra coinciden en los 22 campos).

Discrepancias resueltas por mayoría de fuentes:

| Dato | Elegido | Alternativa | Fuentes |
| --- | --- | --- | --- |
| Ingenio, precio | 3.800 | 5.000 (Wikipedia, nahuelubal) | 3.800 en FrancoL42 y en los dos redibujos del tablero |
| Buenos Aires Norte, precio | 7.400 | 7.600 (FrancoL42) | 7.400 en Wikipedia, nahuelubal y el tablero |
| Córdoba Centro, alquileres | 450 / 2.400 / 6.800 / 16.000 / 19.500 / 23.000 | — | Es más barato que Córdoba Sur; las dos transcripciones coinciden, así que se respeta aunque parezca raro |

**Verificado con una caja física (Maxi, septiembre 2026):**

- El precio de la estancia es **igual al valor de una chacra**, y hace falta
  tener las 4 chacras primero (`estanciaCost` en `src/game/deeds.ts`).

**Sin verificar contra una escritura física:**

- Hipotecas de ferrocarriles y compañías: asumidas como la mitad del precio,
  igual que los campos.

## Tarjetas

16 de Suerte y 16 de Destino, según ambos seeds (la edición actual de ToyCo
trae 40; estas 32 corresponden a la edición clásica). Los textos están
reescritos; los efectos y montos son los originales. "Ganó un concurso agrícola"
aparece dos veces en Destino en las dos fuentes, así que se mantiene.

## Reglas

[docs/REGLAS.md](REGLAS.md) es una reescritura propia a partir del
reglamento tal como lo resume Wikipedia y de los escaneos del reglamento
original que circulan en Scribd/pdfcoffee.

## Texto de las escrituras de ferrocarriles y compañías

Las tarjetas físicas explican el alquiler en palabras además del cuadro. El
texto que muestra el juego (`deedText` en `src/game/describe.ts`) se arma con
los números verificados de arriba; la redacción es una reconstrucción a partir
del reglamento, no una transcripción letra por letra de la tarjeta original.

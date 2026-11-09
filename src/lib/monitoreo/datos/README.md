# Agregados de la Sala de Monitoreo

JSON compactos generados por **`python3 scripts-dev/agregados.py`** (Python 3, solo biblioteca estándar)
a partir de los CSV crudos de MEData, que el script descarga desde la fuente a `.cache-datos/`
(ignorada por git; ~240 MB). Aquí **solo hay agregados**: ninguna fila individual, ninguna
coordenada puntual, ninguna columna sociodemográfica. Los lee `src/lib/monitoreo/cargar.ts` con zod
y los resume `src/lib/monitoreo/metricas.ts`.

Última generación: 9 de noviembre de 2026 (`generado` en cada archivo, UTC).

## Fuentes (MEData · Alcaldía de Medellín, licencia CC BY-SA 4.0 según el campo `license` del metadato DKAN)

| Conjunto | id | Archivo descargado | Filas leídas | Con coordenadas válidas | Periodo (corte) |
|---|---|---|---|---|---|
| Incidentes viales | `1-023-25-000094` | `incidentes_viales.csv` (62,3 MB) | 270.765 | 270.765 (100,0 %) | 2014-07-04 → **2020-09-01** |
| Víctimas en incidentes viales | `1-023-25-000360` | `Mede_Victimas_inci.csv` (54,3 MB) | 235.843 (+812.474 filas vacías de relleno omitidas) | 212.883 (90,3 %) | 2014-01-01 → **2021-09-30** |
| Hurto a persona | `1-027-23-000011` | `hurto_a_persona.csv` (124,5 MB) | 326.489 | 284.433 (87,1 %) | 2003-01-01 → **2023-11-30** |

Coordenada válida = número finito dentro de la caja 5,9° < lat < 6,6° y −76° < lng < −75°
(incidentes: `LOCATION` "[lng, lat]"; víctimas: `Latitud`/`Longitud` con coma decimal; hurto:
`latitud`/`longitud`, todas NaN en 2023). `fechaCorte` = fecha máxima observada en el propio archivo;
`modificadoPortal` = campo `modified` del metadato DKAN.

## Supresión (umbral 5)

- **Rejillas**: las celdas con n < 5 se **eliminan**. Dentro de una celda publicada, los sub-conteos
  (condición, heridos/muertos) entre 1 y 4 van como `null`.
- **Tablas**: cualquier conteo entre 1 y 4 va como `null`; las combinaciones sin casos no aparecen.
- `cargar.ts` rechaza el archivo completo si encuentra un conteo entre 1 y 4 (`.refine` en `esquemas.ts`).

| Archivo | Contenido | Celdas/filas totales | Suprimidas |
|---|---|---|---|
| `rejilla-incidentes.json` (50 KB) | rejilla 250 m, incidentes | 1.929 celdas | 259 celdas eliminadas (quedan 1.670) |
| `rejilla-victimas.json` (187 KB) | rejilla 250 m, víctimas con `peaton`/`motociclista`/`ciclista`/`otro` y `heridos`/`muertos` | 1.923 celdas | 252 celdas eliminadas (quedan 1.671) |
| `rejilla-hurto.json` (56 KB) | rejilla 250 m, hurtos a persona | 2.547 celdas | 665 celdas eliminadas (quedan 1.882) |
| `incidentes-comuna.json` (33 KB) | `comunaAnioGravedad` (c, a, g, n) · `comunaHora` (c, h, n) | 425 · 492 filas | 50 · 12 con `n: null` |
| `victimas-comuna.json` (49 KB) | `comunaAnioCondicion` (c, a, cond, n, heridos, muertos) · `muertosPorAnio` (a, n; serie MEData 2014–2021) | 651 · 8 filas | 33 · 0 |
| `hurto-comuna.json` (133 KB) | `comunaAnioModalidad` (c, a, m, n) · `diaSemanaHora` (d, h, n) | 2.997 · 168 filas | 800 · 0 |

Total de la carpeta: ≈ 508 KB (+ 212 KB de `../fixtures/`), por debajo de 1,5 MB.

## Rejilla de 250 m

Celdas cuadradas en grados sobre WGS84 con resolución fija **0,00225°**:
`i = floor(lat / 0,00225)`, `j = floor(lng / 0,00225)`; centro de la celda `((i + 0,5)·res, (j + 0,5)·res)`.
Lado ≈ 250 m en latitud (0,00225 × 111 320 m) y ≈ 249 m en longitud a 6,25° N. La resolución viaja en
cada archivo (`resolucion.grados`) y `metricas.centroCelda` la invierte.

## Normalizaciones documentadas

- Código de comuna a dos dígitos: `5`, `05`, `5.0`, `04 - Aranjuez` → `05`/`04`; se excluyen `Sin Inf`,
  `SIN DATO`, `SD`, `AU`, `In`, `SN`, `0` y cualquier código fuera de `01`–`16`, `50`, `60`, `70`, `80`, `90`.
- Incidentes: `AÑO` con `\r` residual (`2019\r`) limpiado; `GRAVEDAD_ACCIDENTE` `Solo da\xF1os` → `Solo daños`;
  hora local tomada de `FECHA_ACCIDENTE` (no de `FECHA_ACCIDENTES`, que está en UTC).
- Víctimas: condición agrupada en `peaton` (Peatón), `motociclista` (Motociclista + Acompañante de
  Motocicleta en sus dos grafías), `ciclista` (Ciclista) y `otro` (Pasajero, Conductor, Acompañante);
  la tabla `condiciones` de cada archivo lo declara. `muertosPorAnio` cuenta `Gravedad_victima = 'Muertos'`;
  2021 llega solo hasta septiembre.
- Hurto: 30 modalidades agrupadas en Atraco, Descuido, Cosquilleo, Raponazo, Engaño, Escopolamina, Halado,
  Rompimiento (cerradura + typo "cerraduta" + ventana), Sin dato y **Otra** (las 20 restantes); la tabla
  `modalidades` lo declara. Día de la semana ISO (0 = lunes) y hora local desde `fecha_hecho`.
- `cantidad` del CSV de hurto es siempre 1: cada fila cuenta un caso. No se deduplica (los 22.751 duplicados
  exactos pueden ser víctimas múltiples de un mismo hecho).

## Regenerar

```bash
python3 scripts-dev/agregados.py              # descarga lo que falte a .cache-datos/ y reescribe los 6 JSON
python3 scripts-dev/agregados.py --solo hurto # un solo conjunto
npx tsx --test src/lib/monitoreo/metricas.test.ts
```

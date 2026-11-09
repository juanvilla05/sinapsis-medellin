# Fixtures de respaldo de la Sala de Monitoreo

Copias guardadas de las tres fuentes vivas que consulta `src/lib/monitoreo/fuentes.ts`. Se usan
**automáticamente** cuando la fuente no responde (red caída, HTTP ≠ 200, esquema distinto): la
respuesta llega con `guardado: true` y la fecha de captura, y la interfaz dice "copia guardada del…".
Las genera `python3 scripts-dev/fixtures.py` (solo biblioteca estándar); `indice.json` guarda los
metadatos de cada captura y es lo que lee `fuentes.ts`.

Fecha/hora de captura (America/Bogota): **9 de noviembre de 2026, 05:22**.

| Archivo | Fuente | URL exacta | Licencia (texto de los metadatos) |
|---|---|---|---|
| `comunas.geojson` (21 features, 41 KB) | Capa `comunas_y_corregimientos`, cuenta DAGRD de la Alcaldía de Medellín en ArcGIS Online (ítem `ef54074c904c4db897b2c4959747b23c`, propietario `AMED_DAGRD_05`, acceso público). Página: <https://geomedellin-m-medellin.opendata.arcgis.com/datasets/M-Medellin::comunas-y-corregimientos> | `https://services1.arcgis.com/FZVaYraI7sEGQ6rF/arcgis/rest/services/comunas_y_corregimientos/FeatureServer/0/query?where=1%3D1&outFields=codigo,nombre&outSR=4326&maxAllowableOffset=0.0003&f=geojson` | **no declarada** (`licenseInfo` y `copyrightText` vacíos en el ítem y en el servicio; se usa como geometría de referencia con atribución) |
| `policia-anio.json` (17 filas, 2010–2026) | datos.gov.co `ha6j-pa2r` "Homicidios accidente de tránsito Policía Nacional", atribución "Dirección General de la Policía Nacional - DIPON, Bogotá D.C.". Página: <https://www.datos.gov.co/d/ha6j-pa2r> | `https://www.datos.gov.co/resource/ha6j-pa2r.json?$select=substring(fecha_hecho,7,4) as anio,count(*) as n,sum(cantidad::number) as victimas&$where=codigo_dane='05001000'&$group=anio&$order=anio` (respondió 200 a la primera; no hubo que ajustar la sintaxis) | **"Creative Commons Attribution \| Share Alike 4.0 International"** (`licenseId: CC_40_BY_SA`, <http://creativecommons.org/licenses/by-sa/4.0/legalcode>), tomado de `https://www.datos.gov.co/api/views/ha6j-pa2r.json` |
| `consolidado-303.csv` (68.599 bytes descargados con CRLF; git lo normaliza a LF → 66.029 bytes en el repo, mismo contenido) + `consolidado-303.json` (espejo: encabezado + 2.569 filas, para importarlo sin `fs`) | MEData `1-027-23-000303` "Consolidado cantidad de casos criminalidad en comunas por año" (SISC). Página: <https://medata.app.medellin.gov.co/dataset/1-027-23-000303> | `https://medata.app.medellin.gov.co/sites/default/files/distribution/1-027-23-000303/consolidado_cantidad_casos_criminalidad_en_comunas_por_anio.csv` | **CC BY-SA 4.0**: campo `license` del metadato DKAN = `https://creativecommons.org/licenses/by-sa/4.0/legalcode` (`https://medata.app.medellin.gov.co/api/1/metastore/schemas/dataset/items/1-027-23-000303`; `modified: 01-02-2025`) |

## Notas de captura

- **comunas.geojson**: la capa trae 23 features; `SN01` y `SN02` (polígonos sin nombre) se eliminan. Los 21
  códigos restantes (`01`–`16`, `50`, `60`, `70`, `80`, `90`) se verifican contra `src/lib/territorio.ts`
  (`fixtures.py` falla si no coinciden). Los nombres se conservan como los publica la capa
  ("Laureles Estadio", "Corregimiento de San Cristóbal"); para mostrar nombres oficiales usar `territorio.ts`.
  Geometría simplificada en origen (`maxAllowableOffset=0.0003`), suficiente para coropleta y extrusión 3D.
- **policia-anio.json**: respuesta SoQL sin modificar (`anio`, `n`, `victimas` como texto). `fecha_hecho` es texto
  `DD/MM/AAAA`, por eso el año sale de `substring(fecha_hecho,7,4)`. `codigo_dane='05001000'` = Medellín.
  Última carga de filas declarada por la fuente: 1 de septiembre de 2026 (`rowsUpdatedAt`). La serie crece con
  cada carga y el último año es parcial; en la UI siempre "al corte".
- **consolidado-303**: `Codigo_comuna` llega en dos grafías (`10` y `10.0`) más `SIN DATO`; `fuentes.ts` lo
  normaliza con `normalizarCodigoComuna` y excluye lo que no sea una división oficial. Los conteos 1–4 salen
  como `null` por coherencia con el resto de la Sala (el archivo crudo sí los trae).
- Ninguno de los tres archivos contiene filas individuales ni datos personales: son geometría administrativa y
  agregados oficiales por año/comuna.

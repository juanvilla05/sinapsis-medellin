# PULSO Medellín · la ciudad en vivo, con datos abiertos

Una sola herramienta con dos ramas: **la Ciudad**, un mapa en vivo con los datos ya limpios e integrados, y **la Agencia de datos**, la oficina donde agentes auditan, limpian y explican los datos crudos de [MEData](https://medata.app.medellin.gov.co/), el portal de datos abiertos de la Alcaldía de Medellín.

Proyecto de la **Hackathon de Datos ITM 2026** · Isabela Zuluaga y Juan Camilo Villa · Institución Universitaria ITM.

> Propuesta académica presentada a la Alcaldía de Medellín. No es un sitio oficial de la Alcaldía.

En línea: **https://pulsomedellin.com** · Repositorio de entrega: [juanvilla05/sinapsis-medellin](https://github.com/juanvilla05/sinapsis-medellin), fork del repositorio original del equipo [zuluagaisabela/sinapsis-medellin](https://github.com/zuluagaisabela/sinapsis-medellin).

## Entrega (Hackathon de Datos ITM 2026)

| Archivo | Qué es |
|---|---|
| [`instrucciones.txt`](instrucciones.txt) | Cómo abrir o ejecutar el artefacto y qué debe ver el jurado (plantilla de las Reglas del juego) |
| [`guia_entrega.pdf`](guia_entrega.pdf) | Guía de entrega diligenciada, con la ficha de hallazgos sobre MEData ([texto](docs/guia_entrega.md)) |
| [`resumen_pitch.pdf`](resumen_pitch.pdf) | Resumen de una página para la final ([texto](docs/resumen_pitch.md)) |
| [`LICENSE`](LICENSE) | Código MIT; los datos conservan la licencia de su fuente |

Equipo PULSO Medellín · Ingeniería en Ciencias de Datos, Institución Universitaria ITM · categoría Interna · modalidad Visualización · temática Innovación y tecnología.

## Hallazgo principal

**El 92,6 % de los conjuntos de MEData con periodicidad declarada lleva más de 1,5 veces ese plazo sin actualizarse** (313 de 338, según la fecha de modificación que publica el propio catálogo, consultado el 10 de noviembre de 2026).

## La Ciudad · PULSO en vivo (`/`)

La portada es un **mapa 3D de Medellín** (MapLibre + deck.gl sobre OpenFreeMap, sin claves): faros de SIATA con el PM2.5 en vivo, columnas de 250 m de incidentes, víctimas y hurto de MEData, y comunas oficiales. Encima flotan:

- **Tres vistas del mismo dato** (selector bajo el aire): *Puntos* (columnas de 250 m), *Comunas* (toda la ciudad por comunas, sin columnas: color y altura según el total de la comuna) y *Una comuna* (solo la elegida, con sus columnas). La tarjeta de comuna trae el total, su parte de la ciudad, la serie por año, el desglose y el aire de SIATA. Totales desde las tablas por comuna de MEData, con conteos de 1 a 4 suprimidos (`src/pulso/mapa/fichas.ts`).
- **Cámaras en vivo** (capa «Cámaras en vivo»): un punto por cada cámara pública con foto reciente, unas 100 entre el circuito cerrado de la Secretaría de Movilidad (SIMM) y las cámaras de SIATA (deprimidos viales, río y quebradas, panorámicas). Al tocarla se ve su última foto, que se renueva cada minuto.
- **Rutas inteligentes**: Google Routes calcula las alternativas y PULSO las compara por aire (SIATA) y siniestralidad histórica (MEData). La ruta elegida muestra «Así está ahora»: hasta tres cámaras de vía a menos de 150 m del trayecto. Las fotos no entran al puntaje.
- **PulsoBot**: el asistente, disponible 24/7. Se le escribe o se conversa con él por voz de corrido; responde con la cifra y su fuente, mueve el mapa (vuela a la estación, resalta la comuna, dibuja la ruta) y maneja la plataforma (capas, vistas, tema, recorrido, secciones): "muéstrame Medellín por comunas", "muéstrame solo Belén con los hurtos". Sin IA entiende las preguntas con un intérprete propio.

## La Agencia de datos (`/alpujarra`)

La oficina detrás del mapa: una **vista isométrica 2D** (SVG, sin WebGL) que se entiende de un vistazo, sin caminar. Al fondo está el **Archivo MEData** con los datos crudos; una línea animada los lleva por los despachos hasta la **Salida a PULSO**, que abre el mapa de la ciudad. Cada agente tiene su puesto, su nombre y su cifra real con el color de su estado (trabajando, esperando, te necesita, sin señal). Tocar un despacho, en la oficina, en la barra lateral o en la ficha del equipo, abre su herramienta. Los agentes tienen rutina (se levantan, van a su tablero y vuelven) y la Salida a PULSO muestra referencias de Medellín: el Coltejer, la Gobernación, la Alcaldía, La Alpujarra y el río.

Debajo, **"Cómo se ve el problema"**: un diagrama de flujo animado del catálogo (433 conjuntos → periodicidad → al día, atrasados o críticos → 428 con propuesta), un mapa de calor del año de la última actualización por secretaría y una araña que compara dos secretarías en cinco señales de calidad (`src/lib/visuales.ts`, todo desde el catálogo).

- Arriba, cuatro cifras reales: % de conjuntos atrasados, conjuntos auditados, conjuntos críticos y estaciones de SIATA reportando.
- Funciona en celular, tablet y computador; con teclado, cada sala es un botón (Tab + Enter).
- Cada despacho tiene además su página directa: `/frescura`, `/laboratorio`, `/ventanilla`, `/monitoreo`.

## Despachos

| Despacho | Estado | Qué hace |
|---|---|---|
| Reloj de Frescura (Agencia y `/frescura`) | ✅ | Audita los 433 conjuntos del catálogo y compara la periodicidad prometida con la última modificación; ranking por secretaría; consulta en vivo |
| Laboratorio de Limpieza (Agencia y `/laboratorio`) | ✅ | Descarga en vivo el inicio y el final de un archivo de MEData (HTTP Range), detecta la codificación, perfila columnas, aplica reglas de limpieza y muestra el antes y el después |
| Ventanilla de Apertura (Agencia y `/ventanilla`) | ✅ | Una propuesta por conjunto con problemas (428 de 433): actualizarlo, declarar su periodicidad, publicar los datos detrás de un tablero, documentar sus columnas o ampliar su descripción; prioridad alta, media o baja, filtro por secretaría y descarga en CSV. Reglas deterministas en `src/lib/ventanilla.ts` |
| Analista IA · PulsoBot (Agencia y `/analista`) | ✅ | Preguntas en español; cada cifra sale de una herramienta determinista y se cita con conjunto, campo, licencia y fecha de corte. Con clave usa Gemini; sin clave responde en modo directo |
| Sala de Monitoreo (Agencia y `/monitoreo`) | ✅ | Aire en vivo de SIATA (ICA, Resolución 2254 de 2017), brecha de muertes viales MEData vs Policía, y hurto e incidentes por comuna en tabla, mapa y Medellín 3D |
| Comunicaciones (Agencia y `/informe/<secretaría>`) | ✅ | Informe en PDF por secretaría (y uno general): frescura de sus conjuntos, tabla con estado y última modificación, y las propuestas de la Ventanilla; descarga de propuestas en CSV. Solo metadatos públicos (`src/lib/informes.ts`) |

## Ejecutar en local

Versión en línea: **https://pulsomedellin.com**. Los pasos que sigue el jurado están en [`instrucciones.txt`](instrucciones.txt).

Requisitos: **Node.js 20 o superior** (probado con Node 24.15) y conexión a internet (la app consulta MEData, SIATA y datos.gov.co). No hace falta ninguna clave; para el chat con Gemini, copiar `.env.example` a `.env.local`.

```bash
npm install
npm run dev
```

Abrir http://localhost:3000.

### Pipeline (actualizar los datos guardados)

```bash
npm run pipeline
```

Descarga el catálogo de MEData, lo audita y escribe `src/data/catalogo.json` y `src/data/resumen-catalogo.json`.

Agregados de la Sala de Monitoreo (Python 3, solo biblioteca estándar; descarga ~240 MB de CSV de MEData):

```bash
python3 scripts-dev/agregados.py   # rejillas de 250 m y tablas por comuna, con supresión de conteos < 5
python3 scripts-dev/fixtures.py    # copias de respaldo de Policía, consolidado 303 y comunas
```

## Estructura

```
src/lib/calidad.ts       motor de diagnóstico y limpieza (compartido por el pipeline y la limpieza en vivo)
src/lib/catalogo.ts      lectura y auditoría del catálogo DKAN de MEData
src/lib/laboratorio.ts   descarga parcial (inicio + final) y análisis en vivo
src/app/api/*            endpoints en vivo (catálogo y laboratorio) y respaldo guardado
src/lib/ventanilla.ts    reglas de la Ventanilla de Apertura (propuestas por conjunto)
src/agencia/             Agencia de datos: oficina isométrica 2D, personajes y barra lateral
src/mundo/paneles/       herramientas de cada despacho (Reloj, Laboratorio, Ventanilla, Analista, Monitoreo)
src/pulso/               la Ciudad: mapa en vivo, rutas y PulsoBot
src/lib/camaras.ts       cámaras públicas en vivo: listado de SIMM y SIATA (camaras-fuentes.ts lo normaliza)
scripts/pipeline.ts      pipeline automático
src/data/                resultados guardados del pipeline
```

## Datos y fuentes

- **MEData — Alcaldía de Medellín**: catálogo `https://medata.app.medellin.gov.co/api/1/metastore/schemas/dataset/items` y archivos CSV de cada conjunto; en la Sala de Monitoreo, Incidentes viales (1-023-25-000094), Víctimas en incidentes viales (1-023-25-000360), Hurto a persona (1-027-23-000011) y el consolidado de criminalidad por comuna (1-027-23-000303), todos CC BY-SA 4.0.
- **datos.gov.co**: Homicidios en accidente de tránsito de la Policía Nacional (`ha6j-pa2r`), filtrado a Medellín, CC BY-SA 4.0.
- **SIATA**: PM2.5 por estación (capas 602 y 603 del visor), licencia no declarada por la fuente.
- **Datos Abiertos del Distrito (GeoMedellín)**: comunas y corregimientos, licencia no declarada por la fuente.
- **Secretaría de Movilidad de Medellín · SIMM**: cámaras del circuito cerrado de televisión. El listado sale de la capa `CCTV_Movilidad` del servidor de mapas de la Alcaldía (`https://www.medellin.gov.co/servidormapas/rest/services/transporte/VC_Infraest_Gestion_Transito/MapServer/2`) y la foto de cada cámara de `https://www.medellin.gov.co/SIMM/camaras-cctv/`. Licencia no declarada por la fuente; se usa con atribución.
- **SIATA · cámaras**: capas de cámaras del visor (deprimidos, nivel, color, capa límite y panorámicas), con la foto en `https://siata.gov.co/ultimasFotosCamaras/`. Solo se muestran las que se renovaron en los últimos 45 minutos. Licencia no declarada por la fuente; se usa con atribución.
- De las cámaras PULSO solo guarda el listado (nombre, lugar y enlace): cada foto la pide el navegador directamente a la fuente, no pasa por el servidor de PULSO y no se almacena. Si una fuente no responde, se usa el listado guardado con su fecha (`src/lib/fixtures/camaras.json`).
- La Sala de Monitoreo publica solo agregados: celdas de 250 m con 5 casos o más, conteos de 1 a 4 suprimidos y supresión complementaria para que no se puedan recuperar restando (`src/lib/monitoreo/datos/README.md`). Si una fuente no responde, se muestra la copia guardada con su fecha.
- No se almacenan ni se publican datos personales: el Laboratorio procesa muestras en memoria y solo devuelve diagnósticos y unas pocas filas de ejemplo. Las columnas con datos personales o cuasi-identificadores (nombre, documento, placa, teléfono, sexo, edad, dirección, coordenadas…) se detectan por token del encabezado, salen como "•••" en el ejemplo y fuera del CSV descargable; las horas se redondean a la hora en punto (se conservan fecha y barrio).

## Uso de IA

Se usó Claude (Anthropic) como asistente de programación para escribir y depurar el código y para diseñar la oficina isométrica de la Agencia de datos. El equipo revisó y puede explicar cada componente.

Dentro de la aplicación, el Analista puede usar Gemini 2.5 Flash (Google) si hay clave: interpreta la pregunta y elige una herramienta, pero no genera cifras; todas salen de funciones deterministas sobre las fuentes citadas.

## Licencia

Código bajo licencia MIT (ver [`LICENSE`](LICENSE)). Los datos derivados de MEData y datos.gov.co conservan la licencia de su fuente (CC BY-SA 4.0).

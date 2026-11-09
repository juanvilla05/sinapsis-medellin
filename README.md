# SINAPSIS · Centro de Inteligencia de Datos de Medellín

Agentes que auditan, limpian y explican **en vivo** los datos abiertos de [MEData](https://medata.app.medellin.gov.co/), el portal de datos abiertos de la Alcaldía de Medellín.

Proyecto de la **Hackathon de Datos ITM 2026** · Isabela Zuluaga y Juan Camilo Villa · Institución Universitaria ITM.

> Propuesta académica presentada a la Alcaldía de Medellín. No es un sitio oficial de la Alcaldía.

## Hallazgo principal

**El 92,6 % de los conjuntos de MEData con periodicidad declarada lleva más de 1,5 veces ese plazo sin actualizarse** (313 de 338, según la fecha de modificación que publica el propio catálogo, consultado el 8 de noviembre de 2026).

## Mundo 3D (`/`)

La portada es un **mundo 3D** de La Alpujarra (three.js): se camina con WASD o con clic en el piso, se entra al edificio SINAPSIS y en la oficina cada agente atiende su despacho. Al acercarse a un despacho (tecla **E**) se abre su herramienta con datos reales de MEData. El menú "Despachos" permite hacer todo con el teclado, sin usar el 3D.

- Diseño: handoff de Claude Design (`docs/diseno-mundo-3d.md`), portado a `src/mundo/`.
- Panel ejecutivo sin 3D: `/panel`, `/frescura`, `/laboratorio`.

## Despachos

| Despacho | Estado | Qué hace |
|---|---|---|
| Reloj de Frescura (mundo 3D y `/frescura`) | ✅ | Audita los 433 conjuntos del catálogo y compara la periodicidad prometida con la última modificación; ranking por secretaría; consulta en vivo |
| Laboratorio de Limpieza (mundo 3D y `/laboratorio`) | ✅ | Descarga en vivo el inicio y el final de un archivo de MEData (HTTP Range), detecta la codificación, perfila columnas, aplica reglas de limpieza y muestra el antes y el después |
| Ventanilla de Apertura | 🚧 | Propuestas de mejora por conjunto |
| Analista IA | 🚧 | Preguntas en español con respuestas citadas |
| Sala de Monitoreo | 🚧 | Seguridad vial y seguridad para moverse por barrio |

## Ejecutar en local

Requisitos: **Node.js 20 o superior** (probado con Node 24.15) y conexión a internet (la app consulta MEData).

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

## Estructura

```
src/lib/calidad.ts       motor de diagnóstico y limpieza (compartido por el pipeline y la limpieza en vivo)
src/lib/catalogo.ts      lectura y auditoría del catálogo DKAN de MEData
src/lib/laboratorio.ts   descarga parcial (inicio + final) y análisis en vivo
src/app/api/*            endpoints en vivo (catálogo y laboratorio) y respaldo guardado
src/mundo/world3d.js     mundo 3D (three.js r160)
src/mundo/*.tsx          HUD, paneles y conexión con las API
scripts/pipeline.ts      pipeline automático
src/data/                resultados guardados del pipeline
```

## Datos y fuentes

- **MEData — Alcaldía de Medellín**: catálogo `https://medata.app.medellin.gov.co/api/1/metastore/schemas/dataset/items` y archivos CSV de cada conjunto. Uso según los términos del portal de datos abiertos.
- No se almacenan ni se publican datos personales: el Laboratorio procesa muestras en memoria y solo devuelve diagnósticos y unas pocas filas de ejemplo.

## Uso de IA

Se usó Claude (Anthropic) como asistente de programación para escribir y depurar el código, y Claude Design para el diseño visual del mundo 3D. El equipo revisó y puede explicar cada componente.

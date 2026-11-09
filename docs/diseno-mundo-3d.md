# Handoff: SINAPSIS — Mundo 3D de La Alpujarra

## Overview
SINAPSIS es un Centro de Inteligencia de Datos de Medellín presentado como un mundo 3D tipo videojuego: la plaza de La Alpujarra, un edificio al que se entra caminando y una oficina con 5 despachos. En cada despacho trabaja un agente (figura tipo Lego, bien vestida) y cada despacho abre una herramienta de datos reales de MEData. Público: funcionarios de la Alcaldía y jurado de la Hackathon ITM 2026 (no técnicos).

App destino: **Next.js 16 + React 19 + Tailwind CSS 4**, 3D con **three.js** (React Three Fiber o three.js vanilla dentro de un componente cliente), desplegado en Vercel.

## About the Design Files
Los archivos de `prototipo/` son **referencias de diseño hechas en HTML**: un prototipo que muestra el aspecto y el comportamiento esperados, no código de producción para copiar tal cual. La tarea es **recrear este diseño en la app Next.js** con sus patrones (componentes React, Tailwind, rutas).

Excepción útil: `prototipo/world3d.js` es **three.js vanilla (r160)** autocontenido. Se puede portar casi directo a un componente cliente (`'use client'`, `useEffect` → `createWorld(ref.current, callbacks)`, `dispose()` en el cleanup). Es la vía más rápida para llegar al martes. Si hay tiempo, migrarlo a R3F (`<Canvas>`, un componente por grupo: Plaza, Edificio, Oficina, Agente, Jugador).

Para verlo: servir `prototipo/` con un servidor estático (`npx serve prototipo`) y abrir `SINAPSIS 3D.dc.html`. Necesita internet (three.js viene de esm.sh y las fuentes de Google Fonts).

## Fidelity
**Alta fidelidad (hifi)** en la interfaz: colores, tipografía, copy, HUD y paneles son finales.
**Media fidelidad** en el 3D: proporciones, colores, distribución y comportamiento son finales; los modelos son primitivas simples (cajas, cilindros, extrusiones) que se pueden mejorar o sustituir por GLB livianos (portada total < ~5 MB).

---

## Screens / Views

Todo ocurre en **una sola pantalla**: un canvas 3D a pantalla completa (`100vh`, mín. 560 px) con un HUD HTML encima. El panel de herramienta es un modal sobre el canvas.

### 1. Intro (antes de empezar)
- La cámara orbita lentamente la plaza (`autoRotateSpeed 0.35`, desactivado con `prefers-reduced-motion`).
- **Tarjeta intro** a la izquierda, centrada en vertical: `left: clamp(16px,4vw,56px)`, `width: min(460px, 100% - 32px)`, fondo `rgba(255,255,255,.96)`, borde `1px #E3EAF3`, radio 24, padding 28, sombra `0 24px 60px rgba(30,58,95,.18)`, gap 14.
  - Eyebrow: "LA ALPUJARRA · MEDELLÍN", JetBrains Mono 11.5 px, tracking .12em, `#2563EB`.
  - Cifra: "92,6 %", JetBrains Mono 600, `clamp(60px,8vw,96px)`, line-height .95, `#1E3A5F`, tracking −.03em.
  - "de los conjuntos de MEData con periodicidad declarada está atrasado: 313 de 338." Plus Jakarta Sans 600, 17 px, `#0F172A`.
  - Fuente: "Fuente: MEData, Alcaldía de Medellín, consultado el [fecha]", Mono 11 px, `#475569`.
  - Lema: "Conectamos los datos de la ciudad como neuronas de un mismo cerebro." 14.5 px, `#475569`.
  - Botón primario "Entrar a SINAPSIS →": `#2563EB`, hover `#1D4FD7`, texto blanco 15 px 700, padding 14×22, radio 14, sombra `0 10px 24px rgba(37,99,235,.28)`.
  - Botón secundario "Recorrer la plaza": blanco, borde `#E3EAF3`, texto `#1E3A5F` 14 px 700, radio 14.

### 2. Exploración (plaza y oficina)
HUD (todo `position:absolute` sobre el canvas, `pointer-events:none` en los contenedores y `auto` en lo clicable):
- **Marca** arriba a la izquierda (16,16): tarjeta blanca 95 %, radio 16, isotipo (3 círculos conectados: `#2563EB`, `#1E3A5F`, `#2563EB`; líneas `#93B4F5`) + "SINAPSIS" (800, 15 px, tracking .14em, `#1E3A5F`) + línea de estado 12 px `#475569`:
  - afuera: "Plaza de La Alpujarra"
  - adentro: "5 agentes trabajando · {despacho actual | Recepción}"
- **Logo de la Alcaldía** arriba a la derecha: tarjeta blanca, 140×40. Usar el archivo oficial `logo-alcaldia.png` **sin modificarlo**.
- **Menú "DESPACHOS"** (left 16, top 96, width 216): lista de 5 botones (número en chip `#1E3A5F` Mono 10.5 + nombre 13 px 600 + "pronto" en los que están en construcción). Activo/hover: `#EFF6FF`. Abajo, un enlace azul "Entrar al edificio →" / "← Salir a la plaza". Es también la **navegación accesible por teclado** que pide el brief.
- **Indicadores de juego** abajo a la izquierda (bottom 52): "Salud de los datos de la ciudad" (barra `#16A34A` al 7,4 % sobre `#E3EAF3`, valor "7,4 %"), "271 misiones pendientes" (cifra `#DC2626`), "{n} filas rescatadas" (suma real de las limpiezas de la sesión). Tarjetas blancas 95 %, radio 14.
- **Ayuda de controles** abajo a la derecha: tarjeta `rgba(15,23,42,.8)`, texto blanco 11.5 px, en grid de 2 columnas: WASD / ← → caminar · Clic en el piso ir ahí · Arrastrar girar la cámara · Rueda acercar / alejar · E abrir el despacho. Aparece con un fundido de .4 s al empezar.
- **Aviso de despacho cercano** (centrado, bottom 110) cuando el jugador está dentro de un despacho: nombre + botón azul "[E] Abrir herramienta". Borde `1.5px #2563EB`, sombra azul.
- **Pie** (bottom 12, centrado, píldora blanca): "Propuesta académica presentada a la Alcaldía de Medellín. No es un sitio oficial de la Alcaldía." Siempre visible.
- **Etiquetas 3D** (HTML proyectado desde posiciones 3D): píldoras blancas con chip de número sobre cada despacho y "★ Recepción" (solo adentro); "→ La entrada" sobre la puerta (solo afuera); "Tú" azul sobre el jugador; **globo de diálogo** sobre el agente activo con su frase + "Pulsa E o haz clic para entrar" / "Clic para ir".

### 3. Panel de herramienta (modal)
- Capa `fixed inset 0`, fondo `rgba(244,247,251,.55)` + `backdrop-filter: blur(10px)`; panel `max-width 1120`, `max-height 92vh`, scroll interno, radio 24, sombra `0 30px 80px rgba(30,58,95,.22)`.
- Cabecera fija: chip de número (44×44, `#1E3A5F`, radio 12) + nombre (19 px 800) + rol (12.5 px) + botón "← Volver a la oficina". **Esc** también cierra. Mientras el panel está abierto, el mundo se pausa (sin movimiento de teclado).

**Reloj de Frescura (01)**
- Encabezado: "92,6 %" Mono 56 + "313 de 338 conjuntos con periodicidad comparable están atrasados." + botón "↻ Actualizar en vivo desde MEData".
- 4 contadores (grid auto-fit min 170): Crítico 271 `#DC2626` · Atrasado 42 `#D97706` · Al día 25 `#16A34A` · Sin periodicidad 95 `#64748B`; cada uno con "% de 433 conjuntos".
- Barra apilada de 14 px con esas 4 proporciones (gap 2).
- "Secretarías con todos sus conjuntos atrasados": Salud 60 · Desarrollo Económico 48 · Seguridad 34 · Gestión y Control Territorial 16 · Movilidad 13 (barras `#D97706`, ancho proporcional a 60).
- Tabla "Los 433 conjuntos": buscador, chips de filtro (Todos 433, Crítico 271, Atrasado 42, Al día 25, Sin periodicidad 95), columnas CONJUNTO · SECRETARÍA · ÚLTIMA ACT. · ESTADO. Estados diseñados: **Cargando** (filas esqueleto pulsantes + "El Relojero está leyendo las fechas de actualización en MEData…"), **Error** ("MEData no responde en este momento." + "Mostramos la última auditoría guardada, del [fecha]…" + Reintentar), **Vacío** ("Ningún conjunto coincide con “…”."). El estado **Resultado** se llena con las filas reales de la API: no hay filas inventadas en el diseño.

**Laboratorio de Limpieza (02)** (la "misión", momento estrella del pitch)
- Columna izquierda: selector de conjunto (tarjetas; seleccionada con borde `#2563EB` y fondo `#EFF6FF`):
  - *Víctimas en Incidentes viales*: 52 MB · 52.428 filas vacías · 23.352 números con coma decimal · calidad 0 → 98.
  - *Incidentes viales*: 59 MB · 13.096 celdas con espacios o caracteres ocultos · calidad 83 → 99.
- Medidor circular de 170 px (`conic-gradient`; rojo < 50, azul < 90, verde ≥ 90) con el valor en Mono 46 y "antes X → después Y".
- Columna derecha: botón "Iniciar misión / Misión en curso… / Repetir misión"; stepper de 4 pasos (Recibe el expediente · Ilumina los problemas · Repara celda a celda · Sube la calidad); grilla esquemática 16×9 del archivo (neutra `#F1F5F9`; problema `#FEE2E2` con borde `#DC2626`; reparada `#DCFCE7` con borde `#16A34A`); bitácora; reglas aplicadas con conteos reales; "↓ Descargar CSV limpio" al terminar.
- Secuencia del prototipo: fase 1 (0,9 s) → fase 2 rojo (1,2 s) → fase 3: repara celdas en ~30 pasos de 80 ms y el medidor sube en proporción → fase 4 listo y suma filas rescatadas. **En producción la secuencia debe estar ligada al progreso real** de la limpieza (y la bitácora debe mostrar los milisegundos medidos).

**Ventanilla (03), Analista IA (04), Monitoreo (05): "En construcción"**
- Chip "En construcción", la descripción (texto en `AREAS` del prototipo) y bloques punteados con lo que mostrará (p. ej. "Mapa por comunas", "Seguridad vial", "Moverse por barrio").

---

## Mundo 3D: especificación (ver `world3d.js`)

Unidades: 1 = ~0,5 m. Eje Y hacia arriba; la plaza mira a +Z.

**Cámara y luz**: `PerspectiveCamera(fov 34)`, posición inicial (62,58,78), mira a (0,0,6). `OrbitControls` con damping .08, polar 0.35–1.25, distancia 14–140, sin pan. `HemisphereLight(#FFFFFF, #C9D6E8, 1.15)` + `DirectionalLight(#FFF6EA, 1.7)` en (40,70,30) con sombras PCFSoft de 2048. ACES tone mapping, exposición 1.05. Fondo `#DCEBFF`, niebla `#E4EEFC` 110–260.

**Exterior**
- Pasto `#A9CB8E`; anillo de calles `#5B6270` (x = ±46, z = ±40, ancho 6) con líneas `#F5F3EE` y paso de cebra frente a la entrada; andén `#E7E2D8` 86×74; plaza con baldosa `#E9E2D3` / juntas `#D8CFBD`.
- **Edificio SINAPSIS** (carcasa): perfil extruido 36,6 de ancho, 11 de alto, fachada frontal **inclinada** (de z=4,6 arriba a z=11,6 abajo) cubierta de **lamas verticales** `#C9BFAD` cada 0,9. Concreto `#DCD4C4`. Puerta vidrio oscuro `#2B3442` 6×2,6, marquesina `#F2EEE6` con letrero "SINAPSIS" y 2 columnas.
- **Torre** 11×34×9 en (−3,17,−21), concreto beige `#D8CFBE` con ventanería `#3A4352` (8×26).
- Edificio bajo 22×7×9 en (24,·,−22); **muro inclinado** (cuña extruida 24 de largo, 13 de alto) en x≈−40 con lamas.
- **Monumento a la Raza**: forma curva extruida (`quadraticCurve`) de ~21 de alto, `#8F8678`, sobre pedestal circular r 4,4 con flores, en (28,·,22).
- 3 **banderas** (Colombia, Antioquia, Medellín) en mástiles de 9 en x = −16, −12,5, −9; z = 15,5; ondean con rotación senoidal.
- Árboles low-poly (icosaedro plano `#6FA35C`), 3 toldos de vendedores (techos `#2563EB`, `#E0B341`, `#D9534F`), edificios de fondo en pasteles, **montañas** del Valle de Aburrá (conos de 6 caras `#A9BCD6` / `#B7C8DF`) y 5 carros que circulan por el anillo.

**Entrada**: cuando el jugador cruza la puerta, la carcasa sube 40 unidades (lerp ~3,2/s) y se oculta, dejando ver el interior; al salir, baja de nuevo. "Entrar a SINAPSIS" camina automáticamente hasta la recepción y acerca la cámara a distancia 26.

**Interior** (huella x −18…18, z −11…11)
- Piso de baldosa `#F3F5F8` / `#DEE4EC`; paredes `#FBFBFA` de 2,2 (perímetro 3), zócalo `#1E3A5F`, y **studs tipo Lego** `#BFD4F6` (cilindros r .14 cada 0,5 en el canto superior; `InstancedMesh`).
- Despachos (rect = [x1,x2,z1,z2]; tapete con tinte propio; se ilumina con emisivo azul .12 al activarse):
  - 01 Reloj de Frescura [−18,−6,−11,−3], tinte `#E6EEFB`: reloj de pared r 1,15 (aro `#1E3A5F`, manecillas animadas), tablero de 4 semáforos con los colores de estado, escritorio.
  - 02 Laboratorio [−6,6,−11,−3], `#E8F3F5`: mesa de laboratorio con 5 tubos de vidrio (líquido azul emisivo) y matraz, escritorio.
  - 04 Analista IA [6,18,−11,−3], `#EEEAF8`: escritorio con 3 pantallas en arco.
  - 03 Ventanilla [−18,−6,3,11], `#F6EFE4`: mostrador con vidrio, buzón `#1E3A5F`, 2 sellos, archivador.
  - 05 Sala de Monitoreo [6,18,3,11], `#E4EAF3`: videowall 3×2 con mapa (textura emisiva) y escritorio.
  - Recepción centrada (0,·,6): mostrador blanco con franja `#2563EB`, emblema circular en el piso.
- Letreros por despacho: placa `#1E3A5F` con "DESPACHO 0N" (Mono, `#93B4F5`) y nombre (800, blanco).
- **Sinapsis**: líneas `#7FB0FF` en el piso desde la recepción a cada puerta, con pulsos azules `#2563EB` que viajan (0,35 vueltas/s).
- Plantas en maceta blanca en las esquinas.

**Figuras tipo Lego** (`makeFig`, alto total ≈ 2,9)
- Piernas: 2 bloques .42×.74×.46 que pivotan en la cadera (y .8); zapatos `#141210`. Cadera .9×.2×.46.
- Torso: trapecio (abajo 1 de ancho, arriba .74) × 1 × .5 en y 1,48, con **textura frontal dibujada**: solapas, camisa en V, corbata, botones, pañuelo de bolsillo, credencial.
- Brazos: cilindros que pivotan en el hombro (±.47, 1,86) con puño de camisa y mano cilíndrica.
- Cabeza: cilindro r .34 × .62 con stud superior; **cara** dibujada (ojos ovalados, cejas, sonrisa; gafas opcionales).
- Pelo: casquete + concha (`short`, `bun` con moño, `bob`, `long`) o icosaedro (`curly`); diadema con audífonos y micrófono opcional.
- Opcionales: falda (cilindro aplanado), bata larga.
- Animaciones: caminar (piernas/brazos ±0,7 rad, 11 rad/s), teclear (brazos a −1,15 rad con vibración de 14 Hz), saludar (brazo derecho −2,9 rad, oscilación 9 Hz, al estar cerca o con hover), cabeza que mira a los lados.

Vestuario (la interfaz es blanca y azul; **los agentes no**: visten como profesionales):
| Agente | Piel | Pelo | Ropa |
|---|---|---|---|
| Guía (recepción) | `#A8714E` | largo `#22160F` | sastre marfil `#EDE6DA` con falda, blusa `#1E2A3F` |
| Relojero (01) | `#E3BB9A` | corto canoso `#BDB8B0` | traje gris carbón `#3A3C42`, corbata vino `#7A2232`, pañuelo, gafas |
| Científica (02) | `#6E4430` | rizado `#16100D` | bata blanca `#F4F2ED` sobre traje azul marino `#1E2A44`, gafas |
| Ventanilla (03) | `#C48A62` | corto `#1A1310` | blazer camel `#9C7A52`, pantalón `#23304A`, corbata `#1E2A44` |
| Analista (04) | `#EFCDB0` | bob `#6A3720` | traje negro `#1C1C1F` con falda, blusa rosa `#E9CFC6`, audífonos |
| Operadora (05) | `#5A3826` | moño `#120D0A` | traje azul medianoche `#1A2945`, camisa `#D6E3F2`, corbata `#5B6B80` |
| Visitante (jugador, "Tú") | `#C99272` | corto `#3B2A20` | traje `#46506A`, pantalón `#2B3142`, credencial |

---

## Interactions & Behavior
- **Moverse**: WASD/flechas relativas a la cámara, 6,5 u/s, con colisión AABB contra paredes y obstáculos (radio .42). **Clic en el piso** (clic = moverse < 6 px entre pointerdown y pointerup, para no confundirlo con arrastrar): camina a 7,5 u/s por una ruta con puntos de paso (puerta → pasillo central z≈0 → puerta del despacho → interior). Un anillo azul pulsante marca el destino.
- **Clic en un despacho** (o en el menú): camina hasta adentro y al llegar abre la herramienta.
- **Cerca de un despacho**: el agente saluda, el tapete se ilumina, aparecen el globo y el aviso "[E] Abrir herramienta".
- La cámara sigue al jugador (lerp 5/s) y se puede orbitar libremente.
- **Hover** sobre un despacho: cursor de mano + agente saluda + globo "Clic para ir".
- **prefers-reduced-motion**: sin auto-rotación, sin animaciones ambientales, entrada instantánea, misión instantánea.
- Sonido: ninguno (apagado por defecto).
- **Responsive**: en celular el clic/toque en el piso reemplaza a WASD; el menú de despachos y los indicadores deben pasar a una hoja inferior plegable (< 640 px). El proyector de 1920 px funciona tal cual.

## State Management
- `started` (bool): salió de la intro.
- `inside` (bool): el jugador está dentro del edificio (lo emite el mundo con `onInside`).
- `near` (id | null): despacho donde está el jugador (`onNear`).
- `panel` (id | null): herramienta abierta (`onOpen`); pausa el mundo.
- Laboratorio: `ds` ('victimas' | 'incidentes'), `phase` (0–4), `fixed` (celdas reparadas), `rescued` (filas rescatadas de la sesión).
- Reloj: estado de la tabla ('cargando' | 'error' | 'vacio' | 'resultado'), búsqueda, filtro.
- API del mundo (`createWorld(el, {onOpen,onNear,onInside,onReady,reducedMotion})`): `enter()`, `goTo(id)`, `exitBuilding()`, `openNear()`, `setPaused(bool)`, `dispose()`.
- Datos: los consume la app actual desde MEData (auditoría de frescura y limpieza). Toda cifra lleva la fuente "MEData, Alcaldía de Medellín, consultado el [fecha]". **No inventar datos**: está prohibido por las reglas de la hackathon.

## Design Tokens
- Fondos: `#FFFFFF`, gris nube `#F4F7FB`, cielo `#DCEBFF`.
- Bordes: `#E3EAF3`. Studs/acento claro: `#BFD4F6`, `#93B4F5`, `#7FB0FF`.
- Azul principal `#2563EB` (hover `#1D4FD7`); azul profundo `#1E3A5F`; celestes `#DBEAFE`, `#EFF6FF`.
- Texto `#0F172A` / `#475569` / `#64748B`.
- Estados de datos (no cambian de significado): Crítico `#DC2626` · Atrasado `#D97706` · Al día `#16A34A` · Sin periodicidad `#64748B`. Fondos de chip: `#FEF2F2`/`#B91C1C`, `#FFFBEB`/`#B45309`, `#F0FDF4`/`#15803D`, `#F1F5F9`/`#475569`.
- Tipografía: **Plus Jakarta Sans** (400–800) para UI y títulos; **JetBrains Mono** (400–600) para cifras, números de despacho y fuentes.
- Escala tipográfica: 11 · 11.5 · 12.5 · 13 · 13.5 · 14 · 15 · 17 · 19 · 34 · 46 · 56 · 96.
- Radios: 6 · 9 · 10 · 12 · 14 · 16 · 22 · 24 · 999 (píldoras).
- Sombras: tarjeta HUD `0 8px 24px rgba(30,58,95,.1)`; intro `0 24px 60px rgba(30,58,95,.18)`; panel `0 30px 80px rgba(30,58,95,.22)`; botón primario `0 10px 24px rgba(37,99,235,.28)`.
- Espaciado: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 22 · 24 · 28.
- Movimiento: globo/aviso `bubbleIn` .2 s ease-out (opacidad + 6 px); esqueleto 1,4 s; carcasa del edificio lerp 3,2/s; cámara 5/s; ayuda fundido .4 s.

## Assets
- `referencias/alpujarra-dia.png`: foto de referencia de La Alpujarra (aportada por el equipo).
- `logo-alcaldia.png`: **no incluido**; usar el archivo oficial sin modificar (barra superior derecha). Sin escudos de Medellín ni de Antioquia.
- Todas las texturas 3D (fachadas, torso, cara, letreros, banderas, mapa) se generan en código con `<canvas>`; no hay archivos de imagen.
- Isotipo SINAPSIS: SVG inline en el HUD (3 círculos conectados).

## Files
- `prototipo/SINAPSIS 3D.dc.html`: HUD, intro, menú, paneles (Reloj, Laboratorio, En construcción) y estado. La lógica está en el `<script data-dc-script>` al final del archivo (clase `Component`, `renderVals()`).
- `prototipo/world3d.js`: todo el mundo 3D (escena, edificio, oficina, figuras, jugador, rutas, colisiones, etiquetas). Es el archivo clave para portar.
- `prototipo/support.js`, `prototipo/image-slot.js`: runtime del prototipo (no se necesitan en la app).
- `referencias/BRIEF_DISENO_SINAPSIS.md`: brief original con cifras y restricciones.

## Plan sugerido para Claude Code
1. `components/world/World.tsx` (`'use client'`, `dynamic(..., { ssr:false })`): monta `createWorld` portado de `world3d.js` (instalar `three@0.160`, importar `OrbitControls` desde `three/examples/jsm`).
2. `components/hud/*`: Marca, Logo, MenuDespachos, Indicadores, Ayuda, AvisoCercano, Pie (Tailwind con los tokens de arriba).
3. `components/tools/RelojFrescura.tsx`, `Laboratorio.tsx`, `EnConstruccion.tsx` conectados a los endpoints existentes.
4. Accesibilidad: menú navegable con teclado, `aria-label` en el canvas, foco atrapado en el modal, Esc para cerrar, contraste AA.
5. Rendimiento: `setPixelRatio(min(dpr,2))`, sombras 2048 (bajar a 1024 en móvil), studs con `InstancedMesh`.

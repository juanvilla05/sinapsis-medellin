# Guía de entrega del proyecto

Hackathon de Datos ITM 2026 · Formulario de entrega · PULSO Medellín

## 1. Identificación del equipo

| Campo | Respuesta |
|---|---|
| **Nombre del equipo** | PULSO Medellín |
| **Nombre del proyecto** | PULSO Medellín · la ciudad en vivo, con datos abiertos |
| **Categoría** | ☒ Interna    ☐ Externa |
| **Modalidad** | ☐ Análisis de datos    ☐ Pipelines automáticos    ☒ Visualización |
| **Temática** | Innovación y tecnología |
| **Contacto del líder** | cfinancieramedellin@gmail.com · 312 281 1759 |
| **Fecha y hora de entrega** | 10 de noviembre de 2026, 9:08 p. m. |

| Nombre completo | Universidad o IES | Programa | Semestre | Rol |
|---|---|---|---|---|
| Juan Camilo Villa | Institución Universitaria ITM | Ingeniería en Ciencia de Datos | 3 | Líder |
| Isabela Zuluaga | Institución Universitaria ITM | Ingeniería en Ciencia de Datos | 3 | Integrante |

## 2. Problema que resolvieron

| Campo | Respuesta |
|---|---|
| **Problema de Medellín** | Medellín publica 433 conjuntos de datos abiertos en MEData, pero nadie le dice a quien los usa qué tan viejos están. De los 338 que prometen una periodicidad, 313 llevan más de 1,5 veces ese plazo sin actualizarse. Quien consulta la seguridad vial, el hurto o el aire de la ciudad (ciudadanos, periodistas, funcionarios) decide con cifras que pueden tener años de atraso sin saberlo. |
| **Pregunta que guió el trabajo** | ¿Qué tan al día están los datos abiertos de Medellín y qué se puede (y qué no se puede) saber hoy con ellos sobre la ciudad? |
| **Usuario de la solución** | 1) Cualquier persona que se mueve por Medellín: ve el aire de hoy y la siniestralidad histórica de su ruta, con la fecha de corte de cada dato. 2) El equipo de MEData y las secretarías que publican: reciben la lista de conjuntos atrasados y una propuesta de mejora por conjunto. 3) Periodistas, docentes e investigadores: saben qué conjunto sirve y cuál no antes de descargarlo. |

## 3. Solución y valor demostrado

| Campo | Respuesta |
|---|---|
| **Qué hace el artefacto** | Un mapa 3D de Medellín que reúne el aire en vivo de SIATA con la seguridad vial y el hurto de MEData en celdas de 250 m o por comunas, más la Agencia de datos, que audita los 433 conjuntos del catálogo de MEData, limpia sus archivos en vivo y propone una mejora por conjunto. PulsoBot, un asistente con voz, responde citando fuente y fecha de corte. |
| **Cómo lo usa el usuario** | Abre pulsomedellin.com y ve el mapa con las estaciones de aire de hoy. Activa una capa (incidentes viales, víctimas o hurto) y elige cómo verla: puntos calientes en columnas de 250 m, toda la ciudad por comunas o una sola comuna con su total, su serie por año y el aire de su estación. Pide una ruta y compara las alternativas por aire y siniestralidad. Le pregunta a PulsoBot, por texto o por voz, y él mueve el mapa (por ejemplo, «muéstrame solo Belén con los hurtos»). En «Agencia de datos» revisa qué conjuntos están atrasados, limpia un archivo y descarga las propuestas de mejora en CSV. |
| **Valor: decisión o tarea que mejora** | Al ciudadano le permite elegir por dónde moverse sabiendo de cuándo es cada dato. Al equipo de MEData le permite priorizar en minutos qué conjuntos actualizar primero: 271 están en estado crítico (más de 3 veces su plazo) y cada uno tiene su propuesta, filtrable por secretaría. Auditar el catálogo a mano exige abrir 433 fichas una por una. |
| **Hallazgo principal o contribución** | El 92,6 % de los conjuntos de MEData con periodicidad declarada está atrasado: 313 de 338; 271 en estado crítico y solo 25 al día (catálogo consultado el 10 de noviembre de 2026). Se ve en «Agencia de datos» (/alpujarra), bloque «Lo que encontró la Agencia», y conjunto por conjunto en /frescura. Consecuencia concreta: MEData deja de publicar muertes viales en septiembre de 2021, mientras la Policía Nacional reporta 563 en Medellín en 2023; se ve en /monitoreo, pestaña «Brecha», y preguntándole a PulsoBot. |
| **Qué aporta frente a los datos originales** | El portal muestra la fecha de cada conjunto, pero no la compara con la periodicidad prometida ni da una vista de todo el catálogo. PULSO hace esa auditoría completa y repetible, entrega 428 propuestas de mejora, limpia archivos que descargados no se pueden usar tal cual (filas vacías, codificación rota, comunas escritas de varias formas) y cruza MEData con SIATA, la Policía y las comunas del Distrito en un mismo mapa, sin exponer registros individuales. |
| **Limitaciones** | La frescura se mide con la fecha de modificación que publica el propio catálogo, no revisando el contenido de cada archivo. Las capas de MEData son históricas, no el estado actual: incidentes viales hasta el 1 de septiembre de 2020, víctimas hasta el 30 de septiembre de 2021 y hurto hasta el 30 de noviembre de 2023. Las series de muertes viales de MEData y de la Policía usan registros distintos y no coinciden año a año; la brecha muestra que falta publicación, no cuál cifra es la correcta. El PM2.5 de una ruta es una estimación a partir de las estaciones cercanas. Los conteos de 1 a 4 se suprimen y el resultado no permite calificar barrios como seguros o inseguros. |

## 4. Datos utilizados y hallazgos sobre MEData

| Conjunto o fuente (nombre exacto) | Enlace | Fecha de consulta | Variables usadas y cómo se integran |
|---|---|---|---|
| MEData: catálogo de conjuntos de datos (433) | https://medata.app.medellin.gov.co/api/1/metastore/schemas/dataset/items | 10 nov. 2026 | Título, entidad, periodicidad declarada, fecha de modificación y distribuciones. Base del Reloj de Frescura y de la Ventanilla de Apertura. |
| MEData: Incidentes viales (1-023-25-000094) | https://medata.app.medellin.gov.co/dataset/1-023-25-000094 | 9 nov. 2026 | LOCATION, FECHA_ACCIDENTE, GRAVEDAD_ACCIDENTE y comuna. 270.765 filas agregadas en celdas de 250 m y por comuna, año y hora. |
| MEData: Víctimas en Incidentes viales (1-023-25-000360) | https://medata.app.medellin.gov.co/dataset/1-023-25-000360 | 9 nov. 2026 | Latitud, Longitud, Gravedad_victima, condición de la víctima y comuna. 235.843 filas; serie de muertes por año 2014–2021. |
| MEData: Hurto a persona (1-027-23-000011) | https://medata.app.medellin.gov.co/dataset/1-027-23-000011 | 9 nov. 2026 | latitud, longitud, fecha_hecho, modalidad y comuna. 326.489 filas agregadas en celdas de 250 m y por comuna, año y modalidad. |
| MEData: Consolidado cantidad de casos criminalidad en comunas por año (1-027-23-000303) | https://medata.app.medellin.gov.co/dataset/1-027-23-000303 | 9 nov. 2026 y en vivo | Total de casos por comuna y año; controla los totales de hurto por comuna. |
| datos.gov.co: Homicidios accidente de tránsito, Policía Nacional (ha6j-pa2r), filtrado a Medellín | https://www.datos.gov.co/d/ha6j-pa2r | 9 nov. 2026 y en vivo | fecha_hecho, codigo_dane (05001000) y cantidad. Muertes viales por año, comparadas con la serie de MEData. |
| Datos Abiertos del Distrito (GeoMedellín): Comunas y corregimientos | https://geomedellin-m-medellin.opendata.arcgis.com/datasets/M-Medellin::comunas-y-corregimientos | 9 nov. 2026 y en vivo | Código, nombre y polígono de cada comuna; se une por código de comuna a dos dígitos. |
| SIATA: capas ICA PM2.5 de estaciones (602 y 603 del visor) | https://siata.gov.co | En vivo, cada consulta | PM2.5 e índice por estación, con hora de lectura; categoría según la Resolución 2254 de 2017. Faros del mapa y puntaje de aire de las rutas. |

| Campo | Respuesta |
|---|---|
| **Dificultades encontradas** | 1. Catálogo de MEData: 313 de 338 conjuntos con periodicidad están atrasados; 95 no declaran periodicidad; 410 de 433 publican el campo «modified» como DD-MM-AAAA en lugar de ISO 8601; 21 no tienen diccionario de datos y 20 solo publican un tablero, sin archivo descargable.<br>2. incidentes_viales.csv: el archivo termina el 1 de septiembre de 2020. Una sola celda de 250 m (6,2224 / −75,7046) concentra 19.613 incidentes, el 7,2 % del total: es una coordenada por defecto en LOCATION, no un lugar real. AÑO trae un retorno de carro pegado («2019\r»), GRAVEDAD_ACCIDENTE trae «Solo daños» con la codificación rota, y hay dos campos de fecha con horas distintas (FECHA_ACCIDENTE en hora local y FECHA_ACCIDENTES en UTC).<br>3. Mede_Victimas_inci.csv: 812.474 filas vacías de relleno sobre 1.048.317 (77,5 %); termina el 30 de septiembre de 2021; 21.726 filas sin comuna válida; la comuna aparece escrita de varias formas («04 - Aranjuez», «Sin Inf»); Latitud y Longitud usan coma decimal y el 9,7 % no trae coordenadas.<br>4. hurto_a_persona.csv: latitud y longitud vienen vacías en todo 2023; el 12,9 % de las filas no tiene coordenadas válidas; 30 modalidades con errores de digitación («cerraduta») y 22.751 filas duplicadas exactas.<br>5. SIATA y GeoMedellín no declaran licencia; se usan con atribución. |
| **Lo que no se pudo responder** | 1. Cuántas personas murieron en las vías de Medellín entre 2022 y 2026 según MEData, ni dónde: el conjunto de víctimas se detiene en septiembre de 2021.<br>2. Dónde ocurren hoy los incidentes viales: el conjunto se detiene en septiembre de 2020.<br>3. Dónde ocurrieron los hurtos de 2023: ese año no trae coordenadas.<br>4. Qué ocurrió realmente en los 19.613 incidentes ubicados en la coordenada por defecto.<br>5. Por qué difieren las muertes viales de MEData y de la Policía: no hay un identificador común que permita cruzar los casos de las dos fuentes. |
| **Propuesta de apertura o mejora** | 1. Actualizar «Incidentes viales» y «Víctimas en Incidentes viales» hasta 2026 con corte mensual y un campo FECHA_CORTE. Permitiría responder dónde y a qué hora mueren hoy peatones y motociclistas, y cerrar la brecha con la Policía (563 muertes en 2023 que MEData no publica).<br>2. Dejar LOCATION vacío cuando no se conoce el lugar, en vez de una coordenada por defecto, y agregar PRECISION_UBICACION (exacta, aproximada, sin dato) y COD_COMUNA a dos dígitos en los tres conjuntos.<br>3. Publicar los archivos sin filas vacías, en UTF-8, con una sola columna de fecha en ISO 8601 y su zona horaria documentada.<br>4. En el catálogo: fecha de modificación en ISO 8601 (hoy 410 no la cumplen), periodicidad obligatoria (faltan 95), diccionario para los 21 conjuntos que no lo tienen y archivo descargable para los 20 que solo muestran un tablero.<br>5. Las 428 propuestas, una por conjunto (291 de prioridad alta), se pueden filtrar por secretaría y descargar en CSV en pulsomedellin.com/ventanilla. |

## 5. Repositorio y prueba de funcionamiento

| Campo | Respuesta |
|---|---|
| **Enlace al repositorio** | https://github.com/juanvilla05/sinapsis-medellin |
| **Enlace a la versión en línea** | https://pulsomedellin.com · Agencia de datos: https://pulsomedellin.com/alpujarra |
| **Qué necesita el jurado para probarlo** | En línea: solo un navegador con WebGL; sin cuenta ni claves. En el computador: Node.js 20 o superior y conexión a internet; tampoco necesita claves (sin ellas PulsoBot responde en modo directo y el planificador de rutas avisa que requiere clave). |
| **Tiempo estimado de la prueba** | 5 minutos en línea; 10 minutos en ejecución local. |
| **Prueba que debe hacer el jurado** | 1. Abrir https://pulsomedellin.com: mapa 3D con las estaciones de SIATA y la hora de la última lectura.<br>2. Panel «Capas» → «Incidentes viales» → tocar una columna.<br>3. Selector de vista → «Comunas» → tocar La Candelaria.<br>4. Botón «PulsoBot» → preguntar «¿Cuántas muertes viales hubo en 2023 según MEData y la Policía?».<br>5. Menú «Agencia de datos» → bajar a «Lo que encontró la Agencia».<br>6. Abrir /ventanilla y descargar las propuestas en CSV. |
| **Resultado que debe ver** | En la Agencia: «92,6 %» de conjuntos atrasados, 313 de 338, con 271 críticos y 25 al día. En PulsoBot: 563 muertes viales en 2023 según la Policía y MEData sin publicar ese año, con conjunto, campo, licencia y fecha de corte. En el mapa: columnas de 250 m con su cifra al tocarlas y el corte del 1 de septiembre de 2020. Por comunas: La Candelaria con 52.147 incidentes viales, el 20,8 % del total por comunas (julio de 2014 a septiembre de 2020). En la Ventanilla: 428 de 433 conjuntos con propuesta, 291 de prioridad alta. |
| **Tecnologías y uso de IA** | Next.js 16, React 19, TypeScript y Tailwind; MapLibre GL y deck.gl para el mapa; three.js para Medellín 3D en la Sala de Monitoreo; Python 3 (biblioteca estándar) para los agregados con supresión de conteos menores a 5; Vercel para la publicación. Google Routes y Places solo calculan la geometría y los tiempos de las rutas; OpenFreeMap solo aporta la cartografía. Uso de IA, declarado también en instrucciones.txt: Claude (Anthropic) como asistente de programación y de diseño visual; Gemini 2.5 Flash, opcional, interpreta la pregunta en PulsoBot y elige una herramienta, pero no genera cifras: todas salen de funciones deterministas sobre las fuentes citadas; ElevenLabs, opcional, lee la respuesta en voz alta. |

## 6. Lista de verificación antes de entregar

- ☒ El repositorio abre sin iniciar sesión, en una ventana privada del navegador.
- ☒ instrucciones.txt está en la carpeta principal y otra persona logró ejecutar el artefacto siguiéndolo.
- ☒ El resultado de la sección 5 se obtiene tal como está descrito.
- ☒ La pregunta y el hallazgo o la contribución están declarados en las secciones 2 y 3, sin importar la modalidad.
- ☒ Se usa e integra al menos un conjunto de MEData y la sección 4 tiene una propuesta de mejora.
- ☒ Ningún archivo expone datos personales; las fuentes tienen enlace y licencia.
- ☒ El uso de IA está declarado y el equipo puede explicar su solución.
- ☒ Esta guía está en el repositorio como guia_entrega.pdf.

## 7. Declaración del equipo

Declaramos que el trabajo es original del equipo; que usamos datos reales de Medellín provenientes de las fuentes admitidas, citados con su enlace y licencia; que ningún entregable expone datos personales; que declaramos el uso de inteligencia artificial y podemos explicar la solución; y que autorizamos al ITM a divulgar el proyecto con el crédito correspondiente y a registrarlo como uso de datos abiertos.

| Campo | Respuesta |
|---|---|
| **Nombre y firma del líder** | Juan Camilo Villa, en representación del equipo PULSO Medellín |
| **Fecha** | 10 de noviembre de 2026 |

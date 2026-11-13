# Fixtures SIATA (respaldo cuando SIATA no responde)

Copias **sin modificar** de la respuesta real del visor de SIATA, capturadas el
**2026-11-09 01:05 COT** (el campo `fecha_ultima_actualizacion` de todas las estaciones
dice `2026-11-09 01:05:00`; la consulta se hizo a las 01:12 COT).

| Archivo | Capa | Contenido |
|---|---|---|
| `siata-602.json` | `C_00000000000000000000602` · "ICA - PM2.5 Estaciones POECA" | 20 estaciones |
| `siata-603.json` | `C_00000000000000000000603` · "ICA - PM2.5 Estaciones NO POECA" | 3 estaciones (tráfico) |

## Cómo se capturaron

```
POST https://siata.gov.co/siata_nuevo/index.php/capa_service/consultar_capa_carga
Content-Type: application/x-www-form-urlencoded

id_capa=C_00000000000000000000602      (y luego id_capa=C_00000000000000000000603)
```

Particularidades del servicio (por eso `src/lib/siata.ts` es defensivo): el `Content-Type` de la
respuesta dice `text/html` aunque el cuerpo es JSON, el cuerpo empieza con saltos de línea, todos los
números vienen como texto y el valor `ICA_PM25_Valor` es la **concentración de PM2.5 en µg/m³**
(no el índice). La estación #87 (Bello) trae el centinela `-9999` / `ND` (sin dato).

## Uso en la aplicación

`obtenerAire()` (`src/lib/siata.ts`) intenta SIATA en vivo; si falla, responde con estos archivos y
marca `guardado: true` + `capturado: "2026-11-09T01:05:00-05:00"`, y la interfaz avisa
"copia guardada del 09-11 01:05". Nunca se mezclan datos en vivo con la copia.

## Licencia y atribución

Fuente: SIATA – Sistema de Alerta Temprana de Medellín y el Valle de Aburrá (Área Metropolitana
del Valle de Aburrá), capas 602/603 del visor público. **Sin licencia publicada por SIATA; uso
académico con atribución.**

# Listado de cámaras (respaldo cuando una fuente no responde)

`camaras.json` es el listado **ya normalizado** que devolvió `/api/camaras` el **2026-11-13 14:38 COT**:
80 cámaras del circuito cerrado de la Secretaría de Movilidad (SIMM) y 23 de SIATA. Solo trae nombre,
dirección, coordenadas y el enlace https a la última foto de cada una; **no contiene ninguna imagen**.

`obtenerCamaras()` (`src/lib/camaras.ts`) consulta las dos fuentes en vivo; si una falla, toma de este
archivo las cámaras de esa fuente y marca `guardado: true` con `capturado`. Las fotos siempre se piden
en vivo desde el navegador, así que una cámara del listado guardado puede haber dejado de publicar.

Fuentes: capa `CCTV_Movilidad` del servidor de mapas de la Alcaldía de Medellín y capas de cámaras del
visor de SIATA (1071, 1072, 1069, 1073 y 299). **Sin licencia publicada por ninguna de las dos; uso
académico con atribución.**

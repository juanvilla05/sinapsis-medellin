import "server-only";

import { calcularICA, categoriaICA, type ClaveCategoria } from "@/lib/ica";
import { BANDAS, PESOS_PUNTAJE, type ModoRuta } from "@/pulso/rutas/constantes";
import type { BandaRuta, RutaPulso } from "@/pulso/tipos";
import type { RutaCruda } from "./google";
import { decodificarPolilinea, densificar, haversine, muestrear, type LatLng } from "./polilinea";

/**
 * Puntuación de las alternativas de Google con datos abiertos. Ninguna cifra se inventa:
 *
 * 1. PM2.5 estimado (µg/m³) — SIATA, última lectura.
 *    Se toman ~40 puntos repartidos a lo largo de la ruta. En cada punto se estima el PM2.5 por
 *    ponderación por distancia inversa (IDW, potencia 2) con TODAS las estaciones SIATA válidas
 *    (lectura numérica, sin centinela -9999/ND); la distancia mínima se fija en 100 m para que una
 *    estación pegada a la vía no tenga peso infinito. El PM2.5 de la ruta es el promedio de esos puntos.
 *    Es una estimación espacial, no una medición sobre la vía.
 *
 * 2. Incidentes viales históricos cercanos — MEData 1-023-25-000094 (rejilla de 250 m, solo celdas con n ≥ 5).
 *    La polilínea completa se densifica cada 50 m; se suman los `n` de las celdas cuyo centro
 *    ((i+0,5)·0,00225°, (j+0,5)·0,00225°) queda a menos de 150 m de algún punto de la ruta. Cada celda
 *    cuenta una sola vez. Las celdas suprimidas (1–4 casos) no están en el archivo, así que la suma es
 *    un piso. Son incidentes reportados entre 2014 y el corte del conjunto, no tráfico actual.
 *
 * 3. Banda de aire — ICA del PM2.5 estimado según la Resolución 2254 de 2017 (src/lib/ica.ts).
 *
 * 4. Puntaje 0–100 (mayor es mejor), relativo a las alternativas del mismo viaje:
 *      aire           = PM2.5 mínimo entre alternativas / PM2.5 de esta ruta
 *      siniestralidad = (incidentes mínimos + 1) / (incidentes de esta ruta + 1)
 *      tiempo         = duración mínima / duración de esta ruta
 *      puntaje        = 100 × (0,45·aire + 0,35·siniestralidad + 0,20·tiempo)
 *    Cada componente vale 1 para la mejor alternativa y baja en proporción a cuánto peor es
 *    (no un min–max que exageraría diferencias pequeñas). Si un componente no tiene dato para
 *    ninguna alternativa, su peso se reparte entre los demás. Recomendada = mayor puntaje
 *    (en empate, la más rápida).
 */

export interface EstacionPm25 {
  lat: number;
  lng: number;
  pm25: number;
}

/** Celdas de la rejilla de incidentes indexadas por "i,j". */
export interface RejillaIndexada {
  grados: number;
  celdas: Map<string, number>;
}

const PUNTOS_MUESTRA = 40;
const DISTANCIA_MINIMA_IDW_M = 100;
const RADIO_INCIDENTES_M = 150;
const PASO_DENSIFICAR_M = 50;

/** PM2.5 estimado (IDW potencia 2) en un punto. */
function pm25EnPunto(p: LatLng, estaciones: EstacionPm25[]): number {
  let num = 0;
  let den = 0;
  for (const e of estaciones) {
    const d = Math.max(haversine(p, e), DISTANCIA_MINIMA_IDW_M);
    const w = 1 / (d * d);
    num += e.pm25 * w;
    den += w;
  }
  return num / den;
}

export function pm25Ruta(puntos: LatLng[], estaciones: EstacionPm25[]): number | null {
  if (estaciones.length === 0 || puntos.length === 0) return null;
  const muestra = muestrear(puntos, PUNTOS_MUESTRA);
  const suma = muestra.reduce((s, p) => s + pm25EnPunto(p, estaciones), 0);
  return Math.round((suma / muestra.length) * 10) / 10;
}

export function incidentesRuta(puntos: LatLng[], rejilla: RejillaIndexada | null): number | null {
  if (!rejilla) return null;
  const g = rejilla.grados;
  const contadas = new Set<string>();
  let total = 0;
  for (const p of densificar(puntos, PASO_DENSIFICAR_M)) {
    const i0 = Math.floor(p.lat / g);
    const j0 = Math.floor(p.lng / g);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = i0 + di;
        const j = j0 + dj;
        const clave = `${i},${j}`;
        if (contadas.has(clave)) continue;
        const n = rejilla.celdas.get(clave);
        if (n === undefined) continue;
        const centro = { lat: (i + 0.5) * g, lng: (j + 0.5) * g };
        if (haversine(p, centro) <= RADIO_INCIDENTES_M) {
          contadas.add(clave);
          total += n;
        }
      }
    }
  }
  return total;
}

const BANDA_DE_CATEGORIA: Record<ClaveCategoria, BandaRuta> = {
  buena: "buena",
  aceptable: "aceptable",
  "danina-sensibles": "danina",
  danina: "danina",
  "muy-danina": "danina",
  peligrosa: "danina",
  "sin-dato": "sin-dato",
};

export function bandaDePm25(pm25: number | null): BandaRuta {
  return BANDA_DE_CATEGORIA[categoriaICA(calcularICA(pm25)).clave];
}

interface Parcial {
  cruda: RutaCruda;
  puntos: LatLng[];
  pm25: number | null;
  incidentes: number | null;
}

/** Convierte las alternativas de Google en RutaPulso[] puntuadas, de la mejor a la peor. */
export function puntuarRutas(crudas: RutaCruda[], modo: ModoRuta, estaciones: EstacionPm25[], rejilla: RejillaIndexada | null): RutaPulso[] {
  const parciales: Parcial[] = crudas.map((cruda) => {
    const puntos = decodificarPolilinea(cruda.polilinea);
    return { cruda, puntos, pm25: pm25Ruta(puntos, estaciones), incidentes: incidentesRuta(puntos, rejilla) };
  });

  const pms = parciales.map((p) => p.pm25).filter((v): v is number => v !== null);
  const incs = parciales.map((p) => p.incidentes).filter((v): v is number => v !== null);
  const durs = parciales.map((p) => p.cruda.duracionS).filter((v) => v > 0);
  const pmMin = pms.length ? Math.min(...pms) : null;
  const incMin = incs.length ? Math.min(...incs) : null;
  const durMin = durs.length ? Math.min(...durs) : null;

  const pesos = {
    aire: pmMin !== null ? PESOS_PUNTAJE.aire : 0,
    siniestralidad: incMin !== null ? PESOS_PUNTAJE.siniestralidad : 0,
    tiempo: durMin !== null ? PESOS_PUNTAJE.tiempo : 0,
  };
  const sumaPesos = pesos.aire + pesos.siniestralidad + pesos.tiempo || 1;

  const puntuadas = parciales.map((p) => {
    const aire = pmMin !== null && p.pm25 !== null && p.pm25 > 0 ? pmMin / p.pm25 : pmMin === 0 && p.pm25 === 0 ? 1 : 0;
    const sin = incMin !== null && p.incidentes !== null ? (incMin + 1) / (p.incidentes + 1) : 0;
    const tie = durMin !== null && p.cruda.duracionS > 0 ? durMin / p.cruda.duracionS : 0;
    const puntaje = Math.round((100 * (pesos.aire * aire + pesos.siniestralidad * sin + pesos.tiempo * tie)) / sumaPesos);
    return { ...p, puntaje };
  });

  puntuadas.sort((a, b) => b.puntaje - a.puntaje || a.cruda.duracionS - b.cruda.duracionS);

  return puntuadas.map((p, k) => {
    const banda = bandaDePm25(p.pm25);
    const via = p.cruda.descripcion.trim();
    return {
      id: `ruta-${k + 1}`,
      etiqueta: via ? `Ruta ${k + 1} · por ${via}` : `Ruta ${k + 1}`,
      modo,
      puntos: p.puntos.map((q) => [Math.round(q.lng * 1e5) / 1e5, Math.round(q.lat * 1e5) / 1e5] as [number, number]),
      distanciaM: p.cruda.distanciaM,
      duracionS: p.cruda.duracionS,
      pm25Estimado: p.pm25,
      banda,
      incidentesCercanos: p.incidentes,
      puntaje: p.puntaje,
      color: BANDAS[banda].color,
      recomendada: k === 0,
    };
  });
}

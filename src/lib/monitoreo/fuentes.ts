import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import Papa from "papaparse";
import { z } from "zod";
import { COMUNAS_MEDELLIN, normalizarCodigoComuna } from "@/lib/territorio";
import { UMBRAL_SUPRESION } from "./esquemas";
import indice from "./fixtures/indice.json";
import policiaFixture from "./fixtures/policia-anio.json";
import consolidadoFixture from "./fixtures/consolidado-303.json";
import comunasFixture from "./fixtures/comunas.geojson" with { type: "json" };

/**
 * Fuentes vivas de la Sala de Monitoreo bajo Cache Components.
 *
 * Decisión explícita: se acepta ISR, no "en vivo". Cada función lleva `"use cache"` + `cacheLife` +
 * `cacheTag`; la consulta a la fuente usa `AbortSignal.timeout(12000)` y dos reintentos, y la función
 * NUNCA lanza: ante cualquier error (red, HTTP, esquema) devuelve la copia guardada en
 * `src/lib/monitoreo/fixtures/` con `guardado: true` y la fecha de esa captura. Así el prerender del
 * route handler nunca cae a dinámico y el respaldo también queda cacheado.
 *
 * `consultado` es la hora en que corrió la función (la de la revalidación), no "ahora". La interfaz
 * debe decir "consultado HH:MM" o "copia guardada del DD-MM HH:MM" cuando `guardado` es true.
 *
 * Ninguna cifra entre 1 y 4 sale de aquí: `suprimir()` la convierte en null también en los
 * agregados oficiales, por coherencia con el resto de la Sala.
 */

const TIEMPO_ESPERA_MS = 12_000;
const REINTENTOS = 2;

export interface FuenteViva {
  nombre: string;
  id?: string;
  publicador: string;
  url: string;
  pagina: string;
  /** texto de licencia tal como lo declara la fuente, o "no declarada" */
  licencia: string;
}

export interface Snapshot<T> {
  ok: true;
  /** true si `datos` viene de la copia guardada en el repo y no de la fuente */
  guardado: boolean;
  /** fecha/hora (America/Bogota) de la copia guardada en el repo */
  capturado: string;
  /** hora ISO en que se consultó (o se intentó consultar) la fuente */
  consultado: string;
  fuente: FuenteViva;
  datos: T;
}

const suprimir = (n: number): number | null => (n > 0 && n < UMBRAL_SUPRESION ? null : n);

async function descargar(url: string, aceptar: string): Promise<string> {
  let ultimo: unknown;
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS), redirect: "follow", headers: { accept: aceptar } });
      if (r.ok) return await r.text();
      ultimo = new Error(`HTTP ${r.status}`);
      if (r.status >= 400 && r.status < 500) break; // un 4xx no mejora reintentando
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error("descarga fallida");
}

function registrarCaida(fuente: string, e: unknown) {
  const motivo = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.warn(`[monitoreo] ${fuente} no respondió; se usa la copia guardada (${motivo})`);
}

/* ───────────────────────── Policía Nacional · datos.gov.co ha6j-pa2r ───────────────────────── */

export interface FilaPolicia {
  anio: number;
  /** registros (hechos) */
  n: number | null;
  /** víctimas: sum(cantidad) */
  victimas: number | null;
}

export interface SeriePolicia {
  serie: FilaPolicia[];
  anios: { desde: number; hasta: number } | null;
  /** última carga de filas declarada por datos.gov.co al capturar el fixture */
  filasActualizadasFuente: string | null;
}

const filaSoql = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  n: z.coerce.number().int().nonnegative(),
  victimas: z.coerce.number().int().nonnegative(),
});
const respuestaSoql = z.array(filaSoql).min(1);

function normalizarPolicia(crudo: unknown): SeriePolicia {
  const filas = respuestaSoql.parse(crudo).sort((a, b) => a.anio - b.anio);
  return {
    serie: filas.map((f) => ({ anio: f.anio, n: suprimir(f.n), victimas: suprimir(f.victimas) })),
    anios: { desde: filas[0]!.anio, hasta: filas[filas.length - 1]!.anio },
    filasActualizadasFuente: indice.policia.filasActualizadasFuente,
  };
}

const FUENTE_POLICIA: FuenteViva = {
  nombre: indice.policia.nombre,
  publicador: indice.policia.publicador,
  url: indice.policia.url,
  pagina: indice.policia.pagina,
  licencia: indice.policia.licencia,
};

/** Muertes en accidentes de tránsito en Medellín por año según la Policía Nacional. Revalida cada hora. */
export async function obtenerMuertesPolicia(): Promise<Snapshot<SeriePolicia>> {
  "use cache";
  cacheLife({ revalidate: 3600, expire: 86400 });
  cacheTag("monitoreo", "monitoreo-policia");
  const consultado = new Date().toISOString();
  const base = { ok: true as const, capturado: indice.policia.capturado, consultado, fuente: FUENTE_POLICIA };
  try {
    const texto = await descargar(indice.policia.url, "application/json");
    return { ...base, guardado: false, datos: normalizarPolicia(JSON.parse(texto)) };
  } catch (e) {
    registrarCaida("datos.gov.co (Policía)", e);
    return { ...base, guardado: true, datos: normalizarPolicia(policiaFixture) };
  }
}

/* ───────────────────────── Comunas · GeoJSON (ArcGIS Online, DAGRD) ───────────────────────── */

const anillo = z.array(z.array(z.number()).min(2));
const geometria = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(anillo) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(anillo)) }),
]);
const featureComuna = z.object({
  type: z.literal("Feature"),
  properties: z.object({ codigo: z.string(), nombre: z.string().nullable().default("") }),
  geometry: geometria,
});
const coleccion = z.object({ type: z.literal("FeatureCollection"), features: z.array(featureComuna) });

export type GeometriaComuna = z.infer<typeof geometria>;
export interface FeatureComuna {
  type: "Feature";
  properties: { codigo: string; nombre: string };
  geometry: GeometriaComuna;
}
export interface ComunasGeo {
  type: "FeatureCollection";
  features: FeatureComuna[];
  total: number;
}

const CODIGOS_OFICIALES = new Set(COMUNAS_MEDELLIN.map((c) => c.codigo));

/** Filtra SN01/SN02 y cualquier polígono sin código oficial; exige las 21 divisiones completas. */
function normalizarComunas(crudo: unknown): ComunasGeo {
  const features: FeatureComuna[] = [];
  for (const f of coleccion.parse(crudo).features) {
    const codigo = normalizarCodigoComuna(f.properties.codigo);
    if (!codigo) continue;
    features.push({ type: "Feature", properties: { codigo, nombre: (f.properties.nombre ?? "").trim() }, geometry: f.geometry });
  }
  const codigos = new Set(features.map((f) => f.properties.codigo));
  if (codigos.size !== CODIGOS_OFICIALES.size || [...CODIGOS_OFICIALES].some((c) => !codigos.has(c))) {
    throw new Error(`GeoJSON incompleto: ${codigos.size} de ${CODIGOS_OFICIALES.size} divisiones`);
  }
  features.sort((a, b) => a.properties.codigo.localeCompare(b.properties.codigo));
  return { type: "FeatureCollection", features, total: features.length };
}

const FUENTE_COMUNAS: FuenteViva = {
  nombre: indice.comunas.nombre,
  publicador: indice.comunas.publicador,
  url: indice.comunas.url,
  pagina: indice.comunas.pagina,
  licencia: indice.comunas.licencia,
};

/** Geometría de las 16 comunas y 5 corregimientos (WGS84, simplificada). Revalida a diario. */
export async function obtenerComunasGeo(): Promise<Snapshot<ComunasGeo>> {
  "use cache";
  cacheLife("days");
  cacheTag("monitoreo", "monitoreo-comunas");
  const consultado = new Date().toISOString();
  const base = { ok: true as const, capturado: indice.comunas.capturado, consultado, fuente: FUENTE_COMUNAS };
  try {
    const texto = await descargar(indice.comunas.url, "application/geo+json, application/json");
    return { ...base, guardado: false, datos: normalizarComunas(JSON.parse(texto)) };
  } catch (e) {
    registrarCaida("ArcGIS (comunas)", e);
    return { ...base, guardado: true, datos: normalizarComunas(comunasFixture) };
  }
}

/* ───────────────────────── Consolidado criminalidad · MEData 1-027-23-000303 ───────────────────────── */

export interface FilaConsolidado {
  anio: number;
  conducta: string;
  comuna: string;
  /** casos reportados; null = 1–4 (suprimido) */
  casos: number | null;
}

export interface Consolidado {
  filas: FilaConsolidado[];
  conductas: string[];
  anios: number[];
  /** filas con comuna 'SIN DATO' u otro código no oficial, excluidas */
  filasOmitidas: number;
}

const COLUMNAS_303 = ["Fecha_hecho", "Conducta", "Codigo_comuna", "Cantidad_casos"] as const;

function normalizarConsolidado(encabezado: string[], filas: string[][]): Consolidado {
  const idx = COLUMNAS_303.map((c) => encabezado.findIndex((h) => h.trim() === c));
  if (idx.some((i) => i < 0)) throw new Error(`encabezado inesperado: ${encabezado.join(",")}`);
  const [iAnio, iConducta, iComuna, iCasos] = idx as [number, number, number, number];
  const salida: FilaConsolidado[] = [];
  let omitidas = 0;
  for (const fila of filas) {
    const anio = Number.parseInt(fila[iAnio] ?? "", 10);
    const casos = Number.parseInt(fila[iCasos] ?? "", 10);
    const comuna = normalizarCodigoComuna(fila[iComuna]);
    const conducta = (fila[iConducta] ?? "").trim();
    if (!Number.isFinite(anio) || !Number.isFinite(casos) || !conducta) continue;
    if (!comuna) {
      omitidas += 1;
      continue;
    }
    salida.push({ anio, conducta, comuna, casos: suprimir(casos) });
  }
  if (salida.length === 0) throw new Error("consolidado sin filas válidas");
  salida.sort((a, b) => a.anio - b.anio || a.conducta.localeCompare(b.conducta) || a.comuna.localeCompare(b.comuna));
  return {
    filas: salida,
    conductas: [...new Set(salida.map((f) => f.conducta))].sort((a, b) => a.localeCompare(b)),
    anios: [...new Set(salida.map((f) => f.anio))].sort((a, b) => a - b),
    filasOmitidas: omitidas,
  };
}

const FUENTE_CONSOLIDADO: FuenteViva = {
  nombre: indice.consolidado.nombre,
  id: indice.consolidado.id,
  publicador: indice.consolidado.publicador,
  url: indice.consolidado.url,
  pagina: indice.consolidado.pagina,
  licencia: indice.consolidado.licencia,
};

/** Casos por conducta × comuna × año (SISC vía MEData). Revalida cada 6 horas. */
export async function obtenerConsolidado(): Promise<Snapshot<Consolidado>> {
  "use cache";
  cacheLife({ revalidate: 21_600, expire: 172_800 });
  cacheTag("monitoreo", "monitoreo-consolidado");
  const consultado = new Date().toISOString();
  const base = { ok: true as const, capturado: indice.consolidado.capturado, consultado, fuente: FUENTE_CONSOLIDADO };
  try {
    const texto = await descargar(indice.consolidado.url, "text/csv, text/plain");
    const { data } = Papa.parse<string[]>(texto.replace(/^﻿/, ""), { skipEmptyLines: true });
    const [encabezado, ...filas] = data;
    if (!encabezado) throw new Error("CSV vacío");
    return { ...base, guardado: false, datos: normalizarConsolidado(encabezado, filas) };
  } catch (e) {
    registrarCaida("MEData (consolidado 303)", e);
    return { ...base, guardado: true, datos: normalizarConsolidado(consolidadoFixture.encabezado, consolidadoFixture.filas) };
  }
}

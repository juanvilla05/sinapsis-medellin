/**
 * Datos del mapa 3D de PULSO: tipos de las respuestas de las APIs del repo, preparación para deck.gl
 * y utilidades geográficas. Módulo puro (cliente): no importa MapLibre ni deck.gl.
 * Toda cifra viene de /api/siata (SIATA), /api/monitoreo/rejillas (MEData) y /api/monitoreo/comunas (GeoMedellín).
 */
import type { EstacionSiata, SnapshotSiata, SnapshotSiataOk } from "@/lib/aire";
import { CATEGORIAS, type ClaveCategoria } from "@/lib/ica";
import type { CeldaRejillaVictimas, FuenteAgregado, RejillaHurto, RejillaIncidentes, RejillaVictimas, ResolucionRejilla } from "@/lib/monitoreo/esquemas";
import type { CapaPulso, PuntoNombrado, RutaPulso, TemaPulso } from "../tipos";

export type { EstacionSiata, SnapshotSiata, SnapshotSiataOk };

export type Rgba = [number, number, number, number];
export type CapaRejilla = "incidentes" | "victimas" | "hurto";
export const CAPAS_REJILLA: CapaRejilla[] = ["incidentes", "victimas", "hurto"];
export const esCapaRejilla = (c: CapaPulso): c is CapaRejilla => (CAPAS_REJILLA as string[]).includes(c);

/* ───────── respuestas de las APIs ───────── */

export interface RespuestaRejillas {
  ok: true;
  incidentes: RejillaIncidentes | null;
  victimas: RejillaVictimas | null;
  hurto: RejillaHurto | null;
}

type Anillo = number[][];
export type GeometriaComuna = { type: "Polygon"; coordinates: Anillo[] } | { type: "MultiPolygon"; coordinates: Anillo[][] };
export interface FeatureComuna {
  type: "Feature";
  properties: { codigo: string; nombre: string };
  geometry: GeometriaComuna;
}
export interface RespuestaComunas {
  ok: true;
  guardado: boolean;
  consultado: string;
  capturado: string;
  fuente: { nombre: string; publicador: string; url: string; pagina: string; licencia: string };
  datos: { type: "FeatureCollection"; features: FeatureComuna[]; total: number };
}

/** Error con texto propio en español; nunca se muestra el mensaje técnico del navegador. */
export class ErrorPulso extends Error {}

export async function pedirJson<T extends { ok: boolean }>(url: string, senal?: AbortSignal): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { signal: senal, cache: "no-store" });
  } catch {
    throw new ErrorPulso("Sin conexión con el servidor.");
  }
  if (!r.headers.get("content-type")?.includes("application/json")) throw new ErrorPulso("El servidor no respondió.");
  const j = (await r.json()) as T;
  if (!j.ok) throw new ErrorPulso("La fuente no está disponible en este momento.");
  return j;
}

/* ───────── capas: textos ───────── */

export const NOMBRE_CAPA: Record<CapaPulso, string> = {
  aire: "Aire · PM2.5 en vivo",
  incidentes: "Incidentes viales",
  victimas: "Víctimas en incidentes viales",
  hurto: "Hurto a personas",
  comunas: "Comunas y corregimientos",
};
export const CORTO_CAPA: Record<CapaPulso, string> = {
  aire: "Aire",
  incidentes: "Incidentes",
  victimas: "Víctimas",
  hurto: "Hurto",
  comunas: "Comunas",
};
/** Cómo se nombran los casos de una celda ("1.234 incidentes viales reportados"). */
export const UNIDAD_CAPA: Record<CapaRejilla, [string, string]> = {
  incidentes: ["incidente vial reportado", "incidentes viales reportados"],
  victimas: ["víctima en incidentes viales", "víctimas en incidentes viales"],
  hurto: ["hurto a persona reportado", "hurtos a personas reportados"],
};

/* ───────── formato (es-CO, hora de Bogotá) ───────── */

const fmtNum = new Intl.NumberFormat("es-CO");
const fmtDec = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
export const numero = (n: number) => fmtNum.format(n);
export const decimal = (n: number) => fmtDec.format(n);

const fmtHora = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
const fmtFechaHora = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
const fmtFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtMes = new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric", timeZone: "UTC" });

const fecha = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const horaBogota = (iso: string | null | undefined) => {
  const d = fecha(iso);
  return d ? fmtHora.format(d) : null;
};
export const fechaHoraBogota = (iso: string | null | undefined) => {
  const d = fecha(iso);
  return d ? fmtFechaHora.format(d) : null;
};
/** Fecha de solo día ("2020-09-01" → "1 sept 2020"), sin corrimiento de zona horaria. */
export const fechaCorta = (iso: string | null | undefined) => {
  const d = fecha(iso);
  return d ? fmtFecha.format(d) : null;
};
export const mesAnio = (iso: string | null | undefined) => {
  const d = fecha(iso);
  return d ? fmtMes.format(d) : null;
};
export const periodoTexto = (p: FuenteAgregado["periodo"]) => {
  const a = mesAnio(p.desde);
  const b = mesAnio(p.hasta);
  return a && b ? `${a} – ${b}` : (a ?? b ?? "período no declarado");
};

/* ───────── colores ───────── */

export function hexARgba(hex: string, alfa = 255): Rgba {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), alfa];
}

export const colorCategoria = (c: ClaveCategoria, alfa = 255) => hexARgba(CATEGORIAS[c].color, alfa);
export const GRIS_FUERA: Rgba = [148, 163, 184, 110];

/**
 * Rampas secuenciales (sin rojo/verde: no califican territorios).
 * Oscuro: azul → cian → blanco (lo más alto brilla). Claro: azul claro → azul noche (lo más alto pesa).
 */
export const RAMPAS: Record<TemaPulso, { t: number; hex: string }[]> = {
  oscuro: [
    { t: 0, hex: "#1E3A8A" },
    { t: 0.35, hex: "#2563EB" },
    { t: 0.6, hex: "#0EA5E9" },
    { t: 0.82, hex: "#67E8F9" },
    { t: 1, hex: "#F8FAFC" },
  ],
  claro: [
    { t: 0, hex: "#93C5FD" },
    { t: 0.35, hex: "#3B82F6" },
    { t: 0.6, hex: "#1D4ED8" },
    { t: 0.82, hex: "#1E3A8A" },
    { t: 1, hex: "#0B1F4B" },
  ],
};
const RAMPAS_RGB = {
  oscuro: RAMPAS.oscuro.map((p) => ({ t: p.t, c: hexARgba(p.hex) })),
  claro: RAMPAS.claro.map((p) => ({ t: p.t, c: hexARgba(p.hex) })),
};
export function colorRampa(t: number, alfa = 240, tema: TemaPulso = "oscuro"): Rgba {
  const R = RAMPAS_RGB[tema];
  const x = Math.min(1, Math.max(0, t));
  for (let k = 1; k < R.length; k++) {
    const a = R[k - 1]!;
    const b = R[k]!;
    if (x <= b.t) {
      const f = (x - a.t) / (b.t - a.t || 1);
      return [0, 1, 2].map((i) => Math.round(a.c[i]! + (b.c[i]! - a.c[i]!) * f)).concat(alfa) as Rgba;
    }
  }
  return [...R[R.length - 1]!.c.slice(0, 3), alfa] as Rgba;
}
export const gradienteCss = (tema: TemaPulso) => `linear-gradient(90deg, ${RAMPAS[tema].map((p) => `${p.hex} ${p.t * 100}%`).join(", ")})`;

/* ───────── rejillas de 250 m ───────── */

export interface CeldaMapa {
  capa: CapaRejilla;
  i: number;
  j: number;
  n: number;
  lat: number;
  lng: number;
  /** posición en la rampa de color (0–1, escala logarítmica hasta el percentil 99) */
  t: number;
  /** √min(n, tope): altura de la columna antes de escalar */
  h: number;
  victimas?: Pick<CeldaRejillaVictimas, "peaton" | "motociclista" | "ciclista" | "otro" | "heridos" | "muertos">;
}

export interface RejillaMapa {
  capa: CapaRejilla;
  celdas: CeldaMapa[];
  fuente: FuenteAgregado;
  resolucion: ResolucionRejilla;
  /** percentil 99 de n: tope de altura y blanco de la rampa (la celda atípica no aplasta al resto) */
  tope: number;
  maximo: number;
  /** marcas reales de la leyenda: mínimo, mediana, p90 y p99 */
  marcas: { n: number; t: number }[];
}

const cuantil = (ordenados: number[], q: number) => ordenados[Math.min(ordenados.length - 1, Math.max(0, Math.round(q * (ordenados.length - 1))))]!;

export function prepararRejilla(capa: CapaRejilla, r: RejillaIncidentes | RejillaVictimas | RejillaHurto | null): RejillaMapa | null {
  if (!r || r.celdas.length === 0) return null;
  const grados = r.resolucion.grados;
  const ns = r.celdas.map((c) => c.n).sort((a, b) => a - b);
  const minimo = ns[0]!;
  const tope = Math.max(minimo + 1, cuantil(ns, 0.99));
  const lMin = Math.log(minimo);
  const lTope = Math.log(tope);
  const t = (n: number) => Math.min(1, Math.max(0, (Math.log(n) - lMin) / (lTope - lMin || 1)));
  const celdas: CeldaMapa[] = r.celdas.map((c) => {
    const base: CeldaMapa = {
      capa,
      i: c.i,
      j: c.j,
      n: c.n,
      lat: (c.i + 0.5) * grados,
      lng: (c.j + 0.5) * grados,
      t: t(c.n),
      h: Math.sqrt(Math.min(c.n, tope)),
    };
    if (capa === "victimas" && "peaton" in c) {
      const v = c as CeldaRejillaVictimas;
      base.victimas = { peaton: v.peaton, motociclista: v.motociclista, ciclista: v.ciclista, otro: v.otro, heridos: v.heridos, muertos: v.muertos };
    }
    return base;
  });
  const marcas = [minimo, cuantil(ns, 0.5), cuantil(ns, 0.9), tope]
    .filter((n, k, a) => a.indexOf(n) === k)
    .map((n) => ({ n, t: t(n) }));
  return { capa, celdas, fuente: r.fuente, resolucion: r.resolucion, tope, maximo: ns[ns.length - 1]!, marcas };
}

/* ───────── comunas ───────── */

export interface ComunaMapa {
  codigo: string;
  nombre: string;
  /** nombre corto para la etiqueta del mapa ("San Cristóbal" en vez de "Corregimiento de San Cristóbal") */
  etiqueta: string;
  corregimiento: boolean;
  centro: [number, number];
  feature: FeatureComuna;
}

function areaYCentro(anillo: Anillo): { a: number; x: number; y: number } {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let k = 0, m = anillo.length - 1; k < anillo.length; m = k++) {
    const [x0, y0] = anillo[m]!;
    const [x1, y1] = anillo[k]!;
    const f = x0! * y1! - x1! * y0!;
    a += f;
    x += (x0! + x1!) * f;
    y += (y0! + y1!) * f;
  }
  a /= 2;
  return a === 0 ? { a: 0, x: anillo[0]![0]!, y: anillo[0]![1]! } : { a, x: x / (6 * a), y: y / (6 * a) };
}

/** Centroide del polígono exterior más grande (lng, lat). */
export function centroide(g: GeometriaComuna): [number, number] {
  const exteriores = g.type === "Polygon" ? [g.coordinates[0]!] : g.coordinates.map((p) => p[0]!);
  let mejor = { a: 0, x: 0, y: 0 };
  for (const anillo of exteriores) {
    const r = areaYCentro(anillo);
    if (Math.abs(r.a) >= Math.abs(mejor.a)) mejor = r;
  }
  return [mejor.x, mejor.y];
}

function dentroAnillo(x: number, y: number, anillo: Anillo) {
  let dentro = false;
  for (let k = 0, m = anillo.length - 1; k < anillo.length; m = k++) {
    const [xi, yi] = anillo[k]!;
    const [xj, yj] = anillo[m]!;
    if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi! || 1e-12) + xi!) dentro = !dentro;
  }
  return dentro;
}

export function puntoEnGeometria(lng: number, lat: number, g: GeometriaComuna) {
  const poligonos = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return poligonos.some((p) => dentroAnillo(lng, lat, p[0]!) && !p.slice(1).some((h) => dentroAnillo(lng, lat, h)));
}

export function prepararComunas(r: RespuestaComunas | null): ComunaMapa[] | null {
  if (!r) return null;
  return r.datos.features.map((f) => {
    const nombre = f.properties.nombre || `Comuna ${f.properties.codigo}`;
    const corregimiento = Number(f.properties.codigo) >= 50;
    return {
      codigo: f.properties.codigo,
      nombre,
      etiqueta: nombre.replace(/^Corregimiento de /i, ""),
      corregimiento,
      centro: centroide(f.geometry),
      feature: f,
    };
  });
}

export const comunaEn = (comunas: ComunaMapa[] | null, lng: number, lat: number) =>
  comunas?.find((c) => puntoEnGeometria(lng, lat, c.feature.geometry)) ?? null;

/* ───────── rutas ───────── */

export interface RutasMapa {
  rutas: RutaPulso[];
  origen: PuntoNombrado;
  destino: PuntoNombrado;
  elegida: string;
}

const RADIO_TIERRA = 6_371_000;
export function distanciaM([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Distancia acumulada (m) en cada punto: marca de tiempo del "cometa". */
export function acumulado(puntos: [number, number][]) {
  const salida = [0];
  for (let k = 1; k < puntos.length; k++) salida.push(salida[k - 1]! + distanciaM(puntos[k - 1]!, puntos[k]!));
  return salida;
}

export const duracionTexto = (s: number) => {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};
export const distanciaTexto = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${decimal(m / 1000)} km`);

/* ───────── lo que el mapa reporta al pasar el puntero o al tocar ───────── */

export type ObjetoMapa =
  | { tipo: "estacion"; estacion: EstacionSiata }
  | { tipo: "celda"; celda: CeldaMapa }
  | { tipo: "comuna"; codigo: string; nombre: string }
  | { tipo: "ruta"; ruta: RutaPulso };

export interface Pasada {
  x: number;
  y: number;
  objeto: ObjetoMapa;
}

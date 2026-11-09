import type {
  CeldaRejilla,
  CeldaRejillaVictimas,
  ComunaAnioCondicion,
  ComunaAnioGravedad,
  ComunaAnioModalidad,
  ComunaHora,
  Condicion,
  DiaSemanaHora,
  Gravedad,
} from "./esquemas";

/**
 * Funciones puras sobre los agregados de la Sala de Monitoreo: filtrar por capa/año/hora/condición
 * y resumir por comuna o por celda. Nunca inventan un conteo: una comuna sin filas da `valor: null`
 * y una suma que incluyó celdas suprimidas (null = 1–4 casos) queda marcada `incompleto: true`.
 */

export interface FilaComuna {
  c: string;
  n: number | null;
}

export interface ValorComuna {
  codigo: string;
  /** suma de los conteos publicados; null si ninguna fila coincide con el filtro */
  valor: number | null;
  /** true si alguna fila sumada venía suprimida (el valor real es mayor en 1–4 por cada una) */
  incompleto: boolean;
  /** filas suprimidas que aportaron al valor */
  suprimidas: number;
}

export interface ResumenComunas {
  porComuna: ValorComuna[];
  total: number;
  maximo: number;
  comunasConDato: number;
  suprimidas: number;
}

/** Suma `n` por comuna sobre las filas que pasan el filtro. Las comunas se ordenan por código. */
export function sumarPorComuna<T extends FilaComuna>(filas: readonly T[], filtro: (fila: T) => boolean = () => true): ResumenComunas {
  const acumulado = new Map<string, ValorComuna>();
  for (const fila of filas) {
    if (!filtro(fila)) continue;
    const actual = acumulado.get(fila.c) ?? { codigo: fila.c, valor: null, incompleto: false, suprimidas: 0 };
    if (fila.n === null) {
      actual.incompleto = true;
      actual.suprimidas += 1;
      actual.valor ??= 0;
    } else {
      actual.valor = (actual.valor ?? 0) + fila.n;
    }
    acumulado.set(fila.c, actual);
  }
  const porComuna = [...acumulado.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const valores = porComuna.map((v) => v.valor ?? 0);
  return {
    porComuna,
    total: valores.reduce((s, v) => s + v, 0),
    maximo: valores.length ? Math.max(...valores) : 0,
    comunasConDato: porComuna.filter((v) => v.valor !== null && v.valor > 0).length,
    suprimidas: porComuna.reduce((s, v) => s + v.suprimidas, 0),
  };
}

/* ── filtros por capa ── */

export interface FiltroIncidentes {
  anio?: number;
  gravedad?: Gravedad;
}
export const filtrarIncidentes = (filas: readonly ComunaAnioGravedad[], f: FiltroIncidentes = {}) =>
  filas.filter((r) => (f.anio === undefined || r.a === f.anio) && (f.gravedad === undefined || r.g === f.gravedad));

export interface FiltroVictimas {
  anio?: number;
  condicion?: Condicion;
  /** "muertos" | "heridos" cambia qué conteo se lee; por defecto el total `n` */
  gravedad?: "heridos" | "muertos";
}
/** Devuelve filas `{c, n}` listas para `sumarPorComuna`, leyendo el conteo pedido. */
export const filtrarVictimas = (filas: readonly ComunaAnioCondicion[], f: FiltroVictimas = {}): FilaComuna[] =>
  filas
    .filter((r) => (f.anio === undefined || r.a === f.anio) && (f.condicion === undefined || r.cond === f.condicion))
    .map((r) => ({ c: r.c, n: f.gravedad === "muertos" ? r.muertos : f.gravedad === "heridos" ? r.heridos : r.n }));

export interface FiltroHurto {
  anio?: number;
  modalidad?: string;
}
export const filtrarHurto = (filas: readonly ComunaAnioModalidad[], f: FiltroHurto = {}) =>
  filas.filter((r) => (f.anio === undefined || r.a === f.anio) && (f.modalidad === undefined || r.m === f.modalidad));

/* ── series ── */

export interface PuntoHora {
  hora: number;
  valor: number | null;
  incompleto: boolean;
}

/** 24 puntos (0–23). Sin comuna: suma de toda la ciudad. Horas sin filas → null. */
export function serieHoras(filas: readonly ComunaHora[], comuna?: string): PuntoHora[] {
  const puntos: PuntoHora[] = Array.from({ length: 24 }, (_, hora) => ({ hora, valor: null, incompleto: false }));
  for (const fila of filas) {
    if (comuna !== undefined && fila.c !== comuna) continue;
    const p = puntos[fila.h]!;
    if (fila.n === null) {
      p.incompleto = true;
      p.valor ??= 0;
    } else p.valor = (p.valor ?? 0) + fila.n;
  }
  return puntos;
}

export interface CeldaDiaHora {
  dia: number;
  hora: number;
  valor: number | null;
}

/** Matriz 7 × 24 (lunes = 0) para el mapa de calor día × hora. */
export function matrizDiaHora(filas: readonly DiaSemanaHora[]): CeldaDiaHora[][] {
  const matriz = Array.from({ length: 7 }, (_, dia) => Array.from({ length: 24 }, (_, hora): CeldaDiaHora => ({ dia, hora, valor: null })));
  for (const fila of filas) matriz[fila.d]![fila.h]!.valor = fila.n;
  return matriz;
}

/** Años presentes en una tabla, ordenados. */
export const aniosDisponibles = (filas: readonly { a: number }[]): number[] => [...new Set(filas.map((r) => r.a))].sort((x, y) => x - y);

/** Valores distintos de una dimensión (modalidades, gravedades…), ordenados. */
export const valoresDimension = <T, K extends keyof T>(filas: readonly T[], clave: K): T[K][] =>
  [...new Set(filas.map((r) => r[clave]))].sort((x, y) => String(x).localeCompare(String(y)));

/* ── rejilla ── */

export interface CeldaValor {
  i: number;
  j: number;
  valor: number;
}

export interface ResumenCeldas {
  celdas: CeldaValor[];
  total: number;
  maximo: number;
}

/** Celdas de una rejilla simple (incidentes, hurto) con su conteo. */
export function valoresRejilla(celdas: readonly CeldaRejilla[]): ResumenCeldas {
  const lista = celdas.map((c) => ({ i: c.i, j: c.j, valor: c.n }));
  return resumirCeldas(lista);
}

export interface FiltroCeldasVictimas {
  condicion?: Condicion;
  gravedad?: "heridos" | "muertos";
}

/**
 * Celdas de la rejilla de víctimas leyendo el conteo pedido. Una celda cuyo sub-conteo está
 * suprimido (null) se omite: no se dibuja lo que no se puede publicar.
 */
export function valoresRejillaVictimas(celdas: readonly CeldaRejillaVictimas[], f: FiltroCeldasVictimas = {}): ResumenCeldas {
  const lista: CeldaValor[] = [];
  for (const c of celdas) {
    const v = f.gravedad ? c[f.gravedad] : f.condicion ? c[f.condicion] : c.n;
    if (v !== null && v > 0) lista.push({ i: c.i, j: c.j, valor: v });
  }
  return resumirCeldas(lista);
}

function resumirCeldas(celdas: CeldaValor[]): ResumenCeldas {
  let total = 0;
  let maximo = 0;
  for (const c of celdas) {
    total += c.valor;
    if (c.valor > maximo) maximo = c.valor;
  }
  return { celdas, total, maximo };
}

/** Centro geográfico de la celda (i, j) para una resolución en grados. */
export const centroCelda = (i: number, j: number, grados: number) => ({ lat: (i + 0.5) * grados, lng: (j + 0.5) * grados });

/**
 * Resumen por comuna de las tablas de MEData (incidentes, víctimas, hurto) para la vista por comunas
 * y la tarjeta de una comuna. Módulo puro: no inventa conteos. Una fila suprimida (null = 1 a 4 casos)
 * no suma, pero deja el total marcado como `incompleto` ("o más").
 */
import type { FuenteAgregado, HurtoComuna, IncidentesComuna, VictimasComuna } from "@/lib/monitoreo/esquemas";
import type { CapaRejilla } from "./datos";

export interface RespuestaTablas {
  ok: true;
  incidentes: IncidentesComuna | null;
  victimas: VictimasComuna | null;
  hurto: HurtoComuna | null;
}

export interface Suma {
  n: number;
  /** alguna fila sumada venía suprimida: el valor real es mayor */
  incompleto: boolean;
}

export interface DatoComuna {
  codigo: string;
  total: Suma;
  /** parte del total de todas las comunas (0–100) */
  pct: number;
  /** posición 0–1 en la rampa de color (raíz del valor sobre el máximo) */
  t: number;
  porAnio: ({ a: number } & Suma)[];
  desglose: ({ k: string } & Suma)[];
}

export interface ResumenDato {
  capa: CapaRejilla;
  fuente: FuenteAgregado;
  /** suma de todas las comunas con código válido */
  total: number;
  minimo: number;
  maximo: number;
  anios: number[];
  porComuna: Map<string, DatoComuna>;
}

interface Fila {
  c: string;
  a: number;
  k: string;
  n: number | null;
}

const ETIQUETA_CONDICION: Record<string, string> = { peaton: "Peatones", motociclista: "Motociclistas", ciclista: "Ciclistas", otro: "Otros" };
const MAX_DESGLOSE = 4;

function acumular(m: Map<string | number, Suma>, clave: string | number, n: number | null) {
  const s = m.get(clave) ?? { n: 0, incompleto: false };
  if (n === null) s.incompleto = true;
  else s.n += n;
  m.set(clave, s);
}

function resumir(capa: CapaRejilla, fuente: FuenteAgregado, filas: Fila[]): ResumenDato | null {
  if (filas.length === 0) return null;
  const anios = [...new Set(filas.map((f) => f.a))].sort((x, y) => x - y);
  const grupos = new Map<string, { total: Suma; anio: Map<string | number, Suma>; clase: Map<string | number, Suma> }>();
  for (const f of filas) {
    let g = grupos.get(f.c);
    if (!g) grupos.set(f.c, (g = { total: { n: 0, incompleto: false }, anio: new Map(), clase: new Map() }));
    if (f.n === null) g.total.incompleto = true;
    else g.total.n += f.n;
    acumular(g.anio, f.a, f.n);
    acumular(g.clase, f.k, f.n);
  }
  const totales = [...grupos.values()].map((g) => g.total.n);
  const total = totales.reduce((s, v) => s + v, 0);
  const maximo = Math.max(...totales);
  const minimo = Math.min(...totales);
  const porComuna = new Map<string, DatoComuna>();
  for (const [codigo, g] of grupos) {
    porComuna.set(codigo, {
      codigo,
      total: g.total,
      pct: total > 0 ? (g.total.n / total) * 100 : 0,
      t: maximo > 0 ? Math.sqrt(g.total.n / maximo) : 0,
      porAnio: anios.map((a) => ({ a, ...(g.anio.get(a) ?? { n: 0, incompleto: false }) })),
      desglose: [...g.clase.entries()]
        .map(([k, s]) => ({ k: String(k), ...s }))
        .sort((x, y) => y.n - x.n)
        .slice(0, MAX_DESGLOSE),
    });
  }
  return { capa, fuente, total, minimo, maximo, anios, porComuna };
}

export function resumirTablas(r: RespuestaTablas | null): Record<CapaRejilla, ResumenDato | null> {
  return {
    incidentes: r?.incidentes ? resumir("incidentes", r.incidentes.fuente, r.incidentes.comunaAnioGravedad.map((f) => ({ c: f.c, a: f.a, k: f.g, n: f.n }))) : null,
    victimas: r?.victimas
      ? resumir("victimas", r.victimas.fuente, r.victimas.comunaAnioCondicion.map((f) => ({ c: f.c, a: f.a, k: ETIQUETA_CONDICION[f.cond] ?? f.cond, n: f.n })))
      : null,
    hurto: r?.hurto ? resumir("hurto", r.hurto.fuente, r.hurto.comunaAnioModalidad.map((f) => ({ c: f.c, a: f.a, k: f.m, n: f.n }))) : null,
  };
}

const fmt = new Intl.NumberFormat("es-CO");
/** "12.345" o "12.345 o más" si hubo filas suprimidas; "menos de 5" si todo lo sumado venía suprimido. */
/** Versión para la cifra grande: "12.345+" en vez de "12.345 o más". */
export const textoSumaCorto = (s: Suma) => (s.incompleto ? (s.n === 0 ? "<5" : `${fmt.format(s.n)}+`) : fmt.format(s.n));
export const textoSuma = (s: Suma) => (s.incompleto ? (s.n === 0 ? "menos de 5" : `${fmt.format(s.n)} o más`) : fmt.format(s.n));

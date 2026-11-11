/**
 * Cifras para las visualizaciones de la Agencia de datos (flujo del catálogo, mapa de calor del abandono y
 * araña por secretaría). Todo sale de src/data/catalogo.json y de las reglas de la Ventanilla; nada se escribe a mano.
 */
import type { ConjuntoAuditado, EstadoFrescura } from "./catalogo";
import { construirPropuestas } from "./ventanilla";

/* ───────── flujo del catálogo ───────── */

export interface FlujoCatalogo {
  total: number;
  conPeriodicidad: number;
  sinPeriodicidad: number;
  estados: { estado: Exclude<EstadoFrescura, "sin-periodicidad" | "sin-fecha">; n: number; conPropuesta: number }[];
  sinPeriodicidadConPropuesta: number;
  propuestas: number;
  sinPropuesta: number;
}

export function flujoCatalogo(catalogo: ConjuntoAuditado[]): FlujoCatalogo {
  const conProp = new Set(construirPropuestas(catalogo).map((p) => p.id));
  const de = (e: EstadoFrescura) => catalogo.filter((c) => c.estado === e);
  const estados = (["al-dia", "atrasado", "critico"] as const).map((estado) => {
    const g = de(estado);
    return { estado, n: g.length, conPropuesta: g.filter((c) => conProp.has(c.id)).length };
  });
  const sinPer = de("sin-periodicidad");
  return {
    total: catalogo.length,
    conPeriodicidad: estados.reduce((a, e) => a + e.n, 0),
    sinPeriodicidad: sinPer.length,
    estados,
    sinPeriodicidadConPropuesta: sinPer.filter((c) => conProp.has(c.id)).length,
    propuestas: conProp.size,
    sinPropuesta: catalogo.length - conProp.size,
  };
}

/* ───────── mapa de calor: secretaría × año de la última modificación ───────── */

export interface CalorAbandono {
  anios: number[];
  filas: { publicador: string; total: number; porAnio: number[] }[];
  totalesAnio: number[];
  max: number;
}

export function calorAbandono(catalogo: ConjuntoAuditado[], maxFilas = 12): CalorAbandono {
  const conFecha = catalogo.filter((c) => c.modificado);
  const anios = [...new Set(conFecha.map((c) => Number(c.modificado!.slice(0, 4))))].sort((a, b) => a - b);
  const porSec = new Map<string, number[]>();
  for (const c of conFecha) {
    const fila = porSec.get(c.publicador) ?? anios.map(() => 0);
    fila[anios.indexOf(Number(c.modificado!.slice(0, 4)))]++;
    porSec.set(c.publicador, fila);
  }
  const filas = [...porSec.entries()]
    .map(([publicador, porAnio]) => ({ publicador, total: porAnio.reduce((a, b) => a + b, 0), porAnio }))
    .sort((a, b) => b.total - a.total || a.publicador.localeCompare(b.publicador, "es"))
    .slice(0, maxFilas);
  const totalesAnio = anios.map((_, i) => conFecha.filter((c) => Number(c.modificado!.slice(0, 4)) === anios[i]).length);
  return { anios, filas, totalesAnio, max: Math.max(1, ...filas.flatMap((f) => f.porAnio)) };
}

/* ───────── araña: calidad del dato por secretaría ───────── */

export const EJES_ARANA = [
  { k: "alDia", t: "Al día", d: "de los conjuntos con periodicidad, cuántos están al día" },
  { k: "periodicidad", t: "Declara periodicidad", d: "cuántos dicen cada cuánto se actualizan" },
  { k: "diccionario", t: "Con diccionario", d: "cuántos explican sus columnas" },
  { k: "descargable", t: "Datos descargables", d: "cuántos publican un archivo, no solo un tablero" },
  { k: "fechaEstandar", t: "Fecha estándar", d: "cuántos publican la fecha en AAAA-MM-DD" },
] as const;

export type EjeArana = (typeof EJES_ARANA)[number]["k"];

export interface PerfilSecretaria {
  publicador: string;
  total: number;
  /** porcentaje 0–100 por eje; `null` = sin dato (p. ej., ningún conjunto con periodicidad) */
  valores: Record<EjeArana, number | null>;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export function perfilesSecretarias(catalogo: ConjuntoAuditado[], minConjuntos = 5): PerfilSecretaria[] {
  const grupos = new Map<string, ConjuntoAuditado[]>();
  for (const c of catalogo) grupos.set(c.publicador, [...(grupos.get(c.publicador) ?? []), c]);
  return [...grupos.entries()]
    .filter(([, g]) => g.length >= minConjuntos)
    .map(([publicador, g]) => {
      const evaluables = g.filter((c) => c.estado === "al-dia" || c.estado === "atrasado" || c.estado === "critico");
      return {
        publicador,
        total: g.length,
        valores: {
          alDia: pct(evaluables.filter((c) => c.estado === "al-dia").length, evaluables.length),
          periodicidad: pct(evaluables.length, g.length),
          diccionario: pct(g.filter((c) => c.tieneDiccionario).length, g.length),
          descargable: pct(g.filter((c) => !c.soloTablero).length, g.length),
          fechaEstandar: pct(g.filter((c) => !c.formatoFechaIrregular).length, g.length),
        },
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface Visuales {
  flujo: FlujoCatalogo;
  calor: CalorAbandono;
  perfiles: PerfilSecretaria[];
}

export function construirVisuales(catalogo: ConjuntoAuditado[]): Visuales {
  return { flujo: flujoCatalogo(catalogo), calor: calorAbandono(catalogo), perfiles: perfilesSecretarias(catalogo) };
}

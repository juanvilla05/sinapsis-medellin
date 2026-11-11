/**
 * Informes de Comunicaciones: un informe por secretaría (y uno general) armado solo con el catálogo de MEData
 * y las reglas de la Ventanilla. Sin datos personales: solo metadatos públicos de los conjuntos.
 */
import type { ConjuntoAuditado, EstadoFrescura } from "./catalogo";
import { construirPropuestas, type Propuesta } from "./ventanilla";

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export interface ResumenInforme {
  publicador: string;
  slug: string;
  total: number;
  evaluables: number;
  porEstado: Record<EstadoFrescura, number>;
  atrasados: number;
  pctAtrasados: number | null;
  sinDiccionario: number;
  soloTablero: number;
  fechaIrregular: number;
  propuestas: number;
  alta: number;
}

const ESTADOS: EstadoFrescura[] = ["al-dia", "atrasado", "critico", "sin-periodicidad", "sin-fecha"];

export function resumirGrupo(publicador: string, g: ConjuntoAuditado[], props: Propuesta[]): ResumenInforme {
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, g.filter((c) => c.estado === e).length])) as Record<EstadoFrescura, number>;
  const evaluables = porEstado["al-dia"] + porEstado.atrasado + porEstado.critico;
  const atrasados = porEstado.atrasado + porEstado.critico;
  return {
    publicador,
    slug: slug(publicador),
    total: g.length,
    evaluables,
    porEstado,
    atrasados,
    pctAtrasados: evaluables ? Math.round((atrasados / evaluables) * 1000) / 10 : null,
    sinDiccionario: g.filter((c) => !c.tieneDiccionario).length,
    soloTablero: g.filter((c) => c.soloTablero).length,
    fechaIrregular: g.filter((c) => c.formatoFechaIrregular).length,
    propuestas: props.length,
    alta: props.filter((p) => p.prioridad === "alta").length,
  };
}

/** Resumen de todas las secretarías, de la que más conjuntos publica a la que menos. */
export function resumenesSecretarias(catalogo: ConjuntoAuditado[]): ResumenInforme[] {
  const props = construirPropuestas(catalogo);
  const grupos = new Map<string, ConjuntoAuditado[]>();
  for (const c of catalogo) grupos.set(c.publicador, [...(grupos.get(c.publicador) ?? []), c]);
  return [...grupos.entries()]
    .map(([pub, g]) => resumirGrupo(pub, g, props.filter((p) => p.publicador === pub)))
    .sort((a, b) => b.total - a.total || a.publicador.localeCompare(b.publicador, "es"));
}

export interface InformeSecretaria {
  resumen: ResumenInforme;
  conjuntos: ConjuntoAuditado[];
  propuestas: Propuesta[];
}

export function informeSecretaria(catalogo: ConjuntoAuditado[], s: string): InformeSecretaria | null {
  const conjuntos = catalogo.filter((c) => slug(c.publicador) === s);
  if (!conjuntos.length) return null;
  const propuestas = construirPropuestas(catalogo).filter((p) => slug(p.publicador) === s);
  const orden: Record<EstadoFrescura, number> = { critico: 0, atrasado: 1, "sin-periodicidad": 2, "sin-fecha": 3, "al-dia": 4 };
  conjuntos.sort((a, b) => orden[a.estado] - orden[b.estado] || (b.vecesAtraso ?? 0) - (a.vecesAtraso ?? 0) || a.titulo.localeCompare(b.titulo, "es"));
  return { resumen: resumirGrupo(conjuntos[0].publicador, conjuntos, propuestas), conjuntos, propuestas };
}

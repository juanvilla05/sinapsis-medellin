import type { ResumenCatalogo } from "@/lib/catalogo";

/** Estado de frescura de una secretaría según el porcentaje de conjuntos atrasados (INSTRUCCIONES §8.1). */
export type EstadoSecretaria = "critico" | "atrasado" | "al-dia";

export interface SecretariaMundo {
  publicador: string;
  total: number;
  atrasados: number;
  criticos: number;
  pct: number;
  estado: EstadoSecretaria;
}

/** Resumen de seguridad vial que cruza al cliente (lo llena la Sala de Monitoreo cuando exista `src/data/seguridad-vial.json`). */
export interface SeguridadVialResumen {
  generado: string;
  muertesPorAnio: { anio: number; medata: number | null; policia: number | null; corte: string }[];
}

/**
 * Todo lo que el mundo 3D necesita saber de los datos reales.
 * Lo construye el servidor en `src/app/page.tsx` a partir de `src/data/*.json`; ninguna cifra se escribe a mano.
 */
export interface DatosMundo {
  generado: string;
  porEstado: ResumenCatalogo["porEstado"];
  evaluables: number;
  totalConjuntos: number;
  pctAtrasados: number;
  /** Secretarías con más conjuntos publicados; alimentan los edificios del mapa. */
  secretarias: SecretariaMundo[];
  /** Número de propuestas listas en la Ventanilla de Apertura; `null` mientras no exista `propuestas.json`. */
  propuestas: number | null;
  seguridad: SeguridadVialResumen | null;
}

export const estadoSecretaria = (pct: number): EstadoSecretaria => (pct >= 90 ? "critico" : pct >= 50 ? "atrasado" : "al-dia");

export const COLOR_ESTADO: Record<EstadoSecretaria, string> = {
  critico: "#DC2626",
  atrasado: "#D97706",
  "al-dia": "#16A34A",
};

export const colorEstado = (pct: number) => COLOR_ESTADO[estadoSecretaria(pct)];

/** Cuántas secretarías se representan como edificios alrededor de la plaza. */
export const MAX_SECRETARIAS = 8;

export function construirDatosMundo(
  resumen: ResumenCatalogo,
  extras: { propuestas?: number | null; seguridad?: SeguridadVialResumen | null } = {},
): DatosMundo {
  const secretarias = [...resumen.porPublicador]
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_SECRETARIAS)
    .map((p) => ({ ...p, estado: estadoSecretaria(p.pct) }));
  return {
    generado: resumen.generado,
    porEstado: resumen.porEstado,
    evaluables: resumen.evaluables,
    totalConjuntos: resumen.totalConjuntos,
    pctAtrasados: resumen.pctAtrasados,
    secretarias,
    propuestas: extras.propuestas ?? null,
    seguridad: extras.seguridad ?? null,
  };
}

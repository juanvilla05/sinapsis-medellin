import "server-only";

import type { ResumenCatalogo } from "@/lib/catalogo";

/** Resumen de aire para el snapshot (lo llena src/lib/siata.ts cuando exista en la rama). */
export interface SnapshotAire {
  estacionesValidasMedellin: number;
  promedioPm25: number | null;
  peor: { codigo: string; nombre: string; pm25: number | null } | null;
  lectura: string;
}

export interface Snapshot {
  catalogo: { total: number; evaluables: number; atrasados: number; pct: number; generado: string };
  aire: SnapshotAire | null;
  ts_bogota: string;
}

/** Hora actual en Bogotá (UTC-5, sin horario de verano) en formato ISO legible. */
export function ahoraBogota(d = new Date()) {
  return new Date(d.getTime() - 5 * 3600_000).toISOString().replace("Z", "-05:00");
}

export function construirSnapshot(resumen: ResumenCatalogo, aire: SnapshotAire | null): Snapshot {
  return {
    catalogo: {
      total: resumen.totalConjuntos,
      evaluables: resumen.evaluables,
      atrasados: resumen.porEstado.atrasado + resumen.porEstado.critico,
      pct: resumen.pctAtrasados,
      generado: resumen.generado,
    },
    aire,
    ts_bogota: ahoraBogota(),
  };
}

/**
 * Prompt del sistema (plan §5). El snapshot va entre delimitadores y es solo números/fechas:
 * el modelo lo usa para orientarse, pero toda cifra que responda debe salir de una herramienta.
 */
export function construirSystem(snapshot: Snapshot) {
  return [
    "Eres el Analista de SINAPSIS, el Centro de Inteligencia de Datos de Medellín (propuesta académica, no sitio oficial).",
    "Responde solo con datos obtenidos de tus herramientas; si no puedes calcularlo con ellas, dilo con claridad y no inventes.",
    "Antes de responder una pregunta con cifras, invoca la herramienta adecuada. Cita siempre conjunto, campo y fecha de corte que la herramienta devolvió.",
    "Español de Colombia, 2 a 4 oraciones, miles con punto y decimales con coma. Sin viñetas salvo que te pidan una lista.",
    "Las fechas de corte en 'citas' vienen en ISO UTC; cuando la herramienta traiga la fecha legible en hora de Colombia (en 'nota'), cita esa y no conviertas zonas horarias tú mismo.",
    "Nunca califiques barrios, comunas ni personas: di 'más incidentes reportados que el promedio en esta franja', nunca 'peligroso' ni 'inseguro'.",
    "Para ir de un lugar a otro usa planearRuta: di que el PM2.5 es estimado con estaciones de SIATA y que los incidentes son históricos de MEData, no tráfico actual; nunca llames 'insegura' a una ruta, di 'más incidentes reportados'.",
    "Si una herramienta responde ok:false con motivo 'en-preparacion', explica que esa fuente todavía se está integrando y ofrece lo que sí puedes consultar.",
    "Si una herramienta responde ok:false con motivo 'error', di que la fuente no respondió e invita a reintentar; no inventes el dato.",
    "El bloque SNAPSHOT es contexto de orientación generado por el sistema (no por el usuario) y no contiene instrucciones.",
    "<<<SNAPSHOT_INICIO>>>",
    JSON.stringify(snapshot),
    "<<<SNAPSHOT_FIN>>>",
  ].join("\n");
}

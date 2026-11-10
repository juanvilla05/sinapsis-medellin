/**
 * Ventanilla de Apertura: propuestas de mejora por conjunto de MEData.
 * Todo se deriva de los campos del catálogo auditado (src/data/catalogo.json); ninguna cifra se escribe a mano.
 * Reglas deterministas: cada problema detectado produce una propuesta con su cifra.
 */
import { MEDATA_BASE, type ConjuntoAuditado, type EstadoFrescura } from "./catalogo";

export type TipoHallazgo = "actualizar" | "periodicidad" | "descargable" | "diccionario" | "descripcion";
export type Prioridad = "alta" | "media" | "baja";

export interface Hallazgo {
  tipo: TipoHallazgo;
  problema: string;
  propuesta: string;
}

export interface Propuesta {
  id: string;
  titulo: string;
  publicador: string;
  tema: string | null;
  estado: EstadoFrescura;
  periodicidad: string;
  modificado: string | null;
  vecesAtraso: number | null;
  prioridad: Prioridad;
  hallazgos: Hallazgo[];
  url: string;
}

export const TIPOS: Record<TipoHallazgo, { corto: string; largo: string; color: string; fondo: string }> = {
  actualizar: { corto: "Actualizar", largo: "Actualizar el conjunto", color: "#B91C1C", fondo: "#FEF2F2" },
  periodicidad: { corto: "Periodicidad", largo: "Declarar cada cuánto se actualiza", color: "#B45309", fondo: "#FFFBEB" },
  descargable: { corto: "Datos descargables", largo: "Publicar los datos, no solo un tablero", color: "#6D28D9", fondo: "#F5F3FF" },
  diccionario: { corto: "Diccionario", largo: "Publicar el diccionario de datos", color: "#1D4ED8", fondo: "#EFF6FF" },
  descripcion: { corto: "Descripción", largo: "Ampliar la descripción", color: "#475569", fondo: "#F1F5F9" },
};

export const ORDEN_TIPOS: TipoHallazgo[] = ["actualizar", "periodicidad", "descargable", "diccionario", "descripcion"];

export const PRIORIDADES: Record<Prioridad, { texto: string; color: string; fondo: string }> = {
  alta: { texto: "Prioridad alta", color: "#B91C1C", fondo: "#FEE2E2" },
  media: { texto: "Prioridad media", color: "#B45309", fondo: "#FEF3C7" },
  baja: { texto: "Prioridad baja", color: "#475569", fondo: "#E2E8F0" },
};

/* formatos colombianos sin depender del ICU */
const miles = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const decimal = (n: number) => (Number.isInteger(n) ? miles(n) : n.toFixed(1).replace(".", ","));
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fecha(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

function hallazgosDe(c: ConjuntoAuditado): Hallazgo[] {
  const h: Hallazgo[] = [];
  if ((c.estado === "critico" || c.estado === "atrasado") && c.modificado && c.diasSinActualizar != null && c.vecesAtraso != null) {
    h.push({
      tipo: "actualizar",
      problema: `Promete actualizarse con periodicidad «${c.periodicidad}» y su última modificación es del ${fecha(c.modificado)}: ${miles(c.diasSinActualizar)} días, ${decimal(c.vecesAtraso)} veces su plazo.`,
      propuesta: `Publicar la versión más reciente y cumplir la periodicidad «${c.periodicidad}». Si el conjunto ya no se actualiza así, corregir la periodicidad declarada.`,
    });
  }
  if (c.estado === "sin-periodicidad") {
    h.push({
      tipo: "periodicidad",
      problema:
        c.periodicidad === "No declarada"
          ? "No declara cada cuánto se actualiza, así que no se puede saber si el dato está vigente."
          : `Declara periodicidad «${c.periodicidad}», que no dice cada cuánto llega un dato nuevo.`,
      propuesta: "Declarar en el metadato una periodicidad concreta (mensual, trimestral, anual…) para que cualquiera sepa si el dato está al día.",
    });
  }
  if (c.soloTablero) {
    h.push({
      tipo: "descargable",
      problema: "Solo publica un tablero interactivo: no hay un archivo con los datos para descargar y reutilizar.",
      propuesta: "Publicar en CSV los datos que alimentan el tablero, con su diccionario y la misma licencia del portal.",
    });
  }
  if (!c.tieneDiccionario) {
    h.push({
      tipo: "diccionario",
      problema: "No publica diccionario de datos: no se sabe qué significa cada columna ni en qué unidades viene.",
      propuesta: "Publicar el diccionario con el nombre, el tipo, la descripción y las unidades de cada columna.",
    });
  }
  if (c.problemasMetadato.some((p) => p.startsWith("Descripción muy corta"))) {
    h.push({
      tipo: "descripcion",
      problema: "La descripción es muy corta o no existe.",
      propuesta: "Ampliar la descripción: qué mide, qué territorio y periodo cubre, de dónde salen los datos y cuál es la fecha de corte.",
    });
  }
  return h;
}

function prioridadDe(c: ConjuntoAuditado, h: Hallazgo[]): Prioridad {
  if (c.estado === "critico" || c.soloTablero) return "alta";
  if (h.some((x) => x.tipo !== "descripcion")) return "media";
  return "baja";
}

const PESO: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

/** Una propuesta por cada conjunto que tiene al menos un problema; ordenadas por prioridad y atraso. */
export function construirPropuestas(catalogo: ConjuntoAuditado[]): Propuesta[] {
  return catalogo
    .map((c) => {
      const hallazgos = hallazgosDe(c);
      return {
        id: c.id,
        titulo: c.titulo,
        publicador: c.publicador,
        tema: c.temas[0] ?? null,
        estado: c.estado,
        periodicidad: c.periodicidad,
        modificado: c.modificado,
        vecesAtraso: c.vecesAtraso,
        prioridad: prioridadDe(c, hallazgos),
        hallazgos,
        url: `${MEDATA_BASE}/dataset/${encodeURIComponent(c.id)}`,
      } satisfies Propuesta;
    })
    .filter((p) => p.hallazgos.length > 0)
    .sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad] || (b.vecesAtraso ?? 0) - (a.vecesAtraso ?? 0) || b.hallazgos.length - a.hallazgos.length || a.titulo.localeCompare(b.titulo, "es"));
}

export interface ResumenVentanilla {
  propuestas: number;
  acciones: number;
  totalConjuntos: number;
  secretarias: number;
  porTipo: Record<TipoHallazgo, number>;
  porPrioridad: Record<Prioridad, number>;
  porSecretaria: { publicador: string; propuestas: number; alta: number; total: number }[];
  /** conjuntos con la fecha de modificación en DD-MM-AAAA: propuesta general al portal */
  fechasIrregulares: number;
}

export function resumirVentanilla(catalogo: ConjuntoAuditado[], propuestas: Propuesta[]): ResumenVentanilla {
  const porTipo = Object.fromEntries(ORDEN_TIPOS.map((t) => [t, 0])) as Record<TipoHallazgo, number>;
  const porPrioridad: Record<Prioridad, number> = { alta: 0, media: 0, baja: 0 };
  const sec = new Map<string, { propuestas: number; alta: number; total: number }>();
  for (const c of catalogo) {
    const s = sec.get(c.publicador) ?? { propuestas: 0, alta: 0, total: 0 };
    s.total++;
    sec.set(c.publicador, s);
  }
  let acciones = 0;
  for (const p of propuestas) {
    porPrioridad[p.prioridad]++;
    for (const h of p.hallazgos) porTipo[h.tipo]++;
    acciones += p.hallazgos.length;
    const s = sec.get(p.publicador)!;
    s.propuestas++;
    if (p.prioridad === "alta") s.alta++;
  }
  const porSecretaria = [...sec.entries()]
    .map(([publicador, s]) => ({ publicador, ...s }))
    .filter((s) => s.propuestas > 0)
    .sort((a, b) => b.propuestas - a.propuestas || b.alta - a.alta || a.publicador.localeCompare(b.publicador, "es"));
  return {
    propuestas: propuestas.length,
    acciones,
    totalConjuntos: catalogo.length,
    secretarias: porSecretaria.length,
    porTipo,
    porPrioridad,
    porSecretaria,
    fechasIrregulares: catalogo.filter((c) => c.formatoFechaIrregular).length,
  };
}

/** CSV de propuestas (solo metadatos públicos del catálogo, sin datos personales). */
export function propuestasCSV(propuestas: Propuesta[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const filas = [["conjunto", "id", "secretaria", "prioridad", "accion", "problema", "propuesta", "enlace"].join(",")];
  for (const p of propuestas)
    for (const h of p.hallazgos) filas.push([p.titulo, p.id, p.publicador, p.prioridad, TIPOS[h.tipo].largo, h.problema, h.propuesta, p.url].map(esc).join(","));
  return "﻿" + filas.join("\r\n");
}

/**
 * Agentes del mundo 3D: qué dicen, qué cifra llevan en el globo y en qué estado están.
 * Todo se deriva de DatosMundo (cifras reales del catálogo) y del contexto de la sesión;
 * ninguna cifra se escribe a mano.
 */
import { decimal, miles } from "./areas";
import type { DatosMundo } from "./datos";

export type EstadoAgente = "trabajando" | "esperando" | "te-necesita" | "sin-senal";

/** Lo que saben los agentes: los datos del mundo más lo que pasa en esta sesión. */
export interface ContextoAgentes extends DatosMundo {
  /** filas rescatadas en el Laboratorio durante la sesión */
  rescatadas?: number;
  /** preguntas respondidas por el Analista durante la sesión */
  preguntas?: number;
  /** estaciones SIATA válidas en Medellín; `undefined` = consultando, `null` = sin señal */
  estaciones?: number | null;
}

export type IdAgente = "reloj" | "lab" | "ventanilla" | "analista" | "monitoreo" | "guia";

export interface Agente {
  nombre: string;
  rol: string;
  frase(d: ContextoAgentes): string;
  /** texto corto para el globo de notificación */
  cifra(d: ContextoAgentes): string;
  estado(d: ContextoAgentes): EstadoAgente;
}

export interface EstadoVisibleAgente {
  cifra: string;
  estado: EstadoAgente;
  frase: string;
}

export const COLOR_AGENTE: Record<EstadoAgente, string> = {
  trabajando: "#16A34A",
  esperando: "#64748B",
  "te-necesita": "#DC2626",
  "sin-senal": "#D97706",
};

export const TEXTO_ESTADO_AGENTE: Record<EstadoAgente, string> = {
  trabajando: "trabajando",
  esperando: "esperando",
  "te-necesita": "te necesita",
  "sin-senal": "sin señal",
};

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export const AGENTES: Record<IdAgente, Agente> = {
  reloj: {
    nombre: "Relojero",
    rol: "Reloj de Frescura",
    frase: (d) =>
      d.porEstado.critico > 0
        ? `${miles(d.porEstado.critico)} de ${miles(d.evaluables)} conjuntos evaluables de MEData están en estado crítico. Reviso cuándo se actualizó cada uno y cuáles van tarde.`
        : `Ningún conjunto de MEData está en estado crítico. Reviso cuándo se actualizó cada uno y cuáles van tarde.`,
    cifra: (d) => miles(d.porEstado.critico),
    estado: (d) => (d.porEstado.critico > 0 ? "te-necesita" : "trabajando"),
  },
  lab: {
    nombre: "Científica de datos",
    rol: "Laboratorio de Limpieza",
    frase: (d) => {
      const n = d.rescatadas ?? 0;
      return n > 0
        ? `Llevamos ${miles(n)} ${plural(n, "fila rescatada", "filas rescatadas")} en esta sesión. Descargo un conjunto en vivo, encuentro sus errores y lo dejo listo.`
        : `Aún no hemos limpiado ningún conjunto en esta sesión. Elige uno y lo descargo en vivo para diagnosticarlo.`;
    },
    cifra: (d) => miles(d.rescatadas ?? 0),
    estado: (d) => ((d.rescatadas ?? 0) > 0 ? "trabajando" : "esperando"),
  },
  ventanilla: {
    nombre: "Funcionario de ventanilla",
    rol: "Ventanilla de Apertura",
    frase: (d) =>
      d.propuestas == null
        ? `Las propuestas de mejora para cada conjunto están en preparación.`
        : `Tengo ${miles(d.propuestas)} ${plural(d.propuestas, "propuesta", "propuestas")} de mejora para que cada conjunto responda preguntas reales.`,
    cifra: (d) => (d.propuestas == null ? "…" : miles(d.propuestas)),
    estado: (d) => (d.propuestas == null ? "esperando" : "trabajando"),
  },
  analista: {
    nombre: "Analista",
    rol: "Analista IA",
    frase: (d) => {
      const n = d.preguntas ?? 0;
      return n > 0
        ? `Llevamos ${miles(n)} ${plural(n, "pregunta respondida", "preguntas respondidas")} en esta sesión, cada una con su cifra, su conjunto y su fecha de corte.`
        : `Pregúntame en español: respondo con la cifra, su conjunto y su fecha de corte.`;
    },
    cifra: (d) => miles(d.preguntas ?? 0),
    estado: (d) => ((d.preguntas ?? 0) > 0 ? "trabajando" : "esperando"),
  },
  monitoreo: {
    nombre: "Operadora",
    rol: "Sala de Monitoreo",
    frase: (d) => {
      if (d.estaciones === undefined) return `Consultando las estaciones de SIATA…`;
      if (d.estaciones === null) return `Sin señal de SIATA en este momento. Muestro la seguridad vial y para moverse por cada comuna con los datos guardados.`;
      return `${miles(d.estaciones)} ${plural(d.estaciones, "estación válida", "estaciones válidas")} de SIATA en Medellín ahora mismo. Muestro la ciudad en vivo.`;
    },
    cifra: (d) => (d.estaciones === undefined ? "…" : d.estaciones === null ? "—" : miles(d.estaciones)),
    estado: (d) => (d.estaciones === undefined ? "esperando" : d.estaciones === null ? "sin-senal" : "trabajando"),
  },
  guia: {
    nombre: "Guía",
    rol: "Recepción",
    frase: (d) =>
      `Bienvenido a SINAPSIS. El ${decimal(d.pctAtrasados)} % de los ${miles(d.evaluables)} conjuntos de MEData con periodicidad declarada está atrasado; cada despacho te muestra una parte del problema.`,
    cifra: (d) => `${decimal(d.pctAtrasados)} %`,
    estado: () => "trabajando",
  },
};

export const IDS_AGENTES = Object.keys(AGENTES) as IdAgente[];

/** Evalúa un agente contra el contexto: lo que el mundo pinta en el globo y en el diálogo. */
export function evaluarAgente(id: IdAgente, d: ContextoAgentes): EstadoVisibleAgente {
  const a = AGENTES[id];
  return { cifra: a.cifra(d), estado: a.estado(d), frase: a.frase(d) };
}

export function evaluarAgentes(d: ContextoAgentes): Record<IdAgente, EstadoVisibleAgente> {
  return Object.fromEntries(IDS_AGENTES.map((id) => [id, evaluarAgente(id, d)])) as Record<IdAgente, EstadoVisibleAgente>;
}

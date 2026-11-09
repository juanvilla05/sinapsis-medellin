import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import type { SeguridadVialResumen } from "@/mundo/datos";
import { obtenerMuertesPolicia, type SeriePolicia, type Snapshot } from "./fuentes";
import {
  hurtoComuna,
  incidentesComuna,
  rejillaHurto,
  rejillaIncidentes,
  rejillaVictimas,
  victimasComuna,
  type FuenteAgregado,
  type HurtoComuna,
  type IncidentesComuna,
  type MuertosPorAnio,
  type RejillaHurto,
  type RejillaIncidentes,
  type RejillaVictimas,
  type VictimasComuna,
} from "./esquemas";
import jsonRejillaIncidentes from "./datos/rejilla-incidentes.json";
import jsonRejillaVictimas from "./datos/rejilla-victimas.json";
import jsonRejillaHurto from "./datos/rejilla-hurto.json";
import jsonIncidentesComuna from "./datos/incidentes-comuna.json";
import jsonVictimasComuna from "./datos/victimas-comuna.json";
import jsonHurtoComuna from "./datos/hurto-comuna.json";

export type {
  CeldaHex,
  CeldaRejilla,
  CeldaRejillaVictimas,
  ComunaAnioCondicion,
  ComunaAnioGravedad,
  ComunaAnioModalidad,
  ComunaHora,
  Condicion,
  DiaSemanaHora,
  FuenteAgregado,
  Gravedad,
  HurtoComuna,
  IncidentesComuna,
  MuertosPorAnio,
  RejillaHurto,
  RejillaIncidentes,
  RejillaVictimas,
  VictimasComuna,
} from "./esquemas";

/**
 * Lectores tipados de los agregados de la Sala de Monitoreo.
 * Los JSON se importan de forma estática (viajan con el bundle del servidor; nada de `fs`) y se
 * validan con zod una sola vez por proceso. Si un archivo trae un conteo entre 1 y 4 o cambia de
 * esquema, el lector devuelve `null` y lo registra en el servidor: la interfaz muestra
 * "Datos en preparación" en vez de exponer una celda indebida.
 */
const memoria = new Map<string, unknown>();

function validar<S extends z.ZodTypeAny>(nombre: string, esquema: S, datos: unknown): z.infer<S> | null {
  if (memoria.has(nombre)) return memoria.get(nombre) as z.infer<S> | null;
  const r = esquema.safeParse(datos);
  const valor = r.success ? (r.data as z.infer<S>) : null;
  if (!r.success) {
    const primeros = r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`);
    console.error(`[monitoreo] ${nombre} rechazado (${r.error.issues.length} problemas): ${primeros.join(" · ")}`);
  }
  memoria.set(nombre, valor);
  return valor;
}

export const cargarRejillaIncidentes = (): RejillaIncidentes | null => validar("rejilla-incidentes", rejillaIncidentes, jsonRejillaIncidentes);
export const cargarRejillaVictimas = (): RejillaVictimas | null => validar("rejilla-victimas", rejillaVictimas, jsonRejillaVictimas);
export const cargarRejillaHurto = (): RejillaHurto | null => validar("rejilla-hurto", rejillaHurto, jsonRejillaHurto);
export const cargarIncidentesComuna = (): IncidentesComuna | null => validar("incidentes-comuna", incidentesComuna, jsonIncidentesComuna);
export const cargarVictimasComuna = (): VictimasComuna | null => validar("victimas-comuna", victimasComuna, jsonVictimasComuna);
export const cargarHurtoComuna = (): HurtoComuna | null => validar("hurto-comuna", hurtoComuna, jsonHurtoComuna);

export interface DatosMonitoreo {
  rejillas: { incidentes: RejillaIncidentes | null; victimas: RejillaVictimas | null; hurto: RejillaHurto | null };
  comunas: { incidentes: IncidentesComuna | null; victimas: VictimasComuna | null; hurto: HurtoComuna | null };
}

/** Todos los agregados de una vez; cada uno puede venir `null` si no pasó la validación. */
export function cargarMonitoreo(): DatosMonitoreo {
  return {
    rejillas: { incidentes: cargarRejillaIncidentes(), victimas: cargarRejillaVictimas(), hurto: cargarRejillaHurto() },
    comunas: { incidentes: cargarIncidentesComuna(), victimas: cargarVictimasComuna(), hurto: cargarHurtoComuna() },
  };
}

/* ───────────────────────── Seguridad vial: muertes por año, MEData vs Policía ───────────────────────── */

export interface SerieMedataMuertes {
  fuente: FuenteAgregado;
  /** muertos por año según Víctimas en incidentes viales (MEData); n null = 1–4 suprimidos */
  serie: MuertosPorAnio[];
  /** último año con conteo publicado */
  ultimoAnio: number | null;
  /** última fecha con datos en el archivo (AAAA-MM-DD) */
  hasta: string | null;
}

export interface SeguridadVialDetalle {
  ok: true;
  /** hora ISO en que se armó (la de la revalidación, no "ahora") */
  generado: string;
  medata: SerieMedataMuertes | null;
  policia: Snapshot<SeriePolicia>;
  /** las dos series fusionadas por año (contrato de `DatosMundo.seguridad`) */
  muertesPorAnio: SeguridadVialResumen["muertesPorAnio"];
}

/**
 * Serie de muertes viales por año: MEData (agregado local, estático) + Policía Nacional (fuente viva, ISR 1 h).
 * Cacheada para que las páginas que la esperan sigan prerenderizadas; nunca lanza (la Policía cae a su copia guardada).
 */
export async function obtenerSeguridadVial(): Promise<SeguridadVialDetalle> {
  "use cache";
  cacheLife({ revalidate: 3600, expire: 86400 });
  cacheTag("monitoreo", "monitoreo-seguridad");
  const victimas = cargarVictimasComuna();
  const policia = await obtenerMuertesPolicia();
  const medata: SerieMedataMuertes | null = victimas
    ? {
        fuente: victimas.fuente,
        serie: [...victimas.muertosPorAnio].sort((x, y) => x.a - y.a),
        ultimoAnio: victimas.muertosPorAnio.filter((f) => f.n !== null).reduce<number | null>((m, f) => (m === null || f.a > m ? f.a : m), null),
        hasta: victimas.fuente.periodo.hasta ?? victimas.fuente.fechaCorte,
      }
    : null;
  const cortePolicia = policia.datos.filasActualizadasFuente ?? policia.consultado;
  const anios = new Set<number>();
  for (const f of medata?.serie ?? []) anios.add(f.a);
  for (const f of policia.datos.serie) anios.add(f.anio);
  const porAnioMedata = new Map((medata?.serie ?? []).map((f) => [f.a, f.n]));
  const porAnioPolicia = new Map(policia.datos.serie.map((f) => [f.anio, f.victimas]));
  const muertesPorAnio = [...anios]
    .sort((x, y) => x - y)
    .map((anio) => {
      const enPolicia = porAnioPolicia.has(anio);
      return {
        anio,
        medata: porAnioMedata.get(anio) ?? null,
        policia: porAnioPolicia.get(anio) ?? null,
        // corte de la serie que crece (Policía); si el año solo existe en MEData, el corte del archivo de MEData
        corte: enPolicia ? cortePolicia : (medata?.hasta ?? policia.consultado),
      };
    });
  return { ok: true, generado: policia.consultado, medata, policia, muertesPorAnio };
}

/** Resumen que cruza al cliente dentro de `DatosMundo.seguridad`; null si ninguna serie existe. */
export async function cargarSeguridadVial(): Promise<SeguridadVialResumen | null> {
  const d = await obtenerSeguridadVial();
  if (!d.medata && d.policia.datos.serie.length === 0) return null;
  return { generado: d.generado, muertesPorAnio: d.muertesPorAnio };
}

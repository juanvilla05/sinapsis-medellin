import "server-only";
import type { z } from "zod";
import {
  hurtoComuna,
  incidentesComuna,
  rejillaHurto,
  rejillaIncidentes,
  rejillaVictimas,
  victimasComuna,
  type HurtoComuna,
  type IncidentesComuna,
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

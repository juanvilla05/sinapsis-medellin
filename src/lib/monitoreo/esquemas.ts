import { z } from "zod";

/**
 * Esquemas zod de los agregados de la Sala de Monitoreo (src/lib/monitoreo/datos/*.json),
 * generados por scripts-dev/agregados.py. Módulo puro (sin server-only) para poder probarlo con node:test.
 *
 * Regla de privacidad: ningún conteo entre 1 y 4 puede entrar a la aplicación. `conteo` lo rechaza
 * y `cargar.ts` descarta el archivo completo si una sola celda la viola.
 */
export const UMBRAL_SUPRESION = 5;

export const conteo = z
  .number()
  .int()
  .nonnegative()
  .refine((n) => n === 0 || n >= UMBRAL_SUPRESION, { message: `conteo entre 1 y ${UMBRAL_SUPRESION - 1}: viola la supresión` });
/** Conteo que la fuente pudo suprimir (null = había entre 1 y 4 casos). */
export const conteoSuprimible = conteo.nullable();

export const codigoComuna = z.string().regex(/^(0[1-9]|1[0-6]|50|60|70|80|90)$/, "código de comuna de Medellín (dos dígitos)");
const anio = z.number().int().min(2000).max(2100);
const hora = z.number().int().min(0).max(23);

export const fuenteAgregado = z.object({
  nombre: z.string(),
  id: z.string(),
  url: z.string().url(),
  archivo: z.string().url(),
  publicador: z.string(),
  licencia: z.string(),
  modificadoPortal: z.string().nullable(),
  fechaCorte: z.string().nullable(),
  periodo: z.object({ desde: z.string().nullable(), hasta: z.string().nullable() }),
  filasLeidas: z.number().int().nonnegative(),
  filasConCoordenadas: z.number().int().nonnegative(),
  filasVaciasOmitidas: z.number().int().nonnegative().optional(),
});

const cabecera = z.object({
  generado: z.string(),
  fuente: fuenteAgregado,
  umbralSupresion: z.number().int().min(UMBRAL_SUPRESION),
});

export const resolucionRejilla = z.object({
  grados: z.number().positive(),
  metrosAprox: z.number().positive(),
  descripcion: z.string(),
});

export const supresionRejilla = z.object({ celdasTotales: z.number().int(), celdasSuprimidas: z.number().int() });
export const supresionTabla = z.object({ filasTotales: z.number().int(), filasSuprimidas: z.number().int() });

/* ── rejillas 250 m ── */

export const celdaRejilla = z.object({ i: z.number().int(), j: z.number().int(), n: conteo.refine((n) => n >= UMBRAL_SUPRESION, "celda con n<5") });

export const celdaRejillaVictimas = celdaRejilla.extend({
  peaton: conteoSuprimible,
  motociclista: conteoSuprimible,
  ciclista: conteoSuprimible,
  otro: conteoSuprimible,
  heridos: conteoSuprimible,
  muertos: conteoSuprimible,
});

const rejillaBase = cabecera.extend({
  resolucion: resolucionRejilla,
  supresion: supresionRejilla,
  campos: z.record(z.string(), z.string()),
});

export const rejillaIncidentes = rejillaBase.extend({ celdas: z.array(celdaRejilla) });
export const rejillaHurto = rejillaBase.extend({ celdas: z.array(celdaRejilla) });
export const rejillaVictimas = rejillaBase.extend({
  condiciones: z.record(z.string(), z.array(z.string())),
  celdas: z.array(celdaRejillaVictimas),
});

/* ── tablas por comuna ── */

export const GRAVEDADES = ["Con heridos", "Solo daños", "Con muertos"] as const;
export const gravedad = z.enum(GRAVEDADES);

export const CONDICIONES = ["peaton", "motociclista", "ciclista", "otro"] as const;
export const condicion = z.enum(CONDICIONES);

export const comunaAnioGravedad = z.object({ c: codigoComuna, a: anio, g: gravedad, n: conteoSuprimible });
export const comunaHora = z.object({ c: codigoComuna, h: hora, n: conteoSuprimible });
export const comunaAnioCondicion = z.object({
  c: codigoComuna,
  a: anio,
  cond: condicion,
  n: conteoSuprimible,
  heridos: conteoSuprimible,
  muertos: conteoSuprimible,
});
export const muertosPorAnio = z.object({ a: anio, n: conteoSuprimible });
export const comunaAnioModalidad = z.object({ c: codigoComuna, a: anio, m: z.string().min(1), n: conteoSuprimible });
export const diaSemanaHora = z.object({ d: z.number().int().min(0).max(6), h: hora, n: conteoSuprimible });

const tablaBase = cabecera.extend({ notas: z.array(z.string()), campos: z.record(z.string(), z.string()) });

export const incidentesComuna = tablaBase.extend({
  supresion: z.object({ comunaAnioGravedad: supresionTabla, comunaHora: supresionTabla }),
  comunaAnioGravedad: z.array(comunaAnioGravedad),
  comunaHora: z.array(comunaHora),
});

export const victimasComuna = tablaBase.extend({
  condiciones: z.record(z.string(), z.array(z.string())),
  supresion: z.object({ comunaAnioCondicion: supresionTabla, muertosPorAnio: supresionTabla }),
  comunaAnioCondicion: z.array(comunaAnioCondicion),
  muertosPorAnio: z.array(muertosPorAnio),
});

export const hurtoComuna = tablaBase.extend({
  modalidades: z.record(z.string(), z.array(z.string())),
  supresion: z.object({ comunaAnioModalidad: supresionTabla, diaSemanaHora: supresionTabla }),
  comunaAnioModalidad: z.array(comunaAnioModalidad),
  diaSemanaHora: z.array(diaSemanaHora),
});

/* ── tipos ── */

export type FuenteAgregado = z.infer<typeof fuenteAgregado>;
export type ResolucionRejilla = z.infer<typeof resolucionRejilla>;
export type CeldaRejilla = z.infer<typeof celdaRejilla>;
/** Alias con el nombre que usa el plan (las celdas son cuadradas, no hexagonales). */
export type CeldaHex = CeldaRejilla;
export type CeldaRejillaVictimas = z.infer<typeof celdaRejillaVictimas>;
export type RejillaIncidentes = z.infer<typeof rejillaIncidentes>;
export type RejillaHurto = z.infer<typeof rejillaHurto>;
export type RejillaVictimas = z.infer<typeof rejillaVictimas>;
export type Gravedad = z.infer<typeof gravedad>;
export type Condicion = z.infer<typeof condicion>;
export type ComunaAnioGravedad = z.infer<typeof comunaAnioGravedad>;
export type ComunaHora = z.infer<typeof comunaHora>;
export type ComunaAnioCondicion = z.infer<typeof comunaAnioCondicion>;
export type MuertosPorAnio = z.infer<typeof muertosPorAnio>;
export type ComunaAnioModalidad = z.infer<typeof comunaAnioModalidad>;
export type DiaSemanaHora = z.infer<typeof diaSemanaHora>;
export type IncidentesComuna = z.infer<typeof incidentesComuna>;
export type VictimasComuna = z.infer<typeof victimasComuna>;
export type HurtoComuna = z.infer<typeof hurtoComuna>;

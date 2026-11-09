import "server-only";
import { z } from "zod";
import { COMUNAS_MEDELLIN, comunaPorCodigo, comunaPorNombre, normalizarCodigoComuna } from "@/lib/territorio";
import { cargarHurtoComuna, cargarIncidentesComuna, cargarVictimasComuna, obtenerSeguridadVial } from "./cargar";
import { CONDICIONES, type Condicion, type FuenteAgregado } from "./esquemas";
import { obtenerConsolidado } from "./fuentes";
import { aniosDisponibles, filtrarHurto, filtrarIncidentes, filtrarVictimas, serieHoras, sumarPorComuna, type ValorComuna } from "./metricas";

/**
 * Consultas deterministas de la Sala de Monitoreo para el Analista (modo directo y herramientas del modelo).
 * Contrato del plan (§5): toda respuesta es `Respuesta<T>` con citas (conjunto · campo · licencia · corte) y
 * los textos nunca califican barrios: "más casos reportados que el promedio", nunca "inseguro".
 * Ninguna cifra vive aquí: todo sale de los agregados validados y de las fuentes vivas con respaldo.
 */

export interface Cita {
  conjunto: string;
  id?: string;
  campo?: string;
  url: string;
  /** texto de licencia declarado por la fuente o "no declarada" */
  licencia: string;
  fechaCorte: string | null;
}

export type Respuesta<T> =
  | { ok: true; datos: T; citas: Cita[]; nota?: string }
  | { ok: false; motivo: "sin-datos" | "en-preparacion" | "error" | "sin-clave"; detalle: string };

export interface ComunaConsultada {
  codigo: string;
  nombre: string;
  tipo: "comuna" | "corregimiento";
  /** suma publicada; null si la comuna no tiene filas para el filtro */
  valor: number | null;
  /** la suma incluye conteos suprimidos (1–4 cada uno): el valor real es algo mayor */
  incompleto: boolean;
  /** porcentaje sobre el total de la ciudad, 1 decimal */
  porcentaje: number | null;
  /** "por encima del promedio" | "por debajo del promedio" | "sin dato" */
  frenteAlPromedio: "por encima del promedio" | "alrededor del promedio" | "por debajo del promedio" | "sin dato";
}

export interface RankingComunas {
  descripcion: string;
  periodo: string;
  total: number;
  promedioPorComuna: number | null;
  comunas: ComunaConsultada[];
  /** la comuna pedida, si se pidió */
  comuna: ComunaConsultada | null;
  aniosDisponibles: number[];
}

const licenciaTexto = (s: string | null | undefined) => {
  if (!s || /no declarada/i.test(s)) return "no declarada";
  if (/by-sa\/4\.0|Share Alike 4\.0|CC_40_BY_SA/i.test(s)) return "CC BY-SA 4.0";
  return s;
};

const citaAgregado = (f: FuenteAgregado, campo: string): Cita => ({
  conjunto: f.nombre,
  id: f.id,
  campo,
  url: f.url,
  licencia: licenciaTexto(f.licencia),
  fechaCorte: f.fechaCorte,
});

/** Acepta "10", "La Candelaria", "comuna 10", "Comuna 10 - La Candelaria". */
function resolverComuna(texto: string | undefined): string | null | "desconocida" {
  if (!texto) return null;
  const limpio = texto.replace(/^\s*(comuna|corregimiento)\s*/i, "").trim();
  const porCodigo = normalizarCodigoComuna(limpio);
  if (porCodigo) return porCodigo;
  const porNombre = comunaPorNombre(limpio.replace(/^\d+\s*-\s*/, ""));
  return porNombre ? porNombre.codigo : "desconocida";
}

function armarRanking(porComuna: ValorComuna[], total: number, comunaPedida: string | null, descripcion: string, periodo: string, anios: number[]): RankingComunas {
  const conDato = porComuna.filter((v) => v.valor !== null);
  const promedio = conDato.length ? total / conDato.length : null;
  const comunas: ComunaConsultada[] = COMUNAS_MEDELLIN.map((c) => {
    const v = porComuna.find((p) => p.codigo === c.codigo);
    const valor = v?.valor ?? null;
    let frente: ComunaConsultada["frenteAlPromedio"] = "sin dato";
    if (valor !== null && promedio !== null) {
      frente = valor > promedio * 1.1 ? "por encima del promedio" : valor < promedio * 0.9 ? "por debajo del promedio" : "alrededor del promedio";
    }
    return {
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      valor,
      incompleto: v?.incompleto ?? false,
      porcentaje: valor !== null && total > 0 ? Math.round((valor / total) * 1000) / 10 : null,
      frenteAlPromedio: frente,
    };
  }).sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  return {
    descripcion,
    periodo,
    total,
    promedioPorComuna: promedio === null ? null : Math.round(promedio),
    comunas,
    comuna: comunaPedida ? (comunas.find((c) => c.codigo === comunaPedida) ?? null) : null,
    aniosDisponibles: anios,
  };
}

/* ───────────────────────── consultarSeguridadVial ───────────────────────── */

export const esquemaSeguridadVial = z.object({
  /** código ("10") o nombre ("La Candelaria") de la comuna o corregimiento */
  comuna: z.string().min(1).max(60).optional(),
  anio: z.number().int().min(2014).max(2026).optional(),
  condicion: z.enum([...CONDICIONES, "todos"]).optional(),
  hora: z.number().int().min(0).max(23).optional(),
  /** "incidentes" (hechos, MEData 1-023-25-000094) · "victimas" (personas, 1-023-25-000360) · "muertes-anio" (MEData vs Policía) */
  tema: z.enum(["incidentes", "victimas", "muertes-anio"]).optional(),
});
export type ArgsSeguridadVial = z.infer<typeof esquemaSeguridadVial>;

export interface MuertesPorAnioConsulta {
  texto: string;
  filas: { anio: number; medata: number | null; policia: number | null; corte: string }[];
  ultimoAnioMedata: number | null;
  policiaGuardado: boolean;
}

export interface SeguridadVialConsulta {
  ranking: RankingComunas;
  /** hora del día con más registros (0–23) y su conteo, solo para incidentes sin filtro de hora */
  horaPico: { hora: number; valor: number } | null;
  /** registros en la hora pedida (ciudad o comuna) */
  enHora: { hora: number; valor: number | null; incompleto: boolean } | null;
}

/**
 * Seguridad vial por comuna/año/condición/hora, o la brecha de muertes por año MEData vs Policía.
 * Firma: `consultarSeguridadVial({ comuna?, anio? (2014–2026), condicion?: "peaton"|"motociclista"|"ciclista"|"otro"|"todos", hora? (0–23), tema?: "incidentes"|"victimas"|"muertes-anio" })`.
 */
export async function consultarSeguridadVial(args: ArgsSeguridadVial = {}): Promise<Respuesta<SeguridadVialConsulta | MuertesPorAnioConsulta>> {
  const parsed = esquemaSeguridadVial.safeParse(args);
  if (!parsed.success) return { ok: false, motivo: "error", detalle: "Los argumentos de la consulta no son válidos." };
  const a = parsed.data;

  if (a.tema === "muertes-anio") {
    const d = await obtenerSeguridadVial();
    if (!d.medata && d.policia.datos.serie.length === 0) return { ok: false, motivo: "sin-datos", detalle: "Ninguna de las dos series está disponible." };
    const filas = a.anio ? d.muertesPorAnio.filter((f) => f.anio === a.anio) : d.muertesPorAnio;
    if (filas.length === 0) return { ok: false, motivo: "sin-datos", detalle: "Ningún año coincide con la consulta." };
    const ultimo = d.medata?.ultimoAnio ?? null;
    const partes: string[] = [];
    if (ultimo !== null) partes.push(`La serie de MEData (Víctimas en incidentes viales) termina en ${ultimo}.`);
    else partes.push("La serie de MEData no está disponible.");
    const p = d.policia.datos.serie;
    if (p.length) {
      const primero = p[0]!;
      const ultimoP = p[p.length - 1]!;
      partes.push(`La Policía Nacional reporta desde ${primero.anio} hasta ${ultimoP.anio} (último año parcial), al corte declarado por la fuente.`);
    }
    const citas: Cita[] = [];
    if (d.medata) citas.push(citaAgregado(d.medata.fuente, "Gravedad_victima = Muertos, por año"));
    citas.push({
      conjunto: d.policia.fuente.nombre,
      campo: "sum(cantidad) por año, codigo_dane = 05001000",
      url: d.policia.fuente.pagina,
      licencia: licenciaTexto(d.policia.fuente.licencia),
      fechaCorte: d.policia.datos.filasActualizadasFuente ?? d.policia.consultado,
    });
    return {
      ok: true,
      datos: { texto: partes.join(" "), filas, ultimoAnioMedata: ultimo, policiaGuardado: d.policia.guardado },
      citas,
      nota: d.policia.guardado ? `La Policía no respondió; se usa la copia guardada del ${d.policia.capturado}.` : undefined,
    };
  }

  const comuna = resolverComuna(a.comuna);
  if (comuna === "desconocida") return { ok: false, motivo: "sin-datos", detalle: "No reconozco esa comuna o corregimiento de Medellín." };
  const usaVictimas = a.tema === "victimas" || (a.condicion !== undefined && a.condicion !== "todos");

  if (usaVictimas) {
    const t = cargarVictimasComuna();
    if (!t) return { ok: false, motivo: "en-preparacion", detalle: "El agregado de víctimas no pasó la validación." };
    const condicion = a.condicion && a.condicion !== "todos" ? (a.condicion as Condicion) : undefined;
    const filas = filtrarVictimas(t.comunaAnioCondicion, { anio: a.anio, condicion });
    const r = sumarPorComuna(filas, (f) => comuna === null || f.c === comuna);
    if (r.porComuna.length === 0) return { ok: false, motivo: "sin-datos", detalle: "Sin filas publicadas para ese filtro (año, condición o comuna)." };
    const descripcion = `Víctimas en incidentes viales${condicion ? ` · ${condicion}` : ""}${a.anio ? ` · ${a.anio}` : " · todos los años"}`;
    const periodo = `${t.fuente.periodo.desde ?? "?"} → ${t.fuente.periodo.hasta ?? "?"}`;
    return {
      ok: true,
      datos: { ranking: armarRanking(r.porComuna, r.total, comuna, descripcion, periodo, aniosDisponibles(t.comunaAnioCondicion)), horaPico: null, enHora: null },
      citas: [citaAgregado(t.fuente, "conteo de víctimas por NUMCOMUNA × año × condición (supresión n<5)")],
      nota: r.suprimidas ? `${r.suprimidas} conteos entre 1 y 4 están suprimidos; los totales marcados como incompletos son algo mayores.` : undefined,
    };
  }

  const t = cargarIncidentesComuna();
  if (!t) return { ok: false, motivo: "en-preparacion", detalle: "El agregado de incidentes no pasó la validación." };
  const r = sumarPorComuna(filtrarIncidentes(t.comunaAnioGravedad, { anio: a.anio }), (f) => comuna === null || f.c === comuna);
  if (r.porComuna.length === 0) return { ok: false, motivo: "sin-datos", detalle: "Sin filas publicadas para ese filtro (año o comuna)." };
  const horas = serieHoras(t.comunaHora, comuna ?? undefined);
  let horaPico: SeguridadVialConsulta["horaPico"] = null;
  for (const p of horas) if (p.valor !== null && (horaPico === null || p.valor > horaPico.valor)) horaPico = { hora: p.hora, valor: p.valor };
  const enHora = a.hora !== undefined ? { hora: a.hora, valor: horas[a.hora]!.valor, incompleto: horas[a.hora]!.incompleto } : null;
  const descripcion = `Incidentes viales${a.anio ? ` · ${a.anio}` : " · todos los años"}`;
  const periodo = `${t.fuente.periodo.desde ?? "?"} → ${t.fuente.periodo.hasta ?? "?"}`;
  return {
    ok: true,
    datos: { ranking: armarRanking(r.porComuna, r.total, comuna, descripcion, periodo, aniosDisponibles(t.comunaAnioGravedad)), horaPico, enHora },
    citas: [citaAgregado(t.fuente, "conteo de incidentes por NUMCOMUNA × año × gravedad; hora de FECHA_ACCIDENTE")],
    nota: "La serie por hora cubre todo el período (no se cruza con el año).",
  };
}

/* ───────────────────────── consultarHurtoComuna ───────────────────────── */

export const esquemaHurtoComuna = z.object({
  comuna: z.string().min(1).max(60).optional(),
  anio: z.number().int().min(2003).max(2023).optional(),
  /** conducta del consolidado SISC (por defecto "Hurto a persona") */
  conducta: z.string().min(2).max(80).optional(),
  /** modalidad del conjunto Hurto a persona (Atraco, Descuido, Cosquilleo…); si se pide, se usa ese conjunto */
  modalidad: z.string().min(2).max(40).optional(),
});
export type ArgsHurtoComuna = z.infer<typeof esquemaHurtoComuna>;

export interface HurtoComunaConsulta {
  ranking: RankingComunas;
  conductasDisponibles?: string[];
  modalidadesDisponibles?: string[];
  guardado?: boolean;
}

/**
 * Hurtos por comuna y año. Sin `modalidad` usa el consolidado oficial del SISC (MEData 1-027-23-000303, conducta
 * por defecto "Hurto a persona"); con `modalidad` usa el agregado del conjunto Hurto a persona (1-027-23-000011).
 * Firma: `consultarHurtoComuna({ comuna?, anio? (2003–2023), conducta?, modalidad? })`.
 */
export async function consultarHurtoComuna(args: ArgsHurtoComuna = {}): Promise<Respuesta<HurtoComunaConsulta>> {
  const parsed = esquemaHurtoComuna.safeParse(args);
  if (!parsed.success) return { ok: false, motivo: "error", detalle: "Los argumentos de la consulta no son válidos." };
  const a = parsed.data;
  const comuna = resolverComuna(a.comuna);
  if (comuna === "desconocida") return { ok: false, motivo: "sin-datos", detalle: "No reconozco esa comuna o corregimiento de Medellín." };

  if (a.modalidad) {
    const t = cargarHurtoComuna();
    if (!t) return { ok: false, motivo: "en-preparacion", detalle: "El agregado de hurto no pasó la validación." };
    const modalidades = [...new Set(t.comunaAnioModalidad.map((f) => f.m))].sort((x, y) => x.localeCompare(y));
    const modalidad = modalidades.find((m) => m.localeCompare(a.modalidad!, "es", { sensitivity: "base" }) === 0);
    if (!modalidad) return { ok: false, motivo: "sin-datos", detalle: `Modalidad no reconocida. Disponibles: ${modalidades.join(", ")}.` };
    const r = sumarPorComuna(filtrarHurto(t.comunaAnioModalidad, { anio: a.anio, modalidad }), (f) => comuna === null || f.c === comuna);
    if (r.porComuna.length === 0) return { ok: false, motivo: "sin-datos", detalle: "Sin filas publicadas para ese filtro." };
    const descripcion = `Hurto a persona · ${modalidad}${a.anio ? ` · ${a.anio}` : " · todos los años"}`;
    const periodo = `${t.fuente.periodo.desde ?? "?"} → ${t.fuente.periodo.hasta ?? "?"}`;
    return {
      ok: true,
      datos: { ranking: armarRanking(r.porComuna, r.total, comuna, descripcion, periodo, aniosDisponibles(t.comunaAnioModalidad)), modalidadesDisponibles: modalidades },
      citas: [citaAgregado(t.fuente, "conteo de casos por codigo_comuna × año × modalidad (supresión n<5)")],
      nota: r.suprimidas ? `${r.suprimidas} conteos entre 1 y 4 están suprimidos.` : undefined,
    };
  }

  const s = await obtenerConsolidado();
  const conductaPedida = a.conducta ?? "Hurto a persona";
  const conducta = s.datos.conductas.find((c) => c.localeCompare(conductaPedida, "es", { sensitivity: "base" }) === 0);
  if (!conducta) return { ok: false, motivo: "sin-datos", detalle: `Conducta no reconocida. Disponibles: ${s.datos.conductas.join(", ")}.` };
  const filas = s.datos.filas
    .filter((f) => f.conducta === conducta && (a.anio === undefined || f.anio === a.anio))
    .map((f) => ({ c: f.comuna, n: f.casos }));
  const r = sumarPorComuna(filas, (f) => comuna === null || f.c === comuna);
  if (r.porComuna.length === 0) return { ok: false, motivo: "sin-datos", detalle: "Sin filas para ese filtro (año o comuna)." };
  const anios = s.datos.anios;
  const descripcion = `${conducta}${a.anio ? ` · ${a.anio}` : " · todos los años"}`;
  const periodo = anios.length ? `${anios[0]} → ${anios[anios.length - 1]}` : "sin años";
  const nombreComuna = comuna ? comunaPorCodigo(comuna)?.nombre : undefined;
  return {
    ok: true,
    datos: { ranking: armarRanking(r.porComuna, r.total, comuna, descripcion, periodo, anios), conductasDisponibles: s.datos.conductas, guardado: s.guardado },
    citas: [
      {
        conjunto: s.fuente.nombre,
        id: s.fuente.id,
        campo: "Cantidad_casos por Codigo_comuna × Fecha_hecho (año) × Conducta",
        url: s.fuente.pagina,
        licencia: licenciaTexto(s.fuente.licencia),
        fechaCorte: s.guardado ? s.capturado : s.consultado,
      },
    ],
    nota: [
      nombreComuna ? `Comuna consultada: ${nombreComuna}.` : null,
      s.guardado ? `MEData no respondió; se usa la copia guardada del ${s.capturado}.` : null,
      r.suprimidas ? `${r.suprimidas} conteos entre 1 y 4 están suprimidos.` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined,
  };
}

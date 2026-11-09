import "server-only";

import { tool } from "ai";
import { z } from "zod";
import catalogoJson from "@/data/catalogo.json";
import resumenJson from "@/data/resumen-catalogo.json";
import { MEDATA_BASE, MEDATA_CATALOGO, type ConjuntoAuditado, type EstadoFrescura, type ResumenCatalogo } from "@/lib/catalogo";
import { analizarEnVivo } from "@/lib/laboratorio";
import { MUNICIPIOS_AMVA } from "@/lib/territorio";
import { fechaColombia } from "@/mundo/areas";
import { explicarFuentes, TEMAS_FAQ } from "./faq";
import type { NombreHerramienta } from "./sugeridas";

/* ───────────── Contratos (plan §5) ───────────── */

export interface Cita {
  conjunto: string;
  id?: string;
  campo?: string;
  url: string;
  licencia: string | "no declarada";
  fechaCorte: string | null;
}

export type MotivoFallo = "sin-datos" | "en-preparacion" | "error" | "sin-clave";

export type Respuesta<T> =
  | { ok: true; datos: T; citas: Cita[]; nota?: string }
  | { ok: false; motivo: MotivoFallo; detalle: string /* texto propio, NUNCA e.message */ };

export interface Herramienta<A, T> {
  descripcion: string;
  esquema: z.ZodType<A>;
  ejecutar: (args: A) => Promise<Respuesta<T>>;
}

const definir = <A, T>(h: Herramienta<A, T>) => h;

const resumen = resumenJson as ResumenCatalogo;
const catalogo = catalogoJson as ConjuntoAuditado[];

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** "HH:MM" en hora de Colombia (UTC-5), para los textos de error. */
export function horaBogota(d = new Date()) {
  const b = new Date(d.getTime() - 5 * 3600_000);
  return `${String(b.getUTCHours()).padStart(2, "0")}:${String(b.getUTCMinutes()).padStart(2, "0")}`;
}

/** "8 de noviembre de 2026, 23:20" en hora de Colombia, para que el modelo cite la fecha correcta sin convertir zonas horarias. */
export function fechaCorteLegible(iso: string) {
  return `${fechaColombia(iso)}, ${horaBogota(new Date(iso))}`;
}

const ESTADOS: [EstadoFrescura, ...EstadoFrescura[]] =["al-dia", "atrasado", "critico", "sin-periodicidad", "sin-fecha"];

const citaCatalogo: Cita = {
  conjunto: "Catálogo DKAN MEData",
  campo: "modified · accrualPeriodicity",
  url: MEDATA_CATALOGO,
  licencia: "no declarada",
  fechaCorte: resumen.generado,
};

type ConjuntoBreve = Pick<
  ConjuntoAuditado,
  "id" | "titulo" | "publicador" | "periodicidad" | "modificado" | "diasSinActualizar" | "vecesAtraso" | "estado"
> & { url: string };

const breve = (c: ConjuntoAuditado): ConjuntoBreve => ({
  id: c.id,
  titulo: c.titulo,
  publicador: c.publicador,
  periodicidad: c.periodicidad,
  modificado: c.modificado,
  diasSinActualizar: c.diasSinActualizar,
  vecesAtraso: c.vecesAtraso,
  estado: c.estado,
  url: `${MEDATA_BASE}/dataset/${c.id}`,
});

/* ───────────── consultarFrescura ───────────── */

const esquemaFrescura = z.object({
  secretaria: z
    .string()
    .min(2)
    .max(60)
    .optional()
    .describe("Nombre (o parte del nombre) de la secretaría o publicador, p. ej. 'Salud' o 'Movilidad'"),
  estado: z.enum(ESTADOS).optional().describe("Filtra los conjuntos por estado de frescura"),
  texto: z.string().min(2).max(80).optional().describe("Filtra los conjuntos por palabra en el título"),
  limite: z.number().int().min(1).max(20).optional().describe("Máximo de conjuntos y de secretarías a devolver (1–20, por defecto 10)"),
});

export interface DatosFrescura {
  resumen: { total: number; evaluables: number; atrasados: number; alDia: number; pct: number; generado: string };
  secretaria?: {
    publicador: string;
    total: number;
    atrasados: number;
    criticos: number;
    alDia: number;
    sinPeriodicidad: number;
    pct: number;
  };
  /** Secretarías ordenadas por conjuntos atrasados (solo cuando no se filtra una secretaría). */
  secretarias?: ResumenCatalogo["porPublicador"];
  conjuntos: ConjuntoBreve[];
  totalCoincidencias: number;
}

function buscarPublicador(nombre: string) {
  const n = sinTildes(nombre);
  const lista = resumen.porPublicador;
  return (
    lista.find((p) => sinTildes(p.publicador) === n) ??
    lista.find((p) => sinTildes(p.publicador).startsWith(n)) ??
    lista.find((p) => sinTildes(p.publicador).includes(n)) ??
    null
  );
}

const consultarFrescura = definir<z.infer<typeof esquemaFrescura>, DatosFrescura>({
  descripcion:
    "Frescura del catálogo de MEData: cuántos conjuntos están al día, atrasados o críticos, en total o por secretaría; ranking de secretarías con más conjuntos atrasados; lista de conjuntos filtrada por secretaría, estado o palabra del título.",
  esquema: esquemaFrescura,
  async ejecutar(args) {
    const limite = args.limite ?? 10;
    let pub: ResumenCatalogo["porPublicador"][number] | null = null;
    if (args.secretaria) {
      pub = buscarPublicador(args.secretaria);
      if (!pub) {
        const nombres = resumen.porPublicador.map((p) => p.publicador).join(", ");
        return {
          ok: false,
          motivo: "sin-datos",
          detalle: `No encontré una secretaría o publicador llamado “${args.secretaria}” en el catálogo. Publicadores disponibles: ${nombres}.`,
        };
      }
    }
    const texto = args.texto ? sinTildes(args.texto) : null;
    const filtrados = catalogo
      .filter((c) => !pub || c.publicador === pub.publicador)
      .filter((c) => !args.estado || c.estado === args.estado)
      .filter((c) => !texto || sinTildes(c.titulo).includes(texto))
      .sort((a, b) => (b.vecesAtraso ?? -1) - (a.vecesAtraso ?? -1));

    const datos: DatosFrescura = {
      resumen: {
        total: resumen.totalConjuntos,
        evaluables: resumen.evaluables,
        atrasados: resumen.porEstado.atrasado + resumen.porEstado.critico,
        alDia: resumen.porEstado["al-dia"],
        pct: resumen.pctAtrasados,
        generado: resumen.generado,
      },
      conjuntos: filtrados.slice(0, limite).map(breve),
      totalCoincidencias: filtrados.length,
    };
    if (pub) {
      const propios = catalogo.filter((c) => c.publicador === pub.publicador);
      datos.secretaria = {
        publicador: pub.publicador,
        total: pub.total,
        atrasados: pub.atrasados,
        criticos: pub.criticos,
        alDia: propios.filter((c) => c.estado === "al-dia").length,
        sinPeriodicidad: propios.filter((c) => c.estado === "sin-periodicidad" || c.estado === "sin-fecha").length,
        pct: pub.pct,
      };
    } else {
      datos.secretarias = [...resumen.porPublicador].sort((a, b) => b.atrasados - a.atrasados || b.total - a.total).slice(0, limite);
    }
    return {
      ok: true,
      datos,
      citas: [citaCatalogo],
      nota: `Fecha de corte del catálogo: ${fechaCorteLegible(resumen.generado)} (hora de Colombia). Un conjunto está atrasado cuando lleva más de una vez y media su periodicidad declarada sin actualizarse, y crítico cuando supera tres veces.`,
    };
  },
});

/* ───────────── buscarConjunto ───────────── */

const esquemaBuscar = z.object({
  texto: z.string().min(2).max(80).describe("Palabras a buscar en título, palabras clave o descripción"),
});

export interface DatosBusqueda {
  texto: string;
  totalCoincidencias: number;
  conjuntos: (ConjuntoBreve & { tieneCsv: boolean; temas: string[] })[];
}

const buscarConjunto = definir<z.infer<typeof esquemaBuscar>, DatosBusqueda>({
  descripcion: "Busca conjuntos de datos en el catálogo de MEData por título, palabras clave o descripción (hasta 5 resultados).",
  esquema: esquemaBuscar,
  async ejecutar({ texto }) {
    const t = sinTildes(texto);
    const palabras = t.split(/\s+/).filter((p) => p.length >= 2);
    const puntuar = (c: ConjuntoAuditado) => {
      let p = 0;
      const titulo = sinTildes(c.titulo);
      const claves = sinTildes(c.palabrasClave.join(" "));
      const desc = sinTildes(c.descripcion);
      for (const w of palabras) {
        if (titulo.includes(w)) p += 3;
        if (claves.includes(w)) p += 2;
        if (desc.includes(w)) p += 1;
      }
      if (titulo.includes(t)) p += 4;
      return p;
    };
    const puntuados = catalogo
      .map((c) => ({ c, p: puntuar(c) }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p || (b.c.vecesAtraso ?? -1) - (a.c.vecesAtraso ?? -1));
    if (puntuados.length === 0) {
      return { ok: false, motivo: "sin-datos", detalle: `Ningún conjunto del catálogo coincide con “${texto}”. Prueba con otra palabra.` };
    }
    const top = puntuados.slice(0, 5).map(({ c }) => ({ ...breve(c), tieneCsv: !!c.csvUrl, temas: c.temas }));
    return {
      ok: true,
      datos: { texto, totalCoincidencias: puntuados.length, conjuntos: top },
      citas: top.map((c) => ({
        conjunto: c.titulo,
        id: c.id,
        campo: "title · keyword · description",
        url: c.url,
        licencia: "no declarada",
        fechaCorte: c.modificado,
      })),
    };
  },
});

/* ───────────── consultarAire ───────────── */

const esquemaAire = z.object({
  municipio: z.enum(MUNICIPIOS_AMVA).optional().describe("Municipio del Valle de Aburrá"),
  ambito: z.enum(["medellin", "area-metropolitana"]).optional().describe("Medellín (por defecto) o toda el área metropolitana"),
});

// TODO(merge juan/siata): reemplazar el stub por obtenerAire() de src/lib/siata.ts (cita SIATA, licencia "no declarada", nota si guardado).
const consultarAire = definir<z.infer<typeof esquemaAire>, never>({
  descripcion: "Calidad del aire (PM2.5) por estación de SIATA en Medellín o el área metropolitana: peor y mejor estación, promedio y categoría.",
  esquema: esquemaAire,
  async ejecutar() {
    return {
      ok: false,
      motivo: "en-preparacion",
      detalle: "La conexión con SIATA se está integrando en esta versión del Analista. Mientras tanto, la Sala de Monitoreo muestra la lectura de las estaciones.",
    };
  },
});

/* ───────────── consultarSeguridadVial ───────────── */

const esquemaSeguridadVial = z.object({
  comuna: z.string().min(1).max(40).optional().describe("Nombre o código de la comuna"),
  anio: z.number().int().min(2014).max(2026).optional(),
  condicion: z.enum(["peaton", "motociclista", "ciclista", "todos"]).optional(),
  hora: z.number().int().min(0).max(23).optional(),
  tema: z.enum(["incidentes", "muertes-anio"]).optional().describe("'muertes-anio' compara MEData y Policía por año"),
});

// TODO(merge juan/monitoreo): leer src/data/seguridad-vial.json y obtenerMuertesPolicia() cuando lleguen a main.
const consultarSeguridadVial = definir<z.infer<typeof esquemaSeguridadVial>, never>({
  descripcion:
    "Seguridad vial en Medellín: incidentes y víctimas por comuna, hora y condición (peatón, motociclista, ciclista) según MEData, y muertes por año según MEData y la Policía Nacional.",
  esquema: esquemaSeguridadVial,
  async ejecutar() {
    return {
      ok: false,
      motivo: "en-preparacion",
      detalle: "Los agregados de seguridad vial (por comuna, hora y año) se están integrando en esta versión del Analista. La Sala de Monitoreo los mostrará cuando estén listos.",
    };
  },
});

/* ───────────── consultarHurtoComuna ───────────── */

const esquemaHurto = z.object({
  comuna: z.string().min(1).max(40).optional(),
  anio: z.number().int().min(2003).max(2023).optional(),
  conducta: z.string().min(2).max(60).optional().describe("P. ej. 'Hurto a persona', 'Hurto de motocicleta'"),
});

// TODO(merge juan/monitoreo): usar obtenerConsolidado() (1-027-23-000303, CC BY-SA 4.0) con supresión de conteos < 5.
const consultarHurtoComuna = definir<z.infer<typeof esquemaHurto>, never>({
  descripcion: "Casos de hurto por comuna y año en Medellín (consolidado del SISC publicado en MEData), solo agregados.",
  esquema: esquemaHurto,
  async ejecutar() {
    return {
      ok: false,
      motivo: "en-preparacion",
      detalle: "El consolidado de hurto por comuna se está integrando en esta versión del Analista. Solo se mostrarán agregados, nunca casos individuales.",
    };
  },
});

/* ───────────── limpiarConjunto ───────────── */

const esquemaLimpiar = z.object({
  id: z
    .string()
    .regex(/^[\w-]+$/)
    .describe("Identificador del conjunto en MEData, p. ej. 1-023-25-000360"),
});

export interface DatosLimpieza {
  id: string;
  titulo: string;
  publicador: string;
  antes: { puntaje: number; filas: number; pctCeldasVacias: number; filasVacias: number; filasDuplicadas: number };
  despues: { puntaje: number };
  cambios: { regla: string; descripcion: string; afectadas: number }[];
  bitacora: { paso: string; detalle: string; ms: number }[];
  codificacion: string;
  esMuestra: boolean;
  bytesLeidos: number;
  filasEstimadasArchivo: number | null;
}

const limpiarConjunto = definir<z.infer<typeof esquemaLimpiar>, DatosLimpieza>({
  descripcion:
    "Descarga en vivo una muestra del CSV de un conjunto de MEData, lo diagnostica y lo limpia: puntaje de calidad antes y después, filas vacías y duplicadas, reglas aplicadas y bitácora. Primero busca el id con buscarConjunto si no lo conoces.",
  esquema: esquemaLimpiar,
  async ejecutar({ id }) {
    const conjunto = catalogo.find((c) => c.id === id);
    if (!conjunto) return { ok: false, motivo: "sin-datos", detalle: `No existe un conjunto con el identificador ${id} en el catálogo de MEData.` };
    if (!conjunto.csvUrl)
      return { ok: false, motivo: "sin-datos", detalle: `“${conjunto.titulo}” no publica un archivo CSV descargable, así que no se puede limpiar en vivo.` };
    if (!conjunto.csvUrl.startsWith(`${MEDATA_BASE}/`))
      return { ok: false, motivo: "error", detalle: "El archivo de este conjunto está fuera del dominio de MEData y no se descarga por seguridad." };
    try {
      const inf = await analizarEnVivo(conjunto.csvUrl);
      const a = inf.resultado.antes;
      return {
        ok: true,
        datos: {
          id: conjunto.id,
          titulo: conjunto.titulo,
          publicador: conjunto.publicador,
          antes: { puntaje: a.puntaje, filas: a.filas, pctCeldasVacias: a.pctCeldasVacias, filasVacias: a.filasVacias, filasDuplicadas: a.filasDuplicadas },
          despues: { puntaje: inf.resultado.despues.puntaje },
          cambios: inf.resultado.cambios,
          bitacora: inf.bitacora,
          codificacion: inf.codificacion,
          esMuestra: inf.esMuestra,
          bytesLeidos: inf.bytesLeidos,
          filasEstimadasArchivo: inf.filasEstimadasArchivo,
        },
        citas: [
          {
            conjunto: conjunto.titulo,
            id: conjunto.id,
            campo: "archivo CSV publicado (distribution.downloadURL)",
            url: conjunto.csvUrl,
            licencia: "no declarada",
            fechaCorte: conjunto.modificado,
          },
        ],
        nota: inf.esMuestra
          ? "Análisis sobre una muestra: el inicio y el final del archivo, leídos en vivo desde MEData."
          : "Análisis sobre el archivo completo, leído en vivo desde MEData.",
      };
    } catch {
      return { ok: false, motivo: "error", detalle: `MEData no respondió al descargar el archivo a las ${horaBogota()}. Intenta de nuevo en un momento.` };
    }
  },
});

/* ───────────── explicarFuentes ───────────── */

const esquemaFuentes = z.object({
  tema: z.enum(TEMAS_FAQ).describe("fuentes · reproducir · limites · como-usar · ia"),
});

const herramientaFuentes = definir<z.infer<typeof esquemaFuentes>, ReturnType<typeof explicarFuentes> extends Respuesta<infer T> ? T : never>({
  descripcion: "Explica de dónde salen los datos de SINAPSIS, cómo reproducir las cifras, sus límites, cómo usar el Analista y qué hace la IA.",
  esquema: esquemaFuentes,
  async ejecutar({ tema }) {
    return explicarFuentes(tema, resumen);
  },
});

/* ───────────── Registro ───────────── */

export const REGISTRO = {
  consultarFrescura,
  buscarConjunto,
  consultarAire,
  consultarSeguridadVial,
  consultarHurtoComuna,
  limpiarConjunto,
  explicarFuentes: herramientaFuentes,
};

// Comprobación de tipos: el registro cubre exactamente los nombres compartidos con el cliente.
const _chequeo: Record<NombreHerramienta, unknown> = REGISTRO;
void _chequeo;

export const NOMBRES = Object.keys(REGISTRO) as [NombreHerramienta, ...NombreHerramienta[]];

type HerramientaGenerica = Herramienta<unknown, unknown>;

/** Ejecuta una herramienta validando sus argumentos. Nunca lanza. */
export async function ejecutarHerramienta(nombre: NombreHerramienta, args: unknown): Promise<Respuesta<unknown>> {
  const h = REGISTRO[nombre] as unknown as HerramientaGenerica;
  const parsed = h.esquema.safeParse(args ?? {});
  if (!parsed.success) {
    return { ok: false, motivo: "error", detalle: "Los argumentos de la consulta no son válidos para esta herramienta." };
  }
  try {
    return await h.ejecutar(parsed.data);
  } catch {
    return { ok: false, motivo: "error", detalle: `La herramienta no pudo completar la consulta a las ${horaBogota()}.` };
  }
}

/** Herramientas en el formato del AI SDK (mismo registro, misma ejecución). */
export const herramientasSDK = Object.fromEntries(
  (Object.entries(REGISTRO) as [NombreHerramienta, HerramientaGenerica][]).map(([nombre, h]) => [
    nombre,
    tool({
      description: h.descripcion,
      inputSchema: h.esquema,
      execute: (args: unknown) => ejecutarHerramienta(nombre, args),
    }),
  ]),
);

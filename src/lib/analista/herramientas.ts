import "server-only";

import { tool } from "ai";
import { z } from "zod";
import catalogoJson from "@/data/catalogo.json";
import resumenJson from "@/data/resumen-catalogo.json";
import { MEDATA_BASE, MEDATA_CATALOGO, type ConjuntoAuditado, type EstadoFrescura, type ResumenCatalogo } from "@/lib/catalogo";
import { analizarEnVivo } from "@/lib/laboratorio";
import { resumirEstaciones, type EstacionResumen, type ResumenAire } from "@/lib/aire";
import {
  consultarHurtoComuna as consultarHurtoComunaMonitoreo,
  consultarSeguridadVial as consultarSeguridadVialMonitoreo,
  esquemaHurtoComuna as esquemaHurtoComunaMonitoreo,
  esquemaSeguridadVial as esquemaSeguridadVialMonitoreo,
} from "@/lib/monitoreo/consultas";
import { planearRuta as planearRutaPulso, type DatosRuta } from "@/lib/rutas/planear";
import { obtenerAire } from "@/lib/siata";
import { MUNICIPIOS_AMVA } from "@/lib/territorio";
import { esFechaSoloDia, fechaColombia } from "@/mundo/areas";
import { MODOS_RUTA } from "@/pulso/rutas/constantes";
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

/** Plazo máximo de una descarga de MEData dentro de una herramienta (muy por debajo del maxDuration de 60 s de la ruta). */
const PLAZO_MEDATA_MS = 20_000;
/** Plazo máximo de cualquier herramienta, para que el chat reciba un fallo con texto propio y no el corte de Vercel. */
const PLAZO_HERRAMIENTA_MS = 25_000;

/** Rechaza con Error("plazo") si la promesa no termina a tiempo. No cancela el trabajo subyacente, solo deja de esperarlo. */
function conPlazo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("plazo")), ms);
  });
  return Promise.race([promesa, plazo]).finally(() => clearTimeout(temporizador));
}

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
  if (esFechaSoloDia(iso)) return fechaColombia(iso);
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

export interface DatosAire {
  ambito: string;
  resumen: ResumenAire;
  /** estaciones válidas del ámbito, de mayor a menor PM2.5 (máx. 12) */
  estaciones: EstacionResumen[];
  lectura: string | null;
  guardado: boolean;
}

const consultarAire = definir<z.infer<typeof esquemaAire>, DatosAire>({
  descripcion: "Calidad del aire (PM2.5) por estación de SIATA en Medellín o el área metropolitana: peor y mejor estación, promedio y categoría ICA (Resolución 2254 de 2017).",
  esquema: esquemaAire,
  async ejecutar({ municipio, ambito }) {
    const s = await obtenerAire();
    if (!s.ok) return { ok: false, motivo: "error", detalle: `SIATA no respondió a las ${horaBogota()} y no hay copia guardada legible.` };
    let lista = s.estaciones.filter((e) => e.pm25 !== null);
    let nombreAmbito = "Medellín";
    let res: ResumenAire = s.resumen.medellin;
    if (municipio) {
      lista = lista.filter((e) => e.municipio === municipio);
      nombreAmbito = municipio;
      res = resumirEstaciones(s.estaciones.filter((e) => e.municipio === municipio));
    } else if (ambito === "area-metropolitana") {
      nombreAmbito = "Valle de Aburrá";
      res = s.resumen.areaMetropolitana;
    } else {
      lista = lista.filter((e) => e.enMedellin);
    }
    if (lista.length === 0) return { ok: false, motivo: "sin-datos", detalle: `SIATA no tiene lecturas válidas de PM2.5 en ${nombreAmbito} en este momento.` };
    const estaciones = lista
      .sort((a, b) => (b.pm25 ?? 0) - (a.pm25 ?? 0))
      .slice(0, 12)
      .map((e) => ({ codigo: e.codigo, nombre: e.nombre, sitio: e.sitio, municipio: e.municipio, pm25: e.pm25, ica: e.ica, categoria: e.categoria }));
    return {
      ok: true,
      datos: { ambito: nombreAmbito, resumen: res, estaciones, lectura: s.lectura, guardado: s.guardado },
      citas: [
        {
          conjunto: "SIATA · red de calidad del aire (PM2.5)",
          campo: "PM2.5 µg/m³ por estación; ICA y categoría según Resolución 2254 de 2017",
          url: s.fuente.url,
          licencia: s.fuente.licencia,
          fechaCorte: s.lectura ?? s.consultado,
        },
      ],
      nota: [
        s.lectura ? `${s.guardado ? "Copia guardada; lectura" : "Última lectura"} de SIATA: ${fechaCorteLegible(s.lectura)} (hora de Colombia).` : null,
        s.guardado ? (s.aviso ?? `SIATA no respondió; se muestra la copia guardada${s.capturado ? ` del ${fechaCorteLegible(s.capturado)}` : ""}.`) : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    };
  },
});

/* ───────────── consultarSeguridadVial y consultarHurtoComuna (Sala de Monitoreo) ───────────── */

const consultarSeguridadVial = definir<z.infer<typeof esquemaSeguridadVialMonitoreo>, unknown>({
  descripcion:
    "Seguridad vial en Medellín según MEData: incidentes por comuna, año y hora pico (tema 'incidentes'); víctimas por comuna, año y condición peatón/motociclista/ciclista/otro (tema 'victimas' o con 'condicion'); y muertes por año MEData vs Policía Nacional (tema 'muertes-anio'). Solo agregados con supresión de conteos < 5.",
  esquema: esquemaSeguridadVialMonitoreo,
  ejecutar: (args) => consultarSeguridadVialMonitoreo(args),
});

const consultarHurtoComuna = definir<z.infer<typeof esquemaHurtoComunaMonitoreo>, unknown>({
  descripcion:
    "Hurtos por comuna y año en Medellín: consolidado oficial del SISC en MEData (conducta, por defecto 'Hurto a persona') o, con 'modalidad' (Atraco, Cosquilleo, Descuido, Raponazo…), el conjunto Hurto a persona. Solo agregados; nunca casos individuales.",
  esquema: esquemaHurtoComunaMonitoreo,
  ejecutar: (args) => consultarHurtoComunaMonitoreo(args),
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
      // laboratorio.ts (archivo de Isabela) no acepta AbortSignal: el plazo se pone aquí para no esperar hasta que Vercel mate la función.
      const inf = await conPlazo(analizarEnVivo(conjunto.csvUrl), PLAZO_MEDATA_MS);
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
  descripcion: "Explica qué es PULSO Medellín y qué sabe hacer PulsoBot, de dónde salen los datos, cómo reproducir las cifras, sus límites y qué hace la IA. Úsala para saludos y preguntas generales sobre la plataforma.",
  esquema: esquemaFuentes,
  async ejecutar({ tema }) {
    return explicarFuentes(tema, resumen);
  },
});

/* ───────────── planearRuta (PULSO · rutas inteligentes) ───────────── */

const esquemaRuta = z.object({
  origen: z.string().min(2).max(160).describe("Lugar de partida en el Valle de Aburrá, p. ej. 'La Alpujarra, Medellín'"),
  destino: z.string().min(2).max(160).describe("Lugar de llegada en el Valle de Aburrá, p. ej. 'Parque Lleras, Medellín'"),
  modo: z.enum(MODOS_RUTA).optional().describe("DRIVE (carro, por defecto) · TWO_WHEELER (moto) · BICYCLE (bici) · WALK (a pie)"),
});

const planearRuta = definir<z.infer<typeof esquemaRuta>, DatosRuta>({
  descripcion:
    "Planea una ruta de un lugar a otro en Medellín y el Valle de Aburrá: compara las alternativas de Google por PM2.5 estimado con SIATA en vivo, incidentes viales históricos cercanos (MEData) y tiempo, y marca la recomendada. Úsala cuando pidan ir de A a B, la ruta más limpia, con mejor aire o con menos incidentes reportados. Si el lugar no trae municipio, agrégale ', Medellín'.",
  esquema: esquemaRuta,
  ejecutar: (args) => planearRutaPulso(args),
});

/* ───────────── controlarApp (PulsoBot maneja la plataforma) ───────────── */

const CAPAS_APP = ["aire", "incidentes", "victimas", "hurto", "comunas"] as const;
const SECCIONES_APP = { inicio: "/", alpujarra: "/alpujarra", panel: "/panel", monitoreo: "/monitoreo", laboratorio: "/laboratorio", frescura: "/frescura", analista: "/analista" } as const;
const NOMBRE_CAPA_APP: Record<(typeof CAPAS_APP)[number], string> = {
  aire: "aire (PM2.5 de SIATA)",
  incidentes: "incidentes viales",
  victimas: "víctimas en incidentes viales",
  hurto: "hurto a personas",
  comunas: "comunas y corregimientos",
};
const NOMBRE_SECCION_APP: Record<keyof typeof SECCIONES_APP, string> = {
  inicio: "el mapa en vivo",
  alpujarra: "la Agencia de datos",
  panel: "el panel ejecutivo",
  monitoreo: "la Sala de Monitoreo",
  laboratorio: "el Laboratorio de Limpieza",
  frescura: "el Reloj de Frescura",
  analista: "la página del asistente",
};

const esquemaControl = z.object({
  accion: z
    .enum(["capa", "tema", "recorrido", "vista-inicial", "abrir-rutas", "limpiar-rutas", "ir-a"])
    .describe("capa: mostrar u ocultar una capa del mapa · tema: claro u oscuro · recorrido: giro automático de la cámara · vista-inicial: volver a la vista general · abrir-rutas: abrir el planificador · limpiar-rutas: borrar rutas dibujadas · ir-a: abrir otra sección"),
  capa: z.enum(CAPAS_APP).optional(),
  visible: z.boolean().optional().describe("true para mostrar la capa (por defecto), false para ocultarla"),
  tema: z.enum(["claro", "oscuro"]).optional(),
  activo: z.boolean().optional().describe("recorrido encendido (por defecto) o apagado"),
  seccion: z.enum(["inicio", "alpujarra", "panel", "monitoreo", "laboratorio", "frescura", "analista"]).optional(),
});

export interface DatosControl {
  accion: z.infer<typeof esquemaControl>["accion"];
  /** frase corta de confirmación, también para la voz */
  texto: string;
  capa?: (typeof CAPAS_APP)[number];
  visible?: boolean;
  tema?: "claro" | "oscuro";
  activo?: boolean;
  ruta?: string;
}

const controlarApp = definir<z.infer<typeof esquemaControl>, DatosControl>({
  descripcion:
    "Maneja la plataforma PULSO Medellín por la persona: muestra u oculta capas del mapa 3D (aire, incidentes, víctimas, hurto, comunas), cambia el tema claro u oscuro, enciende o apaga el recorrido de cámara, vuelve a la vista general, abre el planificador de rutas, borra rutas o abre otra sección (Agencia de datos, panel, monitoreo, laboratorio, frescura). Úsala cuando pidan ver, mostrar, quitar, cambiar o abrir algo de la plataforma. No devuelve cifras.",
  esquema: esquemaControl,
  async ejecutar(a) {
    const listo = (datos: DatosControl): Respuesta<DatosControl> => ({ ok: true, datos, citas: [] });
    const falta = (detalle: string): Respuesta<DatosControl> => ({ ok: false, motivo: "sin-datos", detalle });
    switch (a.accion) {
      case "capa": {
        if (!a.capa) return falta("Dime qué capa: aire, incidentes viales, víctimas, hurto o comunas.");
        const visible = a.visible ?? true;
        return listo({ accion: "capa", capa: a.capa, visible, texto: visible ? `Listo, te muestro en el mapa la capa de ${NOMBRE_CAPA_APP[a.capa]}.` : `Listo, oculté la capa de ${NOMBRE_CAPA_APP[a.capa]}.` });
      }
      case "tema": {
        if (!a.tema) return falta("Dime si prefieres el tema claro o el oscuro.");
        return listo({ accion: "tema", tema: a.tema, texto: `Listo, cambié a tema ${a.tema}.` });
      }
      case "recorrido": {
        const activo = a.activo ?? true;
        return listo({ accion: "recorrido", activo, texto: activo ? "Listo, la cámara empieza a recorrer la ciudad." : "Listo, detuve el recorrido." });
      }
      case "vista-inicial":
        return listo({ accion: "vista-inicial", texto: "Listo, volví a la vista general de Medellín." });
      case "abrir-rutas":
        return listo({ accion: "abrir-rutas", texto: "Listo, abrí el planificador de rutas. También puedes pedirme la ruta diciendo de dónde a dónde vas." });
      case "limpiar-rutas":
        return listo({ accion: "limpiar-rutas", texto: "Listo, borré las rutas del mapa." });
      case "ir-a": {
        if (!a.seccion) return falta("Dime a qué sección: la Agencia de datos, el panel, el monitoreo, el laboratorio o la frescura.");
        return listo({ accion: "ir-a", ruta: SECCIONES_APP[a.seccion], texto: `Listo, te llevo a ${NOMBRE_SECCION_APP[a.seccion]}.` });
      }
    }
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
  planearRuta,
  controlarApp,
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
    return await conPlazo(h.ejecutar(parsed.data), PLAZO_HERRAMIENTA_MS);
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

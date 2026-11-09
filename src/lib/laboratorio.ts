import Papa from "papaparse";
import { decodificar, limpiar, limpiarCelda, type ResultadoLimpieza } from "./calidad";

export const BYTES_MUESTRA = 3 * 1024 * 1024; // 3 MB por análisis en vivo

/**
 * Columnas con datos personales o cuasi-identificadores (requisito "sin datos personales" de la guía).
 * Se comparan por TOKEN del encabezado normalizado (minúsculas, sin tildes, espacios/guiones → "_"),
 * no por nombre exacto: así quedan cubiertos "Numero_documento", "Edad_victima", "Telefono contacto",
 * "coord_x", "the_geom", "GENERO_"… de cualquiera de los 400+ conjuntos del catálogo.
 */
const TOKENS_SENSIBLES = [
  // identificadores directos
  "nombres?", "apellidos?", "razon_social", "documento", "cedula", "identificacion", "nit", "placa",
  "telefono", "celular", "whatsapp", "correo", "e_?mail", "mail",
  // cuasi-identificadores y datos sensibles (Ley 1581, art. 5)
  "sexo", "genero", "edad", "nacimiento", "etnia", "orientacion_sexual", "estado_civil", "ocupacion", "profesion",
  "discapacidad", "nivel_academico", "escolaridad", "radicado", "expediente",
  // ubicación exacta (dirección, lote catastral, coordenadas, geometrías)
  "direccion", "dir", "cbml", "latitud", "longitud", "lat", "lon", "lng", "latitude", "longitude",
  "coord", "coordenadas?", "geom", "geometry", "wkt", "location",
];
export const COLUMNAS_SENSIBLES = new RegExp(`(^|_)(${TOKENS_SENSIBLES.join("|")})(_|$)|(^|_)[xy]$`);
/**
 * Falsos positivos que sí se conservan: nombres de lugares, programas o entidades (no de personas),
 * el TIPO de documento o identificación (no su número) y la "Dirección" como dependencia (subsecretaría_dirección).
 */
const COLUMNAS_EXENTAS =
  /^(tipo_(de_)?(documento|identificacion)|(sub)?secretaria_direccion|nombres?_?(del?_|de_las?_|de_los_)?(barrio|comuna|corregimiento|vereda|sede|via|estacion|lugar|beneficio|unidad|programa|proyecto|entidad|institucion|dependencia|secretaria|subsecretaria|evento|actividad|obra|parque|ruta|linea|servicio|establecimiento|producto|indicador|variable|zona|sector|cuenca|quebrada|conjunto|archivo|campo|columna|categoria))/;
export const MASCARA = "•••";

/** Columnas de hora: una muerte vial en un barrio a una hora exacta es reidentificable con prensa local. */
const COLUMNA_HORA = /(^|_)horas?(_|$)/;
const RE_HORA_EXACTA = /(^|[T\s])(\d{1,2}):\d{2}(:\d{2}(\.\d+)?)?/;

/**
 * Redondea la hora a la hora en punto y conserva fecha (día) y zona horaria:
 * "05:58:00" → "05:00" · "21/10/2015 05:58:00" → "21/10/2015 05:00" · "2017-01-01T01:35:00.000-05:00" → "2017-01-01T01:00-05:00".
 * Una hora ya entera ("14") o una fecha sin hora no cambian.
 */
export function generalizarHora(v: string): string {
  return v.replace(RE_HORA_EXACTA, (_, pre: string, h: string) => `${pre}${h.padStart(2, "0")}:00`);
}

export function normalizarEncabezado(h: string): string {
  return h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[\s\-.]+/g, "_");
}

export function esColumnaSensible(encabezado: string): boolean {
  const n = normalizarEncabezado(encabezado);
  return COLUMNAS_SENSIBLES.test(n) && !COLUMNAS_EXENTAS.test(n);
}

export interface PasoBitacora {
  paso: string;
  detalle: string;
  ms: number;
}

export interface InformeLaboratorio {
  url: string;
  bytesLeidos: number;
  bytesTotales: number | null;
  esMuestra: boolean;
  codificacion: string;
  filasEstimadasArchivo: number | null;
  /** filas leídas del final del archivo y cuántas de ellas estaban vacías */
  filasFinal: number;
  vaciasFinal: number;
  resultado: Omit<ResultadoLimpieza, "filasLimpias" | "encabezado">;
  encabezado: string[];
  /** Columnas con datos personales: celdas "•••" en los ejemplos y ausentes en csvLimpio */
  columnasOmitidas: string[];
  ejemploAntes: string[][];
  ejemploDespues: string[][];
  csvLimpio: string; // primeras filas limpias, sin columnas personales, para descargar
  bitacora: PasoBitacora[];
}

const BYTES_INICIO = 2 * 1024 * 1024;
const BYTES_FINAL = BYTES_MUESTRA - BYTES_INICIO;

/**
 * Descarga el inicio y el final del archivo con HTTP Range (sin bajar todo el archivo).
 * El final importa: ahí suelen estar las fechas más recientes y las filas vacías de relleno.
 */
async function descargarMuestra(url: string) {
  const r = await fetch(url, { headers: { Range: `bytes=0-${BYTES_INICIO - 1}` }, redirect: "follow" });
  if (!r.ok && r.status !== 206) throw new Error(`MEData respondió ${r.status} al descargar el archivo`);
  const inicio = new Uint8Array(await r.arrayBuffer());
  const rango = r.headers.get("content-range"); // "bytes 0-2097151/62328792"
  const total = rango ? Number(rango.split("/")[1]) : Number(r.headers.get("content-length")) || null;
  const esMuestra = r.status === 206 && total !== null && total > inicio.length;
  if (!esMuestra) return { inicio, final: null, total: total ?? inicio.length, esMuestra };

  const fin = inicio.lastIndexOf(0x0a);
  const inicioCompleto = inicio.subarray(0, fin > 0 ? fin : inicio.length);
  let final: Uint8Array | null = null;
  if (total! > BYTES_INICIO + BYTES_FINAL) {
    const rf = await fetch(url, { headers: { Range: `bytes=${total! - BYTES_FINAL}-${total! - 1}` }, redirect: "follow" });
    if (rf.status === 206) {
      const b = new Uint8Array(await rf.arrayBuffer());
      const primera = b.indexOf(0x0a); // descartar la primera línea, que llega cortada
      final = b.subarray(primera + 1);
    }
  }
  return { inicio: inicioCompleto, final, total: total!, esMuestra };
}

export async function analizarEnVivo(url: string): Promise<InformeLaboratorio> {
  const bitacora: PasoBitacora[] = [];
  let t = performance.now();
  const marca = (paso: string, detalle: string) => {
    const ahora = performance.now();
    bitacora.push({ paso, detalle, ms: Math.round(ahora - t) });
    t = ahora;
  };

  const { inicio, final, total, esMuestra } = await descargarMuestra(url);
  const bytesLeidos = inicio.length + (final?.length ?? 0);
  marca(
    "Descarga",
    esMuestra
      ? `Leí el inicio (${mb(inicio.length)})${final ? ` y el final (${mb(final.length)})` : ""} de un archivo de ${mb(total)}, directo desde MEData`
      : `Leí el archivo completo (${mb(inicio.length)}) desde MEData`,
  );

  const decIni = decodificar(inicio);
  const decFin = final ? decodificar(final) : null;
  const codificacion = decIni.codificacion === "utf-8" && (!decFin || decFin.codificacion === "utf-8") ? "utf-8" : "latin-1";
  marca(
    "Codificación",
    codificacion === "utf-8" ? "El archivo está en UTF-8" : "Hay partes que NO están en UTF-8: las leí como Latin-1",
  );

  const parse = (t: string) => Papa.parse<string[]>(t, { skipEmptyLines: false }).data;
  const [encabezado, ...filasIni] = parse(decIni.texto.replace(/^﻿/, ""));
  const filasFin = decFin ? parse(decFin.texto) : [];
  const esLineaNula = (f: string[]) => f.length === 1 && f[0] === "";
  const filasValidas = [...filasIni, ...filasFin].filter((f) => !esLineaNula(f));
  const vaciasFinal = filasFin.filter((f) => !esLineaNula(f) && f.every((c) => c.trim() === "")).length;
  marca(
    "Lectura",
    `${filasValidas.length.toLocaleString("es-CO")} filas y ${encabezado.length} columnas` +
      (filasFin.length ? ` (${filasFin.length.toLocaleString("es-CO")} del final del archivo${vaciasFinal ? `, ${vaciasFinal.toLocaleString("es-CO")} de ellas vacías` : ""})` : ""),
  );

  const res = limpiar(encabezado, filasValidas);
  marca(
    "Diagnóstico",
    `Puntaje de calidad ${res.antes.puntaje}/100 · ${res.antes.pctCeldasVacias}% de celdas vacías · ${res.antes.filasVacias} filas vacías · ${res.antes.filasDuplicadas} duplicadas`,
  );
  marca("Limpieza", `${res.cambios.length} reglas aplicadas · puntaje después: ${res.despues.puntaje}/100`);

  // ejemplo antes/después: las primeras filas con algún cambio, si existen
  const tipos = res.antes.columnasPerfil.map((p) => p.tipo);
  const candidatas = filasValidas.filter((f) => !f.every((c) => c.trim() === ""));
  const conCambio = candidatas.filter((f) => f.some((c, j) => limpiarCelda(c, tipos[j]) !== c));
  const crudas = (conCambio.length >= 6 ? conCambio : candidatas).slice(0, 8);

  // Privacidad: las columnas personales se enmascaran en los ejemplos y se omiten del CSV descargable;
  // en las columnas de hora (y en las fechas con hora) se redondea a la hora en punto.
  const sensibles = encabezado.map((h) => esColumnaSensible(h));
  const conHora = encabezado.map((h, j) => !sensibles[j] && (COLUMNA_HORA.test(normalizarEncabezado(h)) || tipos[j] === "fecha"));
  const horasRedondeadas = new Set<number>();
  const proteger = (c: string, j: number) => {
    if (sensibles[j]) return MASCARA;
    if (!conHora[j]) return c;
    const g = generalizarHora(c);
    if (g !== c) horasRedondeadas.add(j);
    return g;
  };
  const columnasOmitidas = encabezado.filter((_, j) => sensibles[j]);
  const ejemploAntes = crudas.map((f) => encabezado.map((_, j) => proteger(f[j] ?? "", j)));
  const ejemploDespues = crudas.map((f) => encabezado.map((_, j) => proteger(limpiarCelda(f[j] ?? "", tipos[j]), j)));
  const paraCsv = (f: string[]) => f.map(proteger).filter((_, j) => !sensibles[j]);
  const ocultarEjemplos = (d: typeof res.antes) => ({
    ...d,
    columnasPerfil: d.columnasPerfil.map((p, j) => (sensibles[j] || conHora[j] ? { ...p, ejemplosProblema: p.ejemplosProblema.map((e) => proteger(e, j)) } : p)),
  });
  const csvLimpio = Papa.unparse([res.encabezado.filter((_, j) => !sensibles[j]), ...res.filasLimpias.slice(0, 5000).map(paraCsv)]);
  const columnasHora = encabezado.filter((_, j) => horasRedondeadas.has(j));
  marca(
    "Privacidad",
    [
      columnasOmitidas.length
        ? `Se omiten ${columnasOmitidas.length} columnas con datos personales (${columnasOmitidas.join(", ")}): "•••" en el ejemplo y fuera del CSV`
        : "No encontré columnas con datos personales",
      columnasHora.length ? `hora redondeada a la hora en punto en ${columnasHora.join(", ")} (fecha y barrio se conservan)` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );

  // Estimación con la densidad de filas del inicio (el final puede tener filas vacías, que son más cortas)
  const filasEstimadasArchivo = esMuestra ? Math.round((filasIni.length * total) / inicio.length) : filasValidas.length;

  return {
    url,
    bytesLeidos,
    bytesTotales: total,
    esMuestra,
    codificacion,
    filasEstimadasArchivo,
    filasFinal: filasFin.filter((f) => !esLineaNula(f)).length,
    vaciasFinal,
    resultado: { antes: ocultarEjemplos(res.antes), despues: ocultarEjemplos(res.despues), cambios: res.cambios },
    encabezado,
    columnasOmitidas,
    ejemploAntes,
    ejemploDespues,
    csvLimpio,
    bitacora,
  };
}

function mb(n: number) {
  return `${(n / 1024 / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
}

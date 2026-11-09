import Papa from "papaparse";
import { decodificar, limpiar, limpiarCelda, type ResultadoLimpieza } from "./calidad";

export const BYTES_MUESTRA = 3 * 1024 * 1024; // 3 MB por análisis en vivo

/**
 * Columnas con datos personales o cuasi-identificadores (requisito "sin datos personales" de la guía).
 * Se comparan contra el encabezado normalizado (minúsculas, sin tildes, espacios/guiones → "_").
 */
export const COLUMNAS_SENSIBLES =
  /^(sexo|edad|grupo_edad|estado_civil|ocupacion|discapacidad|nivel_academico|radicado|nro_radicado|expediente|direccion.*|latitud|longitud|x|y|location|nombre.*|documento|telefono|correo)$/;
/** Nombres de lugar (barrio, comuna…) no son personales: se conservan aunque empiecen por "nombre". */
const COLUMNAS_EXENTAS = /^nombre_?(barrio|comuna|corregimiento|vereda|sede|via|estacion|lugar)s?$/;
export const MASCARA = "•••";

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

  // Privacidad: las columnas personales se enmascaran en los ejemplos y se omiten del CSV descargable
  const sensibles = encabezado.map((h) => esColumnaSensible(h));
  const columnasOmitidas = encabezado.filter((_, j) => sensibles[j]);
  const ejemploAntes = crudas.map((f) => f.map((c, j) => (sensibles[j] ? MASCARA : c)));
  const ejemploDespues = crudas.map((f) => encabezado.map((_, j) => (sensibles[j] ? MASCARA : limpiarCelda(f[j] ?? "", tipos[j]))));
  const sinSensibles = (f: string[]) => f.filter((_, j) => !sensibles[j]);
  const ocultarEjemplos = (d: typeof res.antes) => ({
    ...d,
    columnasPerfil: d.columnasPerfil.map((p, j) => (sensibles[j] ? { ...p, ejemplosProblema: p.ejemplosProblema.map(() => MASCARA) } : p)),
  });
  marca(
    "Privacidad",
    columnasOmitidas.length
      ? `Se omiten ${columnasOmitidas.length} columnas con datos personales (${columnasOmitidas.join(", ")}): "•••" en el ejemplo y fuera del CSV`
      : "No encontré columnas con datos personales",
  );

  const csvLimpio = Papa.unparse([sinSensibles(res.encabezado), ...res.filasLimpias.slice(0, 5000).map(sinSensibles)]);
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

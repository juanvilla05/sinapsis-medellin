/**
 * Motor de calidad y limpieza de la Agencia Alpujarra.
 * Funciona igual en el servidor (limpieza en vivo) y en el pipeline programado.
 * Recibe una tabla (encabezado + filas de texto) y devuelve el diagnóstico,
 * la tabla limpia y la bitácora de cada cambio aplicado.
 */

export type TipoColumna = "numero" | "fecha" | "texto" | "vacia";

export interface PerfilColumna {
  nombre: string;
  tipo: TipoColumna;
  vacios: number; // celdas vacías o con marcadores tipo "Sin dato"
  pctVacios: number;
  distintos: number;
  conCodificacionRota: number; // ej. "Bel\xE9n", "Ã±", "�"
  conCaracteresOcultos: number; // \r, \t, espacios dobles o al borde
  conComaDecimal: number; // "6,2669" en columnas numéricas
  fechaMin?: string;
  fechaMax?: string;
  ejemplosProblema: string[];
}

export interface Diagnostico {
  filas: number;
  columnas: number;
  filasVacias: number;
  filasDuplicadas: number;
  celdasVacias: number;
  pctCeldasVacias: number;
  celdasCodificacionRota: number;
  celdasCaracteresOcultos: number;
  fechaMinGlobal?: string;
  fechaMaxGlobal?: string;
  /** Fecha más reciente del dato (excluye columnas técnicas como fecha de ingestión o de carga). */
  fechaDatoMax?: string;
  columnaFechaDato?: string;
  columnasPerfil: PerfilColumna[];
  puntaje: number; // 0–100, mayor es mejor
}

export interface CambioLimpieza {
  regla: string;
  descripcion: string;
  afectadas: number;
}

export interface ResultadoLimpieza {
  antes: Diagnostico;
  despues: Diagnostico;
  cambios: CambioLimpieza[];
  encabezado: string[];
  filasLimpias: string[][];
}

/** Valores que en MEData significan "no hay dato". */
const MARCADORES_VACIO = new Set([
  "",
  "sin dato",
  "sin inf",
  "sin informacion",
  "sin información",
  "no georef",
  "nan",
  "null",
  "none",
  "n/a",
  "na",
  "-",
  "#n/a",
  "no reporta",
  "no reportado",
  "-9999",
]);

const RE_ESCAPE_HEX = /\\x([0-9A-Fa-f]{2})/g; // texto literal "\xF1"
const RE_MOJIBAKE = /Ã[\x80-\xBF¡-¿]|Â[\x80-\xBF¡-¿]|�|\\x[0-9A-Fa-f]{2}/;
const RE_OCULTOS = /[\r\n\t ]|^\s|\s$| {2,}/;
const RE_NUMERO = /^-?\d+([.,]\d+)?$/;
const RE_COMA_DECIMAL = /^-?\d+,\d+$/;
const RE_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const RE_FECHA_DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;

export function esVacio(v: string | undefined | null): boolean {
  if (v === undefined || v === null) return true;
  return MARCADORES_VACIO.has(v.trim().toLowerCase());
}

/** Convierte una fecha de MEData (ISO o DD/MM/AAAA) a AAAA-MM-DD, o null. */
export function normalizarFecha(v: string): string | null {
  const s = v.trim();
  let m = RE_FECHA_ISO.exec(s);
  if (m) {
    const [, a, mes, d] = m;
    if (+mes >= 1 && +mes <= 12 && +d >= 1 && +d <= 31) return `${a}-${mes}-${d}`;
    return null;
  }
  m = RE_FECHA_DMY.exec(s);
  if (m) {
    const [, d, mes, a] = m;
    if (+mes >= 1 && +mes <= 12 && +d >= 1 && +d <= 31)
      return `${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** Repara texto mal codificado: escapes literales "\xF1" y UTF-8 leído como Latin-1 ("Ã±"). */
export function repararCodificacion(v: string): string {
  let s = v.replace(RE_ESCAPE_HEX, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  if (/Ã|Â/.test(s)) {
    try {
      const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
      const reparado = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      s = reparado;
    } catch {
      /* no era mojibake recuperable */
    }
  }
  return s;
}

export function limpiarOcultos(v: string): string {
  return v.replace(/[\r\n\t]/g, "").replace(/ /g, " ").replace(/ {2,}/g, " ").trim();
}

function inferirTipo(valores: string[]): TipoColumna {
  const llenos = valores.filter((v) => !esVacio(v));
  if (llenos.length === 0) return "vacia";
  const muestra = llenos.slice(0, 500);
  const fechas = muestra.filter((v) => normalizarFecha(v) !== null).length;
  if (fechas / muestra.length > 0.8) return "fecha";
  const nums = muestra.filter((v) => RE_NUMERO.test(limpiarOcultos(v))).length;
  if (nums / muestra.length > 0.9) return "numero";
  return "texto";
}

export function diagnosticar(encabezado: string[], filas: string[][]): Diagnostico {
  const nCol = encabezado.length;
  let filasVacias = 0;
  const vistas = new Set<string>();
  let duplicadas = 0;
  for (const f of filas) {
    if (f.every((c) => esVacio(c))) {
      filasVacias++;
      continue;
    }
    const clave = f.join("\u0001");
    if (vistas.has(clave)) duplicadas++;
    else vistas.add(clave);
  }

  const perfiles: PerfilColumna[] = [];
  let celdasVacias = 0,
    rotas = 0,
    ocultos = 0;
  let fMin: string | undefined, fMax: string | undefined;

  for (let j = 0; j < nCol; j++) {
    const col = filas.map((f) => f[j] ?? "");
    const tipo = inferirTipo(col);
    const distintos = new Set<string>();
    let vacios = 0,
      cRota = 0,
      cOculto = 0,
      cComa = 0;
    let min: string | undefined, max: string | undefined;
    const ejemplos = new Set<string>();
    for (const v of col) {
      if (esVacio(v)) {
        vacios++;
        continue;
      }
      distintos.add(v);
      if (RE_MOJIBAKE.test(v)) {
        cRota++;
        if (ejemplos.size < 3) ejemplos.add(v);
      }
      if (RE_OCULTOS.test(v)) {
        cOculto++;
        if (ejemplos.size < 3) ejemplos.add(JSON.stringify(v));
      }
      if (tipo === "numero" && RE_COMA_DECIMAL.test(v.trim())) cComa++;
      if (tipo === "fecha") {
        const f = normalizarFecha(v);
        if (f) {
          if (!min || f < min) min = f;
          if (!max || f > max) max = f;
        }
      }
    }
    celdasVacias += vacios;
    rotas += cRota;
    ocultos += cOculto;
    if (min && (!fMin || min < fMin)) fMin = min;
    if (max && (!fMax || max > fMax)) fMax = max;
    perfiles.push({
      nombre: encabezado[j],
      tipo,
      vacios,
      pctVacios: filas.length ? round((vacios / filas.length) * 100) : 0,
      distintos: distintos.size,
      conCodificacionRota: cRota,
      conCaracteresOcultos: cOculto,
      conComaDecimal: cComa,
      fechaMin: min,
      fechaMax: max,
      ejemplosProblema: [...ejemplos],
    });
  }

  const RE_TECNICA = /ingest|carga|actualiz|corte|modific|registro_sistema/i;
  const colDato = perfiles
    .filter((p) => p.tipo === "fecha" && p.fechaMax && !RE_TECNICA.test(p.nombre))
    .sort((a, b) => (b.fechaMax! > a.fechaMax! ? 1 : -1))[0];

  const totalCeldas = Math.max(1, filas.length * nCol);
  const pctVacias = (celdasVacias / totalCeldas) * 100;
  const pctFilasMalas = filas.length ? ((filasVacias + duplicadas) / filas.length) * 100 : 0;
  const pctRotas = ((rotas + ocultos) / totalCeldas) * 100;
  // Puntaje: castiga vacíos, filas vacías/duplicadas y celdas con problemas de formato.
  const puntaje = Math.max(
    0,
    Math.round(100 - pctVacias * 0.6 - pctFilasMalas * 0.8 - Math.min(30, pctRotas * 3)),
  );

  return {
    filas: filas.length,
    columnas: nCol,
    filasVacias,
    filasDuplicadas: duplicadas,
    celdasVacias,
    pctCeldasVacias: round(pctVacias),
    celdasCodificacionRota: rotas,
    celdasCaracteresOcultos: ocultos,
    fechaMinGlobal: fMin,
    fechaMaxGlobal: fMax,
    fechaDatoMax: colDato?.fechaMax,
    columnaFechaDato: colDato?.nombre,
    columnasPerfil: perfiles,
    puntaje,
  };
}

/** Aplica las reglas de limpieza y registra cuántas celdas o filas tocó cada una. */
export function limpiar(encabezado: string[], filas: string[][]): ResultadoLimpieza {
  const antes = diagnosticar(encabezado, filas);
  const tipos = antes.columnasPerfil.map((p) => p.tipo);
  const cont = { cod: 0, ocultos: 0, vacios: 0, coma: 0, fechas: 0, vaciasF: 0, dup: 0 };

  const encLimpio = encabezado.map((h) => limpiarOcultos(repararCodificacion(h)));
  const salida: string[][] = [];
  const vistas = new Set<string>();

  for (const fila of filas) {
    if (fila.every((c) => esVacio(c))) {
      cont.vaciasF++;
      continue;
    }
    const nueva = encabezado.map((_, j) => {
      let v = fila[j] ?? "";
      const r = repararCodificacion(v);
      if (r !== v) cont.cod++;
      v = r;
      const o = limpiarOcultos(v);
      if (o !== v) cont.ocultos++;
      v = o;
      if (esVacio(v)) {
        if (v !== "") cont.vacios++;
        return "";
      }
      if (tipos[j] === "numero" && RE_COMA_DECIMAL.test(v)) {
        cont.coma++;
        return v.replace(",", ".");
      }
      if (tipos[j] === "fecha") {
        const f = normalizarFecha(v);
        if (f && f !== v.slice(0, 10)) cont.fechas++;
        // conservamos la hora si existía; solo estandarizamos la parte de fecha
        if (f) return RE_FECHA_DMY.test(v) ? f + v.replace(RE_FECHA_DMY, "") : v;
      }
      return v;
    });
    const clave = nueva.join("\u0001");
    if (vistas.has(clave)) {
      cont.dup++;
      continue;
    }
    vistas.add(clave);
    salida.push(nueva);
  }

  const cambios: CambioLimpieza[] = [
    { regla: "filas-vacias", descripcion: "Filas completamente vacías eliminadas", afectadas: cont.vaciasF },
    { regla: "duplicados", descripcion: "Filas duplicadas exactas eliminadas", afectadas: cont.dup },
    { regla: "codificacion", descripcion: "Textos con codificación rota reparados (ej. Bel\\xE9n → Belén)", afectadas: cont.cod },
    { regla: "ocultos", descripcion: "Saltos de línea, tabulaciones y espacios sobrantes quitados", afectadas: cont.ocultos },
    { regla: "marcadores", descripcion: "Marcadores como \"Sin dato\", \"NaN\" o \"-9999\" convertidos en vacío real", afectadas: cont.vacios },
    { regla: "coma-decimal", descripcion: "Números con coma decimal convertidos a punto", afectadas: cont.coma },
    { regla: "fechas", descripcion: "Fechas DD/MM/AAAA estandarizadas a AAAA-MM-DD", afectadas: cont.fechas },
  ].filter((c) => c.afectadas > 0);

  return {
    antes,
    despues: diagnosticar(encLimpio, salida),
    cambios,
    encabezado: encLimpio,
    filasLimpias: salida,
  };
}

/** Limpia una sola celda con las mismas reglas de `limpiar` (para mostrar el antes y el después). */
export function limpiarCelda(v: string, tipo: TipoColumna): string {
  let s = limpiarOcultos(repararCodificacion(v ?? ""));
  if (esVacio(s)) return "";
  if (tipo === "numero" && RE_COMA_DECIMAL.test(s)) s = s.replace(",", ".");
  if (tipo === "fecha") {
    const f = normalizarFecha(s);
    if (f && RE_FECHA_DMY.test(s)) s = f + s.replace(RE_FECHA_DMY, "");
  }
  return s;
}

/** Decodifica bytes descargados: UTF-8 si es válido, si no Latin-1 (caso de varios CSV de MEData). */
export function decodificar(bytes: Uint8Array): { texto: string; codificacion: "utf-8" | "latin-1" } {
  try {
    return { texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes), codificacion: "utf-8" };
  } catch {
    return { texto: new TextDecoder("latin1").decode(bytes), codificacion: "latin-1" };
  }
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

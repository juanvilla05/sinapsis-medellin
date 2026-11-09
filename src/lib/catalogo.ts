/**
 * Lectura y auditoría del catálogo de MEData (portal DKAN de la Alcaldía de Medellín).
 * API pública: /api/1/metastore/schemas/dataset/items
 */

export const MEDATA_BASE = "https://medata.app.medellin.gov.co";
export const MEDATA_CATALOGO = `${MEDATA_BASE}/api/1/metastore/schemas/dataset/items?show-reference-ids=false`;

export type EstadoFrescura = "al-dia" | "atrasado" | "critico" | "sin-periodicidad" | "sin-fecha";

export interface Distribucion {
  formato: string;
  url: string;
  esDiccionario: boolean;
}

export interface ConjuntoAuditado {
  id: string;
  titulo: string;
  descripcion: string;
  publicador: string;
  temas: string[];
  palabrasClave: string[];
  periodicidad: string; // texto legible
  periodicidadDias: number | null;
  modificadoOriginal: string; // tal como viene en el catálogo
  modificado: string | null; // AAAA-MM-DD
  formatoFechaIrregular: boolean; // DD-MM-AAAA en vez de ISO 8601
  diasSinActualizar: number | null;
  vecesAtraso: number | null; // días sin actualizar / periodicidad
  estado: EstadoFrescura;
  distribuciones: Distribucion[];
  csvUrl: string | null;
  tieneDiccionario: boolean;
  soloTablero: boolean;
  problemasMetadato: string[];
}

const PERIODOS: Record<string, [number, string]> = {
  "R/P1D": [1, "Diaria"],
  "R/P1W": [7, "Semanal"],
  "R/P1M": [31, "Mensual"],
  "R/P2M": [62, "Bimestral"],
  "R/P3M": [92, "Trimestral"],
  "R/P4M": [123, "Cuatrimestral"],
  "R/P6M": [183, "Semestral"],
  "R/P1Y": [366, "Anual"],
  "R/P2Y": [731, "Bienal"],
  "R/P4Y": [1461, "Cada 4 años"],
  "R/P10Y": [3653, "Cada 10 años"],
  "R/PT1S": [0, "Continua"],
  irregular: [0, "Irregular"],
};

// Tipos mínimos del JSON del catálogo DKAN (solo lo que usamos)
interface Ref<T> {
  identifier?: string;
  data?: T;
}
interface ItemDKAN {
  identifier: string;
  title: string;
  description?: string;
  modified?: string;
  accrualPeriodicity?: string;
  publisher?: Ref<{ name?: string }> & { name?: string };
  theme?: (Ref<string> | string)[];
  keyword?: (Ref<string> | string)[];
  distribution?: (Ref<{ format?: string; downloadURL?: string; accessURL?: string; title?: string }> & {
    format?: string;
    downloadURL?: string;
  })[];
}

function texto<T>(x: Ref<T> | T): T | undefined {
  if (x && typeof x === "object" && "data" in (x as object)) return (x as Ref<T>).data;
  return x as T;
}

/** "10-08-2021" → "2021-08-10"; "2023-08-24T..." → "2023-08-24" */
export function parsearModificado(s: string | undefined): { fecha: string | null; irregular: boolean } {
  if (!s) return { fecha: null, irregular: false };
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return { fecha: `${iso[1]}-${iso[2]}-${iso[3]}`, irregular: false };
  const dmy = /^(\d{2})-(\d{2})-(\d{4})/.exec(s);
  if (dmy) return { fecha: `${dmy[3]}-${dmy[2]}-${dmy[1]}`, irregular: true };
  return { fecha: null, irregular: true };
}

function diasEntre(a: string, hoy: Date): number {
  const d = new Date(a + "T00:00:00-05:00");
  return Math.floor((hoy.getTime() - d.getTime()) / 86_400_000);
}

export function auditarItem(it: ItemDKAN, hoy: Date): ConjuntoAuditado {
  const pubRaw = it.publisher ? texto(it.publisher) : undefined;
  const publicador = (pubRaw?.name ?? it.publisher?.name ?? "Sin publicador").trim();
  const temas = (it.theme ?? []).map((t) => String(texto(t) ?? "")).filter(Boolean);
  const palabrasClave = (it.keyword ?? []).map((t) => String(texto(t) ?? "")).filter(Boolean);

  const distribuciones: Distribucion[] = (it.distribution ?? []).map((d) => {
    const dd = texto(d) ?? d;
    const url = (dd.downloadURL || (dd as { accessURL?: string }).accessURL || "").replace(/^http:/, "https:");
    const formato = (dd.format ?? "").toLowerCase();
    // En MEData los JSON publicados son esquemas de tabla (Frictionless "fields"): el diccionario de datos.
    const esDiccionario = formato === "json" || /diccionario|modelo_unificado|dictionary/i.test(url);
    return { formato, url, esDiccionario };
  });
  const csv = distribuciones.find((d) => d.formato === "csv" && !d.esDiccionario);
  const soloTablero = distribuciones.length > 0 && distribuciones.every((d) => d.formato === "tablero");

  const per = it.accrualPeriodicity ?? "";
  const [perDias, perTexto] = PERIODOS[per] ?? [null, per || "No declarada"];
  const { fecha, irregular } = parsearModificado(it.modified);
  const dias = fecha ? diasEntre(fecha, hoy) : null;

  let estado: EstadoFrescura;
  let veces: number | null = null;
  if (!fecha) estado = "sin-fecha";
  else if (!perDias) estado = "sin-periodicidad";
  else {
    veces = Math.round(((dias ?? 0) / perDias) * 10) / 10;
    estado = veces <= 1.5 ? "al-dia" : veces <= 3 ? "atrasado" : "critico";
  }

  const problemas: string[] = [];
  if (irregular) problemas.push("Fecha de modificación en formato DD-MM-AAAA (no ISO 8601)");
  if (!perDias) problemas.push("Sin periodicidad de actualización comparable");
  if (!csv && !soloTablero) problemas.push("Sin archivo CSV descargable");
  if (soloTablero) problemas.push("Solo publica un tablero: no hay datos descargables");
  if (!distribuciones.some((d) => d.esDiccionario)) problemas.push("Sin diccionario de datos");
  if (!it.description || it.description.trim().length < 40) problemas.push("Descripción muy corta o ausente");
  if (palabrasClave.length === 0) problemas.push("Sin palabras clave");

  return {
    id: it.identifier,
    titulo: it.title?.trim() ?? it.identifier,
    descripcion: it.description?.trim() ?? "",
    publicador,
    temas,
    palabrasClave,
    periodicidad: perTexto,
    periodicidadDias: perDias || null,
    modificadoOriginal: it.modified ?? "",
    modificado: fecha,
    formatoFechaIrregular: irregular,
    diasSinActualizar: dias,
    vecesAtraso: veces,
    estado,
    distribuciones,
    csvUrl: csv?.url ?? null,
    tieneDiccionario: distribuciones.some((d) => d.esDiccionario),
    soloTablero,
    problemasMetadato: problemas,
  };
}

export interface ResumenCatalogo {
  generado: string;
  totalConjuntos: number;
  porEstado: Record<EstadoFrescura, number>;
  pctAtrasados: number; // atrasado + crítico sobre los evaluables
  evaluables: number;
  fechasIrregulares: number;
  sinDiccionario: number;
  soloTablero: number;
  porPublicador: { publicador: string; total: number; atrasados: number; criticos: number; pct: number }[];
  porTema: { tema: string; total: number; atrasados: number }[];
}

export function resumir(conjuntos: ConjuntoAuditado[], hoy: Date): ResumenCatalogo {
  const porEstado: Record<EstadoFrescura, number> = {
    "al-dia": 0,
    atrasado: 0,
    critico: 0,
    "sin-periodicidad": 0,
    "sin-fecha": 0,
  };
  const pub = new Map<string, { total: number; atrasados: number; criticos: number }>();
  const tema = new Map<string, { total: number; atrasados: number }>();
  for (const c of conjuntos) {
    porEstado[c.estado]++;
    const atras = c.estado === "atrasado" || c.estado === "critico";
    const p = pub.get(c.publicador) ?? { total: 0, atrasados: 0, criticos: 0 };
    p.total++;
    if (atras) p.atrasados++;
    if (c.estado === "critico") p.criticos++;
    pub.set(c.publicador, p);
    for (const t of c.temas.length ? c.temas : ["Sin tema"]) {
      const x = tema.get(t) ?? { total: 0, atrasados: 0 };
      x.total++;
      if (atras) x.atrasados++;
      tema.set(t, x);
    }
  }
  const evaluables = porEstado["al-dia"] + porEstado.atrasado + porEstado.critico;
  return {
    generado: hoy.toISOString(),
    totalConjuntos: conjuntos.length,
    porEstado,
    evaluables,
    pctAtrasados: evaluables ? Math.round(((porEstado.atrasado + porEstado.critico) / evaluables) * 1000) / 10 : 0,
    fechasIrregulares: conjuntos.filter((c) => c.formatoFechaIrregular).length,
    sinDiccionario: conjuntos.filter((c) => !c.tieneDiccionario).length,
    soloTablero: conjuntos.filter((c) => c.soloTablero).length,
    porPublicador: [...pub.entries()]
      .map(([publicador, v]) => ({ publicador, ...v, pct: Math.round((v.atrasados / v.total) * 100) }))
      .sort((a, b) => b.total - a.total),
    porTema: [...tema.entries()].map(([t, v]) => ({ tema: t, ...v })).sort((a, b) => b.total - a.total),
  };
}

/** Descarga el catálogo completo en vivo desde MEData. */
export async function descargarCatalogo(): Promise<ItemDKAN[]> {
  const r = await fetch(MEDATA_CATALOGO, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`MEData respondió ${r.status}`);
  return (await r.json()) as ItemDKAN[];
}

export async function auditarCatalogo(hoy = new Date()) {
  const items = await descargarCatalogo();
  const conjuntos = items.map((it) => auditarItem(it, hoy));
  return { conjuntos, resumen: resumir(conjuntos, hoy) };
}

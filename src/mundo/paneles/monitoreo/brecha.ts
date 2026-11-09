import { miles } from "../../areas";

/**
 * Lógica pura de la pestaña Brecha: fusiona las series y redacta el texto a partir de los datos.
 * Los años ancla salen de las series (último año de MEData, máximo y último año de la Policía), nunca escritos a mano.
 */

export interface FilaBrecha {
  anio: number;
  medata: number | null;
  policia: number | null;
  /** policia − medata cuando ambos existen */
  diferencia: number | null;
}

export interface EntradaBrecha {
  medata: { serie: { a: number; n: number | null }[]; hasta: string | null } | null;
  policia: { serie: { anio: number; victimas: number | null }[]; corte: string | null } | null;
}

export interface ResultadoBrecha {
  filas: FilaBrecha[];
  maximo: number;
  ultimoAnioMedata: number | null;
  /** años que el texto menciona de la Policía, en orden */
  anclasPolicia: number[];
  texto: string;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2021-09-30" → "septiembre de 2021"; "2026-09-01T15:24:46-05:00" → "1 de septiembre de 2026" si se pide día. */
export function mesDe(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${mes} de ${m[1]}` : null;
}

export function fechaDiaMesAnio(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function construirBrecha(e: EntradaBrecha): ResultadoBrecha {
  const porAnio = new Map<number, FilaBrecha>();
  const fila = (anio: number) => {
    const f = porAnio.get(anio) ?? { anio, medata: null, policia: null, diferencia: null };
    porAnio.set(anio, f);
    return f;
  };
  for (const s of e.medata?.serie ?? []) fila(s.a).medata = s.n;
  for (const s of e.policia?.serie ?? []) fila(s.anio).policia = s.victimas;
  const filas = [...porAnio.values()].sort((a, b) => a.anio - b.anio);
  let maximo = 0;
  for (const f of filas) {
    if (f.medata !== null && f.policia !== null) f.diferencia = f.policia - f.medata;
    maximo = Math.max(maximo, f.medata ?? 0, f.policia ?? 0);
  }

  const conMedata = filas.filter((f) => f.medata !== null);
  const ultimoAnioMedata = conMedata.length ? conMedata[conMedata.length - 1]!.anio : null;
  const conPolicia = filas.filter((f) => f.policia !== null);

  const anclas: number[] = [];
  if (conPolicia.length) {
    // 1) el último año con dato de MEData (si la Policía también lo tiene) → de ahí arranca la brecha
    if (ultimoAnioMedata !== null && conPolicia.some((f) => f.anio === ultimoAnioMedata)) anclas.push(ultimoAnioMedata);
    // 2) el año de máximo de la Policía posterior a ese
    const posteriores = conPolicia.filter((f) => ultimoAnioMedata === null || f.anio > ultimoAnioMedata);
    const maxPolicia = posteriores.reduce<FilaBrecha | null>((m, f) => (m === null || (f.policia ?? 0) > (m.policia ?? 0) ? f : m), null);
    if (maxPolicia) anclas.push(maxPolicia.anio);
    // 3) el último año de la serie (parcial)
    anclas.push(conPolicia[conPolicia.length - 1]!.anio);
  }
  const anclasPolicia = [...new Set(anclas)].sort((a, b) => a - b);

  const partes: string[] = [];
  if (ultimoAnioMedata !== null) {
    const ultima = conMedata[conMedata.length - 1]!;
    const mes = mesDe(e.medata?.hasta ?? null);
    partes.push(`MEData deja de publicar en ${ultimoAnioMedata} (${miles(ultima.medata ?? 0)} muertes${mes ? `, con datos hasta ${mes}` : ""})`);
  } else {
    partes.push("La serie de MEData no está disponible");
  }
  if (anclasPolicia.length) {
    const tramos = anclasPolicia.map((anio, i) => {
      const f = filas.find((x) => x.anio === anio)!;
      const parcial = i === anclasPolicia.length - 1 && anclasPolicia.length > 1 ? " (año en curso, parcial)" : "";
      return `${miles(f.policia ?? 0)} en ${anio}${parcial}`;
    });
    const corte = fechaDiaMesAnio(e.policia?.corte ?? null);
    partes.push(`la Policía reporta ${tramos.join(" → ")}${corte ? `, al corte ${corte}` : ""}`);
  } else {
    partes.push("la Policía no respondió");
  }
  return { filas, maximo, ultimoAnioMedata, anclasPolicia, texto: `${partes.join("; ")}.` };
}

/** Formatos de fecha y hora en hora de Colombia (UTC-5, sin horario de verano) para la Sala de Monitoreo. */
import { fechaColombia } from "../../areas";

const dos = (n: number) => n.toString().padStart(2, "0");

function enColombia(iso: string): Date | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - 5 * 3600_000);
}

/** "01:05" */
export function horaColombia(iso: string): string {
  const d = enColombia(iso);
  return d ? `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}` : "—";
}

/** "09-11 01:05" (día-mes hora) */
export function fechaCortaColombia(iso: string): string {
  const d = enColombia(iso);
  return d ? `${dos(d.getUTCDate())}-${dos(d.getUTCMonth() + 1)} ${horaColombia(iso)}` : "—";
}

/** "9 de noviembre de 2026, 01:05" */
export function fechaHoraColombia(iso: string): string {
  return enColombia(iso) ? `${fechaColombia(iso)}, ${horaColombia(iso)}` : "—";
}

/** URL o texto de licencia de la fuente → etiqueta corta; vacío o desconocido → "no declarada". */
export function textoLicencia(s: string | null | undefined): string {
  if (!s || /no declarada/i.test(s)) return "no declarada";
  if (/by-sa\/4\.0|Share Alike 4\.0|CC_40_BY_SA/i.test(s)) return "CC BY-SA 4.0";
  if (/by\/4\.0|Attribution 4\.0/i.test(s)) return "CC BY 4.0";
  return s;
}

/** Fecha de corte: "2021-09-30" → "30 de septiembre de 2021" sin desplazar la zona horaria; ISO con hora → hora de Colombia. */
export function fechaCorte(iso: string | null | undefined): string {
  if (!iso) return "sin dato";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fechaColombia(`${iso}T12:00:00Z`);
  return fechaHoraColombia(iso);
}

/** "hace 4 min", "hace 2 h", "hace 3 días" */
export function haceCuanto(minutos: number): string {
  if (minutos < 1) return "hace menos de 1 min";
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 48 * 60) return `hace ${Math.round(minutos / 60)} h`;
  return `hace ${Math.round(minutos / (24 * 60))} días`;
}

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

/** "hace 4 min", "hace 2 h", "hace 3 días" */
export function haceCuanto(minutos: number): string {
  if (minutos < 1) return "hace menos de 1 min";
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 48 * 60) return `hace ${Math.round(minutos / 60)} h`;
  return `hace ${Math.round(minutos / (24 * 60))} días`;
}

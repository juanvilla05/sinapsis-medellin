/** Despachos de la Agencia de datos (oficina 2D). */
export type IdArea = "reloj" | "lab" | "ventanilla" | "analista" | "monitoreo";

export interface AreaMundo {
  id: IdArea;
  num: string;
  nombre: string;
  rol: string;
  enConstruccion: boolean;
  /** ruta del panel ejecutivo 2D equivalente, si existe */
  ruta2d?: string;
  descripcion?: string;
  bloques?: string[];
}

export const AREAS_MUNDO: AreaMundo[] = [
  { id: "reloj", num: "01", nombre: "Reloj de Frescura", rol: "Relojero", enConstruccion: false, ruta2d: "/frescura" },
  { id: "lab", num: "02", nombre: "Laboratorio de Limpieza", rol: "Científica de datos", enConstruccion: false, ruta2d: "/laboratorio" },
  {
    id: "ventanilla",
    num: "03",
    nombre: "Ventanilla de Apertura",
    rol: "Funcionario de ventanilla",
    enConstruccion: true,
    descripcion:
      "Tarjetas de propuesta de mejora por conjunto: el campo, el problema, la cifra y la pregunta que permitiría responder.",
    bloques: ["Tarjeta de propuesta", "Tarjeta de propuesta", "Tarjeta de propuesta"],
  },
  {
    id: "analista",
    num: "04",
    nombre: "Analista IA",
    rol: "Analista",
    enConstruccion: false,
    ruta2d: "/analista",
    descripcion: "Chat en español. Cada respuesta trae la cifra con su conjunto, su campo y su fecha de corte.",
    bloques: ["Conversación", "Cifra + conjunto + campo + fecha de corte"],
  },
  {
    id: "monitoreo",
    num: "05",
    nombre: "Sala de Monitoreo",
    rol: "Operador",
    enConstruccion: false,
    descripcion:
      "Seguridad vial y seguridad para moverse por barrio, sobre el mapa de Medellín por comunas, con datos limpios.",
    bloques: ["Mapa por comunas", "Seguridad vial", "Moverse por barrio"],
  },
];

export const areaPorId = (id: string | null) => AREAS_MUNDO.find((a) => a.id === id) ?? null;

/* Formatos colombianos sin depender del ICU del servidor (en Vercel salía "92.6"). */
export function miles(n: number) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
export function decimal(n: number, d = 1) {
  return n.toFixed(d).replace(".", ",");
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "AAAA-MM-DD" sin hora: una fecha de calendario (así vienen las 433 fechas `modified` del catálogo). */
export const esFechaSoloDia = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso);

/** Fecha en hora de Colombia (UTC-5, sin horario de verano). Una fecha solo-día se muestra tal cual, sin desplazar. */
export function fechaColombia(iso: string) {
  if (esFechaSoloDia(iso)) {
    const [a, m, d] = iso.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
  }
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
const dos = (n: number) => String(n).padStart(2, "0");
/** "HH:MM" en hora de Colombia (UTC-5), para «última lectura HH:MM». */
export function horaColombia(iso: string) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}
/** "DD-MM HH:MM" en hora de Colombia, para «copia guardada del DD-MM HH:MM». */
export function fechaHoraCorta(iso: string) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return `${dos(d.getUTCDate())}-${dos(d.getUTCMonth() + 1)} ${horaColombia(iso)}`;
}

import type { Condicion, FuenteAgregado, Gravedad, HurtoComuna, IncidentesComuna, VictimasComuna } from "@/lib/monitoreo/esquemas";
import {
  aniosDisponibles,
  filtrarHurto,
  filtrarIncidentes,
  filtrarVictimas,
  matrizDiaHora,
  sumarPorComuna,
  type CeldaDiaHora,
  type FilaComuna,
  type ResumenComunas,
  type ValorComuna,
} from "@/lib/monitoreo/metricas";
import { miles } from "../../areas";

/**
 * Lógica pura de la pestaña Comunas: qué filas de qué tabla alimentan el mapa según la capa y los filtros,
 * y el texto didáctico que lo explica. Sin React ni `server-only`, para probarla con node:test.
 */

export type Capa = "incidentes" | "victimas" | "hurto";

/** Texto de una cifra por comuna: "<5" si todo lo que la compone está suprimido; marca † si incluye conteos suprimidos. */
export function textoValor(v: ValorComuna | undefined): { texto: string; marca: boolean } {
  if (!v || v.valor === null) return { texto: "—", marca: false };
  if (v.valor === 0 && v.incompleto) return { texto: "<5", marca: false };
  return { texto: miles(v.valor), marca: v.incompleto };
}
export type Franja = "todas" | "madrugada" | "manana" | "tarde" | "noche";
export type Medida = "n" | "heridos" | "muertos";

export const CAPAS: { clave: Capa; texto: string; unidad: string }[] = [
  { clave: "incidentes", texto: "Incidentes viales", unidad: "incidentes" },
  { clave: "victimas", texto: "Víctimas viales", unidad: "víctimas" },
  { clave: "hurto", texto: "Hurto a persona", unidad: "casos" },
];

export const FRANJAS: { clave: Franja; texto: string; horas: [number, number] }[] = [
  { clave: "todas", texto: "Todo el día", horas: [0, 23] },
  { clave: "madrugada", texto: "Madrugada 0–5", horas: [0, 5] },
  { clave: "manana", texto: "Mañana 6–11", horas: [6, 11] },
  { clave: "tarde", texto: "Tarde 12–17", horas: [12, 17] },
  { clave: "noche", texto: "Noche 18–23", horas: [18, 23] },
];

export const CONDICIONES_UI: { clave: Condicion | "todas"; texto: string }[] = [
  { clave: "todas", texto: "Todos los usuarios" },
  { clave: "peaton", texto: "Peatones" },
  { clave: "motociclista", texto: "Motociclistas" },
  { clave: "ciclista", texto: "Ciclistas" },
  { clave: "otro", texto: "Otros (pasajeros, conductores)" },
];

export const MEDIDAS_UI: { clave: Medida; texto: string }[] = [
  { clave: "n", texto: "Todas las víctimas" },
  { clave: "heridos", texto: "Heridas" },
  { clave: "muertos", texto: "Fallecidas" },
];

export interface Filtros {
  capa: Capa;
  anio: number | "todos";
  franja: Franja;
  gravedad: Gravedad | "todas";
  condicion: Condicion | "todas";
  medida: Medida;
  modalidad: string | "todas";
}

export const FILTROS_INICIALES: Filtros = {
  capa: "hurto",
  anio: "todos",
  franja: "todas",
  gravedad: "todas",
  condicion: "todas",
  medida: "n",
  modalidad: "todas",
};

export interface Tablas {
  incidentes: IncidentesComuna | null;
  victimas: VictimasComuna | null;
  hurto: HurtoComuna | null;
}

export interface VistaCapa {
  capa: Capa;
  resumen: ResumenComunas;
  fuente: FuenteAgregado;
  /** "Hurto a persona · Atraco · 2019" */
  titulo: string;
  /** unidad de la cifra ("casos", "víctimas", "incidentes") */
  unidad: string;
  /** "2003 → 2023" o el año elegido */
  periodo: string;
  /** qué se está viendo, en una frase, con sus límites */
  explicacion: string;
  /** advertencia cuando un filtro no aplica a esta capa o cambia la tabla de origen */
  nota: string | null;
  /** matriz día × hora de la ciudad (solo hurto) */
  diaHora: CeldaDiaHora[][] | null;
  anios: number[];
  modalidades: string[];
}

const enFranja = (h: number, franja: Franja) => {
  const f = FRANJAS.find((x) => x.clave === franja)!;
  return h >= f.horas[0] && h <= f.horas[1];
};

const textoAnio = (anio: number | "todos", desde: string | null, hasta: string | null) =>
  anio === "todos" ? `${desde?.slice(0, 4) ?? "?"} → ${hasta?.slice(0, 4) ?? "?"}` : String(anio);

/** Vista por comuna para la capa y los filtros dados; null si la tabla de esa capa no está disponible. */
export function construirVista(tablas: Tablas, f: Filtros): VistaCapa | null {
  if (f.capa === "incidentes") {
    const t = tablas.incidentes;
    if (!t) return null;
    const anios = aniosDisponibles(t.comunaAnioGravedad);
    const porHora = f.franja !== "todas";
    const resumen = porHora
      ? sumarPorComuna(t.comunaHora, (r) => enFranja(r.h, f.franja))
      : sumarPorComuna(filtrarIncidentes(t.comunaAnioGravedad, { anio: f.anio === "todos" ? undefined : f.anio, gravedad: f.gravedad === "todas" ? undefined : f.gravedad }));
    const franja = FRANJAS.find((x) => x.clave === f.franja)!;
    const titulo = porHora
      ? `Incidentes viales · ${franja.texto}`
      : `Incidentes viales${f.gravedad !== "todas" ? ` · ${f.gravedad.toLowerCase()}` : ""}${f.anio !== "todos" ? ` · ${f.anio}` : ""}`;
    const periodo = porHora ? textoAnio("todos", t.fuente.periodo.desde, t.fuente.periodo.hasta) : textoAnio(f.anio, t.fuente.periodo.desde, t.fuente.periodo.hasta);
    return {
      capa: "incidentes",
      resumen,
      fuente: t.fuente,
      titulo,
      unidad: "incidentes",
      periodo,
      explicacion: porHora
        ? `Incidentes viales reportados por comuna entre las ${franja.horas[0]}:00 y las ${franja.horas[1]}:59, sumando todo el período publicado.`
        : `Incidentes viales reportados por comuna${f.gravedad !== "todas" ? ` con gravedad "${f.gravedad}"` : ", de cualquier gravedad"}${f.anio !== "todos" ? ` durante ${f.anio}` : ", en todo el período publicado"}.`,
      nota: porHora ? "La tabla por hora de este conjunto no distingue año ni gravedad: con una franja activa, esos dos filtros no aplican." : null,
      diaHora: null,
      anios,
      modalidades: [],
    };
  }
  if (f.capa === "victimas") {
    const t = tablas.victimas;
    if (!t) return null;
    const anios = aniosDisponibles(t.comunaAnioCondicion);
    const filas: FilaComuna[] = filtrarVictimas(t.comunaAnioCondicion, {
      anio: f.anio === "todos" ? undefined : f.anio,
      condicion: f.condicion === "todas" ? undefined : f.condicion,
      gravedad: f.medida === "n" ? undefined : f.medida,
    });
    const resumen = sumarPorComuna(filas);
    const cond = CONDICIONES_UI.find((c) => c.clave === f.condicion)!;
    const med = MEDIDAS_UI.find((m) => m.clave === f.medida)!;
    return {
      capa: "victimas",
      resumen,
      fuente: t.fuente,
      titulo: `Víctimas viales${f.medida !== "n" ? ` · ${med.texto.toLowerCase()}` : ""}${f.condicion !== "todas" ? ` · ${cond.texto.toLowerCase()}` : ""}${f.anio !== "todos" ? ` · ${f.anio}` : ""}`,
      unidad: "víctimas",
      periodo: textoAnio(f.anio, t.fuente.periodo.desde, t.fuente.periodo.hasta),
      explicacion: `Personas ${f.medida === "heridos" ? "heridas" : f.medida === "muertos" ? "fallecidas" : "heridas o fallecidas"} en incidentes viales, por comuna del hecho${f.condicion !== "todas" ? `, siendo ${cond.texto.toLowerCase()}` : ""}${f.anio !== "todos" ? `, durante ${f.anio}` : ", en todo el período publicado"}.`,
      nota: f.franja !== "todas" ? "Este conjunto no se publica por hora: la franja horaria no aplica a las víctimas." : null,
      diaHora: null,
      anios,
      modalidades: [],
    };
  }
  const t = tablas.hurto;
  if (!t) return null;
  const anios = aniosDisponibles(t.comunaAnioModalidad);
  const modalidades = [...new Set(t.comunaAnioModalidad.map((r) => r.m))].sort((a, b) => a.localeCompare(b, "es"));
  const resumen = sumarPorComuna(filtrarHurto(t.comunaAnioModalidad, { anio: f.anio === "todos" ? undefined : f.anio, modalidad: f.modalidad === "todas" ? undefined : f.modalidad }));
  return {
    capa: "hurto",
    resumen,
    fuente: t.fuente,
    titulo: `Hurto a persona${f.modalidad !== "todas" ? ` · ${f.modalidad}` : ""}${f.anio !== "todos" ? ` · ${f.anio}` : ""}`,
    unidad: "casos",
    periodo: textoAnio(f.anio, t.fuente.periodo.desde, t.fuente.periodo.hasta),
    explicacion: `Casos de hurto a persona reportados por comuna${f.modalidad !== "todas" ? ` con modalidad "${f.modalidad}"` : ", de cualquier modalidad"}${f.anio !== "todos" ? ` durante ${f.anio}` : ", en todo el período publicado"}.`,
    nota: f.franja !== "todas" ? "La hora de los hurtos se publica para toda la ciudad (día × hora), no por comuna: la franja resalta el mapa de calor, no cambia el mapa." : null,
    diaHora: matrizDiaHora(t.diaSemanaHora),
    anios,
    modalidades,
  };
}

/** Total publicado de una vista alternativa (para los conteos de los chips). */
export function totalCon(tablas: Tablas, f: Filtros, cambio: Partial<Filtros>): number | null {
  const v = construirVista(tablas, { ...f, ...cambio });
  return v ? v.resumen.total : null;
}

/** Total de una franja horaria para la capa activa (incidentes por comuna×hora; hurto por día×hora de la ciudad). */
export function totalFranja(tablas: Tablas, capa: Capa, franja: Franja): number | null {
  if (capa === "incidentes") {
    const t = tablas.incidentes;
    if (!t) return null;
    return t.comunaHora.reduce((s, r) => (enFranja(r.h, franja) && r.n !== null ? s + r.n : s), 0);
  }
  if (capa === "hurto") {
    const t = tablas.hurto;
    if (!t) return null;
    return t.diaSemanaHora.reduce((s, r) => (enFranja(r.h, franja) && r.n !== null ? s + r.n : s), 0);
  }
  return null;
}

export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Horas [desde, hasta] de una franja. */
export const horasDeFranja = (franja: Franja): [number, number] => FRANJAS.find((x) => x.clave === franja)!.horas;

/**
 * Índice de Calidad del Aire (ICA) para PM2.5 — módulo puro, sin dependencias.
 *
 * Norma: Resolución 2254 de 2017 del Ministerio de Ambiente y Desarrollo Sostenible (Colombia),
 * "por la cual se adopta la norma de calidad del aire ambiente". Verificada sobre el PDF oficial
 * (hojas 8–9): Tabla No. 5 (descripción general, Art. 19), Tabla No. 6 "Puntos de corte del ICA"
 * (Art. 20) y la ecuación de interpolación lineal del Art. 21:
 *
 *   ICA = (I_alto − I_bajo) / (PC_alto − PC_bajo) × (C − PC_bajo) + I_bajo
 *
 * Puntos de corte de PM2.5 (24 h, µg/m³) tal como los publica la Tabla No. 6:
 *   0–12 Buena (0–50) · 13–37 Aceptable (51–100) · 38–55 Dañina a la salud de grupos sensibles (101–150)
 *   · 56–150 Dañina a la salud (151–200) · 151–250 Muy dañina a la salud (201–300) · 251–500 Peligrosa (301–500).
 * La tabla usa enteros; como la concentración se maneja con un decimal, el inicio de cada tramo se toma
 * como el fin del anterior + 0,1 (12,1 · 37,1 · 55,1 · 150,1 · 250,1), igual que hace la EPA con su tabla.
 * Así no quedan huecos (12,5 µg/m³ cae en "Aceptable") y los enteros de la norma dan el mismo resultado.
 *
 * Sobre SIATA: en las capas 602/603 del visor, `ICA_PM25_Valor` es la CONCENTRACIÓN de PM2.5 en µg/m³
 * (no el índice) e `ICA_PM25_Descripcion` es la categoría oficial que publica SIATA ("Buena", "Moderada"…).
 * SIATA etiqueta "Moderada" lo que la norma llama "Aceptable"; aquí se unifican en la clave `aceptable`.
 * El centinela `-9999` / `ND` significa "sin dato" y nunca se promedia.
 *
 * Tabla alternativa EPA (2024) solo para la Metodología: con su corte de 9,0 µg/m³, 10–12 µg/m³ darían
 * "Moderada" y contradirían la etiqueta oficial de SIATA ("Buena"); por eso la de referencia es la colombiana.
 */

export type ClaveCategoria = "buena" | "aceptable" | "danina-sensibles" | "danina" | "muy-danina" | "peligrosa" | "sin-dato";

export interface Tramo {
  cMin: number;
  cMax: number;
  iMin: number;
  iMax: number;
  clave: ClaveCategoria;
}

/** Resolución 2254/2017, Tabla No. 6, columna PM2.5 24 h. Coincide con las etiquetas que publica SIATA. */
export const TRAMOS_PM25_COLOMBIA: Tramo[] = [
  { cMin: 0, cMax: 12.0, iMin: 0, iMax: 50, clave: "buena" },
  { cMin: 12.1, cMax: 37.0, iMin: 51, iMax: 100, clave: "aceptable" },
  { cMin: 37.1, cMax: 55.0, iMin: 101, iMax: 150, clave: "danina-sensibles" },
  { cMin: 55.1, cMax: 150.0, iMin: 151, iMax: 200, clave: "danina" },
  { cMin: 150.1, cMax: 250.0, iMin: 201, iMax: 300, clave: "muy-danina" },
  { cMin: 250.1, cMax: 500.0, iMin: 301, iMax: 500, clave: "peligrosa" },
];

/** US EPA, revisión de febrero de 2024 del NAAQS de PM2.5. Solo como referencia en la Metodología. */
export const TRAMOS_PM25_EPA_2024: Tramo[] = [
  { cMin: 0, cMax: 9.0, iMin: 0, iMax: 50, clave: "buena" },
  { cMin: 9.1, cMax: 35.4, iMin: 51, iMax: 100, clave: "aceptable" },
  { cMin: 35.5, cMax: 55.4, iMin: 101, iMax: 150, clave: "danina-sensibles" },
  { cMin: 55.5, cMax: 125.4, iMin: 151, iMax: 200, clave: "danina" },
  { cMin: 125.5, cMax: 225.4, iMin: 201, iMax: 300, clave: "muy-danina" },
  { cMin: 225.5, cMax: 500.0, iMin: 301, iMax: 500, clave: "peligrosa" },
];

/** `-9999`, `ND`, negativos, NaN, null: la estación no tiene lectura válida. */
export function esCentinela(v: number | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  if (!Number.isFinite(v)) return true;
  return v < 0 || v <= -999;
}

/**
 * Índice numérico a partir de la concentración de PM2.5 (µg/m³, promedio 24 h).
 * Trunca a un decimal (como la norma de referencia), interpola dentro del tramo y redondea al entero.
 * Devuelve null ante centinelas; concentraciones por encima del último tramo se topan en 500.
 */
export function calcularICA(pm25: number | null | undefined, tramos: Tramo[] = TRAMOS_PM25_COLOMBIA): number | null {
  if (esCentinela(pm25)) return null;
  const c = Math.floor((pm25 as number) * 10 + 1e-9) / 10;
  const ultimo = tramos[tramos.length - 1]!;
  if (c > ultimo.cMax) return ultimo.iMax;
  // el redondeo a un decimal de la concentración garantiza que cae en algún tramo (o en el hueco 12,0–12,1 → el siguiente)
  const tramo = tramos.find((t) => c >= t.cMin && c <= t.cMax) ?? tramos.find((t) => c < t.cMin) ?? ultimo;
  const ica = ((tramo.iMax - tramo.iMin) / (tramo.cMax - tramo.cMin)) * (c - tramo.cMin) + tramo.iMin;
  return Math.round(ica);
}

export interface CategoriaICA {
  clave: ClaveCategoria;
  /** nombre de la Resolución 2254/2017 (Tabla No. 5) */
  texto: string;
  /** descripción corta para la interfaz, sin calificar territorios */
  corto: string;
  color: string;
  /** fondo y texto suaves para chips */
  fondo: string;
  tinta: string;
}

export const CATEGORIAS: Record<ClaveCategoria, CategoriaICA> = {
  buena: { clave: "buena", texto: "Buena", corto: "Buena", color: "#16A34A", fondo: "#F0FDF4", tinta: "#15803D" },
  aceptable: { clave: "aceptable", texto: "Aceptable", corto: "Aceptable", color: "#D97706", fondo: "#FFFBEB", tinta: "#B45309" },
  "danina-sensibles": {
    clave: "danina-sensibles",
    texto: "Dañina a la salud de grupos sensibles",
    corto: "Dañina (grupos sensibles)",
    color: "#DC2626",
    fondo: "#FEF2F2",
    tinta: "#B91C1C",
  },
  danina: { clave: "danina", texto: "Dañina a la salud", corto: "Dañina", color: "#DC2626", fondo: "#FEF2F2", tinta: "#B91C1C" },
  "muy-danina": {
    clave: "muy-danina",
    texto: "Muy dañina a la salud",
    corto: "Muy dañina",
    color: "#991B1B",
    fondo: "#FEF2F2",
    tinta: "#7F1D1D",
  },
  peligrosa: { clave: "peligrosa", texto: "Peligrosa", corto: "Peligrosa", color: "#7F1D1D", fondo: "#FEF2F2", tinta: "#7F1D1D" },
  "sin-dato": { clave: "sin-dato", texto: "Sin dato", corto: "Sin dato", color: "#64748B", fondo: "#F1F5F9", tinta: "#475569" },
};

/** Orden de severidad, de mejor a peor (sin dato al final). */
export const ORDEN_CATEGORIAS: ClaveCategoria[] = [
  "buena",
  "aceptable",
  "danina-sensibles",
  "danina",
  "muy-danina",
  "peligrosa",
  "sin-dato",
];

/** Categoría a partir del índice numérico (rangos de la Tabla No. 5). */
export function categoriaICA(ica: number | null | undefined, tramos: Tramo[] = TRAMOS_PM25_COLOMBIA): CategoriaICA {
  if (ica === null || ica === undefined || !Number.isFinite(ica) || ica < 0) return CATEGORIAS["sin-dato"];
  const tramo = tramos.find((t) => ica >= t.iMin && ica <= t.iMax) ?? tramos[tramos.length - 1]!;
  return CATEGORIAS[tramo.clave];
}

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Traduce la etiqueta oficial que publica SIATA (`ICA_PM25_Descripcion`) a la clave de categoría.
 * "Buena" → buena · "Moderada"/"Aceptable" → aceptable · "Dañina a la salud de grupos sensibles" → danina-sensibles
 * · "Dañina a la salud" → danina · "Muy dañina…" → muy-danina · "Peligrosa" → peligrosa · "ND" o desconocido → sin-dato.
 */
export function categoriaDesdeSiata(desc: string | null | undefined): ClaveCategoria {
  const d = sinTildes(desc ?? "");
  if (!d || d === "nd" || d.startsWith("sin dato")) return "sin-dato";
  if (d.startsWith("buena") || d.startsWith("bueno")) return "buena";
  if (d.startsWith("moderad") || d.startsWith("aceptable")) return "aceptable";
  if (d.startsWith("muy danin")) return "muy-danina";
  if (d.startsWith("danin")) return d.includes("sensible") ? "danina-sensibles" : "danina";
  if (d.startsWith("peligros")) return "peligrosa";
  return "sin-dato";
}

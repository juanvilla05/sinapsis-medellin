/**
 * Escala visual compartida por la tabla, el mapa SVG y la Medellín 3D: color secuencial azul
 * (#DBEAFE → #1E3A5F, nunca rojo/verde para no calificar territorios) y alturas de extrusión.
 * Son reglas de dibujo; las cifras siempre vienen de los agregados.
 */

export const COLOR_BAJO = "#DBEAFE";
export const COLOR_ALTO = "#1E3A5F";
export const COLOR_SIN_DATO = "#CBD5E1";
export const COLOR_NO_MEDELLIN = "#94A3B8";

const hexARgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbAHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

const BAJO = hexARgb(COLOR_BAJO);
const ALTO = hexARgb(COLOR_ALTO);

/** Color para una fracción 0–1 del máximo (interpolación lineal en sRGB). */
export function colorSecuencial(t: number): string {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return rgbAHex(BAJO[0] + (ALTO[0] - BAJO[0]) * k, BAJO[1] + (ALTO[1] - BAJO[1]) * k, BAJO[2] + (ALTO[2] - BAJO[2]) * k);
}

/** Color de una comuna según su valor; null → gris "sin dato". */
export function colorComuna(valor: number | null, maximo: number): string {
  if (valor === null) return COLOR_SIN_DATO;
  return colorSecuencial(maximo > 0 ? valor / maximo : 0);
}

/** Texto claro u oscuro legible sobre el color secuencial. */
export const tintaSobre = (t: number) => (t > 0.55 ? "#FFFFFF" : "#0F172A");

export const ALTURA_MIN_COMUNA = 0.3;
export const ALTURA_MAX_COMUNA = 8;

/** Altura de extrusión de una comuna (lineal con el valor), 0,3–8 unidades; sin dato → la mínima. */
export function alturaComuna(valor: number | null, maximo: number): number {
  if (valor === null || maximo <= 0) return ALTURA_MIN_COMUNA;
  return ALTURA_MIN_COMUNA + (ALTURA_MAX_COMUNA - ALTURA_MIN_COMUNA) * Math.min(1, valor / maximo);
}

export const ALTURA_MIN_CELDA = 0.25;
export const ALTURA_MAX_CELDA = 6;

/**
 * Altura de una columna de la rejilla de 250 m: proporcional a la raíz cuadrada del conteo, porque la celda
 * máxima (el Centro) multiplica por cientos a la mediana y una escala lineal aplanaría el resto de la ciudad.
 * La leyenda lo declara ("altura ∝ √n").
 */
export function alturaCelda(n: number, maximo: number): number {
  if (maximo <= 0 || n <= 0) return ALTURA_MIN_CELDA;
  return ALTURA_MIN_CELDA + (ALTURA_MAX_CELDA - ALTURA_MIN_CELDA) * Math.sqrt(Math.min(1, n / maximo));
}

/** Pasos de la leyenda (fracciones y colores) para pintarla igual en SVG y 3D. */
export const PASOS_LEYENDA = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, color: colorSecuencial(t) }));

/**
 * Proyección isométrica 2D (SVG puro, sin WebGL) para la oficina de la Agencia de datos.
 * El piso es una grilla (x, y) en unidades; z es la altura. x avanza hacia abajo a la derecha,
 * y hacia abajo a la izquierda.
 */

export const U = 26; // píxeles por unidad
const C = Math.cos(Math.PI / 6); // 0,866
const S = 0.5;

/** Ancho y fondo del piso de la oficina, en unidades. */
export const ANCHO = 28;
export const FONDO = 20;
export const ALTO_MURO = 3.6;

/** Desplazamiento para que todo quede en coordenadas positivas del viewBox. */
export const OX = FONDO * C * U + 24;
export const OY = ALTO_MURO * U + 30;

export const VIEWBOX_W = (ANCHO + FONDO) * C * U + 48;
export const VIEWBOX_H = (ANCHO + FONDO) * S * U + ALTO_MURO * U + 60;

/** Redondeo a una décima: el servidor y el navegador deben producir exactamente el mismo SVG. */
export const r1 = (n: number) => Math.round(n * 10) / 10;

export function p(x: number, y: number, z = 0): [number, number] {
  return [r1(OX + (x - y) * C * U), r1(OY + (x + y) * S * U - z * U)];
}

export function pts(lista: [number, number, number?][]): string {
  return lista
    .map(([x, y, z]) => p(x, y, z ?? 0))
    .map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`)
    .join(" ");
}

/** Rectángulo sobre el piso (o a la altura z). */
export function rect(x: number, y: number, w: number, d: number, z = 0): string {
  return pts([
    [x, y, z],
    [x + w, y, z],
    [x + w, y + d, z],
    [x, y + d, z],
  ]);
}

export interface Caja {
  arriba: string;
  izquierda: string; // cara que mira hacia y+ (frente izquierdo)
  derecha: string; // cara que mira hacia x+ (frente derecho)
}

/** Caja sólida: tapa y las dos caras visibles. */
export function caja(x: number, y: number, z: number, w: number, d: number, h: number): Caja {
  return {
    arriba: rect(x, y, w, d, z + h),
    izquierda: pts([
      [x, y + d, z],
      [x + w, y + d, z],
      [x + w, y + d, z + h],
      [x, y + d, z + h],
    ]),
    derecha: pts([
      [x + w, y, z],
      [x + w, y + d, z],
      [x + w, y + d, z + h],
      [x + w, y, z + h],
    ]),
  };
}

/**
 * Transformación SVG para escribir texto (o dibujar) "acostado" sobre el piso.
 * eje "x": el texto corre a lo largo de x; eje "y": a lo largo de y.
 */
export function sobrePiso(x: number, y: number, eje: "x" | "y" = "x", z = 0): string {
  const [tx, ty] = p(x, y, z);
  // eje "y": se lee hacia y decreciente (de frente hacia el fondo), que es como se lee de izquierda a derecha
  return eje === "x" ? `matrix(${C} ${S} ${-C} ${S} ${tx.toFixed(1)} ${ty.toFixed(1)})` : `matrix(${C} ${-S} ${C} ${S} ${tx.toFixed(1)} ${ty.toFixed(1)})`;
}

/** Transformación para dibujar sobre un plano vertical y = constante (corre a lo largo de x). */
export function sobreCaraX(x: number, y: number, z: number): string {
  const [tx, ty] = p(x, y, z);
  return `matrix(${C} ${S} 0 1 ${tx.toFixed(1)} ${ty.toFixed(1)})`;
}

/** Transformación para dibujar sobre el muro del fondo (plano y = 0, corre a lo largo de x). */
export function sobreMuroX(x: number, z: number): string {
  return sobreCaraX(x, 0, z);
}

/** Transformación para dibujar sobre el muro izquierdo (plano x = 0); se lee desde y hacia el fondo (y decreciente). */
export function sobreMuroY(y: number, z: number): string {
  const [tx, ty] = p(0, y, z);
  return `matrix(${C} ${-S} 0 1 ${tx.toFixed(1)} ${ty.toFixed(1)})`;
}

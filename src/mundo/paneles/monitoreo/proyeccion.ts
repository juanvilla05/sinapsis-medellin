/**
 * Proyección equirectangular centrada en la caja de las comunas, compartida por el mapa SVG y la Medellín 3D
 * para que ambos dibujen exactamente la misma geometría.
 *
 *   x = (lng − lng0) · cos(lat0) · 111 320 m · escala      (este positivo)
 *   y = (lat − lat0) · 111 320 m · escala                   (norte positivo; el SVG usa −y, el 3D lo pone en −z)
 *
 * La escala por defecto (1 unidad = 400 m) deja la ciudad en ≈ 68 × 59 unidades, de modo que las alturas de
 * extrusión del contrato (0,3–8 unidades) se vean en una cámara isométrica. Es un factor de dibujo, no un dato.
 */

export interface Bbox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface Proyeccion {
  bbox: Bbox;
  lng0: number;
  lat0: number;
  escala: number;
  /** ancho y alto de la caja en unidades proyectadas */
  ancho: number;
  alto: number;
  proyectar(lng: number, lat: number): { x: number; y: number };
}

export const METROS_POR_GRADO = 111_320;
export const ESCALA_POR_DEFECTO = 1 / 400;

export type Anillo = number[][];
export type Geometria = { type: "Polygon"; coordinates: Anillo[] } | { type: "MultiPolygon"; coordinates: Anillo[][] };

/** Polígonos de una geometría como lista de [exterior, ...huecos]. */
export function poligonosDe(geometria: Geometria): Anillo[][] {
  return geometria.type === "Polygon" ? [geometria.coordinates] : geometria.coordinates;
}

export function bboxDeGeometrias(geometrias: readonly Geometria[]): Bbox {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const g of geometrias) {
    for (const poligono of poligonosDe(g)) {
      for (const anillo of poligono) {
        for (const [lng, lat] of anillo) {
          if (lng === undefined || lat === undefined) continue;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }
  if (!Number.isFinite(minLng)) return { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 };
  return { minLng, maxLng, minLat, maxLat };
}

export function crearProyeccion(bbox: Bbox, escala = ESCALA_POR_DEFECTO): Proyeccion {
  const lng0 = (bbox.minLng + bbox.maxLng) / 2;
  const lat0 = (bbox.minLat + bbox.maxLat) / 2;
  const kx = Math.cos((lat0 * Math.PI) / 180) * METROS_POR_GRADO * escala;
  const ky = METROS_POR_GRADO * escala;
  return {
    bbox,
    lng0,
    lat0,
    escala,
    ancho: (bbox.maxLng - bbox.minLng) * kx,
    alto: (bbox.maxLat - bbox.minLat) * ky,
    proyectar: (lng, lat) => ({ x: (lng - lng0) * kx, y: (lat - lat0) * ky }),
  };
}

/** Ruta SVG (`d`) de una geometría; el eje y va hacia abajo. */
export function rutaSvg(geometria: Geometria, p: Proyeccion, decimales = 2): string {
  const partes: string[] = [];
  for (const poligono of poligonosDe(geometria)) {
    for (const anillo of poligono) {
      anillo.forEach(([lng, lat], i) => {
        if (lng === undefined || lat === undefined) return;
        const { x, y } = p.proyectar(lng, lat);
        partes.push(`${i === 0 ? "M" : "L"}${x.toFixed(decimales)} ${(-y).toFixed(decimales)}`);
      });
      partes.push("Z");
    }
  }
  return partes.join("");
}

/** Centroide aproximado (promedio de vértices del anillo exterior más largo), para etiquetas. */
export function centroide(geometria: Geometria): { lng: number; lat: number } {
  let mejor: Anillo = [];
  for (const poligono of poligonosDe(geometria)) {
    const exterior = poligono[0] ?? [];
    if (exterior.length > mejor.length) mejor = exterior;
  }
  if (mejor.length === 0) return { lng: 0, lat: 0 };
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const [lng, lat] of mejor) {
    if (lng === undefined || lat === undefined) continue;
    sx += lng;
    sy += lat;
    n += 1;
  }
  return { lng: sx / n, lat: sy / n };
}

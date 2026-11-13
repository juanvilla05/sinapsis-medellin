import type { CamaraEnRuta, CamaraPulso } from "@/pulso/tipos";
import { densificar, haversine, type LatLng } from "./polilinea";

/** Una cámara cuenta para la ruta si está a esta distancia o menos del trazado (igual que los incidentes). */
export const RADIO_CAMARAS_M = 150;
const PASO_M = 50;
/** Margen en grados (~330 m) para descartar sin calcular distancias las cámaras lejanas. */
const MARGEN_GRADOS = 0.003;

/**
 * Cámaras de vía sobre un trayecto, en el orden en que se recorre. Si hay más de `maximo`, se reparten de inicio
 * a fin para que la tarjeta muestre el trayecto completo y no solo el arranque. No entran al puntaje.
 */
export function camarasEnRuta(puntos: LatLng[], camaras: CamaraPulso[], maximo = 3): CamaraEnRuta[] {
  const vias = camaras.filter((c) => c.tipo === "via" && c.fotos.length > 0);
  if (puntos.length < 2 || vias.length === 0 || maximo < 1) return [];
  const traza = densificar(puntos, PASO_M);
  const lats = traza.map((p) => p.lat);
  const lngs = traza.map((p) => p.lng);
  const caja = { s: Math.min(...lats) - MARGEN_GRADOS, n: Math.max(...lats) + MARGEN_GRADOS, o: Math.min(...lngs) - MARGEN_GRADOS, e: Math.max(...lngs) + MARGEN_GRADOS };

  const cerca: { camara: CamaraPulso; paso: number }[] = [];
  for (const camara of vias) {
    if (camara.lat < caja.s || camara.lat > caja.n || camara.lng < caja.o || camara.lng > caja.e) continue;
    let mejor = Infinity;
    let paso = -1;
    for (let k = 0; k < traza.length; k++) {
      const d = haversine(traza[k]!, camara);
      if (d < mejor) {
        mejor = d;
        paso = k;
      }
    }
    if (mejor <= RADIO_CAMARAS_M) cerca.push({ camara, paso });
  }
  cerca.sort((a, b) => a.paso - b.paso);

  const elegidas =
    cerca.length <= maximo
      ? cerca
      : maximo === 1
        ? [cerca[Math.floor(cerca.length / 2)]!]
        : Array.from({ length: maximo }, (_, k) => cerca[Math.round((k * (cerca.length - 1)) / (maximo - 1))]!);
  return elegidas.map(({ camara }) => ({ id: camara.id, nombre: camara.nombre, foto: camara.fotos[0]! }));
}

import "server-only";

/**
 * Geometría de rutas: decodificador del Encoded Polyline Algorithm Format de Google
 * (https://developers.google.com/maps/documentation/utilities/polylinealgorithm), distancia haversine,
 * muestreo uniforme y densificación. Porte de pulso-medellin/lib/maps/{polyline,scoring}.ts.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export function decodificarPolilinea(codificada: string): LatLng[] {
  const salida: LatLng[] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;
  const largo = codificada.length;
  while (indice < largo) {
    let resultado = 0;
    let corrimiento = 0;
    let b: number;
    do {
      b = codificada.charCodeAt(indice++) - 63;
      resultado |= (b & 0x1f) << corrimiento;
      corrimiento += 5;
    } while (b >= 0x20 && indice < largo);
    lat += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
    resultado = 0;
    corrimiento = 0;
    do {
      b = codificada.charCodeAt(indice++) - 63;
      resultado |= (b & 0x1f) << corrimiento;
      corrimiento += 5;
    } while (b >= 0x20 && indice < largo);
    lng += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
    salida.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return salida;
}

const RADIO_TIERRA_M = 6_371_000;

/** Distancia en metros sobre la esfera. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(x));
}

/** `objetivo` puntos repartidos uniformemente por índice (incluye primero y último). */
export function muestrear(puntos: LatLng[], objetivo = 40): LatLng[] {
  if (puntos.length <= objetivo) return puntos;
  const paso = (puntos.length - 1) / (objetivo - 1);
  return Array.from({ length: objetivo }, (_, i) => puntos[Math.round(i * paso)]!);
}

/**
 * Inserta puntos cada `pasoM` metros como máximo a lo largo de la polilínea (interpolación lineal).
 * Sirve para no saltarse celdas de la rejilla en tramos largos y rectos.
 */
export function densificar(puntos: LatLng[], pasoM = 50): LatLng[] {
  if (puntos.length < 2) return puntos;
  const salida: LatLng[] = [puntos[0]!];
  for (let k = 1; k < puntos.length; k++) {
    const a = puntos[k - 1]!;
    const b = puntos[k]!;
    const d = haversine(a, b);
    const tramos = Math.max(1, Math.ceil(d / pasoM));
    for (let t = 1; t <= tramos; t++) {
      const f = t / tramos;
      salida.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });
    }
  }
  return salida;
}

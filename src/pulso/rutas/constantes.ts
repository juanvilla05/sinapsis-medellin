/**
 * Constantes de las rutas inteligentes compartidas por servidor (src/lib/rutas) y cliente (panel y tarjeta del Analista).
 * Sin `server-only` ni "use client": solo etiquetas, colores y pesos. Ninguna cifra de datos vive aquí.
 */
import type { BandaRuta, RutaPulso } from "../tipos";

export type ModoRuta = Exclude<RutaPulso["modo"], "TRANSIT">;

export const MODOS_RUTA: [ModoRuta, ...ModoRuta[]] = ["DRIVE", "TWO_WHEELER", "BICYCLE", "WALK"];

export const NOMBRE_MODO: Record<ModoRuta, string> = {
  DRIVE: "Carro",
  TWO_WHEELER: "Moto",
  BICYCLE: "Bici",
  WALK: "A pie",
};

/** "en carro", "en moto"… para los textos. */
export const MODO_EN_FRASE: Record<ModoRuta, string> = {
  DRIVE: "en carro",
  TWO_WHEELER: "en moto",
  BICYCLE: "en bicicleta",
  WALK: "a pie",
};

/**
 * Banda de aire de una ruta según el ICA de su PM2.5 estimado (Resolución 2254 de 2017, src/lib/ica.ts).
 * "danina" agrupa todo lo que va de "Dañina a la salud de grupos sensibles" hacia arriba.
 * Colores pensados para dibujar sobre el mapa oscuro.
 */
export const BANDAS: Record<BandaRuta, { texto: string; color: string }> = {
  buena: { texto: "Aire bueno", color: "#34D399" },
  aceptable: { texto: "Aire aceptable", color: "#FBBF24" },
  danina: { texto: "Aire dañino", color: "#F87171" },
  "sin-dato": { texto: "Sin dato de aire", color: "#94A3B8" },
};

/**
 * Pesos del puntaje 0–100 (ver src/lib/rutas/puntuar.ts). Si un componente no tiene dato para ninguna
 * alternativa, su peso se reparte proporcionalmente entre los demás.
 */
export const PESOS_PUNTAJE = { aire: 0.45, siniestralidad: 0.35, tiempo: 0.2 } as const;

/** Valle de Aburrá (rectángulo amplio): Places se restringe aquí y /api/rutas rechaza puntos fuera. */
export const VALLE_ABURRA = { latMin: 6.0, latMax: 6.5, lngMin: -75.75, lngMax: -75.3 } as const;

export const dentroDelValle = (lat: number, lng: number) =>
  lat >= VALLE_ABURRA.latMin && lat <= VALLE_ABURRA.latMax && lng >= VALLE_ABURRA.lngMin && lng <= VALLE_ABURRA.lngMax;

/** Ejemplos del panel (texto que se resuelve con Places en el servidor). */
export const EJEMPLOS_RUTA: { origen: string; destino: string; corto: string }[] = [
  { origen: "La Alpujarra, Medellín", destino: "Parque Lleras, Medellín", corto: "La Alpujarra → Parque Lleras" },
  { origen: "Institución Universitaria ITM sede Robledo, Medellín", destino: "Parque Explora, Medellín", corto: "ITM Robledo → Parque Explora" },
  { origen: "Estadio Atanasio Girardot, Medellín", destino: "Plaza Botero, Medellín", corto: "Atanasio Girardot → Plaza Botero" },
];

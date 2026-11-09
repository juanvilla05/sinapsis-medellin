/**
 * Contratos compartidos de PULSO · Medellín en vivo (mapa 3D, rutas y PulsoBot).
 * Solo tipos: lo importan cliente y servidor. Ninguna cifra vive aquí.
 */

/** Capas de datos del mapa 3D. */
export type CapaPulso = "aire" | "incidentes" | "victimas" | "hurto" | "comunas";

export type BandaRuta = "buena" | "aceptable" | "danina" | "sin-dato";

/** Una alternativa de ruta ya puntuada con datos de SIATA y MEData (la geometría viene de Google Routes). */
export interface RutaPulso {
  id: string;
  /** "Ruta 1 · por la Avenida Regional" o similar */
  etiqueta: string;
  modo: "DRIVE" | "TWO_WHEELER" | "BICYCLE" | "WALK" | "TRANSIT";
  /** [lng, lat] en orden de recorrido */
  puntos: [number, number][];
  distanciaM: number;
  duracionS: number;
  /** PM2.5 estimado a lo largo de la ruta (µg/m³), ponderado por distancia inversa a estaciones SIATA válidas */
  pm25Estimado: number | null;
  banda: BandaRuta;
  /** incidentes viales históricos (MEData, celdas de 250 m con n ≥ 5) que toca la ruta */
  incidentesCercanos: number | null;
  /** 0–100, mayor es mejor; combina aire, siniestralidad y tiempo */
  puntaje: number;
  /** color de dibujo (#hex) según la banda */
  color: string;
  recomendada: boolean;
}

export interface PuntoNombrado {
  nombre: string;
  lat: number;
  lng: number;
}

/** Eventos del bus de PULSO (ver bus.ts). */
export type EventoPulso =
  | { tipo: "volar"; lat: number; lng: number; zoom?: number; inclinacion?: number; rumbo?: number }
  | { tipo: "comuna"; codigo: string | null }
  | { tipo: "estacion"; codigo: number | null }
  | { tipo: "rutas"; rutas: RutaPulso[]; origen: PuntoNombrado; destino: PuntoNombrado; elegida?: string }
  | { tipo: "elegir-ruta"; id: string }
  | { tipo: "limpiar-rutas" }
  | { tipo: "capa"; capa: CapaPulso; visible: boolean }
  | { tipo: "panel"; panel: "rutas" | "bot" | null }
  | { tipo: "preguntar"; texto: string }
  | { tipo: "recorrido"; activo: boolean };

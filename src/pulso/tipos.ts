/**
 * Contratos compartidos de PULSO · Medellín en vivo (mapa 3D, rutas y PulsoBot).
 * Solo tipos: lo importan cliente y servidor. Ninguna cifra vive aquí.
 */

/** Tema visual de PULSO: oscuro (centro de mando) o claro. */
export type TemaPulso = "oscuro" | "claro";

/** Capas de datos del mapa 3D. */
export type CapaPulso = "aire" | "camaras" | "incidentes" | "victimas" | "hurto" | "comunas";

/** Cómo se pinta el dato: columnas de 250 m, comunas coloreadas o una sola comuna aislada. */
export type VistaPulso = "puntos" | "comunas" | "una";

export type BandaRuta = "buena" | "aceptable" | "danina" | "sin-dato";

/** De dónde sale la foto: circuito cerrado de la Secretaría de Movilidad (SIMM) o cámaras de SIATA. */
export type FuenteCamara = "simm" | "siata";
/** Qué mira la cámara: una vía, el río o una quebrada, o la ciudad y el cielo desde lo alto. */
export type TipoCamara = "via" | "agua" | "panoramica";

/** Una cámara pública con su última foto. PULSO no guarda ninguna imagen: `fotos` apunta a la fuente. */
export interface CamaraPulso {
  /** estable entre consultas: "simm-27", "siata-dep_bulerias" */
  id: string;
  fuente: FuenteCamara;
  tipo: TipoCamara;
  nombre: string;
  direccion: string | null;
  lat: number;
  lng: number;
  /** URL https de la última foto de cada vista del punto (casi siempre una) */
  fotos: string[];
}

/** Cámara de vía a menos de 150 m de una ruta, en el orden en que se recorre. */
export interface CamaraEnRuta {
  id: string;
  nombre: string;
  foto: string;
}

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
  /** cámaras de vía sobre el trayecto (máximo 3, repartidas de inicio a fin); no entran al puntaje */
  camaras?: CamaraEnRuta[];
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
  | { tipo: "camara"; id: string | null }
  | { tipo: "rutas"; rutas: RutaPulso[]; origen: PuntoNombrado; destino: PuntoNombrado; elegida?: string }
  | { tipo: "elegir-ruta"; id: string }
  | { tipo: "limpiar-rutas" }
  | { tipo: "capa"; capa: CapaPulso; visible: boolean }
  | { tipo: "vista"; vista: VistaPulso }
  | { tipo: "panel"; panel: "rutas" | "bot" | null }
  | { tipo: "preguntar"; texto: string }
  | { tipo: "recorrido"; activo: boolean }
  | { tipo: "vista-inicial" }
  | { tipo: "tema"; tema: TemaPulso }
  | { tipo: "navegar"; ruta: string };

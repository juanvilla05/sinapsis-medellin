import type { StyleSpecification } from "maplibre-gl";
import type { TemaPulso } from "../tipos";

/**
 * Estilos de PULSO (nocturno y claro) a partir de OpenFreeMap "liberty" (sin clave).
 * OpenFreeMap publica un estilo "dark", pero no trae edificios 3D; por eso se parte de "liberty"
 * (que sí trae la capa `building-3d`) y se recolorea en el navegador antes de crear el mapa.
 * El mapa base es solo cartografía: ninguna cifra de PULSO sale de aquí.
 */
export const URL_ESTILO_BASE = "https://tiles.openfreemap.org/styles/liberty";

export const NOCHE = "#0B1220";

/** Colores del mapa base por tema. Solo cartografía: ninguna cifra sale de aquí. */
interface PaletaBase {
  fondo: string;
  rasterOpacidad: number;
  rasterBrilloMax: number;
  agua: string;
  edificio: string;
  residencial: string;
  relleno: string;
  rellenoOpacidad: number;
  cauce: string;
  limite: string;
  vias: { borde: string; autopista: string; principal: string; secundaria: string; riel: string; sendero: string; resto: string; opacidad: number };
  extrusion: [string, string, string, string];
  extrusionOpacidad: number;
  texto: string;
  textoVia: string;
  cielo: { cielo: string; horizonte: string; niebla: string };
  luz: { color: string; intensidad: number };
}

const PALETAS: Record<TemaPulso, PaletaBase> = {
  oscuro: {
    fondo: NOCHE,
    rasterOpacidad: 0.08,
    rasterBrilloMax: 0.3,
    agua: "#0C2A4D",
    edificio: "#14213A",
    residencial: "#0F1A2C",
    relleno: "#0F1C2E",
    rellenoOpacidad: 0.45,
    cauce: "#1B4F86",
    limite: "#33476A",
    vias: { borde: "#0E1828", autopista: "#3E6FB0", principal: "#2F5689", secundaria: "#24426B", riel: "#263854", sendero: "#1A2A44", resto: "#1B3050", opacidad: 0.58 },
    extrusion: ["#17253F", "#203557", "#2C4B78", "#3B6296"],
    extrusionOpacidad: 0.88,
    texto: "#9FB3CF",
    textoVia: "#5F7697",
    cielo: { cielo: "#0B1220", horizonte: "#16294A", niebla: "#0B1220" },
    luz: { color: "#C7DBFF", intensidad: 0.32 },
  },
  claro: {
    fondo: "#EEF2F7",
    rasterOpacidad: 0.25,
    rasterBrilloMax: 1,
    agua: "#BFDBFE",
    edificio: "#DCE3EC",
    residencial: "#E8EDF3",
    relleno: "#E2E8F0",
    rellenoOpacidad: 0.5,
    cauce: "#93C5FD",
    limite: "#94A3B8",
    vias: { borde: "#FFFFFF", autopista: "#7C93B5", principal: "#9AAEC9", secundaria: "#B4C3D8", riel: "#B8C2D0", sendero: "#CBD5E1", resto: "#C5D1E0", opacidad: 0.9 },
    extrusion: ["#D8E0EA", "#C6D2E1", "#AEC0D6", "#93AAC8"],
    extrusionOpacidad: 0.9,
    texto: "#334155",
    textoVia: "#64748B",
    cielo: { cielo: "#DCEAFB", horizonte: "#F1F5F9", niebla: "#EEF2F7" },
    luz: { color: "#FFFFFF", intensidad: 0.45 },
  },
};

type Capa = Record<string, unknown> & { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

/** Capas que no aportan a una vista de mando (íconos, flechas, escudos, etiquetas de POI). */
const QUITAR =
  /^(poi_|road_one_way|highway-shield|road_shield|airport|landcover_wetland|road_area_pattern|label_country|label_state|park_outline|aeroway|highway-name-path|highway-name-minor|waterway_line_label|water_name|boundary_disputed)|hatching$/;

const NOMBRE_ES = ["coalesce", ["get", "name:es"], ["get", "name"]];

function colorVia(id: string, v: PaletaBase["vias"]): { color: string; opacidad: number } {
  if (id.includes("casing")) return { color: v.borde, opacidad: v.opacidad * 0.95 };
  if (id.includes("motorway")) return { color: v.autopista, opacidad: v.opacidad };
  if (id.includes("trunk_primary")) return { color: v.principal, opacidad: v.opacidad };
  if (id.includes("secondary_tertiary")) return { color: v.secundaria, opacidad: v.opacidad * 0.95 };
  if (id.includes("rail")) return { color: v.riel, opacidad: v.opacidad };
  if (id.includes("path_pedestrian")) return { color: v.sendero, opacidad: v.opacidad * 0.6 };
  return { color: v.resto, opacidad: v.opacidad * 0.86 };
}

function recolorear(c: Capa, P: PaletaBase): Capa {
  const paint: Record<string, unknown> = { ...(c.paint ?? {}) };
  const layout: Record<string, unknown> = { ...(c.layout ?? {}) };
  const id = c.id;
  switch (c.type) {
    case "background":
      paint["background-color"] = P.fondo;
      break;
    case "raster":
      paint["raster-opacity"] = P.rasterOpacidad;
      paint["raster-saturation"] = -1;
      paint["raster-brightness-max"] = P.rasterBrilloMax;
      break;
    case "fill": {
      delete paint["fill-pattern"];
      delete paint["fill-outline-color"];
      if (id === "water") {
        paint["fill-color"] = P.agua;
        paint["fill-opacity"] = 1;
      } else if (id === "building") {
        paint["fill-color"] = P.edificio;
        paint["fill-opacity"] = 0.9;
      } else if (id === "landuse_residential") {
        paint["fill-color"] = P.residencial;
        paint["fill-opacity"] = 0.7;
      } else {
        paint["fill-color"] = P.relleno;
        paint["fill-opacity"] = P.rellenoOpacidad;
      }
      break;
    }
    case "line": {
      if (id.startsWith("waterway")) {
        paint["line-color"] = P.cauce;
        paint["line-opacity"] = 0.8;
      } else if (id.startsWith("boundary")) {
        paint["line-color"] = P.limite;
        paint["line-opacity"] = 0.5;
      } else {
        const { color, opacidad } = colorVia(id, P.vias);
        paint["line-color"] = color;
        paint["line-opacity"] = opacidad;
      }
      break;
    }
    case "fill-extrusion":
      // edificios 3D en azul pizarra: más altos, más claros
      paint["fill-extrusion-color"] = [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], 0],
        0,
        P.extrusion[0],
        30,
        P.extrusion[1],
        90,
        P.extrusion[2],
        200,
        P.extrusion[3],
      ];
      paint["fill-extrusion-opacity"] = P.extrusionOpacidad;
      paint["fill-extrusion-height"] = ["coalesce", ["get", "render_height"], 0];
      paint["fill-extrusion-base"] = ["coalesce", ["get", "render_min_height"], 0];
      paint["fill-extrusion-vertical-gradient"] = true;
      break;
    case "symbol":
      paint["text-color"] = id.startsWith("highway") ? P.textoVia : P.texto;
      paint["text-halo-color"] = P.fondo;
      paint["text-halo-width"] = 1.4;
      paint["text-halo-blur"] = 0.4;
      paint["icon-opacity"] = 0.35;
      if ("text-field" in layout) layout["text-field"] = NOMBRE_ES;
      break;
  }
  const salida: Capa = { ...c, paint };
  if (c.layout) salida.layout = layout;
  // los edificios 3D aparecen un nivel antes para que el centro se lea como ciudad
  if (id === "building-3d" || id === "building") salida.minzoom = 13;
  // veredas y barrios solo de cerca: en la vista de mando estorban a los datos
  if (id === "label_other") salida.minzoom = 13.2;
  if (id === "label_village") salida.minzoom = 11.5;
  return salida;
}

/** Devuelve una copia del estilo base recoloreada para el tema (no muta el original). */
export function estiloPulso(base: StyleSpecification, tema: TemaPulso): StyleSpecification {
  const P = PALETAS[tema];
  const capas = (base.layers as unknown as Capa[]).filter((c) => !QUITAR.test(c.id)).map((c) => recolorear(c, P));
  return {
    ...base,
    layers: capas as unknown as StyleSpecification["layers"],
    sky: {
      "sky-color": P.cielo.cielo,
      "horizon-color": P.cielo.horizonte,
      "fog-color": P.cielo.niebla,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.85,
      "atmosphere-blend": 0,
    },
    light: { anchor: "viewport", color: P.luz.color, intensity: P.luz.intensidad, position: [1.2, 210, 35] },
  };
}

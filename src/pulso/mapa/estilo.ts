import type { StyleSpecification } from "maplibre-gl";

/**
 * Estilo nocturno de PULSO a partir de OpenFreeMap "liberty" (sin clave).
 * OpenFreeMap publica un estilo "dark", pero no trae edificios 3D; por eso se parte de "liberty"
 * (que sí trae la capa `building-3d`) y se recolorea en el navegador antes de crear el mapa.
 * El mapa base es solo cartografía: ninguna cifra de PULSO sale de aquí.
 */
export const URL_ESTILO_BASE = "https://tiles.openfreemap.org/styles/liberty";

export const NOCHE = "#0B1220";

type Capa = Record<string, unknown> & { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

/** Capas que no aportan a una vista de mando (íconos, flechas, escudos, etiquetas de POI). */
const QUITAR =
  /^(poi_|road_one_way|highway-shield|road_shield|airport|landcover_wetland|road_area_pattern|label_country|label_state|park_outline|aeroway|highway-name-path|highway-name-minor|waterway_line_label|water_name|boundary_disputed)|hatching$/;

const NOMBRE_ES = ["coalesce", ["get", "name:es"], ["get", "name"]];

function colorVia(id: string): { color: string; opacidad: number } {
  if (id.includes("casing")) return { color: "#0E1828", opacidad: 0.55 };
  if (id.includes("motorway")) return { color: "#3E6FB0", opacidad: 0.6 };
  if (id.includes("trunk_primary")) return { color: "#2F5689", opacidad: 0.6 };
  if (id.includes("secondary_tertiary")) return { color: "#24426B", opacidad: 0.55 };
  if (id.includes("rail")) return { color: "#263854", opacidad: 0.6 };
  if (id.includes("path_pedestrian")) return { color: "#1A2A44", opacidad: 0.35 };
  return { color: "#1B3050", opacidad: 0.5 };
}

function recolorear(c: Capa): Capa {
  const paint: Record<string, unknown> = { ...(c.paint ?? {}) };
  const layout: Record<string, unknown> = { ...(c.layout ?? {}) };
  const id = c.id;
  switch (c.type) {
    case "background":
      paint["background-color"] = NOCHE;
      break;
    case "raster":
      paint["raster-opacity"] = 0.08;
      paint["raster-saturation"] = -1;
      paint["raster-brightness-max"] = 0.3;
      break;
    case "fill": {
      delete paint["fill-pattern"];
      delete paint["fill-outline-color"];
      if (id === "water") {
        paint["fill-color"] = "#0C2A4D";
        paint["fill-opacity"] = 1;
      } else if (id === "building") {
        paint["fill-color"] = "#14213A";
        paint["fill-opacity"] = 0.9;
      } else if (id === "landuse_residential") {
        paint["fill-color"] = "#0F1A2C";
        paint["fill-opacity"] = 0.7;
      } else {
        paint["fill-color"] = "#0F1C2E";
        paint["fill-opacity"] = 0.45;
      }
      break;
    }
    case "line": {
      if (id.startsWith("waterway")) {
        paint["line-color"] = "#1B4F86";
        paint["line-opacity"] = 0.8;
      } else if (id.startsWith("boundary")) {
        paint["line-color"] = "#33476A";
        paint["line-opacity"] = 0.5;
      } else {
        const { color, opacidad } = colorVia(id);
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
        "#17253F",
        30,
        "#203557",
        90,
        "#2C4B78",
        200,
        "#3B6296",
      ];
      paint["fill-extrusion-opacity"] = 0.88;
      paint["fill-extrusion-height"] = ["coalesce", ["get", "render_height"], 0];
      paint["fill-extrusion-base"] = ["coalesce", ["get", "render_min_height"], 0];
      paint["fill-extrusion-vertical-gradient"] = true;
      break;
    case "symbol":
      paint["text-color"] = id.startsWith("highway") ? "#5F7697" : "#9FB3CF";
      paint["text-halo-color"] = NOCHE;
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

/** Devuelve una copia nocturna del estilo base (no muta el original). */
export function estiloNocturno(base: StyleSpecification): StyleSpecification {
  const capas = (base.layers as unknown as Capa[]).filter((c) => !QUITAR.test(c.id)).map(recolorear);
  return {
    ...base,
    layers: capas as unknown as StyleSpecification["layers"],
    sky: {
      "sky-color": "#0B1220",
      "horizon-color": "#16294A",
      "fog-color": "#0B1220",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.85,
      "atmosphere-blend": 0,
    },
    light: { anchor: "viewport", color: "#C7DBFF", intensity: 0.32, position: [1.2, 210, 35] },
  };
}

import "server-only";

import { z } from "zod";
import { dentroDelValle, VALLE_ABURRA, type ModoRuta } from "@/pulso/rutas/constantes";
import type { PuntoNombrado } from "@/pulso/tipos";

/**
 * Google Places (API New) y Google Routes, SOLO desde el servidor.
 * Google se usa únicamente para geometría, nombres de lugares y tiempos de viaje: ninguna cifra de aire
 * ni de siniestralidad sale de aquí (esas vienen de SIATA y MEData en puntuar.ts).
 *
 * Claves: GOOGLE_PLACES_API_KEY y GOOGLE_ROUTES_API_KEY (variables de entorno del servidor, nunca al cliente).
 * Nunca lanza: devuelve { ok:false, motivo } y el detalle técnico se queda en el log del servidor.
 */

const TIEMPO_MAXIMO_MS = 10_000;

export type MotivoGoogle = "sin-clave" | "sin-resultados" | "fuera-del-valle" | "error";
export type ResultadoGoogle<T> = { ok: true; datos: T } | { ok: false; motivo: MotivoGoogle };

const clavePlaces = () => process.env.GOOGLE_PLACES_API_KEY?.trim() || "";
const claveRoutes = () => process.env.GOOGLE_ROUTES_API_KEY?.trim() || "";

/** true si esta instalación tiene las dos claves de Google. Leer solo en route handlers dinámicos. */
export const hayClavesGoogle = () => clavePlaces().length > 0 && claveRoutes().length > 0;

const RECTANGULO = {
  rectangle: {
    low: { latitude: VALLE_ABURRA.latMin, longitude: VALLE_ABURRA.lngMin },
    high: { latitude: VALLE_ABURRA.latMax, longitude: VALLE_ABURRA.lngMax },
  },
};

/* ───────────── Places: autocompletar ───────────── */

export interface SugerenciaLugar {
  placeId: string;
  principal: string;
  secundario: string;
}

const respuestaAutocompletar = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            text: z.object({ text: z.string() }),
            structuredFormat: z
              .object({ mainText: z.object({ text: z.string() }), secondaryText: z.object({ text: z.string() }).optional() })
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export async function autocompletarLugar(texto: string, sesion?: string): Promise<ResultadoGoogle<SugerenciaLugar[]>> {
  const clave = clavePlaces();
  if (!clave) return { ok: false, motivo: "sin-clave" };
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": clave },
      body: JSON.stringify({
        input: texto,
        languageCode: "es",
        regionCode: "co",
        locationRestriction: RECTANGULO,
        ...(sesion ? { sessionToken: sesion } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!res.ok) {
      console.error("[rutas] Places autocomplete HTTP", res.status);
      return { ok: false, motivo: "error" };
    }
    const json = respuestaAutocompletar.parse(await res.json());
    const lista = (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .slice(0, 6)
      .map((p) => ({
        placeId: p.placeId,
        principal: p.structuredFormat?.mainText.text ?? p.text.text,
        secundario: p.structuredFormat?.secondaryText?.text ?? "",
      }));
    return { ok: true, datos: lista };
  } catch (e) {
    console.error("[rutas] Places autocomplete", e);
    return { ok: false, motivo: "error" };
  }
}

/* ───────────── Places: texto o placeId → coordenadas ───────────── */

const lugarGoogle = z.object({
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
});

function aPunto(l: z.infer<typeof lugarGoogle>, respaldo: string): PuntoNombrado {
  return { nombre: l.displayName?.text || l.formattedAddress || respaldo, lat: l.location.latitude, lng: l.location.longitude };
}

/** Resuelve un texto libre ("La Alpujarra, Medellín") al lugar más relevante dentro del Valle de Aburrá. */
export async function buscarLugarPorTexto(texto: string): Promise<ResultadoGoogle<PuntoNombrado>> {
  const clave = clavePlaces();
  if (!clave) return { ok: false, motivo: "sin-clave" };
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": clave,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({ textQuery: texto, languageCode: "es", regionCode: "co", pageSize: 1, locationRestriction: RECTANGULO }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!res.ok) {
      console.error("[rutas] Places searchText HTTP", res.status);
      return { ok: false, motivo: "error" };
    }
    const json = z.object({ places: z.array(lugarGoogle).optional() }).parse(await res.json());
    const primero = json.places?.[0];
    if (!primero) return { ok: false, motivo: "sin-resultados" };
    const punto = aPunto(primero, texto);
    if (!dentroDelValle(punto.lat, punto.lng)) return { ok: false, motivo: "fuera-del-valle" };
    return { ok: true, datos: punto };
  } catch (e) {
    console.error("[rutas] Places searchText", e);
    return { ok: false, motivo: "error" };
  }
}

/** Coordenadas de una sugerencia del autocompletado (cierra la sesión de Places si se envía). */
export async function detallesLugar(placeId: string, sesion?: string): Promise<ResultadoGoogle<PuntoNombrado>> {
  const clave = clavePlaces();
  if (!clave) return { ok: false, motivo: "sin-clave" };
  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set("languageCode", "es");
    if (sesion) url.searchParams.set("sessionToken", sesion);
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": clave, "X-Goog-FieldMask": "displayName,formattedAddress,location" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (res.status === 404 || res.status === 400) return { ok: false, motivo: "sin-resultados" };
    if (!res.ok) {
      console.error("[rutas] Places details HTTP", res.status);
      return { ok: false, motivo: "error" };
    }
    const punto = aPunto(lugarGoogle.parse(await res.json()), "Lugar elegido");
    if (!dentroDelValle(punto.lat, punto.lng)) return { ok: false, motivo: "fuera-del-valle" };
    return { ok: true, datos: punto };
  } catch (e) {
    console.error("[rutas] Places details", e);
    return { ok: false, motivo: "error" };
  }
}

/* ───────────── Routes: computeRoutes con alternativas ───────────── */

export interface RutaCruda {
  duracionS: number;
  distanciaM: number;
  polilinea: string;
  /** "Av. Las Palmas", "Cra. 43A/Av. El Poblado"… tal como lo describe Google */
  descripcion: string;
}

const respuestaRutas = z.object({
  routes: z
    .array(
      z.object({
        duration: z.string().optional(),
        distanceMeters: z.number().optional(),
        description: z.string().optional(),
        polyline: z.object({ encodedPolyline: z.string() }).optional(),
      }),
    )
    .optional(),
});

async function pedirRutas(clave: string, origen: PuntoNombrado, destino: PuntoNombrado, modo: ModoRuta, alternativas: boolean) {
  const cuerpo: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origen.lat, longitude: origen.lng } } },
    destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
    travelMode: modo,
    computeAlternativeRoutes: alternativas,
    polylineQuality: "OVERVIEW",
    polylineEncoding: "ENCODED_POLYLINE",
    languageCode: "es-CO",
    regionCode: "co",
    units: "METRIC",
  };
  // el tráfico en tiempo real solo aplica a vehículos; Google rechaza routingPreference en bici y a pie
  if (modo === "DRIVE" || modo === "TWO_WHEELER") cuerpo.routingPreference = "TRAFFIC_AWARE";
  return fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": clave,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
}

/** Hasta 3 alternativas de Google. Si el modo no admite alternativas (HTTP 400), reintenta pidiendo una sola ruta. */
export async function calcularRutas(origen: PuntoNombrado, destino: PuntoNombrado, modo: ModoRuta): Promise<ResultadoGoogle<RutaCruda[]>> {
  const clave = claveRoutes();
  if (!clave) return { ok: false, motivo: "sin-clave" };
  try {
    let res = await pedirRutas(clave, origen, destino, modo, true);
    if (res.status === 400) {
      console.error("[rutas] Routes rechazó alternativas para", modo, "→ reintento con una sola ruta");
      res = await pedirRutas(clave, origen, destino, modo, false);
    }
    if (!res.ok) {
      console.error("[rutas] Routes HTTP", res.status);
      return { ok: false, motivo: res.status === 400 ? "sin-resultados" : "error" };
    }
    const json = respuestaRutas.parse(await res.json());
    const rutas = (json.routes ?? [])
      .filter((r) => r.polyline?.encodedPolyline && typeof r.distanceMeters === "number" && r.duration)
      .slice(0, 3)
      .map((r) => ({
        duracionS: Number.parseInt(r.duration!, 10) || 0,
        distanciaM: r.distanceMeters!,
        polilinea: r.polyline!.encodedPolyline,
        descripcion: r.description ?? "",
      }));
    if (rutas.length === 0) return { ok: false, motivo: "sin-resultados" };
    return { ok: true, datos: rutas };
  } catch (e) {
    console.error("[rutas] Routes", e);
    return { ok: false, motivo: "error" };
  }
}

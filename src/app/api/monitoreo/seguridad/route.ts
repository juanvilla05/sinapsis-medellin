import { obtenerSeguridadVial } from "@/lib/monitoreo/cargar";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Brecha de muertes viales por año: serie MEData (Víctimas en incidentes viales) y serie de la Policía
 * Nacional (datos.gov.co ha6j-pa2r) con sus fuentes, licencias y cortes. Revalida cada hora vía "use cache".
 */
export async function GET() {
  try {
    const detalle = await obtenerSeguridadVial();
    return Response.json(detalle, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch {
    return Response.json(
      { ok: false, motivo: "error", detalle: "La serie de seguridad vial no está disponible en este momento." },
      { status: 503 },
    );
  }
}

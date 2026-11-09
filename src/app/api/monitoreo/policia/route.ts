import { obtenerMuertesPolicia } from "@/lib/monitoreo/fuentes";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Muertes en accidentes de tránsito en Medellín por año (Policía Nacional, datos.gov.co ha6j-pa2r).
 * Prerenderizado con revalidación de 1 h vía "use cache"; nunca expone mensajes internos de error.
 */
export async function GET() {
  try {
    const s = await obtenerMuertesPolicia();
    return Response.json(
      { ok: true, guardado: s.guardado, consultado: s.consultado, capturado: s.capturado, fuente: s.fuente, datos: s.datos },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch {
    return Response.json({ ok: false, motivo: "error", detalle: "La serie de la Policía no está disponible en este momento." }, { status: 503 });
  }
}

import { obtenerConsolidado } from "@/lib/monitoreo/fuentes";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Casos de criminalidad por conducta × comuna × año (MEData 1-027-23-000303, SISC).
 * Prerenderizado con revalidación de 6 h vía "use cache"; nunca expone mensajes internos de error.
 */
export async function GET() {
  try {
    const s = await obtenerConsolidado();
    return Response.json(
      { ok: true, guardado: s.guardado, consultado: s.consultado, capturado: s.capturado, fuente: s.fuente, datos: s.datos },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch {
    return Response.json({ ok: false, motivo: "error", detalle: "El consolidado por comunas no está disponible en este momento." }, { status: 503 });
  }
}

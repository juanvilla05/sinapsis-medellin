import { obtenerComunasGeo } from "@/lib/monitoreo/fuentes";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * GeoJSON de las 16 comunas y 5 corregimientos de Medellín (capa comunas_y_corregimientos, ArcGIS Online).
 * Prerenderizado con revalidación diaria vía "use cache"; nunca expone mensajes internos de error.
 */
export async function GET() {
  try {
    const s = await obtenerComunasGeo();
    return Response.json(
      { ok: true, guardado: s.guardado, consultado: s.consultado, capturado: s.capturado, fuente: s.fuente, datos: s.datos },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch {
    return Response.json({ ok: false, motivo: "error", detalle: "La geometría de comunas no está disponible en este momento." }, { status: 503 });
  }
}

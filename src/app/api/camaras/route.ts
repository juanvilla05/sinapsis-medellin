import { obtenerCamaras } from "@/lib/camaras";

/**
 * Listado de cámaras públicas en vivo (Secretaría de Movilidad · SIMM y SIATA) con el enlace a su última foto.
 * Solo lee `obtenerCamaras()` ("use cache", 30 min). Las imágenes no pasan por PULSO: las pide el navegador a la fuente.
 */
export async function GET() {
  const snapshot = await obtenerCamaras();
  return Response.json(snapshot, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
  });
}

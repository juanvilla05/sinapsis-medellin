import { obtenerAire } from "@/lib/siata";

/**
 * Última lectura de PM2.5 de SIATA (Valle de Aburrá), ya normalizada y resumida.
 * Solo lee `obtenerAire()` ("use cache", 5 min), así que bajo Cache Components se prerenderiza y se revalida sola.
 */
export async function GET() {
  const snapshot = await obtenerAire();
  return Response.json(snapshot, {
    status: snapshot.ok ? 200 : 503,
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
  });
}

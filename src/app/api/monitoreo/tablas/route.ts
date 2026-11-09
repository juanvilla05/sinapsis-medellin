import { cargarHurtoComuna, cargarIncidentesComuna, cargarVictimasComuna } from "@/lib/monitoreo/cargar";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Tablas por comuna de la Sala de Monitoreo (incidentes, víctimas, hurto a persona), ya validadas con zod
 * y con supresión n<5. Son agregados estáticos del repo: la ruta se prerenderiza completa.
 * Un conjunto que no pasó la validación llega como null y la interfaz lo muestra "en preparación".
 */
export function GET() {
  const incidentes = cargarIncidentesComuna();
  const victimas = cargarVictimasComuna();
  const hurto = cargarHurtoComuna();
  return Response.json(
    { ok: true, incidentes, victimas, hurto },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}

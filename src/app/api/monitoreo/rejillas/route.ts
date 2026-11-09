import { cargarRejillaHurto, cargarRejillaIncidentes, cargarRejillaVictimas } from "@/lib/monitoreo/cargar";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Rejillas de 250 m (solo celdas con n ≥ 5) para las columnas de la Medellín 3D de datos.
 * Se descargan únicamente cuando la persona pulsa "Ver en 3D". Agregados estáticos: ruta prerenderizada.
 */
export function GET() {
  const incidentes = cargarRejillaIncidentes();
  const victimas = cargarRejillaVictimas();
  const hurto = cargarRejillaHurto();
  return Response.json(
    { ok: true, incidentes, victimas, hurto },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}

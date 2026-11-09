import { connection } from "next/server";
import { z } from "zod";
import { planearRuta } from "@/lib/rutas/planear";
import { cabecerasLimite, ipCliente, limitar } from "@/lib/rate-limit";
import { MODOS_RUTA, VALLE_ABURRA } from "@/pulso/rutas/constantes";

export const maxDuration = 30;

const LIMITE_RUTAS_POR_HORA = 30;

const nombre = z.string().trim().min(1).max(120);
const lugar = z.union([
  z.string().trim().min(2).max(160),
  z.object({
    lat: z.number().gte(VALLE_ABURRA.latMin).lte(VALLE_ABURRA.latMax),
    lng: z.number().gte(VALLE_ABURRA.lngMin).lte(VALLE_ABURRA.lngMax),
    nombre: nombre.optional(),
  }),
  z.object({
    placeId: z.string().regex(/^[\w-]{10,300}$/),
    nombre: nombre.optional(),
    sesion: z.string().regex(/^[\w-]{8,64}$/).optional(),
  }),
]);

const esquema = z.object({
  origen: lugar,
  destino: lugar,
  modo: z.enum(MODOS_RUTA).optional(),
});

const noGuardar = { "Cache-Control": "no-store" };

/**
 * POST /api/rutas { origen, destino, modo } → alternativas de Google puntuadas con SIATA (aire en vivo) y
 * MEData (incidentes viales históricos). origen/destino: texto, { lat, lng } dentro del Valle de Aburrá o
 * { placeId, nombre } de /api/rutas/lugares. Respuesta con la forma Respuesta<DatosRuta> del Analista.
 */
export async function POST(req: Request) {
  await connection();
  const limite = limitar(`rutas:${ipCliente(req)}`, LIMITE_RUTAS_POR_HORA);
  const cabeceras = { ...cabecerasLimite(limite), ...noGuardar };
  if (!limite.ok) {
    return Response.json(
      { ok: false, motivo: "error", detalle: "Alcanzaste el límite de rutas por hora. Vuelve a intentarlo más tarde." },
      { status: 429, headers: cabeceras },
    );
  }

  const cuerpo = esquema.safeParse(await req.json().catch(() => null));
  if (!cuerpo.success) {
    return Response.json(
      {
        ok: false,
        motivo: "error",
        detalle: "La consulta no tiene el formato esperado o algún punto queda fuera del Valle de Aburrá.",
      },
      { status: 400, headers: cabeceras },
    );
  }

  try {
    const r = await planearRuta(cuerpo.data);
    // sin clave o sin rutas son estados previstos de la interfaz (200 con ok:false); solo un fallo de Google es 502
    const status = !r.ok && r.motivo === "error" ? 502 : 200;
    return Response.json(r, { status, headers: cabeceras });
  } catch (e) {
    console.error("[/api/rutas]", e);
    return Response.json(
      { ok: false, motivo: "error", detalle: "No se pudieron calcular las rutas en este momento. Intenta de nuevo." },
      { status: 500, headers: cabeceras },
    );
  }
}

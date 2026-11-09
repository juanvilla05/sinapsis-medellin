import { connection } from "next/server";
import { z } from "zod";
import { autocompletarLugar } from "@/lib/rutas/google";
import { cabecerasLimite, ipCliente, limitar } from "@/lib/rate-limit";

const LIMITE_LUGARES_POR_HORA = 120;

const esquema = z.object({
  q: z.string().trim().min(2).max(120),
  sesion: z
    .string()
    .regex(/^[\w-]{8,64}$/)
    .optional(),
});

/**
 * GET /api/rutas/lugares?q=…&sesion=… → sugerencias de Google Places restringidas al Valle de Aburrá.
 * Responde { ok:true, sugerencias:[{ placeId, principal, secundario }] } o { ok:false, motivo, detalle } con texto propio.
 */
export async function GET(req: Request) {
  await connection();
  const limite = limitar(`rutas:lugares:${ipCliente(req)}`, LIMITE_LUGARES_POR_HORA);
  const cabeceras = { ...cabecerasLimite(limite), "Cache-Control": "no-store" };
  if (!limite.ok) {
    return Response.json(
      { ok: false, motivo: "error", detalle: "Alcanzaste el límite de búsquedas de lugares por hora. Vuelve a intentarlo más tarde." },
      { status: 429, headers: cabeceras },
    );
  }

  const url = new URL(req.url);
  const parsed = esquema.safeParse({ q: url.searchParams.get("q") ?? "", sesion: url.searchParams.get("sesion") ?? undefined });
  if (!parsed.success) {
    return Response.json({ ok: false, motivo: "error", detalle: "Escribe al menos dos letras para buscar un lugar." }, { status: 400, headers: cabeceras });
  }

  const r = await autocompletarLugar(parsed.data.q, parsed.data.sesion);
  if (!r.ok) {
    if (r.motivo === "sin-clave") {
      return Response.json(
        { ok: false, motivo: "sin-clave", detalle: "La búsqueda de lugares necesita la clave de Google en esta instalación." },
        { headers: cabeceras },
      );
    }
    return Response.json(
      { ok: false, motivo: "error", detalle: "Google no respondió a la búsqueda de lugares. Intenta de nuevo en un momento." },
      { status: 502, headers: cabeceras },
    );
  }
  return Response.json({ ok: true, sugerencias: r.datos }, { headers: cabeceras });
}

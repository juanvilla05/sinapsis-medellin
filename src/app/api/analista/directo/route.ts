import { z } from "zod";
import { ejecutarHerramienta, NOMBRES } from "@/lib/analista/herramientas";
import { cabecerasLimite, ipCliente, limitar } from "@/lib/rate-limit";

export const maxDuration = 60;

// Alto a propósito: el modo directo no usa IA y es el respaldo del chat cuando se pasa su tope.
const LIMITE_DIRECTO_POR_HORA = 300;

const esquema = z.object({
  herramienta: z.enum(NOMBRES),
  args: z.record(z.string(), z.unknown()).optional(),
});

/** Modo directo: ejecuta una herramienta del Analista sin modelo de lenguaje. Nunca llama al LLM. */
export async function POST(req: Request) {
  const limite = limitar(`analista:directo:${ipCliente(req)}`, LIMITE_DIRECTO_POR_HORA);
  const cabeceras = cabecerasLimite(limite);
  if (!limite.ok) {
    return Response.json(
      { ok: false, motivo: "error", detalle: "Alcanzaste el límite de consultas directas por hora. Vuelve a intentarlo más tarde." },
      { status: 429, headers: cabeceras },
    );
  }

  const cuerpo = esquema.safeParse(await req.json().catch(() => null));
  if (!cuerpo.success) {
    return Response.json(
      { ok: false, motivo: "error", detalle: "La consulta no tiene el formato esperado: { herramienta, args }." },
      { status: 400, headers: cabeceras },
    );
  }

  const respuesta = await ejecutarHerramienta(cuerpo.data.herramienta, cuerpo.data.args ?? {});
  return Response.json(respuesta, { headers: { ...cabeceras, "Cache-Control": "no-store" } });
}

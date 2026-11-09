import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { connection } from "next/server";
import { z } from "zod";
import resumenJson from "@/data/resumen-catalogo.json";
import { herramientasSDK } from "@/lib/analista/herramientas";
import { construirSnapshot, construirSystem } from "@/lib/analista/prompt";
import type { ResumenCatalogo } from "@/lib/catalogo";
import { capacidades } from "@/lib/entorno";
import { cabecerasLimite, ipCliente, limitar } from "@/lib/rate-limit";

export const maxDuration = 60;

const LIMITE_CHAT_POR_HORA = 20;
const MAX_MENSAJES = 30;
const MAX_TEXTO = 2000;

/** Capacidades de esta instalación. Se lee en runtime (connection) para no hornear el valor en el build. */
export async function GET() {
  await connection();
  const c = capacidades();
  return Response.json({ ia: c.ia, modelo: c.modelo }, { headers: { "Cache-Control": "no-store" } });
}

/*
 * Solo se aceptan partes de texto (acotadas) y de herramienta: las partes "file" con data: URLs
 * viajarían a Gemini y consumirían cuota. El rol "system" no se acepta del cliente, porque
 * convertToModelMessages lo convertiría en un mensaje de sistema real y anularía el prompt del Analista.
 */
const esquemaParte = z.union([
  z.object({ type: z.literal("text"), text: z.string().max(MAX_TEXTO) }),
  z.looseObject({ type: z.string().startsWith("tool-") }),
]);
const esParteValida = (p: { type: string }) => p.type === "text" || p.type.startsWith("tool-");
const esquemaMensaje = z.object({
  id: z.string().max(200).optional(),
  role: z.enum(["user", "assistant"]),
  parts: z
    .array(z.looseObject({ type: z.string() }))
    .max(40)
    // Las partes que no son texto ni herramienta (step-start, reasoning, file, data-*) se descartan antes de validar.
    .transform((partes) => partes.filter(esParteValida))
    .pipe(z.array(esquemaParte).min(1)),
});
const esquemaCuerpo = z.object({ messages: z.array(esquemaMensaje).min(1).max(MAX_MENSAJES) });

/** Chat con Gemini: el modelo solo redacta lo que devuelven las herramientas deterministas. */
export async function POST(req: Request) {
  const c = capacidades();
  if (!c.ia) {
    return Response.json(
      { ok: false, motivo: "sin-clave", detalle: "Esta instalación no tiene clave de IA. El Analista responde en modo directo con las mismas herramientas." },
      { status: 503 },
    );
  }

  const limite = limitar(`analista:chat:${ipCliente(req)}`, LIMITE_CHAT_POR_HORA);
  const cabeceras = cabecerasLimite(limite);
  if (!limite.ok) {
    return Response.json(
      { ok: false, motivo: "error", detalle: "Alcanzaste el límite de preguntas con IA por hora. Puedes seguir en modo directo." },
      { status: 429, headers: cabeceras },
    );
  }

  const cuerpo = esquemaCuerpo.safeParse(await req.json().catch(() => null));
  if (!cuerpo.success || cuerpo.data.messages.at(-1)?.role !== "user") {
    return Response.json({ ok: false, motivo: "error", detalle: "El mensaje no tiene el formato esperado." }, { status: 400, headers: cabeceras });
  }
  const mensajes = cuerpo.data.messages as unknown as UIMessage[];

  const snapshot = construirSnapshot(resumenJson as ResumenCatalogo, null);
  const resultado = streamText({
    model: google(c.modelo),
    system: construirSystem(snapshot),
    messages: await convertToModelMessages(mensajes),
    tools: herramientasSDK,
    stopWhen: stepCountIs(4),
    temperature: 0.2,
    maxOutputTokens: 700,
    abortSignal: req.signal,
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
  });

  return resultado.toUIMessageStreamResponse({
    headers: cabeceras,
    // Texto propio: nunca se expone el mensaje interno del proveedor.
    onError: () => "La IA no pudo completar la respuesta. Puedes ver la misma consulta en modo directo.",
  });
}

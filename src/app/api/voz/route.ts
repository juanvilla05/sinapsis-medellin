import { connection } from "next/server";
import { z } from "zod";
import { cabecerasLimite, ipCliente, limitar } from "@/lib/rate-limit";

/**
 * Voz de PulsoBot: convierte el texto de una respuesta en audio con ElevenLabs (voz humana).
 *   GET  /api/voz           → { voz: boolean }  (¿hay clave en esta instalación?)
 *   POST /api/voz { texto } → audio/mpeg, o { ok:false, motivo } para que el cliente use la voz del navegador.
 * La clave vive solo en el servidor. El texto que se lee es la respuesta ya calculada: aquí no se genera ninguna cifra.
 */
const LIMITE_VOZ_POR_HORA = 90;
const MAX_CARACTERES = 600;
const PLAZO_MS = 15_000;
/** Voz estándar de ElevenLabs (disponible en cualquier plan). Con plan de pago se puede poner una voz de la biblioteca, p. ej. una colombiana. */
const VOZ_POR_DEFECTO = "EXAVITQu4vr4xnSDxMaL";
const MODELO_POR_DEFECTO = "eleven_turbo_v2_5";

const esquema = z.object({ texto: z.string().trim().min(1).max(2000) });

const config = () => ({
  clave: process.env.ELEVENLABS_API_KEY?.trim() ?? "",
  voz: process.env.ELEVENLABS_VOZ_ID?.trim() || VOZ_POR_DEFECTO,
  modelo: process.env.ELEVENLABS_MODELO?.trim() || MODELO_POR_DEFECTO,
});

const noCache = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  return Response.json({ voz: config().clave.length > 0 }, { headers: noCache });
}

export async function POST(req: Request) {
  await connection();
  const { clave, voz, modelo } = config();
  if (!clave) return Response.json({ ok: false, motivo: "sin-clave" }, { headers: noCache });

  const limite = limitar(`voz:${ipCliente(req)}`, LIMITE_VOZ_POR_HORA);
  const cabeceras = { ...cabecerasLimite(limite), ...noCache };
  if (!limite.ok) return Response.json({ ok: false, motivo: "limite" }, { status: 429, headers: cabeceras });

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    cuerpo = null;
  }
  const parsed = esquema.safeParse(cuerpo);
  if (!parsed.success) return Response.json({ ok: false, motivo: "error" }, { status: 400, headers: cabeceras });
  const texto = parsed.data.texto.slice(0, MAX_CARACTERES);

  const pedir = (vozId: string) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vozId)}/stream?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": clave, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: texto,
        model_id: modelo,
        ...(modelo.includes("v2_5") ? { language_code: "es" } : {}),
        // un poco menos estable y con algo de estilo: suena conversada, no leída
        voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 1.04 },
      }),
      signal: AbortSignal.timeout(PLAZO_MS),
    });

  try {
    let r = await pedir(voz);
    // una voz de biblioteca en un plan que no la permite: se reintenta con la estándar
    if (r.status === 402 && voz !== VOZ_POR_DEFECTO) r = await pedir(VOZ_POR_DEFECTO);
    if (!r.ok || !r.body) {
      console.error("[voz] ElevenLabs respondió", r.status);
      const motivo = r.status === 401 || r.status === 402 || r.status === 429 ? "cuota" : "error";
      return Response.json({ ok: false, motivo }, { headers: cabeceras });
    }
    return new Response(r.body, { headers: { ...cabeceras, "Content-Type": "audio/mpeg" } });
  } catch (e) {
    console.error("[voz]", e);
    return Response.json({ ok: false, motivo: "error" }, { headers: cabeceras });
  }
}

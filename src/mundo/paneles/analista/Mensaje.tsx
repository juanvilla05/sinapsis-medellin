import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { Respuesta as RespuestaHerramienta } from "@/lib/analista/herramientas";
import { NOMBRES_HERRAMIENTAS, NOMBRES_HERRAMIENTAS_LISTA, type NombreHerramienta } from "@/lib/analista/sugeridas";
import AvisoRespuesta from "./AvisoRespuesta";
import Respuesta from "./Respuesta";

const esNombre = (n: string): n is NombreHerramienta => (NOMBRES_HERRAMIENTAS_LISTA as string[]).includes(n);

/** Comprueba que la salida de la herramienta tenga la forma Respuesta<T>. */
export function esRespuesta(x: unknown): x is RespuestaHerramienta<unknown> {
  if (!x || typeof x !== "object" || !("ok" in x)) return false;
  const r = x as { ok: unknown; datos?: unknown; citas?: unknown; motivo?: unknown; detalle?: unknown };
  return r.ok === true ? Array.isArray(r.citas) : typeof r.motivo === "string" && typeof r.detalle === "string";
}

export function Burbuja({ rol, children }: { rol: "user" | "assistant"; children: React.ReactNode }) {
  const usuario = rol === "user";
  return (
    <div className={`flex ${usuario ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[min(100%,46rem)] flex-col gap-2.5 ${
          usuario ? "rounded-2xl rounded-br-md bg-[#1E3A5F] px-4 py-2.5 text-white" : "w-full"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function Consultando({ nombre }: { nombre: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-[#E3EAF3] bg-[#F4F7FB] px-4 py-2.5 text-[13px] text-[#475569]">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#2563EB]" aria-hidden="true" />
      Consultando {nombre}…
    </div>
  );
}

/** Un mensaje del chat con IA: texto del usuario o del modelo y las herramientas invocadas (parts tool-*). */
export default function Mensaje({
  mensaje,
  onVerSinIA,
}: {
  mensaje: UIMessage;
  onVerSinIA?: (herramienta: NombreHerramienta, args: Record<string, unknown>) => void;
}) {
  if (mensaje.role === "system") return null;
  const rol = mensaje.role;
  const invocaciones: { herramienta: NombreHerramienta; args: Record<string, unknown> }[] = [];

  const partes = mensaje.parts.map((part, i) => {
    if (part.type === "text") {
      if (!part.text.trim()) return null;
      return (
        <p key={i} className={`m-0 whitespace-pre-wrap text-[14px] leading-relaxed ${rol === "user" ? "text-white" : "text-[#0F172A]"}`}>
          {part.text}
        </p>
      );
    }
    if (isToolUIPart(part)) {
      const nombreCrudo = getToolName(part);
      const nombre = esNombre(nombreCrudo) ? nombreCrudo : null;
      const legible = nombre ? NOMBRES_HERRAMIENTAS[nombre] : nombreCrudo;
      if (nombre && part.state !== "input-streaming" && part.input && typeof part.input === "object") {
        invocaciones.push({ herramienta: nombre, args: part.input as Record<string, unknown> });
      }
      switch (part.state) {
        case "input-streaming":
        case "input-available":
          return <Consultando key={part.toolCallId} nombre={legible} />;
        case "output-available": {
          const salida = part.output;
          if (!nombre || !esRespuesta(salida)) {
            return <AvisoRespuesta key={part.toolCallId} motivo="error" detalle="La herramienta devolvió una respuesta que no se pudo interpretar." compacto />;
          }
          if (!salida.ok) return <AvisoRespuesta key={part.toolCallId} motivo={salida.motivo} detalle={salida.detalle} compacto />;
          return <Respuesta key={part.toolCallId} herramienta={nombre} respuesta={salida} />;
        }
        case "output-error":
          return <AvisoRespuesta key={part.toolCallId} motivo="error" detalle={`${legible} no pudo completar la consulta. Puedes repetirla en modo directo.`} compacto />;
        default:
          return null;
      }
    }
    return null;
  });

  const conContenido = partes.some(Boolean);
  if (!conContenido) return null;

  return (
    <Burbuja rol={rol}>
      {partes}
      {rol === "assistant" && onVerSinIA && invocaciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {invocaciones.map((inv, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onVerSinIA(inv.herramienta, inv.args)}
              className="rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F] hover:border-[#2563EB]"
            >
              Ver la misma respuesta sin IA{invocaciones.length > 1 ? ` · ${NOMBRES_HERRAMIENTAS[inv.herramienta]}` : ""}
            </button>
          ))}
        </div>
      )}
    </Burbuja>
  );
}

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Respuesta as RespuestaHerramienta } from "@/lib/analista/herramientas";
import { NOMBRES_HERRAMIENTAS, type NombreHerramienta, type Sugerida } from "@/lib/analista/sugeridas";
import AvisoRespuesta from "./analista/AvisoRespuesta";
import Mensaje, { Burbuja, Consultando, esRespuesta } from "./analista/Mensaje";
import Respuesta from "./analista/Respuesta";
import Sugeridas from "./analista/Sugeridas";

export type ModoPanel = "modal" | "pagina";

type EstadoIa = "detectando" | "si" | "no";

interface EntradaDirecta {
  id: number;
  pregunta: string;
  herramienta: NombreHerramienta;
  args: Record<string, unknown>;
  estado: "cargando" | "listo";
  respuesta: RespuestaHerramienta<unknown> | null;
  /** aviso propio cuando el servidor devolvió 429 o la red falló */
  aviso: { motivo: "limite" | "error"; detalle: string } | null;
  /** índice del mensaje del chat tras el cual se muestra (para intercalar con la conversación con IA) */
  despuesDe: number;
}

const MAX_TEXTO = 2000;

/** "HH:MM" en hora de Colombia (UTC-5), calculada en el cliente para los avisos. */
function horaColombia(d = new Date()) {
  const b = new Date(d.getTime() - 5 * 3600_000);
  return `${String(b.getUTCHours()).padStart(2, "0")}:${String(b.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Analista IA: herramientas deterministas sobre datos reales + chat con Gemini si hay clave.
 * Detecta la IA en el cliente (GET /api/analista); sin clave o si la IA falla, las mismas
 * preguntas se responden en modo directo (POST /api/analista/directo) sin modelo de lenguaje.
 */
export default function PanelAnalista({ modo = "modal" }: { modo?: ModoPanel }) {
  const [estadoIa, setEstadoIa] = useState<EstadoIa>("detectando");
  const [modelo, setModelo] = useState<string | null>(null);
  const [iaCaida, setIaCaida] = useState<string | null>(null); // texto del aviso cuando la IA no respondió
  const [directos, setDirectos] = useState<EntradaDirecta[]>([]);
  const [texto, setTexto] = useState("");
  const contador = useRef(0);
  const ultimaIntencion = useRef<{ pregunta: string; herramienta: NombreHerramienta; args: Record<string, unknown> } | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(0); // mensajes del chat al momento de lanzar una consulta directa
  const ejecutarDirectoRef = useRef<(p: string, h: NombreHerramienta, a: Record<string, unknown>) => void>(() => {});

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/analista" }), []);
  const { messages, sendMessage, status, stop } = useChat({
    id: "analista", // id estable: evita Math.random() en el prerender (Cache Components)
    transport,
    onError: () => {
      // La IA no respondió (sin clave en caliente, cuota, red): avisamos y caemos a modo directo con la misma intención.
      setIaCaida(`La IA no respondió a las ${horaColombia()}. Las preguntas siguen en modo directo, con las mismas herramientas.`);
      const u = ultimaIntencion.current;
      if (u) ejecutarDirectoRef.current(u.pregunta, u.herramienta, u.args);
    },
  });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/analista", { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { ia?: boolean; modelo?: string }) => {
        setEstadoIa(j.ia ? "si" : "no");
        setModelo(j.modelo ?? null);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setEstadoIa("no");
      });
    return () => ctrl.abort();
  }, []);

  const puedeIa = estadoIa === "si" && !iaCaida;
  const chatOcupado = status === "submitted" || status === "streaming";
  const directoOcupado = directos.some((d) => d.estado === "cargando");
  const ocupado = chatOcupado || directoOcupado;

  const ejecutarDirecto = useCallback(
    async (pregunta: string, herramienta: NombreHerramienta, args: Record<string, unknown>) => {
      const id = ++contador.current;
      setDirectos((ds) => [...ds, { id, pregunta, herramienta, args, estado: "cargando", respuesta: null, aviso: null, despuesDe: messagesRef.current }]);
      let respuesta: RespuestaHerramienta<unknown> | null = null;
      let aviso: EntradaDirecta["aviso"] = null;
      try {
        const r = await fetch("/api/analista/directo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ herramienta, args }),
        });
        if (r.status === 429) {
          const seg = Number(r.headers.get("Retry-After") ?? "0");
          const min = Math.max(1, Math.ceil(seg / 60));
          aviso = { motivo: "limite", detalle: `Alcanzaste el límite de consultas por hora. Vuelve a intentar en ${min} min.` };
        } else {
          const j: unknown = await r.json();
          if (esRespuesta(j)) respuesta = j;
          else aviso = { motivo: "error", detalle: "El servidor devolvió una respuesta que no se pudo interpretar." };
        }
      } catch {
        aviso = { motivo: "error", detalle: `El servidor no respondió a las ${horaColombia()}. Revisa la conexión e intenta de nuevo.` };
      }
      setDirectos((ds) => ds.map((d) => (d.id === id ? { ...d, estado: "listo", respuesta, aviso } : d)));
    },
    [],
  );
  // Los refs se actualizan fuera del render (regla react-hooks/refs).
  useEffect(() => {
    ejecutarDirectoRef.current = ejecutarDirecto;
  }, [ejecutarDirecto]);
  useEffect(() => {
    messagesRef.current = messages.length;
  }, [messages.length]);

  function preguntar(pregunta: string, sugerida?: Sugerida) {
    const limpio = pregunta.trim().slice(0, MAX_TEXTO);
    if (!limpio || ocupado) return;
    const herramienta: NombreHerramienta = sugerida?.herramienta ?? "buscarConjunto";
    const args = sugerida?.args ?? { texto: limpio.slice(0, 80) };
    setTexto("");
    if (puedeIa) {
      ultimaIntencion.current = { pregunta: limpio, herramienta, args };
      void sendMessage({ text: limpio });
    } else {
      ejecutarDirecto(limpio, herramienta, args);
    }
  }

  // Auto-scroll al final cuando llega contenido nuevo.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, directos]);

  // Línea de tiempo: mensajes del chat intercalados con las consultas directas según el momento en que se hicieron.
  const linea = useMemo(() => {
    const items: React.ReactNode[] = [];
    const pintarDirecto = (d: EntradaDirecta) =>
      items.push(
        <div key={`d-${d.id}`} className="flex flex-col gap-2.5">
          <Burbuja rol="user">
            <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-white">{d.pregunta}</p>
          </Burbuja>
          <Burbuja rol="assistant">
            {d.estado === "cargando" && <Consultando nombre={NOMBRES_HERRAMIENTAS[d.herramienta]} />}
            {d.estado === "listo" && d.aviso && (
              <AvisoRespuesta
                motivo={d.aviso.motivo}
                detalle={d.aviso.detalle}
                onReintentar={d.aviso.motivo === "error" ? () => ejecutarDirecto(d.pregunta, d.herramienta, d.args) : undefined}
              />
            )}
            {d.estado === "listo" && d.respuesta && !d.respuesta.ok && (
              <AvisoRespuesta
                motivo={d.respuesta.motivo}
                detalle={d.respuesta.detalle}
                onReintentar={d.respuesta.motivo === "error" ? () => ejecutarDirecto(d.pregunta, d.herramienta, d.args) : undefined}
              />
            )}
            {d.estado === "listo" && d.respuesta && d.respuesta.ok && <Respuesta herramienta={d.herramienta} respuesta={d.respuesta} />}
            <span className="font-mono text-[11px] text-[#64748B]">Modo directo · sin modelo de lenguaje · {NOMBRES_HERRAMIENTAS[d.herramienta]}</span>
          </Burbuja>
        </div>,
      );
    for (let i = 0; i <= messages.length; i++) {
      directos.filter((d) => d.despuesDe === i).forEach(pintarDirecto);
      const m = messages[i];
      if (m) items.push(<Mensaje key={m.id} mensaje={m} onVerSinIA={(h, a) => ejecutarDirecto(`Ver sin IA: ${NOMBRES_HERRAMIENTAS[h]}`, h, a)} />);
    }
    directos.filter((d) => d.despuesDe > messages.length).forEach(pintarDirecto);
    return items;
  }, [messages, directos, ejecutarDirecto]);

  const vacio = messages.length === 0 && directos.length === 0;

  return (
    <div className={`flex flex-col gap-5 p-4 sm:p-6 ${modo === "pagina" ? "min-h-[60vh]" : ""}`}>
      {/* Estado de la IA */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px] text-[#475569]" role="status">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: estadoIa === "detectando" ? "#64748B" : puedeIa ? "#16A34A" : "#D97706" }}
          />
          {estadoIa === "detectando" && "Detectando capacidades de esta instalación…"}
          {estadoIa === "si" && !iaCaida && `Con IA (${modelo ?? "Gemini"}) · cada cifra sale de una herramienta verificable`}
          {estadoIa === "si" && iaCaida && "Modo directo (la IA no respondió) · mismas herramientas, sin modelo"}
          {estadoIa === "no" && "Modo directo · sin clave de IA en esta instalación · mismas herramientas, sin modelo"}
        </span>
        {chatOcupado && (
          <button type="button" onClick={stop} className="rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F]">
            Detener
          </button>
        )}
      </div>

      {estadoIa === "no" && vacio && (
        <AvisoRespuesta
          motivo="sin-clave"
          detalle="Esta instalación no tiene clave de Gemini. El Analista responde en modo directo: las mismas preguntas, las mismas herramientas deterministas y las mismas citas, sin modelo de lenguaje. El texto libre busca conjuntos en el catálogo por nombre."
          compacto
        />
      )}
      {iaCaida && (
        <AvisoRespuesta motivo="ia-caida" detalle={iaCaida} onReintentar={() => setIaCaida(null)} compacto />
      )}

      {/* Conversación */}
      <div className="flex flex-col gap-4" aria-live="polite" aria-busy={ocupado}>
        {vacio && (
          <div className="rounded-2xl border border-dashed border-[#C9D6E8] bg-[#FBFCFE] px-4 py-5 text-center">
            <p className="m-0 text-[15px] font-semibold text-[#1E3A5F]">Pregunta en español sobre los datos abiertos de Medellín.</p>
            <p className="m-0 mt-1 text-[13px] text-[#475569]">
              Cada respuesta trae la cifra con su conjunto, su campo, su licencia y su fecha de corte. Nada se inventa: todo sale de MEData, SIATA y
              datos.gov.co.
            </p>
          </div>
        )}
        {linea}
        {chatOcupado && messages[messages.length - 1]?.role === "user" && <Consultando nombre="al Analista" />}
        <div ref={finRef} />
      </div>

      <Sugeridas onElegir={(s) => preguntar(s.texto, s)} deshabilitado={ocupado || estadoIa === "detectando"} />

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          preguntar(texto);
        }}
      >
        <label className="sr-only" htmlFor="pregunta-analista">
          Escribe tu pregunta
        </label>
        <input
          id="pregunta-analista"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAX_TEXTO}
          placeholder={puedeIa ? "Escribe tu pregunta…" : "Busca un conjunto por nombre, p. ej. “incidentes viales”…"}
          disabled={estadoIa === "detectando"}
          className="min-w-0 flex-1 rounded-xl border border-[#E3EAF3] px-3.5 py-2.5 text-[14px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#2563EB] focus:outline-none disabled:bg-[#F4F7FB]"
        />
        <button
          type="submit"
          disabled={ocupado || estadoIa === "detectando" || !texto.trim()}
          className="rounded-xl bg-[#2563EB] px-[18px] py-2.5 text-sm font-bold text-white hover:bg-[#1D4FD7] disabled:opacity-60"
        >
          {ocupado ? "Consultando…" : puedeIa ? "Preguntar" : "Buscar"}
        </button>
      </form>
      <span className="font-mono text-[11.5px] text-[#475569]">
        El modelo no genera cifras: invoca funciones deterministas sobre MEData, SIATA y datos.gov.co. Sin clave, las mismas funciones responden en modo
        directo.
      </span>
    </div>
  );
}

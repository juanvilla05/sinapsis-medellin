"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Respuesta as RespuestaHerramienta } from "@/lib/analista/herramientas";
import { NOMBRES_HERRAMIENTAS, SUGERIDAS, type NombreHerramienta, type Sugerida } from "@/lib/analista/sugeridas";
import AvisoRespuesta from "./analista/AvisoRespuesta";
import Mensaje, { Burbuja, Consultando, esRespuesta } from "./analista/Mensaje";
import Respuesta from "./analista/Respuesta";
import Sugeridas from "./analista/Sugeridas";

export type ModoPanel = "modal" | "pagina" | "flotante";

/** Origen de un resultado de herramienta: chat con IA o modo directo (sin modelo). */
export type OrigenResultado = "chat" | "directo";

export interface PropsPanelAnalista {
  modo?: ModoPanel;
  /**
   * Contrato con el mundo 3D: se llama una vez por cada respuesta terminada (chat `onFinish` y cada
   * consulta directa que pasa a `listo`). La Agencia cuenta con esto las preguntas del Analista.
   */
  onRespuesta?: () => void;
  /**
   * Se llama UNA vez por cada herramienta terminada: en el chat, cada parte tool-* que llega a 'output-available'
   * (con la salida tal cual); en modo directo, cada consulta que pasa a 'listo' con respuesta ok. PulsoBot lo usa
   * para mover el mapa con los datos de la respuesta.
   */
  onResultado?: (herramienta: string, respuesta: unknown, origen?: OrigenResultado) => void;
  /** Texto final de la IA de cada respuesta del chat (para leerlo en voz alta). */
  onTextoIa?: (texto: string) => void;
  /**
   * Pregunta enviada desde fuera (bus de PULSO, voz). Cada `id` nuevo se envía una vez: por chat si hay IA; sin IA,
   * si el texto coincide con una sugerida se responde en directo con su herramienta y si no, se muestra un aviso.
   */
  pregunta?: { id: number; texto: string };
  /** Preguntas propias de quien monta el panel (se muestran primero y también se reconocen sin IA). */
  sugeridasExtra?: Sugerida[];
  /** Contenido del estado vacío en lugar del texto por defecto (bienvenida de PulsoBot). */
  bienvenida?: React.ReactNode;
  /** Texto que se escribe en el campo mientras se dicta por voz. */
  borrador?: string;
  /** Control extra junto al campo de pregunta (p. ej. el micrófono de PulsoBot). */
  accesorioEntrada?: React.ReactNode;
}

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
  /** pregunta libre sin IA que no coincide con una sugerida: solo se muestra el aviso, no se consulta nada */
  sinIa?: boolean;
  /** índice del mensaje del chat tras el cual se muestra (para intercalar con la conversación con IA) */
  despuesDe: number;
}

const MAX_TEXTO = 2000;

/** Normaliza para comparar una pregunta con las sugeridas: sin tildes, sin signos, minúsculas. */
const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:"“”«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Texto de una respuesta del modelo (partes de texto unidas). */
const textoDeMensaje = (m: { parts: { type: string; text?: string }[] }) =>
  m.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();

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
export default function PanelAnalista({
  modo = "modal",
  onRespuesta,
  onResultado,
  onTextoIa,
  pregunta: preguntaExterna,
  sugeridasExtra,
  bienvenida,
  borrador,
  accesorioEntrada,
}: PropsPanelAnalista) {
  const flotante = modo === "flotante";
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
  const onRespuestaRef = useRef<(() => void) | undefined>(undefined);
  const onResultadoRef = useRef<PropsPanelAnalista["onResultado"]>(undefined);
  const onTextoIaRef = useRef<PropsPanelAnalista["onTextoIa"]>(undefined);
  const resultadosVistos = useRef(new Set<string>()); // toolCallId ya notificados por onResultado
  const preguntaAtendida = useRef<number | null>(null);
  const preguntarRef = useRef<(p: string, s?: Sugerida, externa?: boolean) => void>(() => {});

  // Borrador de voz: se copia al campo cuando cambia (ajuste de estado durante el render, sin efecto).
  const [borradorPrevio, setBorradorPrevio] = useState(borrador);
  if (borrador !== borradorPrevio) {
    setBorradorPrevio(borrador);
    if (borrador !== undefined) setTexto(borrador.slice(0, MAX_TEXTO));
  }

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/analista" }), []);
  const { messages, sendMessage, status, stop } = useChat({
    id: flotante ? "pulsobot" : "analista", // id estable: evita Math.random() en el prerender (Cache Components)
    transport,
    onFinish: ({ message, isError, isAbort }) => {
      onRespuestaRef.current?.();
      if (!isError && !isAbort && message.role === "assistant") {
        const t = textoDeMensaje(message);
        if (t) onTextoIaRef.current?.(t);
      }
    },
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
      onRespuestaRef.current?.();
      if (respuesta?.ok) onResultadoRef.current?.(herramienta, respuesta, "directo");
    },
    [],
  );
  // Los refs se actualizan fuera del render (regla react-hooks/refs).
  useEffect(() => {
    onRespuestaRef.current = onRespuesta;
  }, [onRespuesta]);
  useEffect(() => {
    onResultadoRef.current = onResultado;
    onTextoIaRef.current = onTextoIa;
  }, [onResultado, onTextoIa]);
  useEffect(() => {
    ejecutarDirectoRef.current = ejecutarDirecto;
  }, [ejecutarDirecto]);

  // Chat: cada parte de herramienta que llega a 'output-available' se notifica una sola vez (por toolCallId).
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts) {
        if (!isToolUIPart(part) || part.state !== "output-available") continue;
        if (resultadosVistos.current.has(part.toolCallId)) continue;
        resultadosVistos.current.add(part.toolCallId);
        onResultadoRef.current?.(getToolName(part), part.output, "chat");
      }
    }
  }, [messages]);
  useEffect(() => {
    messagesRef.current = messages.length;
  }, [messages.length]);

  const todasSugeridas = useMemo(() => [...(sugeridasExtra ?? []), ...SUGERIDAS], [sugeridasExtra]);

  /** Pregunta libre sin IA que no es una sugerida: aviso propio en la conversación, sin consultar nada. */
  function avisarSinIa(pregunta: string) {
    const id = ++contador.current;
    const detalle = iaCaida
      ? "La IA no está respondiendo ahora. Mientras tanto respondo en modo directo las preguntas sugeridas, con las mismas herramientas y citas: elige una de la lista."
      : "Esta instalación no tiene clave de IA. En modo directo respondo las preguntas sugeridas, con las mismas herramientas y citas: elige una de la lista.";
    setDirectos((ds) => [
      ...ds,
      {
        id,
        pregunta,
        herramienta: "explicarFuentes",
        args: {},
        estado: "listo",
        respuesta: null,
        aviso: { motivo: "error", detalle },
        sinIa: true,
        despuesDe: messagesRef.current,
      },
    ]);
  }

  function preguntar(pregunta: string, sugerida?: Sugerida, externa = false) {
    const limpio = pregunta.trim().slice(0, MAX_TEXTO);
    if (!limpio || ocupado) return;
    // En PulsoBot (y para preguntas que llegan de fuera) una pregunta escrita o dictada igual a una sugerida usa su herramienta sin IA.
    if (!sugerida && (flotante || externa)) {
      const n = normalizar(limpio);
      sugerida = todasSugeridas.find((s) => normalizar(s.texto) === n);
    }
    if (externa && !puedeIa && !sugerida) {
      setTexto("");
      avisarSinIa(limpio);
      return;
    }
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

  useEffect(() => {
    preguntarRef.current = preguntar;
  });

  // Pregunta externa (bus de PULSO o voz): se envía una vez por id, cuando ya se sabe si hay IA y el panel está libre.
  useEffect(() => {
    if (!preguntaExterna || preguntaAtendida.current === preguntaExterna.id) return;
    if (estadoIa === "detectando" || ocupado) return;
    preguntaAtendida.current = preguntaExterna.id;
    preguntarRef.current(preguntaExterna.texto, undefined, true);
  }, [preguntaExterna, estadoIa, ocupado]);

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
          <Burbuja rol="user" oscuro={flotante}>
            <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-tinta">{d.pregunta}</p>
          </Burbuja>
          <Burbuja rol="assistant" oscuro={flotante}>
            {d.sinIa && d.aviso && <AvisoRespuesta motivo="sin-clave" titulo="Sin IA respondo las preguntas sugeridas" detalle={d.aviso.detalle} compacto />}
            {!d.sinIa && d.estado === "cargando" && <Consultando nombre={NOMBRES_HERRAMIENTAS[d.herramienta]} oscuro={flotante} />}
            {!d.sinIa && d.estado === "listo" && d.aviso && (
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
            {!d.sinIa && (
              <span className={`font-mono text-[11px] ${flotante ? "text-tinta/60" : "text-[#64748B]"}`}>
                Modo directo · sin modelo de lenguaje · {NOMBRES_HERRAMIENTAS[d.herramienta]}
              </span>
            )}
          </Burbuja>
        </div>,
      );
    for (let i = 0; i <= messages.length; i++) {
      directos.filter((d) => d.despuesDe === i).forEach(pintarDirecto);
      const m = messages[i];
      if (m) items.push(<Mensaje key={m.id} mensaje={m} oscuro={flotante} onVerSinIA={(h, a) => ejecutarDirecto(`Ver sin IA: ${NOMBRES_HERRAMIENTAS[h]}`, h, a)} />);
    }
    directos.filter((d) => d.despuesDe > messages.length).forEach(pintarDirecto);
    return items;
  }, [messages, directos, ejecutarDirecto, flotante]);

  const vacio = messages.length === 0 && directos.length === 0;

  const estado = (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${flotante ? "shrink-0 border-b border-tinta/10 px-4 py-2.5" : ""}`}>
      <span className={`flex items-center gap-2 ${flotante ? "text-[12px] text-tinta/75" : "text-[12.5px] text-[#475569]"}`} role="status">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 flex-none rounded-full"
          style={{ background: estadoIa === "detectando" ? "#64748B" : puedeIa ? "#16A34A" : "#D97706" }}
        />
        {flotante ? (
          <>
            {estadoIa === "detectando" && "Detectando si hay IA en esta instalación…"}
            {estadoIa === "si" && !iaCaida && `Con IA (${modelo ?? "Gemini"}) · cifras de herramientas verificables`}
            {estadoIa === "si" && iaCaida && "Modo directo (la IA no respondió) · mismas herramientas"}
            {estadoIa === "no" && "Modo directo · sin clave de IA · mismas herramientas y citas"}
          </>
        ) : (
          <>
            {estadoIa === "detectando" && "Detectando capacidades de esta instalación…"}
            {estadoIa === "si" && !iaCaida && `Con IA (${modelo ?? "Gemini"}) · cada cifra sale de una herramienta verificable`}
            {estadoIa === "si" && iaCaida && "Modo directo (la IA no respondió) · mismas herramientas, sin modelo"}
            {estadoIa === "no" && "Modo directo · sin clave de IA en esta instalación · mismas herramientas, sin modelo"}
          </>
        )}
      </span>
      {chatOcupado && (
        <button type="button" onClick={stop} className="rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F]">
          Detener
        </button>
      )}
    </div>
  );

  const avisos = (
    <>
      {estadoIa === "no" && vacio && (
        <AvisoRespuesta
          motivo="sin-clave"
          detalle={
            flotante
              ? "Esta instalación no tiene clave de Gemini. Respondo en modo directo las preguntas sugeridas, con las mismas herramientas deterministas y las mismas citas. Si escribes otra cosa, busco conjuntos del catálogo por nombre."
              : "Esta instalación no tiene clave de Gemini. El Analista responde en modo directo: las mismas preguntas, las mismas herramientas deterministas y las mismas citas, sin modelo de lenguaje. El texto libre busca conjuntos en el catálogo por nombre."
          }
          compacto
        />
      )}
      {iaCaida && <AvisoRespuesta motivo="ia-caida" detalle={iaCaida} onReintentar={() => setIaCaida(null)} compacto />}
    </>
  );

  const conversacion = (
    <div className="flex flex-col gap-4" aria-live="polite" aria-busy={ocupado}>
      {vacio &&
        (bienvenida ?? (
          <div className="rounded-2xl border border-dashed border-[#C9D6E8] bg-[#FBFCFE] px-4 py-5 text-center">
            <p className="m-0 text-[15px] font-semibold text-[#1E3A5F]">Pregunta en español sobre los datos abiertos de Medellín.</p>
            <p className="m-0 mt-1 text-[13px] text-[#475569]">
              Cada respuesta trae la cifra con su conjunto, su campo, su licencia y su fecha de corte. Nada se inventa: todo sale de MEData, SIATA y
              datos.gov.co.
            </p>
          </div>
        ))}
      {linea}
      {chatOcupado && messages[messages.length - 1]?.role === "user" && <Consultando nombre="al Analista" oscuro={flotante} />}
      <div ref={finRef} />
    </div>
  );

  const deshabilitarSugeridas = ocupado || estadoIa === "detectando";

  const formulario = (
    <form
      className={
        flotante
          ? "flex shrink-0 items-center gap-2 border-t border-tinta/10 bg-fondo px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          : "flex flex-col gap-2 sm:flex-row"
      }
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
        placeholder={
          flotante
            ? puedeIa
              ? "Pregúntale a PULSO…"
              : "Elige una sugerida o busca un conjunto…"
            : puedeIa
              ? "Escribe tu pregunta…"
              : "Busca un conjunto por nombre, p. ej. “incidentes viales”…"
        }
        disabled={estadoIa === "detectando"}
        className={
          flotante
            ? "min-w-0 flex-1 rounded-xl border border-tinta/15 bg-tinta/[0.06] px-3.5 py-2.5 text-base text-tinta placeholder:text-tinta/55 focus:border-[#60A5FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]/50 disabled:opacity-60 sm:text-[14px]"
            : "min-w-0 flex-1 rounded-xl border border-[#E3EAF3] px-3.5 py-2.5 text-[14px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#2563EB] focus:outline-none disabled:bg-[#F4F7FB]"
        }
      />
      {accesorioEntrada}
      <button
        type="submit"
        disabled={ocupado || estadoIa === "detectando" || !texto.trim()}
        className={
          flotante
            ? "shrink-0 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-tinta hover:bg-[#1D4FD7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA] disabled:opacity-60"
            : "rounded-xl bg-[#2563EB] px-[18px] py-2.5 text-sm font-bold text-tinta hover:bg-[#1D4FD7] disabled:opacity-60"
        }
      >
        {ocupado ? (flotante ? "…" : "Consultando…") : flotante ? "Enviar" : puedeIa ? "Preguntar" : "Buscar"}
      </button>
    </form>
  );

  if (flotante) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-fondo text-tinta">
        {estado}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
          {avisos}
          {conversacion}
          <Sugeridas
            onElegir={(s) => preguntar(s.texto, s)}
            deshabilitado={deshabilitarSugeridas}
            extra={sugeridasExtra && sugeridasExtra.length > 0 ? sugeridasExtra : undefined}
            oscuro
            plegadas={!vacio}
          />
        </div>
        {formulario}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 p-4 sm:p-6 ${modo === "pagina" ? "min-h-[60vh]" : ""}`}>
      {/* Estado de la IA */}
      {estado}
      {avisos}
      {/* Conversación */}
      {conversacion}
      <Sugeridas onElegir={(s) => preguntar(s.texto, s)} deshabilitado={deshabilitarSugeridas} />
      {formulario}
      <span className="font-mono text-[11.5px] text-[#475569]">
        El modelo no genera cifras: invoca funciones deterministas sobre MEData, SIATA y datos.gov.co. Sin clave, las mismas funciones responden en modo
        directo.
      </span>
    </div>
  );
}

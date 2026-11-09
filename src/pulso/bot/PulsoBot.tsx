"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PanelAnalista, { type OrigenResultado } from "@/mundo/paneles/PanelAnalista";
import { emitir, escuchar } from "../bus";
import { accionesMapa, resumenParaVoz } from "./acciones";
import { SUGERIDAS_BOT } from "./sugeridas";
import { useDictado, useLectura } from "./voz";

type EstadoIa = "detectando" | "si" | "no";

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA]";

/** Orbe de PULSO: gradiente con latido (el anillo se oculta con prefers-reduced-motion). */
function Orbe({ tam = "h-12 w-12", latido = true }: { tam?: string; latido?: boolean }) {
  return (
    <span className={`relative flex flex-none items-center justify-center ${tam}`} aria-hidden="true">
      {latido && <span className="absolute inset-0 animate-ping rounded-full bg-[#38BDF8]/40 [animation-duration:2.4s] motion-reduce:hidden" />}
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#7DD3FC,#2563EB_55%,#1E3A8A)] shadow-[0_0_24px_rgba(56,189,248,.55)]" />
      <span className="relative h-1/3 w-1/3 rounded-full bg-white/85 motion-safe:animate-pulse" />
    </span>
  );
}

function IconoMicrofono() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function IconoCerrar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Bienvenida() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="m-0 text-[15px] font-semibold text-white">Hola, soy PulsoBot.</p>
      <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-white/75">
        Pregúntame por el aire, la seguridad vial o el hurto en Medellín. Te respondo con la cifra y su fuente (SIATA, MEData, Policía Nacional) y te lo
        muestro en el mapa.
      </p>
    </div>
  );
}

/**
 * PulsoBot: el Analista de SINAPSIS flotando sobre el mapa, con voz y acciones sobre el mapa.
 * Se coordina con el resto de PULSO solo por el bus: escucha 'panel' y 'preguntar'; emite 'panel', 'capa',
 * 'comuna', 'estacion' y 'rutas' con los datos de cada respuesta.
 */
export default function PulsoBot() {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false); // el Analista se monta al primer uso y se conserva al cerrar
  const [rutasAbiertas, setRutasAbiertas] = useState(false);
  const [minimizado, setMinimizado] = useState(false); // solo en móvil: deja ver el mapa tras una acción
  const [pregunta, setPregunta] = useState<{ id: number; texto: string } | undefined>(undefined);
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);
  const [ia, setIa] = useState<EstadoIa>("detectando");
  const contador = useRef(0);
  const orbeRef = useRef<HTMLButtonElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const cajonRef = useRef<HTMLElement>(null);
  const volverRef = useRef<HTMLButtonElement>(null);

  const lectura = useLectura();
  const { callar } = lectura;

  const enviar = useCallback((texto: string) => {
    const t = texto.trim();
    if (!t) return;
    contador.current += 1;
    setPregunta({ id: contador.current, texto: t });
    setMinimizado(false);
    setMontado(true);
  }, []);

  const dictado = useDictado(enviar);

  // ¿Hay IA en esta instalación? (mismo endpoint que usa el Analista)
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/analista", { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { ia?: boolean }) => setIa(j.ia ? "si" : "no"))
      .catch(() => {
        if (!ctrl.signal.aborted) setIa("no");
      });
    return () => ctrl.abort();
  }, []);

  // Bus: el shell abre/cierra paneles; cualquiera puede pedir una pregunta.
  useEffect(
    () =>
      escuchar((e) => {
        if (e.tipo === "panel") {
          const esBot = e.panel === "bot";
          setAbierto(esBot);
          setRutasAbiertas(e.panel === "rutas");
          if (esBot) setMontado(true);
          else {
            setMinimizado(false);
            callar();
          }
        } else if (e.tipo === "preguntar") {
          if (!e.texto.trim()) return;
          enviar(e.texto);
          emitir({ tipo: "panel", panel: "bot" });
        }
      }),
    [enviar, callar],
  );

  const cerrar = useCallback(() => emitir({ tipo: "panel", panel: null }), []);

  // Foco: al abrir va al botón de cerrar; al cerrar vuelve al orbe si el foco estaba en el cajón.
  const abiertoAntes = useRef(false);
  useEffect(() => {
    if (abierto && !abiertoAntes.current) cerrarRef.current?.focus({ preventScroll: true });
    if (!abierto && abiertoAntes.current && (!document.activeElement || document.activeElement === document.body || cajonRef.current?.contains(document.activeElement)))
      orbeRef.current?.focus({ preventScroll: true });
    abiertoAntes.current = abierto;
  }, [abierto]);

  // Móvil: si la hoja se minimiza con el foco dentro, el foco pasa al botón para volver a la conversación.
  useEffect(() => {
    if (!abierto || !minimizado || !volverRef.current) return;
    const a = document.activeElement;
    if (volverRef.current.offsetParent !== null && (!a || a === document.body || cajonRef.current?.contains(a))) volverRef.current.focus({ preventScroll: true });
  }, [abierto, minimizado]);

  // Esc cierra el cajón.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !ev.defaultPrevented) cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto, cerrar]);

  // El aviso "Te lo muestro en el mapa" se va solo.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const { leer } = lectura;
  const alResultado = useCallback(
    (herramienta: string, respuesta: unknown, origen?: OrigenResultado) => {
      const eventos = accionesMapa(herramienta, respuesta);
      if (eventos.length > 0) {
        for (const e of eventos) emitir(e);
        contador.current += 1;
        setAviso({ id: contador.current, texto: "Te lo muestro en el mapa" });
        setMinimizado(true);
      }
      if (origen === "directo") {
        const r = resumenParaVoz(herramienta, respuesta);
        if (r) leer(r);
      }
    },
    [leer],
  );

  const etiquetaIa = ia === "si" ? "IA" : ia === "no" ? "modo directo" : "…";
  const descripcionIa = ia === "si" ? "con IA" : ia === "no" ? "en modo directo, sin IA" : "detectando si hay IA";

  const microfono = dictado.soportado ? (
    <button
      type="button"
      onClick={dictado.escuchando ? dictado.detener : dictado.iniciar}
      aria-pressed={dictado.escuchando}
      aria-label={dictado.escuchando ? "Detener el dictado" : "Dictar la pregunta por voz"}
      title={dictado.escuchando ? "Detener el dictado" : "Dictar la pregunta por voz"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${foco} ${
        dictado.escuchando ? "border-[#F87171] bg-[#B91C1C] text-white motion-safe:animate-pulse" : "border-white/15 bg-white/[0.06] text-white hover:bg-white/10"
      }`}
    >
      <IconoMicrofono />
    </button>
  ) : null;

  const estadoVoz = dictado.escuchando
    ? "Escuchando… habla y haré la pregunta al terminar."
    : lectura.hablando
      ? "Leyendo la respuesta en voz alta…"
      : (dictado.error ?? null);

  return (
    <>
      {/* Botón flotante */}
      <button
        ref={orbeRef}
        type="button"
        onClick={() => emitir({ tipo: "panel", panel: "bot" })}
        aria-label={`Pregúntale a PULSO: abre PulsoBot, ${descripcionIa}`}
        aria-expanded={abierto}
        aria-controls="pulsobot-cajon"
        className={`absolute right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 items-center gap-3 rounded-full border border-white/15 bg-[#0B1220]/85 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,.45)] backdrop-blur transition-colors hover:border-[#60A5FA]/60 sm:right-6 sm:bottom-8 sm:pr-5 ${foco} ${
          abierto || rutasAbiertas ? "hidden" : "flex"
        }`}
      >
        <span className="relative">
          <Orbe />
          <span
            aria-hidden="true"
            className={`absolute -top-1.5 -left-2 rounded-full px-1.5 py-px text-[10px] font-bold sm:hidden ${
              ia === "si" ? "bg-[#16A34A] text-white" : ia === "no" ? "bg-[#FBBF24] text-[#0B1220]" : "bg-white/20 text-white"
            }`}
          >
            {ia === "no" ? "directo" : etiquetaIa}
          </span>
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-[14px] font-bold text-white">Pregúntale a PULSO</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/70" aria-hidden="true">
            <span className={`h-2 w-2 rounded-full ${ia === "si" ? "bg-[#22C55E]" : ia === "no" ? "bg-[#FBBF24]" : "bg-white/40"}`} />
            {ia === "si" ? "con IA" : ia === "no" ? "modo directo" : "conectando…"}
          </span>
        </span>
      </button>

      {/* Cajón (escritorio) / hoja a pantalla completa (móvil). Se oculta sin desmontar para conservar la conversación. */}
      <section
        ref={cajonRef}
        id="pulsobot-cajon"
        role="dialog"
        aria-modal="false"
        aria-labelledby="pulsobot-titulo"
        aria-describedby="pulsobot-subtitulo"
        className={`absolute inset-0 z-40 flex-col overflow-hidden bg-[#0B1220] text-white sm:inset-auto sm:top-[76px] sm:right-0 sm:bottom-0 sm:w-[420px] sm:rounded-tl-3xl sm:border-t sm:border-l sm:border-white/10 sm:shadow-[-20px_0_60px_rgba(0,0,0,.45)] ${
          abierto ? "flex" : "hidden"
        } ${minimizado ? "max-sm:hidden" : ""}`}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <Orbe tam="h-9 w-9" latido={false} />
          <div className="min-w-0 flex-1">
            <h2 id="pulsobot-titulo" className="m-0 flex flex-wrap items-center gap-2 text-[16px] font-extrabold tracking-wide">
              PulsoBot
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-normal ${
                  ia === "si" ? "bg-[#16A34A]/20 text-[#86EFAC]" : ia === "no" ? "bg-[#FBBF24]/15 text-[#FCD34D]" : "bg-white/10 text-white/70"
                }`}
              >
                {ia === "si" ? "IA" : ia === "no" ? "modo directo" : "detectando…"}
              </span>
            </h2>
            <p id="pulsobot-subtitulo" className="m-0 mt-0.5 text-[12px] text-white/70">
              disponible 24/7 · cada cifra con su fuente
            </p>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar PulsoBot"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white ${foco}`}
          >
            <IconoCerrar />
          </button>
        </header>

        {(lectura.soportada || estadoVoz || aviso) && (
          <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-4 py-2.5">
            {lectura.soportada && (
              <div className="flex items-center justify-between gap-3">
                <span id="pulsobot-voz" className="text-[12.5px] text-white/80">
                  Leer respuestas en voz alta
                </span>
                <div className="flex items-center gap-2">
                  {lectura.hablando && (
                    <button type="button" onClick={callar} className={`rounded-lg px-2 py-1 text-[12px] font-semibold text-[#93C5FD] hover:bg-white/10 ${foco}`}>
                      Callar
                    </button>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={lectura.activa}
                    aria-labelledby="pulsobot-voz"
                    onClick={() => lectura.setActiva(!lectura.activa)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${foco} ${lectura.activa ? "bg-[#2563EB]" : "bg-white/20"}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform motion-reduce:transition-none ${lectura.activa ? "translate-x-5" : ""}`}
                    />
                  </button>
                </div>
              </div>
            )}
            <div role="status" aria-live="polite" className="flex flex-col gap-1 empty:hidden">
              {estadoVoz && <p className="m-0 text-[12.5px] text-[#FCD34D]">{estadoVoz}</p>}
              {aviso && (
                <p key={aviso.id} className="m-0 flex items-center gap-2 text-[12.5px] font-semibold text-[#86EFAC]">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#22C55E]" />
                  {aviso.texto}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1">
          {montado && (
            <PanelAnalista
              modo="flotante"
              onResultado={alResultado}
              onTextoIa={leer}
              pregunta={pregunta}
              sugeridasExtra={SUGERIDAS_BOT}
              bienvenida={<Bienvenida />}
              borrador={dictado.parcial}
              accesorioEntrada={microfono}
            />
          )}
        </div>
      </section>

      {/* Móvil: tras mover el mapa, el cajón se minimiza a esta barra para que se vea el mapa. */}
      {abierto && minimizado && (
        <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0B1220]/95 p-2 pl-3 shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur sm:hidden">
          <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full bg-[#22C55E]" />
          <p className="m-0 min-w-0 flex-1 text-[13px] leading-tight font-semibold text-white" role="status">
            Te lo muestro en el mapa
          </p>
          <button
            ref={volverRef}
            type="button"
            onClick={() => setMinimizado(false)}
            className={`shrink-0 rounded-xl bg-[#2563EB] px-3 py-2 text-[13px] font-bold text-white hover:bg-[#1D4FD7] ${foco}`}
          >
            Volver al chat
          </button>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar PulsoBot"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 ${foco}`}
          >
            <IconoCerrar />
          </button>
        </div>
      )}
    </>
  );
}

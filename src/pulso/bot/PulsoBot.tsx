"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PanelAnalista, { type OrigenResultado } from "@/mundo/paneles/PanelAnalista";
import { emitir, escuchar } from "../bus";
import { accionesMapa, mueveElMapa, resumenParaVoz } from "./acciones";
import LogoPulsoBot, { type EstadoBot } from "./LogoPulsoBot";
import { SUGERIDAS_BOT } from "./sugeridas";
import { useDictado, useLectura } from "./voz";

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA]";
/** silencios seguidos antes de pausar la conversación (cada escucha dura unos 7 s en el navegador) */
const MAX_SILENCIOS = 3;

function IconoMicrofono({ clase = "h-5 w-5" }: { clase?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clase} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function IconoAltavoz({ encendido }: { encendido: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
      {encendido ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
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
    <div className="rounded-2xl border border-tinta/10 bg-tinta/[0.04] p-4">
      <p className="m-0 text-[16px] font-bold text-tinta">Hola, soy PulsoBot.</p>
      <p className="m-0 mt-1 text-[14px] leading-relaxed text-tinta/80">Pregúntame por Medellín: el aire, las vías, el hurto o cómo llegar. Puedes escribirme o hablarme.</p>
    </div>
  );
}

/** Barras que se mueven mientras PulsoBot escucha o habla. */
function Ondas({ activo }: { activo: boolean }) {
  return (
    <span className="flex h-5 items-center gap-[3px]" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-current ${activo ? "motion-safe:animate-pulse" : ""}`}
          style={{ height: activo ? `${[55, 100, 70, 90, 45][i]}%` : "25%", animationDelay: `${i * 120}ms`, animationDuration: "700ms" }}
        />
      ))}
    </span>
  );
}

/**
 * PulsoBot: el asistente de PULSO Medellín. Flota sobre el mapa, responde con datos y su fuente, mueve el mapa y
 * maneja la plataforma. Con "Conversar" se habla de corrido: escucha, responde en voz alta y vuelve a escuchar.
 * Se coordina con el resto de PULSO solo por el bus.
 */
export default function PulsoBot() {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false); // el panel se monta al primer uso y se conserva al cerrar
  const [rutasAbiertas, setRutasAbiertas] = useState(false);
  const [minimizado, setMinimizado] = useState(false); // en celular y tablet: deja ver el mapa tras una acción
  const [pregunta, setPregunta] = useState<{ id: number; texto: string } | undefined>(undefined);
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);
  const [conversando, setConversando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [pausada, setPausada] = useState(false);
  const contador = useRef(0);
  const botonRef = useRef<HTMLButtonElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const cajonRef = useRef<HTMLElement>(null);
  const volverRef = useRef<HTMLButtonElement>(null);
  const conversandoRef = useRef(false);
  const pensandoRef = useRef(false);
  const silencios = useRef(0);
  const reanudar = useRef<number | undefined>(undefined);
  const escucharRef = useRef<() => void>(() => {});

  const marcarPensando = useCallback((v: boolean) => {
    pensandoRef.current = v;
    setPensando(v);
  }, []);

  const enviar = useCallback(
    (texto: string) => {
      const t = texto.trim();
      if (!t) return;
      contador.current += 1;
      setPregunta({ id: contador.current, texto: t });
      setMinimizado(false);
      setMontado(true);
      if (conversandoRef.current) marcarPensando(true);
    },
    [marcarPensando],
  );

  // Cuando PulsoBot termina de hablar en conversación, vuelve a escuchar.
  const lectura = useLectura(
    useCallback(() => {
      if (conversandoRef.current) {
        silencios.current = 0;
        escucharRef.current();
      }
    }, []),
  );
  const { leer, callar, hablandoRef } = lectura;

  const dictado = useDictado(
    useCallback(
      (texto: string) => {
        silencios.current = 0;
        enviar(texto);
      },
      [enviar],
    ),
    useCallback(
      (codigo: string | null) => {
        if (!conversandoRef.current || pensandoRef.current || hablandoRef.current) return;
        // sin permiso de micrófono no hay conversación posible
        if (codigo === "not-allowed" || codigo === "service-not-allowed" || codigo === "audio-capture") {
          conversandoRef.current = false;
          setConversando(false);
          return;
        }
        silencios.current += 1;
        if (silencios.current >= MAX_SILENCIOS) setPausada(true);
        else escucharRef.current();
      },
      [hablandoRef],
    ),
  );
  const { iniciar: iniciarDictado, cancelar: cancelarDictado } = dictado;

  useEffect(() => {
    escucharRef.current = () => {
      setPausada(false);
      iniciarDictado();
    };
  }, [iniciarDictado]);

  const terminarConversacion = useCallback(() => {
    conversandoRef.current = false;
    setConversando(false);
    setPausada(false);
    marcarPensando(false);
    window.clearTimeout(reanudar.current);
    cancelarDictado();
    callar();
  }, [callar, cancelarDictado, marcarPensando]);

  const iniciarConversacion = useCallback(() => {
    conversandoRef.current = true;
    silencios.current = 0;
    setConversando(true);
    setMontado(true);
    callar();
    escucharRef.current();
  }, [callar]);

  /** Interrumpe lo que esté diciendo y vuelve a escuchar. */
  const interrumpir = useCallback(() => {
    callar();
    silencios.current = 0;
    escucharRef.current();
  }, [callar]);

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
            // PulsoBot puede abrir el planificador de rutas sin cortar la conversación
            if (!(e.panel === "rutas" && conversandoRef.current)) terminarConversacion();
          }
        } else if (e.tipo === "preguntar") {
          if (!e.texto.trim()) return;
          enviar(e.texto);
          emitir({ tipo: "panel", panel: "bot" });
        }
      }),
    [enviar, terminarConversacion],
  );

  const cerrar = useCallback(() => emitir({ tipo: "panel", panel: null }), []);

  // Foco: al abrir va al botón de cerrar; al cerrar vuelve al botón flotante si el foco estaba en el cajón.
  const abiertoAntes = useRef(false);
  useEffect(() => {
    if (abierto && !abiertoAntes.current) cerrarRef.current?.focus({ preventScroll: true });
    if (!abierto && abiertoAntes.current && (!document.activeElement || document.activeElement === document.body || cajonRef.current?.contains(document.activeElement)))
      botonRef.current?.focus({ preventScroll: true });
    abiertoAntes.current = abierto;
  }, [abierto]);

  // Celular y tablet: si la hoja se minimiza con el foco dentro, el foco pasa al botón para volver a la conversación.
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

  useEffect(() => () => window.clearTimeout(reanudar.current), []);

  /** PulsoBot habla: en conversación primero deja de escuchar, para no oírse a sí mismo. */
  const decir = useCallback(
    (texto: string) => {
      if (conversandoRef.current) {
        window.clearTimeout(reanudar.current);
        cancelarDictado();
      }
      leer(texto, conversandoRef.current);
    },
    [cancelarDictado, leer],
  );

  const alResultado = useCallback(
    (herramienta: string, respuesta: unknown, origen?: OrigenResultado) => {
      const eventos = accionesMapa(herramienta, respuesta);
      if (eventos.length > 0) {
        for (const e of eventos) emitir(e);
        if (mueveElMapa(eventos)) {
          contador.current += 1;
          setAviso({ id: contador.current, texto: "Te lo muestro en el mapa" });
          setMinimizado(true);
        }
      }
      if (origen === "directo") {
        const r = resumenParaVoz(herramienta, respuesta);
        if (r) decir(r);
      }
    },
    [decir],
  );

  const alTextoIa = useCallback((texto: string) => decir(texto), [decir]);

  // Cada respuesta terminada: si no hay nada que decir en voz alta, la conversación vuelve a escuchar.
  const alRespuesta = useCallback(() => {
    marcarPensando(false);
    if (!conversandoRef.current) return;
    window.clearTimeout(reanudar.current);
    reanudar.current = window.setTimeout(() => {
      if (conversandoRef.current && !hablandoRef.current && !pensandoRef.current) escucharRef.current();
    }, 700);
  }, [hablandoRef, marcarPensando]);

  const estadoBot: EstadoBot = dictado.escuchando ? "escuchando" : lectura.hablando ? "hablando" : pensando ? "pensando" : "reposo";
  const textoEstado = pausada
    ? "Sigo aquí. Toca para seguir hablando."
    : dictado.escuchando
      ? dictado.parcial || "Te escucho…"
      : lectura.hablando
        ? "Te estoy respondiendo…"
        : pensando
          ? "Estoy consultando los datos…"
          : "Un momento…";

  const botonConversar = dictado.soportado ? (
    <button
      type="button"
      onClick={conversando ? terminarConversacion : iniciarConversacion}
      aria-pressed={conversando}
      aria-label={conversando ? "Terminar la conversación por voz" : "Conversar por voz con PulsoBot"}
      title={conversando ? "Terminar la conversación" : "Conversar por voz"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${foco} ${
        conversando ? "border-[#22C55E] bg-[#16A34A] text-white" : "border-tinta/15 bg-tinta/[0.06] text-tinta hover:bg-tinta/10"
      }`}
    >
      <IconoMicrofono />
    </button>
  ) : null;

  return (
    <>
      {/* Botón flotante */}
      <button
        ref={botonRef}
        type="button"
        onClick={() => emitir({ tipo: "panel", panel: "bot" })}
        aria-label="Abrir PulsoBot, el asistente de PULSO Medellín"
        aria-expanded={abierto}
        aria-controls="pulsobot-cajon"
        className={`absolute right-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.25rem)] z-30 items-center gap-2.5 rounded-full border border-tinta/15 bg-fondo/90 p-1.5 pr-4 shadow-[0_10px_40px_rgba(0,0,0,.45)] backdrop-blur transition-colors hover:border-[#60A5FA]/60 sm:right-6 sm:bottom-8 sm:gap-3 sm:pr-5 ${foco} ${
          abierto || rutasAbiertas ? "hidden" : "flex"
        }`}
      >
        <LogoPulsoBot tam="h-11 w-11 sm:h-12 sm:w-12" estado={estadoBot} />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[15px] font-extrabold text-tinta">PulsoBot</span>
          <span className="hidden text-[12.5px] text-tinta/70 sm:block">Háblame o escríbeme</span>
        </span>
      </button>

      {/* Cajón (escritorio) / hoja a pantalla completa (móvil). Se oculta sin desmontar para conservar la conversación. */}
      <section
        ref={cajonRef}
        id="pulsobot-cajon"
        role="dialog"
        aria-modal="false"
        aria-labelledby="pulsobot-titulo"
        className={`absolute inset-0 z-40 flex-col overflow-hidden bg-fondo text-tinta sm:inset-auto sm:top-[76px] sm:right-0 sm:bottom-0 sm:w-[420px] sm:rounded-tl-3xl sm:border-t sm:border-l sm:border-tinta/10 sm:shadow-[-20px_0_60px_rgba(0,0,0,.45)] ${
          abierto ? "flex" : "hidden"
        } ${minimizado ? "max-xl:hidden" : ""}`}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-tinta/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <LogoPulsoBot tam="h-11 w-11" estado={estadoBot} latido={false} />
          <div className="min-w-0 flex-1">
            <h2 id="pulsobot-titulo" className="m-0 text-[17px] font-extrabold">
              PulsoBot
            </h2>
            <p className="m-0 text-[13px] text-tinta/70">Tu asistente de PULSO Medellín</p>
          </div>
          {lectura.soportada && (
            <button
              type="button"
              role="switch"
              aria-checked={lectura.activa || conversando}
              aria-label="Leer las respuestas en voz alta"
              title={lectura.activa || conversando ? "Voz activada" : "Voz desactivada"}
              disabled={conversando}
              onClick={() => lectura.setActiva(!lectura.activa)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${foco} ${
                lectura.activa || conversando ? "bg-[#2563EB] text-white" : "text-tinta/70 hover:bg-tinta/10 hover:text-tinta"
              }`}
            >
              <IconoAltavoz encendido={lectura.activa || conversando} />
            </button>
          )}
          <button
            ref={cerrarRef}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar PulsoBot"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-tinta/80 hover:bg-tinta/10 hover:text-tinta ${foco}`}
          >
            <IconoCerrar />
          </button>
        </header>

        {/* Conversación por voz: un solo botón grande para empezar; mientras dura, el estado y cómo interrumpir. */}
        {dictado.soportado && (
          <div className="shrink-0 border-b border-tinta/10 px-4 py-3">
            {!conversando ? (
              <button
                type="button"
                onClick={iniciarConversacion}
                className={`flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2563EB] px-4 py-3 text-[15px] font-bold text-white hover:bg-[#1D4ED8] ${foco}`}
              >
                <IconoMicrofono />
                Conversar por voz
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={pausada ? () => escucharRef.current() : lectura.hablando ? interrumpir : undefined}
                  disabled={!pausada && !lectura.hablando}
                  aria-label={pausada ? "Seguir hablando" : lectura.hablando ? "Interrumpir a PulsoBot y hablar" : "PulsoBot te está escuchando"}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left ${foco} ${
                    dictado.escuchando
                      ? "border-[#22C55E]/60 bg-[#22C55E]/10 text-[#86EFAC]"
                      : lectura.hablando
                        ? "border-[#60A5FA]/60 bg-[#2563EB]/15 text-[#93C5FD] hover:bg-[#2563EB]/25"
                        : "border-tinta/15 bg-tinta/[0.05] text-tinta/80"
                  }`}
                >
                  <Ondas activo={dictado.escuchando || lectura.hablando} />
                  <span className="min-w-0 flex-1" role="status" aria-live="polite">
                    <span className="block truncate text-[14px] font-semibold text-tinta">{textoEstado}</span>
                    {lectura.hablando && <span className="block text-[12.5px] text-tinta/70">Toca para interrumpir</span>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={terminarConversacion}
                  className={`shrink-0 rounded-xl border border-tinta/15 px-3 py-2.5 text-[13.5px] font-bold text-tinta hover:bg-tinta/10 ${foco}`}
                >
                  Terminar
                </button>
              </div>
            )}
            {dictado.error && !conversando && <p className="m-0 mt-2 text-[13px] text-[#FCD34D]">{dictado.error}</p>}
          </div>
        )}

        {aviso && (
          <p key={aviso.id} role="status" className="m-0 flex shrink-0 items-center gap-2 border-b border-tinta/10 px-4 py-2 text-[13px] font-semibold text-[#86EFAC]">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#22C55E]" />
            {aviso.texto}
          </p>
        )}

        <div className="min-h-0 flex-1">
          {montado && (
            <PanelAnalista
              modo="flotante"
              onRespuesta={alRespuesta}
              onResultado={alResultado}
              onTextoIa={alTextoIa}
              pregunta={pregunta}
              sugeridasExtra={SUGERIDAS_BOT}
              bienvenida={<Bienvenida />}
              borrador={dictado.parcial}
              accesorioEntrada={botonConversar}
            />
          )}
        </div>
      </section>

      {/* Celular y tablet: tras mover el mapa, el cajón se minimiza a esta barra para que se vea el mapa. Por debajo de 1280 px
          el cajón taparía la tarjeta de lo que se acaba de mostrar. En tablet la barra va arriba a la derecha, donde no tapa nada. */}
      {abierto && minimizado && (
        <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl border border-tinta/15 bg-fondo/95 p-2 shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur sm:inset-x-auto sm:top-[76px] sm:right-3 sm:bottom-auto sm:w-[360px] xl:hidden">
          <LogoPulsoBot tam="h-10 w-10" estado={estadoBot} latido={false} />
          <p className="m-0 min-w-0 flex-1 truncate text-[14px] leading-tight font-semibold text-tinta" role="status">
            {conversando ? textoEstado : "Te lo muestro en el mapa"}
          </p>
          <button
            ref={volverRef}
            type="button"
            onClick={() => setMinimizado(false)}
            className={`shrink-0 rounded-xl bg-[#2563EB] px-3 py-2 text-[13.5px] font-bold text-white hover:bg-[#1D4FD7] ${foco}`}
          >
            Abrir
          </button>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar PulsoBot"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-tinta/80 hover:bg-tinta/10 ${foco}`}
          >
            <IconoCerrar />
          </button>
        </div>
      )}
    </>
  );
}

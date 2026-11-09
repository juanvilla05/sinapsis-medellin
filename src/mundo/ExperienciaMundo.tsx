"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumenCatalogo } from "@/lib/catalogo";
import { AREAS_MUNDO, areaPorId, decimal, fechaColombia, miles, type IdArea } from "./areas";
import PanelReloj from "./paneles/PanelReloj";
import PanelLaboratorio, { type OpcionLab } from "./paneles/PanelLaboratorio";
import PanelEnConstruccion from "./paneles/PanelEnConstruccion";
import PanelMonitoreo from "./paneles/PanelMonitoreo";
import PanelAnalista from "./paneles/PanelAnalista";
import { colorEstado, type DatosMundo } from "./datos";
import { evaluarAgente, evaluarAgentes, type AireAgente, type ContextoAgentes, type EstadoVisibleAgente, type IdAgente } from "./agentes";

interface MundoAPI {
  enter(): void;
  goTo(id: string): void;
  exitBuilding(): void;
  openNear(): void;
  setPaused(p: boolean): void;
  /** repinta edificios, videowall y agentes con cifras nuevas */
  setDatos(d: ContextoAgentes): void;
  setAgente(id: IdAgente, info: Partial<EstadoVisibleAgente>): void;
  /** mueve la cámara al edificio de la secretaría; false si no tiene edificio */
  enfocarSecretaria(publicador: string): boolean;
  dispose(): void;
}

const isoValido = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);

/**
 * Lee del JSON de /api/siata lo que la Operadora necesita: estaciones válidas en Medellín y la frescura del dato
 * (`guardado`, `lectura`, `capturado`), para no decir «en vivo» cuando es la copia guardada. `null` = sin señal.
 */
function aireDe(j: unknown): AireAgente | null {
  if (!j || typeof j !== "object") return null;
  const r = j as {
    ok?: boolean;
    guardado?: unknown;
    lectura?: unknown;
    capturado?: unknown;
    resumen?: { medellin?: { estacionesValidas?: unknown } };
  };
  if (r.ok === false) return null;
  const n = r.resumen?.medellin?.estacionesValidas;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return { validas: n, guardado: r.guardado === true, lectura: isoValido(r.lectura), capturado: isoValido(r.capturado) };
}

const tarjeta = "rounded-2xl border border-[#E3EAF3] bg-white/95 shadow-[0_8px_24px_rgba(30,58,95,.1)]";

function Isotipo() {
  return (
    <svg width="32" height="32" viewBox="0 0 34 34" aria-hidden="true">
      <line x1="7" y1="25" x2="17" y2="8" stroke="#93B4F5" strokeWidth="2" />
      <line x1="17" y1="8" x2="27" y2="25" stroke="#93B4F5" strokeWidth="2" />
      <line x1="7" y1="25" x2="27" y2="25" stroke="#93B4F5" strokeWidth="2" />
      <circle cx="17" cy="8" r="5" fill="#2563EB" />
      <circle cx="7" cy="25" r="5" fill="#1E3A5F" />
      <circle cx="27" cy="25" r="5" fill="#2563EB" />
    </svg>
  );
}

export default function ExperienciaMundo({
  resumen,
  opcionesLab,
  datos,
}: {
  resumen: ResumenCatalogo;
  opcionesLab: OpcionLab[];
  /** cifras reales que alimentan los edificios de secretarías, los agentes y la Sala de Monitoreo */
  datos: DatosMundo;
}) {
  const montaje = useRef<HTMLDivElement>(null);
  const mundo = useRef<MundoAPI | null>(null);
  // los datos viven en un ref para que un re-render del padre no vuelva a construir el mundo
  const datosRef = useRef(datos);
  useEffect(() => {
    datosRef.current = datos;
  }, [datos]);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [empezo, setEmpezo] = useState(false);
  const [adentro, setAdentro] = useState(false);
  const [cerca, setCerca] = useState<IdArea | null>(null);
  const [panel, setPanel] = useState<IdArea | null>(null);
  const [rescatadas, setRescatadas] = useState(0);
  const [menuMovil, setMenuMovil] = useState(false);
  const [reducido, setReducido] = useState(false);
  // contexto de los agentes: lo que pasa en esta sesión (sin cifras a mano)
  const [preguntas, setPreguntas] = useState(0);
  const preguntasRef = useRef(0);
  const [aire, setAire] = useState<AireAgente | null | undefined>(undefined);
  const [secretariaElegida, setSecretariaElegida] = useState<string | null>(null);
  const temporizador = useRef<number | null>(null);

  const abrir = useCallback((id: IdArea) => {
    mundo.current?.setPaused(true);
    setPanel(id);
  }, []);
  const cerrar = useCallback(() => {
    mundo.current?.setPaused(false);
    setPanel(null);
    setSecretariaElegida(null);
  }, []);
  // clic en un edificio de secretaría: abre el Reloj de Frescura (PanelReloj no recibe publicador inicial; se muestra como pista)
  const abrirSecretaria = useCallback(
    (publicador: string) => {
      setSecretariaElegida(publicador);
      abrir("reloj");
    },
    [abrir],
  );

  const ctx = useMemo<ContextoAgentes>(() => ({ ...datos, rescatadas, preguntas, aire }), [datos, rescatadas, preguntas, aire]);
  const agentes = useMemo(() => evaluarAgentes(ctx), [ctx]);
  const trabajando = Object.values(agentes).filter((a) => a.estado === "trabajando").length;
  const teNecesitan = Object.values(agentes).filter((a) => a.estado === "te-necesita").length;

  // Montaje del mundo 3D (three.js) solo en el navegador
  useEffect(() => {
    let cancelado = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia del sistema leída al montar
    setReducido(reduce);
    (async () => {
      try {
        const css = getComputedStyle(document.documentElement);
        const sans = css.getPropertyValue("--font-jakarta").trim() || "'Plus Jakarta Sans', sans-serif";
        const mono = css.getPropertyValue("--font-jetbrains").trim() || "'JetBrains Mono', monospace";
        // las texturas de los letreros se dibujan en <canvas>: esperamos a que las fuentes estén cargadas
        await Promise.all([document.fonts.load(`800 20px ${sans}`), document.fonts.load(`600 20px ${mono}`)]).catch(() => {});
        const m = await import("./world3d.js");
        if (cancelado || !montaje.current) return;
        mundo.current = m.createWorld(montaje.current, {
          reducedMotion: reduce,
          fonts: { sans, mono },
          datos: datosRef.current,
          onOpen: (id: IdArea) => abrir(id),
          onSecretaria: (publicador: string) => abrirSecretaria(publicador),
          onNear: (id: IdArea | null) => setCerca(id),
          onInside: (b: boolean) => setAdentro(b),
          onReady: () => setListo(true),
        }) as MundoAPI;
      } catch (e) {
        console.error(e);
        setFallo(true);
      }
    })();
    return () => {
      cancelado = true;
      if (temporizador.current) clearTimeout(temporizador.current);
      mundo.current?.dispose();
      mundo.current = null;
    };
  }, [abrir, abrirSecretaria]);

  // El mundo se repinta (edificios, videowall, globos) cada vez que cambia el contexto de la sesión
  useEffect(() => {
    if (listo) mundo.current?.setDatos(ctx);
  }, [listo, ctx]);

  // Operadora de la Sala de Monitoreo: estaciones SIATA válidas en Medellín y frescura del dato desde /api/siata.
  // Si la ruta no existe o no responde, queda "sin señal" sin lanzar error; si llega la copia guardada, lo dice.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      let a: AireAgente | null = null;
      try {
        // 10 s propios: si la ruta cuelga (instancia fría, red del auditorio) la Operadora pasa a "sin señal".
        const r = await fetch("/api/siata", { cache: "no-store", signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(10_000)]) });
        if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) a = aireDe(await r.json());
      } catch {
        a = null;
      }
      if (ctrl.signal.aborted) return;
      setAire(a);
      mundo.current?.setAgente("monitoreo", evaluarAgente("monitoreo", { ...datosRef.current, aire: a }));
    })();
    return () => ctrl.abort();
  }, []);

  // Analista: PanelAnalista llama `onRespuesta` por cada respuesta terminada (chat o modo directo); contrato tipado por prop.
  const onPregunta = useCallback(() => {
    const n = preguntasRef.current + 1;
    preguntasRef.current = n;
    setPreguntas(n);
    mundo.current?.setAgente("analista", evaluarAgente("analista", { ...datosRef.current, preguntas: n }));
  }, []);

  // Esc cierra el panel; el foco va al botón de volver al abrirlo
  useEffect(() => {
    if (!panel) return;
    cerrarRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [panel, cerrar]);

  const salud = resumen.evaluables ? (resumen.porEstado["al-dia"] / resumen.evaluables) * 100 : 0;
  const atrasados = resumen.porEstado.atrasado + resumen.porEstado.critico;
  const areaCerca = areaPorId(cerca);
  const areaPanel = areaPorId(panel);
  const estado = adentro
    ? `${trabajando} ${trabajando === 1 ? "agente trabajando" : "agentes trabajando"}${teNecesitan ? ` · ${teNecesitan} te ${teNecesitan === 1 ? "necesita" : "necesitan"}` : ""} · ${areaCerca?.nombre ?? "Recepción"}`
    : "Plaza de La Alpujarra";

  const irA = (id: IdArea) => {
    setEmpezo(true);
    setMenuMovil(false);
    mundo.current?.goTo(id);
  };
  // lista accesible de secretarías: enfoca la cámara en el edificio y abre el Reloj
  const irASecretaria = (publicador: string) => {
    setEmpezo(true);
    setMenuMovil(false);
    const enfocado = mundo.current?.enfocarSecretaria(publicador) ?? false;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => abrirSecretaria(publicador), enfocado && !reducido ? 650 : 0);
  };

  return (
    <>
      <div className="relative h-dvh min-h-[560px] overflow-hidden bg-[#DCEBFF]">
        <div
          ref={montaje}
          className="absolute inset-0"
          role="application"
          aria-label="Mundo 3D de SINAPSIS en La Alpujarra. Usa el menú Despachos para navegar con el teclado."
        />

        {!listo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={`${tarjeta} px-5 py-4 text-sm font-semibold text-[#1E3A5F] ${fallo ? "" : "animate-pulse"}`}>
              {fallo ? (
                <span className="pointer-events-auto">
                  No se pudo cargar el mundo 3D en este dispositivo.{" "}
                  <a href="/panel" className="underline">
                    Abrir el panel ejecutivo
                  </a>
                </span>
              ) : (
                "Construyendo La Alpujarra…"
              )}
            </div>
          </div>
        )}

        {/* Marca y logo */}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div className={`${tarjeta} pointer-events-auto flex items-center gap-3 py-2.5 pl-3 pr-4`}>
            <Isotipo />
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-extrabold tracking-[.14em] text-[#1E3A5F]">SINAPSIS</span>
              <span className="text-xs text-[#475569]">{estado}</span>
            </div>
          </div>
          <Link
            href="/"
            className={`${tarjeta} pointer-events-auto mr-auto flex items-center gap-2 self-center px-3.5 py-2 text-[13px] font-bold text-[#1E3A5F] transition-colors hover:bg-[#F4F7FB]`}
          >
            <span aria-hidden="true">←</span> PULSO en vivo
          </Link>
          <div className={`${tarjeta} pointer-events-auto hidden rounded-[14px] px-2.5 py-1.5 sm:block`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- logo oficial sin modificar */}
            <img src="/marca/logo-alcaldia.png" alt="Alcaldía de Medellín" className="h-10 w-[140px] object-contain" />
          </div>
        </div>

        {/* Intro */}
        {listo && !empezo && (
          <div className="absolute left-[clamp(16px,4vw,56px)] top-1/2 flex w-[min(460px,calc(100%-32px))] -translate-y-[46%] flex-col gap-3.5 rounded-3xl border border-[#E3EAF3] bg-white/95 p-7 shadow-[0_24px_60px_rgba(30,58,95,.18)]">
            <span className="font-mono text-[11.5px] tracking-[.12em] text-[#2563EB]">LA ALPUJARRA · MEDELLÍN</span>
            <span className="font-mono text-[clamp(60px,8vw,96px)] font-semibold leading-[.95] tracking-[-.03em] text-[#1E3A5F]">
              {decimal(resumen.pctAtrasados)} %
            </span>
            <p className="m-0 text-[17px] font-semibold leading-snug text-[#0F172A]">
              de los conjuntos de MEData con periodicidad declarada está atrasado: {miles(atrasados)} de {miles(resumen.evaluables)}.
            </p>
            <span className="font-mono text-[11px] text-[#475569]">
              Fuente: MEData, Alcaldía de Medellín, consultado el {fechaColombia(resumen.generado)}
            </span>
            <p className="m-0 text-[14.5px] leading-normal text-[#475569]">
              Conectamos los datos de la ciudad como neuronas de un mismo cerebro.
            </p>
            <div className="mt-1 flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  setEmpezo(true);
                  mundo.current?.enter();
                }}
                className="rounded-[14px] bg-[#2563EB] px-[22px] py-3.5 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(37,99,235,.28)] hover:bg-[#1D4FD7]"
              >
                Entrar a SINAPSIS →
              </button>
              <button
                onClick={() => setEmpezo(true)}
                className="rounded-[14px] border border-[#E3EAF3] bg-white px-[18px] py-[13px] text-sm font-bold text-[#1E3A5F]"
              >
                Recorrer la plaza
              </button>
            </div>
          </div>
        )}

        {/* Menú de despachos (también es la navegación por teclado) */}
        {listo && empezo && (
          <>
            <button
              onClick={() => setMenuMovil((v) => !v)}
              aria-expanded={menuMovil}
              className={`${tarjeta} absolute left-4 top-24 px-3 py-2 text-[13px] font-bold text-[#1E3A5F] sm:hidden`}
            >
              {menuMovil ? "Cerrar" : "Despachos"}
            </button>
            <nav
              aria-label="Despachos"
              className={`${tarjeta} absolute left-4 top-24 flex max-h-[calc(100dvh-170px)] w-[216px] flex-col gap-0.5 overflow-y-auto p-2.5 max-sm:top-36 max-sm:max-h-[calc(100dvh-300px)] ${menuMovil ? "" : "max-sm:hidden"}`}
            >
              <span className="px-2 pb-1.5 pt-1 text-[11px] font-bold tracking-[.06em] text-[#475569]">DESPACHOS</span>
              {AREAS_MUNDO.map((a) => (
                <button
                  key={a.id}
                  onClick={() => irA(a.id)}
                  className={`flex items-center gap-2 rounded-[10px] p-2 text-left text-[13px] font-semibold text-[#1E3A5F] hover:bg-[#EFF6FF] ${cerca === a.id ? "bg-[#EFF6FF]" : ""}`}
                >
                  <span className="rounded-md bg-[#1E3A5F] px-1.5 py-0.5 font-mono text-[10.5px] text-white">{a.num}</span>
                  <span className="flex-1">{a.nombre}</span>
                  {a.enConstruccion && <span className="text-[10px] text-[#64748B]">pronto</span>}
                </button>
              ))}
              {datos.secretarias.length > 0 && (
                <>
                  <div className="mx-1 my-1.5 h-px bg-[#E3EAF3]" />
                  <span className="px-2 pb-1 pt-0.5 text-[11px] font-bold tracking-[.06em] text-[#475569]">SECRETARÍAS</span>
                  <ul className="flex flex-col gap-px" aria-label="Secretarías con edificio en la plaza">
                    {datos.secretarias.map((s) => (
                      <li key={s.publicador}>
                        <button
                          onClick={() => irASecretaria(s.publicador)}
                          aria-label={`${s.publicador}: ${miles(s.atrasados)} de ${miles(s.total)} conjuntos atrasados. Ver el edificio y abrir el Reloj de Frescura`}
                          className="flex w-full items-start gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-[#EFF6FF]"
                        >
                          <span className="mt-[5px] h-2 w-2 flex-none rounded-full" style={{ background: colorEstado(s.pct) }} aria-hidden="true" />
                          <span className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="truncate text-[12.5px] font-semibold text-[#1E3A5F]">{s.publicador}</span>
                            <span className="font-mono text-[10.5px] text-[#475569]">
                              {miles(s.atrasados)} de {miles(s.total)} atrasados
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mx-1 my-1.5 h-px bg-[#E3EAF3]" />
              <button
                onClick={() => (adentro ? mundo.current?.exitBuilding() : mundo.current?.enter())}
                className="rounded-[10px] px-2 py-[7px] text-left text-[12.5px] font-bold text-[#2563EB] hover:bg-[#EFF6FF]"
              >
                {adentro ? "← Salir a la plaza" : "Entrar al edificio →"}
              </button>
              <a href="/panel" className="rounded-[10px] px-2 py-[7px] text-[12.5px] font-bold text-[#475569] hover:bg-[#EFF6FF]">
                Panel ejecutivo (sin 3D)
              </a>
            </nav>

            {/* Indicadores de juego (datos reales) */}
            <div className="pointer-events-none absolute bottom-[52px] left-4 flex max-w-[calc(100%-32px)] flex-wrap-reverse gap-2 sm:max-w-[calc(100%-250px)]">
              <div className={`${tarjeta} flex items-center gap-2.5 rounded-[14px] px-3 py-2`}>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[#475569]">Salud de los datos de la ciudad</span>
                  <div className="h-[7px] w-[150px] overflow-hidden rounded bg-[#E3EAF3]">
                    <div className="h-full bg-[#16A34A]" style={{ width: `${salud}%` }} />
                  </div>
                </div>
                <span className="font-mono text-[15px] font-semibold text-[#1E3A5F]">{decimal(salud)} %</span>
              </div>
              <div className={`${tarjeta} flex flex-col rounded-[14px] px-3 py-2`}>
                <span className="font-mono text-[17px] font-semibold text-[#DC2626]">{miles(resumen.porEstado.critico)}</span>
                <span className="text-[11px] font-semibold text-[#475569]">misiones pendientes</span>
              </div>
              <div className={`${tarjeta} flex flex-col rounded-[14px] px-3 py-2`}>
                <span className="font-mono text-[17px] font-semibold text-[#1E3A5F]">{miles(rescatadas)}</span>
                <span className="text-[11px] font-semibold text-[#475569]">filas rescatadas</span>
              </div>
            </div>

            {/* Ayuda de controles */}
            <div className="pointer-events-none absolute bottom-[52px] right-4 hidden animate-[aparecer_.4s_ease-out] grid-cols-[auto_auto] gap-x-3 gap-y-1.5 whitespace-nowrap rounded-xl bg-[#0F172A]/80 px-3 py-2.5 text-[11.5px] leading-tight text-white md:grid">
              <b className="font-mono">WASD / ← →</b>
              <span>caminar</span>
              <b>Clic en el piso</b>
              <span>ir ahí</span>
              <b>Arrastrar</b>
              <span>girar la cámara</span>
              <b>Rueda</b>
              <span>acercar / alejar</span>
              <b className="font-mono">E</b>
              <span>abrir el despacho</span>
            </div>
          </>
        )}

        {/* Despacho cercano */}
        {areaCerca && !panel && (
          <div className="absolute bottom-[110px] left-1/2 flex -translate-x-1/2 animate-[aparecer_.2s_ease-out] items-center gap-3 rounded-2xl border-[1.5px] border-[#2563EB] bg-white py-2.5 pl-4 pr-2.5 shadow-[0_14px_34px_rgba(37,99,235,.22)]">
            <span className="whitespace-nowrap text-sm font-bold text-[#1E3A5F]">{areaCerca.nombre}</span>
            <button
              onClick={() => abrir(areaCerca.id)}
              className="whitespace-nowrap rounded-[11px] bg-[#2563EB] px-3.5 py-2 text-[13px] font-bold text-white"
            >
              <span className="mr-1.5 rounded-[5px] bg-white/25 px-1.5 py-px font-mono">E</span>
              Abrir herramienta
            </button>
          </div>
        )}

        {/* Pie */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
          <span className="rounded-full border border-[#E3EAF3] bg-white/90 px-3.5 py-1.5 text-center text-[11.5px] text-[#475569]">
            Propuesta académica presentada a la Alcaldía de Medellín. No es un sitio oficial de la Alcaldía.
          </span>
        </div>
      </div>

      {/* Panel de herramienta */}
      {areaPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#F4F7FB]/55 p-[clamp(8px,3vw,40px)] backdrop-blur-[10px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={areaPanel.nombre}
            className="flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-auto rounded-3xl border border-[#E3EAF3] bg-white shadow-[0_30px_80px_rgba(30,58,95,.22)]"
          >
            <div className="sticky top-0 z-[2] flex items-center gap-3.5 border-b border-[#E3EAF3] bg-white px-6 py-4">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#1E3A5F] font-mono text-[15px] font-semibold text-white">
                {areaPanel.num}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[19px] font-extrabold text-[#1E3A5F]">{areaPanel.nombre}</span>
                <span className="text-[12.5px] text-[#475569]">{areaPanel.rol}</span>
                {areaPanel.id === "reloj" && secretariaElegida && (
                  <span className="mt-1 w-fit rounded-full border border-[#E3EAF3] bg-[#F4F7FB] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#1E3A5F]">
                    Secretaría elegida: {secretariaElegida} · escríbela en el buscador para filtrar
                  </span>
                )}
              </div>
              <button
                ref={cerrarRef}
                onClick={cerrar}
                className="rounded-xl border border-[#E3EAF3] bg-[#F4F7FB] px-3.5 py-2.5 text-[13.5px] font-bold text-[#1E3A5F] hover:border-[#2563EB]"
              >
                ← Volver a la oficina
              </button>
            </div>
            {areaPanel.id === "reloj" && <PanelReloj resumenInicial={resumen} />}
            {areaPanel.id === "lab" && (
              <PanelLaboratorio
                opciones={opcionesLab}
                reducido={reducido}
                onRescate={(n) => {
                  const total = rescatadas + n;
                  setRescatadas(total);
                  mundo.current?.setAgente("lab", evaluarAgente("lab", { ...datosRef.current, rescatadas: total }));
                }}
              />
            )}
            {areaPanel.id === "monitoreo" && <PanelMonitoreo datos={datos} modo="modal" />}
            {areaPanel.id === "analista" && <PanelAnalista modo="modal" onRespuesta={onPregunta} />}
            {areaPanel.id === "ventanilla" && <PanelEnConstruccion area={areaPanel} />}
          </div>
        </div>
      )}
    </>
  );
}

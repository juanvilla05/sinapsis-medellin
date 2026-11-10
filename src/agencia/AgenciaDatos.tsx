"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumenCatalogo } from "@/lib/catalogo";
import { AREAS_MUNDO, areaPorId, decimal, fechaColombia, miles, type IdArea } from "@/mundo/areas";
import { colorEstado, type DatosMundo } from "@/mundo/datos";
import { COLOR_AGENTE, COLOR_GLOBO, TEXTO_ESTADO_AGENTE, evaluarAgentes, type AireAgente, type ContextoAgentes, type IdAgente } from "@/mundo/agentes";
import PanelReloj from "@/mundo/paneles/PanelReloj";
import PanelLaboratorio, { type OpcionLab } from "@/mundo/paneles/PanelLaboratorio";
import PanelVentanilla from "@/mundo/paneles/PanelVentanilla";
import PanelMonitoreo from "@/mundo/paneles/PanelMonitoreo";
import PanelAnalista from "@/mundo/paneles/PanelAnalista";
import { MARCA } from "@/lib/marca";
import OficinaIso, { SALAS } from "./OficinaIso";
import Persona, { LOOKS } from "./Persona";

/** Nombre visible de cada agente en la Agencia. El Analista es el mismo asistente de PULSO: PulsoBot. */
const NOMBRE: Record<IdArea, string> = {
  reloj: "Relojero",
  lab: "Científica de datos",
  ventanilla: "Funcionario de ventanilla",
  analista: "PulsoBot",
  monitoreo: "Operadora",
};

const isoValido = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);

/** Lee de /api/siata las estaciones válidas en Medellín y la frescura del dato. `null` = sin señal. */
function aireDe(j: unknown): AireAgente | null {
  if (!j || typeof j !== "object") return null;
  const r = j as { ok?: boolean; guardado?: unknown; lectura?: unknown; capturado?: unknown; resumen?: { medellin?: { estacionesValidas?: unknown } } };
  if (r.ok === false) return null;
  const n = r.resumen?.medellin?.estacionesValidas;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return { validas: n, guardado: r.guardado === true, lectura: isoValido(r.lectura), capturado: isoValido(r.capturado) };
}

/* ───────── iconos (trazo, 24 × 24) ───────── */
const ICONOS: Record<string, string> = {
  reloj: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  lab: "M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7 15h10",
  ventanilla: "M4 4h16v6H4zM4 14h7v6H4zM15 14h5M15 17h5M15 20h3",
  analista: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12ZM8.5 12h.01M12 12h.01M15.5 12h.01",
  monitoreo: "M3 12h4l2-5 4 10 2-5h6",
  mapa: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14",
  archivo: "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2ZM4 6v12c0 1.1 3.6 2 8 2s8-.9 8-2V6M4 12c0 1.1 3.6 2 8 2s8-.9 8-2",
  equipo: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8",
  flecha: "M5 12h14M13 6l6 6-6 6",
  panel: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
};

function Icono({ n, className = "h-[18px] w-[18px]" }: { n: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONOS[n]} />
    </svg>
  );
}

function Avatar({ id, tam = 44 }: { id: keyof typeof LOOKS; tam?: number }) {
  return (
    <svg viewBox="-13 -53 26 26" width={tam} height={tam} className="flex-none overflow-hidden rounded-full" aria-hidden="true">
      <rect x={-13} y={-53} width={26} height={26} fill="#E8EEF7" />
      <Persona look={LOOKS[id]} />
    </svg>
  );
}

function PulsoMarca({ sub }: { sub: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#34D399]" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-[0.14em] text-white">PULSO</span>
        <span className="block text-[11px] text-white/60">{sub}</span>
      </span>
    </span>
  );
}

/** Interruptor entre las dos ramas del mismo producto. */
function Ramas({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Ramas de PULSO" className={`grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1 text-[12.5px] font-bold ${className}`}>
      <Link href="/" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
        <Icono n="mapa" className="h-4 w-4" /> Ciudad
      </Link>
      <span aria-current="page" className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-2 py-2 text-white">
        <Icono n="archivo" className="h-4 w-4" /> Agencia
      </span>
    </nav>
  );
}

export default function AgenciaDatos({ resumen, opcionesLab, datos }: { resumen: ResumenCatalogo; opcionesLab: OpcionLab[]; datos: DatosMundo }) {
  const [panel, setPanel] = useState<IdArea | null>(null);
  const [enfocado, setEnfocado] = useState<IdArea | null>(null);
  const [rescatadas, setRescatadas] = useState(0);
  const [preguntas, setPreguntas] = useState(0);
  const [aire, setAire] = useState<AireAgente | null | undefined>(undefined);
  const [reducido, setReducido] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const origenRef = useRef<HTMLElement | null>(null);

  const ctx = useMemo<ContextoAgentes>(() => ({ ...datos, rescatadas, preguntas, aire }), [datos, rescatadas, preguntas, aire]);
  const agentes = useMemo(() => evaluarAgentes(ctx), [ctx]);

  const abrir = useCallback((id: IdArea) => {
    origenRef.current = document.activeElement as HTMLElement | null;
    setPanel(id);
  }, []);
  const cerrar = useCallback(() => {
    setPanel(null);
    origenRef.current?.focus?.();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia del sistema leída al montar
    setReducido(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Operadora: estaciones de SIATA en Medellín (si no responde, queda "sin señal" sin romper nada)
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      let a: AireAgente | null = null;
      try {
        const r = await fetch("/api/siata", { cache: "no-store", signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(10_000)]) });
        if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) a = aireDe(await r.json());
      } catch {
        a = null;
      }
      if (!ctrl.signal.aborted) setAire(a);
    })();
    return () => ctrl.abort();
  }, []);

  // Esc cierra el panel; el foco va al botón de volver
  useEffect(() => {
    if (!panel) return;
    cerrarRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [panel, cerrar]);

  const atrasados = resumen.porEstado.atrasado + resumen.porEstado.critico;
  const areaPanel = areaPorId(panel);
  const salaPanel = SALAS.find((s) => s.id === panel);
  const trabajando = AREAS_MUNDO.filter((a) => agentes[a.id as IdAgente].estado === "trabajando").length;
  const teNecesitan = AREAS_MUNDO.filter((a) => agentes[a.id as IdAgente].estado === "te-necesita").length;

  const siata =
    aire === undefined
      ? { valor: "…", texto: "Consultando las estaciones de SIATA" }
      : aire === null
        ? { valor: "sin dato", texto: "SIATA no respondió en este momento" }
        : { valor: miles(aire.validas), texto: aire.guardado ? "estaciones de SIATA (copia guardada)" : "estaciones de SIATA reportando en Medellín" };

  const kpis = [
    { valor: `${decimal(resumen.pctAtrasados)} %`, texto: `de los conjuntos con periodicidad declarada está atrasado (${miles(atrasados)} de ${miles(resumen.evaluables)})`, color: "#DC2626" },
    { valor: miles(resumen.totalConjuntos), texto: "conjuntos del catálogo de MEData auditados", color: "#0F172A" },
    { valor: miles(resumen.porEstado.critico), texto: "en estado crítico: más de 3 veces su plazo sin actualizar", color: "#B45309" },
    { valor: siata.valor, texto: siata.texto, color: "#047857" },
  ];

  return (
    <div className="min-h-dvh bg-[#F4F7FB] text-[#0F172A] lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* ───── barra lateral (computador) ───── */}
      <aside className="hidden bg-[#0B1220] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-5 lg:overflow-y-auto lg:px-4 lg:py-5">
        <div className="px-1">
          <PulsoMarca sub="Agencia de datos" />
        </div>
        <Ramas />

        <div>
          <p className="mb-2 px-2 text-[11px] font-bold tracking-[0.12em] text-white/45">DESPACHOS</p>
          <ul className="flex flex-col gap-0.5">
            {AREAS_MUNDO.map((a) => {
              const info = agentes[a.id as IdAgente];
              return (
                <li key={a.id}>
                  <button
                    onClick={() => abrir(a.id)}
                    onMouseEnter={() => setEnfocado(a.id)}
                    onMouseLeave={() => setEnfocado(null)}
                    onFocus={() => setEnfocado(a.id)}
                    onBlur={() => setEnfocado(null)}
                    className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/[0.06] text-white/80 group-hover:text-white" style={{ color: SALAS.find((s) => s.id === a.id)?.borde }}>
                      <Icono n={a.id} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-[13px] font-semibold text-white">{a.nombre}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-white/55">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLOR_AGENTE[info.estado] }} aria-hidden="true" />
                        {NOMBRE[a.id]} · {TEXTO_ESTADO_AGENTE[info.estado]}
                      </span>
                    </span>
                    <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[11px] text-white/80">{info.cifra}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-2 px-2 text-[11px] font-bold tracking-[0.12em] text-white/45">SECRETARÍAS CON MÁS CONJUNTOS</p>
          <ul className="flex flex-col gap-1 px-2">
            {datos.secretarias.slice(0, 6).map((s) => (
              <li key={s.publicador} className="flex items-center gap-2 text-[12px]">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: colorEstado(s.pct) }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-white/80">{s.publicador}</span>
                <span className="font-mono text-[11px] text-white/55">
                  {miles(s.atrasados)}/{miles(s.total)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-2 text-[10.5px] leading-snug text-white/40">Conjuntos atrasados sobre publicados, según el catálogo de MEData.</p>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 px-1 pt-4">
          <Link href="/panel" className="flex items-center gap-2 rounded-lg px-1 py-1 text-[12.5px] font-semibold text-white/70 hover:text-white">
            <Icono n="panel" className="h-4 w-4" /> Panel ejecutivo
          </Link>
          <p className="text-[10.5px] leading-snug text-white/40">
            Equipo {MARCA.nombre} · {MARCA.evento}
          </p>
        </div>
      </aside>

      {/* ───── contenido ───── */}
      <div className="flex min-w-0 flex-col">
        {/* encabezado (celular y tablet) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#0B1220] px-4 py-3 lg:hidden">
          <PulsoMarca sub="Agencia de datos" />
          <Ramas className="ml-auto w-[184px]" />
        </header>

        <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* título */}
          <section className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[11.5px] font-semibold tracking-[0.14em] text-[#2563EB]">AGENCIA DE DATOS · LA ALPUJARRA, MEDELLÍN</p>
              <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-[-0.01em] text-[#0B1220] sm:text-[32px]">La oficina detrás del mapa</h1>
              <p className="mt-2 max-w-[680px] text-[14.5px] leading-relaxed text-[#475569] sm:text-[15.5px]">
                Aquí llegan los datos crudos de MEData. Cinco agentes revisan qué tan al día están, los limpian, proponen mejoras y responden preguntas. Lo que sale limpio es lo que
                PULSO muestra en el mapa de la ciudad.
              </p>
            </div>
            <div className="hidden flex-none rounded-2xl border border-[#E3EAF3] bg-white px-3 py-2 md:block">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo oficial sin modificar */}
              <img src="/marca/logo-alcaldia.png" alt="Alcaldía de Medellín" className="h-10 w-[140px] object-contain" />
            </div>
          </section>

          {/* cifras reales */}
          <section aria-label="Cifras del catálogo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.texto} className="flex flex-col gap-1 rounded-2xl border border-[#E3EAF3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
                <span className="font-mono text-[24px] font-semibold leading-none tracking-[-0.02em] sm:text-[28px]" style={{ color: k.color }}>
                  {k.valor}
                </span>
                <span className="text-[12.5px] leading-snug text-[#475569]">{k.texto}</span>
              </div>
            ))}
          </section>
          <p className="-mt-2 font-mono text-[11px] text-[#64748B]">Fuente: catálogo de MEData, Alcaldía de Medellín, consultado el {fechaColombia(resumen.generado)} · SIATA en vivo.</p>

          {/* oficina */}
          <section aria-label="Oficina de la Agencia" className="overflow-hidden rounded-3xl border border-[#E3EAF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04),0_24px_48px_-32px_rgba(30,58,95,.35)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#EEF2F7] px-4 py-3 sm:px-5">
              <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-semibold text-[#334155]">
                <li className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EEF2F7] text-[#475569]">
                    <Icono n="archivo" className="h-3.5 w-3.5" />
                  </span>
                  Datos crudos de MEData
                </li>
                <li aria-hidden="true" className="text-[#94A3B8]">
                  <Icono n="flecha" className="h-3.5 w-3.5" />
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EFF6FF] text-[#2563EB]">
                    <Icono n="equipo" className="h-3.5 w-3.5" />
                  </span>
                  La Agencia los audita y limpia
                </li>
                <li aria-hidden="true" className="text-[#94A3B8]">
                  <Icono n="flecha" className="h-3.5 w-3.5" />
                </li>
                <li>
                  <Link href="/" className="flex items-center gap-1.5 rounded-md text-[#0B1220] hover:text-[#2563EB]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0B1220] text-[#34D399]">
                      <Icono n="mapa" className="h-3.5 w-3.5" />
                    </span>
                    PULSO los muestra en el mapa
                  </Link>
                </li>
              </ol>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[#F0FDF4] px-2.5 py-1 text-[11.5px] font-semibold text-[#15803D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" aria-hidden="true" />
                {[trabajando > 0 && `${trabajando} trabajando`, teNecesitan > 0 && `${teNecesitan} te ${teNecesitan === 1 ? "necesita" : "necesitan"}`].filter(Boolean).join(" · ") ||
                  `${AREAS_MUNDO.length} agentes esperando`}
              </span>
            </div>
            <div className="bg-[linear-gradient(180deg,#F8FAFD_0%,#EEF3F9_100%)] px-1 pb-2 pt-3 sm:px-4">
              <OficinaIso agentes={agentes} datos={datos} onAbrir={abrir} enfocado={enfocado} />
            </div>
            <p className="border-t border-[#EEF2F7] px-4 py-2.5 text-center text-[12px] text-[#64748B] sm:px-5">
              Toca un despacho para abrir su herramienta. La salida azul lleva a PULSO, la ciudad en vivo.
            </p>
          </section>

          {/* equipo */}
          <section aria-labelledby="titulo-equipo" className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <h2 id="titulo-equipo" className="text-[19px] font-extrabold text-[#0B1220]">
                El equipo
              </h2>
              <span className="text-[12px] text-[#64748B]">Cada cifra sale del catálogo de MEData o de SIATA</span>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {AREAS_MUNDO.map((a) => {
                const info = agentes[a.id as IdAgente];
                const sala = SALAS.find((s) => s.id === a.id)!;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => abrir(a.id)}
                      onMouseEnter={() => setEnfocado(a.id)}
                      onMouseLeave={() => setEnfocado(null)}
                      className="group flex h-full w-full flex-col gap-3 rounded-2xl border border-[#E3EAF3] bg-white p-4 text-left transition-[border-color,box-shadow] hover:border-[#93C5FD] hover:shadow-[0_12px_28px_-18px_rgba(37,99,235,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                    >
                      <span className="flex items-center gap-3">
                        <Avatar id={a.id} />
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="text-[15px] font-bold text-[#0B1220]">{NOMBRE[a.id]}</span>
                          <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: sala.acento }}>
                            <span className="font-mono">{a.num}</span> {a.nombre}
                          </span>
                        </span>
                        <span className="rounded-full px-2.5 py-1 font-mono text-[12px] font-semibold text-white" style={{ background: COLOR_GLOBO[info.estado] }}>
                          {info.cifra}
                        </span>
                      </span>
                      <span className="text-[13.5px] leading-relaxed text-[#475569]">{info.frase}</span>
                      <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#64748B]">
                          <span className="h-2 w-2 rounded-full" style={{ background: COLOR_AGENTE[info.estado] }} aria-hidden="true" />
                          {TEXTO_ESTADO_AGENTE[info.estado]}
                        </span>
                        <span className="flex items-center gap-1 text-[13px] font-bold text-[#2563EB]">
                          Abrir <Icono n="flecha" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/"
                  className="group flex h-full flex-col justify-between gap-3 rounded-2xl bg-[#0B1220] p-4 text-white transition-shadow hover:shadow-[0_16px_32px_-18px_rgba(37,99,235,.7)]"
                >
                  <PulsoMarca sub="Medellín en vivo" />
                  <span className="text-[13.5px] leading-relaxed text-white/75">
                    Los datos que salen de la Agencia llegan al mapa: aire de SIATA, seguridad vial y hurto por comuna, rutas y PulsoBot.
                  </span>
                  <span className="flex items-center gap-1 text-[13px] font-bold text-[#34D399]">
                    Ir a la ciudad en vivo <Icono n="flecha" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            </ul>
          </section>

          <footer className="flex flex-col gap-1 border-t border-[#E3EAF3] pt-4 text-center text-[11.5px] text-[#64748B]">
            <p>{MARCA.aviso}</p>
            <p>
              Equipo {MARCA.nombre} · {MARCA.equipo.join(" y ")} · {MARCA.institucion}
            </p>
          </footer>
        </main>
      </div>

      {/* ───── herramienta del despacho ───── */}
      {areaPanel && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0B1220]/45 backdrop-blur-[6px] sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && cerrar()}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={areaPanel.nombre}
            className="flex max-h-[94dvh] w-full max-w-[1120px] flex-col overflow-auto rounded-t-3xl border border-[#E3EAF3] bg-white shadow-[0_30px_80px_rgba(11,18,32,.35)] sm:max-h-[90dvh] sm:rounded-3xl"
          >
            <div className="sticky top-0 z-[2] flex items-center gap-3 border-b border-[#E3EAF3] bg-white px-4 py-3 sm:px-6 sm:py-4">
              <Avatar id={areaPanel.id} tam={44} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[17px] font-extrabold text-[#0B1220] sm:text-[19px]">{areaPanel.nombre}</span>
                <span className="truncate text-[12.5px] font-semibold" style={{ color: salaPanel?.acento }}>
                  <span className="font-mono">{areaPanel.num}</span> · {NOMBRE[areaPanel.id]}
                </span>
              </div>
              <button
                ref={cerrarRef}
                onClick={cerrar}
                className="flex-none rounded-xl border border-[#E3EAF3] bg-[#F4F7FB] px-3 py-2 text-[13px] font-bold text-[#0B1220] hover:border-[#2563EB]"
              >
                <span className="hidden sm:inline">← Volver a la oficina</span>
                <span className="sm:hidden">Cerrar</span>
              </button>
            </div>
            {areaPanel.id === "reloj" && <PanelReloj resumenInicial={resumen} />}
            {areaPanel.id === "lab" && <PanelLaboratorio opciones={opcionesLab} reducido={reducido} onRescate={(n) => setRescatadas((t) => t + n)} />}
            {areaPanel.id === "monitoreo" && <PanelMonitoreo datos={datos} modo="modal" />}
            {areaPanel.id === "analista" && <PanelAnalista modo="modal" onRespuesta={() => setPreguntas((n) => n + 1)} />}
            {areaPanel.id === "ventanilla" && <PanelVentanilla />}
          </div>
        </div>
      )}
    </div>
  );
}

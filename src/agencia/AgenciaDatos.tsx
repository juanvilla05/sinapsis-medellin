"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ResumenCatalogo } from "@/lib/catalogo";
import type { Propuesta } from "@/lib/ventanilla";
import type { Visuales } from "@/lib/visuales";
import { MARCA } from "@/lib/marca";
import { AREAS_MUNDO, decimal, fechaColombia, miles, type IdArea } from "@/mundo/areas";
import type { DatosMundo } from "@/mundo/datos";
import { TEXTO_ESTADO_AGENTE, evaluarAgentes, type AireAgente, type ContextoAgentes, type EstadoAgente, type IdAgente } from "@/mundo/agentes";
import PanelLaboratorio, { type OpcionLab } from "@/mundo/paneles/PanelLaboratorio";
import PanelComunicaciones from "@/mundo/paneles/PanelComunicaciones";
import PanelMonitoreo from "@/mundo/paneles/PanelMonitoreo";
import PanelAnalista from "@/mundo/paneles/PanelAnalista";
import OficinaEscena from "./OficinaEscena";
import AvatarAgente from "./AvatarAgente";
import EditorAgentes, { PISOS } from "./EditorAgentes";
import VisualesAgencia, { useEntrada } from "./Visuales";
import { RelojDespacho, VentanillaDespacho, descargarCSV, useVentanilla, type FilaReloj } from "./Despachos";
import { CLAVE_AGENTES, aspectosDe, limpiarCambios, type CambiosAgentes, type IdEditable } from "./persona";
import type { DatosEscena, IdSala } from "./escena";

/** Nombre visible de cada agente. El Analista es el mismo asistente de PULSO: PulsoBot. */
const NOMBRE: Record<IdArea, string> = {
  reloj: "Relojero",
  lab: "Científica de datos",
  ventanilla: "Funcionario de ventanilla",
  analista: "PulsoBot",
  monitoreo: "Operadora",
  comunicaciones: "Vocera",
};
const CAPTION: Record<IdArea, string> = {
  reloj: "críticos de {e} evaluables",
  lab: "filas rescatadas en esta sesión",
  ventanilla: "conjuntos con propuesta",
  analista: "preguntas respondidas",
  monitoreo: "estaciones de SIATA",
  comunicaciones: "informe por secretaría",
};
const BORDES: Record<IdArea, string> = { reloj: "#F3D49B", lab: "#9FE3D6", ventanilla: "#CABDFA", analista: "#B9D3FB", monitoreo: "#A7E3C7", comunicaciones: "#FDC9A9" };
const CLAVE_TEMA = "pulso-tema";
const MC = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const VARS_CLARO = { "--bg": "#F4F7FB", "--sup": "#FFFFFF", "--sup2": "#F1F5F9", "--tinta": "#0F172A", "--tinta2": "#475569", "--borde": "#E3EAF3", "--borde2": "#CBD5E1", "--acento": "#2563EB", "--escena": "linear-gradient(180deg,#FFFFFF 0%,#F4F7FB 100%)", "--tr": "#15803D", "--trBg": "#DCFCE7", "--es": "#475569", "--nec": "#B91C1C", "--necBg": "#FEE2E2", "--ss": "#B45309", colorScheme: "light" } as CSSProperties;
const VARS_OSCURO = { "--bg": "#0B1220", "--sup": "#0F1B2E", "--sup2": "#142339", "--tinta": "#E2E8F0", "--tinta2": "#94A3B8", "--borde": "#22324B", "--borde2": "#334866", "--acento": "#60A5FA", "--escena": "linear-gradient(180deg,#0F1B2E 0%,#0B1220 100%)", "--tr": "#4ADE80", "--trBg": "rgba(74,222,128,.12)", "--es": "#94A3B8", "--nec": "#F87171", "--necBg": "rgba(248,113,113,.14)", "--ss": "#FBBF24", colorScheme: "dark" } as CSSProperties;

/** [color, fondo] de cada estado del agente, por tema. */
const EST_CLARO: Record<EstadoAgente, [string, string]> = { trabajando: ["#15803D", "#DCFCE7"], esperando: ["#475569", "#F1F5F9"], "te-necesita": ["#B91C1C", "#FEE2E2"], "sin-senal": ["#B45309", "#FEF3C7"] };
const EST_OSCURO: Record<EstadoAgente, [string, string]> = { trabajando: ["#4ADE80", "rgba(74,222,128,.12)"], esperando: ["#94A3B8", "rgba(148,163,184,.14)"], "te-necesita": ["#F87171", "rgba(248,113,113,.14)"], "sin-senal": ["#FBBF24", "rgba(251,191,36,.14)"] };

const RECORRIDO: [IdSala | "todo", string][] = [
  ["todo", "Toda la oficina"],
  ["reloj", "01 Reloj"],
  ["lab", "02 Laboratorio"],
  ["ventanilla", "03 Ventanilla"],
  ["analista", "04 Analista"],
  ["monitoreo", "05 Monitoreo"],
  ["comunicaciones", "06 Comunicaciones"],
  ["salida", "Salida a PULSO"],
];

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

function fechaCortaColombia(iso: string) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return `${d.getUTCDate()} ${MC[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function Marca({ sub, chico = false }: { sub: string; chico?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex-none rounded-full bg-[#34D399] ${chico ? "h-[9px] w-[9px]" : "h-2.5 w-2.5 shadow-[0_0_0_4px_rgba(52,211,153,.18)]"}`} aria-hidden="true" />
      <span className={`font-extrabold tracking-[0.06em] text-white ${chico ? "text-[16px]" : "text-[20px]"}`}>PULSO</span>
      <span className={`font-medium text-[#94A3B8] ${chico ? "text-[12px]" : "text-[12.5px]"}`}>{sub}</span>
    </span>
  );
}

function Ramas({ chico = false }: { chico?: boolean }) {
  const op = `flex items-center justify-center rounded-[9px] font-semibold ${chico ? "min-h-[38px] px-3 text-[13px]" : "min-h-[40px] text-[14px]"}`;
  return (
    <nav aria-label="Rama de PULSO" className={`grid grid-cols-2 bg-[#142339] ${chico ? "gap-[3px] rounded-[10px] p-[3px]" : "gap-1 rounded-xl p-1"}`}>
      <Link href="/" className={`${op} text-[#CBD5E1] hover:bg-[#1B2E4C] hover:text-white`}>
        Ciudad
      </Link>
      <span aria-current="page" className={`${op} bg-[#2563EB] font-bold text-white`}>
        Agencia
      </span>
    </nav>
  );
}

export default function AgenciaDatos({
  resumen,
  opcionesLab,
  datos,
  visuales,
  frescura,
}: {
  resumen: ResumenCatalogo;
  opcionesLab: OpcionLab[];
  datos: DatosMundo;
  visuales: Visuales;
  frescura: FilaReloj[];
}) {
  const router = useRouter();
  const [tema, setTema] = useState<"claro" | "oscuro">("claro");
  const [focoElegido, setFoco] = useState<IdSala | "todo" | null>(null);
  const [abierto, setAbierto] = useState<IdArea | "editor" | null>(null);
  const [vis, setVis] = useState(false);
  const [movil, setMovil] = useState(false);
  const [cambios, setCambios] = useState<CambiosAgentes>({});
  const [elegido, setElegido] = useState<IdEditable>("reloj");
  const [rescatadas, setRescatadas] = useState(0);
  const [preguntas, setPreguntas] = useState(0);
  const [aire, setAire] = useState<AireAgente | null | undefined>(undefined);
  const [reducido, setReducido] = useState(false);
  const [secVentanilla, setSecVentanilla] = useState("todas");
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const origenRef = useRef<HTMLElement | null>(null);
  const visiblesRef = useRef<Propuesta[]>([]);
  const timers = useRef<number[]>([]);
  const ventanilla = useVentanilla();
  const [refLateral, pLateral] = useEntrada<HTMLElement>();
  const [refHallazgo, pHallazgo] = useEntrada<HTMLElement>();

  const oscuro = tema === "oscuro";
  const EST = oscuro ? EST_OSCURO : EST_CLARO;
  const foco = focoElegido ?? (movil ? "reloj" : "todo");
  const ctx = useMemo<ContextoAgentes>(() => ({ ...datos, rescatadas, preguntas, aire }), [datos, rescatadas, preguntas, aire]);
  const agentes = useMemo(() => evaluarAgentes(ctx), [ctx]);
  const aspectos = useMemo(() => aspectosDe(cambios), [cambios]);
  const dias = useMemo(() => new Map(frescura.filter((f) => f.dias != null).map((f) => [f.id, f.dias as number])), [frescura]);

  const abrir = useCallback((id: IdArea | "editor") => {
    origenRef.current = document.activeElement as HTMLElement | null;
    timers.current.forEach(clearTimeout);
    setAbierto(id);
    setVis(false);
    timers.current = [window.setTimeout(() => setVis(true), 20)];
  }, []);
  const cerrar = useCallback(() => {
    setVis(false);
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current.forEach(clearTimeout);
    timers.current = [
      window.setTimeout(() => {
        setAbierto(null);
        origenRef.current?.focus?.();
      }, quieto ? 0 : 240),
    ];
  }, []);

  // preferencias guardadas en este navegador y parámetros de la URL (?tema=oscuro&abrir=ventanilla&foco=reloj)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- preferencias leídas al montar */
    setReducido(matchMedia("(prefers-reduced-motion: reduce)").matches);
    const mq = matchMedia("(max-width: 639px)");
    setMovil(mq.matches);
    const alCambiar = () => setMovil(mq.matches);
    mq.addEventListener("change", alCambiar);
    try {
      const t = localStorage.getItem(CLAVE_TEMA);
      if (t === "oscuro" || t === "claro") setTema(t);
      setCambios(limpiarCambios(JSON.parse(localStorage.getItem(CLAVE_AGENTES) || "{}")));
    } catch {
      /* sin almacenamiento: valores predeterminados */
    }
    const qs = new URLSearchParams(location.search);
    const t = qs.get("tema");
    if (t === "oscuro" || t === "claro") setTema(t);
    const f = qs.get("foco");
    if (f && RECORRIDO.some((r) => r[0] === f)) setFoco(f as IdSala | "todo");
    const ab = qs.get("abrir");
    if (ab === "editor" || AREAS_MUNDO.some((a) => a.id === ab)) abrir(ab as IdArea | "editor");
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => mq.removeEventListener("change", alCambiar);
  }, [abrir]);

  const cambiarTema = () => {
    const t = oscuro ? "claro" : "oscuro";
    setTema(t);
    try {
      localStorage.setItem(CLAVE_TEMA, t);
    } catch {
      /* sin almacenamiento */
    }
  };
  const guardarAgentes = (c: CambiosAgentes) => {
    setCambios(c);
    try {
      localStorage.setItem(CLAVE_AGENTES, JSON.stringify(c));
    } catch {
      /* sin almacenamiento */
    }
  };

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

  // Esc cierra el panel; el foco va al botón de volver; el fondo no se desplaza
  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => cerrarRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [abierto, cerrar]);

  const despachos = AREAS_MUNDO.map((a) => {
    const info = agentes[a.id as IdAgente];
    const [col, bg] = EST[info.estado];
    return {
      id: a.id,
      num: a.num,
      nombre: a.nombre,
      agente: NOMBRE[a.id],
      estado: info.estado,
      estadoTxt: TEXTO_ESTADO_AGENTE[info.estado],
      cifra: info.cifra,
      cap: CAPTION[a.id].replace("{e}", miles(datos.evaluables)),
      frase: info.frase,
      piso: PISOS[a.id],
      borde: BORDES[a.id],
      vivo: a.id === "lab" || a.id === "analista" || a.id === "monitoreo",
      col,
      bg,
      colOsc: EST_OSCURO[info.estado][0],
    };
  });
  const trabajando = despachos.filter((d) => d.estado === "trabajando").length;
  const teNecesitan = despachos.filter((d) => d.estado === "te-necesita").length;
  const atrasados = resumen.porEstado.atrasado + resumen.porEstado.critico;

  const datosEscena = useMemo<DatosEscena>(() => {
    const g = (id: IdAgente) => ({ cifra: agentes[id].cifra, estado: agentes[id].estado });
    const etq = (id: IdArea) => `Abrir ${AREAS_MUNDO.find((a) => a.id === id)!.nombre}: ${NOMBRE[id]}, ${TEXTO_ESTADO_AGENTE[agentes[id as IdAgente].estado]}`;
    return {
      total: datos.totalConjuntos,
      evaluables: datos.evaluables,
      atrasados: datos.porEstado.atrasado + datos.porEstado.critico,
      pctTxt: `${decimal(datos.pctAtrasados)} %`,
      porEstado: datos.porEstado,
      fechaCorta: fechaCortaColombia(datos.generado),
      globos: { reloj: g("reloj"), lab: g("lab"), ventanilla: g("ventanilla"), analista: g("analista"), monitoreo: g("monitoreo"), comunicaciones: g("comunicaciones") },
      etiquetas: { reloj: etq("reloj"), lab: etq("lab"), ventanilla: etq("ventanilla"), analista: etq("analista"), monitoreo: etq("monitoreo"), comunicaciones: etq("comunicaciones"), salida: "Salida a PULSO: abrir la ciudad en vivo" },
    };
  }, [agentes, datos]);

  const abrirSala = (id: IdSala) => (id === "salida" ? router.push("/") : abrir(id));
  const iFoco = RECORRIDO.findIndex((r) => r[0] === foco);
  const mover = (d: number) => setFoco(RECORRIDO[(iFoco + d + RECORRIDO.length) % RECORRIDO.length][0]);
  const dFoco = despachos.find((d) => d.id === foco);

  const diagnostico = [
    { v: resumen.porEstado.critico, t: "en estado crítico: más de 3 veces su plazo sin actualizarse", c: "#DC2626" },
    { v: resumen.porEstado["al-dia"], t: "al día con la periodicidad que prometieron", c: "#16A34A" },
    { v: resumen.fechasIrregulares, t: "publican la fecha en un formato no estándar", c: "#D97706" },
    { v: resumen.soloTablero, t: "solo muestran un tablero, sin datos para descargar", c: "#94A3B8" },
  ];

  const dAb = despachos.find((d) => d.id === abierto);
  const cab = dAb
    ? { num: dAb.num, nombre: dAb.nombre, agente: dAb.agente, estado: dAb.estadoTxt, estCol: dAb.col, estBg: oscuro ? dAb.bg : "#FFFFFF", piso: dAb.piso, borde: dAb.borde }
    : { num: "✎", nombre: "Editar agentes", agente: "Aspecto, ropa y accesorios de cada agente", estado: "se guarda en este navegador", estCol: oscuro ? "#94A3B8" : "#475569", estBg: oscuro ? "rgba(148,163,184,.14)" : "#FFFFFF", piso: "#EDF4FF", borde: "#B9D3FB" };
  const quietoModal = reducido;
  const panelClaro = "overflow-hidden rounded-[18px] border border-[#E3EAF3] bg-white text-[#0F172A]";

  return (
    <div style={oscuro ? VARS_OSCURO : VARS_CLARO} data-tema={tema}>
      <div className="flex min-h-dvh bg-[var(--bg)] text-[var(--tinta)]">
        {/* ───── barra lateral (≥ 1024 px) ───── */}
        <aside ref={refLateral} className="hidden w-[268px] flex-none flex-col gap-[26px] overflow-y-auto border-r border-[#16243A] bg-[#0B1220] px-[18px] py-[22px] text-[#E2E8F0] lg:sticky lg:top-0 lg:flex lg:h-dvh">
          <Marca sub="Agencia de datos" />
          <Ramas />
          <div className="flex flex-col gap-1.5">
            <p className="px-2 pb-1.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-[#64748B]">DESPACHOS</p>
            {despachos.map((d) => (
              <button
                key={d.id}
                onClick={() => abrir(d.id)}
                onMouseEnter={() => setFoco(d.id)}
                onFocus={() => setFoco(d.id)}
                aria-label={`Abrir ${d.nombre}: ${d.agente}, ${d.estadoTxt}`}
                className={`grid min-h-[50px] w-full grid-cols-[10px_1fr_auto] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-[#142339] ${abierto === d.id ? "bg-[#142339]" : ""}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: d.colOsc }} aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold text-[#F1F5F9]">{d.nombre}</span>
                  <span className="text-[11.5px] text-[#94A3B8]">
                    {d.agente} · {d.estadoTxt}
                  </span>
                </span>
                <span className="font-mono text-[13px] font-bold" style={{ color: d.colOsc }}>
                  {d.cifra}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <p className="px-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-[#64748B]">SECRETARÍAS CON MÁS CONJUNTOS</p>
            {datos.secretarias.slice(0, 6).map((s) => (
              <div key={s.publicador} className="flex flex-col gap-[5px] px-2">
                <div className="flex justify-between gap-2 text-[12.5px]">
                  <span className="text-[#CBD5E1]">{s.publicador}</span>
                  <span className="font-mono font-semibold text-[#F1F5F9]">
                    {s.atrasados}/{s.total}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-sm bg-[#1B2A40]">
                  <div className="h-full rounded-sm bg-[#F59E0B]" style={{ width: `${((s.atrasados / Math.max(1, s.total)) * 100 * pLateral).toFixed(1)}%` }} />
                </div>
              </div>
            ))}
            <p className="mx-2 mt-0.5 text-[11.5px] leading-normal text-[#64748B]">Conjuntos atrasados sobre publicados, según el catálogo de MEData.</p>
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <button onClick={cambiarTema} aria-pressed={oscuro} className="flex min-h-[44px] items-center justify-between gap-2.5 rounded-[10px] border border-[#22324B] px-3 text-[13px] font-semibold text-[#E2E8F0] hover:bg-[#142339]">
              <span>Modo oscuro</span>
              <span className="relative h-5 w-9 rounded-[10px] transition-colors" style={{ background: oscuro ? "#2563EB" : "#334155" }} aria-hidden="true">
                <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] duration-200" style={{ left: oscuro ? 18 : 2 }} />
              </span>
            </button>
            <p className="px-2 text-[11.5px] text-[#64748B]">
              {MARCA.nombre} · {MARCA.evento}
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ───── barra superior (< 1024 px) ───── */}
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2.5 bg-[#0B1220] px-4 py-2.5 text-[#E2E8F0] lg:hidden">
            <Marca sub="Agencia de datos" chico />
            <div className="flex items-center gap-1.5">
              <Ramas chico />
              <button onClick={cambiarTema} aria-label="Cambiar entre modo claro y oscuro" className="h-11 w-11 rounded-[10px] border border-[#22324B] font-mono text-[11px] text-[#E2E8F0]">
                {oscuro ? "Claro" : "Oscuro"}
              </button>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-[clamp(40px,6vw,72px)] px-[clamp(16px,3.5vw,40px)] pb-16 pt-[clamp(20px,4vw,44px)]">
            {/* ───── encabezado y oficina ───── */}
            <section className="flex flex-col gap-[22px]">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div className="flex max-w-[720px] flex-col gap-3">
                  <p className="font-mono text-[12px] font-semibold tracking-[0.14em] text-[var(--acento)]">AGENCIA DE DATOS · LA ALPUJARRA, MEDELLÍN</p>
                  <h1 className="text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.04] tracking-[-0.025em]">La oficina detrás del mapa</h1>
                  <p className="text-[clamp(15px,1.6vw,17px)] leading-relaxed text-[var(--tinta2)] [text-wrap:pretty]">
                    Aquí llegan los datos crudos de MEData. Cinco agentes revisan qué tan al día están, los limpian, proponen mejoras y responden preguntas. Lo que sale limpio es lo que PULSO muestra en el mapa de la ciudad.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trabajando > 0 && (
                    <span className="inline-flex min-h-[36px] items-center gap-2 rounded-[18px] bg-[var(--trBg)] px-3.5 text-[13px] font-semibold text-[var(--tr)]">
                      <span className="h-[7px] w-[7px] rounded-full bg-[var(--tr)]" aria-hidden="true" />
                      {trabajando} trabajando
                    </span>
                  )}
                  {teNecesitan > 0 && (
                    <span className="inline-flex min-h-[36px] items-center gap-2 rounded-[18px] bg-[var(--necBg)] px-3.5 text-[13px] font-semibold text-[var(--nec)]">
                      <span className="h-[7px] w-[7px] rounded-full bg-[var(--nec)]" aria-hidden="true" />
                      {teNecesitan} te {teNecesitan === 1 ? "necesita" : "necesitan"}
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-[var(--borde)] bg-[var(--sup)] shadow-[0_1px_2px_rgba(15,23,42,.04),0_12px_32px_-12px_rgba(15,23,42,.10)]">
                <ol className="grid border-b border-[var(--borde)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))]">
                  <li className="flex items-center gap-3 px-5 py-4">
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[var(--sup2)] font-mono text-[12px] font-bold text-[#64748B]">1</span>
                    <span className="flex flex-1 flex-col gap-1.5">
                      <span className="text-[14px] font-semibold">Datos crudos de MEData</span>
                      <span className="h-[3px] rounded-sm bg-[repeating-linear-gradient(90deg,#94A3B8_0_6px,transparent_6px_11px)]" aria-hidden="true" />
                    </span>
                  </li>
                  <li className="flex items-center gap-3 px-5 py-4">
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[#DBEAFE] font-mono text-[12px] font-bold text-[#1D4ED8]">2</span>
                    <span className="flex flex-1 flex-col gap-1.5">
                      <span className="text-[14px] font-semibold">La Agencia los audita y limpia</span>
                      <span className="h-[3px] rounded-sm bg-[linear-gradient(90deg,#60A5FA,#2563EB)]" aria-hidden="true" />
                    </span>
                  </li>
                  <li className="flex items-center gap-3 px-5 py-4">
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[#0B1220] font-mono text-[12px] font-bold text-[#34D399]">3</span>
                    <span className="flex flex-1 flex-col gap-1.5">
                      <Link href="/" className="text-[14px] font-semibold text-[var(--tinta)] hover:text-[var(--acento)]">
                        PULSO los muestra en el mapa →
                      </Link>
                      <span className="h-[3px] rounded-sm bg-[linear-gradient(90deg,#2563EB,#34D399)]" aria-hidden="true" />
                    </span>
                  </li>
                </ol>

                <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 pt-3.5">
                  <div role="toolbar" aria-label="Recorrido por las salas" className="flex flex-wrap gap-1.5">
                    {RECORRIDO.map(([id, t]) => {
                      const a = id === foco;
                      return (
                        <button
                          key={id}
                          aria-pressed={a}
                          onClick={() => setFoco(id)}
                          className={`min-h-[36px] whitespace-nowrap rounded-[18px] border px-3 text-[12.5px] font-semibold transition-colors hover:border-[#2563EB] ${a ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[var(--borde)] bg-[var(--sup)] text-[var(--tinta)]"}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => mover(-1)} aria-label="Sala anterior" className="h-11 w-11 rounded-xl border border-[var(--borde)] bg-[var(--sup)] text-[18px] hover:border-[#2563EB] hover:text-[#2563EB]">
                      ←
                    </button>
                    <button onClick={() => mover(1)} aria-label="Sala siguiente" className="h-11 w-11 rounded-xl border border-[var(--borde)] bg-[var(--sup)] text-[18px] hover:border-[#2563EB] hover:text-[#2563EB]">
                      →
                    </button>
                  </div>
                </div>

                <div className="px-2 pt-1.5" style={{ background: "var(--escena)" }}>
                  <OficinaEscena oscuro={oscuro} foco={foco} aspectos={aspectos} datos={datosEscena} onAbrir={abrirSala} />
                </div>

                {dFoco || foco === "salida" ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 border-t border-[var(--borde)] bg-[var(--sup2)] px-5 py-4">
                    <div className="flex max-w-[680px] items-start gap-3.5">
                      <span
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border font-mono text-[13px] font-bold"
                        style={dFoco ? { background: dFoco.piso, borderColor: dFoco.borde, color: "#0F172A" } : { background: "#0B1220", borderColor: "#2563EB", color: "#FFFFFF" }}
                      >
                        {dFoco ? dFoco.num : "→"}
                      </span>
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-bold">{dFoco ? dFoco.nombre : "Salida a PULSO"}</span>
                          <span className="text-[13px] text-[var(--tinta2)]">{dFoco ? dFoco.agente : "Medellín en vivo"}</span>
                          <span className="rounded-[10px] px-[9px] py-[3px] text-[12px] font-semibold" style={dFoco ? { background: dFoco.bg, color: dFoco.col } : { background: EST.trabajando[1], color: EST.trabajando[0] }}>
                            {dFoco ? dFoco.estadoTxt : "en vivo"}
                          </span>
                        </div>
                        <p className="text-[14px] leading-relaxed text-[var(--tinta2)] [text-wrap:pretty]">
                          {dFoco ? dFoco.frase : "Los datos que salen de la Agencia llegan al mapa: aire de SIATA, seguridad vial y hurto por comuna, rutas y PulsoBot."}
                        </p>
                      </div>
                    </div>
                    {dFoco ? (
                      <button onClick={() => abrir(dFoco.id)} className="min-h-[44px] rounded-xl bg-[#2563EB] px-5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]">
                        Abrir {dFoco.nombre}
                      </button>
                    ) : (
                      <Link href="/" className="flex min-h-[44px] items-center rounded-xl bg-[#2563EB] px-5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]">
                        Ir a la ciudad en vivo
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 border-t border-[var(--borde)] px-5 py-3.5">
                    <p className="min-w-0 flex-[1_1_320px] text-[13.5px] text-[var(--tinta2)]">Toca un despacho para abrir su herramienta. La salida azul lleva a PULSO, la ciudad en vivo.</p>
                    <div className="flex flex-wrap gap-3.5 text-[12px] text-[var(--tinta2)]">
                      {(
                        [
                          ["--tr", "trabajando"],
                          ["--es", "esperando"],
                          ["--nec", "te necesita"],
                          ["--ss", "sin señal"],
                        ] as const
                      ).map(([v, t]) => (
                        <span key={t} className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: `var(${v})` }} aria-hidden="true" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ───── lo que encontró la Agencia ───── */}
            <section ref={refHallazgo} aria-labelledby="hallazgo" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
              <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-[22px] bg-[#0B1220] p-[clamp(24px,3.5vw,36px)] text-[#E2E8F0]">
                <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,.28),transparent_70%)]" aria-hidden="true" />
                <h2 id="hallazgo" className="font-mono text-[12px] font-semibold tracking-[0.14em] text-[#93C5FD]">
                  LO QUE ENCONTRÓ LA AGENCIA
                </h2>
                <p className="font-mono text-[clamp(64px,9vw,104px)] font-bold leading-[0.95] tracking-[-0.04em] text-white" aria-label={`${decimal(resumen.pctAtrasados)} %`}>
                  {decimal(resumen.pctAtrasados * pHallazgo)} %
                </p>
                <div className="flex h-2 overflow-hidden rounded bg-[#1B2A40]" aria-hidden="true">
                  <div className="rounded bg-[linear-gradient(90deg,#D97706,#DC2626)]" style={{ width: `${(resumen.pctAtrasados * pHallazgo).toFixed(1)}%` }} />
                </div>
                <p className="max-w-[440px] text-[17px] leading-relaxed text-[#CBD5E1] [text-wrap:pretty]">
                  de los conjuntos de MEData que prometen actualizarse cada cierto tiempo está atrasado:{" "}
                  <strong className="text-white">
                    {miles(atrasados)} de {miles(resumen.evaluables)}
                  </strong>
                  .
                </p>
                <button onClick={() => abrir("reloj")} className="min-h-[46px] self-start rounded-xl bg-[#2563EB] px-[22px] text-[15px] font-bold text-white hover:bg-[#1D4ED8]">
                  Ver cuáles son →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {diagnostico.map((c) => (
                  <div key={c.t} className="flex flex-col gap-2.5 rounded-[18px] border border-[var(--borde)] bg-[var(--sup)] p-[18px]">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.c }} aria-hidden="true" />
                    <span className="font-mono text-[clamp(28px,3.4vw,38px)] font-bold tracking-[-0.02em]" aria-label={miles(c.v)}>
                      {miles(Math.round(c.v * pHallazgo))}
                    </span>
                    <span className="text-[13.5px] leading-snug text-[var(--tinta2)] [text-wrap:pretty]">{c.t}</span>
                  </div>
                ))}
                <p className="col-span-2 mx-0.5 mt-1 text-[12px] text-[var(--tinta2)]">
                  Catálogo de MEData ({miles(resumen.totalConjuntos)} conjuntos), consultado el {fechaColombia(resumen.generado)}.
                </p>
              </div>
            </section>

            <VisualesAgencia visuales={visuales} oscuro={oscuro} movil={movil} />

            {/* ───── el equipo ───── */}
            <section aria-labelledby="titulo-equipo" className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <h2 id="titulo-equipo" className="text-[clamp(26px,3.4vw,36px)] font-extrabold tracking-[-0.02em]">
                  El equipo
                </h2>
                <div className="flex flex-wrap items-center gap-x-[18px] gap-y-3">
                  <p className="text-[14px] text-[var(--tinta2)]">Cada cifra sale del catálogo de MEData o de SIATA</p>
                  <button onClick={() => abrir("editor")} className="min-h-[44px] rounded-xl border-[1.5px] border-[var(--borde2)] bg-[var(--sup)] px-[18px] text-[14px] font-bold hover:border-[#2563EB] hover:text-[#2563EB]">
                    Editar agentes
                  </button>
                </div>
              </div>
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,262px),1fr))]">
                {despachos.map((d) => {
                  const editable = d.id !== "analista";
                  const editar = () => {
                    if (!editable) return abrir(d.id);
                    setElegido(d.id as IdEditable);
                    abrir("editor");
                  };
                  return (
                    <article
                      key={d.id}
                      className="flex flex-col gap-3.5 rounded-[20px] border bg-[var(--sup)] p-[18px] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_16px_32px_-16px_rgba(15,23,42,.25)] motion-reduce:hover:translate-y-0"
                      style={{ borderColor: d.estado === "te-necesita" ? (oscuro ? "rgba(248,113,113,.4)" : "#FECACA") : "var(--borde)" }}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={editar}
                          aria-label={editable ? `Cambiar el aspecto de ${d.agente}` : `Abrir ${d.nombre}`}
                          className="relative h-16 w-16 flex-none overflow-hidden rounded-full border-2 p-0 transition-transform duration-200 hover:scale-[1.06] motion-reduce:hover:scale-100"
                          style={{ borderColor: d.borde, background: d.piso }}
                        >
                          <AvatarAgente id={d.id as IdEditable | "analista"} aspectos={aspectos} fondo={d.piso} />
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[15.5px] font-bold">{d.agente}</span>
                          <span className="text-[12.5px] text-[var(--tinta2)]">
                            {d.num} {d.nombre}
                          </span>
                          {editable && (
                            <button onClick={editar} className="mt-0.5 min-h-[24px] self-start p-0 text-[12.5px] font-semibold text-[var(--acento)] hover:underline">
                              Cambiar aspecto
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <span className="font-mono text-[36px] font-bold tracking-[-0.02em]" style={{ color: d.col }}>
                          {d.cifra}
                        </span>
                        <span className="text-[12.5px] text-[var(--tinta2)]">{d.cap}</span>
                        {d.vivo && <span className="rounded-md bg-[#D1FAE5] px-[7px] py-[3px] font-mono text-[10.5px] font-bold tracking-[0.1em] text-[#047857]">EN VIVO</span>}
                      </div>
                      <p className="flex-1 text-[14px] leading-relaxed text-[var(--tinta2)] [text-wrap:pretty]">{d.frase}</p>
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="inline-flex items-center gap-[7px] rounded-[14px] px-[11px] py-[5px] text-[12.5px] font-semibold" style={{ background: d.bg, color: d.col }}>
                          <span className="h-[7px] w-[7px] rounded-full" style={{ background: d.col }} aria-hidden="true" />
                          {d.estadoTxt}
                        </span>
                        <button
                          onClick={() => abrir(d.id)}
                          aria-label={`Abrir ${d.nombre}: ${d.agente}, ${d.estadoTxt}`}
                          className="min-h-[44px] rounded-xl border-[1.5px] border-[#2563EB] px-[18px] text-[14px] font-bold text-[var(--acento)] transition-colors hover:bg-[#2563EB] hover:text-white"
                        >
                          Abrir
                        </button>
                      </div>
                    </article>
                  );
                })}
                {[
                  { num: "07", agente: "Secretario ambiental", sala: "Sala ambiental", t: "Aire de SIATA en vivo por estación y los conjuntos ambientales de MEData, con su frescura y una propuesta de apertura." },
                  { num: "02", agente: "Agente de limpieza", sala: "Laboratorio de Limpieza, con la Científica", t: "Ella diagnostica y él aplica las reglas de limpieza, paso a paso." },
                ].map((x) => (
                  <article key={x.agente} className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-dashed border-[var(--borde2)] p-[18px]">
                    <div className="flex items-center gap-3">
                      <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[var(--borde2)] font-mono text-[14px] font-bold text-[var(--tinta2)]">{x.num}</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15.5px] font-bold">{x.agente}</span>
                        <span className="text-[12.5px] text-[var(--tinta2)]">{x.sala}</span>
                      </div>
                    </div>
                    <p className="flex-1 text-[14px] leading-relaxed text-[var(--tinta2)]">{x.t}</p>
                    <span className="self-start rounded-lg bg-[var(--sup2)] px-2.5 py-[5px] font-mono text-[11px] font-bold tracking-[0.1em] text-[var(--tinta2)]">PRÓXIMAMENTE</span>
                  </article>
                ))}
                <Link href="/" className="flex min-h-[220px] flex-col justify-between gap-3 rounded-[20px] bg-[#0B1220] p-[22px] text-[#E2E8F0] hover:bg-[#0F1B2E]">
                  <span className="flex items-center gap-2">
                    <span className="h-[9px] w-[9px] rounded-full bg-[#34D399] shadow-[0_0_0_4px_rgba(52,211,153,.2)]" aria-hidden="true" />
                    <span className="font-extrabold tracking-[0.06em]">PULSO</span>
                    <span className="text-[12.5px] text-[#94A3B8]">Medellín en vivo</span>
                  </span>
                  <span className="text-[14.5px] leading-relaxed text-[#CBD5E1]">Los datos que salen de la Agencia llegan al mapa: aire de SIATA, seguridad vial y hurto por comuna, rutas y PulsoBot.</span>
                  <span className="flex min-h-[44px] items-center justify-center rounded-xl bg-[#2563EB] text-[14px] font-bold text-white">Ir a la ciudad en vivo →</span>
                </Link>
              </div>
            </section>

            <footer className="flex flex-col gap-1.5 border-t border-[var(--borde)] pt-6 text-[12.5px] text-[var(--tinta2)]">
              <span>{MARCA.aviso}</span>
              <span>
                {MARCA.nombre} · {MARCA.equipo.join(" y ")} · {MARCA.institucion}
              </span>
            </footer>
          </main>
        </div>
      </div>

      {/* ───── herramienta del despacho / editor ───── */}
      {abierto && (
        <div
          onClick={(e) => e.target === e.currentTarget && cerrar()}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(11,18,32,.58)] backdrop-blur-[5px] transition-opacity duration-[220ms] sm:items-center sm:p-6"
          style={{ opacity: vis ? 1 : 0 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={cab.nombre}
            className="max-h-[94dvh] w-full max-w-[1040px] overflow-y-auto rounded-t-[22px] bg-[var(--bg)] text-[var(--tinta)] shadow-[0_40px_80px_-20px_rgba(0,0,0,.45)] transition-transform duration-[320ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] sm:max-h-[calc(100dvh-48px)] sm:rounded-[22px]"
            style={{ transform: vis || quietoModal ? "none" : movil ? "translateY(40px)" : "translateY(18px) scale(.975)" }}
          >
            <div className="sticky top-0 z-[2] flex flex-col gap-3.5 border-b px-[clamp(16px,3vw,28px)] pb-[18px] pt-3.5" style={{ background: oscuro ? "#0F1B2E" : cab.piso, borderColor: oscuro ? "#22324B" : cab.borde }}>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <button ref={cerrarRef} onClick={cerrar} className="-ml-2 min-h-[44px] rounded-xl px-3.5 text-[14px] font-bold hover:bg-[rgba(15,23,42,.06)]" style={{ color: oscuro ? "#F1F5F9" : "#0F172A" }}>
                  ← Volver a la oficina
                </button>
                {abierto === "ventanilla" && ventanilla.fase === "listo" && (
                  <button onClick={() => descargarCSV(visiblesRef.current, secVentanilla)} className="min-h-[44px] rounded-xl bg-[#2563EB] px-[18px] text-[14px] font-bold text-white hover:bg-[#1D4ED8]">
                    Descargar propuestas en CSV
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[15px] border-[1.5px] font-mono text-[16px] font-bold text-[#0F172A]" style={{ background: cab.piso, borderColor: cab.borde }}>
                  {cab.num}
                </span>
                <div className="flex min-w-[200px] flex-1 flex-col gap-[3px]">
                  <h2 className="text-[clamp(22px,3vw,30px)] font-extrabold tracking-[-0.02em]" style={{ color: oscuro ? "#F1F5F9" : "#0F172A" }}>
                    {cab.nombre}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5 text-[13.5px]" style={{ color: oscuro ? "#94A3B8" : "#475569" }}>
                    <span>{cab.agente}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-[3px] text-[12px] font-semibold" style={{ background: cab.estBg, color: cab.estCol }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cab.estCol }} aria-hidden="true" />
                      {cab.estado}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-5 p-[clamp(16px,3vw,28px)]">
              {abierto === "reloj" && <RelojDespacho datos={datos} filas={frescura} />}
              {abierto === "ventanilla" && <VentanillaDespacho carga={ventanilla} dias={dias} oscuro={oscuro} secretaria={secVentanilla} setSecretaria={setSecVentanilla} visiblesRef={visiblesRef} />}
              {abierto === "editor" && <EditorAgentes aspectos={aspectos} cambios={cambios} guardar={guardarAgentes} elegido={elegido} setElegido={setElegido} oscuro={oscuro} />}
              {abierto === "lab" && (
                <div className={panelClaro} style={VARS_CLARO}>
                  <PanelLaboratorio opciones={opcionesLab} reducido={reducido} onRescate={(n) => setRescatadas((t) => t + n)} />
                </div>
              )}
              {abierto === "monitoreo" && (
                <div className={panelClaro} style={VARS_CLARO}>
                  <PanelMonitoreo datos={datos} modo="modal" />
                </div>
              )}
              {abierto === "analista" && (
                <div className={panelClaro} style={VARS_CLARO}>
                  <PanelAnalista modo="modal" onRespuesta={() => setPreguntas((n) => n + 1)} />
                </div>
              )}
              {abierto === "comunicaciones" && (
                <div className={panelClaro} style={VARS_CLARO}>
                  <PanelComunicaciones />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

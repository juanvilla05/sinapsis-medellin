"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { decimal, miles } from "@/mundo/areas";
import type { DatosMundo } from "@/mundo/datos";
import { propuestasCSV, type Propuesta, type Prioridad } from "@/lib/ventanilla";
import type { DatosVentanilla } from "@/mundo/paneles/PanelVentanilla";
import type { EstadoFrescura } from "@/lib/catalogo";

/** Conjunto evaluable con su atraso (lo arma el servidor desde src/data/catalogo.json). */
export interface FilaReloj {
  id: string;
  titulo: string;
  publicador: string;
  periodicidad: string;
  modificado: string | null;
  dias: number | null;
  veces: number | null;
  estado: EstadoFrescura;
}

const MC = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const fechaCorta = (iso: string | null) => {
  if (!iso) return "sin fecha";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MC[m - 1]} ${a}`;
};
/** Barra de atraso en escala logarítmica: ×1 = 0 %, ×100 = 100 %; marcas en ×1,5 (8,8 %) y ×3 (23,9 %). */
const anchoLog = (r: number) => `${Math.min(100, Math.max(3, (Math.log(Math.max(1, r)) / Math.log(100)) * 100)).toFixed(1)}%`;
const colorAtraso = (e: EstadoFrescura) => (e === "critico" ? "#DC2626" : e === "atrasado" ? "#D97706" : e === "al-dia" ? "#16A34A" : "#94A3B8");
const textoEstado = (e: EstadoFrescura) => (e === "critico" ? "Crítico" : e === "atrasado" ? "Atrasado" : e === "al-dia" ? "Al día" : "Sin periodicidad");

const caja = "flex flex-col rounded-[18px] border border-[var(--borde)] bg-[var(--sup)]";

function BarraLog({ veces, estado, alto = 10 }: { veces: number; estado: EstadoFrescura; alto?: number }) {
  return (
    <div className="relative rounded-full bg-[var(--sup2)]" style={{ height: alto }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: anchoLog(veces), background: colorAtraso(estado) }} />
      {[8.8, 23.9].map((x) => (
        <span key={x} className="absolute -bottom-[3px] -top-[3px] w-[2px] bg-[var(--tinta)] opacity-30" style={{ left: `${x}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

/* ───────── 01 · Reloj de Frescura ───────── */

export function RelojDespacho({ datos, filas }: { datos: DatosMundo; filas: FilaReloj[] }) {
  const atrasados = datos.porEstado.atrasado + datos.porEstado.critico;
  const secretarias = useMemo(() => [...new Set(filas.map((f) => f.publicador))].sort((a, b) => a.localeCompare(b, "es")), [filas]);
  const [sec, setSec] = useState(datos.secretarias[0]?.publicador ?? "todas");
  const [mas, setMas] = useState(false);
  const ranking = filas
    .filter((f) => f.veces != null && (sec === "todas" || f.publicador === sec))
    .sort((a, b) => (b.veces ?? 0) - (a.veces ?? 0));
  const visibles = ranking.slice(0, mas ? ranking.length : 10);
  const estados: [EstadoFrescura, number, string][] = [
    ["al-dia", datos.porEstado["al-dia"], "al día"],
    ["atrasado", datos.porEstado.atrasado, "atrasados"],
    ["critico", datos.porEstado.critico, "críticos"],
    ["sin-periodicidad", datos.porEstado["sin-periodicidad"], "sin periodicidad"],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-[#0B1220] p-5 text-[#E2E8F0]">
          <span className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[#93C5FD]">CONJUNTOS CON PERIODICIDAD DECLARADA</span>
          <span className="font-mono text-[44px] font-bold tracking-[-0.03em] text-white">
            {miles(atrasados)} de {miles(datos.evaluables)}
          </span>
          <span className="text-[14px] text-[#CBD5E1]">atrasados: el {decimal(datos.pctAtrasados)} % lleva más de 1,5 veces su plazo sin actualizarse.</span>
        </div>
        <div className={`${caja} gap-3 p-5`}>
          <span className="text-[13px] font-semibold">Estado de los {miles(datos.totalConjuntos)} conjuntos</span>
          <div className="flex h-4 gap-0.5 overflow-hidden rounded-lg" aria-hidden="true">
            {estados.map(([e, n]) => (
              <span key={e} style={{ flex: n, background: colorAtraso(e) }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
            {estados.map(([e, n, t]) => (
              <span key={e} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: colorAtraso(e) }} aria-hidden="true" />
                <b className="font-mono">{miles(n)}</b> {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={`${caja} gap-3 p-[18px]`}>
        <span className="text-[14px] font-bold">Atrasados sobre publicados, por secretaría</span>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
          {datos.secretarias.slice(0, 6).map((s) => (
            <div key={s.publicador} className="flex flex-col gap-1.5 rounded-xl bg-[var(--sup2)] p-2.5">
              <span className="text-[12.5px] font-semibold">{s.publicador}</span>
              <span className="font-mono text-[20px] font-bold">
                {s.atrasados}/{s.total}
              </span>
              <div className="h-[5px] overflow-hidden rounded-full bg-[var(--borde)]">
                <div className="h-full bg-[#D97706]" style={{ width: `${(s.atrasados / Math.max(1, s.total)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${caja} gap-1.5 p-[18px]`}>
        <div className="flex flex-wrap items-end justify-between gap-3 pb-2">
          <label className="flex flex-col gap-1 text-[12px] text-[var(--tinta2)]">
            Los más atrasados de
            <select
              value={sec}
              onChange={(e) => {
                setSec(e.target.value);
                setMas(false);
              }}
              className="min-h-[44px] rounded-xl border border-[var(--borde)] bg-[var(--sup)] px-3 text-[14px] font-semibold text-[var(--tinta)]"
            >
              <option value="todas">Todas las secretarías</option>
              {secretarias.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[12px] text-[var(--tinta2)]">Veces su plazo, escala logarítmica · marcas en ×1, ×1,5 y ×3</span>
        </div>
        {visibles.length === 0 && <p className="py-3 text-[13.5px] text-[var(--tinta2)]">Esta secretaría no tiene conjuntos con periodicidad declarada: sin dato.</p>}
        {visibles.map((r) => (
          <div key={r.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(90px,1fr)_64px] items-center gap-3 border-t border-[var(--borde)] py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13.5px] font-semibold leading-snug">{r.titulo}</span>
              <span className="font-mono text-[11px] text-[var(--tinta2)]">
                {sec === "todas" ? `${r.publicador} · ` : ""}
                {r.periodicidad} · última {fechaCorta(r.modificado)}
              </span>
            </div>
            <BarraLog veces={r.veces ?? 1} estado={r.estado} alto={8} />
            <span className="text-right font-mono text-[13px] font-bold" style={{ color: colorAtraso(r.estado) }}>
              ×{decimal(r.veces ?? 0)}
            </span>
          </div>
        ))}
        {ranking.length > 10 && (
          <button onClick={() => setMas(!mas)} className="mt-2 min-h-[44px] self-center rounded-xl border-[1.5px] border-[#2563EB] px-5 text-[14px] font-bold text-[var(--acento)]">
            {mas ? "Ver solo los 10 primeros" : `Ver los ${miles(ranking.length)} conjuntos`}
          </button>
        )}
      </div>
      <p className="text-[12px] text-[var(--tinta2)]">
        Fuente: campo «modified» y periodicidad declarada del catálogo de MEData. Para revisar cada conjunto en vivo contra MEData, abre{" "}
        <Link href="/frescura" className="font-semibold text-[var(--acento)] underline">
          el Reloj completo
        </Link>
        .
      </p>
    </div>
  );
}

/* ───────── 03 · Ventanilla de Apertura ───────── */

type Carga = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; datos: DatosVentanilla };

export function useVentanilla() {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/ventanilla", { signal: ctrl.signal });
        const j = (await r.json()) as DatosVentanilla & { ok?: boolean };
        if (!r.ok || !j.ok) throw new Error("respuesta no válida");
        setCarga({ fase: "listo", datos: j });
      } catch {
        if (!ctrl.signal.aborted) setCarga({ fase: "error" });
      }
    })();
    return () => ctrl.abort();
  }, []);
  return carga;
}

export function descargarCSV(propuestas: Propuesta[], secretaria: string) {
  const blob = new Blob([propuestasCSV(propuestas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `propuestas-ventanilla${secretaria !== "todas" ? `-${secretaria.toLowerCase().replace(/\s+/g, "-")}` : ""}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PRIO: Record<Prioridad, { t: string; c: string; bg: string; cO: string; bgO: string }> = {
  alta: { t: "Alta", c: "#B91C1C", bg: "#FEE2E2", cO: "#FCA5A5", bgO: "rgba(248,113,113,.14)" },
  media: { t: "Media", c: "#B45309", bg: "#FEF3C7", cO: "#FCD34D", bgO: "rgba(251,191,36,.14)" },
  baja: { t: "Baja", c: "#475569", bg: "#E2E8F0", cO: "#CBD5E1", bgO: "rgba(148,163,184,.14)" },
};

export function VentanillaDespacho({
  carga,
  dias,
  oscuro,
  secretaria,
  setSecretaria,
  visiblesRef,
}: {
  carga: Carga;
  dias: Map<string, number>;
  oscuro: boolean;
  secretaria: string;
  setSecretaria(s: string): void;
  /** la cabecera del modal descarga lo que está filtrado */
  visiblesRef: { current: Propuesta[] };
}) {
  const [prio, setPrio] = useState<Prioridad | "todas">("todas");
  const [q, setQ] = useState("");
  const [mas, setMas] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const datos = carga.fase === "listo" ? carga.datos : null;
  const deSec = useMemo(() => (datos ? datos.propuestas.filter((p) => secretaria === "todas" || p.publicador === secretaria) : []), [datos, secretaria]);
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return deSec.filter((p) => (prio === "todas" || p.prioridad === prio) && (!t || p.titulo.toLowerCase().includes(t) || p.publicador.toLowerCase().includes(t)));
  }, [deSec, prio, q]);
  useEffect(() => {
    visiblesRef.current = filtradas;
  }, [filtradas, visiblesRef]);

  if (carga.fase === "cargando") return <p className="text-[14px] text-[var(--tinta2)]">Preparando las propuestas de la Ventanilla…</p>;
  if (carga.fase === "error" || !datos)
    return <p className="rounded-xl bg-[var(--sup)] p-4 text-[14px]">No pudimos cargar las propuestas en este momento. Intenta de nuevo en unos segundos o abre la página de la Ventanilla.</p>;

  const r = datos.resumen;
  const lim = mas ? filtradas.length : 12;
  const cnt = (k: Prioridad | "todas") => deSec.filter((p) => k === "todas" || p.prioridad === k).length;
  const copiar = (p: Propuesta) => {
    const texto = `${p.titulo} (${p.publicador}): ${p.hallazgos.map((h) => h.propuesta).join(" ")}`;
    navigator.clipboard?.writeText(texto).catch(() => {});
    setCopiado(p.id);
    setTimeout(() => setCopiado((c) => (c === p.id ? null : c)), 1600);
  };
  const totalPrio = Math.max(1, r.porPrioridad.alta + r.porPrioridad.media + r.porPrioridad.baja);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        {[
          [r.propuestas, "conjuntos con propuesta"],
          [r.acciones, "acciones propuestas"],
          [r.secretarias, "secretarías"],
        ].map(([n, t]) => (
          <div key={t} className="flex flex-col gap-1 rounded-2xl border border-[var(--borde)] bg-[var(--sup)] px-4 py-3.5">
            <span className="font-mono text-[28px] font-bold">{miles(n as number)}</span>
            <span className="text-[12.5px] text-[var(--tinta2)]">{t}</span>
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-[var(--borde)] bg-[var(--sup)] px-4 py-3.5 sm:col-span-2">
          <span className="text-[12.5px] text-[var(--tinta2)]">Prioridad de las {miles(r.propuestas)} propuestas</span>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-md" aria-hidden="true">
            <span style={{ flex: r.porPrioridad.alta / totalPrio, background: "#DC2626" }} />
            <span style={{ flex: r.porPrioridad.media / totalPrio, background: "#D97706" }} />
            {r.porPrioridad.baja > 0 && <span style={{ flex: r.porPrioridad.baja / totalPrio, background: "#94A3B8" }} />}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px]">
            <span>
              <b className="font-mono">{miles(r.porPrioridad.alta)}</b> alta
            </span>
            <span>
              <b className="font-mono">{miles(r.porPrioridad.media)}</b> media
            </span>
            <span>
              <b className="font-mono">{miles(r.porPrioridad.baja)}</b> baja
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--tinta2)]">
          Secretaría
          <select
            value={secretaria}
            onChange={(e) => {
              setSecretaria(e.target.value);
              setMas(false);
            }}
            className="min-h-[44px] max-w-full rounded-xl border border-[var(--borde)] bg-[var(--sup)] px-3 text-[14px] font-semibold text-[var(--tinta)]"
          >
            <option value="todas">Todas · {miles(datos.propuestas.length)} propuestas</option>
            {r.porSecretaria.map((s) => (
              <option key={s.publicador} value={s.publicador}>
                {s.publicador} · {s.propuestas}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-[12px] text-[var(--tinta2)]">
          Prioridad
          <div role="group" aria-label="Prioridad" className="flex flex-wrap gap-[3px] rounded-xl border border-[var(--borde)] bg-[var(--sup)] p-[3px]">
            {(["todas", "alta", "media", "baja"] as const).map((k) => (
              <button
                key={k}
                aria-pressed={prio === k}
                onClick={() => {
                  setPrio(k);
                  setMas(false);
                }}
                className={`min-h-[38px] rounded-[9px] px-3 text-[13px] font-semibold ${prio === k ? "bg-[#2563EB] text-white" : "text-[var(--tinta)]"}`}
              >
                {k === "todas" ? "Todas" : PRIO[k].t} · {cnt(k)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12px] text-[var(--tinta2)]">
          Buscar conjunto
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMas(false);
            }}
            placeholder="Ej.: dengue, vacunación…"
            className="min-h-[44px] rounded-xl border border-[var(--borde)] bg-[var(--sup)] px-3.5 text-[14px] text-[var(--tinta)]"
          />
        </label>
      </div>
      <div className="text-[13px] text-[var(--tinta2)]">
        {filtradas.length
          ? `${miles(filtradas.length)} propuestas${secretaria !== "todas" ? ` de ${secretaria}` : ""}${filtradas.length > lim ? ` · mostrando ${lim}` : ""}`
          : "No hay propuestas con ese filtro. Prueba con otra palabra o prioridad."}
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {filtradas.slice(0, lim).map((p, i) => {
          const pr = PRIO[p.prioridad];
          const d = dias.get(p.id);
          return (
            <article key={p.id} className="flex flex-col gap-3 rounded-[18px] border border-[var(--borde)] bg-[var(--sup)] p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_rgba(15,23,42,.3)] motion-reduce:hover:translate-y-0">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-[10px] px-2.5 py-1 text-[11.5px] font-bold" style={{ background: oscuro ? pr.bgO : pr.bg, color: oscuro ? pr.cO : pr.c }}>
                  Prioridad {pr.t.toLowerCase()}
                </span>
                <span className="font-mono text-[11px] text-[var(--tinta2)]">#{i + 1}</span>
              </div>
              <h3 className="text-[15px] font-bold leading-snug [text-wrap:pretty]">{p.titulo}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px] text-[var(--tinta2)]">
                <span>{p.publicador}</span>
                <span>{p.periodicidad}</span>
                <span>última: {fechaCorta(p.modificado)}</span>
              </div>
              {p.vecesAtraso != null && (p.estado === "critico" || p.estado === "atrasado" || p.estado === "al-dia") && (
                <div className="flex flex-col gap-1.5">
                  <BarraLog veces={p.vecesAtraso} estado={p.estado} />
                  <div className="flex justify-between gap-2 text-[12px]">
                    <span className="font-bold" style={{ color: colorAtraso(p.estado) }}>
                      {textoEstado(p.estado)} · ×{decimal(p.vecesAtraso)} su plazo
                    </span>
                    {d != null && <span className="font-mono text-[var(--tinta2)]">{miles(d)} días</span>}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1 rounded-xl bg-[var(--sup2)] p-3">
                <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-[#7C3AED]">PROPUESTA</span>
                {p.hallazgos.map((h) => (
                  <p key={h.tipo} className="text-[13.5px] leading-normal">
                    {h.propuesta}
                  </p>
                ))}
              </div>
              <button
                onClick={() => copiar(p)}
                className="min-h-[44px] self-start rounded-xl border border-[var(--borde)] px-3.5 text-[13px] font-semibold hover:border-[#2563EB] hover:text-[#2563EB]"
              >
                {copiado === p.id ? "Propuesta copiada ✓" : "Copiar propuesta"}
              </button>
            </article>
          );
        })}
      </div>
      {filtradas.length > lim && (
        <button onClick={() => setMas(true)} className="min-h-[44px] self-center rounded-xl border-[1.5px] border-[#2563EB] px-[22px] text-[14px] font-bold text-[var(--acento)]">
          Ver las {miles(filtradas.length)} propuestas
        </button>
      )}
      <p className="text-[12px] text-[var(--tinta2)]">Fuente: catálogo de MEData y reglas de la Ventanilla (src/lib/ventanilla.ts). Una propuesta por conjunto con al menos un problema.</p>
    </div>
  );
}

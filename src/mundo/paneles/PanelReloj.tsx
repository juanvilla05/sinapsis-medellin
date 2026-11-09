"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EstadoFrescura, ResumenCatalogo } from "@/lib/catalogo";
import type { FilaFrescura } from "@/lib/frescura";
import { decimal, fechaColombia, miles } from "../areas";

const EST: Record<EstadoFrescura, { t: string; c: string; bg: string; fg: string }> = {
  critico: { t: "Crítico", c: "#DC2626", bg: "#FEF2F2", fg: "#B91C1C" },
  atrasado: { t: "Atrasado", c: "#D97706", bg: "#FFFBEB", fg: "#B45309" },
  "al-dia": { t: "Al día", c: "#16A34A", bg: "#F0FDF4", fg: "#15803D" },
  "sin-periodicidad": { t: "Sin periodicidad", c: "#64748B", bg: "#F1F5F9", fg: "#475569" },
  "sin-fecha": { t: "Sin fecha", c: "#64748B", bg: "#F1F5F9", fg: "#475569" },
};
const ORDEN: EstadoFrescura[] = ["critico", "atrasado", "al-dia", "sin-periodicidad"];
type Tabla = "cargando" | "error" | "resultado";

export default function PanelReloj({ resumenInicial }: { resumenInicial: ResumenCatalogo }) {
  const [resumen, setResumen] = useState(resumenInicial);
  const [filas, setFilas] = useState<FilaFrescura[]>([]);
  const [tabla, setTabla] = useState<Tabla>("cargando");
  const [enVivo, setEnVivo] = useState(false);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<EstadoFrescura | "todos">("todos");

  const cargar = useCallback(async () => {
    setTabla("cargando");
    try {
      const r = await fetch("/api/catalogo", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setFilas(j.conjuntos);
      setResumen(j.resumen);
      setEnVivo(true);
      setTabla("resultado");
    } catch {
      // MEData no responde: usamos la última auditoría guardada
      try {
        const g = await (await fetch("/api/catalogo/guardado")).json();
        setFilas(g.conjuntos);
        setResumen(g.resumen);
      } catch {
        /* sin respaldo: la tabla queda vacía */
      }
      setEnVivo(false);
      setTabla("error");
    }
  }, []);

  useEffect(() => {
    // primera consulta en vivo al abrir el panel
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia la carga asíncrona del catálogo
    cargar();
  }, [cargar]);

  const total = resumen.totalConjuntos;
  const atrasados = resumen.porEstado.atrasado + resumen.porEstado.critico;
  const todasAtrasadas = resumen.porPublicador
    .filter((p) => p.total > 0 && p.atrasados === p.total)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const maxSec = Math.max(1, ...todasAtrasadas.map((p) => p.total));

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas
      .filter((f) => filtro === "todos" || f.estado === filtro)
      .filter((f) => !t || f.titulo.toLowerCase().includes(t) || f.publicador.toLowerCase().includes(t))
      .sort((a, b) => (b.vecesAtraso ?? -1) - (a.vecesAtraso ?? -1));
  }, [filas, q, filtro]);

  const fuente = `Fuente: MEData, Alcaldía de Medellín, ${enVivo ? "consultado en vivo el" : "auditoría guardada del"} ${fechaColombia(resumen.generado)}`;

  return (
    <div className="flex flex-col gap-[22px] p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-wrap items-baseline gap-4">
          <span className="font-mono text-[56px] font-semibold leading-none tracking-tight text-[#1E3A5F]">
            {decimal(resumen.pctAtrasados)} %
          </span>
          <span className="max-w-[340px] text-[15px] leading-snug text-[#0F172A]">
            {miles(atrasados)} de {miles(resumen.evaluables)} conjuntos con periodicidad comparable están atrasados.
          </span>
        </div>
        <button
          onClick={cargar}
          disabled={tabla === "cargando"}
          className="rounded-xl bg-[#2563EB] px-[18px] py-3 text-sm font-bold text-white hover:bg-[#1D4FD7] disabled:opacity-60"
        >
          {tabla === "cargando" ? "Consultando MEData…" : "↻ Actualizar en vivo desde MEData"}
        </button>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {ORDEN.map((e) => (
          <div key={e} className="flex flex-col gap-2 rounded-2xl border border-[#E3EAF3] px-4 py-3.5">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-[#475569]">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: EST[e].c }} />
              {EST[e].t}
            </span>
            <span className="font-mono text-[34px] font-semibold text-[#0F172A]">{miles(resumen.porEstado[e])}</span>
            <span className="text-[11.5px] text-[#475569]">
              {decimal((resumen.porEstado[e] / total) * 100)} % de {miles(total)} conjuntos
            </span>
          </div>
        ))}
      </div>
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-[7px]" aria-hidden="true">
        {ORDEN.map((e) => (
          <div key={e} style={{ flexGrow: resumen.porEstado[e], background: EST[e].c }} />
        ))}
      </div>

      <div className="grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        <div className="flex flex-col gap-3">
          <span className="text-[15px] font-bold text-[#1E3A5F]">Secretarías con todos sus conjuntos atrasados</span>
          {todasAtrasadas.map((p) => (
            <div key={p.publicador} className="grid grid-cols-[minmax(0,190px)_minmax(0,1fr)_40px] items-center gap-3">
              <span className="truncate text-[13.5px] text-[#0F172A]">{p.publicador}</span>
              <div className="h-3 overflow-hidden rounded-md bg-[#F4F7FB]">
                <div className="h-full rounded-md bg-[#D97706]" style={{ width: `${(p.total / maxSec) * 100}%` }} />
              </div>
              <span className="text-right font-mono text-[13px] text-[#0F172A]">{p.total}</span>
            </div>
          ))}
          <span className="text-[11.5px] text-[#475569]">Número de conjuntos por secretaría. El 100 % de cada una está atrasado.</span>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-[15px] font-bold text-[#1E3A5F]">Los {miles(total)} conjuntos</span>
          <label className="sr-only" htmlFor="buscar-reloj">
            Buscar conjunto o secretaría
          </label>
          <input
            id="buscar-reloj"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conjunto o secretaría…"
            className="rounded-[10px] border border-[#E3EAF3] px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#2563EB] focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            <button
              onClick={() => setFiltro("todos")}
              aria-pressed={filtro === "todos"}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filtro === "todos" ? "bg-[#1E3A5F] text-white" : "bg-[#F1F5F9] text-[#475569]"}`}
            >
              Todos {miles(total)}
            </button>
            {ORDEN.map((e) => (
              <button
                key={e}
                onClick={() => setFiltro(filtro === e ? "todos" : e)}
                aria-pressed={filtro === e}
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={
                  filtro === e
                    ? { background: EST[e].c, color: "#fff" }
                    : { background: EST[e].bg, color: EST[e].fg }
                }
              >
                {EST[e].t} {miles(resumen.porEstado[e])}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-[#E3EAF3]">
            <div className="grid grid-cols-[2fr_1.4fr_1fr_1fr] gap-2.5 bg-[#F4F7FB] px-3 py-2 text-[11px] font-bold tracking-wide text-[#475569]">
              <span>CONJUNTO</span>
              <span>SECRETARÍA</span>
              <span>ÚLTIMA ACT.</span>
              <span>ESTADO</span>
            </div>
            {tabla === "cargando" && (
              <>
                {["86%", "64%", "78%", "90%", "58%"].map((w, i) => (
                  <div key={i} className="grid animate-pulse grid-cols-[2fr_1.4fr_1fr_1fr] gap-2.5 border-t border-[#E3EAF3] p-3">
                    <span className="h-2.5 rounded bg-[#E3EAF3]" style={{ width: w }} />
                    <span className="h-2.5 w-3/4 rounded bg-[#E3EAF3]" />
                    <span className="h-2.5 w-[70%] rounded bg-[#E3EAF3]" />
                    <span className="h-2.5 w-[55%] rounded bg-[#E3EAF3]" />
                  </div>
                ))}
                <div className="border-t border-[#E3EAF3] p-3 text-[12.5px] text-[#475569]" aria-live="polite">
                  El Relojero está leyendo las fechas de actualización en MEData…
                </div>
              </>
            )}
            {tabla === "error" && (
              <div className="flex flex-col gap-1.5 border-t border-[#E3EAF3] p-5" role="status">
                <span className="text-sm font-bold text-[#0F172A]">MEData no responde en este momento.</span>
                <span className="text-[13px] text-[#475569]">
                  Mostramos la última auditoría guardada, del {fechaColombia(resumen.generado)}. Las cifras de arriba corresponden a esa
                  auditoría.
                </span>
                <button
                  onClick={cargar}
                  className="mt-1.5 self-start rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-2 text-[12.5px] font-bold text-[#1E3A5F]"
                >
                  Reintentar
                </button>
              </div>
            )}
            {tabla !== "cargando" && filas.length > 0 && visibles.length === 0 && (
              <div className="flex flex-col gap-1.5 border-t border-[#E3EAF3] p-5">
                <span className="text-sm font-bold text-[#0F172A]">Ningún conjunto coincide con “{q}”.</span>
                <span className="text-[13px] text-[#475569]">Prueba con otro nombre o quita los filtros de estado.</span>
              </div>
            )}
            {tabla !== "cargando" && visibles.length > 0 && (
              <div className="max-h-[22rem] overflow-auto">
                {visibles.slice(0, 250).map((f) => (
                  <div key={f.id} className="grid grid-cols-[2fr_1.4fr_1fr_1fr] items-center gap-2.5 border-t border-[#E3EAF3] px-3 py-2 text-[12.5px]">
                    <a
                      href={`https://medata.app.medellin.gov.co/dataset/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-semibold text-[#0F172A] hover:text-[#2563EB]"
                      title={f.titulo}
                    >
                      {f.titulo}
                    </a>
                    <span className="truncate text-[#475569]">{f.publicador}</span>
                    <span className="font-mono text-[11.5px] text-[#475569]">{f.modificado ?? "—"}</span>
                    <span>
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: EST[f.estado].bg, color: EST[f.estado].fg }}
                        title={f.vecesAtraso !== null ? `${decimal(f.vecesAtraso)} veces su plazo de actualización` : undefined}
                      >
                        {EST[f.estado].t}
                        {f.vecesAtraso !== null && f.estado !== "al-dia"
                          ? ` ×${f.vecesAtraso >= 10 ? miles(f.vecesAtraso) : decimal(f.vecesAtraso)}`
                          : ""}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <span className="font-mono text-[11.5px] text-[#475569]">{fuente}</span>
    </div>
  );
}

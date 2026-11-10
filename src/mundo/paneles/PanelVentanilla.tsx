"use client";

import { useEffect, useMemo, useState } from "react";
import { fechaColombia, miles } from "../areas";
import { ORDEN_TIPOS, PRIORIDADES, TIPOS, propuestasCSV, type Propuesta, type ResumenVentanilla, type TipoHallazgo } from "@/lib/ventanilla";

export interface DatosVentanilla {
  generado: string;
  resumen: ResumenVentanilla;
  propuestas: Propuesta[];
}

type Carga = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; datos: DatosVentanilla };

const POR_PAGINA = 12;

/**
 * Ventanilla de Apertura: una propuesta por conjunto de MEData con al menos un problema,
 * calculada del catálogo auditado (src/lib/ventanilla.ts). Asume fondo blanco.
 */
export default function PanelVentanilla({ inicial, modo = "modal" }: { inicial?: DatosVentanilla; modo?: "modal" | "pagina" }) {
  const [carga, setCarga] = useState<Carga>(inicial ? { fase: "listo", datos: inicial } : { fase: "cargando" });
  const [tipo, setTipo] = useState<TipoHallazgo | "todos">("todos");
  const [secretaria, setSecretaria] = useState<string>("todas");
  const [q, setQ] = useState("");
  const [cuantas, setCuantas] = useState(POR_PAGINA);

  useEffect(() => {
    if (inicial) return;
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
  }, [inicial]);

  const datos = carga.fase === "listo" ? carga.datos : null;

  const visibles = useMemo(() => {
    if (!datos) return [];
    const t = q.trim().toLowerCase();
    return datos.propuestas
      .filter((p) => tipo === "todos" || p.hallazgos.some((h) => h.tipo === tipo))
      .filter((p) => secretaria === "todas" || p.publicador === secretaria)
      .filter((p) => !t || p.titulo.toLowerCase().includes(t) || p.publicador.toLowerCase().includes(t));
  }, [datos, tipo, secretaria, q]);

  const descargar = () => {
    const blob = new Blob([propuestasCSV(visibles)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propuestas-ventanilla${secretaria !== "todas" ? `-${secretaria.toLowerCase().replace(/\s+/g, "-")}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const relleno = modo === "pagina" ? "p-5 sm:p-7" : "p-4 sm:p-6";

  if (carga.fase === "cargando")
    return (
      <div className={`${relleno} flex flex-col gap-3`} aria-live="polite">
        <span className="text-sm font-semibold text-[#475569]">Preparando las propuestas…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F1F5F9]" />
        ))}
      </div>
    );
  if (carga.fase === "error" || !datos)
    return (
      <div className={`${relleno} text-sm text-[#475569]`} role="alert">
        No pudimos cargar las propuestas en este momento. Intenta de nuevo en unos segundos.
      </div>
    );

  const r = datos.resumen;
  const maxSec = Math.max(1, ...r.porSecretaria.map((s) => s.propuestas));

  return (
    <div className={`${relleno} flex flex-col gap-6`}>
      {/* cifra principal */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-mono text-[44px] font-semibold leading-none tracking-tight text-[#4C1D95] sm:text-[56px]">{miles(r.propuestas)}</span>
          <span className="max-w-[440px] text-[15px] leading-snug text-[#0F172A]">
            conjuntos de MEData con propuestas de mejora ({miles(r.acciones)} acciones) de {miles(r.totalConjuntos)} publicados, en {miles(r.secretarias)} secretarías.
          </span>
        </div>
        <button onClick={descargar} className="rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6]">
          ↓ Descargar propuestas (CSV)
        </button>
      </div>

      {/* prioridades */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(["alta", "media", "baja"] as const).map((p) => (
          <div key={p} className="flex flex-col gap-1 rounded-2xl border border-[#E3EAF3] px-3 py-3 sm:px-4">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#475569] sm:text-[13px]">
              <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: PRIORIDADES[p].color }} aria-hidden="true" />
              {PRIORIDADES[p].texto}
            </span>
            <span className="font-mono text-[26px] font-semibold text-[#0F172A] sm:text-[32px]">{miles(r.porPrioridad[p])}</span>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-[11.5px] leading-snug text-[#475569]">
        Alta: conjunto crítico (más de 3 veces su plazo sin actualizar) o que solo publica un tablero. Media: atrasado, sin periodicidad o sin diccionario. Baja: solo le falta
        descripción.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        {/* por secretaría */}
        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-[15px] font-bold text-[#1E3A5F]">Propuestas por secretaría</span>
          <ul className="flex flex-col gap-1">
            {r.porSecretaria.slice(0, 10).map((s) => {
              const activa = secretaria === s.publicador;
              return (
                <li key={s.publicador}>
                  <button
                    onClick={() => {
                      setSecretaria(activa ? "todas" : s.publicador);
                      setCuantas(POR_PAGINA);
                    }}
                    aria-pressed={activa}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left hover:bg-[#F5F3FF] ${activa ? "bg-[#F5F3FF] ring-1 ring-[#C4B5FD]" : ""}`}
                  >
                    <span className="truncate text-[13px] text-[#0F172A]">{s.publicador}</span>
                    <span className="font-mono text-[12px] text-[#475569]">
                      {miles(s.propuestas)}/{miles(s.total)}
                    </span>
                    <span className="col-span-2 h-2 overflow-hidden rounded bg-[#F1F5F9]">
                      <span className="block h-full rounded bg-[#8B5CF6]" style={{ width: `${(s.propuestas / maxSec) * 100}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <span className="text-[11.5px] text-[#475569]">Conjuntos con propuesta sobre conjuntos publicados. Toca una secretaría para ver solo las suyas.</span>

          {/* propuesta general al portal */}
          <div className="mt-2 flex flex-col gap-1.5 rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
            <span className="text-[11px] font-bold tracking-[0.08em] text-[#6D28D9]">PROPUESTA GENERAL AL PORTAL</span>
            <span className="text-[13.5px] font-semibold leading-snug text-[#1E1B4B]">
              {miles(r.fechasIrregulares)} de {miles(r.totalConjuntos)} conjuntos publican su fecha de modificación como DD-MM-AAAA.
            </span>
            <span className="text-[12.5px] leading-snug text-[#475569]">
              Usar el formato estándar AAAA-MM-DD (ISO 8601) en todo el catálogo, para que cualquier herramienta pueda saber sin errores cuándo se actualizó cada conjunto.
            </span>
          </div>
        </div>

        {/* propuestas */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-[#1E3A5F]">
              {miles(visibles.length)} {visibles.length === 1 ? "propuesta" : "propuestas"}
              {secretaria !== "todas" && <span className="font-semibold text-[#6D28D9]"> · {secretaria}</span>}
            </span>
            {(tipo !== "todos" || secretaria !== "todas" || q) && (
              <button
                onClick={() => {
                  setTipo("todos");
                  setSecretaria("todas");
                  setQ("");
                  setCuantas(POR_PAGINA);
                }}
                className="text-[12.5px] font-bold text-[#2563EB] hover:underline"
              >
                Quitar filtros
              </button>
            )}
          </div>
          <label className="sr-only" htmlFor="buscar-ventanilla">
            Buscar conjunto o secretaría
          </label>
          <input
            id="buscar-ventanilla"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCuantas(POR_PAGINA);
            }}
            placeholder="Buscar conjunto o secretaría…"
            className="rounded-[10px] border border-[#E3EAF3] px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#6D28D9] focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de acción">
            <button
              onClick={() => setTipo("todos")}
              aria-pressed={tipo === "todos"}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tipo === "todos" ? "bg-[#1E3A5F] text-white" : "bg-[#F1F5F9] text-[#475569]"}`}
            >
              Todas {miles(r.propuestas)}
            </button>
            {ORDEN_TIPOS.filter((t) => r.porTipo[t] > 0).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTipo(t);
                  setCuantas(POR_PAGINA);
                }}
                aria-pressed={tipo === t}
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={tipo === t ? { background: TIPOS[t].color, color: "#FFFFFF" } : { background: TIPOS[t].fondo, color: TIPOS[t].color }}
              >
                {TIPOS[t].corto} {miles(r.porTipo[t])}
              </button>
            ))}
          </div>

          <ul className="flex flex-col gap-3" aria-live="polite">
            {visibles.slice(0, cuantas).map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-[#E3EAF3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-bold leading-snug text-[#0F172A]">{p.titulo}</span>
                    <span className="text-[12.5px] text-[#475569]">
                      {p.publicador}
                      {p.tema ? ` · ${p.tema}` : ""}
                    </span>
                  </div>
                  <span className="flex-none rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: PRIORIDADES[p.prioridad].fondo, color: PRIORIDADES[p.prioridad].color }}>
                    {PRIORIDADES[p.prioridad].texto}
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {p.hallazgos.map((h) => (
                    <li key={h.tipo} className="grid gap-1 rounded-xl px-3 py-2.5" style={{ background: TIPOS[h.tipo].fondo }}>
                      <span className="text-[11px] font-bold tracking-[0.06em]" style={{ color: TIPOS[h.tipo].color }}>
                        {TIPOS[h.tipo].largo.toUpperCase()}
                      </span>
                      <span className="text-[13px] leading-snug text-[#334155]">{h.problema}</span>
                      <span className="text-[13px] font-semibold leading-snug text-[#0F172A]">
                        <span aria-hidden="true">→ </span>
                        {h.propuesta}
                      </span>
                    </li>
                  ))}
                </ul>
                <a href={p.url} target="_blank" rel="noreferrer" className="self-start text-[12.5px] font-bold text-[#2563EB] hover:underline">
                  Ver el conjunto en MEData ↗
                </a>
              </li>
            ))}
          </ul>
          {visibles.length === 0 && <p className="rounded-xl bg-[#F8FAFC] p-4 text-[13px] text-[#475569]">No hay propuestas con estos filtros.</p>}
          {visibles.length > cuantas && (
            <button
              onClick={() => setCuantas((n) => n + POR_PAGINA)}
              className="self-center rounded-xl border border-[#E3EAF3] bg-white px-4 py-2 text-[13px] font-bold text-[#1E3A5F] hover:border-[#6D28D9]"
            >
              Ver {miles(Math.min(POR_PAGINA, visibles.length - cuantas))} más de {miles(visibles.length - cuantas)}
            </button>
          )}
        </div>
      </div>

      <p className="font-mono text-[11px] text-[#64748B]">
        Fuente: catálogo de MEData, Alcaldía de Medellín, auditoría del {fechaColombia(datos.generado)}. Reglas: src/lib/ventanilla.ts. Solo metadatos públicos, sin datos personales.
      </p>
    </div>
  );
}

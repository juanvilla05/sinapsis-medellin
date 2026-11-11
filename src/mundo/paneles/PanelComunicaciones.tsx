"use client";

import { useEffect, useMemo, useState } from "react";
import { decimal, fechaColombia, miles } from "../areas";
import { propuestasCSV, type Propuesta } from "@/lib/ventanilla";
import { slug } from "@/lib/informes";

interface FilaSec {
  publicador: string;
  propuestas: number;
  alta: number;
  total: number;
}
interface Datos {
  generado: string;
  resumen: { porSecretaria: FilaSec[]; propuestas: number; totalConjuntos: number };
  propuestas: Propuesta[];
}
type Carga = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; datos: Datos };

/** Comunicaciones: informes en PDF por secretaría (y general) y datos en CSV, listos para entregar. */
export default function PanelComunicaciones() {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/ventanilla", { signal: ctrl.signal });
        const j = (await r.json()) as Datos & { ok?: boolean };
        if (!r.ok || !j.ok) throw new Error("respuesta no válida");
        setCarga({ fase: "listo", datos: j });
        setSel(j.resumen.porSecretaria[0]?.publicador ?? null);
      } catch {
        if (!ctrl.signal.aborted) setCarga({ fase: "error" });
      }
    })();
    return () => ctrl.abort();
  }, []);

  const datos = carga.fase === "listo" ? carga.datos : null;
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (datos?.resumen.porSecretaria ?? []).filter((s) => !t || s.publicador.toLowerCase().includes(t));
  }, [datos, q]);

  if (carga.fase === "cargando")
    return (
      <div className="flex flex-col gap-3 p-6" aria-live="polite">
        <span className="text-sm font-semibold text-[#475569]">Preparando los informes…</span>
        <div className="h-40 animate-pulse rounded-2xl bg-[#F1F5F9]" />
      </div>
    );
  if (!datos)
    return (
      <div className="p-6 text-sm text-[#475569]" role="alert">
        No pudimos preparar los informes en este momento. Intenta de nuevo en unos segundos.
      </div>
    );

  const elegida = datos.resumen.porSecretaria.find((s) => s.publicador === sel) ?? null;
  const csv = (publicador: string | null) => {
    const filas = publicador ? datos.propuestas.filter((p) => p.publicador === publicador) : datos.propuestas;
    const url = URL.createObjectURL(new Blob([propuestasCSV(filas)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulso-propuestas-${publicador ? slug(publicador) : "todas"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const boton = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold transition-colors";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[620px]">
          <p className="text-[15px] leading-relaxed text-[#0F172A]">
            Cada secretaría puede llevarse <strong>su informe en PDF</strong>: qué tan al día están sus conjuntos, cuáles están atrasados y qué propone la Agencia, con la fuente y la fecha
            de corte. También están los datos en CSV.
          </p>
          <p className="mt-1 font-mono text-[11px] text-[#64748B]">Catálogo de MEData del {fechaColombia(datos.generado)} · solo metadatos públicos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/informe/general" target="_blank" rel="noreferrer" className={`${boton} bg-[#0B1220] text-white hover:bg-[#1E293B]`}>
            Informe general (PDF)
          </a>
          <button onClick={() => csv(null)} className={`${boton} border border-[#E3EAF3] bg-white text-[#0B1220] hover:border-[#C2410C]`}>
            Todas las propuestas (CSV)
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="buscar-sec" className="text-[13px] font-bold text-[#1E3A5F]">
            Elige una secretaría
          </label>
          <input
            id="buscar-sec"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar secretaría…"
            className="rounded-[10px] border border-[#E3EAF3] px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#C2410C] focus:outline-none"
          />
          <ul className="flex max-h-[340px] flex-col gap-1 overflow-y-auto pr-1">
            {lista.map((s) => (
              <li key={s.publicador}>
                <button
                  onClick={() => setSel(s.publicador)}
                  aria-pressed={sel === s.publicador}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[#FFF4ED] ${sel === s.publicador ? "bg-[#FFF4ED] font-bold text-[#9A3412] ring-1 ring-[#FDC9A9]" : "text-[#0F172A]"}`}
                >
                  <span className="truncate">{s.publicador}</span>
                  <span className="flex-none font-mono text-[11.5px] text-[#64748B]">{miles(s.total)} conj.</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {elegida && (
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#FDC9A9] bg-[#FFFBF8] p-5">
            <div>
              <p className="text-[11px] font-bold tracking-[0.1em] text-[#C2410C]">INFORME PARA</p>
              <h3 className="text-[22px] font-extrabold text-[#0B1220]">{elegida.publicador}</h3>
            </div>
            <dl className="grid grid-cols-3 gap-2">
              {[
                { v: miles(elegida.total), t: "conjuntos publicados" },
                { v: miles(elegida.propuestas), t: "con propuesta de mejora" },
                { v: miles(elegida.alta), t: "de prioridad alta" },
              ].map((k) => (
                <div key={k.t} className="rounded-xl bg-white p-3">
                  <dd className="font-mono text-[24px] font-semibold text-[#0B1220]">{k.v}</dd>
                  <dt className="text-[12px] leading-snug text-[#475569]">{k.t}</dt>
                </div>
              ))}
            </dl>
            <p className="text-[13px] leading-relaxed text-[#475569]">
              El {elegida.total ? decimal((elegida.propuestas / elegida.total) * 100, 0) : "0"} % de sus conjuntos tiene algo por mejorar. El PDF trae la tabla de sus conjuntos con su
              estado y última actualización, y la lista de propuestas con la cifra de cada problema.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={`/informe/${slug(elegida.publicador)}`} target="_blank" rel="noreferrer" className={`${boton} bg-[#C2410C] text-white hover:bg-[#9A3412]`}>
                ↓ Descargar informe (PDF)
              </a>
              <button onClick={() => csv(elegida.publicador)} className={`${boton} border border-[#FDC9A9] bg-white text-[#9A3412] hover:bg-[#FFF4ED]`}>
                Sus propuestas (CSV)
              </button>
            </div>
            <p className="text-[11.5px] text-[#64748B]">El informe se abre en una pestaña nueva; usa «Guardar como PDF» para descargarlo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

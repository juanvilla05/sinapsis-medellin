"use client";

import { useMemo, useState } from "react";
import type { EstadoFrescura, ResumenCatalogo } from "@/lib/catalogo";
import { ESTADOS, type FilaFrescura } from "@/lib/frescura";

const nf = new Intl.NumberFormat("es-CO");
const ORDEN_ESTADOS: EstadoFrescura[] = ["critico", "atrasado", "al-dia", "sin-periodicidad"];

function fechaLarga(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
}

export default function RelojFrescura({
  filasIniciales,
  resumenInicial,
}: {
  filasIniciales: FilaFrescura[];
  resumenInicial: ResumenCatalogo;
}) {
  const [filas, setFilas] = useState(filasIniciales);
  const [resumen, setResumen] = useState(resumenInicial);
  const [enVivo, setEnVivo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [publicador, setPublicador] = useState("todos");
  const [estado, setEstado] = useState<EstadoFrescura | "todos">("todos");

  async function actualizar() {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/catalogo", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setFilas(j.conjuntos);
      setResumen(j.resumen);
      setEnVivo(true);
    } catch (e) {
      setError(`No se pudo consultar MEData en este momento (${(e as Error).message}). Se muestra la última auditoría guardada.`);
    } finally {
      setCargando(false);
    }
  }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas
      .filter((f) => (publicador === "todos" || f.publicador === publicador) && (estado === "todos" || f.estado === estado))
      .filter((f) => !q || f.titulo.toLowerCase().includes(q) || f.tema.toLowerCase().includes(q))
      .sort((a, b) => (b.vecesAtraso ?? -1) - (a.vecesAtraso ?? -1));
  }, [filas, busqueda, publicador, estado]);

  const maxTotal = Math.max(...resumen.porPublicador.map((p) => p.total));

  return (
    <div className="mt-8 space-y-8">
      {/* Barra de estado de la consulta */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-white/70">
          <span className={`h-2 w-2 rounded-full ${enVivo ? "animate-pulse bg-[var(--verde)]" : "bg-white/40"}`} />
          {enVivo ? "Consultado en vivo" : "Última auditoría guardada"} · {fechaLarga(resumen.generado)}
        </span>
        <button
          onClick={actualizar}
          disabled={cargando}
          className="rounded-full bg-[var(--verde)] px-4 py-1.5 font-bold text-[#062014] transition hover:brightness-110 disabled:opacity-60"
        >
          {cargando ? "Consultando MEData…" : "Actualizar en vivo desde MEData"}
        </button>
        {error && <span className="text-[var(--critico)]">{error}</span>}
      </div>

      {/* Semáforo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORDEN_ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => setEstado(estado === e ? "todos" : e)}
            aria-pressed={estado === e}
            className={`tarjeta p-5 text-left transition hover:border-white/25 ${estado === e ? "ring-2 ring-white/40" : ""}`}
          >
            <span className="text-4xl font-extrabold" style={{ color: ESTADOS[e].color }}>
              {nf.format(resumen.porEstado[e])}
            </span>
            <span className="mt-1 block text-sm font-semibold text-white">{ESTADOS[e].texto}</span>
            <span className="block text-xs text-white/55">
              {e === "critico" && "más de 3 veces su plazo sin actualizarse"}
              {e === "atrasado" && "entre 1,5 y 3 veces su plazo"}
              {e === "al-dia" && "dentro de 1,5 veces su plazo"}
              {e === "sin-periodicidad" && "irregular o sin periodicidad comparable"}
            </span>
          </button>
        ))}
      </div>

      {/* Ranking por secretaría */}
      <section className="tarjeta p-6" aria-labelledby="ranking-titulo">
        <h2 id="ranking-titulo" className="text-xl font-bold text-white">
          Frescura por secretaría o entidad
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Cada barra es el total de conjuntos que publica la entidad. Toca una para filtrar la tabla.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/70">
          {(["critico", "atrasado", "al-dia", "sin-periodicidad"] as const).map((e) => (
            <span key={e} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ESTADOS[e].color }} />
              {ESTADOS[e].texto}
            </span>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {resumen.porPublicador.map((p) => {
            const deEsta = filas.filter((f) => f.publicador === p.publicador);
            const cuenta = (e: EstadoFrescura) => deEsta.filter((f) => f.estado === e).length;
            const activo = publicador === p.publicador;
            return (
              <li key={p.publicador}>
                <button
                  onClick={() => setPublicador(activo ? "todos" : p.publicador)}
                  aria-pressed={activo}
                  className={`grid w-full grid-cols-[minmax(8rem,14rem)_1fr_4.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/5 ${activo ? "bg-white/10" : ""}`}
                >
                  <span className="truncate text-white/85" title={p.publicador}>
                    {p.publicador}
                  </span>
                  <span className="flex h-4 overflow-hidden rounded" style={{ width: `${(p.total / maxTotal) * 100}%` }}>
                    {(["critico", "atrasado", "al-dia", "sin-periodicidad"] as const).map((e) => {
                      const n = cuenta(e);
                      return n ? (
                        <span
                          key={e}
                          title={`${ESTADOS[e].texto}: ${n}`}
                          style={{ flexGrow: n, background: ESTADOS[e].color }}
                          className="h-full border-r-2 border-[var(--panel)] last:border-r-0"
                        />
                      ) : null;
                    })}
                  </span>
                  <span className="text-right font-mono text-xs text-white/70">
                    {p.atrasados}/{p.total}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Tabla */}
      <section className="tarjeta p-6" aria-labelledby="tabla-titulo">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h2 id="tabla-titulo" className="text-xl font-bold text-white">
              Conjuntos, del más atrasado al más reciente
            </h2>
            <p className="text-sm text-white/60">
              {nf.format(visibles.length)} de {nf.format(filas.length)} conjuntos
              {publicador !== "todos" && ` · ${publicador}`}
              {estado !== "todos" && ` · ${ESTADOS[estado].texto}`}
            </p>
          </div>
          <label className="text-sm">
            <span className="sr-only">Buscar conjunto</span>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar: homicidio, incidentes, salud…"
              className="w-64 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-[var(--verde)] focus:outline-none"
            />
          </label>
          {(publicador !== "todos" || estado !== "todos" || busqueda) && (
            <button
              onClick={() => {
                setPublicador("todos");
                setEstado("todos");
                setBusqueda("");
              }}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Quitar filtros
            </button>
          )}
        </div>
        <div className="mt-4 max-h-[36rem] overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="sticky top-0 bg-[var(--panel-2)] text-left text-xs uppercase tracking-wide text-white/55">
              <tr>
                <th className="px-3 py-2">Conjunto</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Promete</th>
                <th className="px-3 py-2">Última modificación</th>
                <th className="px-3 py-2 text-right">Atraso</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.slice(0, 300).map((f) => (
                <tr key={f.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="max-w-xs px-3 py-2">
                    <a
                      href={`https://medata.app.medellin.gov.co/dataset/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-white hover:underline"
                    >
                      {f.titulo}
                    </a>
                    <span className="block text-xs text-white/45">{f.tema}</span>
                  </td>
                  <td className="px-3 py-2 text-white/75">{f.publicador}</td>
                  <td className="px-3 py-2 text-white/75">{f.periodicidad}</td>
                  <td className="px-3 py-2 font-mono text-xs text-white/75">
                    {f.modificado ?? "—"}
                    {f.diasSinActualizar !== null && (
                      <span className="block text-white/45">hace {nf.format(f.diasSinActualizar)} días</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {f.vecesAtraso !== null ? (
                      <span style={{ color: ESTADOS[f.estado].color }}>×{nf.format(f.vecesAtraso)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-[#08111f]"
                      style={{ background: ESTADOS[f.estado].color }}
                    >
                      {ESTADOS[f.estado].texto}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-white/50">
          Atraso = días desde la última modificación ÷ periodicidad declarada. Limitación: la fecha de modificación del portal puede
          no coincidir con la fecha del último dato del archivo; el Laboratorio de Limpieza revisa esa fecha real dentro de los datos.
        </p>
      </section>
    </div>
  );
}

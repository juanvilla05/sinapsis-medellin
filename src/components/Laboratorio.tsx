"use client";

import { useMemo, useState } from "react";
import type { InformeLaboratorio } from "@/lib/laboratorio";
import type { Diagnostico } from "@/lib/calidad";

interface Opcion {
  id: string;
  titulo: string;
  publicador: string;
  tema: string;
}
interface Respuesta {
  ok: boolean;
  error?: string;
  conjunto?: { id: string; titulo: string; publicador: string; periodicidad: string };
  informe?: InformeLaboratorio;
}

const nf = new Intl.NumberFormat("es-CO");

function colorPuntaje(p: number) {
  return p >= 85 ? "var(--al-dia)" : p >= 60 ? "var(--atrasado)" : "var(--critico)";
}

function Medidor({ valor, titulo }: { valor: number; titulo: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="h-28 w-28" role="img" aria-label={`${titulo}: ${valor} de 100`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={colorPuntaje(valor)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(valor / 100) * c} ${c}`}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="50" y="56" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">
          {valor}
        </text>
      </svg>
      <figcaption className="mt-1 text-xs uppercase tracking-wider text-white/60">{titulo}</figcaption>
    </figure>
  );
}

function Indicadores({ d }: { d: Diagnostico }) {
  const items = [
    { t: "Filas analizadas", v: nf.format(d.filas) },
    { t: "Filas vacías", v: nf.format(d.filasVacias), malo: d.filasVacias > 0 },
    { t: "Filas duplicadas", v: nf.format(d.filasDuplicadas), malo: d.filasDuplicadas > 0 },
    { t: "Celdas sin dato", v: `${nf.format(d.pctCeldasVacias)}%`, malo: d.pctCeldasVacias > 20 },
    { t: "Codificación rota", v: nf.format(d.celdasCodificacionRota), malo: d.celdasCodificacionRota > 0 },
    { t: "Caracteres ocultos", v: nf.format(d.celdasCaracteresOcultos), malo: d.celdasCaracteresOcultos > 0 },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.t} className="rounded-lg bg-white/[0.04] px-3 py-2">
          <dt className="text-[11px] text-white/55">{i.t}</dt>
          <dd className={`font-mono text-lg font-bold ${i.malo ? "text-[var(--critico)]" : "text-white"}`}>{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Laboratorio({ opciones, destacados }: { opciones: Opcion[]; destacados: string[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<Opcion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resp, setResp] = useState<Respuesta | null>(null);
  const [verDespues, setVerDespues] = useState(true);

  const destacadas = destacados.map((id) => opciones.find((o) => o.id === id)).filter(Boolean) as Opcion[];
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return opciones.filter((o) => o.titulo.toLowerCase().includes(q) || o.publicador.toLowerCase().includes(q)).slice(0, 12);
  }, [busqueda, opciones]);

  async function analizar(o: Opcion) {
    setElegido(o);
    setBusqueda("");
    setCargando(true);
    setResp(null);
    try {
      const r = await fetch("/api/laboratorio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: o.id }),
      });
      setResp(await r.json());
    } catch (e) {
      setResp({ ok: false, error: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }

  function descargar() {
    if (!resp?.informe || !resp.conjunto) return;
    const blob = new Blob(["﻿" + resp.informe.csvLimpio], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${resp.conjunto.id}_muestra_limpia_pulso.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const inf = resp?.informe;
  const antes = inf?.resultado.antes;
  const despues = inf?.resultado.despues;

  return (
    <div className="mt-8 space-y-8">
      {/* Selección */}
      <section className="tarjeta p-6" aria-labelledby="eleccion-titulo">
        <h2 id="eleccion-titulo" className="text-lg font-bold text-white">
          1. Elige un conjunto
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {destacadas.map((o) => (
            <button
              key={o.id}
              onClick={() => analizar(o)}
              disabled={cargando}
              className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${elegido?.id === o.id ? "border-[#3dd6c6] bg-[#3dd6c6]/15 text-white" : "border-white/15 text-white/80 hover:bg-white/10"}`}
            >
              {o.titulo}
            </button>
          ))}
        </div>
        <div className="relative mt-4 max-w-xl">
          <label htmlFor="buscar-conjunto" className="text-sm text-white/60">
            O busca cualquiera de los {nf.format(opciones.length)} conjuntos con archivo CSV:
          </label>
          <input
            id="buscar-conjunto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej.: nacimientos, comparendos, deserción…"
            className="mt-1 w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-[#3dd6c6] focus:outline-none"
            autoComplete="off"
          />
          {filtradas.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-white/15 bg-[var(--panel-2)] shadow-xl">
              {filtradas.map((o) => (
                <li key={o.id}>
                  <button onClick={() => analizar(o)} className="w-full px-4 py-2 text-left text-sm hover:bg-white/10">
                    <span className="block text-white">{o.titulo}</span>
                    <span className="block text-xs text-white/50">
                      {o.publicador} · {o.tema}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Agente trabajando */}
      {cargando && elegido && (
        <section className="tarjeta flex items-center gap-4 p-6" aria-live="polite">
          <span className="relative flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3dd6c6] opacity-60" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-[#3dd6c6]" />
          </span>
          <p className="text-white/80">
            La agente de calidad está descargando <strong className="text-white">{elegido.titulo}</strong> desde MEData y revisándolo
            columna por columna…
          </p>
        </section>
      )}

      {resp && !resp.ok && (
        <p className="tarjeta border-[var(--critico)]/40 p-5 text-[var(--critico)]" role="alert">
          No se pudo analizar el conjunto: {resp.error}
        </p>
      )}

      {inf && antes && despues && resp?.conjunto && (
        <>
          {/* Resultado principal */}
          <section className="tarjeta grid gap-6 p-6 lg:grid-cols-[auto_1fr]" aria-labelledby="resultado-titulo">
            <div className="flex items-center gap-4">
              <Medidor valor={antes.puntaje} titulo="Antes" />
              <span className="text-2xl text-white/40" aria-hidden="true">
                →
              </span>
              <Medidor valor={despues.puntaje} titulo="Después" />
            </div>
            <div>
              <h2 id="resultado-titulo" className="text-xl font-bold text-white">
                2. Diagnóstico de «{resp.conjunto.titulo}»
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {resp.conjunto.publicador} · promete actualización {resp.conjunto.periodicidad.toLowerCase()} · archivo de{" "}
                {inf.bytesTotales ? `${nf.format(Math.round(inf.bytesTotales / 1048576))} MB` : "tamaño desconocido"}, unas{" "}
                {nf.format(inf.filasEstimadasArchivo ?? 0)} filas
              </p>
              {antes.fechaDatoMax && (
                <p className="mt-3 rounded-lg border border-[var(--atrasado)]/30 bg-[var(--atrasado)]/10 px-3 py-2 text-sm text-white/90">
                  Dato más reciente encontrado: <strong>{antes.fechaDatoMax}</strong> (columna{" "}
                  <code className="font-mono text-xs">{antes.columnaFechaDato}</code>)
                  {inf.esMuestra && " en la parte leída del archivo"}.
                  {inf.filasFinal > 0 && inf.vaciasFinal === inf.filasFinal && (
                    <span className="mt-1 block text-[var(--critico)]">
                      Ojo: el final del archivo solo tiene filas vacías ({nf.format(inf.vaciasFinal)} leídas), así que la fecha más
                      reciente real no se puede ver sin descargar el archivo completo.
                    </span>
                  )}
                </p>
              )}
              <div className="mt-4">
                <Indicadores d={antes} />
              </div>
            </div>
          </section>

          {/* Bitácora y reglas */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="tarjeta p-6" aria-labelledby="bitacora-titulo">
              <h2 id="bitacora-titulo" className="text-lg font-bold text-white">
                Bitácora de la agente
              </h2>
              <ol className="mt-3 space-y-3 border-l border-white/15 pl-4">
                {inf.bitacora.map((b) => (
                  <li key={b.paso} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#3dd6c6]" />
                    <p className="text-sm font-semibold text-white">
                      {b.paso} <span className="font-mono text-xs font-normal text-white/45">{nf.format(b.ms)} ms</span>
                    </p>
                    <p className="text-sm text-white/70">{b.detalle}</p>
                  </li>
                ))}
              </ol>
            </section>
            <section className="tarjeta p-6" aria-labelledby="reglas-titulo">
              <h2 id="reglas-titulo" className="text-lg font-bold text-white">
                Reglas de limpieza aplicadas
              </h2>
              {inf.resultado.cambios.length === 0 ? (
                <p className="mt-3 text-sm text-white/70">La parte leída no necesitó cambios.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {inf.resultado.cambios.map((c) => (
                    <li key={c.regla} className="flex items-start justify-between gap-4 rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="text-sm text-white/85">{c.descripcion}</span>
                      <span className="font-mono text-sm font-bold text-[#3dd6c6]">{nf.format(c.afectadas)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={descargar}
                className="mt-4 rounded-full bg-[#3dd6c6] px-4 py-2 text-sm font-bold text-[#04211e] hover:brightness-110"
              >
                Descargar muestra limpia (sin columnas personales ni horas exactas)
              </button>
            </section>
          </div>

          {/* Antes / después */}
          <section className="tarjeta p-6" aria-labelledby="comparar-titulo">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="comparar-titulo" className="mr-auto text-lg font-bold text-white">
                3. Antes y después
              </h2>
              <div role="group" aria-label="Versión de los datos" className="inline-flex rounded-full border border-white/15 p-1 text-sm">
                <button
                  onClick={() => setVerDespues(false)}
                  aria-pressed={!verDespues}
                  className={`rounded-full px-4 py-1 ${!verDespues ? "bg-white text-[#08111f]" : "text-white/70"}`}
                >
                  Original
                </button>
                <button
                  onClick={() => setVerDespues(true)}
                  aria-pressed={verDespues}
                  className={`rounded-full px-4 py-1 ${verDespues ? "bg-[#3dd6c6] text-[#04211e]" : "text-white/70"}`}
                >
                  Limpio
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-white/55">Las celdas que la agente modificó están resaltadas.</p>
            <div className="mt-4 overflow-auto rounded-lg border border-white/10">
              <table className="min-w-full font-mono text-xs">
                <thead className="bg-[var(--panel-2)] text-left text-white/60">
                  <tr>
                    {inf.encabezado.map((h, j) => (
                      <th key={j} className="whitespace-nowrap px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inf.ejemploAntes.map((fila, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {inf.encabezado.map((_, j) => {
                        const original = fila[j] ?? "";
                        const limpio = inf.ejemploDespues[i][j];
                        const cambio = original !== limpio;
                        const valor = verDespues ? limpio : original;
                        return (
                          <td
                            key={j}
                            className={`whitespace-pre px-3 py-1.5 ${cambio ? (verDespues ? "bg-[#3dd6c6]/15 text-[#7ff0e4]" : "bg-[var(--critico)]/15 text-[#fecaca]") : "text-white/75"}`}
                            title={cambio ? `Original: ${JSON.stringify(original)} → Limpio: ${JSON.stringify(limpio)}` : undefined}
                          >
                            {valor === "" ? <span className="text-white/25">∅</span> : verDespues ? valor : JSON.stringify(valor).slice(1, -1)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Perfil de columnas */}
          <section className="tarjeta p-6" aria-labelledby="columnas-titulo">
            <h2 id="columnas-titulo" className="text-lg font-bold text-white">
              Perfil de cada columna
            </h2>
            <div className="mt-4 overflow-auto rounded-lg border border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--panel-2)] text-left text-xs uppercase tracking-wide text-white/55">
                  <tr>
                    <th className="px-3 py-2">Columna</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2 text-right">Sin dato</th>
                    <th className="px-3 py-2 text-right">Valores distintos</th>
                    <th className="px-3 py-2">Problemas</th>
                  </tr>
                </thead>
                <tbody>
                  {antes.columnasPerfil.map((c) => {
                    const probs = [
                      c.conCodificacionRota && `${nf.format(c.conCodificacionRota)} con codificación rota`,
                      c.conCaracteresOcultos && `${nf.format(c.conCaracteresOcultos)} con caracteres ocultos`,
                      c.conComaDecimal && `${nf.format(c.conComaDecimal)} con coma decimal`,
                      c.fechaMin && `fechas ${c.fechaMin} → ${c.fechaMax}`,
                    ].filter(Boolean);
                    return (
                      <tr key={c.nombre} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono text-xs text-white">{c.nombre}</td>
                        <td className="px-3 py-2 text-white/70">{c.tipo}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded bg-white/10">
                              <span
                                className="block h-full"
                                style={{ width: `${c.pctVacios}%`, background: c.pctVacios > 50 ? "var(--critico)" : "var(--atrasado)" }}
                              />
                            </span>
                            {nf.format(c.pctVacios)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-white/70">{nf.format(c.distintos)}</td>
                        <td className="px-3 py-2 text-xs text-white/70">{probs.join(" · ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-white/50">
              Análisis sobre {nf.format(inf.bytesLeidos / 1048576)} MB leídos del archivo
              {inf.esMuestra ? " (inicio y final): es una muestra, no el archivo completo" : " completo"}. Fuente:{" "}
              <a className="underline" href={inf.url} target="_blank" rel="noreferrer">
                archivo en MEData
              </a>
              .
            </p>
          </section>
        </>
      )}
    </div>
  );
}

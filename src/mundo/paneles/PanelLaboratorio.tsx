"use client";

import { useEffect, useRef, useState } from "react";
import type { InformeLaboratorio } from "@/lib/laboratorio";
import { decimal, fechaColombia, miles } from "../areas";

export interface OpcionLab {
  id: string;
  titulo: string;
  publicador: string;
  periodicidad: string;
}

const FILAS = 9;
const COLS = 16;
const PASOS = ["Recibe el expediente", "Ilumina los problemas", "Repara celda a celda", "Sube la calidad"];

/** Celdas con problema en la vista esquemática, calculadas con el diagnóstico real. */
function celdasProblema(inf: InformeLaboratorio): number[] {
  const a = inf.resultado.antes;
  const malas = a.filasVacias + a.filasDuplicadas;
  const fracFilas = a.filas ? malas / a.filas : 0;
  const filasMalas = fracFilas > 0 ? Math.max(1, Math.round(FILAS * fracFilas)) : 0;
  const nCol = Math.max(1, a.columnas);
  const huboFechas = inf.resultado.cambios.some((c) => c.regla === "fechas");
  const colsMalas = new Set<number>();
  a.columnasPerfil.forEach((c, j) => {
    if (c.conCodificacionRota + c.conCaracteresOcultos + c.conComaDecimal > 0 || (huboFechas && c.tipo === "fecha"))
      colsMalas.add(Math.min(COLS - 1, Math.floor((j * COLS) / nCol)));
  });
  const out: number[] = [];
  for (let i = 0; i < FILAS * COLS; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    if (r >= FILAS - filasMalas) out.push(i);
    else if (colsMalas.has(c) && (r + c) % 2 === 0) out.push(i);
  }
  return out;
}

export default function PanelLaboratorio({
  opciones,
  reducido,
  onRescate,
}: {
  opciones: OpcionLab[];
  reducido: boolean;
  onRescate: (filas: number) => void;
}) {
  const [elegido, setElegido] = useState(opciones[0]?.id ?? "");
  const [fase, setFase] = useState(0); // 0 sin iniciar · 1 descargando · 2 problemas · 3 reparando · 4 listo
  const [informe, setInforme] = useState<InformeLaboratorio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reparadas, setReparadas] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const limpiarTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => limpiarTimers, []);

  const problemas = informe ? celdasProblema(informe) : [];
  const indice = new Map(problemas.map((p, i) => [p, i]));

  async function iniciar() {
    limpiarTimers();
    setError(null);
    setInforme(null);
    setReparadas(0);
    setFase(1);
    try {
      const r = await fetch("/api/laboratorio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: elegido }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      const inf: InformeLaboratorio = j.informe;
      const probs = celdasProblema(inf);
      const rescate = inf.resultado.antes.filasVacias + inf.resultado.antes.filasDuplicadas;
      setInforme(inf);
      if (reducido) {
        setReparadas(probs.length);
        setFase(4);
        onRescate(rescate);
        return;
      }
      setFase(2);
      timers.current.push(
        setTimeout(() => {
          setFase(3);
          const paso = Math.max(1, Math.ceil(probs.length / 30));
          const tick = (n: number) => {
            if (n >= probs.length) {
              setReparadas(probs.length);
              setFase(4);
              onRescate(rescate);
              return;
            }
            setReparadas(n);
            timers.current.push(setTimeout(() => tick(n + paso), 80));
          };
          tick(0);
        }, 1200),
      );
    } catch (e) {
      setError((e as Error).message);
      setFase(0);
    }
  }

  function descargar() {
    if (!informe) return;
    const blob = new Blob(["﻿" + informe.csvLimpio], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${elegido}_muestra_limpia_pulso.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const antes = informe?.resultado.antes.puntaje ?? 0;
  const despues = informe?.resultado.despues.puntaje ?? 0;
  const frac = fase === 4 ? 1 : fase === 3 && problemas.length ? reparadas / problemas.length : 0;
  const q = informe ? Math.round(antes + (despues - antes) * frac) : 0;
  const colorQ = q >= 90 ? "#16A34A" : q >= 50 ? "#2563EB" : "#DC2626";
  const titulo = opciones.find((o) => o.id === elegido)?.titulo ?? "";

  const bitacora: { n: string; t: string }[] =
    fase === 0
      ? [{ n: "—", t: "Elige un conjunto e inicia la misión. La científica lo descarga en vivo desde MEData." }]
      : fase === 1
        ? [{ n: "01", t: `Expediente recibido: ${titulo}. Descargando desde MEData…` }]
        : (informe?.bitacora ?? []).map((b, i) => ({ n: String(i + 1).padStart(2, "0"), t: `${b.detalle} (${miles(b.ms)} ms)` }));

  return (
    <div className="grid items-start gap-[22px] p-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
      <div className="flex flex-col gap-4">
        <span className="text-[13px] font-bold text-[#475569]">1 · Elige un conjunto</span>
        {opciones.map((o) => {
          const sel = o.id === elegido;
          return (
            <button
              key={o.id}
              onClick={() => {
                limpiarTimers();
                setElegido(o.id);
                setFase(0);
                setInforme(null);
                setError(null);
              }}
              disabled={fase > 0 && fase < 4}
              aria-pressed={sel}
              className="flex flex-col gap-1 rounded-[14px] border-[1.5px] px-3.5 py-3 text-left disabled:cursor-not-allowed"
              style={{ borderColor: sel ? "#2563EB" : "#E3EAF3", background: sel ? "#EFF6FF" : "#FFFFFF" }}
            >
              <span className="text-sm font-bold text-[#0F172A]">{o.titulo}</span>
              <span className="font-mono text-[11.5px] text-[#475569]">
                {o.publicador} · promete actualización {o.periodicidad.toLowerCase()} · se descarga en vivo
              </span>
            </button>
          );
        })}
        <a href="/laboratorio" className="text-[12.5px] font-bold text-[#2563EB] hover:text-[#1E3A5F]">
          Analizar cualquiera de los conjuntos de MEData →
        </a>
        <div className="flex flex-col items-center gap-2.5 rounded-[18px] border border-[#E3EAF3] p-[18px]">
          <span className="self-start text-[13px] font-bold text-[#475569]">Medidor de calidad</span>
          <div
            className="relative h-[170px] w-[170px] rounded-full"
            style={{ background: `conic-gradient(${colorQ} ${q * 3.6}deg, #E3EAF3 0)` }}
            role="img"
            aria-label={`Calidad ${q} de 100`}
          >
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
              <span className="font-mono text-[46px] font-semibold leading-none text-[#0F172A]">{informe ? q : "—"}</span>
              <span className="text-[11.5px] text-[#475569]">de 100</span>
            </div>
          </div>
          {informe && (
            <div className="flex items-center gap-2.5 font-mono text-[13px]">
              <span className="text-[#DC2626]">antes {antes}</span>
              <span className="text-[#64748B]">→</span>
              <span className="text-[#16A34A]">después {despues}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-[13px] font-bold text-[#475569]">2 · La misión</span>
          <button
            onClick={iniciar}
            disabled={fase > 0 && fase < 4}
            className="rounded-xl bg-[#2563EB] px-[18px] py-[11px] text-sm font-bold text-white hover:bg-[#1D4FD7] disabled:opacity-70"
          >
            {fase === 0 ? "Iniciar misión" : fase === 4 ? "Repetir misión" : "Misión en curso…"}
          </button>
        </div>
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Pasos de la misión">
          {PASOS.map((p, i) => (
            <li key={p} className="flex flex-col gap-1.5" aria-current={fase === i + 1 ? "step" : undefined}>
              <div className="h-1 rounded-sm" style={{ background: fase > i ? "#2563EB" : "#E3EAF3" }} />
              <span className="text-[11.5px] font-semibold leading-tight" style={{ color: fase > i ? "#1E3A5F" : "#64748B" }}>
                {p}
              </span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-[repeat(16,1fr)] gap-[3px] rounded-[14px] border border-[#E3EAF3] bg-[#FBFCFE] p-3" aria-hidden="true">
          {Array.from({ length: FILAS * COLS }, (_, i) => {
            const k = indice.get(i);
            let bg = fase === 1 ? "#EFF6FF" : "#F1F5F9";
            let bd = "#E3EAF3";
            if (k !== undefined && fase >= 2) {
              const ok = fase === 4 || k < reparadas;
              bg = ok ? "#DCFCE7" : "#FEE2E2";
              bd = ok ? "#16A34A" : "#DC2626";
            }
            return (
              <span
                key={i}
                className={`aspect-[1.6] rounded-[3px] transition-colors duration-200 ${fase === 1 ? "animate-pulse" : ""}`}
                style={{ background: bg, boxShadow: `inset 0 0 0 1px ${bd}` }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3.5 text-[11.5px] text-[#475569]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#FEE2E2] shadow-[inset_0_0_0_1px_#DC2626]" />
            Con problema
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#DCFCE7] shadow-[inset_0_0_0_1px_#16A34A]" />
            Reparada
          </span>
          <span>Vista esquemática: filas vacías o duplicadas abajo, columnas con problemas resaltadas</span>
        </div>
        {error && (
          <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[13px] text-[#B91C1C]" role="alert">
            MEData no respondió: {error}. Intenta de nuevo en un momento.
          </p>
        )}
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          <div className="flex flex-col gap-2 rounded-[14px] border border-[#E3EAF3] px-3.5 py-3" aria-live="polite">
            <span className="text-xs font-bold text-[#475569]">Bitácora</span>
            {bitacora.map((l, i) => (
              <div key={i} className="flex gap-2 text-[12.5px] leading-snug text-[#0F172A]">
                <span className="font-mono text-[#2563EB]">{l.n}</span>
                <span>{l.t}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-[14px] border border-[#E3EAF3] px-3.5 py-3">
            <span className="text-xs font-bold text-[#475569]">Reglas aplicadas</span>
            {!informe && <span className="text-[12.5px] text-[#64748B]">Aparecerán al terminar el diagnóstico.</span>}
            {informe?.resultado.cambios.map((c) => (
              <div
                key={c.regla}
                className="flex justify-between gap-2.5 text-[12.5px] leading-snug transition-opacity"
                style={{ opacity: fase === 4 ? 1 : 0.35 }}
              >
                <span className="text-[#0F172A]">{c.descripcion}</span>
                <span className="font-mono font-semibold text-[#16A34A]">{miles(c.afectadas)}</span>
              </div>
            ))}
            {fase === 4 && (
              <button
                onClick={descargar}
                className="mt-1 self-start rounded-[9px] border border-[#2563EB] bg-[#EFF6FF] px-3 py-2 text-[12.5px] font-bold text-[#1E3A5F]"
              >
                ↓ Descargar muestra limpia (sin columnas personales ni horas exactas)
              </button>
            )}
          </div>
        </div>
        {informe && (
          <span className="font-mono text-[11.5px] text-[#475569]">
            Fuente: MEData, Alcaldía de Medellín, archivo leído en vivo el {fechaColombia(new Date().toISOString())} ·{" "}
            {decimal(informe.bytesLeidos / 1048576)} MB analizados
            {informe.esMuestra ? " (inicio y final del archivo)" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import type { RutaPulso } from "../tipos";
import { BANDAS } from "./constantes";
import { distanciaLegible, duracionLegible, milesLegible, pm25Legible } from "./formato";

/** Una alternativa de ruta en el panel oscuro. Es un botón: elegirla la resalta en el mapa. */
export default function TarjetaRuta({ ruta, elegida, onElegir }: { ruta: RutaPulso; elegida: boolean; onElegir: () => void }) {
  const banda = BANDAS[ruta.banda];
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={elegida}
      className={`w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA] motion-reduce:transition-none ${
        elegida ? "border-[#60A5FA] bg-[#2563EB]/20" : "border-tinta/10 bg-tinta/[0.04] hover:bg-tinta/[0.08]"
      }`}
    >
      <span className="flex items-start gap-2">
        <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ruta.color }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 break-words text-[13.5px] font-bold leading-snug text-tinta">{ruta.etiqueta}</span>
            {ruta.recomendada && (
              <span className="rounded-full bg-[#34D399]/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#6EE7B7]">Recomendada</span>
            )}
          </span>
          <span className="mt-1 block font-mono text-[12px] text-tinta/70">
            {duracionLegible(ruta.duracionS)} · {distanciaLegible(ruta.distanciaM)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-[18px] font-bold leading-none text-tinta">{ruta.puntaje}</span>
          <span className="block text-[10px] text-tinta/55">de 100</span>
        </span>
      </span>

      <span className="mt-2.5 grid grid-cols-2 gap-2">
        <span className="rounded-xl bg-tinta/[0.05] px-2.5 py-2">
          <span className="block text-[10.5px] text-tinta/60">PM2.5 estimado</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[14px] font-semibold text-tinta">
              {pm25Legible(ruta.pm25Estimado)}
              {ruta.pm25Estimado !== null && <span className="text-[11px] font-normal text-tinta/60"> µg/m³</span>}
            </span>
            <span className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: `${banda.color}26`, color: banda.color }}>
              {banda.texto}
            </span>
          </span>
        </span>
        <span className="rounded-xl bg-tinta/[0.05] px-2.5 py-2">
          <span className="block text-[10.5px] text-tinta/60">Incidentes históricos cerca</span>
          <span className="mt-0.5 block font-mono text-[14px] font-semibold text-tinta">
            {ruta.incidentesCercanos === null ? "—" : milesLegible(ruta.incidentesCercanos)}
          </span>
        </span>
      </span>

      <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-tinta/10" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, ruta.puntaje)}%`, background: ruta.color }} />
      </span>
    </button>
  );
}

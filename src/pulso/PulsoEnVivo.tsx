"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { emitir, escuchar } from "./bus";
import MapaPulso from "./mapa/MapaPulso";
import PanelRutas from "./rutas/PanelRutas";
import PulsoBot from "./bot/PulsoBot";

function Reloj() {
  const [hora, setHora] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setHora(new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date()));
    f();
    const t = setInterval(f, 30_000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono tabular-nums">{hora ?? "--:--"}</span>;
}

const pill = "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors";

/**
 * PULSO · Medellín en vivo: el mapa 3D ocupa toda la pantalla; encima flotan la barra, el panel de rutas y PulsoBot.
 * Los tres se coordinan por el bus (bus.ts), no por props.
 */
export default function PulsoEnVivo() {
  const [panel, setPanel] = useState<"rutas" | "bot" | null>(null);
  useEffect(() => escuchar((e) => e.tipo === "panel" && setPanel(e.panel)), []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0B1220] text-white">
      <MapaPulso className="absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0B1220]/80 px-3 py-2 backdrop-blur">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#34D399]" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-[0.14em]">PULSO</span>
            <span className="block text-[11px] text-white/65">Medellín en vivo · <Reloj /></span>
          </span>
        </div>
        <nav className="pointer-events-auto ml-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#0B1220]/80 p-1 backdrop-blur [scrollbar-width:none]" aria-label="Secciones">
          <button type="button" onClick={() => emitir({ tipo: "panel", panel: panel === "rutas" ? null : "rutas" })} className={`${pill} ${panel === "rutas" ? "bg-[#2563EB] text-white" : "text-white/80 hover:bg-white/10"}`}>
            Rutas
          </button>
          <button type="button" onClick={() => emitir({ tipo: "panel", panel: panel === "bot" ? null : "bot" })} className={`${pill} ${panel === "bot" ? "bg-[#2563EB] text-white" : "text-white/80 hover:bg-white/10"}`}>
            Pregúntale a PULSO
          </button>
          <Link href="/alpujarra" className={`${pill} shrink-0 text-white/80 hover:bg-white/10`}>
            Calidad de datos
          </Link>
          <Link href="/panel" className={`${pill} shrink-0 text-white/80 hover:bg-white/10`}>
            Panel
          </Link>
        </nav>
      </header>

      {panel === "rutas" && (
        <aside
          className="absolute inset-x-0 bottom-0 z-30 max-h-[75dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0B1220]/95 backdrop-blur sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-24 sm:max-h-none sm:w-[400px] sm:rounded-3xl"
          aria-label="Rutas inteligentes"
        >
          <PanelRutas onCerrar={() => emitir({ tipo: "panel", panel: null })} />
        </aside>
      )}

      <PulsoBot />

      <p className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 hidden -translate-x-1/2 text-center text-[10.5px] text-white/45 sm:block">
        SINAPSIS · Hackathon de Datos ITM 2026 · Propuesta académica, no es un sitio oficial de la Alcaldía de Medellín.
      </p>
    </div>
  );
}

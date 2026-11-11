"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { emitir, escuchar } from "./bus";
import MapaPulso from "./mapa/MapaPulso";
import PanelRutas from "./rutas/PanelRutas";
import PulsoBot from "./bot/PulsoBot";
import { ContextoTema, guardarTema, useTemaGuardado } from "./tema";

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

const pill = "shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold transition-colors sm:px-3";

/**
 * PULSO · Medellín en vivo: el mapa 3D ocupa toda la pantalla; encima flotan la barra, el panel de rutas y PulsoBot.
 * Los tres se coordinan por el bus (bus.ts), no por props.
 */
export default function PulsoEnVivo() {
  const [panel, setPanel] = useState<"rutas" | "bot" | null>(null);
  const tema = useTemaGuardado();
  const alternarTema = () => guardarTema(tema === "oscuro" ? "claro" : "oscuro");
  const router = useRouter();
  // PulsoBot también maneja la plataforma: paneles, tema y navegación llegan por el bus.
  useEffect(
    () =>
      escuchar((e) => {
        if (e.tipo === "panel") setPanel(e.panel);
        else if (e.tipo === "tema") guardarTema(e.tema);
        else if (e.tipo === "navegar") router.push(e.ruta);
      }),
    [router],
  );

  return (
    <ContextoTema.Provider value={tema}>
    <div data-tema={tema} className="fixed inset-0 overflow-hidden bg-fondo text-tinta">
      <MapaPulso className="absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex shrink-0 items-center gap-2.5 rounded-2xl border border-tinta/10 bg-fondo/80 px-3 py-2 backdrop-blur">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#34D399]" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-[0.1em]">
              PULSO <span className="font-semibold tracking-[0.06em] text-tinta/75">Medellín</span>
            </span>
            <span className="hidden text-[12px] text-tinta/65 sm:block">en vivo · <Reloj /></span>
          </span>
        </div>
        <nav className="pointer-events-auto ml-auto flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-tinta/10 bg-fondo/80 p-1 backdrop-blur [scrollbar-width:none]" aria-label="Secciones">
          <button type="button" onClick={() => emitir({ tipo: "panel", panel: panel === "rutas" ? null : "rutas" })} className={`${pill} ${panel === "rutas" ? "bg-[#2563EB] text-tinta" : "text-tinta/80 hover:bg-tinta/10"}`}>
            Rutas
          </button>
          <button type="button" onClick={() => emitir({ tipo: "panel", panel: panel === "bot" ? null : "bot" })} className={`${pill} ${panel === "bot" ? "bg-[#2563EB] text-tinta" : "text-tinta/80 hover:bg-tinta/10"}`}>
PulsoBot
          </button>
          <Link href="/alpujarra" className={`${pill} shrink-0 text-tinta/80 hover:bg-tinta/10`}>
            <span className="sm:hidden">Agencia</span>
            <span className="hidden sm:inline">Agencia de datos</span>
          </Link>
          <button
            type="button"
            onClick={alternarTema}
            aria-pressed={tema === "claro"}
            aria-label={tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={tema === "oscuro" ? "Tema claro" : "Tema oscuro"}
            className="grid h-8 w-7 shrink-0 place-items-center rounded-full text-tinta/80 transition-colors hover:bg-tinta/10 sm:w-8"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {tema === "oscuro" ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              ) : (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              )}
            </svg>
          </button>
        </nav>
      </header>

      {panel === "rutas" && (
        <aside
          className="absolute inset-x-0 bottom-0 z-30 max-h-[75dvh] overflow-y-auto rounded-t-3xl border border-tinta/10 bg-fondo/95 backdrop-blur sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-24 sm:max-h-none sm:w-[400px] sm:rounded-3xl"
          aria-label="Rutas inteligentes"
        >
          <PanelRutas onCerrar={() => emitir({ tipo: "panel", panel: null })} />
        </aside>
      )}

      <PulsoBot />

      <p className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 hidden -translate-x-1/2 text-center text-[11.5px] text-tinta/55 sm:block">
        PULSO Medellín · propuesta académica, no es un sitio oficial de la Alcaldía.
      </p>
    </div>
    </ContextoTema.Provider>
  );
}

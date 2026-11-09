import Link from "next/link";
import { ARCHIVOS_MARCA, MARCA } from "@/lib/marca";
import { DESPACHOS } from "@/lib/despachos";
import MarcaOficial from "./MarcaOficial";

/** Isotipo de SINAPSIS: tres neuronas conectadas (diseño original). */
export function Isotipo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0f2a1c" />
      <path d="M10 27 L20 12 L30 25 M10 27 L30 25" stroke="#34d399" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="27" r="4" fill="#fcd116" />
      <circle cx="20" cy="12" r="4" fill="#ffffff" />
      <circle cx="30" cy="25" r="4" fill="#34d399" />
    </svg>
  );
}

export default function Encabezado() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--noche)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label={`${MARCA.nombre}, inicio`}>
          <Isotipo />
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-[0.18em] text-white">{MARCA.nombre}</span>
            <span className="hidden text-[11px] text-white/60 sm:block">{MARCA.subtitulo}</span>
          </span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Despachos">
          <Link href="/" className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20">
            Mundo 3D
          </Link>
          <Link href="/panel" className="rounded-full px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
            Panel
          </Link>
          {DESPACHOS.filter((d) => d.listo).map((d) => (
            <Link
              key={d.id}
              href={d.ruta}
              className="rounded-full px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {d.corto}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center">
          <MarcaOficial src={ARCHIVOS_MARCA.logoAlcaldia} alt="Alcaldía de Medellín" etiqueta="Logo Alcaldía" />
        </div>
      </div>
      {/* móvil y tablet: la misma navegación en una fila desplazable (la de arriba solo aparece desde lg) */}
      <nav className="lg:hidden" aria-label="Despachos (móvil)">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]">
          <Link href="/" className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white">
            Mundo 3D
          </Link>
          <Link href="/panel" className="shrink-0 rounded-full px-3 py-1.5 text-[13px] text-white/75 hover:bg-white/10">
            Panel
          </Link>
          {DESPACHOS.filter((d) => d.listo).map((d) => (
            <Link key={d.id} href={d.ruta} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] text-white/75 hover:bg-white/10">
              {d.corto}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

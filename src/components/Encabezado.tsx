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
          {DESPACHOS.map((d) => (
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
    </header>
  );
}

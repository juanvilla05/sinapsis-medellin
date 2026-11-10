import Link from "next/link";
import { ARCHIVOS_MARCA } from "@/lib/marca";
import { DESPACHOS } from "@/lib/despachos";
import MarcaOficial from "./MarcaOficial";

export default function Encabezado() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--noche)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="PULSO, ir a la ciudad en vivo">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#34D399]" />
          </span>
          <span className="leading-tight">
            <span className="block text-[17px] font-extrabold tracking-[0.14em] text-white">PULSO</span>
            <span className="hidden text-[11px] text-white/60 sm:block">Agencia de datos · panel ejecutivo</span>
          </span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Despachos">
          <Link href="/" className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20">
            Ciudad en vivo
          </Link>
          <Link href="/alpujarra" className="rounded-full px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
            Agencia
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
            Ciudad en vivo
          </Link>
          <Link href="/alpujarra" className="shrink-0 rounded-full px-3 py-1.5 text-[13px] text-white/75 hover:bg-white/10">
            Agencia
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

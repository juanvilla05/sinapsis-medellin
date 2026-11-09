import Encabezado from "@/components/Encabezado";
import { MARCA } from "@/lib/marca";

/** Panel ejecutivo: las mismas herramientas en 2D, sin el mundo 3D. */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel-oscuro flex min-h-screen flex-col">
      <Encabezado />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/50">
        <p>
          {MARCA.nombre} · {MARCA.evento} · {MARCA.institucion} · {MARCA.equipo.join(" y ")}
        </p>
        <p className="mt-1">{MARCA.aviso}</p>
        <p className="mt-1">
          Datos:{" "}
          <a className="underline hover:text-white" href="https://medata.app.medellin.gov.co/" target="_blank" rel="noreferrer">
            MEData, Alcaldía de Medellín
          </a>
        </p>
      </footer>
    </div>
  );
}

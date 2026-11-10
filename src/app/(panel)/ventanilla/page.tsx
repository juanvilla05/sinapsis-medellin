import type { Metadata } from "next";
import PanelVentanilla from "@/mundo/paneles/PanelVentanilla";
import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado } from "@/lib/catalogo";
import { construirPropuestas, resumirVentanilla } from "@/lib/ventanilla";

export const metadata: Metadata = { title: "Ventanilla de Apertura" };

/** Versión 2D (panel ejecutivo) de la Ventanilla de Apertura. */
export default function PaginaVentanilla() {
  const conjuntos = catalogo as ConjuntoAuditado[];
  const propuestas = construirPropuestas(conjuntos);
  const inicial = { generado: resumen.generado, resumen: resumirVentanilla(conjuntos, propuestas), propuestas };
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#C4B5FD]">Despacho 03 · Ventanilla de Apertura</p>
      <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">¿Qué hay que mejorar en cada conjunto?</h1>
      <p className="mt-3 max-w-3xl text-white/70">
        La Ventanilla revisa cada conjunto del catálogo de MEData y, por cada problema que encuentra, propone una acción concreta para la secretaría que lo publica: actualizarlo,
        declarar cada cuánto se actualiza, publicar los datos detrás de un tablero, documentar sus columnas o ampliar su descripción.
      </p>
      {/* tarjeta blanca explícita: la clase global .tarjeta (sin capa) pisaría el bg-white de Tailwind */}
      <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-[#E3EAF3] bg-white text-[#0F172A] shadow-[0_20px_60px_rgba(0,0,0,.35)]">
        <PanelVentanilla inicial={inicial} modo="pagina" />
      </div>
    </section>
  );
}

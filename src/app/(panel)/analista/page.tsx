import type { Metadata } from "next";
import PanelAnalista from "@/mundo/paneles/PanelAnalista";

export const metadata: Metadata = { title: "Analista IA" };

/** Versión 2D (panel ejecutivo) del Analista IA. */
export default function PaginaAnalista() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Analista IA</h1>
      <p className="mt-1 text-sm text-white/60">Pregunta en español; cada respuesta cita el conjunto, el campo y la fecha de corte. Funciona con o sin clave de IA.</p>
      <div className="tarjeta mt-6 overflow-hidden bg-white text-[#0F172A]">
        <PanelAnalista modo="pagina" />
      </div>
    </section>
  );
}

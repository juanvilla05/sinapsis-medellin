import type { Metadata } from "next";
import { Suspense } from "react";
import PanelAnalista from "@/mundo/paneles/PanelAnalista";

export const metadata: Metadata = { title: "Analista IA" };

/** Versión 2D (panel ejecutivo) del Analista IA. */
export default function PaginaAnalista() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Analista IA</h1>
      <p className="mt-1 text-sm text-white/60">Pregunta en español; cada respuesta cita el conjunto, el campo y la fecha de corte. Funciona con o sin clave de IA.</p>
      {/* tarjeta blanca explícita: la clase global .tarjeta (sin capa) pisaría el bg-white de Tailwind */}
      <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-[#E3EAF3] bg-white text-[#0F172A] shadow-[0_20px_60px_rgba(0,0,0,.35)]">
        <Suspense fallback={<p className="p-6 text-sm text-[#475569]">Cargando el Analista…</p>}>
          <PanelAnalista modo="pagina" />
        </Suspense>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import PanelMonitoreo from "@/mundo/paneles/PanelMonitoreo";
import { construirDatosMundo } from "@/mundo/datos";
import resumen from "@/data/resumen-catalogo.json";
import type { ResumenCatalogo } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Sala de Monitoreo" };

/** Versión 2D (panel ejecutivo) de la Sala de Monitoreo. */
export default function PaginaMonitoreo() {
  const datos = construirDatosMundo(resumen as ResumenCatalogo);
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Sala de Monitoreo</h1>
      <p className="mt-1 text-sm text-white/60">PULSO · la ciudad en vivo: aire, seguridad vial y hurto por comuna, con datos reales y su fecha de corte.</p>
      <div className="tarjeta mt-6 overflow-hidden bg-white text-[#0F172A]">
        <PanelMonitoreo datos={datos} modo="pagina" />
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import PanelMonitoreo from "@/mundo/paneles/PanelMonitoreo";
import { construirDatosMundo } from "@/mundo/datos";
import resumen from "@/data/resumen-catalogo.json";
import type { ResumenCatalogo } from "@/lib/catalogo";
import { cargarSeguridadVial } from "@/lib/monitoreo/cargar";

export const metadata: Metadata = { title: "Sala de Monitoreo" };

/** Versión 2D (panel ejecutivo) de la Sala de Monitoreo. */
export default async function PaginaMonitoreo() {
  // serie de muertes viales por año (MEData + Policía) desde "use cache": la página sigue prerenderizada
  const seguridad = await cargarSeguridadVial();
  const datos = construirDatosMundo(resumen as ResumenCatalogo, { seguridad });
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Sala de Monitoreo</h1>
      <p className="mt-1 text-sm text-white/60">PULSO · la ciudad en vivo: aire, seguridad vial y hurto por comuna, con datos reales y su fecha de corte.</p>
      {/* tarjeta blanca explícita: la clase global .tarjeta (sin capa) pisaría el bg-white de Tailwind */}
      <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-[#E3EAF3] bg-white text-[#0F172A] shadow-[0_20px_60px_rgba(0,0,0,.35)]">
        <PanelMonitoreo datos={datos} modo="pagina" />
      </div>
    </section>
  );
}

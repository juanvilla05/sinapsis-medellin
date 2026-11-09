import type { Metadata } from "next";
import RelojFrescura from "@/components/RelojFrescura";
import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import { aFila } from "@/lib/frescura";
import type { ConjuntoAuditado, ResumenCatalogo } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Reloj de Frescura" };

export default function PaginaFrescura() {
  const filas = (catalogo as ConjuntoAuditado[]).map(aFila);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--atrasado)]">Despacho · Reloj de Frescura</p>
      <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">¿Qué tan al día están los datos de la ciudad?</h1>
      <p className="mt-3 max-w-3xl text-white/70">
        Cada conjunto de MEData declara cada cuánto se actualiza. El Reloj compara esa promesa con la última fecha de modificación
        que publica el portal. Un conjunto está <strong className="text-[var(--al-dia)]">al día</strong> si no ha pasado más de 1,5
        veces su plazo, <strong className="text-[var(--atrasado)]">atrasado</strong> hasta 3 veces y{" "}
        <strong className="text-[var(--critico)]">crítico</strong> por encima de eso.
      </p>
      <RelojFrescura filasIniciales={filas} resumenInicial={resumen as ResumenCatalogo} />
    </div>
  );
}

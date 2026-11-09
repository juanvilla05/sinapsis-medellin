import type { Metadata } from "next";
import Laboratorio from "@/components/Laboratorio";
import catalogo from "@/data/catalogo.json";
import type { ConjuntoAuditado } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Laboratorio de Limpieza" };

const DESTACADOS = ["1-023-25-000360", "1-023-25-000094", "1-027-23-000008", "1-027-23-000011", "1-027-23-000308"];

export default function PaginaLaboratorio() {
  const opciones = (catalogo as ConjuntoAuditado[])
    .filter((c) => c.csvUrl)
    .map((c) => ({ id: c.id, titulo: c.titulo, publicador: c.publicador, tema: c.temas[0] ?? "" }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#3dd6c6]">Despacho · Laboratorio de Limpieza</p>
      <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">Limpieza de datos en vivo</h1>
      <p className="mt-3 max-w-3xl text-white/70">
        Elige un conjunto de MEData. El agente descarga en este momento el inicio y el final del archivo real, detecta la
        codificación, perfila cada columna, aplica las reglas de limpieza y te muestra el antes y el después, celda por celda.
      </p>
      <Laboratorio opciones={opciones} destacados={DESTACADOS} />
    </div>
  );
}

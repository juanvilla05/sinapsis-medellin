import ExperienciaMundo from "@/mundo/ExperienciaMundo";
import { construirDatosMundo } from "@/mundo/datos";
import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado, ResumenCatalogo } from "@/lib/catalogo";

/** Conjuntos destacados de la misión del Laboratorio (seguridad vial). */
const DESTACADOS = ["1-023-25-000360", "1-023-25-000094"];

export default function Mundo() {
  const opcionesLab = DESTACADOS.map((id) => (catalogo as ConjuntoAuditado[]).find((c) => c.id === id))
    .filter((c): c is ConjuntoAuditado => !!c)
    .map((c) => ({ id: c.id, titulo: c.titulo, publicador: c.publicador, periodicidad: c.periodicidad }));
  const datos = construirDatosMundo(resumen as ResumenCatalogo);
  return <ExperienciaMundo resumen={resumen as ResumenCatalogo} opcionesLab={opcionesLab} datos={datos} />;
}

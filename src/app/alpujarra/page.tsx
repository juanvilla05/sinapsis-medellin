import type { Metadata } from "next";
import ExperienciaMundo from "@/mundo/ExperienciaMundo";
import { construirDatosMundo } from "@/mundo/datos";
import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado, ResumenCatalogo } from "@/lib/catalogo";
import { cargarSeguridadVial } from "@/lib/monitoreo/cargar";

export const metadata: Metadata = { title: "La Alpujarra 3D · Calidad de los datos" };

/** Conjuntos destacados de la misión del Laboratorio (seguridad vial). */
const DESTACADOS = ["1-023-25-000360", "1-023-25-000094"];

export default async function Mundo() {
  const opcionesLab = DESTACADOS.map((id) => (catalogo as ConjuntoAuditado[]).find((c) => c.id === id))
    .filter((c): c is ConjuntoAuditado => !!c)
    .map((c) => ({ id: c.id, titulo: c.titulo, publicador: c.publicador, periodicidad: c.periodicidad }));
  // serie de muertes viales por año (MEData + Policía); viene de "use cache", así que la página sigue prerenderizada
  const seguridad = await cargarSeguridadVial();
  const datos = construirDatosMundo(resumen as ResumenCatalogo, { seguridad });
  return <ExperienciaMundo resumen={resumen as ResumenCatalogo} opcionesLab={opcionesLab} datos={datos} />;
}

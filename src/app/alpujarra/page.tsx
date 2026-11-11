import type { Metadata } from "next";
import AgenciaDatos from "@/agencia/AgenciaDatos";
import type { FilaReloj } from "@/agencia/Despachos";
import { construirDatosMundo } from "@/mundo/datos";
import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado, ResumenCatalogo } from "@/lib/catalogo";
import { cargarSeguridadVial } from "@/lib/monitoreo/cargar";
import { construirPropuestas } from "@/lib/ventanilla";
import { construirVisuales } from "@/lib/visuales";

export const metadata: Metadata = { title: "Agencia de datos · La oficina detrás del mapa" };

/** Conjuntos destacados de la misión del Laboratorio (seguridad vial). */
const DESTACADOS = ["1-023-25-000360", "1-023-25-000094"];

export default async function Agencia() {
  const opcionesLab = DESTACADOS.map((id) => (catalogo as ConjuntoAuditado[]).find((c) => c.id === id))
    .filter((c): c is ConjuntoAuditado => !!c)
    .map((c) => ({ id: c.id, titulo: c.titulo, publicador: c.publicador, periodicidad: c.periodicidad }));
  // serie de muertes viales por año (MEData + Policía); viene de "use cache", así que la página sigue prerenderizada
  const seguridad = await cargarSeguridadVial();
  const propuestas = construirPropuestas(catalogo as ConjuntoAuditado[]).length;
  const datos = construirDatosMundo(resumen as ResumenCatalogo, { seguridad, propuestas });
  // conjuntos con su atraso para el Reloj (ranking) y la Ventanilla (días sin actualizar)
  const frescura: FilaReloj[] = (catalogo as ConjuntoAuditado[]).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    publicador: c.publicador,
    periodicidad: c.periodicidad,
    modificado: c.modificado,
    dias: c.diasSinActualizar,
    veces: c.vecesAtraso,
    estado: c.estado,
  }));
  return <AgenciaDatos resumen={resumen as ResumenCatalogo} opcionesLab={opcionesLab} datos={datos} visuales={construirVisuales(catalogo as ConjuntoAuditado[])} frescura={frescura} />;
}

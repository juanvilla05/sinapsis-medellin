import type { DatosMundo } from "../../datos";
import EnPreparacion from "./EnPreparacion";

/** Comunas: hurto a persona e incidentes viales por comuna, con filtros. La llena otra rama; aquí solo el espacio. */
export default function PestanaComunas({ datos }: { datos: DatosMundo }) {
  void datos;
  return (
    <EnPreparacion
      titulo="Comunas de Medellín"
      detalle="Conteos agregados por comuna y año a partir de los conjuntos de MEData (hurto a persona, incidentes viales), con supresión de conteos menores a 5."
      bloques={["Tabla por comuna", "Barras por año", "Mapa por comunas"]}
    />
  );
}

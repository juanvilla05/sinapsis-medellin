import type { DatosMundo } from "../../datos";
import EnPreparacion from "./EnPreparacion";

/** Brecha: muertes viales por año, MEData vs Policía Nacional. La llena otra rama; aquí solo el espacio. */
export default function PestanaBrecha({ datos }: { datos: DatosMundo }) {
  void datos;
  return (
    <EnPreparacion
      titulo="Brecha: muertes en incidentes viales por año"
      detalle="Comparación entre lo que publica MEData (Secretaría de Movilidad) y lo que registra la Policía Nacional en datos.gov.co para Medellín."
      bloques={["Serie MEData", "Serie Policía Nacional", "Diferencia por año"]}
    />
  );
}

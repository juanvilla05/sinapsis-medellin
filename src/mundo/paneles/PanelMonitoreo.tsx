"use client";

import { areaPorId } from "../areas";
import type { DatosMundo } from "../datos";
import PanelEnConstruccion from "./PanelEnConstruccion";

export type ModoPanel = "modal" | "pagina";

/**
 * Sala de Monitoreo · "PULSO · la ciudad en vivo".
 * Stub de cableado: la implementación llega en los PR de SIATA (aire) y de la Medellín 3D de datos.
 */
export default function PanelMonitoreo({ datos, modo = "modal" }: { datos: DatosMundo; modo?: ModoPanel }) {
  void datos;
  void modo;
  const area = areaPorId("monitoreo");
  return area ? <PanelEnConstruccion area={area} /> : null;
}

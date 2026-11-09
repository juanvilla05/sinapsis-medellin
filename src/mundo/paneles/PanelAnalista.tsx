"use client";

import { areaPorId } from "../areas";
import PanelEnConstruccion from "./PanelEnConstruccion";

export type ModoPanel = "modal" | "pagina";

/**
 * Analista IA: herramientas deterministas sobre datos reales + chat con Gemini si hay clave.
 * Stub de cableado: la implementación llega en el PR del Analista.
 */
export default function PanelAnalista({ modo = "modal" }: { modo?: ModoPanel }) {
  void modo;
  const area = areaPorId("analista");
  return area ? <PanelEnConstruccion area={area} /> : null;
}

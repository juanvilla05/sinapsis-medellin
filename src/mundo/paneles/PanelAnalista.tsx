"use client";

import { areaPorId } from "../areas";
import PanelEnConstruccion from "./PanelEnConstruccion";

export type ModoPanel = "modal" | "pagina";

export interface PropsPanelAnalista {
  modo?: ModoPanel;
  /**
   * Contrato con el mundo 3D: llamar una vez por cada respuesta terminada (chat `onFinish` y cada
   * EntradaDirecta que pasa a `listo`). ExperienciaMundo cuenta las preguntas del Analista con esto.
   */
  onRespuesta?: () => void;
}

/**
 * Analista IA: herramientas deterministas sobre datos reales + chat con Gemini si hay clave.
 * Stub de cableado: la implementación llega en el PR del Analista (debe conservar `onRespuesta`).
 */
export default function PanelAnalista({ modo = "modal", onRespuesta }: PropsPanelAnalista) {
  void modo;
  void onRespuesta;
  const area = areaPorId("analista");
  return area ? <PanelEnConstruccion area={area} /> : null;
}

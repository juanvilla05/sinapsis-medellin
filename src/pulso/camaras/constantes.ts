import type { FuenteCamara, TipoCamara } from "../tipos";

/** Textos y enlaces de las cámaras. Sin dependencias: lo usan el servidor y la interfaz. */
export const ROTULO_TIPO: Record<TipoCamara, string> = { via: "Vía", agua: "Río y quebradas", panoramica: "Ciudad y cielo" };
export const ROTULO_FUENTE: Record<FuenteCamara, string> = { simm: "Secretaría de Movilidad · SIMM", siata: "SIATA" };
/** Página pública donde cada entidad muestra sus cámaras. */
export const URL_FUENTE: Record<FuenteCamara, string> = {
  simm: "https://www.medellin.gov.co/simm/camaras-de-circuito-cerrado",
  siata: "https://siata.gov.co/siata_nuevo/",
};

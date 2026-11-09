"use client";

import { useId, useState } from "react";
import type { DatosMundo } from "../datos";
import PestanaAire from "./monitoreo/PestanaAire";
import PestanaBrecha from "./monitoreo/PestanaBrecha";
import PestanaComunas from "./monitoreo/PestanaComunas";

export type ModoPanel = "modal" | "pagina";

type Pestana = "aire" | "brecha" | "comunas";

const PESTANAS: { clave: Pestana; texto: string; detalle: string }[] = [
  { clave: "aire", texto: "Aire", detalle: "PM2.5 por estación de SIATA" },
  { clave: "brecha", texto: "Brecha", detalle: "Muertes viales: MEData vs Policía" },
  { clave: "comunas", texto: "Comunas", detalle: "Hurto e incidentes por comuna" },
];

/**
 * Sala de Monitoreo · "PULSO · la ciudad en vivo".
 * Pestañas Aire (SIATA, esta rama) · Brecha · Comunas (otras ramas reemplazan sus archivos en ./monitoreo/).
 * Asume fondo blanco; `modo` ajusta solo el relleno (la página 2D ya lo envuelve en tarjeta).
 */
export default function PanelMonitoreo({ datos, modo = "modal" }: { datos: DatosMundo; modo?: ModoPanel }) {
  const [pestana, setPestana] = useState<Pestana>("aire");
  const id = useId();

  return (
    <div className={`flex flex-col gap-5 ${modo === "pagina" ? "p-5 sm:p-7" : "p-6"}`}>
      <div className="grid grid-cols-3 gap-1.5 border-b border-[#E3EAF3] pb-3 sm:flex sm:flex-wrap" role="tablist" aria-label="Secciones de la Sala de Monitoreo">
        {PESTANAS.map((p) => {
          const activa = p.clave === pestana;
          return (
            <button
              key={p.clave}
              type="button"
              role="tab"
              id={`${id}-tab-${p.clave}`}
              aria-selected={activa}
              aria-controls={`${id}-panel-${p.clave}`}
              onClick={() => setPestana(p.clave)}
              className={`flex flex-col items-center rounded-xl px-2 py-2 text-center transition-colors sm:items-start sm:px-3.5 sm:text-left ${
                activa ? "bg-[#1E3A5F] text-white" : "bg-[#F4F7FB] text-[#1E3A5F] hover:bg-[#E3EAF3]"
              }`}
            >
              <span className="text-[13.5px] font-bold">{p.texto}</span>
              <span className={`hidden text-[11px] sm:block ${activa ? "text-white/75" : "text-[#475569]"}`}>{p.detalle}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel-${pestana}`} aria-labelledby={`${id}-tab-${pestana}`}>
        {pestana === "aire" && <PestanaAire />}
        {pestana === "brecha" && <PestanaBrecha datos={datos} />}
        {pestana === "comunas" && <PestanaComunas datos={datos} />}
      </div>
    </div>
  );
}

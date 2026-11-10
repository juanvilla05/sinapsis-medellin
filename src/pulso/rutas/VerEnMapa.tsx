"use client";

import { emitir } from "../bus";
import type { PuntoNombrado, RutaPulso } from "../tipos";

/** Botón de la tarjeta del Analista: manda las rutas al mapa de PULSO (y al panel de rutas) por el bus. */
export default function VerEnMapa({ rutas, origen, destino }: { rutas: RutaPulso[]; origen: PuntoNombrado; destino: PuntoNombrado }) {
  const elegida = rutas.find((r) => r.recomendada)?.id ?? rutas[0]?.id;
  return (
    <button
      type="button"
      onClick={() => emitir({ tipo: "rutas", rutas, origen, destino, elegida })}
      className="self-start rounded-xl bg-[#1E3A5F] px-3.5 py-2 text-[13px] font-semibold text-tinta hover:bg-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
    >
      Ver en el mapa
    </button>
  );
}

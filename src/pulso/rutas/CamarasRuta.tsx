"use client";

import { useState } from "react";
import { emitir } from "../bus";
import { FotoCamara, useMinuto } from "../camaras/FotoCamara";
import type { CamaraEnRuta } from "../tipos";

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA]";

/**
 * "Así está ahora": las cámaras de vía que quedan sobre la ruta elegida, en el orden del recorrido.
 * Es evidencia visual del momento; no cambia el puntaje ni interpreta la imagen.
 */
export default function CamarasRuta({ camaras }: { camaras: CamaraEnRuta[] }) {
  const minuto = useMinuto();
  const [indice, setIndice] = useState(0);
  const actual = camaras[Math.min(indice, camaras.length - 1)];
  if (!actual) return null;

  const verEnMapa = () => {
    emitir({ tipo: "camara", id: actual.id });
    // en celular y tablet el panel tapa la tarjeta de la cámara: se cierra para que se vea
    if (window.matchMedia("(max-width: 1023px)").matches) emitir({ tipo: "panel", panel: null });
  };

  return (
    <div className="mt-1.5 rounded-2xl border border-tinta/10 bg-tinta/[0.04] p-2.5">
      <p className="m-0 text-[12px] font-semibold text-tinta/80">
        Así está ahora · {camaras.length === 1 ? "1 cámara de vía" : `${camaras.length} cámaras de vía`} en el trayecto
      </p>

      <FotoCamara foto={actual.foto} minuto={minuto} alt={`Última foto de la cámara ${actual.nombre}`} className="mt-2 rounded-xl" />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="m-0 min-w-0 truncate text-[12.5px] font-semibold text-tinta">{actual.nombre}</p>
        <button type="button" onClick={verEnMapa} className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-[#93C5FD] hover:bg-tinta/10 ${foco}`}>
          Ver en el mapa
        </button>
      </div>

      {camaras.length > 1 && (
        <ul className="m-0 mt-1.5 grid list-none grid-cols-3 gap-1.5 p-0">
          {camaras.map((c, k) => (
            <li key={c.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setIndice(k)}
                aria-pressed={k === indice}
                aria-label={`Ver la cámara ${c.nombre}`}
                className={`block w-full overflow-hidden rounded-lg border text-left ${foco} ${k === indice ? "border-[#60A5FA]" : "border-tinta/10 opacity-80 hover:opacity-100"}`}
              >
                <FotoCamara foto={c.foto} minuto={minuto} alt="" />
                <span className="block truncate px-1.5 py-1 text-[10.5px] text-tinta/75">{c.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="m-0 mt-1.5 text-[11px] leading-snug text-tinta/55">
        Fotos públicas de la Secretaría de Movilidad y SIATA; se renuevan cada minuto y la hora va impresa. No cambian el puntaje.
      </p>
    </div>
  );
}

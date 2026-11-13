"use client";

import { useState } from "react";
import { FotoCamara, useMinuto } from "../camaras/FotoCamara";
import { ROTULO_FUENTE, ROTULO_TIPO, URL_FUENTE } from "../camaras/constantes";
import type { CamaraPulso } from "../tipos";
import { COLOR_CAMARA } from "./datos";
import { foco, vidrio } from "./PanelesMapa";

/** Detalle de una cámara pública: su última foto, dónde está y de quién es. La foto se renueva sola cada minuto. */
export function TarjetaCamara({ camara, onCerrar }: { camara: CamaraPulso; onCerrar: () => void }) {
  const minuto = useMinuto();
  const [vista, setVista] = useState(0);
  const total = camara.fotos.length;
  const foto = camara.fotos[Math.min(vista, total - 1)]!;
  const mover = (d: number) => setVista((v) => (v + d + total) % total);

  return (
    <section aria-label={`Cámara: ${camara.nombre}`} className={`${vidrio} p-4`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7DD3FC]">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: COLOR_CAMARA[camara.tipo] }} />
            Cámara en vivo · {ROTULO_TIPO[camara.tipo]}
          </p>
          <h3 className="mt-0.5 text-[16px] font-bold leading-snug">{camara.nombre}</h3>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar detalle" className={`-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-tinta/70 hover:bg-tinta/10 ${foco}`}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <FotoCamara
        foto={foto}
        minuto={minuto}
        completa={camara.tipo === "panoramica"}
        alt={`Última foto de la cámara ${camara.nombre}${total > 1 ? `, vista ${vista + 1} de ${total}` : ""}`}
        className="mt-3 rounded-xl"
      />

      {total > 1 && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => mover(-1)} className={`rounded-full bg-tinta/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-tinta/15 ${foco}`}>
            Anterior
          </button>
          <p className="text-[12.5px] text-tinta/70" aria-live="polite">
            Vista {vista + 1} de {total}
          </p>
          <button type="button" onClick={() => mover(1)} className={`rounded-full bg-tinta/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-tinta/15 ${foco}`}>
            Siguiente
          </button>
        </div>
      )}

      <p className="mt-2 text-[12px] leading-snug text-tinta/65">La fecha y la hora van impresas en la foto. Se renueva cada minuto.</p>

      <dl className="mt-2 text-[12.5px]">
        {camara.direccion && (
          <div className="flex items-baseline justify-between gap-3 border-t border-tinta/5 py-1.5">
            <dt className="text-tinta/60">Dirección</dt>
            <dd className="text-right font-medium">{camara.direccion}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-tinta/5 py-1.5">
          <dt className="text-tinta/60">Fuente</dt>
          <dd className="text-right font-medium">{ROTULO_FUENTE[camara.fuente]}</dd>
        </div>
      </dl>

      <p className="mt-1.5 text-[12px] leading-snug text-tinta/65">
        PULSO no guarda la imagen: la pide tu navegador a la fuente.{" "}
        <a href={URL_FUENTE[camara.fuente]} target="_blank" rel="noopener noreferrer" className={`font-semibold text-[#7DD3FC] underline underline-offset-2 ${foco}`}>
          Ver las cámaras en su sitio
        </a>
      </p>
    </section>
  );
}

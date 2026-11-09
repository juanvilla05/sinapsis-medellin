"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureComuna } from "@/lib/monitoreo/fuentes";
import { miles } from "../../areas";
import type { Api3D, Estado3D, InfoRender, InfoTooltip } from "./Comunas3D";
import { PASOS_LEYENDA } from "./escala";

/**
 * Envoltorio React de la Medellín 3D: monta `Comunas3D` con `import()` dinámico al aparecer, le pasa cada cambio
 * de estado (filtros, selección, estaciones) y pinta el tooltip HTML y la leyenda. Si WebGL falla, avisa al padre
 * para volver al SVG. Al desmontar, destruye la escena y libera la GPU.
 */
export default function Comunas3DVista({
  geo,
  estado,
  onSeleccionar,
  onFallo,
}: {
  geo: readonly FeatureComuna[];
  estado: Estado3D;
  onSeleccionar: (codigo: string | null) => void;
  onFallo: (motivo: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const api = useRef<Api3D | null>(null);
  const seleccionarRef = useRef(onSeleccionar);
  const falloRef = useRef(onFallo);
  const estadoRef = useRef(estado);
  const [listo, setListo] = useState(false);
  const [tooltip, setTooltip] = useState<{ info: InfoTooltip; x: number; y: number; ancho: number } | null>(null);
  const [render, setRender] = useState<InfoRender | null>(null);

  useEffect(() => {
    seleccionarRef.current = onSeleccionar;
    falloRef.current = onFallo;
    estadoRef.current = estado;
  });

  useEffect(() => {
    const el = host.current;
    const capaEl = capa.current;
    if (!el || !capaEl) return;
    let vivo = true;
    import("./Comunas3D")
      .then(async ({ montarComunas3D }) => {
        const a = await montarComunas3D({
          host: el,
          capaEtiquetas: capaEl,
          geo,
          alHover: (info, x, y) => {
            if (vivo) setTooltip(info ? { info, x, y, ancho: el.clientWidth } : null);
          },
          alSeleccionar: (codigo) => seleccionarRef.current(codigo),
          alInfo: (i) => {
            if (vivo) setRender(i);
          },
        });
        if (!vivo) {
          a.destruir();
          return;
        }
        api.current = a;
        a.actualizar(estadoRef.current);
        setListo(true);
      })
      .catch((e: unknown) => {
        console.error("[comunas3d] no se pudo montar la escena", e);
        if (vivo) falloRef.current(e instanceof Error ? e.message : "WebGL no disponible");
      });
    return () => {
      vivo = false;
      api.current?.destruir();
      api.current = null;
    };
  }, [geo]);

  useEffect(() => {
    api.current?.actualizar(estado);
  }, [estado]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={host}
        className="relative h-[380px] w-full cursor-grab overflow-hidden rounded-xl border border-[#E3EAF3] bg-[linear-gradient(180deg,#FFFFFF,#EEF3F9)] md:h-[460px]"
        aria-label={`Medellín en 3D: ${estado.comunas.titulo}; cada comuna se eleva según sus ${estado.comunas.unidad}`}
        role="img"
      >
        {!listo && (
          <div className="absolute inset-0 grid place-items-center text-sm text-[#475569]" aria-live="polite">
            Cargando la Medellín 3D de datos…
          </div>
        )}
        <div ref={capa} className="pointer-events-none absolute inset-0" aria-hidden="true" />
        {tooltip && (
          <div
            className="pointer-events-none absolute z-[2] max-w-[260px] rounded-xl border border-[#E3EAF3] bg-white/95 px-3 py-2 shadow-[0_8px_24px_rgba(30,58,95,.18)]"
            style={{ left: Math.max(4, Math.min(tooltip.x + 14, tooltip.ancho - 270)), top: Math.max(8, tooltip.y - 10) }}
            role="tooltip"
          >
            <div className="text-[12px] font-bold text-[#1E3A5F]">{tooltip.info.titulo}</div>
            <div className="font-mono text-[13px] font-semibold text-[#0F172A]">{tooltip.info.valor}</div>
            <div className="text-[11px] text-[#475569]">{tooltip.info.detalle}</div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-[#475569]">
        <div className="flex items-center gap-1.5">
          <span className="font-mono">0</span>
          <span className="flex h-2.5 w-28 overflow-hidden rounded-full" aria-hidden="true">
            {PASOS_LEYENDA.map((p) => (
              <span key={p.t} className="h-full flex-1" style={{ background: p.color }} />
            ))}
          </span>
          <span className="font-mono">{miles(estado.comunas.maximo)}</span>
          <span>{estado.comunas.unidad} por comuna (altura y color)</span>
        </div>
        {estado.celdas && (
          <span>
            Columnas: celdas de 250 m con ≥ 5 {estado.celdas.unidad}, todo el período ({estado.celdas.periodo}); altura ∝ √n
          </span>
        )}
        {estado.estaciones && <span>Faros: estaciones SIATA, color = categoría ICA (gris fuera de Medellín)</span>}
        {render && (
          <span className="font-mono text-[#64748B]">
            {render.llamadas} llamadas de dibujo · {miles(render.triangulos)} triángulos
          </span>
        )}
      </div>
    </div>
  );
}

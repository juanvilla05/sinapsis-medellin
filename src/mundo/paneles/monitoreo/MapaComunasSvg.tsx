"use client";

import { useMemo, type ReactNode } from "react";
import type { FeatureComuna } from "@/lib/monitoreo/fuentes";
import type { ResumenComunas } from "@/lib/monitoreo/metricas";
import { comunaPorCodigo } from "@/lib/territorio";
import { miles } from "../../areas";
import { COLOR_SIN_DATO, colorComuna, PASOS_LEYENDA } from "./escala";
import { bboxDeGeometrias, centroide, crearProyeccion, rutaSvg, type Proyeccion } from "./proyeccion";
import { textoValor } from "./capas";

export interface GeometriaPreparada {
  proyeccion: Proyeccion;
  viewBox: string;
  comunas: { codigo: string; nombre: string; d: string; cx: number; cy: number }[];
}

/** Proyecta una sola vez el GeoJSON (mismas rutas para la coropleta y para extruir en 3D). */
export function prepararGeometria(features: readonly FeatureComuna[]): GeometriaPreparada {
  const proyeccion = crearProyeccion(bboxDeGeometrias(features.map((f) => f.geometry)));
  const margen = 1.5;
  const comunas = features.map((f) => {
    const c = centroide(f.geometry);
    const p = proyeccion.proyectar(c.lng, c.lat);
    return {
      codigo: f.properties.codigo,
      nombre: comunaPorCodigo(f.properties.codigo)?.nombre ?? f.properties.nombre,
      d: rutaSvg(f.geometry, proyeccion),
      cx: p.x,
      cy: -p.y,
    };
  });
  const w = proyeccion.ancho + margen * 2;
  const h = proyeccion.alto + margen * 2;
  return { proyeccion, viewBox: `${(-w / 2).toFixed(2)} ${(-h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`, comunas };
}

/**
 * Coropleta de las 16 comunas y 5 corregimientos. Color secuencial azul por valor (gris = sin dato),
 * `<title>` por comuna con la cifra, leyenda con el máximo real. Plan B 2.5D del mundo 3D y vista por defecto
 * en celular, táctil o movimiento reducido. `children` permite superponer capas (estaciones SIATA).
 */
export default function MapaComunasSvg({
  geometria,
  resumen,
  unidad,
  periodo,
  seleccion,
  onSeleccionar,
  children,
  alto = 420,
}: {
  geometria: GeometriaPreparada;
  resumen: ResumenComunas;
  unidad: string;
  periodo: string;
  seleccion: string | null;
  onSeleccionar: (codigo: string | null) => void;
  children?: ReactNode;
  alto?: number;
}) {
  const porCodigo = useMemo(() => new Map(resumen.porComuna.map((v) => [v.codigo, v])), [resumen]);
  const relacion = geometria.proyeccion.alto / geometria.proyeccion.ancho;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full overflow-hidden rounded-xl border border-[#E3EAF3] bg-[#F8FAFC]" style={{ maxHeight: alto }}>
        <svg
          viewBox={geometria.viewBox}
          role="img"
          aria-label={`Mapa de Medellín por comunas: ${unidad} reportados, ${periodo}`}
          className="block h-auto w-full"
          style={{ aspectRatio: `${1 / relacion}`, maxHeight: alto }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSeleccionar(null);
          }}
        >
          {geometria.comunas.map((c) => {
            const v = porCodigo.get(c.codigo);
            const valor = v?.valor ?? null;
            const activa = seleccion === c.codigo;
            const { texto, marca } = textoValor(v);
            return (
              <path
                key={c.codigo}
                d={c.d}
                fill={colorComuna(valor, resumen.maximo)}
                stroke={activa ? "#2563EB" : "#FFFFFF"}
                strokeWidth={activa ? 0.5 : 0.18}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer transition-[opacity] hover:opacity-85"
                style={{ opacity: seleccion && !activa ? 0.55 : 1 }}
                onClick={() => onSeleccionar(activa ? null : c.codigo)}
                tabIndex={0}
                role="button"
                aria-pressed={activa}
                aria-label={`Comuna ${c.codigo} ${c.nombre}: ${texto}${marca ? " (incluye conteos suprimidos)" : ""} ${unidad}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSeleccionar(activa ? null : c.codigo);
                  }
                }}
              >
                <title>{`Comuna ${c.codigo} · ${c.nombre} · ${texto}${marca ? "†" : ""} ${unidad} · ${periodo}`}</title>
              </path>
            );
          })}
          {geometria.comunas.map((c) => (
            <text
              key={`t-${c.codigo}`}
              x={c.cx}
              y={c.cy}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none select-none"
              style={{ fontSize: 1.6, fontFamily: "var(--font-jetbrains), monospace", fontWeight: 600, fill: (porCodigo.get(c.codigo)?.valor ?? 0) / (resumen.maximo || 1) > 0.55 ? "#FFFFFF" : "#1E3A5F" }}
              aria-hidden="true"
            >
              {c.codigo}
            </text>
          ))}
          {children}
        </svg>
      </div>
      <Leyenda maximo={resumen.maximo} unidad={unidad} />
    </div>
  );
}

export function Leyenda({ maximo, unidad }: { maximo: number; unidad: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-[#475569]">
      <div className="flex items-center gap-1.5">
        <span className="font-mono">0</span>
        <span className="flex h-2.5 w-28 overflow-hidden rounded-full" aria-hidden="true">
          {PASOS_LEYENDA.map((p) => (
            <span key={p.t} className="h-full flex-1" style={{ background: p.color }} />
          ))}
        </span>
        <span className="font-mono">{miles(maximo)}</span>
        <span>{unidad}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR_SIN_DATO }} aria-hidden="true" />
        sin dato publicado
      </div>
    </div>
  );
}

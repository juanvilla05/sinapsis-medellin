"use client";

import type { EstacionSiata } from "@/lib/aire";
import { CATEGORIAS } from "@/lib/ica";
import { decimal } from "../../areas";
import { COLOR_NO_MEDELLIN } from "./escala";
import { horaColombia } from "./formato";
import type { Proyeccion } from "./proyeccion";

/**
 * Puntos de las estaciones de SIATA sobre la misma proyección del mapa de comunas. Las de Medellín llevan el color
 * de su categoría ICA; las de otros municipios van en gris (contexto). Se renderiza como `<g>` dentro del SVG.
 */
export default function MapaEstacionesSvg({ estaciones, proyeccion }: { estaciones: readonly EstacionSiata[]; proyeccion: Proyeccion }) {
  return (
    <g aria-label="Estaciones de calidad del aire de SIATA">
      {estaciones.map((e) => {
        const p = proyeccion.proyectar(e.lng, e.lat);
        const color = e.enMedellin ? CATEGORIAS[e.categoria].color : COLOR_NO_MEDELLIN;
        const lectura = e.pm25 === null ? "sin dato" : `${decimal(e.pm25)} µg/m³ · ${CATEGORIAS[e.categoria].texto}`;
        return (
          <g key={e.codigo} transform={`translate(${p.x.toFixed(2)} ${(-p.y).toFixed(2)})`} className="cursor-help">
            <circle r={1.1} fill={color} fillOpacity={0.25} />
            <circle r={0.55} fill={color} stroke="#FFFFFF" strokeWidth={0.12} />
            <title>{`Estación SIATA #${e.codigo} · ${e.sitio || e.nombre} · ${e.municipio} · PM2.5 ${lectura} · ${horaColombia(e.actualizado)}`}</title>
          </g>
        );
      })}
    </g>
  );
}

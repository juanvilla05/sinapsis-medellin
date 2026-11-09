"use client";

import { COMUNAS_MEDELLIN } from "@/lib/territorio";
import type { ResumenComunas } from "@/lib/monitoreo/metricas";
import { decimal } from "../../areas";
import { textoValor } from "./capas";
import { colorComuna, tintaSobre } from "./escala";

/**
 * Vista base de la pestaña Comunas: tabla ordenada de mayor a menor con barras proporcionales al máximo.
 * Funciona sin geometría. Las celdas con conteos suprimidos (1–4) se muestran como "<5"; las sumas que incluyen
 * alguno llevan † y una nota al pie. El texto describe conteos reportados, nunca califica la comuna.
 */
export default function TablaComunas({
  resumen,
  unidad,
  seleccion,
  onSeleccionar,
}: {
  resumen: ResumenComunas;
  unidad: string;
  seleccion: string | null;
  onSeleccionar: (codigo: string | null) => void;
}) {
  const porCodigo = new Map(resumen.porComuna.map((v) => [v.codigo, v]));
  const filas = COMUNAS_MEDELLIN.map((c) => ({ ...c, v: porCodigo.get(c.codigo) }))
    .sort((a, b) => (b.v?.valor ?? -1) - (a.v?.valor ?? -1));
  const total = resumen.total;
  const hayIncompletas = resumen.porComuna.some((v) => v.incompleto && v.valor !== null && v.valor > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-[#E3EAF3]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#F4F7FB] text-left text-[11px] font-bold tracking-wide text-[#475569]">
                <th scope="col" className="px-3 py-2 font-bold">COMUNA / CORREGIMIENTO</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">{unidad.toUpperCase()}</th>
                <th scope="col" className="px-3 py-2 text-right font-bold">% CIUDAD</th>
                <th scope="col" className="w-[38%] px-3 py-2 font-bold">FRENTE AL MÁXIMO</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => {
                const { texto, marca } = textoValor(c.v);
                const valor = c.v?.valor ?? null;
                const fraccion = valor !== null && resumen.maximo > 0 ? valor / resumen.maximo : 0;
                const activa = seleccion === c.codigo;
                return (
                  <tr
                    key={c.codigo}
                    onClick={() => onSeleccionar(activa ? null : c.codigo)}
                    className={`cursor-pointer border-t border-[#E3EAF3] align-middle transition-colors ${activa ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"}`}
                    aria-selected={activa}
                  >
                    <td className="px-3 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-flex h-6 w-7 flex-none items-center justify-center rounded-md font-mono text-[11px] font-semibold"
                          style={{ background: colorComuna(valor, resumen.maximo), color: tintaSobre(fraccion) }}
                        >
                          {c.codigo}
                        </span>
                        <span className="truncate font-semibold text-[#0F172A]">{c.nombre}</span>
                        {c.tipo === "corregimiento" && <span className="text-[10.5px] text-[#64748B]">corregimiento</span>}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[#0F172A]">
                      {texto}
                      {marca && <sup className="ml-0.5 text-[#64748B]">†</sup>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[#475569]">
                      {valor !== null && total > 0 ? `${decimal((valor / total) * 100)} %` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(fraccion * 100)}%`, background: colorComuna(valor, resumen.maximo) }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filas.every((c) => !c.v) && (
                <tr>
                  <td colSpan={4} className="border-t border-[#E3EAF3] p-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-[#0F172A]">Sin datos para este filtro.</span>
                      <span className="text-[13px] text-[#475569]">Ninguna comuna tiene filas publicadas con esta combinación; prueba con otro año o quita un filtro.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="m-0 text-[11.5px] leading-relaxed text-[#475569]">
        Ordenadas por conteo reportado, de mayor a menor; una comuna con más {unidad} que el promedio solo concentra más registros,
        no se califica. «—» = sin filas publicadas; «&lt;5» = solo conteos suprimidos por privacidad
        {hayIncompletas ? "; † = la suma incluye conteos suprimidos (el valor real es algo mayor)" : ""}.
      </p>
    </div>
  );
}

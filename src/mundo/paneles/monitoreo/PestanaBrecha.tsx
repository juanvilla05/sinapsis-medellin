"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeguridadVialDetalle } from "@/lib/monitoreo/cargar";
import type { DatosMundo } from "../../datos";
import { miles } from "../../areas";
import { construirBrecha, type ResultadoBrecha } from "./brecha";
import Fuente from "./Fuente";
import { fechaCorte, fechaCortaColombia, horaColombia, textoLicencia } from "./formato";

type Estado = "cargando" | "listo" | "error";

const COLOR_MEDATA = "#2563EB";
const COLOR_POLICIA = "#1E3A5F";

/**
 * Brecha: muertes en incidentes viales por año, MEData (Víctimas en incidentes viales) vs Policía Nacional
 * (datos.gov.co). Barras pareadas, tabla y texto generado desde los datos. Si la ruta no responde, usa la serie
 * horneada en la página (`datos.seguridad`); si tampoco existe, lo dice con hora.
 */
export default function PestanaBrecha({ datos }: { datos: DatosMundo }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [detalle, setDetalle] = useState<SeguridadVialDetalle | null>(null);
  const [falloA, setFalloA] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/monitoreo/seguridad", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as SeguridadVialDetalle | { ok: false };
        if (!j.ok) throw new Error("respuesta no ok");
        if (vivo) {
          setDetalle(j);
          setEstado("listo");
        }
      })
      .catch(() => {
        if (vivo) {
          setFalloA(new Date().toISOString());
          setEstado("error");
        }
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Fuente de los datos a dibujar: la ruta si respondió; si no, la serie horneada en la página.
  const brecha = useMemo<ResultadoBrecha | null>(() => {
    if (detalle) {
      return construirBrecha({
        medata: detalle.medata ? { serie: detalle.medata.serie, hasta: detalle.medata.hasta } : null,
        policia: detalle.policia.datos.serie.length
          ? { serie: detalle.policia.datos.serie, corte: detalle.policia.datos.filasActualizadasFuente ?? detalle.policia.consultado }
          : null,
      });
    }
    if (estado === "error" && datos.seguridad) {
      const filas = datos.seguridad.muertesPorAnio;
      const conMedata = filas.filter((f) => f.medata !== null);
      const conPolicia = filas.filter((f) => f.policia !== null);
      return construirBrecha({
        medata: conMedata.length ? { serie: conMedata.map((f) => ({ a: f.anio, n: f.medata })), hasta: null } : null,
        policia: conPolicia.length ? { serie: conPolicia.map((f) => ({ anio: f.anio, victimas: f.policia })), corte: conPolicia[conPolicia.length - 1]!.corte } : null,
      });
    }
    return null;
  }, [detalle, estado, datos.seguridad]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl font-extrabold tracking-tight text-[#1E3A5F]">Brecha: muertes en incidentes viales por año</h2>
        <p className="m-0 max-w-[70ch] text-[13.5px] text-[#475569]">
          Lo que publica MEData (Secretaría de Movilidad, conjunto Víctimas en incidentes viales) frente a lo que registra la Policía
          Nacional en datos.gov.co para Medellín. Dos fuentes, dos cortes: la brecha es el dato.
        </p>
      </div>

      {estado === "cargando" && <Cargando />}

      {estado === "error" && (
        <div className="flex flex-col gap-1 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3" role="alert">
          <span className="text-sm font-bold text-[#B91C1C]">
            {brecha ? "No fue posible actualizar la serie" : "Ninguna fuente respondió"} a las {falloA ? horaColombia(falloA) : "—"}.
          </span>
          <span className="text-[12.5px] text-[#475569]">
            {brecha
              ? `Se muestra la serie guardada al generar la página (${fechaCortaColombia(datos.seguridad!.generado)}).`
              : "Ni la ruta de seguridad vial ni la página traen la serie. Vuelve a intentarlo en unos minutos."}
          </span>
        </div>
      )}

      {detalle?.policia.guardado && (
        <div className="flex flex-col gap-1 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3" role="status">
          <span className="text-sm font-bold text-[#B45309]">
            datos.gov.co no respondió a las {horaColombia(detalle.policia.consultado)} · copia guardada del {fechaCortaColombia(detalle.policia.capturado)}
          </span>
          <span className="text-[12.5px] text-[#475569]">La serie de la Policía corresponde a esa captura, no a la carga más reciente de la fuente.</span>
        </div>
      )}

      {brecha && (
        <>
          <p className="m-0 rounded-2xl border border-[#E3EAF3] bg-[#F4F7FB] px-4 py-3 text-[14px] font-semibold leading-relaxed text-[#0F172A]">
            {brecha.texto}
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-bold text-[#1E3A5F]">Muertes por año</span>
              <div className="flex flex-wrap gap-3 text-[11.5px] text-[#475569]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR_MEDATA }} /> MEData · Movilidad
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR_POLICIA }} /> Policía Nacional
                </span>
              </div>
            </div>
            <BarrasPareadas brecha={brecha} />
          </div>

          <TablaBrecha brecha={brecha} />

          <div className="flex flex-col gap-1.5">
            {detalle?.medata ? (
              <Fuente
                nombre={`${detalle.medata.fuente.nombre} (MEData ${detalle.medata.fuente.id})`}
                licencia={textoLicencia(detalle.medata.fuente.licencia)}
                lectura={detalle.medata.fuente.fechaCorte ? `${detalle.medata.fuente.fechaCorte}T12:00:00Z` : null}
                enlace={detalle.medata.fuente.url}
                nota={`campo Gravedad_victima = Muertos · datos hasta ${fechaCorte(detalle.medata.hasta)}`}
              />
            ) : (
              <p className="m-0 font-mono text-[11.5px] text-[#475569]">Fuente MEData: serie no disponible en esta sesión.</p>
            )}
            {detalle ? (
              <Fuente
                nombre={detalle.policia.fuente.nombre}
                licencia={textoLicencia(detalle.policia.fuente.licencia)}
                lectura={detalle.policia.datos.filasActualizadasFuente ?? detalle.policia.consultado}
                consultado={detalle.policia.consultado}
                enlace={detalle.policia.fuente.pagina}
                nota={detalle.policia.guardado ? `copia guardada del ${fechaCortaColombia(detalle.policia.capturado)}` : "sum(cantidad) por año, codigo_dane = 05001000"}
              />
            ) : (
              datos.seguridad && (
                <p className="m-0 font-mono text-[11.5px] text-[#475569]">
                  Fuentes: MEData (Víctimas en incidentes viales, CC BY-SA 4.0) y Policía Nacional vía datos.gov.co (CC BY-SA 4.0) · serie
                  horneada el {fechaCortaColombia(datos.seguridad.generado)}.
                </p>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BarrasPareadas({ brecha }: { brecha: ResultadoBrecha }) {
  const filas = brecha.filas;
  const n = filas.length;
  const W = 720;
  const H = 240;
  const margen = { izq: 44, der: 8, arr: 14, aba: 30 };
  const anchoUtil = W - margen.izq - margen.der;
  const altoUtil = H - margen.arr - margen.aba;
  const paso = anchoUtil / Math.max(1, n);
  const anchoBarra = Math.max(3, paso * 0.36);
  const max = brecha.maximo || 1;
  const y = (v: number) => margen.arr + altoUtil - (v / max) * altoUtil;
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const anclas = new Set(brecha.anclasPolicia);
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E3EAF3] bg-white p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[560px]" role="img" aria-label="Barras pareadas de muertes viales por año, MEData y Policía">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={margen.izq} x2={W - margen.der} y1={y(t)} y2={y(t)} stroke="#E3EAF3" strokeWidth={1} />
            <text x={margen.izq - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fontFamily="var(--font-jetbrains), monospace" fill="#475569">
              {miles(t)}
            </text>
          </g>
        ))}
        {filas.map((f, i) => {
          const x0 = margen.izq + i * paso + paso / 2;
          const esAncla = anclas.has(f.anio) || f.anio === brecha.ultimoAnioMedata;
          return (
            <g key={f.anio}>
              {f.medata !== null && (
                <rect x={x0 - anchoBarra - 1} y={y(f.medata)} width={anchoBarra} height={Math.max(0, altoUtil + margen.arr - y(f.medata))} fill={COLOR_MEDATA} rx={1.5}>
                  <title>{`${f.anio} · MEData: ${miles(f.medata)} muertes`}</title>
                </rect>
              )}
              {f.policia !== null && (
                <rect x={x0 + 1} y={y(f.policia)} width={anchoBarra} height={Math.max(0, altoUtil + margen.arr - y(f.policia))} fill={COLOR_POLICIA} rx={1.5}>
                  <title>{`${f.anio} · Policía Nacional: ${miles(f.policia)} muertes`}</title>
                </rect>
              )}
              {f.medata === null && f.policia !== null && f.anio > (brecha.ultimoAnioMedata ?? -Infinity) && (
                <rect x={x0 - anchoBarra - 1} y={margen.arr + altoUtil - 2} width={anchoBarra} height={2} fill="#CBD5E1">
                  <title>{`${f.anio} · MEData: sin publicar`}</title>
                </rect>
              )}
              <text x={x0} y={H - 10} textAnchor="middle" fontSize={10} fontWeight={esAncla ? 700 : 400} fontFamily="var(--font-jetbrains), monospace" fill={esAncla ? "#0F172A" : "#475569"}>
                {n > 12 && !esAncla && i % 2 === 1 ? "" : f.anio}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TablaBrecha({ brecha }: { brecha: ResultadoBrecha }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E3EAF3]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#F4F7FB] text-left text-[11px] font-bold tracking-wide text-[#475569]">
              <th scope="col" className="px-3 py-2 font-bold">AÑO</th>
              <th scope="col" className="px-3 py-2 text-right font-bold">MEDATA</th>
              <th scope="col" className="px-3 py-2 text-right font-bold">POLICÍA</th>
              <th scope="col" className="px-3 py-2 text-right font-bold">DIFERENCIA</th>
              <th scope="col" className="px-3 py-2 font-bold">CORTE</th>
            </tr>
          </thead>
          <tbody>
            {brecha.filas.map((f) => (
              <tr key={f.anio} className="border-t border-[#E3EAF3]">
                <td className="px-3 py-1.5 font-mono font-semibold text-[#0F172A]">{f.anio}</td>
                <td className="px-3 py-1.5 text-right font-mono text-[#0F172A]">{f.medata === null ? <span className="text-[#94A3B8]">sin publicar</span> : miles(f.medata)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-[#0F172A]">{f.policia === null ? <span className="text-[#94A3B8]">—</span> : miles(f.policia)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-[#475569]">{f.diferencia === null ? "—" : `${f.diferencia > 0 ? "+" : ""}${miles(f.diferencia)}`}</td>
                <td className="px-3 py-1.5 font-mono text-[11.5px] text-[#475569]">{textoCorte(f, brecha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function textoCorte(f: { anio: number; medata: number | null; policia: number | null }, b: ResultadoBrecha): string {
  const partes: string[] = [];
  if (f.medata !== null && f.anio === b.ultimoAnioMedata) partes.push("MEData: año parcial");
  if (f.policia !== null && b.anclasPolicia.length && f.anio === b.anclasPolicia[b.anclasPolicia.length - 1]) partes.push("Policía: año en curso");
  return partes.join(" · ") || "año completo";
}

function Cargando() {
  return (
    <div className="flex flex-col gap-3" aria-live="polite" aria-busy="true">
      <div className="h-12 animate-pulse rounded-2xl bg-[#F1F5F9]" />
      <div className="h-[240px] animate-pulse rounded-xl bg-[#F1F5F9]" />
      <span className="text-[12.5px] text-[#475569]">Consultando MEData y datos.gov.co…</span>
    </div>
  );
}

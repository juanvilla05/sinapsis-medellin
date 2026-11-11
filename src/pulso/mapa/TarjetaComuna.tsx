"use client";

import { CATEGORIAS } from "@/lib/ica";
import type { VistaPulso } from "../tipos";
import { CAPAS_REJILLA, CORTO_CAPA, UNIDAD_CAPA, decimal, periodoTexto, type CapaRejilla, type ComunaMapa, type EstacionSiata } from "./datos";
import { textoSuma, textoSumaCorto, type ResumenDato } from "./fichas";
import { Girador, foco, vidrio, type FaseCapa } from "./PanelesMapa";

/**
 * Tarjeta de una comuna: el dato elegido (incidentes, víctimas o hurto de MEData) con su total, su parte
 * de la ciudad, la serie por año y el desglose, más el aire de SIATA si hay estación dentro.
 * Solo muestra agregados ya suprimidos; no ordena ni califica comunas.
 */
export function TarjetaComuna({
  comuna,
  dato,
  resumenes,
  fase,
  estaciones,
  vista,
  onDato,
  onVista,
  onReintentar,
  onCerrar,
  onPreguntar,
}: {
  comuna: ComunaMapa;
  dato: CapaRejilla;
  resumenes: Record<CapaRejilla, ResumenDato | null>;
  fase: FaseCapa;
  /** estaciones de SIATA con lectura dentro de la comuna */
  estaciones: EstacionSiata[];
  vista: VistaPulso;
  onDato: (c: CapaRejilla) => void;
  onVista: (v: VistaPulso) => void;
  onReintentar: () => void;
  onCerrar: () => void;
  onPreguntar: (texto: string) => void;
}) {
  const resumen = resumenes[dato];
  const ficha = resumen?.porComuna.get(comuna.codigo) ?? null;
  const [, varios] = UNIDAD_CAPA[dato];
  const lugar = comuna.corregimiento ? `el corregimiento ${comuna.etiqueta}` : `la comuna ${comuna.codigo} ${comuna.nombre}`;
  const topeAnio = ficha ? Math.max(1, ...ficha.porAnio.map((a) => a.n)) : 1;

  return (
    <section aria-label={`Detalle: ${comuna.nombre}`} className={`${vidrio} p-4`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7DD3FC]">{comuna.corregimiento ? "Corregimiento" : `Comuna ${comuna.codigo}`}</p>
          <h3 className="mt-0.5 text-[17px] font-bold leading-snug">{comuna.etiqueta}</h3>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar detalle" className={`-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-tinta/70 hover:bg-tinta/10 ${foco}`}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div role="radiogroup" aria-label="Dato de la comuna" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-tinta/[0.06] p-1">
        {CAPAS_REJILLA.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === dato}
            onClick={() => onDato(c)}
            className={`h-9 rounded-lg text-[13px] font-semibold ${foco} ${c === dato ? "bg-[#2563EB] text-white" : "text-tinta/75 hover:bg-tinta/10"}`}
          >
            {CORTO_CAPA[c]}
          </button>
        ))}
      </div>

      {fase === "cargando" || fase === "inactivo" ? (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-tinta/75" role="status">
          <Girador /> Cargando los datos de la comuna…
        </div>
      ) : fase === "error" ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-[13px] text-tinta/80" role="alert">
          <span>No pudimos cargar los datos por comuna.</span>
          <button type="button" onClick={onReintentar} className={`shrink-0 rounded-full bg-tinta/10 px-3 py-1 font-semibold hover:bg-tinta/15 ${foco}`}>
            Reintentar
          </button>
        </div>
      ) : !resumen ? (
        <p className="mt-3 text-[13px] text-tinta/75">Este dato todavía está en preparación.</p>
      ) : !ficha ? (
        <p className="mt-3 text-[13px] text-tinta/75">MEData no publica {varios} con esta comuna registrada.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-2.5">
            <p className="shrink-0 font-mono text-[30px] font-extrabold leading-none tabular-nums" title={ficha.total.incompleto ? "Hay conteos de 1 a 4 que no se publican: el total real es un poco mayor" : undefined}>
              {textoSumaCorto(ficha.total)}
            </p>
            <p className="pb-0.5 text-[12.5px] leading-tight text-tinta/65">{varios}</p>
          </div>
          <p className="mt-1.5 text-[12.5px] text-tinta/75">
            {decimal(ficha.pct)} % del total por comunas · {periodoTexto(resumen.fuente.periodo)}
          </p>

          <div className="mt-3" role="img" aria-label={`Casos por año, de ${resumen.anios[0]} a ${resumen.anios[resumen.anios.length - 1]}: ${ficha.porAnio.map((a) => `${a.a}, ${textoSuma(a)}`).join("; ")}`}>
            <div className="flex h-14 items-end gap-[3px]">
              {ficha.porAnio.map((a) => (
                <span
                  key={a.a}
                  title={`${a.a}: ${textoSuma(a)}`}
                  className={`min-h-[2px] flex-1 rounded-t-[3px] ${a.n === 0 ? "bg-tinta/15" : "bg-[#38BDF8]"}`}
                  style={{ height: `${Math.max(3, (a.n / topeAnio) * 100)}%` }}
                />
              ))}
            </div>
            <p className="mt-1 flex justify-between text-[12px] tabular-nums text-tinta/65">
              <span>{resumen.anios[0]}</span>
              <span>por año</span>
              <span>{resumen.anios[resumen.anios.length - 1]}</span>
            </p>
          </div>

          <dl className="mt-2">
            {ficha.desglose.map((d) => (
              <div key={d.k} className="flex items-baseline justify-between gap-3 border-t border-tinta/5 py-1.5 text-[12.5px]">
                <dt className="text-tinta/65">{d.k}</dt>
                <dd className="text-right font-medium tabular-nums">{textoSuma(d)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <div className="mt-2 border-t border-tinta/10 pt-2.5 text-[12.5px]">
        <p className="font-semibold">Aire ahora · SIATA</p>
        {estaciones.length === 0 ? (
          <p className="mt-0.5 text-tinta/65">Sin estación con lectura dentro de esta comuna.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {estaciones.slice(0, 3).map((e) => (
              <li key={e.codigo} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORIAS[e.categoria].color }} aria-hidden="true" />
                  <span className="truncate text-tinta/80">{e.sitio || e.nombre}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {e.pm25 != null ? `${decimal(e.pm25)} µg/m³` : "sin dato"} · {CATEGORIAS[e.categoria].corto}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onVista(vista === "una" ? "comunas" : "una")}
          className={`rounded-xl border border-tinta/15 bg-tinta/5 px-3 py-2.5 text-[13px] font-bold hover:bg-tinta/10 ${foco}`}
        >
          {vista === "una" ? "Ver todas" : "Ver solo esta"}
        </button>
        <button
          type="button"
          onClick={() =>
            onPreguntar(
              ficha && resumen
                ? `En ${lugar} MEData registra ${textoSuma(ficha.total)} ${varios} (${periodoTexto(resumen.fuente.periodo)}). ¿Cómo se compara con el resto de Medellín y qué patrón muestran los datos?`
                : `¿Qué muestran los datos de aire (SIATA), seguridad vial y hurto (MEData) para ${lugar}?`,
            )
          }
          className={`rounded-xl bg-[#2563EB] px-3 py-2.5 text-[13px] font-bold text-white hover:bg-[#1D4ED8] ${foco}`}
        >
          Preguntar a PulsoBot
        </button>
      </div>
    </section>
  );
}

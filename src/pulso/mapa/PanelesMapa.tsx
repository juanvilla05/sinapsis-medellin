"use client";

import type { ReactNode } from "react";
import type { ResumenAire } from "@/lib/aire";
import { CATEGORIAS, ORDEN_CATEGORIAS, categoriaICA } from "@/lib/ica";
import { useTema } from "../tema";
import type { CapaPulso } from "../tipos";
import {
  CORTO_CAPA,
  gradienteCss,
  NOMBRE_CAPA,
  UNIDAD_CAPA,
  comunaEn,
  decimal,
  horaBogota,
  numero,
  periodoTexto,
  type ComunaMapa,
  type EstacionSiata,
  type ObjetoMapa,
  type Pasada,
  type RejillaMapa,
  distanciaTexto,
  duracionTexto,
} from "./datos";

/* ───────── piezas comunes ───────── */

export const vidrio = "rounded-2xl border border-tinta/10 bg-fondo/85 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md";
export const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DD3FC]";

export function Girador({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-4 w-4 rounded-full border-2 border-tinta/25 border-t-[#38BDF8] motion-safe:animate-spin ${className}`} />;
}

export type FaseCapa = "inactivo" | "cargando" | "listo" | "error" | "vacio";

export interface InfoCapa {
  fase: FaseCapa;
  /** "SIATA", "MEData · Alcaldía de Medellín"… */
  fuente: string;
  /** "última lectura 11:46 a. m.", "corte 1 sept 2020"… */
  corte: string | null;
}

/** Créditos del mapa y de los datos, detrás de un botón ⓘ para no llenar la pantalla de letra pequeña. */
export function Atribucion({ className = "", arriba = false }: { className?: string; arriba?: boolean }) {
  return (
    <details className={`relative ${className}`}>
      <summary
        aria-label="Créditos del mapa y de los datos"
        title="Créditos del mapa y de los datos"
        className={`flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-tinta/10 bg-tinta/5 text-[13px] font-bold text-tinta/75 hover:bg-tinta/10 [&::-webkit-details-marker]:hidden ${foco}`}
      >
        i
      </summary>
      <p className={`${vidrio} absolute z-20 w-[250px] px-3 py-2.5 text-[12.5px] leading-relaxed text-tinta/85 ${arriba ? "bottom-9 left-0" : "top-9 right-0"}`}>
        Mapa base:{" "}
        <a className={`underline underline-offset-2 ${foco}`} href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>{" "}
        ·{" "}
        <a className={`underline underline-offset-2 ${foco}`} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
        . Datos: MEData, SIATA, datos.gov.co y GeoMedellín.
      </p>
    </details>
  );
}

/* ───────── KPIs del aire ───────── */

export function KpisAire({
  fase,
  resumen,
  pildora,
  guardado,
  onPeor,
  onReintentar,
}: {
  fase: "cargando" | "listo" | "error" | "inactivo";
  resumen: ResumenAire | null;
  pildora: string | null;
  guardado: boolean;
  onPeor: () => void;
  onReintentar: () => void;
}) {
  const cat = resumen?.promedioIca != null ? categoriaICA(resumen.promedioIca).clave : null;
  return (
    <section aria-label="Aire en Medellín ahora" className={`${vidrio} px-3.5 py-2.5`}>
      {fase === "error" && !resumen ? (
        <div className="flex items-center justify-between gap-2 text-[13.5px] text-tinta/80">
          <span>No pudimos leer el aire de SIATA.</span>
          <button type="button" onClick={onReintentar} className={`shrink-0 rounded-full bg-tinta/10 px-3 py-1 text-[13px] font-semibold hover:bg-tinta/15 ${foco}`}>
            Reintentar
          </button>
        </div>
      ) : !resumen ? (
        <div className="h-11 rounded-lg bg-tinta/5 motion-safe:animate-pulse" aria-busy="true" aria-label="Cargando el aire de SIATA" />
      ) : resumen.estacionesValidas === 0 ? (
        <p className="text-[13.5px] text-tinta/80">SIATA no reporta lecturas de aire en Medellín en este momento.</p>
      ) : (
        <button
          type="button"
          onClick={onPeor}
          disabled={!resumen.peor}
          aria-label={`Aire en Medellín: ${resumen.promedioPm25 != null ? decimal(resumen.promedioPm25) : "sin dato"} microgramos por metro cúbico de PM2.5 en promedio${cat ? `, ${CATEGORIAS[cat].texto}` : ""}. ${pildora ?? ""}. Ver la estación con el valor más alto.`}
          className={`flex w-full items-center gap-3 rounded-lg text-left ${foco}`}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[13.5px] font-bold">
              <span className={`h-2 w-2 rounded-full ${guardado ? "bg-amber-300" : "bg-[#34D399]"}`} aria-hidden="true" />
              Aire ahora
            </span>
            {pildora && <span className={`mt-0.5 block truncate text-[12.5px] ${guardado ? "text-amber-200" : "text-tinta/65"}`}>{pildora}</span>}
          </span>
          <span className="shrink-0 text-right leading-none">
            <span className="font-mono text-[26px] font-bold tabular-nums">{resumen.promedioPm25 != null ? decimal(resumen.promedioPm25) : "—"}</span>
            <span className="ml-1 text-[12.5px] text-tinta/65">µg/m³</span>
          </span>
          {cat && (
            <span className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-bold" style={{ background: CATEGORIAS[cat].fondo, color: CATEGORIAS[cat].tinta }}>
              {CATEGORIAS[cat].corto}
            </span>
          )}
        </button>
      )}
    </section>
  );
}

/* ───────── leyendas ───────── */

export function LeyendaAire({ estaciones }: { estaciones: EstacionSiata[] | null; compacta?: boolean }) {
  const presentes = new Set((estaciones ?? []).filter((e) => e.enMedellin && e.pm25 !== null).map((e) => e.categoria));
  const mostrar = ORDEN_CATEGORIAS.filter((c) => c !== "sin-dato" && (presentes.has(c) || ["buena", "aceptable", "danina-sensibles"].includes(c)));
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Categorías del índice de calidad del aire (Resolución 2254 de 2017)">
      {mostrar.map((c) => (
        <li key={c} className="flex items-center gap-1.5 text-[12.5px] text-tinta/80">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORIAS[c].color }} aria-hidden="true" />
          {CATEGORIAS[c].corto}
        </li>
      ))}
    </ul>
  );
}

export function LeyendaRejilla({ rejilla }: { rejilla: RejillaMapa; compacta?: boolean }) {
  const tema = useTema();
  const primera = rejilla.marcas[0];
  const ultima = rejilla.marcas[rejilla.marcas.length - 1];
  return (
    <div className="space-y-1" aria-label={`Escala de color: de ${primera ? numero(primera.n) : "pocos"} a ${ultima ? numero(ultima.n) : "muchos"} casos por celda de 250 metros`}>
      <div className="h-2.5 rounded-full" style={{ background: gradienteCss(tema) }} aria-hidden="true" />
      <p className="flex justify-between text-[12.5px] tabular-nums text-tinta/75">
        <span>{primera ? numero(primera.n) : "Menos"} casos</span>
        <span>
          {ultima ? numero(ultima.n) : "Más"}
          {ultima && rejilla.maximo > ultima.n ? "+" : ""}
        </span>
      </p>
    </div>
  );
}

export function LeyendaComunas() {
  return null;
}

/* ───────── panel de capas (escritorio) y chips (móvil) ───────── */

const CAPAS_ORDEN: CapaPulso[] = ["aire", "incidentes", "victimas", "hurto", "comunas"];

/** Una sola línea bajo el nombre de la capa, y solo cuando dice algo útil (la fecha del dato o un problema). */
function textoFase(i: InfoCapa, activa: boolean) {
  if (i.fase === "cargando") return activa ? "Cargando…" : null;
  if (i.fase === "error") return "No disponible ahora";
  if (i.fase === "vacio") return "Datos en preparación";
  return activa ? i.corte : null;
}

function Interruptor({ activo }: { activo: boolean }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex h-4.5 w-8 shrink-0 rounded-full transition-colors ${activo ? "bg-[#2563EB]" : "bg-tinta/15"}`}>
      <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${activo ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
  );
}

export interface PropsCapas {
  capas: Record<CapaPulso, boolean>;
  info: Record<CapaPulso, InfoCapa>;
  onCambiar: (c: CapaPulso, visible: boolean) => void;
  onReintentar: (c: CapaPulso) => void;
  leyendas: Partial<Record<CapaPulso, ReactNode>>;
  recorrido: { girando: boolean };
  onRecorrido: () => void;
  onVista: () => void;
  plegado: boolean;
  onPlegar: () => void;
}

function IconoGiro({ girando }: { girando: boolean }) {
  return girando ? (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="3.5" y="3" width="3" height="10" rx="1" fill="currentColor" />
      <rect x="9.5" y="3" width="3" height="10" rx="1" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L4.9 2.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}

const botonChico = `inline-flex h-7 items-center gap-1.5 rounded-full border border-tinta/10 bg-tinta/5 px-2.5 text-[13px] font-semibold text-tinta/85 hover:bg-tinta/10 ${foco}`;

export function PanelCapas(p: PropsCapas) {
  return (
    <section aria-label="Capas del mapa" className={`${vidrio} flex max-h-full min-h-0 w-full min-w-0 flex-col`}>
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h2 className="text-[14px] font-bold">Capas</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={p.onRecorrido}
            className={botonChico}
            aria-pressed={p.recorrido.girando}
            aria-label={p.recorrido.girando ? "Pausar el recorrido de cámara" : "Iniciar el recorrido de cámara alrededor del valle"}
          >
            <IconoGiro girando={p.recorrido.girando} />
            {p.recorrido.girando ? "Pausar" : "Recorrido"}
          </button>
          <button type="button" onClick={p.onVista} className={botonChico} aria-label="Volver a la vista inicial de Medellín">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M8 1.5 14 6v8.5H10v-4H6v4H2V6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </button>
          <Atribucion />
          <button type="button" onClick={p.onPlegar} className={botonChico} aria-expanded={!p.plegado} aria-label={p.plegado ? "Mostrar capas" : "Ocultar capas"}>
            <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${p.plegado ? "rotate-180" : ""}`} aria-hidden="true">
              <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {!p.plegado && (
        <div className="min-h-0 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
          <ul className="space-y-1">
            {CAPAS_ORDEN.map((c) => {
              const i = p.info[c];
              const activa = p.capas[c];
              const sub = textoFase(i, activa);
              return (
                <li key={c} className={`rounded-xl ${activa ? "bg-tinta/[0.06]" : ""}`}>
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activa}
                      onClick={() => p.onCambiar(c, !activa)}
                      className={`flex min-w-0 flex-1 items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-tinta/5 ${foco}`}
                    >
                      <Interruptor activo={activa} />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-tight">{NOMBRE_CAPA[c]}</span>
                        {sub && <span className="mt-0.5 block text-[12.5px] leading-snug text-tinta/65">{sub}</span>}
                      </span>
                      {i.fase === "cargando" && <Girador className="ml-auto mt-0.5 shrink-0" />}
                    </button>
                    {i.fase === "error" && (
                      <button type="button" onClick={() => p.onReintentar(c)} className={`mt-1.5 mr-1 shrink-0 rounded-full bg-tinta/10 px-2 py-0.5 text-[11px] font-semibold hover:bg-tinta/15 ${foco}`}>
                        Reintentar
                      </button>
                    )}
                  </div>
                  {activa && p.leyendas[c] && <div className="px-3 pb-2.5 pt-0.5">{p.leyendas[c]}</div>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export function ChipsCapas(p: PropsCapas & { foco: CapaPulso | null }) {
  const enFoco = p.foco && p.capas[p.foco] ? p.foco : p.capas.aire ? "aire" : (CAPAS_ORDEN.find((c) => p.capas[c]) ?? null);
  const info = enFoco ? p.info[enFoco] : null;
  return (
    <div className="flex flex-col gap-1.5">
      {/* a la derecha queda libre el botón de PulsoBot */}
      <div className="mr-[146px] flex items-end gap-1.5">
        <Atribucion arriba />
        {enFoco && info && p.leyendas[enFoco] && <div className={`${vidrio} min-w-0 flex-1 px-3 py-2`}>{p.leyendas[enFoco]}</div>}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" role="group" aria-label="Capas del mapa">
        {CAPAS_ORDEN.map((c) => {
          const activa = p.capas[c];
          const i = p.info[c];
          return (
            <button
              key={c}
              type="button"
              role="switch"
              aria-checked={activa}
              aria-label={NOMBRE_CAPA[c]}
              onClick={() => (i.fase === "error" && activa ? p.onReintentar(c) : p.onCambiar(c, !activa))}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold backdrop-blur-md ${foco} ${
                activa ? "border-[#3B82F6] bg-[#2563EB]/90 text-tinta" : "border-tinta/10 bg-fondo/85 text-tinta/80"
              }`}
            >
              {i.fase === "cargando" && activa ? <Girador className="h-3.5 w-3.5" /> : null}
              {CORTO_CAPA[c]}
            </button>
          );
        })}
        <button type="button" onClick={p.onRecorrido} aria-pressed={p.recorrido.girando} className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-tinta/10 bg-fondo/85 px-3.5 text-[13px] font-semibold text-tinta/80 backdrop-blur-md ${foco}`}>
          <IconoGiro girando={p.recorrido.girando} />
          Recorrido
        </button>
        <button type="button" onClick={p.onVista} aria-label="Volver a la vista inicial de Medellín" className={`flex h-10 shrink-0 items-center rounded-full border border-tinta/10 bg-fondo/85 px-3 text-tinta/80 backdrop-blur-md ${foco}`}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d="M8 1.5 14 6v8.5H10v-4H6v4H2V6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ───────── tooltip y tarjeta de detalle ───────── */

function lineasObjeto(o: ObjetoMapa, rejillas: Partial<Record<string, RejillaMapa | null>>): { titulo: string; lineas: string[] } {
  switch (o.tipo) {
    case "estacion": {
      const e = o.estacion;
      return {
        titulo: e.sitio || e.nombre,
        lineas: [
          e.pm25 != null ? `PM2.5: ${decimal(e.pm25)} µg/m³ · ${CATEGORIAS[e.categoria].corto}` : "Sin lectura válida de PM2.5",
          `${e.municipio}${e.enMedellin ? "" : " (área metropolitana)"} · lectura ${horaBogota(e.actualizado) ?? "—"}`,
        ],
      };
    }
    case "celda": {
      const c = o.celda;
      const rej = rejillas[c.capa];
      const [uno, varios] = UNIDAD_CAPA[c.capa];
      return {
        titulo: `${numero(c.n)} ${c.n === 1 ? uno : varios}`,
        lineas: [`Celda de 250 m · ${rej ? periodoTexto(rej.fuente.periodo) : ""}`],
      };
    }
    case "comuna":
      return { titulo: o.nombre, lineas: [Number(o.codigo) >= 50 ? `Corregimiento · código ${o.codigo}` : `Comuna ${o.codigo}`] };
    case "ruta": {
      const r = o.ruta;
      return {
        titulo: r.etiqueta,
        lineas: [
          `${duracionTexto(r.duracionS)} · ${distanciaTexto(r.distanciaM)}`,
          r.pm25Estimado != null ? `PM2.5 estimado: ${decimal(r.pm25Estimado)} µg/m³` : "PM2.5 estimado: sin dato",
        ],
      };
    }
  }
}

export function Tooltip({ pasada, rejillas }: { pasada: Pasada; rejillas: Partial<Record<string, RejillaMapa | null>> }) {
  const { titulo, lineas } = lineasObjeto(pasada.objeto, rejillas);
  const arriba = pasada.y > 140;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 w-max max-w-[260px] rounded-xl border border-tinta/15 bg-fondo/95 px-3 py-2 text-[12px] shadow-xl"
      style={{
        left: `clamp(8px, ${pasada.x - 130}px, calc(100% - 268px))`,
        top: arriba ? pasada.y - 14 : pasada.y + 18,
        transform: arriba ? "translateY(-100%)" : undefined,
      }}
    >
      <p className="font-semibold leading-snug">{titulo}</p>
      {lineas.map((l) => (
        <p key={l} className="leading-snug text-tinta/70">
          {l}
        </p>
      ))}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-tinta/5 py-1.5 text-[12.5px]">
      <dt className="text-tinta/60">{k}</dt>
      <dd className="text-right font-medium tabular-nums">{v}</dd>
    </div>
  );
}

const suprimible = (n: number | null) => (n === null ? "menos de 5" : numero(n));

export function TarjetaDetalle({
  objeto,
  rejillas,
  comunas,
  onCerrar,
  onPreguntar,
}: {
  objeto: ObjetoMapa;
  rejillas: Partial<Record<string, RejillaMapa | null>>;
  comunas: ComunaMapa[] | null;
  onCerrar: () => void;
  onPreguntar: (texto: string) => void;
}) {
  let titulo = "";
  let sub = "";
  let cuerpo: ReactNode = null;
  let pregunta = "";

  if (objeto.tipo === "estacion") {
    const e = objeto.estacion;
    const cat = CATEGORIAS[e.categoria];
    titulo = e.sitio || e.nombre;
    sub = `Estación SIATA #${e.codigo} · ${e.municipio}`;
    cuerpo = (
      <>
        <div className="mt-2 flex items-end gap-3">
          <p className="font-mono text-[34px] font-extrabold leading-none tabular-nums">{e.pm25 != null ? decimal(e.pm25) : "—"}</p>
          <p className="pb-1 text-[12px] text-tinta/60">µg/m³ de PM2.5</p>
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: `${cat.color}26`, color: "#fff" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} aria-hidden="true" />
          {cat.texto}
        </p>
        <dl className="mt-2">
          <Dato k="ICA (Res. 2254/2017)" v={e.ica ?? "sin dato"} />
          <Dato k="Hora de lectura" v={`${horaBogota(e.actualizado) ?? "—"}${e.obsoleta ? " · más de 1 h sin actualizar" : ""}`} />
          {!e.enMedellin && <Dato k="Ámbito" v="Área metropolitana (contexto)" />}
        </dl>
      </>
    );
    pregunta =
      e.pm25 != null
        ? `¿Cómo está el aire en la estación ${titulo} de ${e.municipio}? Su última lectura de PM2.5 fue ${decimal(e.pm25)} µg/m³ (${cat.texto}). ¿Qué significa para la salud y qué recomiendas?`
        : `La estación ${titulo} de ${e.municipio} no reporta PM2.5 en este momento. ¿Cómo está el aire cerca de allí según las demás estaciones de SIATA?`;
  } else if (objeto.tipo === "celda") {
    const c = objeto.celda;
    const rej = rejillas[c.capa];
    const comuna = comunaEn(comunas, c.lng, c.lat);
    const [uno, varios] = UNIDAD_CAPA[c.capa];
    const periodo = rej ? periodoTexto(rej.fuente.periodo) : "";
    titulo = `${numero(c.n)} ${c.n === 1 ? uno : varios}`;
    sub = `${NOMBRE_CAPA[c.capa]} · celda de 250 m`;
    cuerpo = (
      <dl className="mt-2">
        <Dato k="Período" v={periodo} />
        <Dato k="Ubicación" v={comuna ? comuna.nombre : `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`} />
        {c.victimas && (
          <>
            <Dato k="Peatones" v={suprimible(c.victimas.peaton)} />
            <Dato k="Motociclistas" v={suprimible(c.victimas.motociclista)} />
            <Dato k="Ciclistas" v={suprimible(c.victimas.ciclista)} />
            <Dato k="Heridos · muertos" v={`${suprimible(c.victimas.heridos)} · ${suprimible(c.victimas.muertos)}`} />
          </>
        )}
        <Dato k="Fuente" v={rej ? `${rej.fuente.publicador}` : "MEData"} />
      </dl>
    );
    pregunta = `En una celda de 250 m ${comuna ? `de ${comuna.nombre}` : `cerca de ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`} hay ${numero(c.n)} ${c.n === 1 ? uno : varios} entre ${periodo}. ¿Cómo se compara con el resto de ${comuna ? "esa zona" : "Medellín"} y qué patrón muestran los datos de MEData?`;
  } else if (objeto.tipo === "comuna") {
    const corr = Number(objeto.codigo) >= 50;
    titulo = objeto.nombre;
    sub = corr ? `Corregimiento · código ${objeto.codigo}` : `Comuna ${objeto.codigo}`;
    cuerpo = (
      <dl className="mt-2">
        <Dato k="Código oficial" v={objeto.codigo} />
        <Dato k="Fuente" v="GeoMedellín · Alcaldía de Medellín" />
      </dl>
    );
    pregunta = `¿Qué muestran los datos de aire (SIATA), seguridad vial y hurto (MEData) para ${corr ? `el corregimiento ${objeto.nombre.replace(/^Corregimiento de /i, "")}` : `la comuna ${objeto.codigo} ${objeto.nombre}`}?`;
  } else {
    const r = objeto.ruta;
    titulo = r.etiqueta;
    sub = "Ruta sugerida";
    cuerpo = (
      <dl className="mt-2">
        <Dato k="Duración · distancia" v={`${duracionTexto(r.duracionS)} · ${distanciaTexto(r.distanciaM)}`} />
        <Dato k="PM2.5 estimado" v={r.pm25Estimado != null ? `${decimal(r.pm25Estimado)} µg/m³` : "sin dato"} />
        <Dato k="Incidentes viales cercanos" v={r.incidentesCercanos != null ? numero(r.incidentesCercanos) : "sin dato"} />
      </dl>
    );
    pregunta = `¿Por qué la ${r.etiqueta} tiene un PM2.5 estimado de ${r.pm25Estimado != null ? `${decimal(r.pm25Estimado)} µg/m³` : "valor sin dato"} y qué la diferencia de las otras alternativas?`;
  }

  return (
    <section aria-label={`Detalle: ${titulo}`} className={`${vidrio} p-4`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7DD3FC]">{sub}</p>
          <h3 className="mt-0.5 text-[16px] font-bold leading-snug">{titulo}</h3>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar detalle" className={`-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-tinta/70 hover:bg-tinta/10 ${foco}`}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {cuerpo}
      <button
        type="button"
        onClick={() => onPreguntar(pregunta)}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2.5 text-[13.5px] font-bold hover:bg-[#1D4ED8] ${foco}`}
      >
        Pregúntale a PULSO
      </button>
    </section>
  );
}

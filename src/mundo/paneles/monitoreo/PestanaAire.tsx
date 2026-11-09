"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resumirEstaciones, type EstacionResumen, type EstacionSiata, type SnapshotSiata, type SnapshotSiataOk } from "@/lib/aire";
import { CATEGORIAS, ORDEN_CATEGORIAS, type ClaveCategoria } from "@/lib/ica";
import { decimal, miles } from "../../areas";
import Chips, { type OpcionChip } from "./Filtros";
import Fuente from "./Fuente";
import { fechaCortaColombia, haceCuanto, horaColombia } from "./formato";

const AMVA = "__amva__";
type Ambito = typeof AMVA | string;
type Estado = "cargando" | "error" | "listo";

const NOMBRE_FUENTE = "SIATA – Área Metropolitana del Valle de Aburrá (capas 602/603 del visor)";

/** Error con texto propio (ya en español) que sí se puede mostrar en pantalla; cualquier otro se generaliza. */
class ErrorServidor extends Error {}

/** Última lectura de PM2.5 por estación de SIATA, filtrada a Medellín por defecto. */
export default function PestanaAire() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [snapshot, setSnapshot] = useState<SnapshotSiataOk | null>(null);
  const [errorRed, setErrorRed] = useState<string | null>(null);
  const [falloA, setFalloA] = useState<string | null>(null);
  const [ambito, setAmbito] = useState<Ambito>("Medellín");
  const [categoria, setCategoria] = useState<ClaveCategoria | "todas">("todas");

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setErrorRed(null);
    try {
      const r = await fetch("/api/siata", { cache: "no-store" });
      // un 500 de Next llega como HTML: no intentar parsearlo ni mostrar el error del navegador
      if (!r.headers.get("content-type")?.includes("application/json")) {
        throw new ErrorServidor(`El servidor no respondió (HTTP ${r.status})`);
      }
      const j = (await r.json()) as SnapshotSiata;
      // `j.error` ya viene saneado desde `obtenerAire()` (motivo propio, en español)
      if (!j.ok) throw new ErrorServidor(j.error || `El servidor no respondió (HTTP ${r.status})`);
      setSnapshot(j);
      setEstado("listo");
    } catch (e) {
      setErrorRed(e instanceof ErrorServidor ? e.message : "Sin conexión con el servidor");
      setFalloA(new Date().toISOString());
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    // primera consulta al abrir la pestaña
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia la carga asíncrona del aire
    cargar();
  }, [cargar]);

  const estaciones = useMemo(() => snapshot?.estaciones ?? [], [snapshot]);

  const municipios = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const e of estaciones) conteo.set(e.municipio, (conteo.get(e.municipio) ?? 0) + 1);
    const otros = [...conteo.keys()].filter((m) => m !== "Medellín").sort((a, b) => a.localeCompare(b, "es"));
    const opciones: OpcionChip<Ambito>[] = [
      { clave: "Medellín", texto: "Medellín", n: conteo.get("Medellín") ?? 0 },
      ...otros.map((m) => ({ clave: m, texto: m, n: conteo.get(m) })),
      { clave: AMVA, texto: "Área metropolitana (contexto)", n: estaciones.length },
    ];
    return opciones;
  }, [estaciones]);

  const enAmbito = useMemo(
    () => (ambito === AMVA ? estaciones : estaciones.filter((e) => e.municipio === ambito)),
    [estaciones, ambito],
  );
  const resumen = useMemo(() => resumirEstaciones(enAmbito), [enAmbito]);

  const categoriasPresentes = useMemo<OpcionChip<ClaveCategoria | "todas">[]>(
    () => [
      { clave: "todas", texto: "Todas", n: enAmbito.length },
      ...ORDEN_CATEGORIAS.filter((c) => resumen.porCategoria[c] > 0).map((c) => ({
        clave: c,
        texto: CATEGORIAS[c].corto,
        n: resumen.porCategoria[c],
        color: CATEGORIAS[c].color,
        fondo: CATEGORIAS[c].fondo,
        tinta: CATEGORIAS[c].tinta,
      })),
    ],
    [enAmbito.length, resumen.porCategoria],
  );

  const visibles = useMemo(() => {
    const lista = categoria === "todas" ? enAmbito : enAmbito.filter((e) => e.categoria === categoria);
    // de mayor a menor concentración; sin dato al final
    return [...lista].sort((a, b) => (b.pm25 ?? -1) - (a.pm25 ?? -1));
  }, [enAmbito, categoria]);

  const nombreAmbito = ambito === AMVA ? "Área metropolitana" : ambito;

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-xl font-extrabold tracking-tight text-[#1E3A5F]">PULSO · la ciudad en vivo</h2>
          <p className="m-0 text-[13.5px] text-[#475569]">
            Última lectura de material particulado fino (PM2.5) por estación de SIATA. Índice y categorías según la Resolución
            2254 de 2017.
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={estado === "cargando"}
          className="rounded-xl bg-[#2563EB] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#1D4FD7] disabled:opacity-60"
        >
          {estado === "cargando" ? "Consultando SIATA…" : "↻ Actualizar"}
        </button>
      </div>

      {/* Avisos de estado */}
      {estado === "error" && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3" role="alert">
          <span className="text-sm font-bold text-[#B91C1C]">
            No fue posible consultar el aire a las {falloA ? horaColombia(falloA) : "—"}.
          </span>
          <span className="text-[12.5px] text-[#475569]">
            {errorRed ?? "Sin detalle del error."}
            {snapshot ? ` Se conservan los datos de la consulta anterior (${horaColombia(snapshot.consultado)}).` : ""}
          </span>
          <button
            type="button"
            onClick={cargar}
            className="mt-1 self-start rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F]"
          >
            Reintentar
          </button>
        </div>
      )}
      {snapshot?.guardado && (
        <div className="flex flex-col gap-1 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3" role="status">
          <span className="text-sm font-bold text-[#B45309]">
            SIATA no respondió a las {horaColombia(snapshot.consultado)} · copia guardada del{" "}
            {snapshot.capturado ? fechaCortaColombia(snapshot.capturado) : "—"}
          </span>
          <span className="text-[12.5px] text-[#475569]">
            Las cifras de abajo corresponden a esa captura, no a la lectura actual. {snapshot.aviso ?? ""}
          </span>
        </div>
      )}

      {/* Filtros */}
      {estaciones.length > 0 && (
        <div className="flex flex-col gap-2">
          <Chips etiqueta="Filtrar por municipio" opciones={municipios} valor={ambito} onChange={(m) => setAmbito(m)} />
          <Chips etiqueta="Filtrar por categoría" opciones={categoriasPresentes} valor={categoria} onChange={(c) => setCategoria(c)} />
        </div>
      )}

      {/* KPIs */}
      {estado === "cargando" && !snapshot && <KpisCargando />}
      {snapshot && (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
          <Kpi
            titulo={`Estaciones válidas · ${nombreAmbito}`}
            valor={miles(resumen.estacionesValidas)}
            detalle={`de ${miles(resumen.total)} estaciones${resumen.sinDato ? ` · ${miles(resumen.sinDato)} sin dato` : ""}`}
          />
          <Kpi
            titulo="Promedio PM2.5"
            valor={resumen.promedioPm25 === null ? "—" : decimal(resumen.promedioPm25)}
            unidad={resumen.promedioPm25 === null ? undefined : "µg/m³"}
            detalle={
              resumen.promedioIca === null
                ? "sin lecturas válidas"
                : `ICA ${resumen.promedioIca} · ${CATEGORIAS[categoriaDeIca(resumen.promedioIca)].texto}`
            }
            color={resumen.promedioIca === null ? undefined : CATEGORIAS[categoriaDeIca(resumen.promedioIca)].color}
          />
          <KpiEstacion titulo="Concentración más alta" estacion={resumen.peor} />
          <KpiEstacion titulo="Concentración más baja" estacion={resumen.mejor} />
        </div>
      )}

      {/* Tabla */}
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-bold text-[#1E3A5F]">Estaciones · {nombreAmbito}</span>
        <div className="overflow-hidden rounded-xl border border-[#E3EAF3]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F4F7FB] text-left text-[11px] font-bold tracking-wide text-[#475569]">
                  <th className="px-3 py-2 font-bold">ESTACIÓN</th>
                  <th className="px-3 py-2 font-bold">MUNICIPIO</th>
                  <th className="px-3 py-2 text-right font-bold">PM2.5 µg/m³</th>
                  <th className="px-3 py-2 text-right font-bold">ICA</th>
                  <th className="px-3 py-2 font-bold">CATEGORÍA</th>
                  <th className="px-3 py-2 font-bold">ÚLTIMA LECTURA</th>
                </tr>
              </thead>
              <tbody>
                {estado === "cargando" && !snapshot && <FilasCargando />}
                {snapshot && visibles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="border-t border-[#E3EAF3] p-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-[#0F172A]">Ninguna estación coincide con los filtros.</span>
                        <span className="text-[13px] text-[#475569]">Prueba con otro municipio o quita el filtro de categoría.</span>
                      </div>
                    </td>
                  </tr>
                )}
                {visibles.map((e) => (
                  <FilaEstacion key={e.codigo} e={e} />
                ))}
              </tbody>
            </table>
          </div>
          {estado === "cargando" && !snapshot && (
            <div className="border-t border-[#E3EAF3] p-3 text-[12.5px] text-[#475569]" aria-live="polite">
              La Operadora está leyendo las estaciones de SIATA…
            </div>
          )}
        </div>
        <span className="text-[11.5px] text-[#475569]">
          Las estaciones sin dato (centinela −9999 de SIATA) se muestran pero no entran en el promedio. Ordenadas de mayor a menor
          concentración; describe medidas de estaciones, no califica lugares.
        </span>
      </div>

      <Fuente
        nombre={NOMBRE_FUENTE}
        licencia="no declarada"
        lectura={snapshot?.lectura ?? null}
        consultado={snapshot?.consultado ?? null}
        enlace="https://siata.gov.co/"
        nota={snapshot?.guardado ? "copia guardada (uso académico con atribución)" : "uso académico con atribución"}
      />
    </div>
  );
}

function categoriaDeIca(ica: number): ClaveCategoria {
  if (ica <= 50) return "buena";
  if (ica <= 100) return "aceptable";
  if (ica <= 150) return "danina-sensibles";
  if (ica <= 200) return "danina";
  if (ica <= 300) return "muy-danina";
  return "peligrosa";
}

function Kpi({ titulo, valor, unidad, detalle, color }: { titulo: string; valor: string; unidad?: string; detalle: string; color?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#E3EAF3] px-4 py-3.5">
      <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[#475569]">
        {color && <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color }} />}
        {titulo}
      </span>
      <span className="font-mono text-[30px] font-semibold leading-none text-[#0F172A]">
        {valor}
        {unidad && <span className="ml-1 text-[13px] font-normal text-[#475569]">{unidad}</span>}
      </span>
      <span className="text-[11.5px] text-[#475569]">{detalle}</span>
    </div>
  );
}

function KpiEstacion({ titulo, estacion }: { titulo: string; estacion: EstacionResumen | null }) {
  if (!estacion) return <Kpi titulo={titulo} valor="—" detalle="sin lecturas válidas" />;
  const cat = CATEGORIAS[estacion.categoria];
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#E3EAF3] px-4 py-3.5">
      <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[#475569]">
        <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: cat.color }} />
        {titulo}
      </span>
      <span className="font-mono text-[30px] font-semibold leading-none text-[#0F172A]">
        {estacion.pm25 === null ? "—" : decimal(estacion.pm25)}
        <span className="ml-1 text-[13px] font-normal text-[#475569]">µg/m³</span>
      </span>
      <span className="truncate text-[12px] font-semibold text-[#0F172A]" title={estacion.nombre}>
        #{estacion.codigo} · {estacion.sitio || estacion.nombre}
      </span>
      <span className="text-[11.5px] text-[#475569]">
        {estacion.municipio} · ICA {estacion.ica ?? "—"} · {cat.texto}
      </span>
    </div>
  );
}

function FilaEstacion({ e }: { e: EstacionSiata }) {
  const cat = CATEGORIAS[e.categoria];
  return (
    <tr className="border-t border-[#E3EAF3] align-middle">
      <td className="px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-[#0F172A]" title={e.nombre}>
            #{e.codigo} · {e.sitio || e.nombre}
          </span>
          <span className="text-[11px] text-[#475569]">
            {e.comuna ? `${e.comuna} · ` : ""}
            {e.tipoEstacion ?? (e.capa === "trafico" ? "Tráfico" : "Poblacional")}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-[#475569]">{e.municipio}</td>
      <td className="px-3 py-2 text-right font-mono text-[#0F172A]">{e.pm25 === null ? "—" : decimal(e.pm25)}</td>
      <td className="px-3 py-2 text-right font-mono text-[#0F172A]">{e.ica ?? "—"}</td>
      <td className="px-3 py-2">
        <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: cat.fondo, color: cat.tinta }}>
          {cat.corto}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-[11.5px] text-[#475569]">
        {horaColombia(e.actualizado)} · {haceCuanto(e.minutosDesde)}
        {e.obsoleta ? " · sin actualizar" : ""}
      </td>
    </tr>
  );
}

function KpisCargando() {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse flex-col gap-2 rounded-2xl border border-[#E3EAF3] px-4 py-3.5">
          <span className="h-2.5 w-2/3 rounded bg-[#E3EAF3]" />
          <span className="h-7 w-1/2 rounded bg-[#E3EAF3]" />
          <span className="h-2.5 w-3/4 rounded bg-[#E3EAF3]" />
        </div>
      ))}
    </div>
  );
}

function FilasCargando() {
  return (
    <>
      {["70%", "55%", "80%", "60%", "65%"].map((w, i) => (
        <tr key={i} className="animate-pulse border-t border-[#E3EAF3]" aria-hidden="true">
          <td className="px-3 py-2.5">
            <span className="block h-2.5 rounded bg-[#E3EAF3]" style={{ width: w }} />
          </td>
          <td className="px-3 py-2.5">
            <span className="block h-2.5 w-3/4 rounded bg-[#E3EAF3]" />
          </td>
          <td className="px-3 py-2.5">
            <span className="ml-auto block h-2.5 w-1/2 rounded bg-[#E3EAF3]" />
          </td>
          <td className="px-3 py-2.5">
            <span className="ml-auto block h-2.5 w-1/2 rounded bg-[#E3EAF3]" />
          </td>
          <td className="px-3 py-2.5">
            <span className="block h-2.5 w-2/3 rounded bg-[#E3EAF3]" />
          </td>
          <td className="px-3 py-2.5">
            <span className="block h-2.5 w-3/4 rounded bg-[#E3EAF3]" />
          </td>
        </tr>
      ))}
    </>
  );
}

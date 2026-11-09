"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnapshotSiata, SnapshotSiataOk, EstacionSiata } from "@/lib/aire";
import type { Gravedad } from "@/lib/monitoreo/esquemas";
import { GRAVEDADES } from "@/lib/monitoreo/esquemas";
import type { ComunasGeo, Snapshot } from "@/lib/monitoreo/fuentes";
import type { RejillaHurto, RejillaIncidentes, RejillaVictimas } from "@/lib/monitoreo/esquemas";
import { valoresRejilla, valoresRejillaVictimas } from "@/lib/monitoreo/metricas";
import { comunaPorCodigo } from "@/lib/territorio";
import type { DatosMundo } from "../../datos";
import { miles } from "../../areas";
import { CAPAS, CONDICIONES_UI, construirVista, DIAS_CORTOS, FILTROS_INICIALES, FRANJAS, horasDeFranja, MEDIDAS_UI, totalCon, totalFranja, type Capa, type Filtros, type Tablas } from "./capas";
import type { Estado3D } from "./Comunas3D";
import Comunas3DVista from "./Comunas3DVista";
import EnPreparacion from "./EnPreparacion";
import Chips, { type OpcionChip } from "./Filtros";
import { colorSecuencial } from "./escala";
import { fechaCorte, fechaCortaColombia, horaColombia, textoLicencia } from "./formato";
import Fuente from "./Fuente";
import MapaComunasSvg, { prepararGeometria } from "./MapaComunasSvg";
import MapaEstacionesSvg from "./MapaEstacionesSvg";
import TablaComunas from "./TablaComunas";

type Vista = "tabla" | "mapa" | "3d";
type Carga<T> = { estado: "cargando" } | { estado: "error"; hora: string } | { estado: "listo"; datos: T };

interface Rejillas {
  incidentes: RejillaIncidentes | null;
  victimas: RejillaVictimas | null;
  hurto: RejillaHurto | null;
}

/** Interruptor de emergencia del plan: si la escena 3D falla el martes, se pone en false y queda el SVG. */
const TRES_D_DISPONIBLE = true;

/** La vista 3D es la de arranque solo con puntero fino, pantalla ≥ 768 px y sin movimiento reducido. */
function vistaInicial(): Vista {
  if (typeof window === "undefined" || !TRES_D_DISPONIBLE) return "mapa";
  const fino = matchMedia("(pointer: fine)").matches;
  const ancha = matchMedia("(min-width: 768px)").matches;
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return fino && ancha && !reducido ? "3d" : "mapa";
}

/**
 * Comunas: hurto a persona, incidentes y víctimas viales por comuna con filtros (capa · año · franja · usuario
 * vial / gravedad · modalidad) sobre los agregados de MEData con supresión n<5. Vista base tabla + barras;
 * coropleta SVG; Medellín 3D de datos con columnas de 250 m y faros SIATA.
 */
export default function PestanaComunas({ datos }: { datos: DatosMundo }) {
  void datos;
  const [tablas, setTablas] = useState<Carga<Tablas>>({ estado: "cargando" });
  const [geo, setGeo] = useState<Carga<Snapshot<ComunasGeo>>>({ estado: "cargando" });
  const [siata, setSiata] = useState<Carga<SnapshotSiataOk> | null>(null);
  const [rejillas, setRejillas] = useState<Carga<Rejillas> | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [mostrarEstaciones, setMostrarEstaciones] = useState(false);
  const [fallo3d, setFallo3d] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const hora = () => new Date().toISOString();
    fetch("/api/monitoreo/tablas", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { ok: true } & Tablas;
        if (vivo) setTablas({ estado: "listo", datos: { incidentes: j.incidentes, victimas: j.victimas, hurto: j.hurto } });
      })
      .catch(() => vivo && setTablas({ estado: "error", hora: hora() }));
    fetch("/api/monitoreo/comunas", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Snapshot<ComunasGeo> | { ok: false };
        if (!j.ok) throw new Error("sin geometría");
        if (vivo) setGeo({ estado: "listo", datos: j });
      })
      .catch(() => vivo && setGeo({ estado: "error", hora: hora() }));
    return () => {
      vivo = false;
    };
  }, []);

  const quiereSiata = vista === "3d" || mostrarEstaciones;
  useEffect(() => {
    if (!quiereSiata || siata !== null) return;
    let vivo = true;
    fetch("/api/siata", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as SnapshotSiata;
        if (!j.ok) throw new Error(j.error);
        if (vivo) setSiata({ estado: "listo", datos: j });
      })
      .catch(() => vivo && setSiata({ estado: "error", hora: new Date().toISOString() }));
    return () => {
      vivo = false;
    };
  }, [quiereSiata, siata]);

  useEffect(() => {
    if (vista !== "3d" || rejillas !== null) return;
    let vivo = true;
    fetch("/api/monitoreo/rejillas", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { ok: true } & Rejillas;
        if (vivo) setRejillas({ estado: "listo", datos: { incidentes: j.incidentes, victimas: j.victimas, hurto: j.hurto } });
      })
      .catch(() => vivo && setRejillas({ estado: "error", hora: new Date().toISOString() }));
    return () => {
      vivo = false;
    };
  }, [vista, rejillas]);

  const t = tablas.estado === "listo" ? tablas.datos : null;
  // mientras no haya respuesta, la carga está en curso (sin setState síncrono dentro del efecto)
  const rejillasCargando = vista === "3d" && rejillas === null;
  const vistaCapa = useMemo(() => (t ? construirVista(t, filtros) : null), [t, filtros]);
  const geometria = useMemo(() => (geo.estado === "listo" ? prepararGeometria(geo.datos.datos.features) : null), [geo]);
  const estaciones: EstacionSiata[] | null = siata?.estado === "listo" ? siata.datos.estaciones : null;

  /* chips */
  const capasChips = useMemo<OpcionChip<Capa>[]>(
    () =>
      CAPAS.map((c) => {
        const total = t ? totalCon(t, filtros, { capa: c.clave, anio: "todos", franja: "todas", gravedad: "todas", condicion: "todas", medida: "n", modalidad: "todas" }) : null;
        return { clave: c.clave, texto: c.texto, n: total ?? undefined, deshabilitado: !t || total === null };
      }),
    [t, filtros],
  );
  const aniosChips = useMemo<OpcionChip<string>[]>(() => {
    if (!t || !vistaCapa) return [];
    return [
      { clave: "todos", texto: "Todos los años", n: totalCon(t, filtros, { anio: "todos" }) ?? undefined },
      ...vistaCapa.anios.map((a) => ({ clave: String(a), texto: String(a), n: totalCon(t, filtros, { anio: a }) ?? undefined })),
    ];
  }, [t, filtros, vistaCapa]);
  const franjasChips = useMemo<OpcionChip<Filtros["franja"]>[]>(
    () =>
      FRANJAS.map((f) => {
        const n = t ? totalFranja(t, filtros.capa, f.clave) : null;
        return { clave: f.clave, texto: f.texto, n: n ?? undefined, deshabilitado: filtros.capa === "victimas" };
      }),
    [t, filtros.capa],
  );
  const gravedadChips = useMemo<OpcionChip<Gravedad | "todas">[]>(
    () =>
      t
        ? [
            { clave: "todas", texto: "Toda gravedad", n: totalCon(t, filtros, { gravedad: "todas", franja: "todas" }) ?? undefined },
            ...GRAVEDADES.map((g) => ({ clave: g, texto: g, n: totalCon(t, filtros, { gravedad: g, franja: "todas" }) ?? undefined })),
          ]
        : [],
    [t, filtros],
  );
  const condicionChips = useMemo<OpcionChip<Filtros["condicion"]>[]>(
    () => (t ? CONDICIONES_UI.map((c) => ({ clave: c.clave, texto: c.texto, n: totalCon(t, filtros, { condicion: c.clave }) ?? undefined })) : []),
    [t, filtros],
  );
  const medidaChips = useMemo<OpcionChip<Filtros["medida"]>[]>(
    () => (t ? MEDIDAS_UI.map((m) => ({ clave: m.clave, texto: m.texto, n: totalCon(t, filtros, { medida: m.clave }) ?? undefined })) : []),
    [t, filtros],
  );
  const modalidadChips = useMemo<OpcionChip<string>[]>(() => {
    if (!t || !vistaCapa) return [];
    return [
      { clave: "todas", texto: "Toda modalidad", n: totalCon(t, filtros, { modalidad: "todas" }) ?? undefined },
      ...vistaCapa.modalidades.map((m) => ({ clave: m, texto: m, n: totalCon(t, filtros, { modalidad: m }) ?? undefined })),
    ];
  }, [t, filtros, vistaCapa]);

  /* estado de la escena 3D */
  const estado3d = useMemo<Estado3D | null>(() => {
    if (!vistaCapa) return null;
    const r = rejillas?.estado === "listo" ? rejillas.datos[filtros.capa] : null;
    let celdas: Estado3D["celdas"] = null;
    if (r) {
      const resumen =
        filtros.capa === "victimas"
          ? valoresRejillaVictimas((r as RejillaVictimas).celdas, {
              condicion: filtros.condicion === "todas" ? undefined : filtros.condicion,
              gravedad: filtros.medida === "n" ? undefined : filtros.medida,
            })
          : valoresRejilla((r as RejillaIncidentes | RejillaHurto).celdas);
      celdas = {
        celdas: resumen.celdas,
        maximo: resumen.maximo,
        grados: r.resolucion.grados,
        unidad: vistaCapa.unidad,
        periodo: `${r.fuente.periodo.desde?.slice(0, 4) ?? "?"} → ${r.fuente.periodo.hasta?.slice(0, 4) ?? "?"}`,
        fuente: `MEData ${r.fuente.id}`,
      };
    }
    return {
      comunas: {
        valores: new Map(vistaCapa.resumen.porComuna.map((v) => [v.codigo, v])),
        maximo: vistaCapa.resumen.maximo,
        unidad: vistaCapa.unidad,
        titulo: vistaCapa.titulo,
        periodo: vistaCapa.periodo,
        fuente: `MEData ${vistaCapa.fuente.id}`,
      },
      celdas,
      estaciones,
      seleccion,
    };
  }, [vistaCapa, rejillas, filtros.capa, filtros.condicion, filtros.medida, estaciones, seleccion]);

  const cambiar = (c: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...c }));
  const cambiarCapa = (capa: Capa) => setFiltros({ ...FILTROS_INICIALES, capa });
  const vistaEfectiva: Vista = vista === "3d" && (fallo3d || !TRES_D_DISPONIBLE) ? "mapa" : vista;
  const nombreSeleccion = seleccion ? comunaPorCodigo(seleccion)?.nombre : null;
  const valorSeleccion = seleccion && vistaCapa ? vistaCapa.resumen.porComuna.find((v) => v.codigo === seleccion) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl font-extrabold tracking-tight text-[#1E3A5F]">Comunas: la Medellín de datos</h2>
        <p className="m-0 max-w-[72ch] text-[13.5px] text-[#475569]">
          Conteos agregados por comuna y corregimiento a partir de los conjuntos de MEData, con supresión de conteos menores a 5.
          Elige la capa y los filtros; la tabla, el mapa y la ciudad 3D muestran exactamente las mismas cifras.
        </p>
      </div>

      {tablas.estado === "cargando" && <CargandoBloque texto="La Operadora está leyendo los agregados de MEData…" />}
      {tablas.estado === "error" && (
        <div className="flex flex-col gap-1 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3" role="alert">
          <span className="text-sm font-bold text-[#B91C1C]">No fue posible leer los agregados a las {horaColombia(tablas.hora)}.</span>
          <span className="text-[12.5px] text-[#475569]">La ruta /api/monitoreo/tablas no respondió. Vuelve a abrir la pestaña en unos minutos.</span>
        </div>
      )}

      {t && (
        <>
          {/* Filtros */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#E3EAF3] bg-[#F8FAFC] p-3.5">
            <Chips etiqueta="Capa" opciones={capasChips} valor={filtros.capa} onChange={cambiarCapa} />
            {vistaCapa ? (
              <>
                <Chips etiqueta="Año" opciones={aniosChips} valor={filtros.anio === "todos" ? "todos" : String(filtros.anio)} onChange={(a) => cambiar({ anio: a === "todos" ? "todos" : Number(a) })} />
                <Chips etiqueta="Franja horaria" opciones={franjasChips} valor={filtros.franja} onChange={(franja) => cambiar({ franja })} />
                {filtros.capa === "incidentes" && <Chips etiqueta="Gravedad" opciones={gravedadChips} valor={filtros.gravedad} onChange={(gravedad) => cambiar({ gravedad })} />}
                {filtros.capa === "victimas" && (
                  <>
                    <Chips etiqueta="Usuario vial" opciones={condicionChips} valor={filtros.condicion} onChange={(condicion) => cambiar({ condicion })} />
                    <Chips etiqueta="Gravedad" opciones={medidaChips} valor={filtros.medida} onChange={(medida) => cambiar({ medida })} />
                  </>
                )}
                {filtros.capa === "hurto" && <Chips etiqueta="Modalidad" opciones={modalidadChips} valor={filtros.modalidad} onChange={(modalidad) => cambiar({ modalidad })} />}
              </>
            ) : (
              <span className="text-[12.5px] text-[#475569]">Esta capa no pasó la validación de privacidad y no se muestra.</span>
            )}
          </div>

          {!vistaCapa && (
            <EnPreparacion
              titulo={`${CAPAS.find((c) => c.clave === filtros.capa)?.texto ?? "Capa"} en preparación`}
              detalle="El agregado de este conjunto no está disponible o fue rechazado por la validación (conteos entre 1 y 4). Elige otra capa."
              bloques={["Tabla por comuna", "Mapa por comunas", "Ciudad 3D"]}
            />
          )}

          {vistaCapa && (
            <>
              {/* Línea didáctica */}
              <div className="flex flex-col gap-1 rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3">
                <span className="text-[13.5px] font-bold text-[#1E3A5F]">Qué estás viendo · {vistaCapa.titulo}</span>
                <span className="text-[12.5px] leading-relaxed text-[#0F172A]">{vistaCapa.explicacion}</span>
                <span className="font-mono text-[11.5px] text-[#475569]">
                  Fuente: {vistaCapa.fuente.nombre} (MEData {vistaCapa.fuente.id}) · corte {fechaCorte(vistaCapa.fuente.fechaCorte)} · {miles(vistaCapa.resumen.total)}{" "}
                  {vistaCapa.unidad} publicados en {vistaCapa.resumen.comunasConDato} comunas
                  {vistaCapa.resumen.suprimidas ? ` · ${vistaCapa.resumen.suprimidas} conteos suprimidos (<5)` : ""}
                </span>
                {vistaCapa.nota && <span className="text-[12px] text-[#B45309]">{vistaCapa.nota}</span>}
              </div>

              {/* Selector de vista + selección */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Vista">
                  {(
                    [
                      ["tabla", "Tabla"],
                      ["mapa", "Mapa 2D"],
                      ["3d", "Ver en 3D"],
                    ] as [Vista, string][]
                  ).map(([v, texto]) => {
                    const oculto = v === "3d" && !TRES_D_DISPONIBLE;
                    if (oculto) return null;
                    const activa = vistaEfectiva === v;
                    const sinGeo = v !== "tabla" && geo.estado !== "listo";
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={activa}
                        disabled={sinGeo || (v === "3d" && !!fallo3d)}
                        onClick={() => setVista(v)}
                        className={`rounded-xl px-3.5 py-2 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          activa ? "bg-[#2563EB] text-white" : "bg-[#F4F7FB] text-[#1E3A5F] hover:bg-[#E3EAF3]"
                        }`}
                      >
                        {texto}
                      </button>
                    );
                  })}
                  {vistaEfectiva !== "tabla" && (
                    <button
                      type="button"
                      aria-pressed={mostrarEstaciones}
                      onClick={() => setMostrarEstaciones((m) => !m)}
                      className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                        mostrarEstaciones ? "bg-[#1E3A5F] text-white" : "border border-[#E3EAF3] bg-white text-[#1E3A5F] hover:bg-[#F4F7FB]"
                      }`}
                    >
                      Estaciones SIATA {siata?.estado === "listo" ? `(${siata.datos.estaciones.length})` : ""}
                    </button>
                  )}
                </div>
                {seleccion && (
                  <button
                    type="button"
                    onClick={() => setSeleccion(null)}
                    className="rounded-full border border-[#2563EB] bg-white px-3 py-1 text-[12px] font-semibold text-[#2563EB]"
                  >
                    Comuna {seleccion} · {nombreSeleccion}: {valorSeleccion?.valor === null || valorSeleccion === undefined ? "sin dato" : valorSeleccion.valor === 0 && valorSeleccion.incompleto ? "<5" : miles(valorSeleccion.valor)}{" "}
                    {vistaCapa.unidad} · quitar ✕
                  </button>
                )}
              </div>

              {/* Avisos de geometría / SIATA / rejilla */}
              {geo.estado === "error" && (
                <p className="m-0 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#B45309]" role="status">
                  La geometría de comunas no respondió a las {horaColombia(geo.hora)}; la tabla sigue disponible.
                </p>
              )}
              {geo.estado === "listo" && geo.datos.guardado && vistaEfectiva !== "tabla" && (
                <p className="m-0 text-[11.5px] text-[#B45309]" role="status">
                  Geometría: copia guardada del {fechaCortaColombia(geo.datos.capturado)} (ArcGIS no respondió a las {horaColombia(geo.datos.consultado)}).
                </p>
              )}
              {quiereSiata && siata?.estado === "error" && (
                <p className="m-0 text-[11.5px] text-[#B45309]" role="status">
                  SIATA no respondió a las {horaColombia(siata.hora)}: las estaciones no se dibujan.
                </p>
              )}
              {fallo3d && (
                <p className="m-0 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#B45309]" role="status">
                  La vista 3D no pudo iniciarse ({fallo3d}); se muestra el mapa 2D con las mismas cifras.
                </p>
              )}

              {/* Vista principal */}
              {vistaEfectiva === "mapa" && geometria && (
                <MapaComunasSvg
                  geometria={geometria}
                  resumen={vistaCapa.resumen}
                  unidad={vistaCapa.unidad}
                  periodo={vistaCapa.periodo}
                  seleccion={seleccion}
                  onSeleccionar={setSeleccion}
                >
                  {mostrarEstaciones && estaciones && <MapaEstacionesSvg estaciones={estaciones} proyeccion={geometria.proyeccion} />}
                </MapaComunasSvg>
              )}
              {vistaEfectiva === "3d" && geo.estado === "listo" && estado3d && (
                <>
                  <Comunas3DVista geo={geo.datos.datos.features} estado={estado3d} onSeleccionar={setSeleccion} onFallo={(m) => setFallo3d(m)} />
                  {rejillasCargando && <span className="text-[11.5px] text-[#475569]">Descargando la rejilla de 250 m…</span>}
                  {rejillas?.estado === "error" && (
                    <span className="text-[11.5px] text-[#B45309]">La rejilla de 250 m no respondió a las {horaColombia(rejillas.hora)}; se muestran solo las comunas.</span>
                  )}
                </>
              )}

              {/* Mapa de calor día × hora (hurto) */}
              {vistaCapa.diaHora && <MapaCalorDiaHora matriz={vistaCapa.diaHora} franja={filtros.franja} />}

              {/* Tabla base, siempre */}
              <TablaComunas resumen={vistaCapa.resumen} unidad={vistaCapa.unidad} seleccion={seleccion} onSeleccionar={setSeleccion} />

              <div className="flex flex-col gap-1.5">
                <Fuente
                  nombre={`${vistaCapa.fuente.nombre} (MEData ${vistaCapa.fuente.id}, ${vistaCapa.fuente.publicador})`}
                  licencia={textoLicencia(vistaCapa.fuente.licencia)}
                  lectura={vistaCapa.fuente.fechaCorte ? `${vistaCapa.fuente.fechaCorte}T12:00:00Z` : null}
                  enlace={vistaCapa.fuente.url}
                  nota={`${miles(vistaCapa.fuente.filasLeidas)} filas leídas · agregado por scripts-dev/agregados.py · conteos 1–4 suprimidos`}
                />
                {geo.estado === "listo" && vistaEfectiva !== "tabla" && (
                  <Fuente
                    nombre={geo.datos.fuente.nombre}
                    licencia={textoLicencia(geo.datos.fuente.licencia)}
                    lectura={geo.datos.capturado}
                    consultado={geo.datos.consultado}
                    enlace={geo.datos.fuente.pagina}
                    nota={geo.datos.guardado ? "copia guardada; geometría de referencia" : "geometría de referencia"}
                  />
                )}
                {quiereSiata && siata?.estado === "listo" && (
                  <Fuente
                    nombre="SIATA – Área Metropolitana del Valle de Aburrá (capas 602/603 del visor)"
                    licencia="no declarada"
                    lectura={siata.datos.lectura}
                    consultado={siata.datos.consultado}
                    enlace="https://siata.gov.co/"
                    nota={siata.datos.guardado ? `copia guardada del ${siata.datos.capturado ? fechaCortaColombia(siata.datos.capturado) : "—"}` : "uso académico con atribución"}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Mapa de calor 7 × 24 de hurtos en la ciudad (día de la semana × hora), resaltando la franja activa. */
function MapaCalorDiaHora({ matriz, franja }: { matriz: { dia: number; hora: number; valor: number | null }[][]; franja: Filtros["franja"] }) {
  const maximo = Math.max(0, ...matriz.flat().map((c) => c.valor ?? 0));
  const [desde, hasta] = horasDeFranja(franja);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-[#1E3A5F]">Casos por día de la semana y hora · toda la ciudad</span>
      <div className="overflow-x-auto rounded-xl border border-[#E3EAF3] p-2">
        <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: "34px repeat(24, minmax(0, 1fr))" }} role="table" aria-label="Mapa de calor día por hora">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className={`text-center font-mono text-[9.5px] ${h >= desde && h <= hasta && franja !== "todas" ? "font-bold text-[#1E3A5F]" : "text-[#64748B]"}`}>
              {h}
            </span>
          ))}
          {matriz.map((fila, d) => (
            <FilaCalor key={d} dia={d} fila={fila} maximo={maximo} desde={desde} hasta={hasta} resaltar={franja !== "todas"} />
          ))}
        </div>
      </div>
      <span className="text-[11px] text-[#475569]">
        Máximo de una celda: {miles(maximo)} casos. Describe cuándo se reportan más hurtos en la ciudad, no dónde.
      </span>
    </div>
  );
}

function FilaCalor({ dia, fila, maximo, desde, hasta, resaltar }: { dia: number; fila: { hora: number; valor: number | null }[]; maximo: number; desde: number; hasta: number; resaltar: boolean }) {
  return (
    <>
      <span className="font-mono text-[10px] text-[#475569]">{DIAS_CORTOS[dia]}</span>
      {fila.map((c) => {
        const fuera = resaltar && (c.hora < desde || c.hora > hasta);
        return (
          <span
            key={c.hora}
            className="aspect-square rounded-[3px]"
            style={{ background: c.valor === null ? "#F1F5F9" : colorSecuencial(maximo ? c.valor / maximo : 0), opacity: fuera ? 0.25 : 1 }}
            title={`${DIAS_CORTOS[dia]} ${c.hora}:00 · ${c.valor === null ? "<5" : miles(c.valor)} casos`}
          />
        );
      })}
    </>
  );
}

function CargandoBloque({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite" aria-busy="true">
      <div className="h-24 animate-pulse rounded-2xl bg-[#F1F5F9]" />
      <div className="h-[320px] animate-pulse rounded-xl bg-[#F1F5F9]" />
      <span className="text-[12.5px] text-[#475569]">{texto}</span>
    </div>
  );
}

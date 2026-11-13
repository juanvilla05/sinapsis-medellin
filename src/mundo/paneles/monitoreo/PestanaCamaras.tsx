"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SnapshotCamaras } from "@/lib/camaras-fuentes";
import { FotoCamara, useMinuto } from "@/pulso/camaras/FotoCamara";
import { ROTULO_FUENTE, ROTULO_TIPO } from "@/pulso/camaras/constantes";
import type { CamaraPulso, FuenteCamara, TipoCamara } from "@/pulso/tipos";
import { miles } from "../../areas";
import Chips, { type OpcionChip } from "./Filtros";
import Fuente from "./Fuente";
import { fechaCortaColombia, horaColombia } from "./formato";

type Estado = "cargando" | "error" | "listo";
type FiltroTipo = TipoCamara | "todas";
type FiltroFuente = FuenteCamara | "todas";

/** Cuántas cámaras se muestran de entrada y con cada "ver más": cada foto pesa entre 80 y 300 KB y se renueva cada minuto. */
const PAGINA = 12;
const TIPOS: TipoCamara[] = ["via", "agua", "panoramica"];
const COLOR_TIPO: Record<TipoCamara, { color: string; fondo: string; tinta: string }> = {
  via: { color: "#7C3AED", fondo: "#F3E8FF", tinta: "#5B21B6" },
  agua: { color: "#0891B2", fondo: "#CFFAFE", tinta: "#155E75" },
  panoramica: { color: "#DB2777", fondo: "#FCE7F3", tinta: "#9D174D" },
};

class ErrorServidor extends Error {}

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Cámaras públicas en vivo de Medellín y el Valle de Aburrá: circuito cerrado de la Secretaría de Movilidad (SIMM)
 * y cámaras de SIATA. Las fotos se piden directo a la fuente y se renuevan cada minuto; PULSO no guarda ninguna.
 */
export default function PestanaCamaras() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [snapshot, setSnapshot] = useState<SnapshotCamaras | null>(null);
  const [errorRed, setErrorRed] = useState<string | null>(null);
  const [falloA, setFalloA] = useState<string | null>(null);
  const [tipo, setTipo] = useState<FiltroTipo>("todas");
  const [fuente, setFuente] = useState<FiltroFuente>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [cuantas, setCuantas] = useState(PAGINA);
  const [elegida, setElegida] = useState<string | null>(null);
  const [vista, setVista] = useState(0);
  /** minuto en el que se pausó la renovación; null = las fotos se renuevan solas */
  const [pausadoEn, setPausadoEn] = useState<number | null>(null);
  const minutoActual = useMinuto();
  const minuto = pausadoEn ?? minutoActual;
  const visorRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setErrorRed(null);
    try {
      const r = await fetch("/api/camaras", { cache: "no-store" });
      // un 500 de Next llega como HTML: no intentar parsearlo ni mostrar el error del navegador
      if (!r.ok || !r.headers.get("content-type")?.includes("application/json")) {
        throw new ErrorServidor(`El servidor no respondió (HTTP ${r.status})`);
      }
      setSnapshot((await r.json()) as SnapshotCamaras);
      setEstado("listo");
    } catch (e) {
      setErrorRed(e instanceof ErrorServidor ? e.message : "Sin conexión con el servidor");
      setFalloA(new Date().toISOString());
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    // primera consulta al abrir la pestaña
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia la carga asíncrona del listado de cámaras
    cargar();
  }, [cargar]);

  /** de norte a sur, para recorrer el valle en orden */
  const camaras = useMemo(() => [...(snapshot?.camaras ?? [])].sort((a, b) => b.lat - a.lat || a.nombre.localeCompare(b.nombre, "es")), [snapshot]);

  const deFuente = useMemo(() => (fuente === "todas" ? camaras : camaras.filter((c) => c.fuente === fuente)), [camaras, fuente]);

  const opcionesFuente = useMemo<OpcionChip<FiltroFuente>[]>(
    () => [
      { clave: "todas", texto: "Todas las fuentes", n: camaras.length },
      ...(["simm", "siata"] as const).map((f) => ({ clave: f, texto: ROTULO_FUENTE[f], n: camaras.filter((c) => c.fuente === f).length })),
    ],
    [camaras],
  );
  const opcionesTipo = useMemo<OpcionChip<FiltroTipo>[]>(
    () => [
      { clave: "todas", texto: "Todo", n: deFuente.length },
      ...TIPOS.map((t) => {
        const n = deFuente.filter((c) => c.tipo === t).length;
        return { clave: t, texto: ROTULO_TIPO[t], n, deshabilitado: n === 0, ...COLOR_TIPO[t] };
      }),
    ],
    [deFuente],
  );

  const filtradas = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return deFuente.filter((c) => (tipo === "todas" || c.tipo === tipo) && (!q || sinTildes(`${c.nombre} ${c.direccion ?? ""}`).includes(q)));
  }, [deFuente, tipo, busqueda]);
  const visibles = filtradas.slice(0, cuantas);
  const restantes = filtradas.length - visibles.length;

  const camaraElegida = elegida ? (camaras.find((c) => c.id === elegida) ?? null) : null;

  const elegir = (c: CamaraPulso) => {
    setElegida(c.id);
    setVista(0);
    // el visor queda arriba de la cuadrícula: se lleva a la vista sin animación si la persona la tiene reducida
    requestAnimationFrame(() => {
      const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      visorRef.current?.scrollIntoView({ block: "nearest", behavior: suave ? "smooth" : "auto" });
      visorRef.current?.focus({ preventScroll: true });
    });
  };

  const cambiarFiltro = <T,>(fijar: (v: T) => void) => (v: T) => {
    fijar(v);
    setCuantas(PAGINA);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="m-0 text-xl font-extrabold tracking-tight text-[#1E3A5F]">Medellín en vivo · cámaras públicas</h2>
          <p className="m-0 text-[13.5px] text-[#475569]">
            La última foto de cada cámara del circuito cerrado de la Secretaría de Movilidad y de SIATA: vías, río y quebradas, y la ciudad desde
            lo alto. La fecha y la hora van impresas en cada imagen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPausadoEn((p) => (p === null ? minutoActual : null))}
          aria-pressed={pausadoEn !== null}
          className="shrink-0 self-start rounded-xl bg-[#2563EB] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#1D4FD7]"
        >
          {pausadoEn === null ? "Pausar la renovación" : "Reanudar la renovación"}
        </button>
      </div>

      {/* Avisos de estado */}
      {estado === "error" && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3" role="alert">
          <span className="text-sm font-bold text-[#B91C1C]">No fue posible consultar el listado de cámaras a las {falloA ? horaColombia(falloA) : "—"}.</span>
          <span className="text-[12.5px] text-[#475569]">
            {errorRed ?? "Sin detalle del error."}
            {snapshot ? ` Se conserva el listado de la consulta anterior (${horaColombia(snapshot.consultado)}).` : ""}
          </span>
          <button type="button" onClick={cargar} className="mt-1 self-start rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F]">
            Reintentar
          </button>
        </div>
      )}
      {snapshot?.guardado && (
        <div className="flex flex-col gap-1 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3" role="status">
          <span className="text-sm font-bold text-[#B45309]">
            Una fuente no respondió a las {horaColombia(snapshot.consultado)} · listado guardado del {snapshot.capturado ? fechaCortaColombia(snapshot.capturado) : "—"}
          </span>
          <span className="text-[12.5px] text-[#475569]">{snapshot.aviso ?? ""} Las fotos sí se piden en vivo: alguna cámara puede haber dejado de publicar.</span>
        </div>
      )}

      {/* Filtros */}
      {camaras.length > 0 && (
        <div className="flex flex-col gap-2">
          <Chips etiqueta="Filtrar por fuente" opciones={opcionesFuente} valor={fuente} onChange={cambiarFiltro(setFuente)} />
          <Chips etiqueta="Filtrar por lo que muestran" opciones={opcionesTipo} valor={tipo} onChange={cambiarFiltro(setTipo)} />
          <label className="flex flex-col gap-1 sm:max-w-sm">
            <span className="text-[12px] font-semibold text-[#475569]">Buscar por nombre o dirección</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => cambiarFiltro(setBusqueda)(e.target.value)}
              placeholder="Regional, Cl 30, Poblado…"
              className="rounded-xl border border-[#C9D6E8] bg-white px-3 py-2 text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
            />
          </label>
        </div>
      )}

      {/* Visor de la cámara elegida */}
      {camaraElegida && (
        <div ref={visorRef} tabIndex={-1} aria-label={`Cámara ampliada: ${camaraElegida.nombre}`} className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-[#C9D6E8] bg-[#F4F7FB] p-3 outline-none sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLOR_TIPO[camaraElegida.tipo].tinta }}>
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: COLOR_TIPO[camaraElegida.tipo].color }} />
                {ROTULO_TIPO[camaraElegida.tipo]} · {ROTULO_FUENTE[camaraElegida.fuente]}
              </p>
              <h3 className="m-0 mt-0.5 text-[17px] font-extrabold leading-snug text-[#1E3A5F]">{camaraElegida.nombre}</h3>
              {camaraElegida.direccion && <p className="m-0 text-[13px] text-[#475569]">{camaraElegida.direccion}</p>}
            </div>
            <button type="button" onClick={() => setElegida(null)} className="shrink-0 rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F] hover:bg-[#E3EAF3]">
              Cerrar
            </button>
          </div>
          <div className="mx-auto w-full max-w-3xl">
            <FotoCamara
              foto={camaraElegida.fotos[Math.min(vista, camaraElegida.fotos.length - 1)]!}
              minuto={minuto}
              completa={camaraElegida.tipo === "panoramica"}
              alt={`Última foto de la cámara ${camaraElegida.nombre}${camaraElegida.fotos.length > 1 ? `, vista ${vista + 1} de ${camaraElegida.fotos.length}` : ""}`}
              className="rounded-xl"
            />
            {camaraElegida.fotos.length > 1 && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setVista((v) => (v - 1 + camaraElegida.fotos.length) % camaraElegida.fotos.length)}
                  className="rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F] hover:bg-[#E3EAF3]"
                >
                  Anterior
                </button>
                <p className="m-0 text-[12.5px] text-[#475569]" aria-live="polite">
                  Vista {vista + 1} de {camaraElegida.fotos.length}
                </p>
                <button
                  type="button"
                  onClick={() => setVista((v) => (v + 1) % camaraElegida.fotos.length)}
                  className="rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F] hover:bg-[#E3EAF3]"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cuadrícula */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-bold text-[#1E3A5F]">
            {snapshot ? `${miles(filtradas.length)} ${filtradas.length === 1 ? "cámara" : "cámaras"} · de norte a sur` : "Cámaras"}
          </span>
          <span className="text-[12px] text-[#475569]">{pausadoEn === null ? "Las fotos se renuevan solas cada minuto" : "Renovación en pausa: las fotos no cambian"}</span>
        </div>

        {estado === "cargando" && !snapshot && (
          <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]" aria-label="Cargando cámaras">
            {Array.from({ length: 6 }, (_, k) => (
              <li key={k} className="overflow-hidden rounded-xl border border-[#E3EAF3]">
                <div className="aspect-video animate-pulse bg-[#E3EAF3] motion-reduce:animate-none" />
                <div className="flex flex-col gap-1.5 p-2.5">
                  <div className="h-3.5 w-2/3 rounded bg-[#E3EAF3]" />
                  <div className="h-3 w-1/2 rounded bg-[#F1F5F9]" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {snapshot && filtradas.length === 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-[#E3EAF3] p-5">
            <span className="text-sm font-bold text-[#0F172A]">Ninguna cámara coincide con los filtros.</span>
            <span className="text-[13px] text-[#475569]">Prueba con otra búsqueda o quita un filtro.</span>
          </div>
        )}

        {visibles.length > 0 && (
          <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
            {visibles.map((c) => {
              const activa = c.id === elegida;
              return (
                <li key={c.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => elegir(c)}
                    aria-pressed={activa}
                    className={`block w-full overflow-hidden rounded-xl border bg-white text-left transition-shadow hover:shadow-[0_6px_18px_rgba(30,58,95,.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] motion-reduce:transition-none ${
                      activa ? "border-[#2563EB] ring-2 ring-[#2563EB]/25" : "border-[#E3EAF3]"
                    }`}
                  >
                    <FotoCamara foto={c.fotos[0]!} minuto={minuto} alt="" completa={c.tipo === "panoramica"} />
                    <span className="flex flex-col gap-0.5 p-2.5">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR_TIPO[c.tipo].color }} />
                        <span className="min-w-0 truncate text-[13.5px] font-bold text-[#1E3A5F]">{c.nombre}</span>
                      </span>
                      <span className="truncate text-[12px] text-[#475569]">
                        {c.direccion ?? ROTULO_TIPO[c.tipo]} · {c.fuente === "simm" ? "Movilidad" : "SIATA"}
                        {c.fotos.length > 1 ? ` · ${c.fotos.length} vistas` : ""}
                      </span>
                      <span className="sr-only">Ampliar esta cámara</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {restantes > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setCuantas((n) => n + PAGINA)}
              className="rounded-xl border border-[#C9D6E8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#1E3A5F] hover:bg-[#F4F7FB]"
            >
              Ver {Math.min(PAGINA, restantes)} más
            </button>
            <span className="text-[12px] text-[#475569]">
              Faltan {miles(restantes)}. Se muestran de a {PAGINA} para no gastar datos: cada foto se pide a su fuente.
            </span>
          </div>
        )}
      </div>

      {/* Fuentes */}
      {snapshot && (
        <div className="flex flex-col gap-1">
          {snapshot.fuentes.map((f) => (
            <Fuente
              key={f.clave}
              nombre={`${f.nombre} · ${f.detalle} (${miles(f.camaras)} cámaras)`}
              licencia={f.licencia}
              lectura={snapshot.consultado}
              enlace={f.url}
              nota="la fecha es la del listado; cada foto trae su hora impresa"
            />
          ))}
          <p className="m-0 font-mono text-[11.5px] leading-relaxed text-[#475569]">
            PULSO no guarda ninguna imagen: tu navegador pide cada foto directamente a la fuente. Solo se listan las cámaras de SIATA renovadas en los últimos 45 minutos.
          </p>
        </div>
      )}
    </div>
  );
}

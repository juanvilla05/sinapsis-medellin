"use client";

import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { resumirEstaciones } from "@/lib/aire";
import { emitir, escuchar } from "../bus";
import { useTema } from "../tema";
import type { CapaPulso, EventoPulso } from "../tipos";
import type { EstadoRecorrido, Motor } from "./motor";
import {
  CAPAS_REJILLA,
  esCapaRejilla,
  fechaCorta,
  fechaHoraBogota,
  horaBogota,
  pedirJson,
  prepararComunas,
  prepararRejilla,
  type CapaRejilla,
  type CeldaMapa,
  type ObjetoMapa,
  type Pasada,
  type RespuestaComunas,
  type RespuestaRejillas,
  type RutasMapa,
  type SnapshotSiataOk,
} from "./datos";
import {
  ChipsCapas,
  Girador,
  KpisAire,
  LeyendaAire,
  LeyendaComunas,
  LeyendaRejilla,
  PanelCapas,
  TarjetaDetalle,
  Tooltip,
  foco,
  vidrio,
  type InfoCapa,
} from "./PanelesMapa";

type MotivoError = "webgl" | "teselas" | "carga";
type Fase = "inactivo" | "cargando" | "listo" | "error";

const REFRESCO_AIRE_MS = 5 * 60_000;
const CAPAS_INICIALES: Record<CapaPulso, boolean> = { aire: true, incidentes: false, victimas: false, hurto: false, comunas: false };

/** Descarga perezosa de un recurso JSON del repo; conserva el último dato bueno si una recarga falla. */
function useRecurso<T extends { ok: boolean }>(url: string) {
  const [estado, setEstado] = useState<{ fase: Fase; datos: T | null }>({ fase: "inactivo", datos: null });
  const enCurso = useRef(false);
  const listo = useRef(false);
  const cargar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEstado((e) => ({ fase: "cargando", datos: e.datos }));
    try {
      const datos = await pedirJson<T>(url);
      listo.current = true;
      setEstado({ fase: "listo", datos });
    } catch {
      setEstado((e) => ({ fase: "error", datos: e.datos }));
    } finally {
      enCurso.current = false;
    }
  }, [url]);
  const asegurar = useCallback(() => {
    if (!listo.current) void cargar();
  }, [cargar]);
  return { ...estado, cargar, asegurar };
}

type Seleccion = { tipo: "estacion"; codigo: number } | { tipo: "celda"; celda: CeldaMapa } | { tipo: "comuna"; codigo: string } | null;
type Vuelo = { tipo: "estacion"; codigo: number } | { tipo: "comuna"; codigo: string } | null;

const TEXTO_ERROR: Record<MotivoError, string> = {
  webgl: "Este navegador o dispositivo no tiene WebGL activo, que es lo que dibuja la ciudad en 3D.",
  teselas: "No pudimos descargar la cartografía de OpenFreeMap. Revisa tu conexión e inténtalo de nuevo.",
  carga: "La vista 3D no terminó de cargar.",
};

/**
 * Mapa 3D de Medellín en vivo (MapLibre + deck.gl intercalado), a pantalla completa.
 * Capas reales: aire de SIATA, rejillas de 250 m de MEData y comunas oficiales de GeoMedellín.
 * Se coordina con rutas y PulsoBot solo por el bus (bus.ts).
 */
export default function MapaPulso({ className = "" }: { className?: string }) {
  const contRef = useRef<HTMLDivElement>(null);
  const motorRef = useRef<Motor | null>(null);
  const tema = useTema();
  const temaRef = useRef(tema);
  useEffect(() => {
    temaRef.current = tema;
    motorRef.current?.fijarTema(tema);
  }, [tema]);
  const vueloPendiente = useRef<Vuelo>(null);
  const camaraPendiente = useRef<Extract<EventoPulso, { tipo: "volar" }> | null>(null);
  const recorridoPendiente = useRef<boolean | null>(null);

  const [intento, setIntento] = useState(0);
  const [estadoMapa, setEstadoMapa] = useState<"cargando" | "listo" | "error">("cargando");
  const [motivo, setMotivo] = useState<MotivoError>("carga");
  const [capas, setCapas] = useState(CAPAS_INICIALES);
  const [enFoco, setEnFoco] = useState<CapaPulso | null>("aire");
  const [sel, setSel] = useState<Seleccion>(null);
  const [pasada, setPasada] = useState<Pasada | null>(null);
  const [comunaResaltada, setComunaResaltada] = useState<string | null>(null);
  const [rutas, setRutas] = useState<RutasMapa | null>(null);
  const [recorrido, setRecorrido] = useState<EstadoRecorrido>({ girando: false, permitido: false });
  const [plegado, setPlegado] = useState(false);

  const aire = useRecurso<SnapshotSiataOk>("/api/siata");
  const rejillas = useRecurso<RespuestaRejillas>("/api/monitoreo/rejillas");
  const comunas = useRecurso<RespuestaComunas>("/api/monitoreo/comunas");
  const cargarAire = aire.cargar;
  const { asegurar: asegurarRejillas, cargar: cargarRejillas } = rejillas;
  const { asegurar: asegurarComunas, cargar: cargarComunas } = comunas;

  /* ───────── datos derivados ───────── */
  const estaciones = aire.datos?.estaciones ?? null;
  const resumen = useMemo(() => (estaciones ? resumirEstaciones(estaciones.filter((e) => e.enMedellin)) : null), [estaciones]);
  const rejillasMapa = useMemo(
    () => ({
      incidentes: prepararRejilla("incidentes", rejillas.datos?.incidentes ?? null),
      victimas: prepararRejilla("victimas", rejillas.datos?.victimas ?? null),
      hurto: prepararRejilla("hurto", rejillas.datos?.hurto ?? null),
    }),
    [rejillas.datos],
  );
  const comunasMapa = useMemo(() => prepararComunas(comunas.datos), [comunas.datos]);

  const objetoSel = useMemo<ObjetoMapa | null>(() => {
    if (!sel) return null;
    if (sel.tipo === "celda") return { tipo: "celda", celda: sel.celda };
    if (sel.tipo === "estacion") {
      const e = estaciones?.find((x) => x.codigo === sel.codigo);
      return e ? { tipo: "estacion", estacion: e } : null;
    }
    const c = comunasMapa?.find((x) => x.codigo === sel.codigo);
    return c ? { tipo: "comuna", codigo: c.codigo, nombre: c.nombre } : null;
  }, [sel, estaciones, comunasMapa]);

  const puntoSel = useMemo(() => {
    if (objetoSel?.tipo === "estacion") return { lng: objetoSel.estacion.lng, lat: objetoSel.estacion.lat };
    if (objetoSel?.tipo === "celda") return { lng: objetoSel.celda.lng, lat: objetoSel.celda.lat };
    return null;
  }, [objetoSel]);

  /* ───────── acciones ───────── */
  const cambiarCapa = useCallback(
    (capa: CapaPulso, visible: boolean) => {
      setCapas((prev) => {
        const n = { ...prev, [capa]: visible };
        if (visible && esCapaRejilla(capa)) for (const o of CAPAS_REJILLA) if (o !== capa) n[o] = false;
        return n;
      });
      if (visible) {
        setEnFoco(capa);
        if (esCapaRejilla(capa)) asegurarRejillas();
        if (capa === "comunas") asegurarComunas();
      } else {
        setEnFoco((f) => (f === capa ? null : f));
        setSel((s) => (s?.tipo === "celda" && s.celda.capa === capa ? null : s?.tipo === "comuna" && capa === "comunas" ? null : s));
        if (capa === "comunas") setComunaResaltada(null);
      }
    },
    [asegurarRejillas, asegurarComunas],
  );

  const reintentar = useCallback(
    (capa: CapaPulso) => {
      if (capa === "aire") void cargarAire();
      else if (capa === "comunas") void cargarComunas();
      else void cargarRejillas();
    },
    [cargarAire, cargarComunas, cargarRejillas],
  );

  const preguntar = useCallback((texto: string) => {
    emitir({ tipo: "preguntar", texto });
    emitir({ tipo: "panel", panel: "bot" });
  }, []);

  /* ───────── vuelos que esperan datos o motor ───────── */
  function intentarVuelo() {
    const p = vueloPendiente.current;
    const m = motorRef.current;
    if (!p || !m || estadoMapa !== "listo") return;
    if (p.tipo === "estacion") {
      const e = estaciones?.find((x) => x.codigo === p.codigo);
      if (!e) return;
      m.volar({ lat: e.lat, lng: e.lng, zoom: 14.2, inclinacion: 58 }, true);
    } else {
      const c = comunasMapa?.find((x) => x.codigo === p.codigo);
      if (!c) return;
      m.volar({ lat: c.centro[1], lng: c.centro[0], zoom: c.corregimiento ? 12 : 13.4, inclinacion: 52 }, true);
    }
    vueloPendiente.current = null;
  }
  const resolverVuelo = useEffectEvent(() => intentarVuelo());
  useEffect(() => {
    resolverVuelo();
  }, [estaciones, comunasMapa, estadoMapa]);

  /* ───────── bus ───────── */
  const alEvento = useEffectEvent((e: EventoPulso) => {
    switch (e.tipo) {
      case "volar":
        if (motorRef.current && estadoMapa === "listo") motorRef.current.volar(e);
        else camaraPendiente.current = e;
        break;
      case "comuna":
        setComunaResaltada(e.codigo);
        if (e.codigo) {
          cambiarCapa("comunas", true);
          setSel({ tipo: "comuna", codigo: e.codigo });
          vueloPendiente.current = { tipo: "comuna", codigo: e.codigo };
          intentarVuelo();
        } else setSel((s) => (s?.tipo === "comuna" ? null : s));
        break;
      case "estacion":
        if (e.codigo === null) {
          setSel((s) => (s?.tipo === "estacion" ? null : s));
        } else {
          if (!capas.aire) cambiarCapa("aire", true);
          setSel({ tipo: "estacion", codigo: e.codigo });
          vueloPendiente.current = { tipo: "estacion", codigo: e.codigo };
          intentarVuelo();
        }
        break;
      case "rutas": {
        const elegida = e.elegida ?? e.rutas.find((r) => r.recomendada)?.id ?? e.rutas[0]?.id ?? "";
        setRutas(e.rutas.length ? { rutas: e.rutas, origen: e.origen, destino: e.destino, elegida } : null);
        break;
      }
      case "elegir-ruta":
        setRutas((r) => (r ? { ...r, elegida: e.id } : r));
        break;
      case "limpiar-rutas":
        setRutas(null);
        break;
      case "capa":
        cambiarCapa(e.capa, e.visible);
        break;
      case "recorrido":
        if (motorRef.current && estadoMapa === "listo") motorRef.current.fijarRecorrido(e.activo);
        else recorridoPendiente.current = e.activo;
        break;
    }
  });
  useEffect(() => escuchar((e) => alEvento(e), ["rutas"]), []);

  /* ───────── interacción con el mapa ───────── */
  const alTocar = useEffectEvent((o: ObjetoMapa | null) => {
    if (!o) return setSel(null);
    if (o.tipo === "estacion") setSel({ tipo: "estacion", codigo: o.estacion.codigo });
    else if (o.tipo === "celda") {
      setSel({ tipo: "celda", celda: o.celda });
      asegurarComunas();
    } else if (o.tipo === "comuna") {
      setSel({ tipo: "comuna", codigo: o.codigo });
      setComunaResaltada(o.codigo);
    } else emitir({ tipo: "elegir-ruta", id: o.ruta.id });
  });

  const alListo = useEffectEvent(() => {
    setEstadoMapa("listo");
    asegurarComunas();
  });

  /* ───────── motor (MapLibre + deck.gl), solo en el navegador ───────── */
  useEffect(() => {
    let vivo = true;
    let motor: Motor | null = null;
    const cont = contRef.current;
    if (!cont) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tactil = window.matchMedia("(pointer: coarse)").matches;
    (async () => {
      try {
        const { crearMotor } = await import("./motor");
        if (!vivo) return;
        const m = await crearMotor({
          contenedor: cont,
          tema: temaRef.current,
          reducido,
          tactil,
          alListo: () => vivo && alListo(),
          alFallar: (mot) => {
            if (!vivo) return;
            setMotivo(mot);
            setEstadoMapa("error");
          },
          alPasar: (p) => vivo && setPasada(p),
          alTocar: (o) => vivo && alTocar(o),
          alRecorrido: (r) => vivo && setRecorrido(r),
        });
        if (!vivo) return m.destruir();
        motor = m;
        motorRef.current = m;
      } catch (e) {
        if (!vivo) return;
        const mot = (e as { motivo?: string } | null)?.motivo;
        setMotivo(mot === "webgl" || mot === "teselas" ? mot : "carga");
        setEstadoMapa("error");
      }
    })();
    return () => {
      vivo = false;
      motorRef.current = null;
      motor?.destruir();
    };
  }, [intento]);

  // órdenes que llegaron antes de que el mapa estuviera listo
  useEffect(() => {
    if (estadoMapa !== "listo") return;
    const m = motorRef.current;
    if (!m) return;
    m.fijarTema(temaRef.current);
    if (camaraPendiente.current) {
      m.volar(camaraPendiente.current);
      camaraPendiente.current = null;
    }
    if (recorridoPendiente.current !== null) {
      m.fijarRecorrido(recorridoPendiente.current);
      recorridoPendiente.current = null;
    }
  }, [estadoMapa]);

  // React → motor
  useEffect(() => {
    if (estadoMapa !== "listo") return;
    motorRef.current?.sincronizar({ capas, estaciones, rejillas: rejillasMapa, comunas: comunasMapa, comunaResaltada, seleccion: puntoSel, rutas });
  }, [estadoMapa, capas, estaciones, rejillasMapa, comunasMapa, comunaResaltada, puntoSel, rutas]);

  /* ───────── aire: primera lectura y refresco cada 5 min ───────── */
  useEffect(() => {
    // primera lectura del aire de SIATA (asíncrona)
    void cargarAire();
    const t = window.setInterval(() => {
      if (!document.hidden) void cargarAire();
    }, REFRESCO_AIRE_MS);
    return () => window.clearInterval(t);
  }, [cargarAire]);

  // Escape cierra la tarjeta
  useEffect(() => {
    if (!sel) return;
    const f = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [sel]);

  /* ───────── textos de fuente por capa ───────── */
  const info = useMemo<Record<CapaPulso, InfoCapa>>(() => {
    const snap = aire.datos;
    const corteAire = snap
      ? snap.guardado
        ? `copia guardada del ${fechaHoraBogota(snap.capturado) ?? "—"}`
        : `última lectura ${horaBogota(snap.lectura) ?? "—"}`
      : null;
    const fRej = (c: CapaRejilla): InfoCapa => {
      const r = rejillasMapa[c];
      const fase = rejillas.fase === "listo" && !r ? "vacio" : rejillas.fase;
      return {
        fase,
        fuente: r ? r.fuente.publicador : "MEData · Alcaldía de Medellín",
        corte: r ? `corte ${fechaCorta(r.fuente.fechaCorte ?? r.fuente.periodo.hasta) ?? "no declarado"}` : null,
      };
    };
    const com = comunas.datos;
    return {
      aire: { fase: aire.fase === "listo" && !snap?.estaciones.length ? "vacio" : aire.fase, fuente: "SIATA", corte: corteAire },
      incidentes: fRej("incidentes"),
      victimas: fRej("victimas"),
      hurto: fRej("hurto"),
      comunas: {
        fase: comunas.fase,
        fuente: "GeoMedellín · DAGRD",
        corte: com ? (com.guardado ? `copia guardada del ${fechaHoraBogota(com.capturado) ?? "—"}` : `consultado ${horaBogota(com.consultado) ?? "—"}`) : null,
      },
    };
  }, [aire.datos, aire.fase, rejillasMapa, rejillas.fase, comunas.datos, comunas.fase]);

  const leyendas = useMemo<Partial<Record<CapaPulso, ReactNode>>>(
    () => ({
      aire: <LeyendaAire estaciones={estaciones} />,
      incidentes: rejillasMapa.incidentes ? <LeyendaRejilla rejilla={rejillasMapa.incidentes} /> : null,
      victimas: rejillasMapa.victimas ? <LeyendaRejilla rejilla={rejillasMapa.victimas} /> : null,
      hurto: rejillasMapa.hurto ? <LeyendaRejilla rejilla={rejillasMapa.hurto} /> : null,
      comunas: comunasMapa ? <LeyendaComunas /> : null,
    }),
    [estaciones, rejillasMapa, comunasMapa],
  );
  const leyendasCompactas = useMemo<Partial<Record<CapaPulso, ReactNode>>>(
    () => ({
      aire: <LeyendaAire estaciones={estaciones} compacta />,
      incidentes: rejillasMapa.incidentes ? <LeyendaRejilla rejilla={rejillasMapa.incidentes} compacta /> : null,
      victimas: rejillasMapa.victimas ? <LeyendaRejilla rejilla={rejillasMapa.victimas} compacta /> : null,
      hurto: rejillasMapa.hurto ? <LeyendaRejilla rejilla={rejillasMapa.hurto} compacta /> : null,
      comunas: comunasMapa ? <LeyendaComunas /> : null,
    }),
    [estaciones, rejillasMapa, comunasMapa],
  );

  const pildora = aire.datos
    ? aire.datos.guardado
      ? `Copia guardada del ${fechaHoraBogota(aire.datos.capturado) ?? "—"}`
      : `SIATA · última lectura ${horaBogota(aire.datos.lectura) ?? "—"}`
    : null;

  const alternarRecorrido = () => motorRef.current?.fijarRecorrido(!recorrido.girando);
  const vistaInicial = () => motorRef.current?.vistaInicial();
  const verPeor = () => {
    const c = resumen?.peor?.codigo;
    if (c == null) return;
    setSel({ tipo: "estacion", codigo: c });
    vueloPendiente.current = { tipo: "estacion", codigo: c };
    intentarVuelo();
  };

  const propsCapas = {
    capas,
    info,
    onCambiar: cambiarCapa,
    onReintentar: reintentar,
    recorrido,
    onRecorrido: alternarRecorrido,
    onVista: vistaInicial,
    plegado,
    onPlegar: () => setPlegado((p) => !p),
  };

  return (
    <div className={className}>
      {/* MapLibre fuerza position: relative en su contenedor: por eso va dentro de un envoltorio absoluto */}
      <div className="absolute inset-0">
        <div
          ref={contRef}
          className="h-full w-full bg-fondo [&_.maplibregl-canvas:focus-visible]:outline-2 [&_.maplibregl-canvas:focus-visible]:outline-offset-[-4px] [&_.maplibregl-canvas:focus-visible]:outline-[#7DD3FC] [&_.maplibregl-canvas]:outline-none"
          aria-label="Mapa 3D de Medellín: aire de SIATA, seguridad vial y hurto de MEData, comunas oficiales"
          role="region"
        />
      </div>

      {/* viñeta para que los paneles se lean sobre el mapa */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,var(--vineta)_100%)]" />

      {estadoMapa === "cargando" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-live="polite">
          <div className={`${vidrio} flex items-center gap-3 px-4 py-3 text-[13.5px] text-tinta/85`}>
            <Girador />
            Cargando el mapa de Medellín…
          </div>
        </div>
      )}

      {estadoMapa === "error" && (
        <div className="absolute inset-0 z-10 grid place-items-center px-4" role="alert">
          <div className={`${vidrio} max-w-sm p-5 text-center`}>
            <p className="text-[16px] font-bold">No pudimos mostrar el mapa 3D</p>
            <p className="mt-1.5 text-[13px] text-tinta/70">{TEXTO_ERROR[motivo]}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEstadoMapa("cargando");
                  setIntento((n) => n + 1);
                }}
                className={`rounded-xl bg-tinta/10 px-3.5 py-2 text-[13px] font-semibold hover:bg-tinta/15 ${foco}`}
              >
                Reintentar
              </button>
              <Link href="/monitoreo" className={`rounded-xl bg-[#2563EB] px-3.5 py-2 text-[13px] font-bold hover:bg-[#1D4ED8] ${foco}`}>
                Ver la vista 2D de monitoreo
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* KPIs del aire, debajo de la barra del shell */}
      <div className="absolute inset-x-3 top-[72px] z-10 md:inset-x-auto md:left-4 md:top-[76px] md:w-[360px]">
        <KpisAire
          fase={aire.fase}
          resumen={resumen}
          pildora={pildora}
          guardado={Boolean(aire.datos?.guardado)}
          onPeor={verPeor}
          onReintentar={() => void cargarAire()}
        />
      </div>

      {/* capas: panel abajo-izquierda en escritorio, chips abajo en móvil (deja libre la esquina del bot) */}
      <div className="absolute bottom-8 left-4 z-10 hidden max-h-[calc(100dvh-250px)] w-[300px] md:flex">
        <PanelCapas {...propsCapas} leyendas={leyendas} />
      </div>
      <div className="absolute bottom-3 left-3 right-[76px] z-10 md:hidden">
        <ChipsCapas {...propsCapas} leyendas={leyendasCompactas} foco={enFoco} />
      </div>

      {pasada && !objetoSel && <Tooltip pasada={pasada} rejillas={rejillasMapa} />}

      {objetoSel && (
        <div className="absolute inset-x-3 bottom-[150px] z-10 max-h-[42dvh] overflow-y-auto rounded-2xl md:inset-x-auto md:bottom-8 md:left-[332px] md:max-h-[calc(100dvh-140px)] md:w-[320px]">
          <TarjetaDetalle objeto={objetoSel} rejillas={rejillasMapa} comunas={comunasMapa} onCerrar={() => setSel(null)} onPreguntar={preguntar} />
        </div>
      )}
    </div>
  );
}

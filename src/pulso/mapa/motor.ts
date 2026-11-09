/**
 * Motor imperativo del mapa 3D de PULSO: MapLibre GL (cartografía OpenFreeMap) + deck.gl intercalado.
 * Solo se carga con import() dinámico desde MapaPulso: el resto de la página nunca descarga MapLibre ni deck.gl.
 * No inventa cifras: dibuja lo que React le entrega (SIATA, MEData, GeoMedellín) y la geometría de rutas del bus.
 */
import maplibregl, { type Map as MapaML, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, GeoJsonLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { LayersList, PickingInfo } from "@deck.gl/core";
import type { CapaPulso, PuntoNombrado, RutaPulso } from "../tipos";
import { estiloNocturno, URL_ESTILO_BASE } from "./estilo";
import {
  acumulado,
  colorCategoria,
  colorRampa,
  GRIS_FUERA,
  hexARgba,
  type CapaRejilla,
  type CeldaMapa,
  type ComunaMapa,
  type EstacionSiata,
  type FeatureComuna,
  type ObjetoMapa,
  type Pasada,
  type RejillaMapa,
  type RutasMapa,
} from "./datos";

export const CENTRO = { lng: -75.5736, lat: 6.2442 };
const VISTA = { zoom: 11.6, pitch: 55, bearing: -20 };
const ESPERA_RECORRIDO_MS = 20_000;
const GIRO_GRADOS_POR_MS = 0.0028;
const CRECER_MS = 1100;
const COMETA_MS = 7000;
/** columna de la celda con más casos (tope p99) ≈ 1,3 km */
const ALTURA_TOPE_M = 1300;
const METROS_POR_UG = 55;

export type MotivoFallo = "webgl" | "teselas";
export class FalloMapa extends Error {
  constructor(public motivo: MotivoFallo) {
    super(motivo);
  }
}

export interface EstadoMotor {
  capas: Record<CapaPulso, boolean>;
  estaciones: EstacionSiata[] | null;
  rejillas: Partial<Record<CapaRejilla, RejillaMapa | null>>;
  comunas: ComunaMapa[] | null;
  comunaResaltada: string | null;
  /** punto seleccionado (estación o celda) para dibujar el anillo */
  seleccion: { lng: number; lat: number } | null;
  rutas: RutasMapa | null;
}

export interface EstadoRecorrido {
  girando: boolean;
  permitido: boolean;
}

export interface OpcionesMotor {
  contenedor: HTMLDivElement;
  reducido: boolean;
  tactil: boolean;
  alListo: () => void;
  alFallar: (m: MotivoFallo) => void;
  alPasar: (p: Pasada | null) => void;
  alTocar: (o: ObjetoMapa | null) => void;
  alRecorrido: (e: EstadoRecorrido) => void;
}

export interface Motor {
  sincronizar: (p: Partial<EstadoMotor>) => void;
  /** `conTarjeta`: en móvil deja el punto por encima de la tarjeta de detalle */
  volar: (o: { lat: number; lng: number; zoom?: number; inclinacion?: number; rumbo?: number }, conTarjeta?: boolean) => void;
  vistaInicial: () => void;
  encuadrarRutas: () => void;
  fijarRecorrido: (activo: boolean) => void;
  destruir: () => void;
}

type TripsCtor = (typeof import("@deck.gl/geo-layers"))["TripsLayer"];

interface Trayecto {
  path: [number, number][];
  timestamps: number[];
}
interface Extremo extends PuntoNombrado {
  rol: "origen" | "destino";
}

/** Prueba barata de WebGL antes de descargar teselas. */
export function hayWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const suave = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export async function crearMotor(op: OpcionesMotor): Promise<Motor> {
  const { contenedor, reducido, tactil } = op;
  if (!hayWebGL()) throw new FalloMapa("webgl");

  let estilo: StyleSpecification;
  try {
    const r = await fetch(URL_ESTILO_BASE, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error("estilo");
    estilo = estiloNocturno((await r.json()) as StyleSpecification);
  } catch {
    throw new FalloMapa("teselas");
  }

  const angosto = contenedor.clientWidth < 640;
  const vista = { center: [CENTRO.lng, CENTRO.lat] as [number, number], ...VISTA, zoom: angosto ? 10.9 : VISTA.zoom };
  const pixelRatio = Math.min(window.devicePixelRatio || 1, tactil ? 1.5 : 2);

  let map: MapaML;
  try {
    map = new maplibregl.Map({
      container: contenedor,
      style: estilo,
      center: vista.center,
      zoom: vista.zoom - 1.6,
      pitch: 10,
      bearing: 10,
      minZoom: 8.5,
      maxZoom: 18,
      maxPitch: 72,
      maxBounds: [
        [-76.25, 5.75],
        [-74.95, 6.75],
      ],
      attributionControl: false,
      pixelRatio,
      canvasContextAttributes: { antialias: !tactil },
      locale: { "Map.Title": "Mapa 3D de Medellín" },
      fadeDuration: reducido ? 0 : 300,
    });
  } catch {
    throw new FalloMapa("webgl");
  }

  /* ───────── estado ───────── */
  const st: EstadoMotor = {
    capas: { aire: true, incidentes: false, victimas: false, hurto: false, comunas: false },
    estaciones: null,
    rejillas: {},
    comunas: null,
    comunaResaltada: null,
    seleccion: null,
    rutas: null,
  };
  const crece: Partial<Record<CapaPulso, number>> = {};
  let rutasPrep: { otras: RutaPulso[]; elegida: RutaPulso; trayecto: Trayecto[]; total: number; extremos: Extremo[] } | null = null;
  let Trips: TripsCtor | null = null;
  let pidiendoTrips = false;
  let zoomAlto = false;
  let cargado = false;
  let destruido = false;
  let caido = false;
  let camaraTomada = false;
  let raf = 0;
  let ultimoCuadro = 0;
  let ultimoGiro = 0;

  /* ───────── recorrido cinematográfico ───────── */
  let permitido = !reducido && !tactil;
  let girando = false;
  let temporizador: number | undefined;
  const informar = () => op.alRecorrido({ girando, permitido });
  const programar = () => {
    window.clearTimeout(temporizador);
    if (permitido && !girando) temporizador = window.setTimeout(iniciarGiro, ESPERA_RECORRIDO_MS);
  };
  function iniciarGiro() {
    if (destruido) return;
    if (document.hidden) return programar();
    girando = true;
    ultimoGiro = 0;
    informar();
    pedirCuadro();
  }
  const detenerGiro = () => {
    if (!girando) return;
    girando = false;
    informar();
  };
  const interaccion = () => {
    detenerGiro();
    programar();
  };
  const EVENTOS_INTERACCION = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
  for (const ev of EVENTOS_INTERACCION) contenedor.addEventListener(ev, interaccion, { passive: true });

  /* ───────── fallos ───────── */
  const fallar = (m: MotivoFallo) => {
    if (caido || destruido) return;
    caido = true;
    op.alFallar(m);
  };
  let teselasOk = 0;
  let teselasMal = 0;
  map.on("data", (e) => {
    if (e.dataType === "source" && "tile" in e && e.tile) teselasOk++;
  });
  map.on("error", (e) => {
    const conFuente = "sourceId" in e && Boolean((e as { sourceId?: string }).sourceId);
    if (conFuente) teselasMal++;
    if (!cargado && teselasOk === 0 && teselasMal >= 6) fallar("teselas");
  });
  const vigia = window.setTimeout(() => {
    if (!cargado) fallar("teselas");
  }, 30_000);
  map.getCanvas().addEventListener("webglcontextlost", () => fallar("webgl"));

  /* ───────── deck.gl intercalado ───────── */
  const objetoDe = (info: PickingInfo): ObjetoMapa | null => {
    const id = info.layer?.id ?? "";
    const o = info.object as unknown;
    if (!o) return null;
    if (id === "aire-faros" || id === "aire-base") return { tipo: "estacion", estacion: o as EstacionSiata };
    if (id.startsWith("rejilla-")) return { tipo: "celda", celda: o as CeldaMapa };
    if (id === "comunas") {
      const f = o as FeatureComuna;
      return { tipo: "comuna", codigo: f.properties.codigo, nombre: f.properties.nombre };
    }
    if (id === "rutas-otras" || id === "ruta-elegida") return { tipo: "ruta", ruta: o as RutaPulso };
    return null;
  };

  const overlay = new MapboxOverlay({
    interleaved: true,
    useDevicePixels: pixelRatio,
    layers: [],
    onHover: (info) => {
      const objeto = objetoDe(info);
      map.getCanvas().style.cursor = objeto ? "pointer" : "";
      op.alPasar(objeto ? { x: info.x, y: info.y, objeto } : null);
    },
    onClick: (info) => {
      op.alTocar(objetoDe(info));
    },
  });
  map.addControl(overlay);

  /* ───────── capas ───────── */
  const factorCrecer = (capa: CapaPulso, ahora: number) => {
    const t0 = crece[capa];
    if (reducido || t0 === undefined) return 1;
    const f = suave((ahora - t0) / CRECER_MS);
    if (f >= 1) delete crece[capa];
    return f;
  };

  function capasDeck(ahora: number): LayersList {
    const capas: LayersList = [];
    // al acercarse, las columnas se achican para no tapar la ciudad (altura en pantalla más estable)
    const fz = Math.min(1, Math.pow(2, (12 - map.getZoom()) * 0.8));

    // 5) comunas: relleno tenue, contorno luminoso y nombres en zoom alto
    if (st.capas.comunas && st.comunas) {
      const features = st.comunas.map((c) => c.feature);
      capas.push(
        new GeoJsonLayer<FeatureComuna["properties"]>({
          id: "comunas-brillo",
          data: features,
          filled: false,
          stroked: true,
          getLineColor: [56, 189, 248, 50],
          getLineWidth: 7,
          lineWidthUnits: "pixels",
          parameters: { depthCompare: "always" },
        }),
        new GeoJsonLayer<FeatureComuna["properties"]>({
          id: "comunas",
          data: features,
          filled: true,
          stroked: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [125, 211, 252, 70],
          getFillColor: (f) => (f.properties.codigo === st.comunaResaltada ? [56, 189, 248, 80] : [56, 189, 248, 16]),
          getLineColor: (f) => (f.properties.codigo === st.comunaResaltada ? [224, 242, 254, 255] : [125, 211, 252, 210]),
          getLineWidth: (f) => (f.properties.codigo === st.comunaResaltada ? 3 : 1.3),
          lineWidthUnits: "pixels",
          updateTriggers: { getFillColor: st.comunaResaltada, getLineColor: st.comunaResaltada, getLineWidth: st.comunaResaltada },
          parameters: { depthCompare: "always", depthWriteEnabled: false },
        }),
      );
      if (zoomAlto || st.comunaResaltada) {
        capas.push(
          new TextLayer<ComunaMapa>({
            id: "comunas-nombres",
            data: zoomAlto ? st.comunas : st.comunas.filter((c) => c.codigo === st.comunaResaltada),
            getPosition: (c) => c.centro,
            getText: (c) => c.etiqueta,
            getSize: (c) => (c.codigo === st.comunaResaltada ? 15 : 12.5),
            getColor: (c) => (c.codigo === st.comunaResaltada ? [255, 255, 255, 255] : [203, 225, 245, 230]),
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            fontWeight: 700,
            characterSet: "auto",
            fontSettings: { sdf: true },
            outlineWidth: 3,
            outlineColor: [11, 18, 32, 235],
            updateTriggers: { getSize: st.comunaResaltada, getColor: st.comunaResaltada },
            parameters: { depthCompare: "always" },
          }),
        );
      }
    }

    // 2–4) rejillas de 250 m: una a la vez, altura ∝ √n con tope en el p99
    for (const capa of ["incidentes", "victimas", "hurto"] as const) {
      const rej = st.rejillas[capa];
      if (!st.capas[capa] || !rej) continue;
      const g = factorCrecer(capa, ahora);
      capas.push(
        new ColumnLayer<CeldaMapa>({
          id: `rejilla-${capa}`,
          data: rej.celdas,
          diskResolution: 4,
          angle: 45,
          radius: 150,
          extruded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 140],
          getPosition: (c) => [c.lng, c.lat],
          getElevation: (c) => c.h,
          elevationScale: (ALTURA_TOPE_M / Math.sqrt(rej.tope)) * Math.max(0.001, g) * fz,
          getFillColor: (c) => colorRampa(c.t, 235),
          material: { ambient: 0.55, diffuse: 0.55, shininess: 24, specularColor: [90, 140, 200] },
        }),
      );
    }

    // 1) aire: faros de PM2.5 + pulso
    if (st.capas.aire && st.estaciones) {
      const g = factorCrecer("aire", ahora);
      const conDato = st.estaciones.filter((e) => e.pm25 !== null);
      const enMed = conDato.filter((e) => e.enMedellin);
      const fase = reducido ? 0.35 : (ahora % 2400) / 2400;
      for (const [k, desfase] of [0, 0.5].entries()) {
        const f = (fase + desfase) % 1;
        if (reducido && k > 0) break;
        capas.push(
          new ScatterplotLayer<EstacionSiata>({
            id: `aire-pulso-${k}`,
            data: enMed,
            getPosition: (e) => [e.lng, e.lat],
            getRadius: 260,
            radiusUnits: "meters",
            radiusScale: (1 + 2.2 * f) * Math.max(0.45, fz),
            filled: false,
            stroked: true,
            getLineColor: (e) => colorCategoria(e.categoria, 255),
            lineWidthMinPixels: 1.5,
            lineWidthMaxPixels: 2.5,
            opacity: 0.75 * (1 - f),
            parameters: { depthCompare: "always", depthWriteEnabled: false },
          }),
        );
      }
      capas.push(
        new ScatterplotLayer<EstacionSiata>({
          id: "aire-base",
          data: st.estaciones,
          pickable: true,
          getPosition: (e) => [e.lng, e.lat],
          getRadius: 170,
          radiusUnits: "meters",
          radiusMinPixels: 3,
          getFillColor: (e) => (!e.enMedellin || e.pm25 === null ? GRIS_FUERA : colorCategoria(e.categoria, 150)),
          parameters: { depthCompare: "always", depthWriteEnabled: false },
        }),
        new ColumnLayer<EstacionSiata>({
          id: "aire-faros",
          data: conDato,
          diskResolution: 24,
          radius: 150,
          extruded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 120],
          getPosition: (e) => [e.lng, e.lat],
          getElevation: (e) => e.pm25 ?? 0,
          elevationScale: METROS_POR_UG * Math.max(0.001, g) * fz,
          getFillColor: (e) => (e.enMedellin ? colorCategoria(e.categoria, 240) : GRIS_FUERA),
          material: { ambient: 0.6, diffuse: 0.5, shininess: 40, specularColor: [255, 255, 255] },
        }),
      );
    }

    // anillo de la selección
    if (st.seleccion) {
      capas.push(
        new ScatterplotLayer<{ lng: number; lat: number }>({
          id: "seleccion",
          data: [st.seleccion],
          getPosition: (p) => [p.lng, p.lat],
          getRadius: 330,
          radiusUnits: "meters",
          filled: false,
          stroked: true,
          getLineColor: [255, 255, 255, 235],
          lineWidthMinPixels: 2.5,
          parameters: { depthCompare: "always", depthWriteEnabled: false },
        }),
      );
    }

    // rutas: alternativas, la elegida luminosa, cometa y extremos
    if (rutasPrep) {
      const { otras, elegida, trayecto, total, extremos } = rutasPrep;
      const sinProfundidad = { depthCompare: "always" as const, depthWriteEnabled: false };
      capas.push(
        new PathLayer<RutaPulso>({
          id: "rutas-otras",
          data: otras,
          pickable: true,
          getPath: (r) => r.puntos,
          getColor: (r) => hexARgba(r.color, 170),
          getWidth: 4,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          parameters: sinProfundidad,
        }),
        new PathLayer<RutaPulso>({
          id: "ruta-brillo",
          data: [elegida],
          getPath: (r) => r.puntos,
          getColor: (r) => hexARgba(r.color, 70),
          getWidth: 18,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          parameters: sinProfundidad,
        }),
        new PathLayer<RutaPulso>({
          id: "ruta-elegida",
          data: [elegida],
          pickable: true,
          getPath: (r) => r.puntos,
          getColor: (r) => hexARgba(r.color, 255),
          getWidth: 7,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          parameters: sinProfundidad,
        }),
      );
      if (Trips && !reducido && total > 0) {
        const cola = total * 0.25;
        capas.push(
          new Trips<Trayecto>({
            id: "ruta-cometa",
            data: trayecto,
            getPath: (d) => d.path,
            getTimestamps: (d) => d.timestamps,
            getColor: [240, 249, 255],
            getWidth: 6,
            widthUnits: "pixels",
            capRounded: true,
            jointRounded: true,
            fadeTrail: true,
            trailLength: cola,
            currentTime: ((ahora % COMETA_MS) / COMETA_MS) * (total + cola),
            parameters: sinProfundidad,
          }),
        );
      }
      capas.push(
        new ScatterplotLayer<Extremo>({
          id: "rutas-extremos",
          data: extremos,
          getPosition: (p) => [p.lng, p.lat],
          getRadius: 9,
          radiusUnits: "pixels",
          getFillColor: (p) => (p.rol === "origen" ? [52, 211, 153, 255] : [244, 114, 182, 255]),
          stroked: true,
          getLineColor: [11, 18, 32, 255],
          lineWidthMinPixels: 3,
          parameters: sinProfundidad,
        }),
        new TextLayer<Extremo>({
          id: "rutas-etiquetas",
          data: extremos,
          getPosition: (p) => [p.lng, p.lat],
          getText: (p) => `${p.rol === "origen" ? "Origen" : "Destino"} · ${p.nombre.length > 34 ? `${p.nombre.slice(0, 33)}…` : p.nombre}`,
          getSize: 13,
          getColor: [255, 255, 255, 255],
          getPixelOffset: [0, -22],
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          fontWeight: 700,
          characterSet: "auto",
          background: true,
          getBackgroundColor: [11, 18, 32, 220],
          backgroundPadding: [6, 3],
          parameters: sinProfundidad,
        }),
      );
    }
    return capas;
  }

  /* ───────── bucle de animación ───────── */
  const animando = () => {
    if (destruido || document.hidden) return false;
    if (girando) return true;
    if (Object.keys(crece).length > 0) return true;
    if (reducido) return false;
    if (st.capas.aire && st.estaciones?.some((e) => e.enMedellin && e.pm25 !== null)) return true;
    return Boolean(rutasPrep && Trips);
  };
  function cuadro(ahora: number) {
    raf = 0;
    if (destruido) return;
    if (girando) {
      const dt = ultimoGiro ? Math.min(64, ahora - ultimoGiro) : 16;
      ultimoGiro = ahora;
      map.setBearing(map.getBearing() + dt * GIRO_GRADOS_POR_MS);
    }
    // en táctil basta con ~30 cuadros por segundo para el pulso
    if (!tactil || girando || ahora - ultimoCuadro > 32) {
      ultimoCuadro = ahora;
      overlay.setProps({ layers: capasDeck(ahora) });
    }
    if (animando()) raf = requestAnimationFrame(cuadro);
  }
  function pedirCuadro() {
    if (!raf && !destruido) raf = requestAnimationFrame(cuadro);
  }
  const alVisibilidad = () => {
    if (!document.hidden) {
      ultimoGiro = 0;
      pedirCuadro();
    }
  };
  document.addEventListener("visibilitychange", alVisibilidad);

  map.on("zoom", () => {
    zoomAlto = map.getZoom() >= 12.4;
    pedirCuadro();
  });

  /* ───────── cámara ───────── */
  const duracion = (ms: number) => (reducido ? 0 : ms);
  function volar(o: { lat: number; lng: number; zoom?: number; inclinacion?: number; rumbo?: number }, conTarjeta = false) {
    camaraTomada = true;
    detenerGiro();
    programar();
    const destino = {
      center: [o.lng, o.lat] as [number, number],
      zoom: o.zoom ?? Math.max(map.getZoom(), 13.6),
      pitch: o.inclinacion ?? Math.max(map.getPitch(), 50),
      bearing: o.rumbo ?? map.getBearing(),
      offset: [0, conTarjeta && contenedor.clientWidth < 768 ? -Math.round(contenedor.clientHeight * 0.16) : 0] as [number, number],
    };
    if (reducido) map.jumpTo(destino);
    else map.flyTo({ ...destino, duration: 2200, curve: 1.3, essential: true });
  }

  function encuadrarRutas() {
    if (!st.rutas) return;
    camaraTomada = true;
    detenerGiro();
    programar();
    const pts: [number, number][] = [
      [st.rutas.origen.lng, st.rutas.origen.lat],
      [st.rutas.destino.lng, st.rutas.destino.lat],
      ...st.rutas.rutas.flatMap((r) => r.puntos),
    ];
    let [o, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [lng, lat] of pts) {
      o = Math.min(o, lng);
      e = Math.max(e, lng);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
    if (!Number.isFinite(o)) return;
    const w = contenedor.clientWidth;
    const h = contenedor.clientHeight;
    const escritorio = w >= 768;
    const pad = escritorio
      ? { top: 110, bottom: 60, left: w >= 1024 ? 340 : 60, right: 440 }
      : { top: Math.min(200, h * 0.28), bottom: Math.round(h * 0.42), left: 28, right: 28 };
    // si el contenedor es pequeño, el relleno no puede comerse todo el lienzo
    const sobraX = w - pad.left - pad.right;
    if (sobraX < 120) {
      pad.left = Math.max(16, pad.left - (120 - sobraX));
      pad.right = Math.max(16, w - pad.left - 120);
    }
    const sobraY = h - pad.top - pad.bottom;
    if (sobraY < 120) pad.bottom = Math.max(16, h - pad.top - 120);
    map.fitBounds(
      [
        [o, s],
        [e, n],
      ],
      { padding: pad, maxZoom: 15.5, duration: duracion(1800), bearing: map.getBearing(), pitch: Math.min(map.getPitch(), 45), essential: true },
    );
  }

  function prepararRutas(r: RutasMapa | null) {
    if (!r || r.rutas.length === 0) return null;
    const elegida = r.rutas.find((x) => x.id === r.elegida) ?? r.rutas.find((x) => x.recomendada) ?? r.rutas[0]!;
    const timestamps = acumulado(elegida.puntos);
    return {
      otras: r.rutas.filter((x) => x !== elegida && x.puntos.length > 1),
      elegida,
      trayecto: elegida.puntos.length > 1 ? [{ path: elegida.puntos, timestamps }] : [],
      total: timestamps[timestamps.length - 1] ?? 0,
      extremos: [
        { ...r.origen, rol: "origen" as const },
        { ...r.destino, rol: "destino" as const },
      ],
    };
  }

  /* ───────── arranque ───────── */
  map.on("load", () => {
    if (destruido) return;
    cargado = true;
    window.clearTimeout(vigia);
    if (!camaraTomada) {
      if (reducido) map.jumpTo(vista);
      else map.flyTo({ ...vista, duration: 4200, curve: 1.25, essential: true });
    }
    programar();
    informar();
    pedirCuadro();
    op.alListo();
  });

  return {
    sincronizar(p) {
      const ahora = performance.now();
      if (p.capas) {
        for (const c of Object.keys(p.capas) as CapaPulso[]) if (p.capas[c] && !st.capas[c]) crece[c] = ahora;
      }
      if (p.estaciones && !st.estaciones) crece.aire = ahora;
      if (p.rejillas) {
        for (const c of ["incidentes", "victimas", "hurto"] as const) if (p.rejillas[c] && !st.rejillas[c]) crece[c] = ahora;
      }
      const rutasNuevas = p.rutas !== undefined && p.rutas?.rutas !== st.rutas?.rutas;
      Object.assign(st, p);
      if (p.rutas !== undefined) rutasPrep = prepararRutas(st.rutas);
      if (rutasNuevas && st.rutas) {
        encuadrarRutas();
        if (!Trips && !pidiendoTrips && !reducido) {
          pidiendoTrips = true;
          import("@deck.gl/geo-layers")
            .then((m) => {
              Trips = m.TripsLayer;
              pedirCuadro();
            })
            .catch(() => {
              // sin cometa: las rutas siguen dibujadas
            });
        }
      }
      pedirCuadro();
    },
    volar,
    vistaInicial: () => volar({ lat: CENTRO.lat, lng: CENTRO.lng, zoom: vista.zoom, inclinacion: vista.pitch, rumbo: vista.bearing }),
    encuadrarRutas,
    fijarRecorrido(activo) {
      window.clearTimeout(temporizador);
      if (activo) {
        permitido = true;
        iniciarGiro();
      } else {
        permitido = false;
        girando = false;
        informar();
      }
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(temporizador);
      window.clearTimeout(vigia);
      document.removeEventListener("visibilitychange", alVisibilidad);
      for (const ev of EVENTOS_INTERACCION) contenedor.removeEventListener(ev, interaccion);
      try {
        map.removeControl(overlay);
        overlay.finalize();
      } catch {
        // el mapa ya pudo haber liberado el contexto
      }
      try {
        map.remove();
      } catch {
        // idem
      }
    },
  };
}

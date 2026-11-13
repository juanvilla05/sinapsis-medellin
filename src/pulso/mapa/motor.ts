/**
 * Motor imperativo del mapa 3D de PULSO: MapLibre GL (cartografía OpenFreeMap) + deck.gl intercalado.
 * Solo se carga con import() dinámico desde MapaPulso: el resto de la página nunca descarga MapLibre ni deck.gl.
 * No inventa cifras: dibuja lo que React le entrega (SIATA, MEData, GeoMedellín) y la geometría de rutas del bus.
 */
import maplibregl, { type Map as MapaML, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, GeoJsonLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { WebMercatorViewport, type LayersList, type PickingInfo } from "@deck.gl/core";
import type { CapaPulso, PuntoNombrado, RutaPulso, TemaPulso, VistaPulso } from "../tipos";
import { estiloPulso, URL_ESTILO_BASE } from "./estilo";
import {
  acumulado,
  COLOR_CAMARA,
  colorCategoria,
  colorRampa,
  GRIS_FUERA,
  hexARgba,
  puntoEnGeometria,
  type CamaraPulso,
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

const FUENTE_NOMBRES = "system-ui, -apple-system, 'Segoe UI', sans-serif";
let medidorTexto: CanvasRenderingContext2D | null = null;
/** ancho en píxeles de un nombre, medido con la misma fuente del TextLayer */
function anchoTexto(texto: string, px: number) {
  medidorTexto ??= document.createElement("canvas").getContext("2d");
  if (!medidorTexto) return texto.length * px * 0.6;
  medidorTexto.font = `700 ${px}px ${FUENTE_NOMBRES}`;
  return medidorTexto.measureText(texto).width;
}
/** la comuna elegida siempre gana; después las urbanas sobre los corregimientos */
const prioridadBase = (c: ComunaMapa, resaltada: string | null | undefined) => (c.codigo === resaltada ? 1000 : c.corregimiento ? 0 : 100);

export const CENTRO = { lng: -75.5736, lat: 6.2442 };
const VISTA = { zoom: 11.6, pitch: 55, bearing: -20 };
const ESPERA_RECORRIDO_MS = 20_000;
const GIRO_GRADOS_POR_MS = 0.0028;
const CRECER_MS = 1100;
const COMETA_MS = 7000;
/** columna de la celda con más casos (tope p99) ≈ 1,3 km */
const ALTURA_TOPE_M = 1300;
const METROS_POR_UG = 55;
/** Al elegir algo, lo demás queda translúcido (≈16 %) para que lo elegido se lea solo. */
const ALFA_ATENUADO = 0.16;
/** en la vista por comunas, la comuna con más casos se levanta ≈ 1,2 km */
const ALTURA_COMUNA_M = 1200;
const GRIS_SIN_DATO: [number, number, number] = [148, 163, 184];

type Rgb = [number, number, number];
type Rgba4 = [number, number, number, number];
/** Colores de las capas de datos según el tema (reglas de dibujo, no cifras). */
interface PaletaCapas {
  comunaLinea: Rgb;
  comunaLineaSel: Rgb;
  comunaRelleno: Rgb;
  textoComuna: Rgba4;
  textoComunaSel: Rgba4;
  contornoTexto: Rgba4;
  anillo: Rgba4;
  resalte: Rgba4;
  cometa: Rgb;
  bordeExtremo: Rgba4;
  etiquetaTexto: Rgba4;
  etiquetaFondo: Rgba4;
  /** velo sobre las demás comunas cuando se aísla una */
  velo: Rgb;
}
const PALETA_CAPAS: Record<TemaPulso, PaletaCapas> = {
  oscuro: {
    comunaLinea: [125, 211, 252],
    comunaLineaSel: [224, 242, 254],
    comunaRelleno: [56, 189, 248],
    textoComuna: [203, 225, 245, 230],
    textoComunaSel: [255, 255, 255, 255],
    contornoTexto: [11, 18, 32, 235],
    anillo: [255, 255, 255, 235],
    resalte: [255, 255, 255, 140],
    cometa: [240, 249, 255],
    bordeExtremo: [11, 18, 32, 255],
    etiquetaTexto: [255, 255, 255, 255],
    etiquetaFondo: [11, 18, 32, 220],
    velo: [11, 18, 32],
  },
  claro: {
    comunaLinea: [29, 78, 216],
    comunaLineaSel: [30, 58, 138],
    comunaRelleno: [37, 99, 235],
    textoComuna: [30, 41, 59, 235],
    textoComunaSel: [15, 23, 42, 255],
    contornoTexto: [255, 255, 255, 240],
    anillo: [15, 23, 42, 235],
    resalte: [15, 23, 42, 90],
    cometa: [30, 58, 138],
    bordeExtremo: [255, 255, 255, 255],
    etiquetaTexto: [15, 23, 42, 255],
    etiquetaFondo: [255, 255, 255, 235],
    velo: [241, 245, 249],
  },
};

export type MotivoFallo = "webgl" | "teselas";
export class FalloMapa extends Error {
  constructor(public motivo: MotivoFallo) {
    super(motivo);
  }
}

export interface EstadoMotor {
  capas: Record<CapaPulso, boolean>;
  estaciones: EstacionSiata[] | null;
  camaras: CamaraPulso[] | null;
  rejillas: Partial<Record<CapaRejilla, RejillaMapa | null>>;
  comunas: ComunaMapa[] | null;
  comunaResaltada: string | null;
  vista: VistaPulso;
  /** posición 0–1 de cada comuna en la rampa para el dato activo (vista por comunas); null = sin dato */
  valoresComuna: Map<string, { t: number }> | null;
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
  tema: TemaPulso;
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
  /** cambia el mapa base y los colores de las capas sin perder cámara ni datos */
  fijarTema: (tema: TemaPulso) => void;
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

  let tema: TemaPulso = op.tema;
  let P = PALETA_CAPAS[tema];
  let estiloBase: StyleSpecification;
  try {
    const r = await fetch(URL_ESTILO_BASE, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error("estilo");
    estiloBase = (await r.json()) as StyleSpecification;
  } catch {
    throw new FalloMapa("teselas");
  }
  const estilo = estiloPulso(estiloBase, tema);

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
    capas: { aire: true, camaras: false, incidentes: false, victimas: false, hurto: false, comunas: false },
    estaciones: null,
    camaras: null,
    rejillas: {},
    comunas: null,
    comunaResaltada: null,
    vista: "puntos",
    valoresComuna: null,
    seleccion: null,
    rutas: null,
  };
  const crece: Partial<Record<CapaPulso, number>> = {};
  let creceVista: number | undefined;
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
    if (id === "camaras") return { tipo: "camara", camara: o as CamaraPulso };
    if (id.startsWith("rejilla-")) return { tipo: "celda", celda: o as CeldaMapa };
    if (id === "comunas") {
      const f = o as FeatureComuna;
      return { tipo: "comuna", codigo: f.properties.codigo, nombre: f.properties.nombre };
    }
    if (id === "rutas-otras" || id === "ruta-elegida") return { tipo: "ruta", ruta: o as RutaPulso };
    return null;
  };

  const crearOverlay = () =>
    new MapboxOverlay({
      interleaved: true,
      useDevicePixels: pixelRatio,
      layers: [],
      onHover: (info) => {
        const objeto = objetoDe(info);
        map.getCanvas().style.cursor = objeto ? "pointer" : "";
        op.alPasar(objeto ? { x: info.x, y: info.y, objeto } : null);
      },
    });
  let overlay = crearOverlay();
  /** mientras el mapa base cambia de estilo no hay overlay donde dibujar */
  let cambiandoEstilo = false;
  const quitarOverlay = () => {
    try {
      map.removeControl(overlay);
      overlay.finalize();
    } catch {
      // el mapa ya pudo haber liberado el contexto
    }
  };
  map.addControl(overlay);
  // La selección usa el clic de MapLibre y no el "tap" de deck.gl: ese exige soltar en menos de 250 ms y,
  // con el mapa ocupado o en pantallas táctiles, se perdía cerca de uno de cada cinco toques.
  map.on("click", (e) => {
    if (cambiandoEstilo || destruido) return;
    let info: PickingInfo | null = null;
    try {
      info = overlay.pickObject({ x: e.point.x, y: e.point.y, radius: tactil ? 12 : 6 });
    } catch {
      info = null;
    }
    op.alTocar(info ? objetoDe(info) : null);
  });

  /* ───────── capas ───────── */
  const factorCrecer = (capa: CapaPulso, ahora: number) => {
    const t0 = crece[capa];
    if (reducido || t0 === undefined) return 1;
    const f = suave((ahora - t0) / CRECER_MS);
    if (f >= 1) delete crece[capa];
    return f;
  };

  /* ───────── selección: lo elegido sólido, el resto translúcido ───────── */
  const mismaPos = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => a.lng === b.lng && a.lat === b.lat;
  let memoDestacadas: { clave: string; celdas: CeldaMapa[] } | null = null;
  /** Celdas que siguen sólidas con la selección actual; null = no hay selección que atenúe esta rejilla. */
  let memoComuna: { clave: string; celdas: CeldaMapa[] } | null = null;
  /** Celdas de la rejilla que caen dentro de la comuna aislada (vista "una"); vacío si aún no se eligió. */
  function celdasDeComuna(capa: CapaPulso, celdas: CeldaMapa[]): CeldaMapa[] {
    const comuna = st.comunaResaltada ? st.comunas?.find((c) => c.codigo === st.comunaResaltada) : undefined;
    if (!comuna) return [];
    const clave = `${capa}|${celdas.length}|${comuna.codigo}`;
    if (memoComuna?.clave === clave) return memoComuna.celdas;
    const dentro = celdas.filter((c) => puntoEnGeometria(c.lng, c.lat, comuna.feature.geometry));
    memoComuna = { clave, celdas: dentro };
    return dentro;
  }
  function celdasDestacadas(capa: CapaPulso, celdas: CeldaMapa[]): CeldaMapa[] | null {
    const sel = st.seleccion;
    // en la vista de una comuna ya solo se dibujan sus celdas: solo atenúa la celda elegida
    const comuna = st.vista === "una" ? undefined : st.comunaResaltada ? st.comunas?.find((c) => c.codigo === st.comunaResaltada) : undefined;
    if (!sel && !comuna) return null;
    const clave = `${st.vista}|${capa}|${celdas.length}|${sel ? `${sel.lng},${sel.lat}` : `c${comuna!.codigo}`}`;
    if (memoDestacadas?.clave === clave) return memoDestacadas.celdas;
    const dentro = sel ? celdas.filter((c) => mismaPos(c, sel)) : celdas.filter((c) => puntoEnGeometria(c.lng, c.lat, comuna!.feature.geometry));
    memoDestacadas = { clave, celdas: dentro };
    return dentro;
  }

  /**
   * Nombres de comunas sin encimarse: cada nombre se proyecta con la misma cámara que usa deck.gl, se ordenan
   * por prioridad y se descarta el que choque con uno ya puesto. Son 21 nombres: se recalcula en cada cuadro.
   */
  let nombresEnPantalla = false;
  function sinEncimarse(
    comunas: ComunaMapa[],
    pos: (c: ComunaMapa) => [number, number, number],
    tam: (c: ComunaMapa) => number,
    prioridad: (c: ComunaMapa) => number,
  ): ComunaMapa[] {
    nombresEnPantalla = comunas.length > 1;
    if (comunas.length < 2) return comunas;
    const caja = map.getContainer();
    const centro = map.getCenter();
    const vp = new WebMercatorViewport({
      width: caja.clientWidth,
      height: caja.clientHeight,
      longitude: centro.lng,
      latitude: centro.lat,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      padding: map.getPadding(),
    });
    const puestas: [number, number, number, number][] = [];
    const visibles: ComunaMapa[] = [];
    for (const c of [...comunas].sort((a, b) => prioridad(b) - prioridad(a))) {
      const [x, y] = vp.project(pos(c));
      const px = tam(c);
      const mx = anchoTexto(c.etiqueta, px) / 2 + 6;
      const my = px * 0.6 + 2;
      const r: [number, number, number, number] = [x - mx, y - my, x + mx, y + my];
      if (puestas.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) continue;
      puestas.push(r);
      visibles.push(c);
    }
    return visibles;
  }

  function capasDeck(ahora: number): LayersList {
    nombresEnPantalla = false;
    const capas: LayersList = [];
    // al acercarse, las columnas se achican para no tapar la ciudad (altura en pantalla más estable)
    const fz = Math.min(1, Math.pow(2, (12 - map.getZoom()) * 0.8));

    const porComunas = st.vista === "comunas";
    const unaComuna = st.vista === "una";

    // 5a) vista por comunas: cada comuna es un bloque cuyo color y altura salen del dato activo
    if (porComunas && st.comunas) {
      const valores = st.valoresComuna;
      const gv = reducido || creceVista === undefined ? 1 : suave((ahora - creceVista) / CRECER_MS);
      if (gv >= 1) creceVista = undefined;
      const escala = ALTURA_COMUNA_M * Math.max(0.001, gv) * Math.max(0.35, fz);
      const tDe = (codigo: string) => valores?.get(codigo)?.t ?? null;
      const alfaDe = (codigo: string) => (st.comunaResaltada && codigo !== st.comunaResaltada ? 80 : 225);
      const clave = [st.comunaResaltada, tema, valores];
      const posNombre = (c: ComunaMapa): [number, number, number] => [c.centro[0], c.centro[1], (tDe(c.codigo) ?? 0) * escala + 40];
      const tamNombre = (c: ComunaMapa) => (c.codigo === st.comunaResaltada ? 15 : 12);
      capas.push(
        new GeoJsonLayer<FeatureComuna["properties"]>({
          id: "comunas",
          data: st.comunas.map((c) => c.feature),
          filled: true,
          stroked: false,
          extruded: Boolean(valores),
          wireframe: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: P.resalte,
          getElevation: (f) => tDe(f.properties.codigo) ?? 0,
          elevationScale: escala,
          getFillColor: (f) => {
            const t = tDe(f.properties.codigo);
            return t === null ? [...GRIS_SIN_DATO, valores ? 70 : 40] : colorRampa(t, alfaDe(f.properties.codigo), tema);
          },
          getLineColor: [...P.comunaLinea, 200],
          updateTriggers: { getFillColor: clave, getElevation: valores },
          material: { ambient: 0.6, diffuse: 0.5, shininess: 16, specularColor: [90, 140, 200] as Rgb },
        }),
        new TextLayer<ComunaMapa>({
          id: "comunas-nombres",
          data: sinEncimarse(st.comunas, posNombre, tamNombre, (c) => prioridadBase(c, st.comunaResaltada) + Math.round((tDe(c.codigo) ?? 0) * 800)),
          getPosition: posNombre,
          getText: (c) => c.etiqueta,
          getSize: tamNombre,
          getColor: (c) => (c.codigo === st.comunaResaltada ? P.textoComunaSel : P.textoComuna),
          fontFamily: FUENTE_NOMBRES,
          fontWeight: 700,
          characterSet: "auto",
          fontSettings: { sdf: true },
          outlineWidth: 3,
          outlineColor: P.contornoTexto,
          updateTriggers: { getPosition: [valores, escala], getSize: st.comunaResaltada, getColor: [st.comunaResaltada, tema] },
          parameters: { depthCompare: "always" },
        }),
      );
    }

    // 5b) una sola comuna: las demás quedan bajo un velo y la elegida con contorno fuerte
    if (unaComuna && st.comunas) {
      capas.push(
        new GeoJsonLayer<FeatureComuna["properties"]>({
          id: "comunas",
          data: st.comunas.map((c) => c.feature),
          filled: true,
          stroked: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [...P.comunaLinea, 60],
          getFillColor: (f) => (!st.comunaResaltada ? [...P.comunaRelleno, 28] : f.properties.codigo === st.comunaResaltada ? [...P.comunaRelleno, 14] : [...P.velo, 165]),
          getLineColor: (f) => (f.properties.codigo === st.comunaResaltada ? [...P.comunaLineaSel, 255] : [...P.comunaLinea, st.comunaResaltada ? 70 : 200]),
          getLineWidth: (f) => (f.properties.codigo === st.comunaResaltada ? 3.5 : 1.2),
          lineWidthUnits: "pixels",
          updateTriggers: { getFillColor: [st.comunaResaltada, tema], getLineColor: [st.comunaResaltada, tema], getLineWidth: st.comunaResaltada },
          parameters: { depthCompare: "always", depthWriteEnabled: false },
        }),
        new TextLayer<ComunaMapa>({
          id: "comunas-nombres",
          data: st.comunaResaltada
            ? st.comunas.filter((c) => c.codigo === st.comunaResaltada)
            : sinEncimarse(st.comunas, (c) => [c.centro[0], c.centro[1], 0], () => 12, (c) => prioridadBase(c, st.comunaResaltada)),
          getPosition: (c) => c.centro,
          getText: (c) => c.etiqueta,
          getSize: st.comunaResaltada ? 16 : 12,
          getColor: st.comunaResaltada ? P.textoComunaSel : P.textoComuna,
          fontFamily: FUENTE_NOMBRES,
          fontWeight: 700,
          characterSet: "auto",
          fontSettings: { sdf: true },
          outlineWidth: 3,
          outlineColor: P.contornoTexto,
          updateTriggers: { getColor: [st.comunaResaltada, tema] },
          parameters: { depthCompare: "always" },
        }),
      );
    }

    // 5) comunas: relleno tenue, contorno luminoso y nombres en zoom alto
    if (!porComunas && !unaComuna && st.capas.comunas && st.comunas) {
      const features = st.comunas.map((c) => c.feature);
      capas.push(
        new GeoJsonLayer<FeatureComuna["properties"]>({
          id: "comunas-brillo",
          data: features,
          filled: false,
          stroked: true,
          getLineColor: [...P.comunaRelleno, 50],
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
          highlightColor: [...P.comunaLinea, 70],
          getFillColor: (f) => (f.properties.codigo === st.comunaResaltada ? [...P.comunaRelleno, 70] : [...P.comunaRelleno, 16]),
          getLineColor: (f) => (f.properties.codigo === st.comunaResaltada ? [...P.comunaLineaSel, 255] : [...P.comunaLinea, st.comunaResaltada ? 90 : 210]),
          getLineWidth: (f) => (f.properties.codigo === st.comunaResaltada ? 3 : 1.3),
          lineWidthUnits: "pixels",
          updateTriggers: {
            getFillColor: [st.comunaResaltada, tema],
            getLineColor: [st.comunaResaltada, tema],
            getLineWidth: st.comunaResaltada,
          },
          parameters: { depthCompare: "always", depthWriteEnabled: false },
        }),
      );
      if (zoomAlto || st.comunaResaltada) {
        const tamZoom = (c: ComunaMapa) => (c.codigo === st.comunaResaltada ? 15 : 12.5);
        capas.push(
          new TextLayer<ComunaMapa>({
            id: "comunas-nombres",
            data: zoomAlto
              ? sinEncimarse(st.comunas, (c) => [c.centro[0], c.centro[1], 0], tamZoom, (c) => prioridadBase(c, st.comunaResaltada))
              : st.comunas.filter((c) => c.codigo === st.comunaResaltada),
            getPosition: (c) => c.centro,
            getText: (c) => c.etiqueta,
            getSize: tamZoom,
            getColor: (c) => (c.codigo === st.comunaResaltada ? P.textoComunaSel : P.textoComuna),
            fontFamily: FUENTE_NOMBRES,
            fontWeight: 700,
            characterSet: "auto",
            fontSettings: { sdf: true },
            outlineWidth: 3,
            outlineColor: P.contornoTexto,
            updateTriggers: { getSize: st.comunaResaltada, getColor: [st.comunaResaltada, tema] },
            parameters: { depthCompare: "always" },
          }),
        );
      }
    }

    // 2–4) rejillas de 250 m: una a la vez, altura ∝ √n con tope en el p99
    for (const capa of ["incidentes", "victimas", "hurto"] as const) {
      const rej = st.rejillas[capa];
      // por comunas no hay columnas; en "una comuna" solo las de esa comuna
      if (!st.capas[capa] || !rej || porComunas) continue;
      const g = factorCrecer(capa, ahora);
      const base = unaComuna ? celdasDeComuna(capa, rej.celdas) : rej.celdas;
      if (base.length === 0) continue;
      const destacadas = celdasDestacadas(capa, base);
      const alfa = destacadas ? Math.round(235 * ALFA_ATENUADO) : 235;
      const columnas = {
        diskResolution: 4,
        angle: 45,
        radius: 150,
        extruded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: P.resalte,
        getPosition: (c: CeldaMapa) => [c.lng, c.lat] as [number, number],
        getElevation: (c: CeldaMapa) => c.h,
        elevationScale: (ALTURA_TOPE_M / Math.sqrt(rej.tope)) * Math.max(0.001, g) * fz,
        material: { ambient: 0.55, diffuse: 0.55, shininess: 24, specularColor: [90, 140, 200] as Rgb },
      };
      capas.push(
        new ColumnLayer<CeldaMapa>({
          ...columnas,
          id: `rejilla-${capa}`,
          data: base,
          getFillColor: (c) => colorRampa(c.t, alfa, tema),
          updateTriggers: { getFillColor: [alfa, tema] },
          // translúcidas no escriben profundidad: así no tapan a la columna elegida ni a la ciudad
          parameters: destacadas ? { depthWriteEnabled: false } : {},
        }),
      );
      if (destacadas && destacadas.length > 0) {
        capas.push(
          new ColumnLayer<CeldaMapa>({
            ...columnas,
            id: `rejilla-${capa}-destacadas`,
            data: destacadas,
            getFillColor: (c) => colorRampa(c.t, 250, tema),
            updateTriggers: { getFillColor: tema },
          }),
        );
      }
    }

    // 1) aire: faros de PM2.5 + pulso
    if (st.capas.aire && st.estaciones) {
      const g = factorCrecer("aire", ahora);
      // al aislar una comuna solo quedan las estaciones que están dentro de ella
      const aislada = unaComuna && st.comunaResaltada ? st.comunas?.find((c) => c.codigo === st.comunaResaltada) : undefined;
      const visibles = aislada ? st.estaciones.filter((e) => puntoEnGeometria(e.lng, e.lat, aislada.feature.geometry)) : st.estaciones;
      const conDato = visibles.filter((e) => e.pm25 !== null);
      const enMed = conDato.filter((e) => e.enMedellin);
      const fase = reducido ? 0.35 : (ahora % 2400) / 2400;
      // con una estación o celda elegida, los demás faros se vuelven translúcidos
      const sel = st.seleccion;
      const kFaro = (e: EstacionSiata) => (sel && !mismaPos(e, sel) ? ALFA_ATENUADO : 1);
      const claveSel = sel ? `${sel.lng},${sel.lat}` : "";
      for (const [k, desfase] of [0, 0.5].entries()) {
        const f = (fase + desfase) % 1;
        // por comunas el aire queda como puntos planos: sin pulso ni faros que tapen los bloques
        if (porComunas || (reducido && k > 0)) break;
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
          data: visibles,
          pickable: true,
          getPosition: (e) => [e.lng, e.lat],
          getRadius: 170,
          radiusUnits: "meters",
          radiusMinPixels: 3,
          getFillColor: (e) => (!e.enMedellin || e.pm25 === null ? GRIS_FUERA : colorCategoria(e.categoria, Math.round(150 * kFaro(e)))),
          updateTriggers: { getFillColor: claveSel },
          parameters: { depthCompare: "always", depthWriteEnabled: false },
        }),
      );
      if (!porComunas)
        capas.push(
        new ColumnLayer<EstacionSiata>({
          id: "aire-faros",
          data: conDato,
          diskResolution: 24,
          radius: 150,
          extruded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: P.resalte,
          getPosition: (e) => [e.lng, e.lat],
          getElevation: (e) => e.pm25 ?? 0,
          elevationScale: METROS_POR_UG * Math.max(0.001, g) * fz,
          getFillColor: (e) => (e.enMedellin ? colorCategoria(e.categoria, Math.round(240 * kFaro(e))) : [GRIS_FUERA[0], GRIS_FUERA[1], GRIS_FUERA[2], Math.round(GRIS_FUERA[3] * kFaro(e))]),
          updateTriggers: { getFillColor: claveSel },
          parameters: sel ? { depthWriteEnabled: false } : {},
          material: { ambient: 0.6, diffuse: 0.5, shininess: 40, specularColor: [255, 255, 255] },
        }),
      );
    }

    // cámaras públicas (SIMM y SIATA): un punto por cámara; la foto se ve en la tarjeta
    if (st.capas.camaras && st.camaras && !porComunas) {
      const aisladaCam = unaComuna && st.comunaResaltada ? st.comunas?.find((c) => c.codigo === st.comunaResaltada) : undefined;
      const camaras = aisladaCam ? st.camaras.filter((c) => puntoEnGeometria(c.lng, c.lat, aisladaCam.feature.geometry)) : st.camaras;
      capas.push(
        new ScatterplotLayer<CamaraPulso>({
          id: "camaras",
          data: camaras,
          pickable: true,
          getPosition: (c) => [c.lng, c.lat],
          getRadius: 60,
          radiusUnits: "meters",
          radiusMinPixels: 5,
          radiusMaxPixels: 13,
          stroked: true,
          getFillColor: (c) => hexARgba(COLOR_CAMARA[c.tipo], 245),
          getLineColor: P.bordeExtremo,
          lineWidthMinPixels: 1.5,
          updateTriggers: { getLineColor: tema },
          parameters: { depthCompare: "always", depthWriteEnabled: false },
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
          getLineColor: P.anillo,
          updateTriggers: { getLineColor: tema },
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
            getColor: P.cometa,
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
          getLineColor: P.bordeExtremo,
          updateTriggers: { getLineColor: tema },
          lineWidthMinPixels: 3,
          parameters: sinProfundidad,
        }),
        new TextLayer<Extremo>({
          id: "rutas-etiquetas",
          data: extremos,
          getPosition: (p) => [p.lng, p.lat],
          getText: (p) => `${p.rol === "origen" ? "Origen" : "Destino"} · ${p.nombre.length > 34 ? `${p.nombre.slice(0, 33)}…` : p.nombre}`,
          getSize: 13,
          getColor: P.etiquetaTexto,
          getPixelOffset: [0, -22],
          fontFamily: FUENTE_NOMBRES,
          fontWeight: 700,
          characterSet: "auto",
          background: true,
          getBackgroundColor: P.etiquetaFondo,
          updateTriggers: { getColor: tema, getBackgroundColor: tema },
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
    if (Object.keys(crece).length > 0 || creceVista !== undefined) return true;
    if (reducido) return false;
    if (st.vista !== "comunas" && st.capas.aire && st.estaciones?.some((e) => e.enMedellin && e.pm25 !== null)) return true;
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
    if (!cambiandoEstilo && (!tactil || girando || ahora - ultimoCuadro > 32)) {
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
  // al girar o arrastrar, los nombres de comunas se reacomodan para no encimarse
  map.on("move", () => {
    if (nombresEnPantalla) pedirCuadro();
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
      // con tarjeta abierta el punto queda fuera de ella: arriba en móvil, a la derecha en escritorio
      offset: (conTarjeta
        ? contenedor.clientWidth < 768
          ? [0, -Math.round(contenedor.clientHeight * 0.16)]
          : [Math.min(280, Math.round(contenedor.clientWidth * 0.25)), 0]
        : [0, 0]) as [number, number],
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
      if (p.vista && p.vista !== st.vista) {
        creceVista = ahora;
        for (const c of ["incidentes", "victimas", "hurto"] as const) if (st.capas[c]) crece[c] = ahora;
      }
      if (p.valoresComuna !== undefined && p.valoresComuna !== st.valoresComuna && (p.vista ?? st.vista) === "comunas") creceVista = ahora;
      // al aislar otra comuna, sus columnas vuelven a crecer
      if ((p.vista ?? st.vista) === "una" && p.comunaResaltada !== undefined && p.comunaResaltada !== st.comunaResaltada) {
        for (const c of ["incidentes", "victimas", "hurto"] as const) if (st.capas[c]) crece[c] = ahora;
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
    fijarTema(nuevo) {
      if (nuevo === tema || destruido) return;
      tema = nuevo;
      P = PALETA_CAPAS[tema];
      // deck.gl intercalado pierde la selección (picking) si el estilo cambia por debajo:
      // se quita el overlay, se cambia el estilo y se monta uno nuevo cuando el estilo termina de cargar
      cambiandoEstilo = true;
      op.alPasar(null);
      quitarOverlay();
      map.setStyle(estiloPulso(estiloBase, tema), { diff: false });
      map.once("style.load", () => {
        if (destruido) return;
        overlay = crearOverlay();
        map.addControl(overlay);
        cambiandoEstilo = false;
        pedirCuadro();
      });
    },
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
      if (!cambiandoEstilo) quitarOverlay();
      try {
        map.remove();
      } catch {
        // idem
      }
    },
  };
}

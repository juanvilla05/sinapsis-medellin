import type * as THREE from "three";
import type { OrbitControls as TipoOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EstacionSiata } from "@/lib/aire";
import { CATEGORIAS } from "@/lib/ica";
import type { FeatureComuna } from "@/lib/monitoreo/fuentes";
import type { CeldaValor, ValorComuna } from "@/lib/monitoreo/metricas";
import { comunaPorCodigo } from "@/lib/territorio";
import { decimal, miles } from "../../areas";
import { alturaCelda, alturaComuna, colorComuna, COLOR_NO_MEDELLIN } from "./escala";
import { horaColombia } from "./formato";
import { bboxDeGeometrias, crearProyeccion, poligonosDe, type Proyeccion } from "./proyeccion";
import { textoValor } from "./capas";

/**
 * La Medellín 3D de datos (three.js 0.160 vanilla), separada del mundo de La Alpujarra: escena, canvas y ciclo
 * de vida propios. Se monta al pulsar "Ver en 3D" con `import("three")` dinámico, pinta bajo demanda (solo
 * cuando algo cambia), respeta `prefers-reduced-motion`, se destruye al cerrar y declara su costo con
 * `renderer.info` (presupuesto: ≤ 40 llamadas de dibujo, ≤ 60 k triángulos).
 *
 *  - Comunas: una `ExtrudeGeometry` por polígono del GeoJSON oficial, profundidad 1 y `scale.y` = altura
 *    (0,3–8) para animar sin reconstruir; color secuencial azul por valor, gris sin dato.
 *  - Columnas: una sola `InstancedMesh` de prismas hexagonales con las celdas de 250 m publicadas (n ≥ 5),
 *    altura ∝ √n, apoyadas sobre la comuna que las contiene (una llamada de dibujo por capa).
 *  - Faros SIATA: `InstancedMesh` de esferas sin iluminar (lucen emisivas) con el color de su categoría ICA y
 *    etiqueta HTML; fuera de Medellín, gris.
 */

export interface CapaComunas3D {
  valores: Map<string, ValorComuna>;
  maximo: number;
  unidad: string;
  titulo: string;
  periodo: string;
  fuente: string;
}

export interface CapaCeldas3D {
  celdas: CeldaValor[];
  maximo: number;
  /** resolución de la rejilla en grados */
  grados: number;
  unidad: string;
  /** qué filtros de la vista NO aplican a la rejilla, para la leyenda ("sin filtros de año, franja ni gravedad") */
  alcance: string;
  periodo: string;
  fuente: string;
}

export interface Estado3D {
  comunas: CapaComunas3D;
  celdas: CapaCeldas3D | null;
  estaciones: EstacionSiata[] | null;
  seleccion: string | null;
}

export interface InfoTooltip {
  titulo: string;
  valor: string;
  detalle: string;
}

export interface InfoRender {
  llamadas: number;
  triangulos: number;
}

export interface Opciones3D {
  host: HTMLElement;
  /** capa HTML (pointer-events: none) donde se colocan las etiquetas de los faros */
  capaEtiquetas: HTMLElement;
  geo: readonly FeatureComuna[];
  alHover(info: InfoTooltip | null, x: number, y: number): void;
  alSeleccionar(codigo: string | null): void;
  alInfo?(info: InfoRender): void;
}

export interface Api3D {
  actualizar(estado: Estado3D): void;
  info(): InfoRender;
  destruir(): void;
}

const DURACION_MS = 400;
const COLOR_CELDA_BAJO = "#93C5FD";
const COLOR_CELDA_ALTO = "#1D4ED8";
const GRADOS = Math.PI / 180;

type Punto = [number, number];
interface PoligonoProyectado {
  exterior: Punto[];
  huecos: Punto[][];
}

interface Comuna3D {
  codigo: string;
  nombre: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  poligonos: PoligonoProyectado[];
  alturaActual: number;
  alturaDesde: number;
  alturaHasta: number;
}

/** Interpolación suave (ease-out cúbica). */
const suavizar = (t: number) => 1 - Math.pow(1 - t, 3);

/** Ray casting punto-en-polígono sobre coordenadas proyectadas (x este, y norte). */
export function dentroDePoligono(x: number, y: number, p: PoligonoProyectado): boolean {
  const dentroAnillo = (anillo: Punto[]) => {
    let dentro = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i]!;
      const [xj, yj] = anillo[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  };
  if (!dentroAnillo(p.exterior)) return false;
  return !p.huecos.some((h) => dentroAnillo(h));
}

/** Proyecta los anillos de una comuna (sin el vértice de cierre repetido). */
export function proyectarPoligonos(f: FeatureComuna, p: Proyeccion): PoligonoProyectado[] {
  const anillo = (puntos: number[][]): Punto[] => {
    const salida: Punto[] = [];
    for (const [lng, lat] of puntos) {
      if (lng === undefined || lat === undefined) continue;
      const q = p.proyectar(lng, lat);
      salida.push([q.x, q.y]);
    }
    const primero = salida[0];
    const ultimo = salida[salida.length - 1];
    if (primero && ultimo && salida.length > 1 && primero[0] === ultimo[0] && primero[1] === ultimo[1]) salida.pop();
    return salida;
  };
  return poligonosDe(f.geometry).map((poligono) => ({ exterior: anillo(poligono[0] ?? []), huecos: poligono.slice(1).map(anillo) }));
}

/**
 * Geometría de una comuna: forma (con huecos) extruida 1 unidad hacia +y. Pura salvo por `three`,
 * para contar triángulos en Node sin WebGL.
 */
export function geometriaComuna(three: typeof THREE, poligonos: PoligonoProyectado[]): THREE.BufferGeometry {
  const formas = poligonos
    .filter((p) => p.exterior.length >= 3)
    .map((p) => {
      const forma = new three.Shape(p.exterior.map(([x, y]) => new three.Vector2(x, y)));
      for (const h of p.huecos) if (h.length >= 3) forma.holes.push(new three.Path(h.map(([x, y]) => new three.Vector2(x, y))));
      return forma;
    });
  const g = new three.ExtrudeGeometry(formas, { depth: 1, bevelEnabled: false, steps: 1 });
  // el plano de la forma (x este, y norte) pasa a (x, −z) y la profundidad apunta hacia +y
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Prisma hexagonal unitario (radio r, altura 1, base en y = 0). */
export function geometriaCelda(three: typeof THREE, radio: number): THREE.BufferGeometry {
  const g = new three.CylinderGeometry(radio, radio, 1, 6, 1);
  g.translate(0, 0.5, 0);
  return g;
}

export const triangulosDe = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;

export async function montarComunas3D(op: Opciones3D): Promise<Api3D> {
  const [three, { OrbitControls }] = await Promise.all([import("three"), import("three/examples/jsm/controls/OrbitControls.js")]);
  const { host, capaEtiquetas, geo } = op;

  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tactil = matchMedia("(pointer: coarse)").matches;

  const proyeccion = crearProyeccion(bboxDeGeometrias(geo.map((f) => f.geometry)));

  /* ── renderer, escena, cámara ── */
  const renderer = new three.WebGLRenderer({ antialias: !tactil, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tactil ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  host.prepend(renderer.domElement);
  const lienzo = renderer.domElement;

  const escena = new three.Scene();
  escena.add(new three.HemisphereLight(0xffffff, 0xdbeafe, 1.05));
  const sol = new three.DirectionalLight(0xffffff, 1.35);
  sol.position.set(-40, 90, 60);
  escena.add(sol);

  const radioVista = Math.max(proyeccion.ancho, proyeccion.alto) * 0.5;
  const camara = new three.OrthographicCamera(-radioVista, radioVista, radioVista, -radioVista, 0.1, 2000);
  const azimut0 = Math.PI / 4;
  const elevacion0 = 35.264 * GRADOS;
  const distancia = 400;
  camara.position.set(Math.sin(azimut0) * Math.cos(elevacion0) * distancia, Math.sin(elevacion0) * distancia, Math.cos(azimut0) * Math.cos(elevacion0) * distancia);
  camara.lookAt(0, 0, 0);

  const controles: TipoOrbitControls = new OrbitControls(camara, lienzo);
  controles.enablePan = false;
  controles.enableDamping = false;
  controles.rotateSpeed = 0.6;
  controles.minZoom = 0.8;
  controles.maxZoom = 2.5;
  controles.minAzimuthAngle = azimut0 - Math.PI / 3;
  controles.maxAzimuthAngle = azimut0 + Math.PI / 3;
  controles.minPolarAngle = 25 * GRADOS;
  controles.maxPolarAngle = 72 * GRADOS;
  controles.target.set(0, 0, 0);
  controles.update();

  /* ── suelo ── */
  const suelo = new three.Mesh(
    new three.PlaneGeometry(proyeccion.ancho * 1.12, proyeccion.alto * 1.12),
    new three.MeshBasicMaterial({ color: new three.Color("#E8EEF6") }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -0.06;
  escena.add(suelo);

  /* ── comunas ── */
  const comunas: Comuna3D[] = geo.map((f) => {
    const poligonos = proyectarPoligonos(f, proyeccion);
    const material = new three.MeshLambertMaterial({ color: new three.Color(colorComuna(null, 0)) });
    const mesh = new three.Mesh(geometriaComuna(three, poligonos), material);
    mesh.scale.y = 0.3;
    mesh.userData = { codigo: f.properties.codigo };
    escena.add(mesh);
    return {
      codigo: f.properties.codigo,
      nombre: comunaPorCodigo(f.properties.codigo)?.nombre ?? f.properties.nombre,
      mesh,
      poligonos,
      alturaActual: 0.3,
      alturaDesde: 0.3,
      alturaHasta: 0.3,
    };
  });
  const comunaEn = (x: number, y: number): Comuna3D | null => comunas.find((c) => c.poligonos.some((p) => dentroDePoligono(x, y, p))) ?? null;

  /* ── columnas (rejilla) ── */
  const ladoCelda = (grados: number) => grados * 111_320 * proyeccion.escala;
  let celdasMesh: THREE.InstancedMesh | null = null;
  let celdasInfo: { x: number; z: number; comuna: Comuna3D | null; altura: number; alturaDesde: number; alturaActual: number; valor: number; idx: number }[] = [];
  let capaCeldas: CapaCeldas3D | null = null;
  const colorBajo = new three.Color(COLOR_CELDA_BAJO);
  const colorAlto = new three.Color(COLOR_CELDA_ALTO);
  const colorTmp = new three.Color();
  const matriz = new three.Matrix4();
  const posicion = new three.Vector3();
  const escalaV = new three.Vector3();
  const cuaternion = new three.Quaternion();

  /* ── faros SIATA ── */
  let farosMesh: THREE.InstancedMesh | null = null;
  let faros: { estacion: EstacionSiata; x: number; z: number; comuna: Comuna3D | null; etiqueta: HTMLSpanElement | null; ancho: number; alto: number }[] = [];
  const geometriaFaro = new three.SphereGeometry(0.75, 10, 7);
  const materialFaro = new three.MeshBasicMaterial({ color: 0xffffff });

  /* ── estado y animación ── */
  let estado: Estado3D | null = null;
  let animando = false;
  let t0 = 0;
  let raf = 0;
  let primerRender = true;
  let reportarInfo = false;
  let ultimaInfo: InfoRender = { llamadas: 0, triangulos: 0 };
  let destruido = false;

  const alturaDe = (c: Comuna3D | null) => (c ? c.alturaActual : 0);

  function colocarCeldas() {
    if (!celdasMesh) return;
    for (const c of celdasInfo) {
      posicion.set(c.x, alturaDe(c.comuna), c.z);
      escalaV.set(1, Math.max(0.001, c.alturaActual), 1);
      matriz.compose(posicion, cuaternion, escalaV);
      celdasMesh.setMatrixAt(c.idx, matriz);
    }
    celdasMesh.instanceMatrix.needsUpdate = true;
  }

  function colocarFaros() {
    if (!farosMesh) return;
    faros.forEach((f, i) => {
      posicion.set(f.x, alturaDe(f.comuna) + 2.4, f.z);
      escalaV.set(1, 1, 1);
      matriz.compose(posicion, cuaternion, escalaV);
      farosMesh!.setMatrixAt(i, matriz);
    });
    farosMesh.instanceMatrix.needsUpdate = true;
  }

  const v3 = new three.Vector3();
  /** Etiquetas de faros: de mayor a menor concentración; las que chocan con una ya puesta se ocultan. */
  function colocarEtiquetas() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    const puestas: [number, number, number, number][] = [];
    const orden = [...faros].filter((f) => f.etiqueta).sort((a, b) => (b.estacion.pm25 ?? -1) - (a.estacion.pm25 ?? -1));
    for (const f of orden) {
      const et = f.etiqueta!;
      v3.set(f.x, alturaDe(f.comuna) + 3.4, f.z).project(camara);
      const x = ((v3.x + 1) / 2) * w;
      const y = ((1 - v3.y) / 2) * h;
      // medir una sola vez (fuerza reflow)
      if (!f.ancho && et.offsetWidth) {
        f.ancho = et.offsetWidth;
        f.alto = et.offsetHeight;
      }
      const aw = f.ancho || 96;
      const ah = f.alto || 18;
      const caja: [number, number, number, number] = [x - aw / 2, y - ah, x + aw / 2, y];
      const choca = puestas.some((c) => caja[0] < c[2] + 3 && caja[2] > c[0] - 3 && caja[1] < c[3] + 2 && caja[3] > c[1] - 2);
      if (v3.z > 1 || choca) {
        et.hidden = true;
        continue;
      }
      et.hidden = false;
      puestas.push(caja);
      et.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  function pintar() {
    renderer.render(escena, camara);
    colocarEtiquetas();
    ultimaInfo = { llamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles };
    if (primerRender) {
      primerRender = false;
      console.info(`[comunas3d] renderer.info → ${ultimaInfo.llamadas} llamadas de dibujo · ${miles(ultimaInfo.triangulos)} triángulos`);
    }
    // se reporta al terminar cada actualización (no en cada cuadro de la animación)
    if (reportarInfo && !animando) {
      reportarInfo = false;
      op.alInfo?.(ultimaInfo);
    }
  }

  function pedirRender() {
    if (destruido || raf) return;
    raf = requestAnimationFrame(tick);
  }

  function tick(ahora: number) {
    raf = 0;
    if (destruido) return;
    if (animando) {
      const t = reducido ? 1 : Math.min(1, (ahora - t0) / DURACION_MS);
      const k = suavizar(t);
      for (const c of comunas) {
        c.alturaActual = c.alturaDesde + (c.alturaHasta - c.alturaDesde) * k;
        c.mesh.scale.y = Math.max(0.001, c.alturaActual);
      }
      for (const c of celdasInfo) c.alturaActual = c.alturaDesde + (c.altura - c.alturaDesde) * k;
      colocarCeldas();
      colocarFaros();
      if (t >= 1) animando = false;
    }
    pintar();
    if (animando) pedirRender();
  }

  function iniciarAnimacion() {
    animando = true;
    reportarInfo = true;
    t0 = performance.now();
    pedirRender();
  }

  function actualizarComunas(capa: CapaComunas3D, seleccion: string | null) {
    for (const c of comunas) {
      const v = capa.valores.get(c.codigo);
      const valor = v?.valor ?? null;
      c.alturaDesde = c.alturaActual;
      c.alturaHasta = alturaComuna(valor, capa.maximo);
      c.mesh.material.color.set(colorComuna(valor, capa.maximo));
      c.mesh.material.emissive.set(seleccion === c.codigo ? "#2563EB" : "#000000");
      c.mesh.material.emissiveIntensity = seleccion === c.codigo ? 0.35 : 0;
      c.mesh.material.opacity = seleccion && seleccion !== c.codigo ? 0.6 : 1;
      c.mesh.material.transparent = !!seleccion;
      c.mesh.material.needsUpdate = true;
    }
  }

  function actualizarCeldas(capa: CapaCeldas3D | null) {
    capaCeldas = capa;
    if (!capa || capa.celdas.length === 0) {
      if (celdasMesh) celdasMesh.count = 0;
      celdasInfo = [];
      return;
    }
    if (!celdasMesh || celdasMesh.instanceMatrix.count < capa.celdas.length) {
      if (celdasMesh) {
        escena.remove(celdasMesh);
        celdasMesh.geometry.dispose();
        (celdasMesh.material as THREE.Material).dispose();
      }
      const radio = (ladoCelda(capa.grados) / 2) * 0.98;
      celdasMesh = new three.InstancedMesh(
        geometriaCelda(three, radio),
        new three.MeshLambertMaterial({ color: 0xffffff, emissive: new three.Color("#1D4ED8"), emissiveIntensity: 0.12 }),
        capa.celdas.length,
      );
      celdasMesh.userData = { tipo: "celdas" };
      escena.add(celdasMesh);
    }
    celdasMesh.count = capa.celdas.length;
    const anterior = new Map(celdasInfo.map((c) => [`${c.x}|${c.z}`, c.alturaActual]));
    celdasInfo = capa.celdas.map((celda, idx) => {
      const lat = (celda.i + 0.5) * capa.grados;
      const lng = (celda.j + 0.5) * capa.grados;
      const p = proyeccion.proyectar(lng, lat);
      const clave = `${p.x}|${-p.y}`;
      const altura = alturaCelda(celda.valor, capa.maximo);
      const k = capa.maximo > 0 ? Math.sqrt(Math.min(1, celda.valor / capa.maximo)) : 0;
      colorTmp.copy(colorBajo).lerp(colorAlto, k);
      celdasMesh!.setColorAt(idx, colorTmp);
      return { x: p.x, z: -p.y, comuna: comunaEn(p.x, p.y), altura, alturaDesde: anterior.get(clave) ?? 0.001, alturaActual: anterior.get(clave) ?? 0.001, valor: celda.valor, idx };
    });
    if (celdasMesh.instanceColor) celdasMesh.instanceColor.needsUpdate = true;
    colocarCeldas();
  }

  function actualizarFaros(estaciones: EstacionSiata[] | null) {
    for (const f of faros) f.etiqueta?.remove();
    faros = [];
    if (!estaciones || estaciones.length === 0) {
      if (farosMesh) farosMesh.count = 0;
      return;
    }
    // solo las que caen en la caja proyectada (con margen), para no alejar la cámara
    const margenX = proyeccion.ancho * 0.12;
    const margenY = proyeccion.alto * 0.12;
    const visibles = estaciones.filter((e) => {
      const p = proyeccion.proyectar(e.lng, e.lat);
      return Math.abs(p.x) <= proyeccion.ancho / 2 + margenX && Math.abs(p.y) <= proyeccion.alto / 2 + margenY;
    });
    if (!farosMesh || farosMesh.instanceMatrix.count < visibles.length) {
      if (farosMesh) escena.remove(farosMesh);
      farosMesh = new three.InstancedMesh(geometriaFaro, materialFaro, Math.max(1, visibles.length));
      farosMesh.userData = { tipo: "faros" };
      escena.add(farosMesh);
    }
    farosMesh.count = visibles.length;
    faros = visibles.map((e, i) => {
      const p = proyeccion.proyectar(e.lng, e.lat);
      colorTmp.set(e.enMedellin ? CATEGORIAS[e.categoria].color : COLOR_NO_MEDELLIN);
      farosMesh!.setColorAt(i, colorTmp);
      let etiqueta: HTMLSpanElement | null = null;
      if (e.enMedellin) {
        etiqueta = document.createElement("span");
        etiqueta.className = "comunas3d-etiqueta";
        etiqueta.style.cssText =
          "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 10.5px var(--font-jetbrains),monospace;color:#0F172A;background:rgba(255,255,255,.92);border:1px solid #E3EAF3;border-radius:6px;padding:1px 5px;box-shadow:0 1px 2px rgba(15,23,42,.08)";
        const punto = document.createElement("i");
        punto.style.cssText = `display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;background:${CATEGORIAS[e.categoria].color}`;
        etiqueta.append(punto, `#${e.codigo} · ${e.pm25 === null ? "sin dato" : `${decimal(e.pm25)} µg/m³`}`);
        capaEtiquetas.append(etiqueta);
      }
      return { estacion: e, x: p.x, z: -p.y, comuna: comunaEn(p.x, p.y), etiqueta, ancho: 0, alto: 0 };
    });
    if (farosMesh.instanceColor) farosMesh.instanceColor.needsUpdate = true;
    colocarFaros();
  }

  /* ── tamaño ── */
  function redimensionar() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    lienzo.style.width = "100%";
    lienzo.style.height = "100%";
    const aspecto = w / h;
    camara.left = -radioVista * aspecto;
    camara.right = radioVista * aspecto;
    camara.top = radioVista;
    camara.bottom = -radioVista;
    camara.updateProjectionMatrix();
    pedirRender();
  }
  const observador = new ResizeObserver(redimensionar);
  observador.observe(host);

  /* ── puntero: tooltip y selección ── */
  const rayo = new three.Raycaster();
  const puntero = new three.Vector2();
  let bajada: { x: number; y: number } | null = null;
  let movido = 0;

  function describir(hit: THREE.Intersection): InfoTooltip | null {
    const o = hit.object;
    if (o.userData.tipo === "celdas" && hit.instanceId !== undefined && capaCeldas) {
      const c = celdasInfo[hit.instanceId];
      if (!c) return null;
      return {
        titulo: `Celda de 250 m${c.comuna ? ` · ${c.comuna.nombre}` : ""}`,
        valor: `${miles(c.valor)} ${capaCeldas.unidad}`,
        detalle: `${capaCeldas.periodo} · ${capaCeldas.fuente}`,
      };
    }
    if (o.userData.tipo === "faros" && hit.instanceId !== undefined) {
      const f = faros[hit.instanceId];
      if (!f) return null;
      const e = f.estacion;
      return {
        titulo: `Estación SIATA #${e.codigo} · ${e.sitio || e.nombre}`,
        valor: e.pm25 === null ? "sin dato" : `PM2.5 ${decimal(e.pm25)} µg/m³ · ${CATEGORIAS[e.categoria].texto}`,
        detalle: `${e.municipio} · última lectura ${horaColombia(e.actualizado)} · SIATA`,
      };
    }
    const codigo = o.userData.codigo as string | undefined;
    if (codigo && estado) {
      const c = comunas.find((x) => x.codigo === codigo);
      const v = estado.comunas.valores.get(codigo);
      const { texto, marca } = textoValor(v);
      const total = [...estado.comunas.valores.values()].reduce((s, x) => s + (x.valor ?? 0), 0);
      const pct = v?.valor !== null && v?.valor !== undefined && total > 0 ? ` (${decimal((v.valor / total) * 100)} %)` : "";
      return {
        titulo: `Comuna ${codigo} · ${c?.nombre ?? ""}`,
        valor: `${texto}${marca ? "†" : ""} ${estado.comunas.unidad}${pct}`,
        detalle: `${estado.comunas.periodo} · ${estado.comunas.fuente}`,
      };
    }
    return null;
  }

  function intersectar(e: PointerEvent): THREE.Intersection | null {
    const r = lienzo.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const objetos: THREE.Object3D[] = comunas.map((c) => c.mesh);
    if (celdasMesh && celdasMesh.count > 0) objetos.push(celdasMesh);
    if (farosMesh && farosMesh.count > 0) objetos.push(farosMesh);
    return rayo.intersectObjects(objetos, false)[0] ?? null;
  }

  const alMover = (e: PointerEvent) => {
    if (bajada) {
      movido += Math.abs(e.clientX - bajada.x) + Math.abs(e.clientY - bajada.y);
      bajada = { x: e.clientX, y: e.clientY };
      op.alHover(null, 0, 0);
      return;
    }
    const hit = intersectar(e);
    const r = host.getBoundingClientRect();
    const info = hit ? describir(hit) : null;
    lienzo.style.cursor = hit?.object.userData.codigo ? "pointer" : "grab";
    op.alHover(info, e.clientX - r.left, e.clientY - r.top);
  };
  const alBajar = (e: PointerEvent) => {
    bajada = { x: e.clientX, y: e.clientY };
    movido = 0;
  };
  const alSubir = (e: PointerEvent) => {
    if (bajada && movido < 6) {
      const hit = intersectar(e);
      const codigo = hit?.object.userData.codigo as string | undefined;
      op.alSeleccionar(codigo ?? null);
    }
    bajada = null;
  };
  const alSalir = () => op.alHover(null, 0, 0);
  lienzo.addEventListener("pointermove", alMover);
  lienzo.addEventListener("pointerdown", alBajar);
  lienzo.addEventListener("pointerup", alSubir);
  lienzo.addEventListener("pointerleave", alSalir);
  controles.addEventListener("change", pedirRender);

  redimensionar();
  pedirRender();

  return {
    actualizar(nuevo) {
      estado = nuevo;
      actualizarComunas(nuevo.comunas, nuevo.seleccion);
      actualizarCeldas(nuevo.celdas);
      actualizarFaros(nuevo.estaciones);
      iniciarAnimacion();
    },
    info: () => ultimaInfo,
    destruir() {
      destruido = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      observador.disconnect();
      controles.removeEventListener("change", pedirRender);
      controles.dispose();
      lienzo.removeEventListener("pointermove", alMover);
      lienzo.removeEventListener("pointerdown", alBajar);
      lienzo.removeEventListener("pointerup", alSubir);
      lienzo.removeEventListener("pointerleave", alSalir);
      for (const f of faros) f.etiqueta?.remove();
      escena.traverse((o) => {
        if (o instanceof three.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      geometriaFaro.dispose();
      materialFaro.dispose();
      renderer.dispose();
      lienzo.remove();
    },
  };
}

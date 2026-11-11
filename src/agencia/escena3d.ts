/**
 * Maqueta 3D de la oficina de la Agencia de datos (three.js). Mismo plano que la vista 2D (OficinaIso):
 * grilla de 28 × 20 unidades, x hacia la derecha, y hacia el frente. No se camina: se gira la maqueta.
 * Ninguna cifra se dibuja aquí salvo las que llegan por `datos` (catálogo real) y las etiquetas de los agentes.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { IdArea } from "@/mundo/areas";
import type { Look } from "./Persona";

export interface SalaPlano {
  id: IdArea;
  num: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  d: number;
  tinte: string;
  borde: string;
  acento: string;
}

export interface EtiquetaAgente {
  id: IdArea | "guia";
  nombre: string;
  cifra: string;
  color: string;
  late: boolean;
}

export interface OpcionesOficina3D {
  salas: SalaPlano[];
  looks: Record<string, Look>;
  estados: { k: string; valor: number; color: string }[];
  totalConjuntos: string;
  reducido: boolean;
  onAbrir(id: IdArea): void;
  onSalida(): void;
}

export interface Oficina3D {
  setEtiquetas(e: EtiquetaAgente[]): void;
  resaltar(id: IdArea | null): void;
  dispose(): void;
}

const ANCHO = 28;
const FONDO = 20;
const ALTO_MURO = 3.6;
const NOCHE = "#0B1220";
const AZUL = "#2563EB";

/** Grilla del plano 2D → mundo 3D (centrado). */
const X = (x: number) => x - ANCHO / 2;
const Z = (y: number) => y - FONDO / 2;

export function crearOficina3D(contenedor: HTMLElement, op: OpcionesOficina3D): Oficina3D {
  const ancho = () => Math.max(1, contenedor.clientWidth);
  const alto = () => Math.max(1, contenedor.clientHeight);

  /* ───────── motor ───────── */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(ancho(), alto());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  contenedor.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.outline = "none";

  const etiquetas = new CSS2DRenderer();
  etiquetas.setSize(ancho(), alto());
  etiquetas.domElement.style.position = "absolute";
  etiquetas.domElement.style.inset = "0";
  etiquetas.domElement.style.pointerEvents = "none";
  contenedor.appendChild(etiquetas.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, ancho() / alto(), 0.5, 300);
  const objetivo = new THREE.Vector3(0.6, 0.4, 0.8);
  /** distancia para que la maqueta entera quepa según la proporción del contenedor */
  const distancia = () => 47 * Math.max(1, 1.6 / (ancho() / alto()));
  const esf = new THREE.Spherical(distancia(), 0.9, Math.PI / 4);
  camara.position.setFromSpherical(esf).add(objetivo);
  camara.lookAt(objetivo);

  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.copy(objetivo);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.minDistance = 24;
  controles.maxDistance = 95;
  controles.minPolarAngle = 0.35;
  controles.maxPolarAngle = 1.22;
  controles.minAzimuthAngle = -0.15;
  controles.maxAzimuthAngle = Math.PI / 2 + 0.15;
  let tocado = false;
  controles.addEventListener("start", () => (tocado = true));

  /* luz */
  escena.add(new THREE.HemisphereLight("#ffffff", "#C7D2E0", 1.15));
  const sol = new THREE.DirectionalLight("#ffffff", 1.6);
  sol.position.set(14, 26, 18);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.left = -22;
  sol.shadow.camera.right = 22;
  sol.shadow.camera.top = 18;
  sol.shadow.camera.bottom = -18;
  sol.shadow.bias = -0.0005;
  sol.shadow.radius = 3;
  escena.add(sol);
  const relleno = new THREE.DirectionalLight("#DBEAFE", 0.45);
  relleno.position.set(-18, 10, 6);
  escena.add(relleno);

  /* ───────── utilidades ───────── */
  const recursos: { dispose(): void }[] = [];
  /** relojes de pared (manecillas con la hora real) */
  const relojes: { min: THREE.Object3D; hora: THREE.Object3D }[] = [];
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    const clave = color + JSON.stringify(extra);
    let m = mats.get(clave);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...extra });
      mats.set(clave, m);
      recursos.push(m);
    }
    return m;
  }
  const geoCaja = new THREE.BoxGeometry(1, 1, 1);
  recursos.push(geoCaja);

  /** Caja con esquina (x, y) del plano, base a la altura `z`. */
  function caja(x: number, y: number, z: number, w: number, d: number, h: number, color: string, padre: THREE.Object3D = escena, extra?: THREE.MeshStandardMaterialParameters, sombra = true) {
    const m = new THREE.Mesh(geoCaja, mat(color, extra));
    m.scale.set(w, h, d);
    m.position.set(X(x + w / 2), z + h / 2, Z(y + d / 2));
    m.castShadow = sombra;
    m.receiveShadow = true;
    padre.add(m);
    return m;
  }

  function textura(dibujar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 1024, h = 128) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    dibujar(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    recursos.push(t);
    return t;
  }

  const FUENTE = getComputedStyle(document.documentElement).getPropertyValue("--font-jakarta").trim() || "'Plus Jakarta Sans', sans-serif";
  const MONO = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains").trim() || "monospace";

  /** Plano con textura, acostado sobre el piso o de pie sobre un muro. */
  function cartel(t: THREE.Texture, w: number, h: number, pos: THREE.Vector3, rot: THREE.Euler, padre: THREE.Object3D = escena, emisivo = false) {
    const g = new THREE.PlaneGeometry(w, h);
    recursos.push(g);
    const m = emisivo
      ? new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })
      : new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9 });
    recursos.push(m);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.copy(pos);
    mesh.rotation.copy(rot);
    mesh.receiveShadow = !emisivo;
    padre.add(mesh);
    return mesh;
  }
  const ACOSTADO = new THREE.Euler(-Math.PI / 2, 0, 0);
  const MURO_FONDO = new THREE.Euler(0, 0, 0);
  const MURO_IZQ = new THREE.Euler(0, Math.PI / 2, 0);

  function rotuloPiso(x: number, y: number, texto: string, color: string, num?: string, largo = 6.2, padre: THREE.Object3D = escena) {
    const t = textura((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      let cx = 8;
      if (num) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(8, 26, 104, 76, 16);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `700 48px ${MONO}`;
        ctx.textAlign = "center";
        ctx.fillText(num, 60, 80);
        cx = 136;
      }
      ctx.textAlign = "left";
      ctx.fillStyle = color;
      ctx.font = `800 54px ${FUENTE}`;
      ctx.fillText(texto.toUpperCase(), cx, 84, w - cx - 8);
    });
    cartel(t, largo, largo / 8, new THREE.Vector3(X(x + largo / 2), 0.045, Z(y)), ACOSTADO, padre);
  }

  /* ───────── piso y muros ───────── */
  const tPiso = textura(
    (ctx, w, h) => {
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#E3EAF3";
      ctx.lineWidth = 2;
      for (let i = 0; i <= ANCHO; i++) {
        const px = (i / ANCHO) * w;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let j = 0; j <= FONDO; j++) {
        const py = (j / FONDO) * h;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
    },
    1400,
    1000,
  );
  const piso = cartel(tPiso, ANCHO, FONDO, new THREE.Vector3(0, 0, 0), ACOSTADO);
  (piso.material as THREE.MeshStandardMaterial).transparent = false;
  // base de la maqueta
  caja(-0.4, -0.4, -0.5, ANCHO + 0.8, FONDO + 0.8, 0.5, "#E2E8F0", escena, undefined, false);

  caja(0, -0.3, 0, ANCHO, 0.3, ALTO_MURO, "#FFFFFF");
  caja(-0.3, -0.3, 0, 0.3, FONDO + 0.3, ALTO_MURO, "#F1F5F9");
  caja(0, -0.02, 0, ANCHO, 0.04, 0.18, "#E2E8F0", escena, undefined, false);
  caja(-0.02, 0, 0, 0.04, FONDO, 0.18, "#DCE3EC", escena, undefined, false);

  // ventanas
  const vidrioCielo = mat("#BFDBFE", { emissive: "#DBEAFE", emissiveIntensity: 0.35, roughness: 0.2 });
  for (const vx of [14.2, 17.4]) {
    const v = new THREE.Mesh(geoCaja, vidrioCielo);
    v.scale.set(2.6, 1.7, 0.05);
    v.position.set(X(vx + 1.3), 2.15, Z(0.01));
    escena.add(v);
    caja(vx + 1.27, 0, 1.3, 0.06, 0.08, 1.7, "#FFFFFF", escena, undefined, false);
  }
  {
    const v = new THREE.Mesh(geoCaja, vidrioCielo);
    v.scale.set(0.05, 1.6, 2.4);
    v.position.set(X(0.01), 2.3, Z(6.4));
    escena.add(v);
  }

  /* ───────── piezas ───────── */
  function escritorio(x: number, y: number, w: number, lados: string, d = 1.15) {
    caja(x, y, 0.72, w, d, 0.06, "#FFFFFF");
    caja(x + 0.05, y + 0.05, 0, 0.08, d - 0.1, 0.72, lados);
    caja(x + w - 0.13, y + 0.05, 0, 0.08, d - 0.1, 0.72, lados);
    caja(x + 0.1, y + d - 0.12, 0.25, w - 0.2, 0.06, 0.47, lados);
  }
  function monitor(x: number, y: number, z = 0.78, w = 0.95) {
    caja(x + w / 2 - 0.05, y + 0.02, z, 0.1, 0.1, 0.22, "#64748B");
    caja(x, y, z + 0.22, w, 0.07, 0.6, "#1E293B");
    const pantalla = new THREE.Mesh(geoCaja, mat("#1D4ED8", { emissive: "#3B82F6", emissiveIntensity: 0.9 }));
    pantalla.scale.set(w - 0.08, 0.52, 0.01);
    pantalla.position.set(X(x + w / 2), z + 0.52, Z(y - 0.005));
    escena.add(pantalla);
  }
  function silla(x: number, y: number, color: string) {
    caja(x, y, 0.42, 0.8, 0.8, 0.08, color);
    caja(x, y - 0.02, 0.5, 0.8, 0.12, 0.75, color);
    caja(x + 0.37, y + 0.34, 0, 0.08, 0.08, 0.42, "#475569");
  }
  const geoHoja = new THREE.IcosahedronGeometry(1, 1);
  recursos.push(geoHoja);
  const plantas: THREE.Object3D[] = [];
  function planta(x: number, y: number, s = 1) {
    caja(x, y, 0, 0.7 * s, 0.7 * s, 0.55 * s, "#E2E8F0");
    const g = new THREE.Group();
    g.position.set(X(x + 0.35 * s), 0.55 * s, Z(y + 0.35 * s));
    for (const [dx, dy, dz, r, c] of [
      [0, 0.45, 0, 0.42, "#16A34A"],
      [-0.2, 0.7, 0.1, 0.3, "#22C55E"],
      [0.22, 0.8, -0.05, 0.32, "#15803D"],
      [0, 1.05, 0, 0.26, "#22C55E"],
    ] as [number, number, number, number, string][]) {
      const h = new THREE.Mesh(geoHoja, mat(c, { flatShading: true }));
      h.scale.setScalar(r * s);
      h.position.set(dx * s, dy * s, dz * s);
      h.castShadow = true;
      g.add(h);
    }
    escena.add(g);
    plantas.push(g);
  }

  /* agentes */
  const geoCuerpo = new THREE.CapsuleGeometry(0.26, 0.42, 6, 14);
  const geoCabeza = new THREE.SphereGeometry(0.24, 24, 18);
  const geoPelo = new THREE.SphereGeometry(0.255, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1);
  const geoOjo = new THREE.SphereGeometry(0.028, 8, 8);
  const geoPierna = new THREE.CapsuleGeometry(0.085, 0.42, 4, 8);
  recursos.push(geoCuerpo, geoCabeza, geoPelo, geoOjo, geoPierna);
  /** Un paso de la rutina de un agente: a dónde va (plano 2D), hacia dónde mira, cuánto se queda y si se sienta. */
  interface Paso {
    x: number;
    y: number;
    mira?: number;
    espera: number;
    sentado?: boolean;
  }
  interface AgenteVivo {
    g: THREE.Group;
    cuerpo: THREE.Group;
    piernas: THREE.Group[];
    ancla: THREE.Object3D;
    pasos: Paso[];
    i: number;
    modo: "espera" | "camina";
    t: number;
    fase: number;
    sentar: number;
  }
  const agentes: AgenteVivo[] = [];
  const anclasEtiqueta = new Map<string, THREE.Object3D>();
  function agente(id: string, pasos: Paso[], retraso = 0) {
    const look = op.looks[id];
    const inicio = pasos[0];
    const g = new THREE.Group();
    g.position.set(X(inicio.x), 0, Z(inicio.y));
    g.rotation.y = inicio.mira ?? 0;
    const cuerpo = new THREE.Group();
    g.add(cuerpo);
    const pantalon = look.falda ? look.traje : "#1F2937";
    const piernas: THREE.Group[] = [];
    for (const dx of [-0.11, 0.11]) {
      // la pierna gira desde la cadera (para caminar y para sentarse)
      const cadera = new THREE.Group();
      cadera.position.set(dx, 0.58, 0);
      const p = new THREE.Mesh(geoPierna, mat(pantalon));
      p.position.y = -0.28;
      p.castShadow = true;
      cadera.add(p);
      cuerpo.add(cadera);
      piernas.push(cadera);
    }
    const torso = new THREE.Mesh(geoCuerpo, mat(look.bata ? "#F8FAFC" : look.traje));
    torso.position.y = 0.95;
    torso.castShadow = true;
    cuerpo.add(torso);
    const camisa = new THREE.Mesh(geoCaja, mat(look.camisa));
    camisa.scale.set(0.16, 0.22, 0.04);
    camisa.position.set(0, 1.12, 0.245);
    cuerpo.add(camisa);
    if (look.corbata) {
      const c = new THREE.Mesh(geoCaja, mat(look.corbata));
      c.scale.set(0.05, 0.2, 0.03);
      c.position.set(0, 1.07, 0.27);
      cuerpo.add(c);
    }
    const cabeza = new THREE.Mesh(geoCabeza, mat(look.piel));
    cabeza.position.y = 1.55;
    cabeza.castShadow = true;
    cuerpo.add(cabeza);
    const pelo = new THREE.Mesh(geoPelo, mat(look.pelo));
    pelo.position.y = 1.57;
    pelo.rotation.x = -0.25;
    cuerpo.add(pelo);
    if (look.peinado === "largo" || look.peinado === "bob") {
      const atras = new THREE.Mesh(geoCaja, mat(look.pelo));
      atras.scale.set(0.46, look.peinado === "largo" ? 0.5 : 0.3, 0.12);
      atras.position.set(0, look.peinado === "largo" ? 1.4 : 1.48, -0.16);
      cuerpo.add(atras);
    }
    if (look.peinado === "mono") {
      const m = new THREE.Mesh(geoCabeza, mat(look.pelo));
      m.scale.setScalar(0.42);
      m.position.set(0, 1.85, -0.08);
      cuerpo.add(m);
    }
    for (const dx of [-0.08, 0.08]) {
      const o = new THREE.Mesh(geoOjo, mat("#1E293B"));
      o.position.set(dx, 1.57, 0.225);
      cuerpo.add(o);
    }
    escena.add(g);
    const ancla = new THREE.Object3D();
    ancla.position.set(X(inicio.x), 2.35, Z(inicio.y));
    escena.add(ancla);
    anclasEtiqueta.set(id, ancla);
    agentes.push({ g, cuerpo, piernas, ancla, pasos, i: 0, modo: "espera", t: -retraso, fase: agentes.length * 1.3, sentar: inicio.sentado ? 1 : 0 });
  }

  const VELOCIDAD = 1.15; // unidades por segundo
  /** Gira por el camino más corto hacia el rumbo `a`. */
  const girar = (de: number, a: number, k: number) => {
    let d = a - de;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return de + d * k;
  };
  function moverAgente(a: AgenteVivo, dt: number, t: number) {
    const paso = a.pasos[a.i];
    a.t += dt;
    let caminando = false;
    if (a.modo === "espera") {
      if (paso.mira !== undefined) a.g.rotation.y = girar(a.g.rotation.y, paso.mira, Math.min(1, dt * 5));
      if (a.t >= paso.espera && a.pasos.length > 1) {
        a.i = (a.i + 1) % a.pasos.length;
        a.modo = "camina";
        a.t = 0;
      }
    } else {
      const meta = a.pasos[a.i];
      const dx = X(meta.x) - a.g.position.x;
      const dz = Z(meta.y) - a.g.position.z;
      const dist = Math.hypot(dx, dz);
      if (a.sentar > 0.02) {
        // primero se levanta de la silla
        a.sentar = Math.max(0, a.sentar - dt * 2.5);
      } else if (dist < 0.04) {
        a.modo = "espera";
        a.t = 0;
      } else {
        caminando = true;
        const avance = Math.min(dist, VELOCIDAD * dt);
        a.g.position.x += (dx / dist) * avance;
        a.g.position.z += (dz / dist) * avance;
        a.g.rotation.y = girar(a.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8));
      }
    }
    // se sienta al llegar a un paso con silla
    if (a.modo === "espera" && a.pasos[a.i].sentado) a.sentar = Math.min(1, a.sentar + dt * 2);
    const balanceo = caminando ? Math.sin(t * 9 + a.fase) * 0.55 : 0;
    a.piernas[0].rotation.x = -1.45 * a.sentar + balanceo;
    a.piernas[1].rotation.x = -1.45 * a.sentar - balanceo;
    const salto = caminando ? Math.abs(Math.sin(t * 9 + a.fase)) * 0.05 : Math.sin(t * 2 + a.fase) * 0.02;
    a.cuerpo.position.set(0, salto - 0.08 * a.sentar, -0.42 * a.sentar);
    a.ancla.position.set(a.g.position.x, 2.35 - 0.1 * a.sentar, a.g.position.z);
  }

  /* ───────── salas ───────── */
  const alfombras = new Map<IdArea, THREE.MeshStandardMaterial>();
  const elegibles: THREE.Object3D[] = [];
  const grupos = new Map<IdArea, THREE.Group>();
  for (const s of op.salas) {
    const g = new THREE.Group();
    g.userData.sala = s.id;
    escena.add(g);
    grupos.set(s.id, g);
    caja(s.x + 0.12, s.y + 0.12, 0, s.w - 0.24, s.d - 0.24, 0.02, s.borde, g, undefined, false);
    const a = caja(s.x + 0.22, s.y + 0.22, 0, s.w - 0.44, s.d - 0.44, 0.03, s.tinte, g, { emissive: "#2563EB", emissiveIntensity: 0 }, false);
    alfombras.set(s.id, a.material as THREE.MeshStandardMaterial);
    elegibles.push(g);
  }
  const sala = (id: IdArea) => grupos.get(id)!;
  const S = (id: IdArea) => op.salas.find((s) => s.id === id)!;

  /** Mampara de vidrio. */
  const vidrio = mat("#BAE6FD", { transparent: true, opacity: 0.28, roughness: 0.1 });
  function mampara(x: number, y: number, w: number, d: number) {
    const m = new THREE.Mesh(geoCaja, vidrio);
    m.scale.set(w, 1.15, d);
    m.position.set(X(x + w / 2), 0.575, Z(y + d / 2));
    escena.add(m);
    caja(x, y, 1.15, w, d, 0.05, "#94A3B8", escena, undefined, false);
  }
  for (const xv of [6.4, 13.25, 20.75]) mampara(xv - 0.03, 0, 0.06, 7.2);
  for (const [a, b] of [
    [0, 2.2],
    [4.6, 9.2],
    [11.0, 15.4],
    [17.6, 22.4],
    [24.6, 28],
  ])
    mampara(a, 7.17, b - a, 0.06);

  /* Archivo MEData */
  caja(0.18, 0.18, 0, 6.1, 6.84, 0.02, "#EEF2F7", escena, undefined, false);
  const tArchivo = textura((ctx, w, h) => {
    ctx.fillStyle = NOCHE;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 46px ${FUENTE}`;
    ctx.fillText("ARCHIVO MEDATA", 32, 58);
    ctx.fillStyle = "#93C5FD";
    ctx.font = `500 34px ${MONO}`;
    ctx.fillText(`${op.totalConjuntos} conjuntos · datos crudos`, 32, 104);
  });
  cartel(tArchivo, 4.8, 0.6, new THREE.Vector3(X(0.7 + 2.4), 2.95, Z(0.02)), MURO_FONDO, escena, true);
  const leds: THREE.Mesh[] = [];
  for (const rx of [0.5, 1.95, 3.4]) {
    caja(rx, 0.35, 0, 1.25, 1.15, 2.4, "#1E293B");
    for (let k = 0; k < 5; k++) {
      caja(rx + 0.1, 1.5, 0.35 + k * 0.42, 1.05, 0.02, 0.3, "#334155", escena, undefined, false);
      const led = new THREE.Mesh(geoCaja, mat(k % 2 ? "#34D399" : "#60A5FA", { emissive: k % 2 ? "#34D399" : "#60A5FA", emissiveIntensity: 1.4 }));
      led.scale.set(0.08, 0.08, 0.02);
      led.position.set(X(rx + 0.25), 0.5 + k * 0.42, Z(1.52));
      escena.add(led);
      leds.push(led);
    }
  }
  for (const [bx, by, bz, bw, bd, bh] of [
    [1.0, 4.0, 0, 1.0, 0.8, 0.45],
    [1.05, 4.05, 0.45, 0.9, 0.7, 0.4],
    [2.6, 4.6, 0, 1.0, 0.8, 0.45],
    [4.3, 3.3, 0, 1.1, 0.9, 0.55],
    [4.35, 3.35, 0.55, 1.0, 0.8, 0.4],
  ])
    caja(bx, by, bz, bw, bd, bh, "#E7DFCF");
  planta(5.3, 5.9, 0.85);

  /* 01 Reloj de Frescura */
  {
    const g = sala("reloj");
    const tReloj = textura(
      (ctx, w, h) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 14;
        ctx.strokeStyle = "#1E293B";
        ctx.stroke();
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 8;
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          ctx.beginPath();
          ctx.moveTo(w / 2 + Math.sin(a) * (w / 2 - 40), h / 2 - Math.cos(a) * (h / 2 - 40));
          ctx.lineTo(w / 2 + Math.sin(a) * (w / 2 - 24), h / 2 - Math.cos(a) * (h / 2 - 24));
          ctx.stroke();
        }
      },
      256,
      256,
    );
    cartel(tReloj, 1.6, 1.6, new THREE.Vector3(X(8.3), 2.4, Z(0.03)), MURO_FONDO, g);
    const minutero = new THREE.Mesh(geoCaja, mat("#1E293B"));
    minutero.scale.set(0.05, 0.6, 0.02);
    minutero.position.set(0, 0.28, 0);
    const centro = new THREE.Group();
    centro.position.set(X(8.3), 2.4, Z(0.06));
    centro.add(minutero);
    g.add(centro);
    const horero = new THREE.Mesh(geoCaja, mat("#D97706"));
    horero.scale.set(0.06, 0.38, 0.02);
    horero.position.set(0, 0.17, 0.01);
    const centroH = new THREE.Group();
    centroH.position.copy(centro.position);
    centroH.add(horero);
    g.add(centroH);
    relojes.push({ min: centro, hora: centroH });
    // tablero con los estados reales del catálogo
    const max = Math.max(1, ...op.estados.map((e) => e.valor));
    const tTablero = textura(
      (ctx, w, h) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#475569";
        ctx.font = `800 30px ${FUENTE}`;
        ctx.fillText("ESTADO DEL CATÁLOGO", 24, 46);
        op.estados.forEach((e, i) => {
          const bh = (e.valor / max) * (h - 120);
          ctx.fillStyle = e.color;
          ctx.fillRect(40 + i * 120, h - 30 - bh, 80, bh);
        });
      },
      512,
      340,
    );
    cartel(tTablero, 3.0, 2.0, new THREE.Vector3(X(9.9 + 1.5), 2.2, Z(0.03)), MURO_FONDO, g);
    silla(8.8, 2.05, "#D97706");
    agente("reloj", [
      { x: 9.2, y: 2.95, mira: 0, espera: 9, sentado: true },
      { x: 10.7, y: 2.95, espera: 0 },
      { x: 11.4, y: 1.05, mira: Math.PI, espera: 5 },
      { x: 10.7, y: 2.95, espera: 0 },
    ]);
    escritorio(8.0, 3.3, 2.4, "#F3D49B");
    monitor(8.4, 3.38);
    planta(12.2, 5.9, 0.8);
    rotuloPiso(7.0, 6.75, "Reloj de Frescura", S("reloj").acento, "01", 6.0, g);
  }

  /* 02 Laboratorio */
  {
    const g = sala("lab");
    agente("lab", [
      { x: 16.7, y: 1.75, mira: 0, espera: 6 },
      { x: 18.5, y: 1.75, mira: 0, espera: 5 },
      { x: 19.75, y: 1.05, mira: Math.PI, espera: 4 },
      { x: 15.1, y: 1.75, mira: 0, espera: 5 },
    ], 2);
    caja(14.4, 2.2, 0.8, 4.8, 1.25, 0.06, "#FFFFFF", g);
    caja(14.45, 2.25, 0, 4.7, 1.15, 0.8, "#9FE3D6", g);
    const geoFrasco = new THREE.CylinderGeometry(0.12, 0.2, 0.42, 16);
    recursos.push(geoFrasco);
    for (const [fx, fy, c] of [
      [14.8, 2.7, "#14B8A6"],
      [15.5, 2.55, "#60A5FA"],
      [17.9, 2.6, "#F59E0B"],
      [18.6, 2.75, "#34D399"],
    ] as [number, number, string][]) {
      const f = new THREE.Mesh(geoFrasco, mat(c, { transparent: true, opacity: 0.85, emissive: c, emissiveIntensity: 0.25, roughness: 0.15 }));
      f.position.set(X(fx), 1.07, Z(fy));
      f.castShadow = true;
      g.add(f);
    }
    monitor(16.2, 2.3, 0.86, 1.1);
    const tAntes = textura(
      (ctx, w, h) => {
        ctx.fillStyle = NOCHE;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#7F1D1D";
        ctx.fillRect(24, 30, w / 2 - 36, h - 60);
        ctx.fillStyle = "#065F46";
        ctx.fillRect(w / 2 + 12, 30, w / 2 - 36, h - 60);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = "#FCA5A5";
          ctx.fillRect(40, 50 + i * 36, i % 2 ? 60 : 90, 14);
          ctx.fillStyle = "#6EE7B7";
          ctx.fillRect(w / 2 + 28, 50 + i * 36, 90, 14);
        }
      },
      256,
      300,
    );
    cartel(tAntes, 1.5, 1.8, new THREE.Vector3(X(19.0 + 0.75), 2.25, Z(0.03)), MURO_FONDO, g, true);
    planta(13.7, 5.8, 0.8);
    rotuloPiso(13.8, 6.75, "Laboratorio de Limpieza", S("lab").acento, "02", 6.6, g);
  }

  /* 05 Sala de Monitoreo */
  {
    const g = sala("monitoreo");
    const tPantalla = (tipo: number) =>
      textura(
        (ctx, w, h) => {
          ctx.fillStyle = NOCHE;
          ctx.fillRect(0, 0, w, h);
          ctx.lineWidth = 6;
          if (tipo === 0) {
            ctx.strokeStyle = "#34D399";
            ctx.beginPath();
            [20, 60, 100, 140, 180, 220].forEach((x, i) => ctx.lineTo(x, 90 - [10, 40, 25, 60, 45, 70][i]));
            ctx.stroke();
          } else if (tipo === 1) {
            ctx.fillStyle = "#60A5FA";
            [20, 60, 100, 140, 180].forEach((x, i) => ctx.fillRect(x, 100 - (i % 3) * 22 - 22, 26, (i % 3) * 22 + 22));
          } else {
            ctx.strokeStyle = "#7DD3FC";
            ctx.beginPath();
            ctx.moveTo(10, 80);
            ctx.bezierCurveTo(70, 10, 140, 110, 240, 40);
            ctx.stroke();
          }
        },
        256,
        128,
      );
    for (let c = 0; c < 3; c++)
      for (let f = 0; f < 2; f++) cartel(tPantalla((c + f) % 3), 1.8, 0.92, new THREE.Vector3(X(21.4 + 0.92 + c * 1.95), 2.85 - f * 1.05, Z(0.03)), MURO_FONDO, g, true);
    silla(23.95, 2.6, "#059669");
    agente("monitoreo", [
      { x: 24.35, y: 3.45, mira: 0, espera: 10, sentado: true },
      { x: 26.0, y: 3.4, espera: 0 },
      { x: 25.3, y: 1.05, mira: Math.PI, espera: 5 },
      { x: 26.0, y: 3.4, espera: 0 },
    ], 4);
    escritorio(22.9, 3.8, 2.9, "#A7E3C7");
    monitor(23.1, 3.88);
    monitor(24.55, 3.88);
    planta(27.0, 5.9, 0.8);
    rotuloPiso(21.3, 6.75, "Sala de Monitoreo", S("monitoreo").acento, "05", 6.0, g);
  }

  /* 03 Ventanilla */
  {
    const g = sala("ventanilla");
    const tProp = textura(
      (ctx, w, h) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#6D28D9";
        ctx.font = `800 30px ${FUENTE}`;
        ctx.fillText("PROPUESTAS DE APERTURA", 24, 46);
        const col = ["#EDE9FE", "#DDD6FE", "#FEF3C7"];
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = col[i % 3];
          ctx.fillRect(30 + (i % 3) * 160, 80 + Math.floor(i / 3) * 100, 130, 76);
        }
      },
      512,
      300,
    );
    cartel(tProp, 4.2, 2.0, new THREE.Vector3(X(0.03), 2.3, Z(11.3)), MURO_IZQ, g);
    agente("ventanilla", [
      { x: 2.9, y: 11.2, mira: Math.PI / 2, espera: 7 },
      { x: 1.05, y: 10.4, mira: -Math.PI / 2, espera: 5 },
      { x: 2.9, y: 12.3, mira: Math.PI / 2, espera: 6 },
    ], 1);
    caja(4.1, 9.4, 1.0, 1.0, 3.8, 0.06, "#FFFFFF", g);
    caja(4.15, 9.45, 0, 0.9, 3.7, 1.0, "#CABDFA", g);
    const v = new THREE.Mesh(geoCaja, vidrio);
    v.scale.set(0.04, 1.25, 3.8);
    v.position.set(X(4.6), 1.7, Z(11.3));
    g.add(v);
    caja(4.25, 9.7, 1.06, 0.7, 0.55, 0.04, "#8B5CF6", g);
    caja(4.3, 9.75, 1.1, 0.6, 0.45, 0.02, "#FFFFFF", g);
    planta(0.6, 13.0, 0.85);
    rotuloPiso(0.35, 13.6, "Ventanilla de Apertura", S("ventanilla").acento, "03", 6.4, g);
  }

  /* recepción */
  {
    const geoAlf = new THREE.CylinderGeometry(3.4, 3.4, 0.02, 64);
    recursos.push(geoAlf);
    const alf = new THREE.Mesh(geoAlf, mat("#EFF6FF"));
    alf.position.set(X(13.6), 0.01, Z(12.6));
    alf.receiveShadow = true;
    escena.add(alf);
    agente("guia", [
      { x: 13.5, y: 12.55, mira: 0, espera: 7 },
      { x: 12.4, y: 12.4, mira: 0, espera: 3 },
      { x: 14.7, y: 12.4, mira: 0, espera: 3 },
    ], 3);
    caja(11.6, 13.0, 0, 4.0, 1.1, 1.0, NOCHE);
    caja(11.55, 12.95, 1.0, 4.1, 1.2, 0.06, "#FFFFFF");
    const tPulso = textura((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#34D399";
      ctx.beginPath();
      ctx.arc(70, h / 2, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `800 72px ${FUENTE}`;
      ctx.fillText("PULSO", 120, 90);
      ctx.fillStyle = "#93C5FD";
      ctx.font = `500 40px ${FUENTE}`;
      ctx.fillText("Agencia de datos", 400, 88);
    });
    cartel(tPulso, 3.6, 0.45, new THREE.Vector3(X(13.6), 0.55, Z(14.11)), MURO_FONDO, escena, true);
    planta(10.0, 10.0, 1.15);
    planta(17.3, 15.4, 1.1);
    caja(16.4, 9.6, 0, 1.9, 0.85, 0.42, "#93C5FD");
    caja(16.4, 9.6, 0.42, 1.9, 0.25, 0.55, "#60A5FA");
    caja(9.6, 15.6, 0, 1.2, 1.2, 0.42, "#FFFFFF");
  }

  /* cafetería */
  {
    caja(8.4, 17.3, 0, 9.6, 2.5, 0.02, "#F1F5F9", escena, undefined, false);
    caja(9.2, 17.6, 0, 4.6, 0.9, 0.95, "#BFDBFE");
    caja(9.15, 17.55, 0.95, 4.7, 1.0, 0.05, "#FFFFFF");
    caja(9.5, 17.7, 1.0, 0.65, 0.55, 0.7, "#1E293B");
    for (const sx of [9.8, 11.2, 12.6]) {
      caja(sx, 18.9, 0.55, 0.5, 0.5, 0.08, AZUL);
      caja(sx + 0.21, 19.11, 0, 0.08, 0.08, 0.55, "#475569");
    }
    caja(15.2, 17.7, 0, 0.7, 0.7, 1.05, "#F8FAFC");
    caja(15.35, 17.85, 1.05, 0.4, 0.4, 0.55, "#7DD3FC", escena, { transparent: true, opacity: 0.8 });
    planta(16.7, 18.4, 1);
    rotuloPiso(13.9, 19.55, "Cafetería", "#64748B", undefined, 2.8);
  }

  /* 04 Analista · PulsoBot */
  {
    const g = sala("analista");
    const tChat = textura(
      (ctx, w, h) => {
        ctx.fillStyle = NOCHE;
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 24);
        ctx.fill();
        ctx.fillStyle = "#1E3A8A";
        ctx.beginPath();
        ctx.roundRect(30, 40, 260, 54, 27);
        ctx.fill();
        ctx.fillStyle = AZUL;
        ctx.beginPath();
        ctx.roundRect(w - 290, 120, 260, 54, 27);
        ctx.fill();
        ctx.fillStyle = "#1E3A8A";
        ctx.beginPath();
        ctx.roundRect(30, 200, 200, 54, 27);
        ctx.fill();
        ctx.fillStyle = "#34D399";
        ctx.beginPath();
        ctx.arc(w - 36, 36, 12, 0, Math.PI * 2);
        ctx.fill();
      },
      512,
      300,
    );
    cartel(tChat, 4.4, 2.0, new THREE.Vector3(X(0.03), 2.3, Z(17.4)), MURO_IZQ, g, true);
    silla(3.25, 15.65, AZUL);
    agente("analista", [
      { x: 3.65, y: 16.5, mira: 0, espera: 9, sentado: true },
      { x: 2.1, y: 16.4, espera: 0 },
      { x: 1.15, y: 17.3, mira: -Math.PI / 2, espera: 5 },
      { x: 2.1, y: 16.4, espera: 0 },
    ], 6);
    escritorio(2.5, 16.85, 2.4, "#B9D3FB");
    monitor(2.9, 16.93);
    planta(0.6, 19.0, 0.9);
    rotuloPiso(0.35, 19.6, "Analista · PulsoBot", S("analista").acento, "04", 6.4, g);
  }

  /* salida a PULSO: ciudad nocturna (ilustración) */
  const salida = new THREE.Group();
  salida.userData.salida = true;
  escena.add(salida);
  {
    const tNoche = textura(
      (ctx, w, h) => {
        ctx.fillStyle = NOCHE;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#1B2B47";
        ctx.lineWidth = 3;
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo((i / 8.4) * w, 0);
          ctx.lineTo((i / 8.4) * w, h);
          ctx.stroke();
        }
        for (let j = 0; j <= 9; j++) {
          ctx.beginPath();
          ctx.moveTo(0, (j / 9) * h);
          ctx.lineTo(w, (j / 9) * h);
          ctx.stroke();
        }
      },
      512,
      548,
    );
    cartel(tNoche, 8.4, 9, new THREE.Vector3(X(19.6 + 4.2), 0.03, Z(11 + 4.5)), ACOSTADO, salida);
    const tVentanas = textura(
      (ctx, w, h) => {
        ctx.fillStyle = "#1E3A5F";
        ctx.fillRect(0, 0, w, h);
        for (let fy = 0; fy < 16; fy++)
          for (let fx = 0; fx < 4; fx++) {
            ctx.fillStyle = (fx * 7 + fy * 3) % 5 === 0 ? "#334C73" : "#FDE68A";
            ctx.fillRect(10 + fx * 30, 10 + fy * 30, 16, 16);
          }
      },
      128,
      490,
    );
    tVentanas.wrapT = THREE.RepeatWrapping;
    const matEdif = new THREE.MeshStandardMaterial({ map: tVentanas, emissive: "#FDE68A", emissiveMap: tVentanas, emissiveIntensity: 0.55, roughness: 0.6 });
    recursos.push(matEdif);
    // ── Medellín: referencias de la ciudad (ilustración, sin cifras) ──
    const lugares: { texto: string; x: number; y: number; z: number }[] = [];
    const edificio = (bx: number, by: number, w: number, d: number, h: number, m: THREE.Material = matEdif) => {
      const e = new THREE.Mesh(geoCaja, m);
      e.scale.set(w, h, d);
      e.position.set(X(bx + w / 2), h / 2, Z(by + d / 2));
      e.castShadow = true;
      e.receiveShadow = true;
      salida.add(e);
      return e;
    };
    // río Medellín
    const rio = new THREE.Mesh(geoCaja, mat("#1D4ED8", { emissive: "#1E40AF", emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.2 }));
    rio.scale.set(0.55, 0.02, 7.7);
    rio.position.set(X(20.1), 0.045, Z(12.3 + 3.85));
    salida.add(rio);
    lugares.push({ texto: "Río Medellín", x: 20.1, y: 18.9, z: 0.3 });

    // edificios de fondo
    for (const [bx, by, bh] of [
      [23.5, 12.5, 1.6],
      [24.8, 13.4, 2.3],
      [21.0, 12.6, 1.3],
      [26.9, 14.9, 1.5],
      [25.6, 16.2, 0.9],
      [26.9, 18.6, 0.7],
      [25.4, 18.9, 0.5],
    ])
      edificio(bx, by, 0.85, 0.85, bh);

    // Edificio Coltejer: torre esbelta con remate en forma de aguja
    const fachadaClara = new THREE.MeshStandardMaterial({ map: tVentanas, color: "#E2E8F0", emissive: "#FDE68A", emissiveMap: tVentanas, emissiveIntensity: 0.4, roughness: 0.5 });
    recursos.push(fachadaClara);
    edificio(26.2, 12.4, 1.0, 1.0, 4.0, fachadaClara);
    const geoAguja = new THREE.ConeGeometry(0.71, 1.3, 4, 1, true);
    recursos.push(geoAguja);
    const aguja = new THREE.Mesh(geoAguja, mat("#CBD5E1", { side: THREE.DoubleSide, metalness: 0.3, roughness: 0.4 }));
    aguja.rotation.y = Math.PI / 4;
    aguja.position.set(X(26.7), 4.65, Z(12.9));
    aguja.castShadow = true;
    salida.add(aguja);
    // el "ojo" de la aguja: una ranura iluminada en el remate
    const ojo = new THREE.Mesh(geoCaja, mat("#FDE68A", { emissive: "#FDE68A", emissiveIntensity: 1.2 }));
    ojo.scale.set(0.12, 0.5, 0.02);
    ojo.position.set(X(26.7), 4.75, Z(13.25));
    salida.add(ojo);
    const espiga = new THREE.Mesh(geoCaja, mat("#94A3B8"));
    espiga.scale.set(0.05, 0.6, 0.05);
    espiga.position.set(X(26.7), 5.6, Z(12.9));
    salida.add(espiga);
    lugares.push({ texto: "Edificio Coltejer", x: 26.7, y: 12.9, z: 6.1 });

    // Centro Administrativo La Alpujarra: Gobernación, Alcaldía y la plaza con el Monumento a la Raza
    const fachadaGris = new THREE.MeshStandardMaterial({ map: tVentanas, color: "#CBD5E1", emissive: "#FDE68A", emissiveMap: tVentanas, emissiveIntensity: 0.35, roughness: 0.7 });
    recursos.push(fachadaGris);
    edificio(21.0, 14.4, 2.5, 1.1, 2.7, fachadaGris);
    for (let k = 0; k <= 8; k++) caja(21.0 + k * 0.3, 15.5, 0, 0.06, 0.08, 2.7, "#F1F5F9", salida, undefined, false); // aletas verticales
    caja(20.95, 14.35, 2.7, 2.6, 1.2, 0.12, "#E2E8F0", salida);
    lugares.push({ texto: "Gobernación de Antioquia", x: 21.5, y: 14.95, z: 3.5 });

    edificio(21.0, 17.6, 2.9, 1.5, 1.5, fachadaGris);
    for (const hz of [0.45, 0.9, 1.35]) caja(20.98, 19.1, hz, 2.94, 0.06, 0.08, "#F8FAFC", salida, undefined, false); // franjas horizontales
    caja(20.95, 17.55, 1.5, 3.0, 1.6, 0.1, "#E2E8F0", salida);
    lugares.push({ texto: "Alcaldía de Medellín", x: 22.45, y: 18.7, z: 1.9 });

    caja(21.0, 15.75, 0, 3.3, 1.7, 0.05, "#94A3B8", salida, undefined, false); // plaza
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.05, 0.6, 0.05),
      new THREE.Vector3(-0.1, 1.2, 0.15),
      new THREE.Vector3(0.12, 1.8, 0.05),
      new THREE.Vector3(0.35, 2.2, -0.15),
    ]);
    const geoMonumento = new THREE.TubeGeometry(curva, 40, 0.09, 10, false);
    recursos.push(geoMonumento);
    const monumento = new THREE.Mesh(geoMonumento, mat("#B7793E", { metalness: 0.45, roughness: 0.35 }));
    monumento.position.set(X(23.4), 0.05, Z(16.6));
    monumento.castShadow = true;
    salida.add(monumento);
    caja(23.2, 16.4, 0.05, 0.4, 0.4, 0.12, "#64748B", salida);
    lugares.push({ texto: "La Alpujarra", x: 23.6, y: 16.6, z: 2.7 });

    for (const l of lugares) {
      const div = document.createElement("div");
      div.className = "etiqueta-3d-lugar";
      div.textContent = l.texto;
      const o = new CSS2DObject(div);
      o.position.set(X(l.x), l.z, Z(l.y));
      salida.add(o);
    }
    const tLetrero = textura((ctx, w, h) => {
      ctx.fillStyle = AZUL;
      ctx.beginPath();
      ctx.roundRect(0, 10, w, h - 20, 50);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `800 58px ${FUENTE}`;
      ctx.fillText("SALIDA A PULSO · EN VIVO →", 48, 86);
    });
    cartel(tLetrero, 7.2, 0.9, new THREE.Vector3(X(20.6 + 3.6), 0.06, Z(19.6)), ACOSTADO, salida, true);
  }
  const faros: THREE.Mesh[] = [];
  {
    const geoAnillo = new THREE.RingGeometry(0.25, 0.32, 32);
    const geoFaro = new THREE.SphereGeometry(0.16, 16, 12);
    recursos.push(geoAnillo, geoFaro);
    for (const [fx, fy] of [
      [20.9, 11.6],
      [24.4, 11.5],
      [27.4, 11.6],
    ]) {
      const f = new THREE.Mesh(geoFaro, mat("#34D399", { emissive: "#34D399", emissiveIntensity: 1.6 }));
      f.position.set(X(fx), 0.2, Z(fy));
      salida.add(f);
      const a = new THREE.Mesh(geoAnillo, new THREE.MeshBasicMaterial({ color: "#34D399", transparent: true, side: THREE.DoubleSide }));
      recursos.push(a.material as THREE.Material);
      a.rotation.x = -Math.PI / 2;
      a.position.set(X(fx), 0.05, Z(fy));
      salida.add(a);
      faros.push(a);
    }
  }
  elegibles.push(salida);

  /* flujo de datos: paquetes que viajan del archivo a PULSO */
  const ruta = [
    [3.2, 6.4],
    [3.2, 7.9],
    [23.6, 7.9],
    [23.6, 11.2],
  ].map(([x, y]) => new THREE.Vector3(X(x), 0.06, Z(y)));
  for (let i = 0; i < ruta.length - 1; i++) {
    const a = ruta[i];
    const b = ruta[i + 1];
    const tramo = new THREE.Mesh(geoCaja, mat("#BFDBFE"));
    tramo.scale.set(Math.abs(b.x - a.x) + 0.3, 0.02, Math.abs(b.z - a.z) + 0.3);
    tramo.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    tramo.receiveShadow = true;
    escena.add(tramo);
  }
  const curva = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < ruta.length - 1; i++) curva.add(new THREE.LineCurve3(ruta[i], ruta[i + 1]));
  const geoPaquete = new THREE.SphereGeometry(0.12, 12, 10);
  recursos.push(geoPaquete);
  const paquetes: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(geoPaquete, mat(AZUL, { emissive: "#3B82F6", emissiveIntensity: 1.4 }));
    p.position.copy(ruta[0]);
    p.position.y = 0.16;
    escena.add(p);
    paquetes.push(p);
  }

  /* ───────── etiquetas (HTML) ───────── */
  const nodos = new Map<string, { div: HTMLDivElement; obj: CSS2DObject }>();
  for (const [id, ancla] of anclasEtiqueta) {
    const div = document.createElement("div");
    div.style.pointerEvents = id === "guia" ? "none" : "auto";
    div.style.cursor = id === "guia" ? "default" : "pointer";
    div.addEventListener("click", () => id !== "guia" && op.onAbrir(id as IdArea));
    const obj = new CSS2DObject(div);
    ancla.add(obj);
    nodos.set(id, { div, obj });
  }

  /* ───────── interacción ───────── */
  const ray = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let resaltado: IdArea | null = null;
  let resaltadoExterno: IdArea | null = null;
  let sobreSalida = false;
  const pisoPlano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const punto = new THREE.Vector3();
  /** Qué hay bajo el puntero: la sala (o la salida) cuyo piso contiene el punto señalado. */
  function elegir(e: PointerEvent): IdArea | "salida" | null {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(puntero, camara);
    // 1) objetos de una sala o de la salida (alfombras, edificios)
    const hit = ray.intersectObjects(elegibles, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o) {
      if (o.userData.sala) return o.userData.sala as IdArea;
      if (o.userData.salida) return "salida";
      o = o.parent;
    }
    // 2) muebles y agentes: se proyecta al piso y se busca la sala que contiene ese punto
    for (const altura of [0.9, 0.4, 0]) {
      pisoPlano.constant = -altura;
      if (!ray.ray.intersectPlane(pisoPlano, punto)) continue;
      const gx = punto.x + ANCHO / 2;
      const gy = punto.z + FONDO / 2;
      const s = op.salas.find((s) => gx >= s.x && gx <= s.x + s.w && gy >= s.y && gy <= s.y + s.d);
      if (s) return s.id;
      if (gx >= 19.6 && gx <= 28 && gy >= 11 && gy <= 20) return "salida";
    }
    return null;
  }
  function pintarResaltado() {
    const activo = resaltado ?? resaltadoExterno;
    for (const [id, m] of alfombras) m.emissiveIntensity = id === activo ? 0.22 : 0;
  }
  const alMover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = elegir(e);
    resaltado = r && r !== "salida" ? r : null;
    sobreSalida = r === "salida";
    renderer.domElement.style.cursor = r ? "pointer" : "grab";
    pintarResaltado();
  };
  let inicio: { x: number; y: number } | null = null;
  const alBajar = (e: PointerEvent) => (inicio = { x: e.clientX, y: e.clientY });
  const alSubir = (e: PointerEvent) => {
    if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6) return;
    const r = elegir(e);
    if (r === "salida") op.onSalida();
    else if (r) op.onAbrir(r);
  };
  renderer.domElement.addEventListener("pointermove", alMover);
  renderer.domElement.addEventListener("pointerdown", alBajar);
  renderer.domElement.addEventListener("pointerup", alSubir);
  renderer.domElement.style.cursor = "grab";

  const ro = new ResizeObserver(() => {
    camara.aspect = ancho() / alto();
    camara.updateProjectionMatrix();
    if (!tocado) esf.radius = distancia();
    renderer.setSize(ancho(), alto());
    etiquetas.setSize(ancho(), alto());
  });
  ro.observe(contenedor);

  /* ───────── animación ───────── */
  const reloj = new THREE.Clock();
  let raf = 0;
  const largo = curva.getLength();
  function cuadro() {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, reloj.getDelta());
    const t = reloj.elapsedTime;
    if (!op.reducido) {
      if (!tocado) {
        // vaivén suave de la maqueta hasta que la persona la gire
        esf.theta = Math.PI / 4 + Math.sin(t * 0.18) * 0.22;
        camara.position.setFromSpherical(esf).add(objetivo);
        camara.lookAt(objetivo);
      }
      agentes.forEach((a) => moverAgente(a, dt, t));
      plantas.forEach((p, i) => (p.rotation.z = Math.sin(t * 0.8 + i) * 0.03));
      paquetes.forEach((p, i) => {
        const u = ((t * 2.2) / largo + i / paquetes.length) % 1;
        const pos = curva.getPointAt(u);
        p.position.set(pos.x, 0.16 + Math.abs(Math.sin(u * 40)) * 0.04, pos.z);
      });
      faros.forEach((f, i) => {
        const k = (t * 0.7 + i * 0.33) % 1;
        f.scale.setScalar(1 + k * 2.2);
        (f.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      });
      leds.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + (Math.sin(t * 3 + i) > 0 ? 0.9 : 0)));
    } else {
      if (!tocado) {
        camara.position.setFromSpherical(esf).add(objetivo);
        camara.lookAt(objetivo);
      }
      agentes.forEach((ag) => moverAgente(ag, 0, 0));
      paquetes.forEach((p, i) => {
        const pos = curva.getPointAt(i / paquetes.length);
        p.position.set(pos.x, 0.16, pos.z);
      });
    }
    const ahora = new Date();
    for (const r of relojes) {
      r.min.rotation.z = -(ahora.getMinutes() / 60) * Math.PI * 2;
      r.hora.rotation.z = -(((ahora.getHours() % 12) + ahora.getMinutes() / 60) / 12) * Math.PI * 2;
    }
    if (sobreSalida) salida.position.y = 0.02;
    else salida.position.y = 0;
    controles.update();
    renderer.render(escena, camara);
    etiquetas.render(escena, camara);
  }
  cuadro();

  return {
    setEtiquetas(lista) {
      for (const e of lista) {
        const n = nodos.get(e.id);
        if (!n) continue;
        n.div.innerHTML = "";
        const caja = document.createElement("span");
        caja.className = "etiqueta-3d";
        const nombre = document.createElement("span");
        nombre.className = "etiqueta-3d-nombre";
        nombre.textContent = e.nombre;
        caja.appendChild(nombre);
        if (e.cifra) {
          const cifra = document.createElement("span");
          cifra.className = `etiqueta-3d-cifra${e.late ? " etiqueta-3d-late" : ""}`;
          cifra.style.background = e.color;
          cifra.textContent = e.cifra;
          caja.appendChild(cifra);
        }
        n.div.appendChild(caja);
      }
    },
    resaltar(id) {
      resaltadoExterno = id;
      pintarResaltado();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", alMover);
      renderer.domElement.removeEventListener("pointerdown", alBajar);
      renderer.domElement.removeEventListener("pointerup", alSubir);
      controles.dispose();
      recursos.forEach((r) => r.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      etiquetas.domElement.remove();
    },
  };
}

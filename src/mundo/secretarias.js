/* ★ Edificios de secretarías: La Alpujarra hecha de datos.
 * Cada secretaría con más conjuntos en MEData es un edificio alrededor de la plaza:
 * la altura es proporcional a su total de conjuntos y la luminaria del techo toma el color
 * del estado de frescura (colorEstado). Las etiquetas se generan desde los datos; aquí no hay cifras a mano.
 * Geometría repetida con InstancedMesh (un draw call por tipo de pieza), sin luces ni sombras nuevas. */
import * as THREE from 'three';
import { colorEstado } from './datos';
import { miles } from './areas';

/** Parcelas candidatas (x, z) sobre el césped y las aceras, lejos del edificio, las calles y la ruta del visitante. */
const PARCELAS = [
  [-34, -27], [-34, -17], [36, -11], [28, -10], [-28, -2],
  [-21, -31], [-11, -31], [-1, -31], [9, -31], [19, -31], [30, -31],
];
const LADO = 6;          // planta del edificio (m)
const ALTURA_MIN = 3;    // altura con cero conjuntos
const ALTURA_MAX = 9;    // altura del edificio con más conjuntos
const PISO = 1.5;        // separación entre bandas de ventanas
const TINTES = ['#E4DCCB', '#D7E1EE', '#EADFD2', '#DCE6DF', '#E6E2EE', '#EFE4C9', '#DDE3EA', '#E8DDD5'];

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Altura proporcional al total de conjuntos (relativa al máximo de la lista). */
function altura(total, maxTotal) {
  return ALTURA_MIN + (maxTotal > 0 ? (total / maxTotal) * (ALTURA_MAX - ALTURA_MIN) : 0);
}

/** Chequeo AABB contra los obstáculos ya registrados en el mundo (con margen). */
function libre(x, z, medio, obstaculos, margen = 0.6) {
  const a = x - medio - margen, b = z - medio - margen, c = x + medio + margen, d = z + medio + margen;
  for (const [x1, z1, x2, z2] of obstaculos) if (c > x1 && a < x2 && d > z1 && b < z2) return false;
  return true;
}

/**
 * @param {THREE.Scene} scene
 * @param {Array<{publicador:string,total:number,atrasados:number,criticos:number,pct:number}>} secretarias
 * @param {{ plastic:Function, addAABB:Function, obstaculos:number[][], mkLabel:Function, labels:Array, pill:object, fuenteMono:string }} u utilidades del mundo
 */
export function crearSecretarias(scene, secretarias, u) {
  const lista = Array.isArray(secretarias) ? secretarias.filter((s) => s && s.publicador) : [];
  const grupo = new THREE.Group(); grupo.name = 'secretarias'; scene.add(grupo);
  const vacio = { grupo, cuerpo: null, items: [], intersectar: () => null, actualizar() {}, animar() {}, hover() {}, posicionDe: () => null, dispose() { scene.remove(grupo); } };
  if (!lista.length) return vacio;

  // 1) asignar parcelas libres (sin chocar con edificio, árboles, monumento ni entre sí)
  const items = [];
  const ocupadas = [];
  for (const s of lista) {
    const p = PARCELAS.find(([x, z]) => libre(x, z, LADO / 2 + 0.5, u.obstaculos) && libre(x, z, LADO / 2 + 0.5, ocupadas));
    if (!p) break; // sin parcela libre: la secretaría no se dibuja (queda en la lista lateral)
    ocupadas.push([p[0] - LADO / 2, p[1] - LADO / 2, p[0] + LADO / 2, p[1] + LADO / 2]);
    items.push({ ...s, x: p[0], z: p[1], h: 0 });
    u.addAABB(p[0] - LADO / 2 - 0.5, p[1] - LADO / 2 - 0.5, p[0] + LADO / 2 + 0.5, p[1] + LADO / 2 + 0.5, u.obstaculos);
  }
  const n = items.length;
  if (!n) return vacio;

  // 2) piezas instanciadas (un draw call cada una)
  const caja = new THREE.BoxGeometry(1, 1, 1);
  const propios = []; // materiales creados aquí (los de u.plastic son compartidos y no se liberan)
  const propio = (m) => { propios.push(m); return m; };
  const matCuerpo = propio(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 }));
  const cuerpo = new THREE.InstancedMesh(caja, matCuerpo, n); cuerpo.castShadow = true; cuerpo.receiveShadow = true; cuerpo.name = 'secretarias-cuerpo';
  const zocalo = new THREE.InstancedMesh(caja, u.plastic('#CFC7B6'), n); zocalo.receiveShadow = true;
  const techo = new THREE.InstancedMesh(caja, u.plastic('#B8AE9B'), n); techo.castShadow = true;
  const maxPisos = Math.ceil(ALTURA_MAX / PISO);
  const bandas = new THREE.InstancedMesh(caja, propio(new THREE.MeshStandardMaterial({ color: 0x2b3442, roughness: 0.25 })), n * maxPisos);
  const mastil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 1, 8), u.plastic('#8A8F99'), n);
  const esfera = new THREE.SphereGeometry(0.55, 20, 14);
  const luminaria = new THREE.InstancedMesh(esfera, propio(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), n);
  const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(0.95, 16, 12), propio(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })), n);
  [cuerpo, zocalo, techo, bandas, mastil, luminaria, halo].forEach((m) => { m.frustumCulled = false; grupo.add(m); });
  cuerpo.userData.secretarias = true; luminaria.userData.secretarias = true;

  // 3) etiquetas HTML generadas desde los datos
  const estiloEtiqueta = { ...u.pill, padding: '5px 11px 5px 9px', transition: 'border-color .15s, box-shadow .15s' };
  items.forEach((it) => {
    it.el = u.mkLabel('', estiloEtiqueta);
    it.etiqueta = { el: it.el, p: new THREE.Vector3(it.x, 0, it.z), inside: false, secretaria: it.publicador };
    u.labels.push(it.etiqueta);
  });

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), COL = new THREE.Color();
  const poner = (mesh, i, x, y, z, sx, sy, sz) => { P.set(x, y, z); S.set(sx, sy, sz); M.compose(P, Q, S); mesh.setMatrixAt(i, M); };

  function pintar() {
    const maxTotal = Math.max(0, ...items.map((it) => it.total || 0));
    items.forEach((it, i) => {
      const h = altura(it.total || 0, maxTotal); it.h = h;
      const base = 0.16;
      poner(zocalo, i, it.x, base + 0.17, it.z, LADO + 1.2, 0.34, LADO + 1.2);
      poner(cuerpo, i, it.x, base + 0.34 + h / 2, it.z, LADO, h, LADO);
      cuerpo.setColorAt(i, COL.set(TINTES[i % TINTES.length]));
      poner(techo, i, it.x, base + 0.34 + h + 0.15, it.z, LADO + 0.3, 0.3, LADO + 0.3);
      const pisos = Math.max(1, Math.floor((h - 0.8) / PISO));
      for (let k = 0; k < maxPisos; k++) {
        const visible = k < pisos;
        poner(bandas, i * maxPisos + k, it.x, base + 0.34 + 0.9 + k * PISO, it.z, visible ? LADO + 0.08 : 0, visible ? 0.55 : 0, visible ? LADO + 0.08 : 0);
      }
      const yTecho = base + 0.34 + h + 0.3;
      poner(mastil, i, it.x, yTecho + 0.5, it.z, 1, 1, 1);
      const color = colorEstado(it.pct ?? 0);
      poner(luminaria, i, it.x, yTecho + 1.3, it.z, 1, 1, 1); luminaria.setColorAt(i, COL.set(color));
      poner(halo, i, it.x, yTecho + 1.3, it.z, 1, 1, 1); halo.setColorAt(i, COL.set(color));
      it.color = color;
      it.etiqueta.p.set(it.x, yTecho + 2.6, it.z);
      it.el.innerHTML = `<span style="width:9px;height:9px;border-radius:999px;background:${color};box-shadow:0 0 0 3px ${color}33;flex:none"></span><b>${escapar(it.publicador)}</b><span style="color:#475569;font-weight:600">· ${miles(it.atrasados || 0)} de ${miles(it.total || 0)} atrasados</span>`;
      it.el.title = `${it.publicador}: ${miles(it.atrasados || 0)} de ${miles(it.total || 0)} conjuntos atrasados en MEData`;
    });
    [cuerpo, zocalo, techo, bandas, mastil, luminaria, halo].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
  pintar();

  const porPublicador = (pub) => items.find((it) => it.publicador === pub) || null;

  return {
    grupo, cuerpo, items,
    /** raycast → { publicador, point } o null */
    intersectar(ray) {
      const h = ray.intersectObjects([cuerpo, luminaria])[0];
      if (!h || h.instanceId == null || !items[h.instanceId]) return null;
      return { publicador: items[h.instanceId].publicador, point: h.point };
    },
    /** nuevos datos (misma lista de publicadores o más corta): se recalculan alturas, colores y etiquetas */
    actualizar(nuevas) {
      const porNombre = new Map((nuevas || []).map((s) => [s.publicador, s]));
      items.forEach((it) => { const s = porNombre.get(it.publicador); if (s) Object.assign(it, { total: s.total, atrasados: s.atrasados, criticos: s.criticos, pct: s.pct }); });
      pintar();
    },
    /** latido suave de las luminarias (solo si el mundo anima) */
    animar(t) {
      items.forEach((it, i) => { const k = 1 + Math.sin(t * 2 + i) * 0.08; poner(halo, i, it.x, 0.16 + 0.34 + it.h + 0.3 + 1.3, it.z, k, k, k); });
      halo.instanceMatrix.needsUpdate = true;
    },
    hover(pub) {
      items.forEach((it) => { const on = it.publicador === pub; it.el.style.borderColor = on ? '#2563EB' : '#E3EAF3'; it.el.style.boxShadow = on ? '0 6px 18px rgba(37,99,235,.25)' : u.pill.boxShadow; });
    },
    posicionDe(pub) { const it = porPublicador(pub); return it ? new THREE.Vector3(it.x, it.h / 2 + 0.5, it.z) : null; },
    dispose() {
      items.forEach((it) => { it.el.remove(); const k = u.labels.indexOf(it.etiqueta); if (k >= 0) u.labels.splice(k, 1); });
      [cuerpo, zocalo, techo, bandas, mastil, luminaria, halo].forEach((m) => { m.geometry.dispose(); m.dispose(); });
      propios.forEach((m) => m.dispose());
      scene.remove(grupo);
    },
  };
}

/**
 * Videowall de la Sala de Monitoreo: barras reales de conjuntos por secretaría (total y atrasados).
 * Sin datos, queda el fondo con un texto; nunca puntos pseudoaleatorios.
 * @param {CanvasRenderingContext2D} x  contexto del canvas 512×256 (se reparte en 6 pantallas de 3×2)
 */
export function dibujarVideowall(x, secretarias, { fuenteSans, fuenteMono, generado } = {}) {
  const W = x.canvas.width, H = x.canvas.height;
  const sans = fuenteSans || 'sans-serif', mono = fuenteMono || 'monospace';
  x.fillStyle = '#12233D'; x.fillRect(0, 0, W, H);
  // rejilla tenue para que cada pantalla tenga textura
  x.strokeStyle = 'rgba(147,180,245,.12)'; x.lineWidth = 1;
  for (let gx = 0; gx <= W; gx += W / 12) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
  for (let gy = 0; gy <= H; gy += H / 6) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
  const lista = Array.isArray(secretarias) ? secretarias.filter((s) => s && s.publicador) : [];
  x.fillStyle = '#93B4F5'; x.font = `600 13px ${mono}`; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.fillText('MEDATA · CONJUNTOS POR SECRETARÍA', 14, 24);
  if (!lista.length) {
    x.fillStyle = '#DCEBFF'; x.font = `700 22px ${sans}`; x.textAlign = 'center';
    x.fillText('Sin datos de MEData en este momento', W / 2, H / 2 + 8);
    x.textAlign = 'left';
    return;
  }
  const maxTotal = Math.max(1, ...lista.map((s) => s.total || 0));
  const top = 44, bottom = H - 34, areaH = bottom - top, margen = 18;
  const paso = (W - margen * 2) / lista.length, ancho = Math.min(40, paso * 0.62);
  x.font = `700 12px ${mono}`; x.textAlign = 'right'; x.fillStyle = '#93B4F5';
  x.fillText(miles(maxTotal), W - 14, 24);
  lista.forEach((s, i) => {
    const cx = margen + paso * i + paso / 2;
    const hTotal = ((s.total || 0) / maxTotal) * areaH, hAtr = ((s.atrasados || 0) / maxTotal) * areaH;
    x.fillStyle = 'rgba(96,165,250,.35)'; x.fillRect(cx - ancho / 2, bottom - hTotal, ancho, hTotal);
    x.fillStyle = colorEstado(s.pct ?? 0); x.fillRect(cx - ancho / 2, bottom - hAtr, ancho, hAtr);
    x.fillStyle = '#FFFFFF'; x.font = `700 12px ${mono}`; x.textAlign = 'center';
    x.fillText(miles(s.atrasados || 0), cx, bottom - hTotal - 6);
    x.fillStyle = '#DCEBFF'; x.font = `600 11px ${sans}`;
    const nombre = String(s.publicador); const corto = nombre.length > 13 ? nombre.slice(0, 12) + '…' : nombre;
    x.fillText(corto, cx, bottom + 15);
  });
  x.textAlign = 'left'; x.fillStyle = '#93B4F5'; x.font = `600 10px ${mono}`;
  x.fillText(generado ? `CORTE ${generado}` : 'ATRASADOS SOBRE TOTAL', 14, H - 6);
}

/* Mundo 3D de SINAPSIS: portado del handoff de diseño (three.js r160, vanilla).
 * Ajustes respecto al prototipo: imports locales, fuentes inyectadas desde la app,
 * cabeza redondeada sin botón superior y muros sin botones (para no evocar una marca de juguetes). */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let FONT_SANS = "'Plus Jakarta Sans', sans-serif";
let FONT_MONO = "'JetBrains Mono', monospace";

export const LOOKS = {
  guia: { skin: '#A8714E', hair: '#22160F', hairStyle: 'long', suit: '#EDE6DA', shirt: '#1E2A3F', skirt: '#EDE6DA', legs: '#8A5A3E' },
  reloj: { skin: '#E3BB9A', hair: '#BDB8B0', hairStyle: 'short', suit: '#3A3C42', shirt: '#F7F5F0', tie: '#7A2232', glasses: true, pocket: '#F2EDE4' },
  lab: { skin: '#6E4430', hair: '#16100D', hairStyle: 'curly', suit: '#1E2A44', shirt: '#9FB6DA', coat: true, glasses: true, pants: '#1E2A44' },
  ventanilla: { skin: '#C48A62', hair: '#1A1310', hairStyle: 'short', suit: '#9C7A52', shirt: '#F7F5F0', tie: '#1E2A44', pants: '#23304A', pocket: '#F7F5F0' },
  analista: { skin: '#EFCDB0', hair: '#6A3720', hairStyle: 'bob', suit: '#1C1C1F', shirt: '#E9CFC6', headset: true, skirt: '#1C1C1F', legs: '#2A2A2E' },
  monitoreo: { skin: '#5A3826', hair: '#120D0A', hairStyle: 'bun', suit: '#1A2945', shirt: '#D6E3F2', tie: '#5B6B80', pants: '#1A2945' },
  visitante: { skin: '#C99272', hair: '#3B2A20', hairStyle: 'short', suit: '#46506A', shirt: '#FFFFFF', pants: '#2B3142', pocket: '#2563EB', badge: true }
};

export const AREAS = {
  reloj: { num: '01', name: 'Reloj de Frescura', rect: [-18, -6, -11, -3], door: [-15.2, -3], inside: [-15.2, -4.6], line: 'Reviso cuándo se actualizó cada conjunto de MEData y cuáles van tarde.' },
  lab: { num: '02', name: 'Laboratorio de Limpieza', rect: [-6, 6, -11, -3], door: [-3.2, -3], inside: [-3.2, -4.6], line: 'Descargo un conjunto en vivo, encuentro sus errores y lo dejo listo.' },
  ventanilla: { num: '03', name: 'Ventanilla de Apertura', rect: [-18, -6, 3, 11], door: [-14.6, 3], inside: [-14.6, 4.8], line: 'Propongo mejoras para que cada conjunto responda preguntas reales.' },
  analista: { num: '04', name: 'Analista IA', rect: [6, 18, -11, -3], door: [8.8, -3], inside: [8.8, -4.6], line: 'Respondo en español con la cifra, su conjunto y su fecha de corte.' },
  monitoreo: { num: '05', name: 'Sala de Monitoreo', rect: [6, 18, 3, 11], door: [16.3, 3], inside: [16.3, 4.8], line: 'Muestro la seguridad vial y para moverse por cada comuna.' }
};

const C = (c) => new THREE.Color(c);
const matCache = {};
function plastic(color, extra = {}) {
  const k = color + JSON.stringify(extra);
  if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.42, metalness: 0, ...extra });
  return matCache[k];
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function box(w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }

function torsoTex(o) {
  const [c, x] = canvas(256, 256);
  x.fillStyle = o.coat ? '#F4F2ED' : o.suit; x.fillRect(0, 0, 256, 256);
  if (o.coat) poly(x, [[66, 0], [190, 0], [128, 168]], o.suit);
  poly(x, [[84, 0], [172, 0], [128, 138]], o.shirt);
  if (o.tie) { poly(x, [[118, 4], [138, 4], [143, 112], [128, 136], [113, 112]], o.tie); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(118, 4, 20, 10); }
  x.fillStyle = 'rgba(0,0,0,.17)';
  poly(x, [[66, 0], [128, 150], [96, 74]], 'rgba(0,0,0,.17)');
  poly(x, [[190, 0], [128, 150], [160, 74]], 'rgba(0,0,0,.17)');
  x.strokeStyle = 'rgba(0,0,0,.32)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(84, 0); x.lineTo(128, 140); x.lineTo(172, 0); x.stroke();
  x.fillStyle = 'rgba(0,0,0,.42)';
  [176, 214].forEach(yy => { x.beginPath(); x.arc(128, yy, 6, 0, 7); x.fill(); });
  if (o.pocket) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(164, 74, 42, 3); poly(x, [[168, 74], [202, 74], [198, 60], [188, 70], [180, 56], [172, 68]], o.pocket); }
  if (o.coat) { x.strokeStyle = 'rgba(0,0,0,.18)'; x.strokeRect(158, 92, 44, 34); x.fillStyle = '#2563EB'; x.fillRect(166, 80, 4, 20); x.fillStyle = '#1E3A5F'; x.fillRect(176, 82, 4, 18); }
  if (o.badge || o.coat) { x.fillStyle = '#FFFFFF'; x.fillRect(52, 92, 40, 26); x.fillStyle = '#2563EB'; x.fillRect(52, 92, 40, 8); }
  return tex(c);
}
function faceTex(o) {
  const [c, x] = canvas(512, 160);
  x.fillStyle = o.skin; x.fillRect(0, 0, 512, 160);
  x.fillStyle = '#17120F';
  [228, 284].forEach(ex => { x.beginPath(); x.ellipse(ex, 70, 7, 9, 0, 0, 7); x.fill(); });
  x.strokeStyle = '#17120F'; x.lineWidth = 4; x.lineCap = 'round';
  [[214, 242], [270, 298]].forEach(([a, b]) => { x.beginPath(); x.moveTo(a, 48); x.quadraticCurveTo((a + b) / 2, 42, b, 48); x.stroke(); });
  x.beginPath(); x.arc(256, 88, 20, 0.18 * Math.PI, 0.82 * Math.PI); x.stroke();
  if (o.glasses) {
    x.lineWidth = 4; x.strokeStyle = '#2A2420';
    x.beginPath(); x.roundRect(208, 56, 40, 28, 8); x.stroke();
    x.beginPath(); x.roundRect(264, 56, 40, 28, 8); x.stroke();
    x.beginPath(); x.moveTo(248, 66); x.lineTo(264, 66); x.stroke();
  }
  const t = tex(c); return t;
}

export function makeFig(o) {
  const g = new THREE.Group();
  const skin = plastic(o.skin), jacket = plastic(o.coat ? '#F4F2ED' : o.suit), pants = plastic(o.pants || o.suit), shoe = plastic('#141210');
  const hips = box(0.9, 0.2, 0.46, o.skirt ? plastic(o.skirt) : pants, 0, 0.88, 0); g.add(hips);
  const legs = [];
  [-0.215, 0.215].forEach(lx => {
    const p = new THREE.Group(); p.position.set(lx, 0.8, 0);
    p.add(box(0.42, 0.74, 0.46, o.skirt ? plastic(o.legs || o.skin) : pants, 0, -0.37, 0));
    p.add(box(0.42, 0.12, 0.54, shoe, 0, -0.74, 0.04));
    g.add(p); legs.push(p);
  });
  if (o.skirt) { const s = cyl(0.47, 0.55, 0.52, plastic(o.skirt), 24); s.position.y = 0.62; s.scale.z = 0.6; g.add(s); }
  if (o.coat) { const s = box(0.98, 0.56, 0.52, jacket, 0, 0.64, 0); g.add(s); g.add(box(0.03, 0.5, 0.01, plastic('#C9C5BD'), 0, 0.64, 0.265, false)); }
  const tg = new THREE.BoxGeometry(1, 1, 0.5);
  const pos = tg.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * 0.74);
  tg.computeVertexNormals();
  const tMat = new THREE.MeshStandardMaterial({ map: torsoTex(o), roughness: 0.42 });
  const torso = new THREE.Mesh(tg, [jacket, jacket, jacket, jacket, tMat, jacket]);
  torso.position.y = 1.48; torso.castShadow = true; g.add(torso);
  const arms = [];
  [-1, 1].forEach(side => {
    const p = new THREE.Group(); p.position.set(side * 0.47, 1.86, 0); p.rotation.z = side * 0.12;
    const a = cyl(0.15, 0.16, 0.72, jacket, 16); a.position.y = -0.34; p.add(a);
    const cuff = cyl(0.16, 0.16, 0.06, plastic(o.shirt), 16); cuff.position.y = -0.69; p.add(cuff);
    const h = cyl(0.11, 0.11, 0.16, skin, 14); h.position.y = -0.8; p.add(h);
    g.add(p); arms.push(p);
  });
  const neck = cyl(0.17, 0.17, 0.1, skin); neck.position.y = 2.03; g.add(neck);
  // cabeza redondeada: la textura de la cara queda centrada al frente (+z) con phiStart = -PI/2
  const hg = new THREE.SphereGeometry(0.36, 32, 24, -Math.PI / 2);
  const head = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: faceTex(o), roughness: 0.45 }));
  head.scale.set(1, 1.05, 0.96); head.position.y = 2.39; head.castShadow = true;
  const headG = new THREE.Group(); headG.add(head);
  const hm = plastic(o.hair), hm2 = new THREE.MeshStandardMaterial({ color: C(o.hair), roughness: 0.45, side: THREE.DoubleSide });
  const cap = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.385, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm); m.position.y = 2.6; m.scale.set(1, 0.6, 1.04); m.castShadow = true; return m; };
  const shell = (h, y, start, len) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.4, h, 28, 1, true, start, len), hm2); m.position.y = y; m.castShadow = true; return m; };
  const hs = o.hairStyle;
  if (hs === 'short' || hs === 'bun') { headG.add(cap(), shell(0.3, 2.47, Math.PI * 0.55, Math.PI * 0.9)); }
  if (hs === 'bun') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), hm); b.position.set(0, 2.78, -0.26); headG.add(b); }
  if (hs === 'bob') headG.add(cap(), shell(0.58, 2.34, Math.PI * 0.4, Math.PI * 1.2));
  if (hs === 'long') { headG.add(cap(), shell(1.0, 2.14, Math.PI * 0.36, Math.PI * 1.28)); }
  if (hs === 'curly') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.47, 1), new THREE.MeshStandardMaterial({ color: C(o.hair), roughness: 0.6, flatShading: true })); m.position.set(0, 2.72, -0.04); m.scale.set(1.02, 0.6, 1); m.castShadow = true; headG.add(m); }
  if (o.headset) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 28, Math.PI), plastic('#1C1C1E')); band.position.y = 2.45; headG.add(band);
    [-0.4, 0.4].forEach(ex => { const e = cyl(0.12, 0.12, 0.08, plastic('#1C1C1E')); e.rotation.z = Math.PI / 2; e.position.set(ex, 2.4, 0); headG.add(e); });
    const mic = box(0.03, 0.03, 0.3, plastic('#1C1C1E'), -0.36, 2.26, 0.16, false); mic.rotation.y = 0.5; headG.add(mic);
  }
  g.add(headG);
  g.userData = { legs, arms, head: headG };
  return g;
}

function textTex(lines, { w = 512, h = 128, bg = '#1E3A5F', fg = '#FFFFFF', sub = '#93B4F5' } = {}) {
  const [c, x] = canvas(w, h);
  x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, w, h, 18); x.fill();
  x.fillStyle = sub; x.font = `600 ${h * 0.2}px ${FONT_MONO}`; x.fillText(lines[0], h * 0.22, h * 0.36);
  x.fillStyle = fg; x.font = `800 ${h * 0.3}px ${FONT_SANS}`; x.fillText(lines[1], h * 0.22, h * 0.76);
  return tex(c);
}
function windowTex(bg, win, cols, rows, w = 256, h = 512, frame = 0.18) {
  const [c, x] = canvas(w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const cw = w / cols, rh = h / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { x.fillStyle = win; x.fillRect(i * cw + cw * frame, j * rh + rh * frame, cw * (1 - 2 * frame), rh * (1 - 2 * frame)); }
  return tex(c);
}
function tileTex(a, b, n = 8) {
  const [c, x] = canvas(256, 256); x.fillStyle = a; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = b; x.lineWidth = 2; const s = 256 / n;
  for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 256); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(256, i * s); x.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function flagTex(stripes) {
  const [c, x] = canvas(96, 64); let y = 0;
  stripes.forEach(([col, f]) => { x.fillStyle = col; x.fillRect(0, y, 96, 64 * f); y += 64 * f; });
  return tex(c);
}

export function createWorld(el, cb = {}) {
  if (cb.fonts) { FONT_SANS = cb.fonts.sans || FONT_SANS; FONT_MONO = cb.fonts.mono || FONT_MONO; }
  const reduced = !!cb.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', outline: 'none' });
  renderer.domElement.tabIndex = 0;
  const labelLayer = document.createElement('div');
  Object.assign(labelLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
  el.appendChild(labelLayer);

  const scene = new THREE.Scene();
  scene.background = C('#DCEBFF'); scene.fog = new THREE.Fog('#E4EEFC', 110, 260);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 600);
  camera.position.set(62, 58, 78);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 6); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.25; controls.minPolarAngle = 0.35; controls.minDistance = 14; controls.maxDistance = 140;
  controls.enablePan = false; controls.autoRotate = !reduced; controls.autoRotateSpeed = 0.35;

  scene.add(new THREE.HemisphereLight('#FFFFFF', '#C9D6E8', 1.15));
  const sun = new THREE.DirectionalLight('#FFF6EA', 1.7); sun.position.set(40, 70, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 200 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun);

  const walls = [], obstacles = [];
  const addAABB = (x1, z1, x2, z2, list = walls) => list.push([Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2)]);

  // ground, streets, plaza
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), plastic('#A9CB8E')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const asphalt = plastic('#5B6270'), walk = plastic('#E7E2D8'), dash = plastic('#F5F3EE');
  const road = (x, z, w, d) => { const r = box(w, 0.06, d, asphalt, x, 0.03, z, false); scene.add(r); };
  road(0, -40, 98, 6); road(0, 40, 98, 6); road(-46, 0, 6, 86); road(46, 0, 6, 86);
  for (let i = -44; i <= 44; i += 4) { scene.add(box(1.6, 0.02, 0.2, dash, i, 0.07, -40, false)); scene.add(box(1.6, 0.02, 0.2, dash, i, 0.07, 40, false)); }
  for (let i = -36; i <= 36; i += 4) { scene.add(box(0.2, 0.02, 1.6, dash, -46, 0.07, i, false)); scene.add(box(0.2, 0.02, 1.6, dash, 46, 0.07, i, false)); }
  for (let i = -3; i <= 3; i++) scene.add(box(0.7, 0.02, 4.4, dash, i * 1.3, 0.07, 40, false));
  const sidewalk = box(86, 0.16, 74, walk, 0, 0.08, 0, false); sidewalk.receiveShadow = true; scene.add(sidewalk);
  const plazaT = tileTex('#E9E2D3', '#D8CFBD', 6); plazaT.repeat.set(14, 6);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(84, 26), new THREE.MeshStandardMaterial({ map: plazaT, roughness: 0.8 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.17, 24); plaza.receiveShadow = true; scene.add(plaza);
  [[-34, -22, 12, 20], [34, -24, 12, 16]].forEach(([x, z, w, d]) => scene.add(box(w, 0.2, d, plastic('#9FC284'), x, 0.2, z, false)));

  // exterior: shell of SINAPSIS building (lifts away when you go inside)
  const shell = new THREE.Group(); scene.add(shell);
  const concrete = plastic('#DCD4C4'), concreteD = plastic('#C9BFAD'), glassDark = plastic('#2B3442', { roughness: 0.2 });
  const prof = new THREE.Shape(); prof.moveTo(11.6, 0); prof.lineTo(-11.6, 0); prof.lineTo(-11.6, 11); prof.lineTo(4.6, 11); prof.lineTo(11.6, 0);
  const sg = new THREE.ExtrudeGeometry(prof, { depth: 36.6, bevelEnabled: false });
  const sm = new THREE.Mesh(sg, concrete); sm.rotation.y = -Math.PI / 2; sm.position.x = 18.3; sm.castShadow = sm.receiveShadow = true; shell.add(sm);
  const slopeA = Math.atan2(7, 11), slopeL = Math.hypot(7, 11);
  for (let x = -17.8; x <= 17.8; x += 0.9) {
    const f = box(0.2, slopeL, 0.5, concreteD, x, 5.5, 8.1 + 0.25); f.rotation.x = slopeA; shell.add(f);
  }
  shell.add(box(6, 2.6, 0.2, glassDark, 0, 1.3, 11.7, false));
  const canopy = box(9, 1.1, 3, plastic('#F2EEE6'), 0, 3.2, 12.6); shell.add(canopy);
  const signT = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 0.8), new THREE.MeshBasicMaterial({ map: textTex(['', 'SINAPSIS'], { w: 512, h: 56, bg: '#F2EEE6', fg: '#1E3A5F', sub: '#F2EEE6' }) }));
  signT.position.set(0, 3.15, 14.11); shell.add(signT);
  [-3.6, 3.6].forEach(x => { const p = cyl(0.25, 0.25, 2.7, concreteD); p.position.set(x, 1.35, 13.6); shell.add(p); });

  // tower + other buildings
  const towerT = windowTex('#D8CFBE', '#3A4352', 8, 26, 256, 768, 0.16);
  const tower = box(11, 34, 9, new THREE.MeshStandardMaterial({ map: towerT, roughness: 0.7 }), -3, 17, -21); scene.add(tower); addAABB(-8.5, -25.5, 2.5, -16.5, obstacles);
  scene.add(box(11.4, 0.6, 9.4, concreteD, -3, 34.3, -21));
  const lowT = windowTex('#F1EEE8', '#38414F', 18, 4, 512, 128, 0.2);
  scene.add(box(22, 7, 9, new THREE.MeshStandardMaterial({ map: lowT, roughness: 0.6 }), 24, 3.5, -22)); addAABB(13, -26.5, 35, -17.5, obstacles);
  const wedge = new THREE.Shape(); wedge.moveTo(0, 0); wedge.lineTo(5, 0); wedge.lineTo(0.6, 13); wedge.lineTo(0, 13);
  const wm = new THREE.Mesh(new THREE.ExtrudeGeometry(wedge, { depth: 22, bevelEnabled: false }), concrete);
  wm.rotation.y = Math.PI / 2; wm.position.set(-41, 0, 0); wm.position.set(-38, 0, 30); wm.rotation.y = Math.PI; wm.castShadow = wm.receiveShadow = true;
  const wedgeG = new THREE.Group(); wedgeG.add(wm); wedgeG.position.set(0, 0, 0); scene.add(wedgeG);
  const ws = new THREE.Mesh(new THREE.ExtrudeGeometry(wedge, { depth: 24, bevelEnabled: false }), concrete); ws.castShadow = ws.receiveShadow = true;
  ws.rotation.y = -Math.PI / 2; ws.position.set(-40, 0, 2); scene.remove(wedgeG); scene.add(ws); addAABB(-41, 2, -35, 34, obstacles);
  for (let z = 3; z <= 33; z += 1.2) { const f = box(0.16, 13.6, 0.4, concreteD, -35.6, 6.6, z); f.rotation.z = -Math.atan2(4.4, 13); f.position.x = -38.2; scene.add(f); }

  // Monumento (curved sculpture)
  const mon = new THREE.Shape(); mon.moveTo(-1.5, 0); mon.quadraticCurveTo(5, 3, 7.5, 21); mon.quadraticCurveTo(2.5, 7, -3.5, 1.6); mon.closePath();
  const mg = new THREE.ExtrudeGeometry(mon, { depth: 1.5, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, curveSegments: 24 });
  const mm = new THREE.Mesh(mg, plastic('#8F8678', { roughness: 0.7 })); mm.position.set(27, 1.2, 22); mm.rotation.y = -0.6; mm.castShadow = true; scene.add(mm);
  const ped = cyl(4.2, 4.6, 1.2, concreteD, 32); ped.position.set(28, 0.6, 22.5); scene.add(ped); addAABB(23.5, 18, 32.5, 27, obstacles);
  for (let a = 0; a < Math.PI * 2; a += 0.5) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), plastic(a % 1 > 0.5 ? '#C2415A' : '#6E9A5E')); b.position.set(28 + Math.cos(a) * 3.6, 1.4, 22.5 + Math.sin(a) * 3.6); scene.add(b); }

  // flags
  const flags = [];
  [[-16, [['#FCD116', 0.5], ['#003893', 0.25], ['#CE1126', 0.25]]], [-12.5, [['#FFFFFF', 0.5], ['#0B7A3B', 0.5]]], [-9, [['#FFFFFF', 0.5], ['#118B3D', 0.5]]]].forEach(([x, st]) => {
    const p = cyl(0.09, 0.11, 9, plastic('#D9DEE6')); p.position.set(x, 4.5, 15.5); scene.add(p);
    const fg = new THREE.Group(); fg.position.set(x, 8.2, 15.5);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6, 8, 1), new THREE.MeshStandardMaterial({ map: flagTex(st), side: THREE.DoubleSide, roughness: 0.8 }));
    f.position.x = 1.2; f.castShadow = true; fg.add(f); scene.add(fg); flags.push(f);
  });

  // trees, tents, background city, mountains
  const tree = (x, z, s = 1) => {
    const t = new THREE.Group(); const tr = cyl(0.22 * s, 0.28 * s, 2.4 * s, plastic('#8A6A4E')); tr.position.y = 1.2 * s; t.add(tr);
    const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), new THREE.MeshStandardMaterial({ color: C('#6FA35C'), flatShading: true, roughness: 0.6 }));
    cr.position.y = 3.2 * s; cr.castShadow = true; t.add(cr); t.position.set(x, 0.16, z); scene.add(t); addAABB(x - 0.4, z - 0.4, x + 0.4, z + 0.4, obstacles);
  };
  [-30, -24, 18, 38].forEach(x => tree(x, 33)); [-40, 40].forEach(x => [-28, -10, 10].forEach(z => tree(x, z, 0.9)));
  [[-22, 18], [20, 30], [36, 2], [-28, -8]].forEach(([x, z]) => tree(x, z, 1.1));
  [[-6, 28, '#2563EB'], [-1, 30, '#E0B341'], [10, 29, '#D9534F']].forEach(([x, z, c]) => {
    const t = new THREE.Group(); t.add(box(2.2, 1, 1.4, plastic('#F2EEE6'), 0, 0.66, 0));
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.1, 4), plastic(c)); r.position.y = 2.0; r.rotation.y = Math.PI / 4; r.castShadow = true; t.add(r);
    [-0.9, 0.9].forEach(px => { const p = cyl(0.05, 0.05, 1.6, plastic('#B8B2A6')); p.position.set(px, 1.0, 0.6); t.add(p); });
    t.position.set(x, 0.16, z); scene.add(t); addAABB(x - 1.2, z - 0.8, x + 1.2, z + 0.8, obstacles);
  });
  const pastel = ['#EADFCB', '#D9E4F2', '#EFE1D3', '#DDE8E0', '#E9E5F1', '#F1E6C8'];
  [[-70, -60, 18, 22], [-36, -66, 22, 14], [4, -70, 16, 26], [40, -64, 20, 16], [74, -40, 14, 20], [-76, 8, 14, 12], [76, 14, 14, 16], [-70, 64, 20, 10], [-20, 64, 18, 14], [26, 66, 22, 10], [70, 62, 16, 18]].forEach(([x, z, w, h], i) => {
    const t = windowTex(pastel[i % 6], '#8796AE', Math.round(w / 2.5), Math.round(h / 2.2), 256, 256, 0.22);
    scene.add(box(w, h, 12, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), x, h / 2, z));
  });
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * 0.95 + i * 0.14, r = 190 + (i % 3) * 20;
    const m = new THREE.Mesh(new THREE.ConeGeometry(38 + (i % 4) * 8, 46 + (i % 5) * 9, 6), new THREE.MeshStandardMaterial({ color: C(i % 2 ? '#A9BCD6' : '#B7C8DF'), flatShading: true, roughness: 1 }));
    m.position.set(Math.cos(a) * r, 18, Math.sin(a) * r * 0.8 - 30); scene.add(m);
  }
  const cars = [];
  ['#2563EB', '#E0B341', '#F2F2F2', '#C2415A', '#1E3A5F'].forEach((c, i) => {
    const g = new THREE.Group(); g.add(box(2.4, 0.7, 1.2, plastic(c), 0, 0.6, 0)); g.add(box(1.3, 0.55, 1.0, plastic('#CFE0F5', { roughness: 0.15 }), -0.15, 1.2, 0));
    [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]].forEach(([wx, wz]) => { const w = cyl(0.28, 0.28, 0.2, plastic('#1B1B1E'), 12); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.3, wz); g.add(w); });
    scene.add(g); cars.push({ g, t: i / 5 });
  });

  // interior
  const interior = new THREE.Group(); scene.add(interior);
  const floorT = tileTex('#F3F5F8', '#DEE4EC', 8); floorT.repeat.set(9, 5.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 22), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.19, 0); floor.receiveShadow = true; interior.add(floor);
  const wallM = plastic('#FBFBFA'), studM = plastic('#BFD4F6'), baseM = plastic('#1E3A5F');
  const wall = (x1, z1, x2, z2, h = 2.2, t = 0.32) => {
    const w = Math.abs(x2 - x1) || t, d = Math.abs(z2 - z1) || t;
    const m = box(w, h, d, wallM, (x1 + x2) / 2, h / 2 + 0.18, (z1 + z2) / 2); interior.add(m);
    interior.add(box(w + 0.01, 0.16, d + 0.01, baseM, (x1 + x2) / 2, 0.26, (z1 + z2) / 2, false));
    addAABB(x1 - (x1 === x2 ? t / 2 : 0), z1 - (z1 === z2 ? t / 2 : 0), x2 + (x1 === x2 ? t / 2 : 0), z2 + (z1 === z2 ? t / 2 : 0));
    interior.add(box(w + 0.04, 0.07, d + 0.04, studM, (x1 + x2) / 2, h + 0.18 + 0.035, (z1 + z2) / 2, false));
  };
  wall(-18, -11, 18, -11, 3); wall(-18, -11, -18, 11, 3); wall(18, -11, 18, 11, 3); wall(-18, 11, -2.2, 11, 3); wall(2.2, 11, 18, 11, 3);
  wall(-6, -11, -6, -3); wall(6, -11, 6, -3);
  wall(-18, -3, -16.8, -3); wall(-13.6, -3, -6, -3); wall(-6, -3, -4.8, -3); wall(-1.6, -3, 6, -3); wall(6, -3, 7.2, -3); wall(10.4, -3, 18, -3);
  wall(-18, 3, -16.2, 3); wall(-13, 3, -6, 3); wall(6, 3, 14.7, 3); wall(17.9, 3, 18, 3);
  wall(-6, 3, -6, 5); wall(-6, 9, -6, 11); wall(6, 3, 6, 11);

  const carpets = {};
  const tints = { reloj: '#E6EEFB', lab: '#E8F3F5', analista: '#EEEAF8', ventanilla: '#F6EFE4', monitoreo: '#E4EAF3' };
  Object.entries(AREAS).forEach(([id, a]) => {
    const [x1, x2, z1, z2] = a.rect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1 - 0.5, z2 - z1 - 0.5), new THREE.MeshStandardMaterial({ color: C(tints[id]), roughness: 0.9, emissive: C('#2563EB'), emissiveIntensity: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, 0.205, (z1 + z2) / 2); m.receiveShadow = true; interior.add(m); carpets[id] = m;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: textTex([`DESPACHO ${a.num}`, a.name.length > 18 ? a.name.split(' de ')[0] : a.name]) }));
    const zs = z1 < 0 ? z2 + 0.17 : z1 - 0.17;
    sign.position.set({ reloj: -10, lab: 2.2, analista: 14, ventanilla: -9.5, monitoreo: 10.5 }[id], 1.65, zs);
    if (z1 > 0) sign.rotation.y = Math.PI;
    interior.add(sign);
  });
  const white = plastic('#FFFFFF'), navy = plastic('#1E3A5F'), screen = plastic('#1E3A5F', { emissive: C('#3B82F6'), emissiveIntensity: 0.35 });
  const desk = (x, z, rot = 0, w = 2.8) => {
    const g = new THREE.Group(); g.add(box(w, 0.12, 1.2, white, 0, 1.1, 0)); g.add(box(w - 0.1, 0.9, 0.08, plastic('#E3EAF3'), 0, 0.62, 0.52));
    [[-w / 2 + 0.1], [w / 2 - 0.1]].forEach(([lx]) => g.add(box(0.1, 0.95, 1.1, plastic('#E3EAF3'), lx, 0.62, 0)));
    g.add(box(0.9, 0.58, 0.06, screen, 0.5, 1.6, -0.3)); g.add(box(0.1, 0.3, 0.1, navy, 0.5, 1.25, -0.3)); g.add(box(0.8, 0.04, 0.28, plastic('#D9DEE6'), -0.2, 1.18, 0.15));
    g.position.set(x, 0.18, z); g.rotation.y = rot; interior.add(g); addAABB(x - w / 2, z - 0.6, x + w / 2, z + 0.6); return g;
  };
  const plant = (x, z) => {
    const g = new THREE.Group(); const p = cyl(0.34, 0.26, 0.6, white); p.position.y = 0.3; g.add(p);
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 6), plastic('#5E9A55')); l.position.set(Math.cos(i) * 0.25, 1.05, Math.sin(i) * 0.25); l.rotation.set(Math.sin(i) * 0.5, 0, Math.cos(i) * 0.5); g.add(l); }
    g.position.set(x, 0.18, z); interior.add(g); addAABB(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
  };
  // reloj
  desk(-11, -7.4);
  const clock = new THREE.Group(); const face = cyl(1.15, 1.15, 0.14, white, 40); face.rotation.x = Math.PI / 2; clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 10, 40), navy); clock.add(rim);
  const hand1 = box(0.08, 0.8, 0.04, navy, 0, 0.35, 0.1, false), hand2 = box(0.06, 0.6, 0.04, plastic('#2563EB'), 0, 0.26, 0.12, false);
  const h1 = new THREE.Group(); h1.add(hand1); const h2 = new THREE.Group(); h2.add(hand2); h2.rotation.z = 2; clock.add(h1, h2);
  clock.position.set(-11, 2.3, -10.75); interior.add(clock);
  const board = box(2.2, 0.6, 0.12, navy, -15.2, 2.5, -10.78); interior.add(board);
  ['#DC2626', '#D97706', '#16A34A', '#64748B'].forEach((c, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), plastic(c, { emissive: C(c), emissiveIntensity: 0.6 })); l.position.set(-15.95 + i * 0.5, 2.5, -10.68); interior.add(l); });
  plant(-17.2, -10.2);
  // lab
  desk(1.2, -7.4);
  interior.add(box(5, 1.1, 1, white, 0, 0.73, -10.2)); addAABB(-2.5, -10.8, 2.5, -9.7);
  const glass = new THREE.MeshStandardMaterial({ color: C('#DBEAFE'), transparent: true, opacity: 0.45, roughness: 0.1 });
  ['#2563EB', '#60A5FA', '#1E3A5F', '#93C5FD', '#2563EB'].forEach((c, i) => {
    const t = cyl(0.13, 0.13, 0.8, glass, 12); t.position.set(-1.8 + i * 0.5, 1.7, -10.2); interior.add(t);
    const f = cyl(0.11, 0.11, 0.3 + (i % 3) * 0.15, plastic(c, { emissive: C(c), emissiveIntensity: 0.3 }), 12); f.position.set(-1.8 + i * 0.5, 1.45 + (i % 3) * 0.07, -10.2); interior.add(f);
  });
  const flask = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), glass); flask.position.set(1.4, 1.65, -10.2); interior.add(flask);
  plant(5.2, -10.2);
  // analista
  const ad = desk(12.5, -7.4, 0, 3.4);
  [-1, 0, 1].forEach(i => { const s = box(0.85, 0.55, 0.06, screen, i * 0.9, 1.6, -0.35); s.rotation.y = -i * 0.35; ad.add(s); });
  plant(17.2, -10.2);
  // ventanilla
  interior.add(box(1.1, 1.2, 4.2, white, -6.9, 0.78, 7)); addAABB(-7.5, 4.9, -6.3, 9.1);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 4), glass); pane.position.set(-6.4, 2.0, 7); interior.add(pane);
  interior.add(box(0.9, 0.7, 0.7, navy, -6.9, 1.73, 5.4)); interior.add(box(0.1, 0.06, 0.5, plastic('#0F1D30'), -6.45, 1.85, 5.4, false));
  [0, 1].forEach(i => { const s = cyl(0.12, 0.16, 0.24, i ? plastic('#2563EB') : navy, 12); s.position.set(-6.9, 1.5, 8 + i * 0.4); interior.add(s); });
  interior.add(box(2.4, 1.6, 0.8, plastic('#E3EAF3'), -16, 1, 10.4)); addAABB(-17.2, 10, -14.8, 11);
  plant(-17.2, 4.0);
  // monitoreo
  const vw = new THREE.Group();
  const [mc, mx] = canvas(512, 256); mx.fillStyle = '#12233D'; mx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 70; i++) { mx.fillStyle = ['#60A5FA', '#93C5FD', '#2563EB'][i % 3]; mx.beginPath(); mx.arc((i * 97) % 512, (i * 53) % 256, 3 + (i % 4), 0, 7); mx.fill(); }
  mx.strokeStyle = '#3B82F6'; mx.lineWidth = 2; for (let i = 0; i < 8; i++) { mx.beginPath(); mx.moveTo(0, i * 36); mx.bezierCurveTo(160, i * 30 + 40, 320, i * 36 - 30, 512, i * 34); mx.stroke(); }
  const mapT = tex(mc);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const t = mapT.clone(); t.needsUpdate = true; t.offset.set(i / 3, j / 2); t.repeat.set(1 / 3, 1 / 2);
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.05, 0.1), [navy, navy, navy, navy, new THREE.MeshStandardMaterial({ map: t, emissive: C('#FFFFFF'), emissiveMap: t, emissiveIntensity: 0.7 }), navy]);
    s.position.set(-1.95 + i * 1.95, 0.55 + (1 - j) * 1.1, 0); vw.add(s);
  }
  vw.position.set(10.5, 0.9, 3.25); interior.add(vw);
  desk(10.5, 6.2, Math.PI);
  plant(17.2, 10.2);
  // reception
  const rd = new THREE.Group(); rd.add(box(5, 1.15, 1.1, white, 0, 0.76, 0)); rd.add(box(5.02, 0.2, 1.12, plastic('#2563EB'), 0, 0.5, 0, false)); rd.position.set(0, 0, 6); interior.add(rd); addAABB(-2.5, 5.45, 2.5, 6.55);
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), plastic('#DBEAFE')); emblem.rotation.x = -Math.PI / 2; emblem.position.set(0, 0.21, 9); interior.add(emblem);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.9, 48), plastic('#2563EB')); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.215, 9); interior.add(ring);
  plant(-5.2, 10.2); plant(5.2, 10.2); plant(-5.2, 3.8);
  // synapse lines
  const synM = new THREE.MeshBasicMaterial({ color: C('#7FB0FF') });
  interior.add(box(34, 0.02, 0.12, synM, 0, 0.22, 0, false));
  const paths = Object.values(AREAS).map(a => [new THREE.Vector3(0, 0.3, 4.5), new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(a.door[0], 0.3, 0), new THREE.Vector3(a.door[0], 0.3, a.door[1] + (a.door[1] < 0 ? -1.2 : 1.2))]);
  paths.forEach(p => { const a = p[2], b = p[3]; interior.add(box(0.12, 0.02, Math.abs(b.z - a.z), synM, a.x, 0.22, (a.z + b.z) / 2, false)); });
  interior.add(box(0.12, 0.02, 4.5, synM, 0, 0.22, 2.25, false));
  const pulses = paths.map((p, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: C('#2563EB') })); interior.add(s); return { s, p, t: i * 0.2 }; });

  // agents
  const agents = {};
  const place = (id, look, x, z, ry) => { const f = makeFig(look); f.position.set(x, 0.18, z); f.rotation.y = ry; interior.add(f); agents[id] = f; addAABB(x - 0.5, z - 0.4, x + 0.5, z + 0.4); };
  place('reloj', LOOKS.reloj, -11, -8.7, 0); place('lab', LOOKS.lab, 1.2, -8.7, 0); place('analista', LOOKS.analista, 12.5, -8.7, 0);
  place('ventanilla', LOOKS.ventanilla, -8.3, 7, Math.PI / 2); place('monitoreo', LOOKS.monitoreo, 10.5, 7.4, Math.PI); place('guia', LOOKS.guia, 0, 4.9, 0);

  const hits = Object.entries(AREAS).map(([id, a]) => {
    const [x1, x2, z1, z2] = a.rect;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, 3.2, z2 - z1), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set((x1 + x2) / 2, 1.6, (z1 + z2) / 2); m.userData.area = id; interior.add(m); return m;
  });

  // player
  const player = makeFig(LOOKS.visitante); player.position.set(0, 0.18, 24); player.rotation.y = Math.PI; scene.add(player);
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: C('#2563EB'), transparent: true, opacity: 0.8 }));
  marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);

  // labels
  const mkLabel = (html, styles = {}) => {
    const d = document.createElement('div'); d.innerHTML = html;
    Object.assign(d.style, { position: 'absolute', left: '0', top: '0', transform: 'translate(-50%,-100%)', whiteSpace: 'nowrap', fontFamily: FONT_SANS, ...styles });
    labelLayer.appendChild(d); return d;
  };
  const pill = { background: 'rgba(255,255,255,.95)', border: '1px solid #E3EAF3', borderRadius: '999px', padding: '5px 11px 5px 6px', fontSize: '12px', fontWeight: '700', color: '#1E3A5F', boxShadow: '0 4px 12px rgba(30,58,95,.12)', display: 'flex', gap: '7px', alignItems: 'center' };
  const labels = [];
  Object.entries(AREAS).forEach(([id, a]) => {
    const [x1, x2, z1, z2] = a.rect;
    labels.push({ el: mkLabel(`<span style="background:#1E3A5F;color:#fff;border-radius:999px;padding:2px 7px;font-family:${FONT_MONO};font-size:10.5px">${a.num}</span>${a.name}`, pill), p: new THREE.Vector3((x1 + x2) / 2, 3.6, (z1 + z2) / 2), inside: true, id });
  });
  labels.push({ el: mkLabel(`<span style="background:#2563EB;color:#fff;border-radius:999px;padding:2px 7px;font-size:10.5px">★</span>Recepción`, pill), p: new THREE.Vector3(0, 3.6, 7.5), inside: true });
  labels.push({ el: mkLabel(`<span style="background:#2563EB;color:#fff;border-radius:999px;padding:2px 7px;font-size:10.5px">→</span>La entrada`, pill), p: new THREE.Vector3(0, 5.4, 13), inside: false });
  const youL = mkLabel('Tú', { background: '#2563EB', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '999px' });
  const bubble = mkLabel('', { background: '#FFFFFF', border: '1px solid #E3EAF3', borderRadius: '14px', padding: '10px 13px', fontSize: '13px', color: '#0F172A', maxWidth: '240px', whiteSpace: 'normal', width: 'max-content', boxShadow: '0 12px 28px rgba(30,58,95,.18)', display: 'none', lineHeight: '1.4' });

  // state
  const keys = {}; let paused = false, mode = 'intro', dest = [], pendingOpen = null, near = null, hover = null, insideNow = false, disposed = false, flyT = 0;
  const camOffset = new THREE.Vector3();
  const blocked = (x, z, r = 0.42) => {
    if (Math.abs(x) > 42 || Math.abs(z) > 36) return true;
    for (const [a, b, c, d] of walls) if (x > a - r && x < c + r && z > b - r && z < d + r) return true;
    for (const [a, b, c, d] of obstacles) if (x > a - r && x < c + r && z > b - r && z < d + r) return true;
    return false;
  };
  const inFoot = (x, z) => x > -18 && x < 18 && z > -11 && z < 11;
  const areaAt = (x, z) => { for (const [id, a] of Object.entries(AREAS)) { const [x1, x2, z1, z2] = a.rect; if (x > x1 && x < x2 && z > z1 && z < z2) return id; } return null; };
  const roomExit = id => { const a = AREAS[id]; return [a.door[0], a.door[1] < 0 ? -1.2 : 1.2]; };
  const routeTo = (tx, tz) => {
    const px = player.position.x, pz = player.position.z, r = [];
    const fromArea = areaAt(px, pz), toArea = areaAt(tx, tz);
    if (!inFoot(px, pz) && inFoot(tx, tz)) r.push([0, 15], [0, 9.5], [0, 1.5]);
    if (fromArea && fromArea !== toArea) { const a = AREAS[fromArea]; r.push(a.inside, roomExit(fromArea)); }
    if (inFoot(px, pz) && !inFoot(tx, tz)) { if (!fromArea) r.push([px, 0.5]); r.push([0, 1.5], [0, 9.5], [0, 15]); }
    if (toArea && toArea !== fromArea) { r.push([AREAS[toArea].door[0], roomExit(toArea)[1]], AREAS[toArea].door, AREAS[toArea].inside); }
    else if (inFoot(tx, tz) && !toArea && fromArea) r.push([tx, 0.5]);
    r.push([tx, tz]); return r;
  };
  function goTo(id) { const a = AREAS[id]; mode = 'follow'; controls.autoRotate = false; dest = routeTo(a.inside[0], a.inside[1]); pendingOpen = id; }
  function enter() { mode = 'fly'; flyT = 0; controls.autoRotate = false; dest = routeTo(0, 8.2); pendingOpen = null; }
  function overview() { mode = 'intro'; controls.autoRotate = !reduced; }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (insideNow || interior.visible) { const h = ray.intersectObjects(hits)[0]; if (h && insideNow) return { area: h.object.userData.area, point: h.point }; }
    const g = ray.intersectObjects([floor, plaza, sidewalk, ground])[0]; return g ? { point: g.point } : null;
  };
  let downAt = null;
  const onDown = e => { downAt = [e.clientX, e.clientY]; };
  const onUp = e => {
    if (!downAt || paused) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved > 6) return;
    const p = pick(e); if (!p) return; if (mode === 'intro') { mode = 'follow'; controls.autoRotate = false; }
    if (p.area) return goTo(p.area);
    dest = routeTo(p.point.x, p.point.z); pendingOpen = null; marker.position.set(p.point.x, 0.25, p.point.z); marker.visible = true;
  };
  const onMove = e => { if (paused) return; const p = pick(e); const h = p && p.area ? p.area : null; if (h !== hover) { hover = h; renderer.domElement.style.cursor = h ? 'pointer' : 'default'; } };
  const onKey = (e, v) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = v; if (v && !paused) { e.preventDefault(); dest = []; pendingOpen = null; if (mode !== 'follow') { mode = 'follow'; controls.autoRotate = false; } } }
    if (v && k === 'e' && near && !paused) cb.onOpen && cb.onOpen(near);
  };
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp); renderer.domElement.addEventListener('pointermove', onMove);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(el); resize();

  const clock3 = new THREE.Clock(); const v3 = new THREE.Vector3(); let shellY = 0, walkPhase = 0;
  function frame() {
    if (disposed) return; requestAnimationFrame(frame);
    const dt = Math.min(clock3.getDelta(), 0.05), t = clock3.elapsedTime;
    // movement
    let mx = 0, mz = 0;
    if (!paused) {
      const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), s = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      if (f || s) {
        camera.getWorldDirection(v3); v3.y = 0; v3.normalize();
        mx = v3.x * f - v3.z * s; mz = v3.z * f + v3.x * s;
      } else if (dest.length) {
        const [tx, tz] = dest[0], dx = tx - player.position.x, dz = tz - player.position.z, d = Math.hypot(dx, dz);
        if (d < 0.25) { dest.shift(); if (!dest.length) { marker.visible = false; if (pendingOpen) { const id = pendingOpen; pendingOpen = null; cb.onOpen && cb.onOpen(id); } } }
        else { mx = dx / d; mz = dz / d; }
      }
    }
    const moving = !!(mx || mz);
    if (moving) {
      const sp = (dest.length ? 7.5 : 6.5) * dt, nx = player.position.x + mx * sp, nz = player.position.z + mz * sp;
      const viaRoute = dest.length && !(keys.w || keys.s || keys.a || keys.d);
      if (viaRoute) { player.position.x = nx; player.position.z = nz; }
      else { if (!blocked(nx, player.position.z)) player.position.x = nx; if (!blocked(player.position.x, nz)) player.position.z = nz; }
      const target = Math.atan2(mx, mz); let dr = target - player.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); player.rotation.y += dr * Math.min(1, dt * 12);
      walkPhase += dt * 11;
    } else walkPhase *= 0.85;
    const ud = player.userData, sw = Math.sin(walkPhase) * (moving ? 0.7 : 0);
    ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw; ud.arms[0].rotation.x = -sw * 0.8; ud.arms[1].rotation.x = sw * 0.8;
    // inside / shell
    const nowIn = inFoot(player.position.x, player.position.z) || player.position.z < 12 && Math.abs(player.position.x) < 3 && player.position.z > 10;
    if (nowIn !== insideNow) { insideNow = nowIn; cb.onInside && cb.onInside(nowIn); }
    shellY += ((insideNow ? 40 : 0) - shellY) * Math.min(1, dt * (reduced ? 60 : 3.2));
    shell.position.y = shellY; shell.visible = shellY < 38; interior.visible = shellY > 0.5;
    // near
    const n = insideNow ? areaAt(player.position.x, player.position.z) : null;
    if (n !== near) { near = n; cb.onNear && cb.onNear(n); }
    // agents
    const active = hover || near;
    Object.entries(agents).forEach(([id, f], i) => {
      const u = f.userData, waving = id === active || (id === 'guia' && insideNow && !active && Math.hypot(player.position.x, player.position.z - 6) < 5);
      if (waving) { u.arms[1].rotation.x = -2.9; u.arms[1].rotation.z = 0.12 + Math.sin(t * 9) * 0.35; u.arms[0].rotation.x = 0; u.head.rotation.y = Math.sin(t * 2) * 0.1; }
      else if (id === 'guia') { u.arms[0].rotation.x = u.arms[1].rotation.x = 0; u.arms[1].rotation.z = 0.12; }
      else { u.arms[1].rotation.z = 0.12; u.arms[0].rotation.x = -1.15 + Math.sin(t * 14 + i) * 0.07; u.arms[1].rotation.x = -1.15 + Math.cos(t * 14 + i) * 0.07; u.head.rotation.y = Math.sin(t * 0.7 + i) * 0.15; }
    });
    Object.entries(carpets).forEach(([id, m]) => { const on = id === active; m.material.emissiveIntensity += ((on ? 0.12 : 0) - m.material.emissiveIntensity) * 0.2; });
    // ambient anim
    if (!reduced) {
      h1.rotation.z = -t * 0.5; h2.rotation.z = 2 - t * 0.04;
      flags.forEach((f, i) => { f.parent.rotation.y = Math.sin(t * 1.4 + i) * 0.25; });
      cars.forEach(c => { c.t = (c.t + dt * 0.018) % 1; const L = c.t * 4, side = Math.floor(L), u = L - side; const P = [[-46, -40], [46, -40], [46, 40], [-46, 40]], a = P[side], b = P[(side + 1) % 4];
        const off = 1.4; c.g.position.set(a[0] + (b[0] - a[0]) * u, 0.07, a[1] + (b[1] - a[1]) * u); c.g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.PI / 2;
        if (side === 0) c.g.position.z += off; if (side === 2) c.g.position.z -= off; if (side === 1) c.g.position.x -= off; if (side === 3) c.g.position.x += off; });
      pulses.forEach(pu => { pu.t = (pu.t + dt * 0.35) % 1; const segs = pu.p, L = [0]; for (let i = 1; i < segs.length; i++) L.push(L[i - 1] + segs[i].distanceTo(segs[i - 1])); const d = pu.t * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < d) i++; pu.s.position.lerpVectors(segs[i - 1], segs[i], (d - L[i - 1]) / (L[i] - L[i - 1] || 1)); });
      if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.1);
    }
    // camera
    if (mode !== 'intro') {
      const tgt = v3.set(player.position.x, 1.2, player.position.z);
      const delta = tgt.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 5));
      controls.target.add(delta); camera.position.add(delta);
      if (mode === 'fly') {
        flyT += dt; camOffset.copy(camera.position).sub(controls.target);
        const want = 26, len = camOffset.length(); camOffset.setLength(len + (want - len) * Math.min(1, dt * (reduced ? 60 : 2)));
        camera.position.copy(controls.target).add(camOffset); if (Math.abs(len - want) < 0.5 || flyT > 3) mode = 'follow';
      }
    }
    controls.update();
    renderer.render(scene, camera);
    // labels
    const w = el.clientWidth, h = el.clientHeight;
    const place2d = (d, p, show) => { if (!show) { d.style.display = 'none'; return; } v3.copy(p).project(camera); if (v3.z > 1) { d.style.display = 'none'; return; } d.style.display = ''; d.style.transform = `translate(${(v3.x * 0.5 + 0.5) * w}px,${(-v3.y * 0.5 + 0.5) * h}px) translate(-50%,-100%)`; };
    labels.forEach(l => place2d(l.el, l.p, l.inside ? insideNow : !insideNow && mode !== 'intro'));
    place2d(youL, new THREE.Vector3(player.position.x, 3.4, player.position.z), mode !== 'intro');
    if (active && insideNow) { const a = AREAS[active], f = agents[active]; bubble.innerHTML = `${a.line}<div style="margin-top:5px;font-size:11.5px;font-weight:700;color:#2563EB">${near === active ? 'Pulsa E o haz clic para entrar' : 'Clic para ir'}</div>`; bubble.style.display = ''; place2d(bubble, new THREE.Vector3(f.position.x, 3.5, f.position.z), true); }
    else bubble.style.display = 'none';
  }
  frame(); cb.onReady && cb.onReady();

  return {
    enter, overview, goTo,
    setPaused(b) { paused = b; Object.keys(keys).forEach(k => keys[k] = false); },
    openNear() { if (near) cb.onOpen && cb.onOpen(near); },
    exitBuilding() { mode = 'follow'; dest = routeTo(0, 18); pendingOpen = null; },
    dispose() { disposed = true; ro.disconnect(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); controls.dispose(); renderer.dispose(); el.innerHTML = ''; }
  };
}

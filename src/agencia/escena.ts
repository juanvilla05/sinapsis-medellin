/**
 * Oficina isométrica 2D de la Agencia (diseño de Claude Design, oficina-escena.js), generada como texto SVG.
 * Las cifras de tableros y globos llegan por parámetro desde el catálogo de MEData; Medellín es una ilustración
 * estilizada, sin logos ni escudos. 1 u = 26 px; x avanza abajo a la derecha, y abajo a la izquierda, z es la altura.
 */
import { mezclar as mix, personaSvg, type AspectoAgente, type IdEditable } from "./persona";

export type IdSala = "reloj" | "lab" | "ventanilla" | "analista" | "monitoreo" | "comunicaciones" | "salida";
export type EstadoGlobo = "trabajando" | "esperando" | "te-necesita" | "sin-senal";

export interface DatosEscena {
  total: number;
  evaluables: number;
  atrasados: number;
  pctTxt: string;
  porEstado: { "al-dia": number; atrasado: number; critico: number; "sin-periodicidad": number };
  /** "10 nov 2026" */
  fechaCorta: string;
  globos: Record<Exclude<IdSala, "salida">, { cifra: string; estado: EstadoGlobo }>;
  /** texto accesible de cada sala */
  etiquetas: Record<IdSala, string>;
}

const U = 26;
const C = U * 0.8660254;
const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * C, ((x + y) * U) / 2 - z * U];
const f = (n: number) => Math.round(n * 10) / 10;
type Q = [number, number, number?];
const pts = (a: Q[]) =>
  a
    .map((q) => {
      const v = P(q[0], q[1], q[2] || 0);
      return f(v[0]) + "," + f(v[1]);
    })
    .join(" ");
const poly = (a: Q[], fill: string, ex = "") => `<polygon points="${pts(a)}" fill="${fill}" ${ex}/>`;
const osc = (c: string, t: number) => mix(c, "#0B1220", t);
const rnd = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const M = (X: number, Y: number, a: number, b: number, c: number, d: number) => `matrix(${a},${b},${c},${d},${f(X)},${f(Y)})`;
const plano = (tipo: "muroY" | "muroX" | "piso", x: number, y: number, z: number, inner: string) => {
  const v = P(x, y, z);
  const m = { muroY: [0.866, 0.5, 0, 1], muroX: [0.866, -0.5, 0, 1], piso: [0.866, 0.5, -0.866, 0.5] }[tipo] as [number, number, number, number];
  return `<g transform="${M(v[0], v[1], ...m)}">${inner}</g>`;
};
type Colores = string | { t: string; l?: string; r?: string };
function caja(x: number, y: number, z: number, w: number, d: number, h: number, c: Colores, ex = "") {
  const t = typeof c === "string" ? c : c.t;
  const l = (typeof c !== "string" && c.l) || osc(t, 0.1);
  const r = (typeof c !== "string" && c.r) || osc(t, 0.2);
  return `<g ${ex}>${poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], l)}${poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], r)}${poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], t)}</g>`;
}
const sombra = (x: number, y: number, w: number, d: number, o = 0.14) =>
  poly([[x + 0.1, y + 0.2], [x + w + 0.4, y + 0.2], [x + w + 0.4, y + d + 0.45], [x + 0.1, y + d + 0.45]], `rgba(8,15,30,${o})`, 'filter="url(#ofi-suave)"');
const at = (x: number, y: number, z: number, inner: string, cls = "", st = "") => {
  const v = P(x, y, z);
  return `<g transform="translate(${f(v[0])},${f(v[1])})"><g class="${cls}" style="${st}">${inner}</g></g>`;
};
const MONO = "JetBrains Mono, ui-monospace, monospace";
const SANS = "Plus Jakarta Sans, system-ui, sans-serif";

interface Tema {
  base: string; grid: string; muroT: string; muroL: string; muroR: string; mont1: string; mont2: string;
  mesa: string; mesaL: string; mesaR: string; silla: string; tinta: string; tinta2: string; burb: string; burbB: string;
  planta: string; planta2: string; maceta: string; tablero: string; tableroB: string;
  est: Record<EstadoGlobo, string>; osc: boolean;
}
const CLA: Tema = { base: "#EEF2F8", grid: "#E2E8F1", muroT: "#FFFFFF", muroL: "#E7EDF5", muroR: "#D6DFEB", mont1: "#DCE5F1", mont2: "#C9D6E8", mesa: "#FFFFFF", mesaL: "#E2E8F0", mesaR: "#CBD5E1", silla: "#334155", tinta: "#0F172A", tinta2: "#475569", burb: "#FFFFFF", burbB: "#E3EAF3", planta: "#3F9D6E", planta2: "#2F7D57", maceta: "#F1F5F9", tablero: "#FFFFFF", tableroB: "#E3EAF3", est: { trabajando: "#15803D", esperando: "#475569", "te-necesita": "#B91C1C", "sin-senal": "#B45309" }, osc: false };
const OSC: Tema = { base: "#0E1A2C", grid: "#15243B", muroT: "#2A3D5A", muroL: "#1A2B44", muroR: "#142339", mont1: "#14233B", mont2: "#1B2E4C", mesa: "#33476A", mesaL: "#24364F", mesaR: "#1B2A40", silla: "#0B1220", tinta: "#E2E8F0", tinta2: "#94A3B8", burb: "#142339", burbB: "#2C4060", planta: "#2F8A60", planta2: "#226B4A", maceta: "#2A3D5A", tablero: "#142339", tableroB: "#2C4060", est: { trabajando: "#4ADE80", esperando: "#94A3B8", "te-necesita": "#F87171", "sin-senal": "#FBBF24" }, osc: true };

function silla(x: number, y: number, T: Tema) {
  return caja(x, y, 0, 0.7, 0.7, 0.45, { t: T.silla, l: osc(T.silla, 0.15), r: osc(T.silla, 0.28) }) + caja(x, y - 0.05, 0.45, 0.7, 0.14, 0.75, { t: T.silla, l: osc(T.silla, 0.1), r: osc(T.silla, 0.25) });
}
function mesa(x: number, y: number, w: number, d: number, T: Tema, h = 0.75) {
  return sombra(x, y, w, d) + caja(x + 0.08, y + 0.08, 0, 0.12, 0.12, h - 0.06, T.mesaR) + caja(x + w - 0.2, y + d - 0.2, 0, 0.12, 0.12, h - 0.06, T.mesaR) + caja(x, y + d - 0.2, 0, 0.12, 0.12, h - 0.06, T.mesaR) + caja(x, y, h - 0.08, w, d, 0.08, { t: T.mesa, l: T.mesaL, r: T.mesaR });
}
function monitor(x: number, y: number, z: number, T: Tema, brillo = "#2563EB") {
  return caja(x + 0.3, y + 0.15, z, 0.1, 0.1, 0.25, T.mesaR) + caja(x, y, z + 0.25, 0.75, 0.08, 0.5, { t: "#1E293B", l: "#0F172A", r: "#1E293B" }) + poly([[x + 0.05, y + 0.081, z + 0.3], [x + 0.7, y + 0.081, z + 0.3], [x + 0.7, y + 0.081, z + 0.7], [x + 0.05, y + 0.081, z + 0.7]], brillo, 'opacity=".85"');
}
function planta(x: number, y: number, T: Tema, g = 1) {
  return sombra(x, y, 0.6, 0.6, 0.12) + caja(x, y, 0, 0.6, 0.6, 0.55, { t: osc(T.maceta, 0.08), l: T.maceta, r: osc(T.maceta, 0.12) }) + at(x + 0.3, y + 0.3, 1.05, `<circle cx="-5" cy="2" r="${8 * g}" fill="${T.planta2}"/><circle cx="5" cy="0" r="${8.5 * g}" fill="${T.planta}"/><circle cx="0" cy="-7" r="${8 * g}" fill="${T.planta}"/><circle cx="2" cy="-3" r="${4 * g}" fill="${mix(T.planta, "#FFFFFF", 0.25)}" opacity=".6"/>`);
}
function burbuja(x: number, y: number, z: number, nombre: string, cifra: string, col: string, T: Tema, vivo = false) {
  const w = Math.round(30 + nombre.length * 5.5 + cifra.length * 7.4);
  const v = P(x, y, z);
  return `<g transform="translate(${f(v[0])},${f(v[1])})" class="burbuja"><path d="M-5 -6 L0 0 L5 -6z" fill="${T.burb}" stroke="${T.burbB}"/><rect x="${-w / 2}" y="-27" width="${w}" height="22" rx="11" fill="${T.burb}" stroke="${T.burbB}" filter="url(#ofi-sombraB)"/><rect x="-4.5" y="-7" width="9" height="2.5" fill="${T.burb}"/><circle cx="${-w / 2 + 11}" cy="-16" r="3.6" fill="${col}" class="${vivo ? "latido" : ""}"/><text x="${-w / 2 + 19}" y="-12.2" font-family="${SANS}" font-size="10.5" font-weight="600" fill="${T.tinta}">${esc(nombre)}</text><text x="${w / 2 - 9}" y="-12.2" text-anchor="end" font-family="${MONO}" font-size="11" font-weight="700" fill="${col}">${esc(cifra)}</text></g>`;
}

interface DefSala { x: number; y: number; w: number; d: number; piso: string; borde: string; n: string }
export const SALAS_ESCENA: Record<"archivo" | "recepcion" | IdSala, DefSala> = {
  archivo: { x: 0, y: 0, w: 6, d: 6, piso: "#ECF0F6", borde: "#C3CEDF", n: "ARCHIVO MEDATA" },
  reloj: { x: 6.4, y: 0, w: 6.6, d: 6, piso: "#FEF7E6", borde: "#F3D49B", n: "01 · RELOJ DE FRESCURA" },
  lab: { x: 13.4, y: 0, w: 6.6, d: 6, piso: "#E9FAF6", borde: "#9FE3D6", n: "02 · LABORATORIO DE LIMPIEZA" },
  monitoreo: { x: 20.4, y: 0, w: 7.6, d: 6, piso: "#EAF8F1", borde: "#A7E3C7", n: "05 · SALA DE MONITOREO" },
  ventanilla: { x: 0, y: 6.4, w: 6.6, d: 6.4, piso: "#F3F0FE", borde: "#CABDFA", n: "03 · VENTANILLA DE APERTURA" },
  analista: { x: 0, y: 13.2, w: 6.6, d: 6.8, piso: "#EDF4FF", borde: "#B9D3FB", n: "04 · ANALISTA · PULSOBOT" },
  recepcion: { x: 8, y: 7.6, w: 9.6, d: 5.2, piso: "#F8FAFD", borde: "#D5DEEA", n: "RECEPCIÓN" },
  comunicaciones: { x: 8, y: 14, w: 10.4, d: 6, piso: "#FFF4ED", borde: "#FDC9A9", n: "06 · COMUNICACIONES" },
  salida: { x: 19.6, y: 7.6, w: 8.4, d: 12.4, piso: "#0B1220", borde: "#1E3A8A", n: "SALIDA A PULSO" },
};

function colSala(id: string, s: DefSala, T: Tema) {
  if (id === "salida") return { piso: "#0B1220", borde: "#2563EB", txt: "#93C5FD" };
  if (!T.osc) return { piso: s.piso, borde: s.borde, txt: mix(s.borde, "#0F172A", 0.62) };
  return { piso: mix(s.borde, "#0E1A2C", 0.84), borde: mix(s.borde, "#0E1A2C", 0.35), txt: s.borde };
}

const ronda = (x0: number, y0: number, x1: number, y1: number, del: string) => {
  const A = P(x0, y0), B = P(x1, y1);
  return `--dx:${f(B[0] - A[0])}px;--dy:${f(B[1] - A[1])}px;--del:${del}`;
};

export function escenaSvg(oscuro: boolean, quieto: boolean, A: Record<IdEditable, AspectoAgente>, D: DatosEscena): string {
  const T = oscuro ? OSC : CLA;
  const S = SALAS_ESCENA;
  let o = "";
  o += `<defs><filter id="ofi-suave" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter><filter id="ofi-sombraB" x="-20%" y="-40%" width="140%" height="190%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#0B1220" flood-opacity="${T.osc ? 0.5 : 0.12}"/></filter><linearGradient id="ofi-bronce" x1="0" x2="1"><stop offset="0" stop-color="#D49A5C"/><stop offset="1" stop-color="#7C4F24"/></linearGradient><radialGradient id="ofi-bot" cx=".35" cy=".3"><stop offset="0" stop-color="#93C5FD"/><stop offset=".6" stop-color="#2563EB"/><stop offset="1" stop-color="#1E3A8A"/></radialGradient></defs>`;
  // montañas del valle de Aburrá
  const sierra = (eje: "x" | "y", desde: number, hasta: number, off: number, perfil: number[], col: string) => {
    const a: Q[] = [];
    const n = perfil.length - 1;
    for (let i = 0; i <= n; i++) {
      const t = desde + ((hasta - desde) * i) / n;
      a.push(eje === "x" ? [t, off, perfil[i]] : [off, t, perfil[i]]);
    }
    a.push(eje === "x" ? [hasta, off, 0] : [off, hasta, 0]);
    a.unshift(eje === "x" ? [desde, off, 0] : [off, desde, 0]);
    return poly(a, col);
  };
  o += sierra("x", -3, 32, -3.4, [2, 3.6, 5.2, 4.4, 6.4, 7.4, 6, 5.2, 6.8, 7.8, 6.6, 5, 4.2, 5.4, 3.8, 2.6], T.mont1);
  o += sierra("y", -3, 22, -3.4, [2.6, 4.8, 6.6, 5.6, 7.2, 6, 4.6, 5.8, 4.2, 3, 2.2], T.mont1);
  o += sierra("x", -2, 31, -1.6, [1.2, 2.6, 3.4, 2.8, 4.2, 3.6, 2.6, 3.8, 4.6, 3.4, 2.4, 3.2, 2], T.mont2);
  o += sierra("y", -2, 21, -1.6, [1.6, 3.4, 2.6, 4, 3.2, 2.2, 3, 2.2, 1.4], T.mont2);
  // piso y muros
  o += poly([[0, 0], [28, 0], [28, 20], [0, 20]], T.base);
  for (let i = 2; i < 28; i += 2) o += `<polyline points="${pts([[i, 0], [i, 20]])}" stroke="${T.grid}" stroke-width="1" fill="none"/>`;
  for (let j = 2; j < 20; j += 2) o += `<polyline points="${pts([[0, j], [28, j]])}" stroke="${T.grid}" stroke-width="1" fill="none"/>`;
  o += caja(0, -0.35, 0, 28, 0.35, 2.7, { t: T.muroT, l: T.muroL, r: T.muroR });
  o += caja(-0.35, -0.35, 0, 0.35, 20.35, 2.7, { t: T.muroT, l: T.muroL, r: T.muroR });
  o += `<polyline points="${pts([[0, 0, 0.12], [28, 0, 0.12]])}" stroke="${T.muroR}" stroke-width="2" fill="none"/>`;

  const sala = (id: keyof typeof S, inner: string) => {
    const s = S[id];
    const c = colSala(id, s, T);
    const fijo = id === "archivo" || id === "recepcion";
    const etq = fijo ? "" : esc(D.etiquetas[id as IdSala]);
    return `<g class="sala" data-id="${id}" tabindex="${fijo ? -1 : 0}" role="${fijo ? "presentation" : "button"}"${fijo ? "" : ` aria-label="${etq}"`}>${poly([[s.x, s.y, 0.01], [s.x + s.w, s.y, 0.01], [s.x + s.w, s.y + s.d, 0.01], [s.x, s.y + s.d, 0.01]], c.piso, `class="piso" stroke="${c.borde}" stroke-width="1.6" stroke-linejoin="round"`)}${plano("piso", s.x + 0.35, s.y + s.d - 0.35, 0, `<text x="0" y="-2" font-family="${MONO}" font-size="9.5" font-weight="700" letter-spacing="1.4" fill="${c.txt}" class="etq">${s.n}</text>`)}${inner}</g>`;
  };

  // Archivo MEData
  let a = "";
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 1.55;
    a += sombra(x, 0.5, 1.2, 1, 0.18) + caja(x, 0.5, 0, 1.2, 1, 2.3, { t: "#334155", l: "#1E293B", r: "#0F172A" });
    for (let k = 0; k < 6; k++)
      a += poly([[x + 0.15, 1.51, 0.35 + k * 0.32], [x + 1.05, 1.51, 0.35 + k * 0.32], [x + 1.05, 1.51, 0.5 + k * 0.32], [x + 0.15, 1.51, 0.5 + k * 0.32]], "#0B1220") + at(x + 0.95, 1.52, 0.42 + k * 0.32, `<circle r="1.3" fill="${k % 2 ? "#34D399" : "#60A5FA"}" class="led" style="animation-delay:${f(-(i * 3 + k) * 0.37)}s"/>`);
  }
  ([[0.8, 3.4, 0], [1.75, 3.4, 0], [1.25, 3.3, 0.62], [3.2, 3.9, 0]] as [number, number, number][]).forEach((b) => {
    a += (b[2] ? "" : sombra(b[0], b[1], 0.85, 0.75)) + caja(b[0], b[1], b[2], 0.85, 0.75, 0.62, { t: "#E4C79C", l: "#D2AE7C", r: "#B9935F" }) + poly([[b[0] + 0.3, b[1] + 0.751, b[2] + 0.4], [b[0] + 0.6, b[1] + 0.751, b[2] + 0.4], [b[0] + 0.6, b[1] + 0.751, b[2] + 0.5], [b[0] + 0.3, b[1] + 0.751, b[2] + 0.5]], "#8B6B43");
  });
  a += plano("piso", 0.35, 5.2, 0, `<text x="0" y="-2" font-family="${SANS}" font-size="8.5" font-weight="600" fill="${T.tinta2}">${D.total} conjuntos · datos crudos</text>`);
  o += sala("archivo", a);

  // 01 Reloj: tablero con los estados reales del catálogo
  const est: [number, string, string][] = [
    [D.porEstado["al-dia"], "#16A34A", "al día"],
    [D.porEstado.atrasado, "#D97706", "atrasados"],
    [D.porEstado.critico, "#DC2626", "críticos"],
    [D.porEstado["sin-periodicidad"], "#94A3B8", "sin periodicidad"],
  ];
  const maxE = Math.max(1, ...est.map((q) => q[0]));
  let r = "";
  r += plano("muroY", 6.9, 0, 2.25, `<rect width="78" height="44" rx="3" fill="${T.tablero}" stroke="${T.tableroB}"/><text x="6" y="9" font-family="${MONO}" font-size="5.2" font-weight="700" letter-spacing=".6" fill="${T.tinta2}">ESTADO DEL CATÁLOGO</text>${est.map((q, i) => { const w = f(Math.max(2, (q[0] / maxE) * 44)); return `<rect x="6" y="${f(14 + i * 7.2)}" width="${w}" height="4.2" rx="1" fill="${q[1]}"/><text x="${f(10 + w)}" y="${f(17.6 + i * 7.2)}" font-family="${MONO}" font-size="4.4" fill="${T.tinta}">${q[0]} ${q[2]}</text>`; }).join("")}`);
  r += plano("muroY", 11.6, 0, 1.75, `<circle r="15" fill="${T.tablero}" stroke="${T.osc ? "#F3D49B" : "#0F172A"}" stroke-width="2.2"/>${Array.from({ length: 12 }, (_, i) => `<rect x="-.5" y="-13" width="1" height="${i % 3 ? 2 : 3.4}" fill="${T.tinta}" transform="rotate(${i * 30})"/>`).join("")}<rect x="-.9" y="-8.5" width="1.8" height="9" rx=".9" fill="${T.tinta}" class="aguja-h"/><rect x="-.5" y="-12" width="1" height="12.5" rx=".5" fill="#DC2626" class="aguja-m"/><circle r="1.6" fill="#DC2626"/>`);
  r += silla(8.9, 2.3, T);
  r += mesa(8.1, 3.2, 2.6, 1.1, T) + monitor(8.5, 3.3, 0.75, T, "#F59E0B") + caja(9.7, 3.5, 0.75, 0.55, 0.4, 0.04, "#FDE68A");
  r += at(11.4, 4.6, 0, personaSvg({ ...A.reloj, camina: true, senala: "ronda" }), "ronda", ronda(11.4, 4.6, 11.3, 1.25, "-2s"));
  r += planta(6.7, 0.4, T);
  o += sala("reloj", r);

  // 02 Laboratorio
  let l = "";
  l += plano("muroY", 14.2, 0, 2.3, `<rect width="96" height="46" rx="3" fill="${T.tablero}" stroke="${T.tableroB}"/><text x="7" y="10" font-family="${MONO}" font-size="5.2" font-weight="700" letter-spacing=".6" fill="${T.tinta2}">PUNTAJE DE CALIDAD</text><text x="7" y="30" font-family="${MONO}" font-size="15" font-weight="700" fill="${T.osc ? "#9FE3D6" : "#0F766E"}">0 → 98</text><rect x="7" y="35" width="82" height="4" rx="2" fill="${T.osc ? "#24364F" : "#E2E8F0"}"/><rect x="7" y="35" width="80" height="4" rx="2" fill="#14B8A6" class="barra-lab"/>`);
  l += mesa(14.3, 2.7, 3.8, 1, T, 0.9);
  ([[14.6, "#5EEAD4"], [15.3, "#A78BFA"], [16, "#FCD34D"], [17.4, "#5EEAD4"]] as [number, string][]).forEach((q, i) => {
    l += at(q[0] + 0.2, 3.1, 0.9, `<path d="M-2.4 -10 h4.8 v3 l3.6 7 q.6 1.6 -1.2 1.6 h-9.6 q-1.8 0 -1.2 -1.6 l3.6 -7z" fill="${q[1]}" opacity=".9" stroke="${T.osc ? "#E2E8F0" : "#0F172A"}" stroke-opacity=".35" stroke-width=".8"/><circle cx="0" cy="-3" r="1" fill="#FFFFFF" class="burbuja-lab" style="animation-delay:${f(-i * 0.6)}s"/>`);
  });
  l += monitor(16.6, 2.85, 0.9, T, "#14B8A6");
  l += at(16.6, 4.6, 0, personaSvg({ ...A.lab, camina: true, senala: "ronda" }), "ronda", ronda(16.6, 4.6, 17.2, 1.3, "-9s"));
  l += planta(19.2, 0.5, T, 0.9);
  o += sala("lab", l);

  // 05 Monitoreo
  let m = "";
  ([[20.9, "Aire"], [23.2, "Brecha"], [25.5, "Comunas"]] as [number, string][]).forEach((q, i) => {
    const barras = [10, 14, 9, 16, 12, 18];
    m += plano("muroY", q[0], 0, 2.4, `<rect width="54" height="36" rx="2.5" fill="#0B1220" stroke="${T.osc ? "#2C4060" : "#1E293B"}" stroke-width="1.5"/><text x="5" y="8" font-family="${MONO}" font-size="4.6" font-weight="700" fill="#A7E3C7">${q[1].toUpperCase()}</text><circle cx="48" cy="6.5" r="1.6" fill="#34D399" class="latido"/>${i === 0 ? `<path d="M4 28 L12 22 L18 25 L26 15 L34 19 L42 12 L50 16" stroke="#34D399" stroke-width="1.4" fill="none" class="traza"/>` : i === 1 ? barras.map((h, k) => `<rect x="${6 + k * 7.5}" y="${30 - h}" width="4" height="${h}" fill="${k % 2 ? "#60A5FA" : "#34D399"}" opacity=".85"/>`).join("") : [[12, 16, 4], [22, 22, 6], [33, 14, 5], [40, 24, 3.5], [18, 26, 3]].map((c) => `<circle cx="${c[0]}" cy="${c[1]}" r="${c[2]}" fill="#34D399" opacity=".35"/>`).join("")}`);
  });
  m += silla(22.6, 2, T) + at(22.95, 2.45, 0, personaSvg({ ...A.monitoreo, pose: "sentado" }), "agente-sentado");
  m += silla(25.2, 2, T);
  m += mesa(21.6, 3, 5, 1.05, T) + monitor(22.3, 3.1, 0.75, T, "#34D399") + monitor(24.9, 3.1, 0.75, T, "#60A5FA");
  m += planta(27.1, 4.9, T, 0.9);
  o += sala("monitoreo", m);

  // 03 Ventanilla
  let v = "";
  v += plano("muroX", 0, 11.8, 2.3, `<rect width="104" height="18" rx="3" fill="${T.osc ? "#CABDFA" : "#5B21B6"}"/><text x="8" y="12" font-family="${MONO}" font-size="6" font-weight="700" letter-spacing=".8" fill="${T.osc ? "#1E1B4B" : "#FFFFFF"}">PROPUESTAS DE APERTURA</text>`);
  v += silla(2.3, 9, T) + at(2.65, 9.45, 0, personaSvg({ ...A.ventanilla, pose: "sentado" }), "agente-sentado");
  v += sombra(3.6, 7.4, 0.7, 4.6) + caja(3.6, 7.4, 0, 0.7, 4.6, 1.05, { t: T.osc ? "#3B3A6B" : "#FFFFFF", l: T.osc ? "#2E2D55" : "#E9E5FB", r: T.osc ? "#26254A" : "#D9D2F7" });
  v += poly([[3.95, 7.4, 1.05], [3.95, 12, 1.05], [3.95, 12, 2.1], [3.95, 7.4, 2.1]], T.osc ? "rgba(202,189,250,.10)" : "rgba(202,189,250,.28)", 'stroke="#CABDFA" stroke-width="1"');
  [0, 1, 2, 3].forEach((i) => (v += caja(3.68, 8 + i * 0.06, 1.05 + i * 0.05, 0.5, 0.7, 0.04, ["#7C3AED", "#A78BFA", "#C4B5FD", "#FFFFFF"][i])));
  [0, 1, 2].forEach((i) => (v += caja(3.68, 10.3, 1.05 + i * 0.05, 0.5, 0.7, 0.04, ["#DC2626", "#D97706", "#FFFFFF"][i])));
  v += planta(5.6, 11.8, T, 0.9);
  o += sala("ventanilla", v);

  // 04 Analista · PulsoBot
  let an = "";
  an += plano("muroX", 0, 19.2, 2.5, `<rect width="120" height="52" rx="3" fill="#0B1220" stroke="${T.osc ? "#2C4060" : "#1E293B"}" stroke-width="1.5"/><rect x="8" y="8" width="62" height="10" rx="5" fill="#1E3A8A"/><text x="13" y="15" font-family="${SANS}" font-size="5.4" fill="#DBEAFE">¿Cuántos conjuntos críticos?</text><rect x="42" y="23" width="70" height="20" rx="5" fill="#2563EB"/><text x="47" y="31" font-family="${SANS}" font-size="5.4" fill="#FFFFFF">${D.porEstado.critico} de ${D.evaluables} · catálogo</text><text x="47" y="38.5" font-family="${MONO}" font-size="4.4" fill="#BFDBFE">MEData · ${esc(D.fechaCorta)}</text>`);
  an += mesa(1.2, 14.6, 2.6, 1.1, T) + monitor(1.6, 14.7, 0.75, T, "#60A5FA");
  an += `<ellipse cx="${f(P(3.6, 17.2)[0])}" cy="${f(P(3.6, 17.2)[1])}" rx="14" ry="5" fill="rgba(37,99,235,.22)" class="bot-sombra"/>`;
  an += at(3.6, 17.2, 1.35, `<circle r="13" fill="url(#ofi-bot)"/><circle r="13" fill="none" stroke="#93C5FD" stroke-opacity=".6"/><ellipse cx="0" cy="1" rx="8.4" ry="5.6" fill="#0B1220"/><rect x="-5" y="-.4" width="3" height="3.6" rx="1.5" fill="#34D399" class="parpadeo"/><rect x="2" y="-.4" width="3" height="3.6" rx="1.5" fill="#34D399" class="parpadeo"/><circle cx="-4.5" cy="-7" r="2.2" fill="#FFFFFF" opacity=".55"/>`, "bot");
  an += caja(1, 18.4, 0, 1.6, 0.8, 0.42, { t: T.osc ? "#3B4F72" : "#DBEAFE", l: T.osc ? "#2C3E5C" : "#BFDBFE", r: T.osc ? "#24344F" : "#93C5FD" });
  an += planta(5.7, 13.6, T, 0.9);
  o += sala("analista", an);

  // Recepción: mostrador PULSO y tótem con el hallazgo
  let re = "";
  re += sombra(10.6, 9.6, 4, 1) + caja(10.6, 9.6, 0, 4, 1, 0.95, { t: T.osc ? "#33476A" : "#FFFFFF", l: T.osc ? "#1B2A40" : "#0B1220", r: T.osc ? "#24364F" : "#1E293B" });
  re += plano("muroY", 11.7, 10.61, 0.78, `<circle cx="0" cy="-5" r="2.6" fill="#34D399" class="latido"/><text x="6" y="-1.6" font-family="${SANS}" font-size="10" font-weight="800" letter-spacing="1.5" fill="#FFFFFF">PULSO</text><text x="47" y="-1.6" font-family="${SANS}" font-size="5.8" font-weight="500" fill="#93C5FD">Agencia de datos</text>`);
  re += sombra(15.6, 8.2, 0.4, 1.6) + caja(15.6, 8.2, 0, 0.4, 1.6, 2.3, { t: T.osc ? "#33476A" : "#FFFFFF", l: T.osc ? "#24364F" : "#E2E8F0", r: T.osc ? "#1B2A40" : "#0B1220" });
  re += plano("muroX", 16.01, 9.7, 2.15, `<text x="6" y="12" font-family="${MONO}" font-size="5" font-weight="700" letter-spacing=".6" fill="#93C5FD">ATRASADOS</text><text x="5" y="30" font-family="${MONO}" font-size="13" font-weight="700" fill="#FFFFFF">${esc(D.pctTxt)}</text><text x="6" y="40" font-family="${MONO}" font-size="4.6" fill="#94A3B8">${D.atrasados} de ${D.evaluables}</text>`);
  re += caja(8.6, 10.8, 0, 1.8, 0.75, 0.45, { t: T.osc ? "#3B4F72" : "#BFD3F2", l: T.osc ? "#2C3E5C" : "#A3BEE6", r: T.osc ? "#24344F" : "#88A7D6" }) + caja(8.6, 10.8, 0.45, 0.25, 0.75, 0.45, { t: T.osc ? "#3B4F72" : "#BFD3F2", l: T.osc ? "#2C3E5C" : "#A3BEE6", r: T.osc ? "#24344F" : "#88A7D6" });
  re += planta(8.3, 8, T) + planta(16.8, 11.9, T, 0.85);
  const guia: AspectoAgente = { nombre: "Guía", ropa: "chaqueta", color: "#C2410C", camisa: "#FFF7ED", peinado: "rizado", piel: "#A86B47", pelo: "#2B1D14", colorInferior: "#1E293B", corbata: null, inferior: "pantalon", gafas: false, diadema: false, carnet: false };
  re += at(9.6, 12.2, 0, personaSvg({ ...guia, camina: true }), "ronda paseo", ronda(9.6, 12.2, 14.6, 12.2, "-5s"));
  o += sala("recepcion", re);

  // flujo de datos: crudo → auditado → limpio → PULSO
  const ruta = ([[4, 6.2], [20.1, 6.2], [20.1, 10.2], [23.6, 14.4]] as [number, number][]).map((q) => P(q[0], q[1], 0.03));
  const d = "M" + ruta.map((q) => f(q[0]) + " " + f(q[1])).join(" L");
  o += `<path d="${d}" stroke="${T.osc ? "rgba(37,99,235,.35)" : "rgba(37,99,235,.16)"}" stroke-width="10" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  const seg = (a0: [number, number], b0: [number, number], col: string) => `<polyline points="${pts([[a0[0], a0[1], 0.03], [b0[0], b0[1], 0.03]])}" stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="7 7" class="flujo"/>`;
  o += seg([4, 6.2], [9.7, 6.2], "#94A3B8") + seg([9.7, 6.2], [16.7, 6.2], "#60A5FA") + seg([16.7, 6.2], [20.1, 6.2], "#2563EB");
  o += `<polyline points="${pts([[20.1, 6.2, 0.03], [20.1, 10.2, 0.03], [23.6, 14.4, 0.03]])}" stroke="#2563EB" stroke-width="3" fill="none" stroke-dasharray="7 7" class="flujo"/>`;
  ([[5.6, "CRUDO", "#64748B"], [11.2, "AUDITADO", "#3B82F6"], [17.2, "LIMPIO", "#2563EB"]] as [number, string, string][]).forEach((q) => {
    o += plano("piso", q[0], 6.95, 0, `<text font-family="${MONO}" font-size="7.5" font-weight="700" letter-spacing="1.6" fill="${q[2]}">${q[1]} →</text>`);
  });
  if (!quieto)
    for (let i = 0; i < 5; i++)
      o += `<rect x="-3" y="-3" width="6" height="6" rx="1.5" transform="rotate(45)"><animateMotion dur="10s" begin="${-i * 2}s" repeatCount="indefinite" path="${d}"/><animate attributeName="fill" dur="10s" begin="${-i * 2}s" repeatCount="indefinite" values="#94A3B8;#94A3B8;#60A5FA;#2563EB;#34D399" keyTimes="0;.22;.45;.75;1"/></rect>`;

  // 06 Comunicaciones
  let co = "";
  co += sombra(9, 15, 0.3, 2.6) + caja(9, 15, 0, 0.3, 2.6, 1.9, { t: T.osc ? "#3B4F72" : "#FFFFFF", l: T.osc ? "#24364F" : "#E2E8F0", r: T.osc ? "#1B2A40" : "#F1F5F9" });
  co += plano("muroX", 9.31, 17.45, 1.8, [0, 1, 2].map((i) => [0, 1].map((j) => `<rect x="${5 + i * 21}" y="${4 + j * 20}" width="15" height="17" rx="1.2" fill="${T.osc ? "#142339" : "#FFFFFF"}" stroke="#FDC9A9"/><rect x="${5 + i * 21}" y="${4 + j * 20}" width="15" height="4" rx="1" fill="#C2410C"/><rect x="${7 + i * 21}" y="${11 + j * 20}" width="${6 + ((i + j) % 3) * 2}" height="1.4" fill="#94A3B8"/><rect x="${7 + i * 21}" y="${14 + j * 20}" width="9" height="1.4" fill="#FDC9A9"/>`).join("")).join(""));
  co += at(10.7, 16.9, 0, personaSvg({ ...A.comunicaciones, senalaIzq: true }), "vocera");
  co += mesa(13, 17.2, 2.8, 1.2, T);
  ([[13.3, 17.5, "#C2410C"], [13.95, 17.45, "#FDC9A9"], [14.8, 17.6, "#FFFFFF"]] as [number, number, string][]).forEach((q) => {
    for (let k = 0; k < 3; k++) co += caja(q[0], q[1], 0.75 + k * 0.06, 0.55, 0.7, 0.05, k === 2 ? q[2] : T.osc ? "#E2E8F0" : "#F8FAFC");
  });
  co += sombra(15.9, 14.8, 1.5, 1.1) + caja(15.9, 14.8, 0, 1.5, 1.1, 0.55, { t: T.mesaL, l: T.mesaR, r: osc(T.mesaR, 0.15) }) + caja(16, 14.85, 0.55, 1.3, 0.95, 0.42, { t: T.osc ? "#E2E8F0" : "#F8FAFC", l: "#CBD5E1", r: "#94A3B8" }) + poly([[16.15, 15.8, 0.75], [16.95, 15.8, 0.75], [16.95, 15.8, 0.8], [16.15, 15.8, 0.8]], "#0F172A") + at(17.2, 15.4, 0.97, `<circle r="1.6" fill="#34D399" class="latido"/>`);
  co += `<g class="hoja">${poly([[16.2, 15.55, 0.78], [16.9, 15.55, 0.78], [16.9, 16.35, 0.74], [16.2, 16.35, 0.74]], "#FFFFFF", 'stroke="#CBD5E1" stroke-width=".6"')}</g>`;
  co += planta(17.8, 19.2, T) + planta(8.3, 19.3, T, 0.85);
  o += sala("comunicaciones", co);

  // Salida a PULSO: Medellín estilizada
  let sa = "";
  const s = S.salida;
  for (let i = 1; i < 6; i++) sa += `<polyline points="${pts([[s.x, s.y + i * 2.1, 0.02], [s.x + s.w, s.y + i * 2.1, 0.02]])}" stroke="#16233A" stroke-width="1.2" fill="none"/>`;
  sa += poly([[26.4, s.y, 0.02], [27.4, s.y, 0.02], [27.4, 20, 0.02], [26.4, 20, 0.02]], "#123A7A") + `<polyline points="${pts([[26.9, s.y, 0.03], [26.9, 20, 0.03]])}" stroke="#60A5FA" stroke-width="1.4" stroke-dasharray="3 9" fill="none" class="rio"/>`;
  // Alcaldía de Medellín
  {
    const ax = 21.9, ay = 8.2, aw = 2.8, ad = 1.5, ah = 3.4;
    sa += sombra(ax, ay, aw, ad + 1.8, 0.45) + caja(ax, ay, 0, aw, ad, ah, { t: "#F8FAFC", l: "#E2E8F0", r: "#CBD5E1" });
    const px = ax, py = ay + ad + 0.2, pw = aw, pd = 1.6, ph = 0.95;
    sa += caja(px, py, 0, pw, pd, ph, { t: "#E2E8F0", l: "#F8FAFC", r: "#E2E8F0" });
    for (let k = 0.1; k < pw; k += 0.14) sa += poly([[px + k, py + pd + 0.012, 0.1], [px + k + 0.05, py + pd + 0.012, 0.1], [px + k + 0.05, py + pd + 0.012, ph - 0.1], [px + k, py + pd + 0.012, ph - 0.1]], "#CBD5E1");
    sa += poly([[px + pw + 0.012, py + 0.1, 0.08], [px + pw + 0.012, py + pd - 0.1, 0.08], [px + pw + 0.012, py + pd - 0.1, ph - 0.08], [px + pw + 0.012, py + 0.1, ph - 0.08]], "#2F6B3A");
    for (let i = 0; i < 16; i++) sa += at(px + pw + 0.02, py + 0.2 + rnd(i * 3 + 1) * (pd - 0.4), 0.15 + rnd(i * 7 + 2) * (ph - 0.3), `<circle r="${f(1.5 + rnd(i + 4) * 1.3)}" fill="${i % 3 ? "#4C9A52" : "#7BC67E"}" opacity=".9"/>`);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) sa += poly([[px + 0.2 + j * 0.62, py + 0.75 + i * 0.28, ph + 0.01], [px + 0.7 + j * 0.62, py + 0.75 + i * 0.28, ph + 0.01], [px + 0.7 + j * 0.62, py + 0.97 + i * 0.28, ph + 0.01], [px + 0.2 + j * 0.62, py + 0.97 + i * 0.28, ph + 0.01]], (i + j) % 2 ? "#5FAE5A" : "#8BCB6E");
    const y0 = ay + ad + 0.7, y1 = ay + ad + 0.01, z0 = ph + 0.02, z1 = ah - 0.25, xa = ax + 0.18, xb = ax + aw - 0.18;
    sa += poly([[xb, y1, z0], [xb, y0, z0], [xb, y1, z1]], "#E2E8F0");
    sa += poly([[xa, y0, z0], [xb, y0, z0], [xb, y1, z1], [xa, y1, z1]], "#5C4433");
    for (let k = xa + 0.04; k < xb; k += 0.08) sa += `<polyline points="${pts([[k, y0, z0], [k, y1, z1]])}" stroke="#8A6A50" stroke-width=".9"/>`;
    for (let k = 1; k < 8; k++) {
      const t = k / 8, yy = y0 + (y1 - y0) * t, zz = z0 + (z1 - z0) * t;
      for (let q = xa + 0.1; q < xb - 0.12; q += 0.28) if (rnd(k * 11 + q * 5) > 0.68) sa += poly([[q, yy, zz], [q + 0.12, yy, zz], [q + 0.12, yy - 0.03, zz + 0.09], [q, yy - 0.03, zz + 0.09]], "#F2C66D", 'opacity=".8"');
    }
    sa += caja(ax + 0.4, ay + 0.3, ah, 0.7, 0.6, 0.2, { t: "#E2E8F0", l: "#CBD5E1", r: "#94A3B8" }) + at(ax + aw / 2, ay + ad / 2, ah + 0.05, `<circle r="2.4" fill="#34D399" class="faro"/>`);
  }
  // Gobernación de Antioquia
  {
    const gx = 20.3, gy = 11.6, gw = 2.1, gd = 5.4, gh = 4.2;
    sa += sombra(gx, gy, gw, gd, 0.45) + caja(gx, gy, 0, gw, gd, gh, { t: "#F1F5F9", l: "#E2E8F0", r: "#F8FAFC" });
    const X = gx + gw + 0.012;
    sa += poly([[X, gy + 0.22, 0.55], [X, gy + gd - 0.22, 0.55], [X, gy + gd - 0.22, gh - 0.28], [X, gy + 0.22, gh - 0.28]], "#5C4433");
    for (let b = gy + 0.26; b < gy + gd - 0.24; b += 0.085) sa += poly([[X + 0.002, b, 0.58], [X + 0.002, b + 0.035, 0.58], [X + 0.002, b + 0.035, gh - 0.3], [X + 0.002, b, gh - 0.3]], "#8A6A50");
    for (let zz = 0.8; zz < gh - 0.4; zz += 0.36) for (let b = gy + 0.3; b < gy + gd - 0.3; b += 0.34) if (rnd(zz * 13 + b * 7) > 0.72) sa += poly([[X + 0.004, b, zz], [X + 0.004, b + 0.14, zz], [X + 0.004, b + 0.14, zz + 0.12], [X + 0.004, b, zz + 0.12]], "#F2C66D", 'opacity=".8"');
    const Y = gy + gd + 0.012;
    sa += poly([[gx, Y, 0], [gx + gw, Y, 0], [gx + gw, Y, 0.55], [gx, Y, 0.55]], "#0F172A", 'opacity=".45"');
    sa += poly([[gx + gw * 0.62, Y, 0.6], [gx + gw * 0.62 + 0.035, Y, 0.6], [gx + gw * 0.62 + 0.035, Y, gh - 0.2], [gx + gw * 0.62, Y, gh - 0.2]], "#94A3B8");
    for (let b = gy + 0.4; b < gy + gd; b += 0.7) sa += caja(gx + gw - 0.1, b, 0, 0.1, 0.1, 0.55, "#E2E8F0");
    sa += caja(gx + 0.3, gy + 0.5, gh, 0.8, 1.2, 0.22, { t: "#E2E8F0", l: "#CBD5E1", r: "#94A3B8" }) + caja(gx + gw - 0.08, gy + 1.4, 0.5, 0.5, 1.8, 0.1, { t: "#FFFFFF", l: "#E2E8F0", r: "#F1F5F9" });
  }
  // Plaza de La Alpujarra y Monumento a la Raza
  sa += poly([[22.9, 11.9, 0.03], [25.1, 11.9, 0.03], [25.1, 17.2, 0.03], [22.9, 17.2, 0.03]], "#2A3A55", 'stroke="#3B4F72" stroke-width="1"');
  const mx = 24, my = 14.6;
  sa += poly(Array.from({ length: 20 }, (_, i) => [mx + Math.cos((i / 20) * 6.283) * 1.05, my + Math.sin((i / 20) * 6.283) * 1.05, 0.05] as Q), "#1D4E89", 'opacity=".9"') + poly(Array.from({ length: 20 }, (_, i) => [mx + Math.cos((i / 20) * 6.283) * 0.7, my + Math.sin((i / 20) * 6.283) * 0.7, 0.06] as Q), "#E11D48", 'opacity=".35"');
  sa += caja(mx - 0.25, my - 0.25, 0.06, 0.5, 0.5, 0.3, { t: "#94A3B8", l: "#64748B", r: "#475569" });
  sa += at(mx, my, 0.36, `<path d="M-3 0 C-9 -10 -10 -30 -4 -66 C-2 -48 2 -34 8 -24 C14 -16 22 -16 30 -22 C26 -10 14 -2 3 0z" fill="url(#ofi-bronce)"/><path d="M-2 -6 C-6 -18 -6 -34 -3.4 -56" stroke="#F5D0A9" stroke-width=".9" fill="none" opacity=".55"/><path d="M4 -8 C10 -12 18 -14 26 -19" stroke="#5B3A1A" stroke-width=".8" fill="none" opacity=".6"/><g fill="#7C4F24"><circle cx="-4" cy="-69" r="2"/><path d="M-4 -67 l-3 -5 M-4 -67 l3 -6 M-4 -67 v5" stroke="#7C4F24" stroke-width="1"/><circle cx="-5.5" cy="-48" r="1.4"/><circle cx="-6" cy="-36" r="1.4"/><circle cx="29" cy="-23" r="1.5"/></g>`);
  // Plaza de la Libertad
  const OR = { t: "#E7CE8A", l: "#D4B062", r: "#B8923F" };
  const reticula = (x: number, y: number, z: number, w: number, dd: number, h: number, seed: number) => {
    let q = "";
    for (let zz = 0.12; zz < h - 0.1; zz += 0.2) {
      for (let k = 0.08; k < w - 0.06; k += 0.16) q += poly([[x + k, y + dd + 0.01, z + zz], [x + k + 0.08, y + dd + 0.01, z + zz], [x + k + 0.08, y + dd + 0.01, z + zz + 0.12], [x + k, y + dd + 0.01, z + zz + 0.12]], rnd(seed + zz * 9 + k * 5) > 0.8 ? "#FDE68A" : "#6B5222");
      for (let b = 0.08; b < dd - 0.06; b += 0.16) q += poly([[x + w + 0.01, y + b, z + zz], [x + w + 0.01, y + b + 0.08, z + zz], [x + w + 0.01, y + b + 0.08, z + zz + 0.12], [x + w + 0.01, y + b, z + zz + 0.12]], rnd(seed + zz * 5 + b * 9) > 0.82 ? "#FCD34D" : "#5A441B");
    }
    return q;
  };
  sa += sombra(20.2, 17.9, 2.1, 1.9, 0.4);
  sa += caja(20.2, 17.9, 0, 2.1, 1.9, 1.5, OR) + reticula(20.2, 17.9, 0, 2.1, 1.9, 1.5, 61);
  sa += caja(20.2, 17.9, 1.5, 0.95, 1.9, 3.6, OR) + reticula(20.2, 17.9, 1.5, 0.95, 1.9, 3.6, 62);
  sa += caja(21.35, 18.7, 1.5, 0.95, 1.1, 2.6, OR) + reticula(21.35, 18.7, 1.5, 0.95, 1.1, 2.6, 63);
  sa += caja(21.15, 17.9, 3.4, 1.15, 1.9, 0.5, OR) + reticula(21.15, 17.9, 3.4, 1.15, 1.9, 0.5, 64);
  sa += caja(20.35, 18.05, 5.1, 0.7, 0.8, 1, { t: "#CBD5E1", l: "#94A3B8", r: "#64748B" }) + poly([[21.06, 18.1, 5.2], [21.06, 18.8, 5.2], [21.06, 18.8, 6], [21.06, 18.1, 6]], "#BFDBFE", 'opacity=".35"');
  // Edificio Coltejer
  const cx = 23.3, cy = 17.7, cw = 1.6, cd = 1.1, cz = 6.6;
  sa += sombra(cx, cy, cw, cd, 0.45) + caja(cx, cy, 0, cw, cd, cz, { t: "#E2E8F0", l: "#3A332D", r: "#EEF2F7" });
  {
    const Y = cy + cd + 0.012;
    for (let k = 0.1; k < cw - 0.08; k += 0.075) sa += poly([[cx + k, Y, 0.2], [cx + k + 0.028, Y, 0.2], [cx + k + 0.028, Y, cz - 0.05], [cx + k, Y, cz - 0.05]], "#6E6357");
    for (let zz = 0.5; zz < cz - 0.3; zz += 0.22) for (let k = 0.12; k < cw - 0.12; k += 0.15) if (rnd(zz * 19 + k * 3) > (zz > 3.2 && zz < 5.4 ? 0.35 : 0.78)) sa += poly([[cx + k, Y + 0.002, zz], [cx + k + 0.07, Y + 0.002, zz], [cx + k + 0.07, Y + 0.002, zz + 0.12], [cx + k, Y + 0.002, zz + 0.12]], "#E9C46A", 'opacity=".85"');
    sa += poly([[cx, Y + 0.003, 0], [cx + 0.09, Y + 0.003, 0], [cx + 0.09, Y + 0.003, cz], [cx, Y + 0.003, cz]], "#F1F5F9") + poly([[cx + cw - 0.09, Y + 0.003, 0], [cx + cw, Y + 0.003, 0], [cx + cw, Y + 0.003, cz], [cx + cw - 0.09, Y + 0.003, cz]], "#E2E8F0");
    const X = cx + cw + 0.012;
    sa += poly([[X, cy + cd * 0.48, 0.3], [X, cy + cd * 0.48 + 0.05, 0.3], [X, cy + cd * 0.48 + 0.05, cz - 0.4], [X, cy + cd * 0.48, cz - 0.4]], "#64748B") + poly([[X, cy + 0.2, cz - 0.32], [X, cy + 0.34, cz - 0.32], [X, cy + 0.34, cz - 0.18], [X, cy + 0.2, cz - 0.18]], "#334155");
  }
  {
    const N = 10, yb = cy + 0.32, zt = cz + 1.05;
    const prof = (t: number): [number, number] => [cy + cd - (cy + cd - yb) * t, cz + (zt - cz) * t * t];
    const arco: [number, number][] = [];
    for (let i = 0; i <= N; i++) arco.push(prof(i / N));
    sa += poly([[cx + cw, cy, cz], ...arco.map((q) => [cx + cw, q[0], q[1]] as Q), [cx + cw, cy, zt]], "#F8FAFC");
    sa += poly([...arco.map((q) => [cx, q[0], q[1]] as Q), ...arco.slice().reverse().map((q) => [cx + cw, q[0], q[1]] as Q)], "#9C9BB8");
    for (let i = 1; i < N; i += 2) {
      const q = prof(i / N);
      sa += `<polyline points="${pts([[cx, q[0], q[1]], [cx + cw, q[0], q[1]]])}" stroke="#B7B6CF" stroke-width=".7"/>`;
    }
    sa += `<polyline points="${pts([[cx, cy + cd, cz], [cx + cw, cy + cd, cz]])}" stroke="#4B4558" stroke-width="1.2"/>`;
    sa += caja(cx + 0.05, cy, zt - 0.05, cw - 0.1, yb - cy, 0.35, { t: "#8E8CA8", l: "#7C7A96", r: "#A3A1BC" });
    const asta = (x: number, inner: string) => {
      const a0 = P(x, cy + 0.16, zt + 0.3), b0 = P(x, cy + 0.16, zt + 2.3);
      return `<line x1="${f(a0[0])}" y1="${f(a0[1])}" x2="${f(b0[0])}" y2="${f(b0[1])}" stroke="#CBD5E1" stroke-width="1.1"/><g transform="translate(${f(b0[0])},${f(b0[1])}) scale(1.7)"><g class="bandera">${inner}</g></g>`;
    };
    const tela = "M0 0 C-5 -1.6 -9 1.6 -15 0 V9 C-9 10.6 -5 7.4 0 9z";
    sa += asta(cx + 0.28, `<clipPath id="ofi-co"><path d="${tela}"/></clipPath><g clip-path="url(#ofi-co)"><rect x="-16" y="-2" width="17" height="6.6" fill="#FCD116"/><rect x="-16" y="4.5" width="17" height="2.4" fill="#003893"/><rect x="-16" y="6.8" width="17" height="4" fill="#CE1126"/></g>`);
    sa += asta(cx + cw - 0.28, `<clipPath id="ofi-an"><path d="${tela}"/></clipPath><g clip-path="url(#ofi-an)"><rect x="-16" y="-2" width="17" height="6.5" fill="#FFFFFF"/><rect x="-16" y="4.5" width="17" height="6.5" fill="#00843D"/></g>`);
  }
  // Metro de Medellín
  for (let yy = 8.2; yy < 20; yy += 2.3) sa += sombra(25.45, yy, 0.3, 0.3, 0.3) + caja(25.45, yy, 0, 0.3, 0.3, 1.2, { t: "#7DA3C4", l: "#5B88B0", r: "#4A7398" });
  sa += caja(25.25, s.y, 1.2, 0.7, 12.4, 0.24, { t: "#9CA3AF", l: "#D1D5DB", r: "#E5E7EB" }) + caja(25.9, s.y, 1.44, 0.05, 12.4, 0.16, { t: "#E5E7EB", l: "#D1D5DB", r: "#F3F4F6" });
  for (let yy = 8.6; yy < 20; yy += 2.3) {
    const a0 = P(25.93, yy, 1.44), b0 = P(25.93, yy, 2.5), c0 = P(25.45, yy, 2.4);
    sa += `<polyline points="${f(a0[0])},${f(a0[1])} ${f(b0[0])},${f(b0[1])} ${f(c0[0])},${f(c0[1])}" stroke="#64748B" stroke-width="1.1" fill="none"/>`;
  }
  {
    const a0 = P(25.6, s.y, 2.38), b0 = P(25.6, 20, 2.38);
    sa += `<line x1="${f(a0[0])}" y1="${f(a0[1])}" x2="${f(b0[0])}" y2="${f(b0[1])}" stroke="#475569" stroke-width=".7"/>`;
  }
  const BL2 = { t: "#F1F5F9", l: "#E2E8F0", r: "#F8FAFC" };
  const vagon = (y0: number, frente: boolean) => {
    const x = 25.33, w = 0.5, L = 1.8, z = 1.44, h = 0.52;
    let q = caja(x, y0, z, w, L, h, BL2);
    q += poly([[x + w + 0.01, y0 + 0.08, z + 0.26], [x + w + 0.01, y0 + L - 0.08, z + 0.26], [x + w + 0.01, y0 + L - 0.08, z + 0.43], [x + w + 0.01, y0 + 0.08, z + 0.43]], "#1E293B");
    for (let k = 0.45; k < L - 0.2; k += 0.45) q += poly([[x + w + 0.012, y0 + k, z + 0.26], [x + w + 0.012, y0 + k + 0.04, z + 0.26], [x + w + 0.012, y0 + k + 0.04, z + 0.43], [x + w + 0.012, y0 + k, z + 0.43]], "#F8FAFC");
    q += poly([[x + w + 0.01, y0, z + 0.19], [x + w + 0.01, y0 + L, z + 0.19], [x + w + 0.01, y0 + L, z + 0.225], [x + w + 0.01, y0, z + 0.225]], "#FACC15");
    q += poly([[x + w + 0.01, y0, z + 0.08], [x + w + 0.01, y0 + L, z + 0.08], [x + w + 0.01, y0 + L, z + 0.18], [x + w + 0.01, y0, z + 0.18]], "#00A651");
    q += poly([[x, y0 + L + 0.01, z + 0.08], [x + w, y0 + L + 0.01, z + 0.08], [x + w, y0 + L + 0.01, z + 0.18], [x, y0 + L + 0.01, z + 0.18]], "#00A651");
    if (frente)
      q += poly([[x + 0.05, y0 + L + 0.012, z + 0.24], [x + w - 0.05, y0 + L + 0.012, z + 0.24], [x + w - 0.05, y0 + L + 0.012, z + 0.44], [x + 0.05, y0 + L + 0.012, z + 0.44]], "#0F172A") + poly([[x + 0.12, y0 + L + 0.014, z + 0.4], [x + w - 0.12, y0 + L + 0.014, z + 0.4], [x + w - 0.12, y0 + L + 0.014, z + 0.43], [x + 0.12, y0 + L + 0.014, z + 0.43]], "#F59E0B") + at(x + 0.1, y0 + L + 0.02, z + 0.12, `<circle r="1.1" fill="#FEF9C3"/>`) + at(x + w - 0.1, y0 + L + 0.02, z + 0.12, `<circle r="1.1" fill="#FEF9C3"/>`);
    const a0 = P(x + 0.25, y0 + 0.9, z + h), b0 = P(x + 0.25, y0 + 0.7, z + h + 0.4), c0 = P(x + 0.25, y0 + 1.1, z + h + 0.4);
    q += `<polyline points="${f(a0[0])},${f(a0[1])} ${f(b0[0])},${f(b0[1])} ${f(c0[0])},${f(c0[1])} ${f(a0[0])},${f(a0[1])}" stroke="#334155" stroke-width=".8" fill="none"/>`;
    return q;
  };
  {
    const A0 = P(0, 0), B0 = P(0, 5);
    sa += `<g class="metro" style="--mx:${f(B0[0] - A0[0])}px;--my:${f(B0[1] - A0[1])}px">${vagon(7.9, false)}${vagon(9.8, false)}${vagon(11.7, true)}</g>`;
  }
  o += sala("salida", sa);
  // etiquetas de Medellín y cartel de salida
  const nota = (x: number, y: number, z: number, t: string) => {
    const q = P(x, y, z);
    return `<text x="${f(q[0])}" y="${f(q[1])}" text-anchor="middle" font-family="${MONO}" font-size="8" font-weight="600" fill="#CBD5E1" paint-order="stroke" stroke="#0B1220" stroke-width="3">${t}</text>`;
  };
  let et = nota(cx + 0.8, cy + 0.55, 11.2, "Edificio Coltejer") + nota(21.6, 12.6, 4.6, "Gobernación de Antioquia") + nota(23.3, 9, 3.95, "Alcaldía de Medellín") + nota(21.1, 18.85, 6.6, "Plaza de la Libertad") + nota(mx, my, 3.2, "Monumento a la Raza") + nota(24, 16.9, 0.15, "La Alpujarra") + nota(25.6, 8.2, 3.1, "Metro de Medellín") + nota(27, 19.4, 0.2, "Río Medellín");
  {
    const q = P(27.2, 20.4, 0);
    et += `<g transform="translate(${f(q[0] - 118)},${f(q[1] + 6)})"><rect width="176" height="28" rx="14" fill="#2563EB"/><circle cx="16" cy="14" r="4" fill="#34D399" class="latido"/><text x="28" y="18" font-family="${SANS}" font-size="10.5" font-weight="700" fill="#FFFFFF" letter-spacing=".4">SALIDA A PULSO · EN VIVO →</text></g>`;
  }
  o += `<g pointer-events="none">${et}</g>`;
  // globos de estado con las cifras de cada agente
  const g = D.globos;
  const b =
    burbuja(9.6, 2.8, 2.6, "Relojero", g.reloj.cifra, T.est[g.reloj.estado], T) +
    burbuja(16.6, 4.6, 2.7, "Científica de datos", g.lab.cifra, T.est[g.lab.estado], T) +
    burbuja(23, 2.5, 2.4, "Operadora", g.monitoreo.cifra, T.est[g.monitoreo.estado], T, true) +
    burbuja(2.7, 9.5, 2.3, "Ventanilla", g.ventanilla.cifra, T.est[g.ventanilla.estado], T) +
    burbuja(3.6, 17.2, 2.75, "PulsoBot", g.analista.cifra, T.est[g.analista.estado], T) +
    burbuja(10.7, 16.9, 2.65, "Vocera", g.comunicaciones.cifra, T.est[g.comunicaciones.estado], T, true);
  o += `<g pointer-events="none">${b}</g>`;
  return o;
}

/** viewBox completo de la escena. */
export const VB: [number, number, number, number] = [-500, -200, 1160, 880];

/** viewBox que encuadra una sala para el recorrido con zoom. */
export function encuadre(id: IdSala | "todo"): [number, number, number, number] {
  if (id === "todo") return VB;
  const s = SALAS_ESCENA[id];
  const ps = ([[s.x, s.y, 0], [s.x + s.w, s.y, 0], [s.x + s.w, s.y + s.d, 0], [s.x, s.y + s.d, 0], [s.x, s.y, id === "salida" ? 10 : 3.4], [s.x + s.w, s.y, 3.4]] as [number, number, number][]).map((q) => P(...q));
  const xs = ps.map((q) => q[0]), ys = ps.map((q) => q[1]);
  let x0 = Math.min(...xs) - 40;
  let y0 = Math.min(...ys) - 30;
  const x1 = Math.max(...xs) + 40, y1 = Math.max(...ys) + 40;
  const ar = VB[2] / VB[3];
  let w = x1 - x0, h = y1 - y0;
  if (w / h < ar) {
    const nw = h * ar;
    x0 -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / ar;
    y0 -= (nh - h) / 2;
    h = nh;
  }
  return [x0, y0, w, h];
}

/** Estilos de la escena, acotados a `.ofi` (nombres de animación con prefijo para no chocar con globals.css). */
export const CSS_ESCENA = `.ofi{-webkit-tap-highlight-color:transparent}
.ofi svg{display:block;width:100%;height:auto;aspect-ratio:1160/880;overflow:hidden}
.ofi .sala{cursor:pointer;outline:none}.ofi .sala[role=presentation]{cursor:default}
.ofi .sala .piso{transition:stroke .18s ease,stroke-width .18s ease,filter .18s ease}
.ofi .sala[role=button]:hover .piso,.ofi .sala[data-hot] .piso{stroke:#2563EB;stroke-width:2.6;filter:drop-shadow(0 6px 10px rgba(37,99,235,.18))}
.ofi .sala[role=button]:focus-visible .piso{stroke:#2563EB;stroke-width:3.4}
.ofi .sala[role=button]:hover .etq,.ofi .sala:focus-visible .etq{fill:#2563EB}
.ofi .flujo{animation:ofi-flujo 1.1s linear infinite}@keyframes ofi-flujo{to{stroke-dashoffset:-14}}
.ofi .rio{animation:ofi-flujo 2.4s linear infinite}
.ofi .led{animation:ofi-led 2.2s steps(2,end) infinite}@keyframes ofi-led{50%{opacity:.25}}
.ofi .latido{animation:ofi-latido 2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes ofi-latido{50%{opacity:.45;transform:scale(.8)}}
.ofi .faro{animation:ofi-faro 2.6s ease-in-out infinite}@keyframes ofi-faro{50%{opacity:.35}}
.ofi .aguja-m{animation:ofi-giro 8s linear infinite}.ofi .aguja-h{animation:ofi-giro 96s linear infinite}@keyframes ofi-giro{to{transform:rotate(360deg)}}
.ofi .burbuja-lab{animation:ofi-sube 2.4s ease-in infinite}@keyframes ofi-sube{0%{transform:translateY(0);opacity:0}30%{opacity:1}100%{transform:translateY(-9px);opacity:0}}
.ofi .ronda{animation:ofi-ronda 16s cubic-bezier(.45,0,.55,1) infinite;animation-delay:var(--del,0s)}
.ofi .paseo{animation-name:ofi-paseo;animation-duration:22s}
@keyframes ofi-ronda{0%,28%{transform:translate(0,0)}40%,68%{transform:translate(var(--dx),var(--dy))}80%,100%{transform:translate(0,0)}}
@keyframes ofi-paseo{0%,8%{transform:translate(0,0)}42%,58%{transform:translate(var(--dx),var(--dy))}92%,100%{transform:translate(0,0)}}
.ofi .ronda .pa{animation:ofi-pasoA 16s linear infinite;animation-delay:var(--del,0s)}.ofi .ronda .pb{animation:ofi-pasoB 16s linear infinite;animation-delay:var(--del,0s)}
.ofi .paseo .pa,.ofi .paseo .pb{animation:ofi-pasoC 1s linear infinite}.ofi .paseo .pb{animation-direction:reverse}
@keyframes ofi-pasoA{0%,28%,40%,68%,80%,100%{transform:rotate(0)}30%,34%,38%,70%,74%,78%{transform:rotate(16deg)}32%,36%,72%,76%{transform:rotate(-16deg)}}
@keyframes ofi-pasoB{0%,28%,40%,68%,80%,100%{transform:rotate(0)}30%,34%,38%,70%,74%,78%{transform:rotate(-16deg)}32%,36%,72%,76%{transform:rotate(16deg)}}
@keyframes ofi-pasoC{0%,100%{transform:rotate(14deg)}50%{transform:rotate(-14deg)}}
.ofi .ronda .br-der{animation:ofi-senala 16s cubic-bezier(.3,0,.3,1) infinite;animation-delay:var(--del,0s)}
@keyframes ofi-senala{0%,42%,66%,100%{transform:rotate(0)}46%,62%{transform:rotate(-140deg)}}
.ofi .vocera{animation:ofi-habla 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}@keyframes ofi-habla{50%{transform:translateY(-1px)}}
.ofi .bot{animation:ofi-flota 3.4s ease-in-out infinite}@keyframes ofi-flota{50%{transform:translateY(-6px)}}
.ofi .bot-sombra{animation:ofi-sombra 3.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes ofi-sombra{50%{transform:scale(.8);opacity:.6}}
.ofi .parpadeo{animation:ofi-parpadeo 5s infinite;transform-box:fill-box;transform-origin:center}@keyframes ofi-parpadeo{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
.ofi .hoja{animation:ofi-hoja 4.5s cubic-bezier(.2,.8,.2,1) infinite}@keyframes ofi-hoja{0%{transform:translate(0,0);opacity:0}15%{opacity:1}55%,85%{transform:translate(-14px,8px);opacity:1}100%{transform:translate(-14px,8px);opacity:0}}
.ofi .bandera{animation:ofi-bandera 2.8s ease-in-out infinite;transform-origin:0 0}@keyframes ofi-bandera{50%{transform:skewY(4deg) scaleX(.94)}}
.ofi .metro{animation:ofi-metro 14s cubic-bezier(.45,0,.55,1) infinite}@keyframes ofi-metro{0%,8%{transform:translate(0,0)}46%,58%{transform:translate(var(--mx),var(--my))}96%,100%{transform:translate(0,0)}}
.ofi .barra-lab{animation:ofi-lab 6s cubic-bezier(.2,.8,.2,1) infinite;transform-box:fill-box;transform-origin:left}@keyframes ofi-lab{0%{transform:scaleX(0)}40%,100%{transform:scaleX(1)}}
.ofi .traza{stroke-dasharray:80;animation:ofi-traza 4s linear infinite}@keyframes ofi-traza{from{stroke-dashoffset:80}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.ofi *{animation:none!important;transition:none!important}.ofi .hoja{opacity:0}}`;

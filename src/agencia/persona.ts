/**
 * Personajes de la oficina (diseño de Claude Design, agentes.js). Se dibujan como texto SVG para usarlos igual en la
 * escena isométrica, en las fichas del equipo y en el editor de agentes. El ancla (0, 0) son los pies.
 */

const hx = (h: string) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.substr(i, 2), 16));
};
export const mezclar = (a: string, b: string, t: number) => {
  const A = hx(a);
  const B = hx(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const sh = (c: string, t = 0.2) => mezclar(c, "#0B1220", t);
const hl = (c: string, t = 0.22) => mezclar(c, "#FFFFFF", t);

export type Peinado = "corto" | "largo" | "mono" | "coleta" | "rizado" | "calvo";
export type Ropa = "traje" | "bata" | "camisa" | "chaqueta";

export interface AspectoAgente {
  nombre: string;
  piel: string;
  pelo: string;
  peinado: Peinado;
  ropa: Ropa;
  color: string;
  camisa: string;
  corbata: string | null;
  inferior: "pantalon" | "falda";
  colorInferior: string;
  gafas: boolean;
  diadema: boolean;
  carnet: boolean;
}

/** Agentes humanos que se pueden editar (PulsoBot es el orbe azul y no se edita). */
export type IdEditable = "reloj" | "lab" | "ventanilla" | "monitoreo" | "comunicaciones";
export const EDITABLES: IdEditable[] = ["reloj", "lab", "ventanilla", "monitoreo", "comunicaciones"];

export const AGENTES_DEF: Record<IdEditable, AspectoAgente> = {
  reloj: { nombre: "Relojero", piel: "#8D5A3B", pelo: "#111827", peinado: "corto", ropa: "traje", color: "#0F172A", camisa: "#FFFFFF", corbata: "#DC2626", inferior: "pantalon", colorInferior: "auto", gafas: true, diadema: false, carnet: true },
  lab: { nombre: "Científica de datos", piel: "#E0B48F", pelo: "#5B3A22", peinado: "largo", ropa: "bata", color: "#0F766E", camisa: "#CCFBF1", corbata: null, inferior: "pantalon", colorInferior: "#334155", gafas: true, diadema: false, carnet: true },
  ventanilla: { nombre: "Funcionario de ventanilla", piel: "#E0B48F", pelo: "#2B1D14", peinado: "corto", ropa: "camisa", color: "#4338CA", camisa: "#EEF2FF", corbata: "#A78BFA", inferior: "pantalon", colorInferior: "#1E293B", gafas: false, diadema: false, carnet: true },
  monitoreo: { nombre: "Operadora", piel: "#C68B59", pelo: "#1F140D", peinado: "coleta", ropa: "chaqueta", color: "#065F46", camisa: "#ECFDF5", corbata: null, inferior: "pantalon", colorInferior: "#1E293B", gafas: false, diadema: true, carnet: true },
  comunicaciones: { nombre: "Vocera", piel: "#A86B47", pelo: "#2B1D14", peinado: "mono", ropa: "traje", color: "#9A3412", camisa: "#FFF7ED", corbata: null, inferior: "falda", colorInferior: "auto", gafas: false, diadema: false, carnet: true },
};

export const AGENTES_OPC = {
  piel: ["#F3D2B5", "#E0B48F", "#C68B59", "#A86B47", "#8D5A3B", "#5E3B26"],
  pelo: ["#111827", "#2B1D14", "#5B3A22", "#A0522D", "#D6B370", "#9CA3AF"],
  peinado: [["corto", "Corto"], ["largo", "Largo"], ["mono", "Moño"], ["coleta", "Coleta"], ["rizado", "Rizado"], ["calvo", "Rapado"]] as [Peinado, string][],
  ropa: [["traje", "Traje"], ["bata", "Bata"], ["camisa", "Camisa"], ["chaqueta", "Chaqueta"]] as [Ropa, string][],
  color: ["#0F172A", "#1E3A8A", "#2563EB", "#0F766E", "#065F46", "#4338CA", "#9A3412", "#BE185D", "#64748B"],
  camisa: ["#FFFFFF", "#EEF2FF", "#DBEAFE", "#ECFDF5", "#FFF7ED", "#FCE7F3"],
  corbata: [null, "#DC2626", "#D97706", "#2563EB", "#A78BFA", "#0F172A"] as (string | null)[],
  inferior: [["pantalon", "Pantalón"], ["falda", "Falda"]] as ["pantalon" | "falda", string][],
  colorInferior: ["auto", "#0F172A", "#1E293B", "#334155", "#78716C", "#1E3A8A"],
};

/** Lo que cada persona cambió respecto al aspecto predeterminado (se guarda en este navegador). */
export type CambiosAgentes = Partial<Record<IdEditable, Partial<AspectoAgente>>>;

export const CLAVE_AGENTES = "pulso-agentes";

export function aspectosDe(cambios: CambiosAgentes): Record<IdEditable, AspectoAgente> {
  return Object.fromEntries(EDITABLES.map((k) => [k, { ...AGENTES_DEF[k], ...(cambios[k] ?? {}) }])) as Record<IdEditable, AspectoAgente>;
}

/** Valida lo leído de localStorage: solo claves y valores conocidos. */
export function limpiarCambios(v: unknown): CambiosAgentes {
  if (!v || typeof v !== "object") return {};
  const r: CambiosAgentes = {};
  for (const id of EDITABLES) {
    const c = (v as Record<string, unknown>)[id];
    if (!c || typeof c !== "object") continue;
    const o: Partial<AspectoAgente> = {};
    const color = (x: unknown) => typeof x === "string" && /^#[0-9A-Fa-f]{6}$/.test(x);
    for (const [k, x] of Object.entries(c as Record<string, unknown>)) {
      if ((k === "piel" || k === "pelo" || k === "color" || k === "camisa") && color(x)) o[k] = x as string;
      else if (k === "corbata" && (x === null || color(x))) o.corbata = x as string | null;
      else if (k === "colorInferior" && (x === "auto" || color(x))) o.colorInferior = x as string;
      else if (k === "peinado" && AGENTES_OPC.peinado.some((p) => p[0] === x)) o.peinado = x as Peinado;
      else if (k === "ropa" && AGENTES_OPC.ropa.some((p) => p[0] === x)) o.ropa = x as Ropa;
      else if (k === "inferior" && (x === "pantalon" || x === "falda")) o.inferior = x;
      else if ((k === "gafas" || k === "diadema" || k === "carnet") && typeof x === "boolean") o[k] = x;
    }
    if (Object.keys(o).length) r[id] = o;
  }
  return r;
}

export interface Pose {
  pose?: "sentado" | "de-pie";
  camina?: boolean;
  /** "ronda": señala durante la ronda (animado); true: brazo levantado fijo */
  senala?: "ronda" | boolean;
  senalaIzq?: "ronda" | boolean;
}

/** SVG (como texto) de un agente. */
export function personaSvg(o: AspectoAgente & Pose): string {
  const piel = o.piel, pelo = o.pelo, ropa = o.ropa, col = o.color, cam = o.camisa;
  const pant = o.colorInferior && o.colorInferior !== "auto" ? o.colorInferior : sh(col, ropa === "bata" ? 0.55 : 0.35);
  const sent = o.pose === "sentado", T = -35 + (sent ? 9 : 0), H = T - 10.5, falda = o.inferior === "falda";
  const cuerpo = ropa === "bata" ? "#F8FAFC" : col, bajo = ropa === "bata" ? 22 : 17.5, fondo = T + 4.5 + bajo;
  let s = `<ellipse cx="0" cy="0" rx="10" ry="3.6" fill="rgba(8,15,30,.22)"/>`;
  if (!sent) {
    const pierna = (l: number, cls: string) => {
      const x = l < 0 ? -4.8 : 0.8, ox = l < 0 ? -2.8 : 2.8;
      const zap = l < 0 ? `<path d="M${x + 4.4} -2.6 h-4.6 q-1.6 0 -1.6 1.5 v1.1 h6.2z" fill="#111827"/>` : `<path d="M${x - 0.4} -2.6 h4.6 q1.6 0 1.6 1.5 v1.1 h-6.2z" fill="#111827"/>`;
      const pi = falda
        ? `<rect x="${x + 0.6}" y="-12" width="2.8" height="10" rx="1.3" fill="${piel}"/>`
        : `<rect x="${x}" y="-18" width="4" height="16" rx="1.7" fill="${pant}"/><rect x="${x + (l < 0 ? 0 : 2.7)}" y="-18" width="1.3" height="16" fill="${sh(pant)}" opacity=".55"/>`;
      return `<g class="${cls}" style="transform-origin:${ox}px -18px">${pi}${zap}<rect x="${x + 0.6}" y="-2.3" width="2" height=".6" rx=".3" fill="#FFFFFF" opacity=".3"/></g>`;
    };
    s += pierna(-1, o.camina ? "pa" : "") + pierna(1, o.camina ? "pb" : "");
    if (falda) s += `<path d="M-6.6 -21 h13.2 l2.3 10.5 h-17.8z" fill="${pant}"/><path d="M0 -21 h6.6 l2.3 10.5 h-8.9z" fill="${sh(pant)}" opacity=".4"/>`;
  }
  if (o.peinado === "largo") s += `<path d="M-7.8 ${H - 2} q-1.2 11 1.8 15.5 h12 q3 -4.5 1.8 -15.5z" fill="${sh(pelo, 0.12)}"/>`;
  if (o.peinado === "coleta") s += `<path d="M4.6 ${H - 4.5} q7 1.4 5.6 11.5 q-.8 3 -3 1.4 q1.2 -6.6 -3.8 -8.6z" fill="${pelo}"/>`;
  s += `<path d="M-7.6 ${T + 4.5} q0 -4.5 4.5 -4.5 h6.2 q4.5 0 4.5 4.5 v${bajo} h-15.2z" fill="${cuerpo}" ${ropa === "bata" ? 'stroke="#CBD5E1" stroke-width=".7"' : ""}/>`;
  s += `<path d="M0 ${T} h3.1 q4.5 0 4.5 4.5 v${bajo} h-7.6z" fill="${sh(cuerpo)}" opacity="${ropa === "bata" ? 0.1 : 0.3}"/>`;
  const tie = o.corbata ? `<path d="M-1 ${T + 1.6} h2 l.8 8 -1.8 2 -1.8 -2z" fill="${o.corbata}"/><path d="M-1 ${T + 1.6} h2 l-.2 1.6 h-1.6z" fill="${sh(o.corbata)}"/>` : "";
  if (ropa === "traje") {
    s += `<path d="M-3 ${T} L0 ${T + 7.5} L3 ${T}z" fill="${cam}"/>${tie}`;
    s += `<path d="M-3.4 ${T} L-.3 ${T + 9.4} L-2.8 ${T + 10} L-5.2 ${T + 2.2}z" fill="${sh(col, 0.28)}"/><path d="M3.4 ${T} L.3 ${T + 9.4} L2.8 ${T + 10} L5.2 ${T + 2.2}z" fill="${sh(col, 0.28)}"/>`;
    s += `<circle cx="0" cy="${T + 12.4}" r=".65" fill="${hl(col, 0.3)}"/><circle cx="0" cy="${T + 15.4}" r=".65" fill="${hl(col, 0.3)}"/><rect x="-5.6" y="${T + 5.2}" width="2.6" height=".7" fill="${hl(col, 0.35)}"/>`;
  } else if (ropa === "bata") {
    s += `<path d="M-3 ${T} L0 ${T + 8} L3 ${T}z" fill="${col}"/><path d="M-1.6 ${T} L0 ${T + 3} L1.6 ${T}z" fill="${cam}"/>${tie}`;
    s += `<path d="M-3.4 ${T} L0 ${T + 9} L3.4 ${T}" stroke="#CBD5E1" stroke-width=".7" fill="none"/><path d="M0 ${T + 9} V${fondo}" stroke="#CBD5E1" stroke-width=".6"/>`;
    s += `<rect x="-6" y="${T + 13}" width="3.6" height="3.2" rx=".6" fill="none" stroke="#CBD5E1" stroke-width=".6"/><rect x="2.6" y="${T + 5}" width="3" height="2.6" rx=".5" fill="none" stroke="#CBD5E1" stroke-width=".6"/><rect x="3.4" y="${T + 3.6}" width=".7" height="2.6" rx=".3" fill="#2563EB"/>`;
  } else if (ropa === "camisa") {
    s += `<path d="M-3.3 ${T - 0.2} L0 ${T + 3.2} L-1.1 ${T + 4.4} L-4 ${T + 1.4}z M3.3 ${T - 0.2} L0 ${T + 3.2} L1.1 ${T + 4.4} L4 ${T + 1.4}z" fill="${cam}"/>${tie}`;
    s += `<path d="M0 ${T + 3.4} V${fondo - 2.4}" stroke="${sh(col)}" stroke-width=".55"/><rect x="-7.6" y="${fondo - 2.4}" width="15.2" height="2.4" fill="#1F2937"/><rect x="-1" y="${fondo - 2.2}" width="2" height="2" rx=".4" fill="#CBD5E1"/>`;
  } else {
    s += `<path d="M-2.4 ${T} L0 ${T + 4} L2.4 ${T}z" fill="${cam}"/><path d="M-4.2 ${T + 0.3} q4.2 3.2 8.4 0 v1.8 q-4.2 3.2 -8.4 0z" fill="${sh(col, 0.3)}"/>`;
    s += `<path d="M0 ${T + 3.6} V${fondo}" stroke="${hl(col, 0.45)}" stroke-width=".7"/><rect x="-7.6" y="${fondo - 2}" width="15.2" height="2" fill="${sh(col, 0.3)}"/><rect x="-6" y="${T + 11}" width="3" height=".7" fill="${hl(col, 0.35)}"/><rect x="3" y="${T + 11}" width="3" height=".7" fill="${hl(col, 0.35)}"/>`;
  }
  if (o.carnet)
    s += `<path d="M-2.6 ${T + 0.2} L-1.1 ${T + 9.4} M2.6 ${T + 0.2} L1.1 ${T + 9.4}" stroke="#2563EB" stroke-width=".6"/><rect x="-2" y="${T + 9.3}" width="4" height="4.8" rx=".6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width=".4"/><rect x="-2" y="${T + 9.3}" width="4" height="1.4" rx=".5" fill="#2563EB"/><rect x="-1.2" y="${T + 11.6}" width="2.4" height=".5" fill="#94A3B8"/>`;
  const manga = ropa === "bata" ? "#F8FAFC" : col, corta = ropa === "camisa";
  const brazo = (l: number, cls: string, rot: number) => {
    const sx = l < 0 ? -8.6 : 8.6;
    let a = "";
    if (corta)
      a += `<rect x="${sx - 1.9}" y="${T + 0.8}" width="3.8" height="7.6" rx="1.9" fill="${manga}"/><rect x="${sx - 1.4}" y="${T + 7}" width="2.8" height="8.8" rx="1.4" fill="${piel}"/><rect x="${sx - 1.4}" y="${T + 7}" width="1" height="8.8" fill="${sh(piel)}" opacity=".2"/>`;
    else {
      a += `<rect x="${sx - 1.9}" y="${T + 0.8}" width="3.8" height="15.2" rx="1.9" fill="${manga}" ${ropa === "bata" ? 'stroke="#CBD5E1" stroke-width=".6"' : ""}/><rect x="${sx + (l < 0 ? -1.9 : 0.6)}" y="${T + 2}" width="1.3" height="13" fill="${sh(manga)}" opacity="${ropa === "bata" ? 0.08 : 0.3}"/>`;
      if (ropa === "traje") a += `<rect x="${sx - 1.6}" y="${T + 14.8}" width="3.2" height="1.2" fill="${cam}"/>`;
    }
    a += `<circle cx="${sx}" cy="${T + 16.9}" r="2.15" fill="${piel}"/>`;
    return `<g class="${cls}" style="transform-origin:${sx}px ${T + 2.2}px" ${rot ? `transform="rotate(${rot} ${sx} ${T + 2.2})"` : ""}>${a}</g>`;
  };
  s += brazo(-1, o.senalaIzq === "ronda" ? "br-izq" : "", o.senalaIzq === true ? 118 : 0);
  s += brazo(1, o.senala === "ronda" ? "br-der" : "", o.senala === true ? -118 : 0);
  s += `<rect x="-1.7" y="${T - 3.6}" width="3.4" height="4.2" fill="${sh(piel, 0.15)}"/>`;
  s += `<circle cx="-6.5" cy="${H + 1}" r="1.6" fill="${sh(piel, 0.08)}"/><circle cx="6.5" cy="${H + 1}" r="1.6" fill="${sh(piel, 0.08)}"/>`;
  s += `<circle cx="0" cy="${H}" r="6.6" fill="${piel}"/><path d="M-6.6 ${H} a6.6 6.6 0 0 0 13.2 0 a6.6 5 0 0 1 -13.2 0z" fill="${sh(piel)}" opacity=".14"/>`;
  s += `<path d="M-3.7 ${H - 1.9} q1.1 -.7 2.2 0 M1.5 ${H - 1.9} q1.1 -.7 2.2 0" stroke="${sh(pelo, 0.1)}" stroke-width=".85" fill="none" stroke-linecap="round"/>`;
  s += `<ellipse cx="-2.5" cy="${H + 0.4}" rx=".9" ry="1.1" fill="#1F2937"/><ellipse cx="2.5" cy="${H + 0.4}" rx=".9" ry="1.1" fill="#1F2937"/><circle cx="-2.2" cy="${H}" r=".32" fill="#FFFFFF"/><circle cx="2.8" cy="${H}" r=".32" fill="#FFFFFF"/>`;
  s += `<path d="M.3 ${H + 0.9} q1 1.5 -.4 2.1" stroke="${sh(piel, 0.3)}" stroke-width=".6" fill="none" stroke-linecap="round"/><path d="M-1.9 ${H + 3.7} q1.9 1.5 3.8 0" stroke="#7F2D1F" stroke-width=".75" fill="none" stroke-linecap="round"/>`;
  s += `<circle cx="-4" cy="${H + 2.6}" r="1.25" fill="#F472B6" opacity=".2"/><circle cx="4" cy="${H + 2.6}" r="1.25" fill="#F472B6" opacity=".2"/>`;
  const cap = `<path d="M-6.9 ${H - 0.4} q-.5 -7.6 6.9 -7.8 q7.4 .2 6.9 7.8 q-1.3 -3.8 -4.1 -4.3 q-2.5 1.7 -6.1 .6 q-2.7 .9 -3.6 3.7z" fill="${pelo}"/><path d="M-3 ${H - 6.5} q3 -1.4 6 0" stroke="${hl(pelo, 0.35)}" stroke-width=".8" fill="none" opacity=".55"/>`;
  const p = o.peinado || "corto";
  if (p === "corto" || p === "coleta") s += cap;
  if (p === "largo") s += cap + `<path d="M-7 ${H - 1} q-.7 7.4 .6 10.4 h2.1 q-1.5 -5.2 -.4 -9.4z M7 ${H - 1} q.7 7.4 -.6 10.4 h-2.1 q1.5 -5.2 .4 -9.4z" fill="${pelo}"/>`;
  if (p === "mono") s += cap + `<circle cx="0" cy="${H - 8.4}" r="3.3" fill="${pelo}"/><rect x="-2.4" y="${H - 6.4}" width="4.8" height="1" rx=".5" fill="${hl(pelo, 0.4)}"/>`;
  if (p === "rizado")
    s +=
      [[-5.2, -3.4], [-2.6, -6.4], [0.8, -7.2], [4, -5.8], [6.2, -2.8], [-6.6, 0], [6.7, 0], [-0.8, -4.6], [2.6, -4]].map((c) => `<circle cx="${c[0]}" cy="${H + c[1]}" r="2.9" fill="${pelo}"/>`).join("") +
      `<circle cx="-2" cy="${H - 7}" r="1" fill="${hl(pelo, 0.35)}" opacity=".6"/>`;
  if (p === "calvo") s += `<path d="M-6.7 ${H + 0.6} q.2 -3.2 1.5 -4.2 v3.2z M6.7 ${H + 0.6} q-.2 -3.2 -1.5 -4.2 v3.2z" fill="${pelo}"/><ellipse cx="-2" cy="${H - 4.4}" rx="2" ry="1" fill="#FFFFFF" opacity=".25"/>`;
  if (o.gafas)
    s += `<g fill="rgba(255,255,255,.22)" stroke="#0F172A" stroke-width=".8"><rect x="-4.7" y="${H - 1.1}" width="3.9" height="3" rx="1"/><rect x=".8" y="${H - 1.1}" width="3.9" height="3" rx="1"/></g><path d="M-.8 ${H} h1.6 M-4.7 ${H} h-1.8 M4.7 ${H} h1.8" stroke="#0F172A" stroke-width=".7"/>`;
  if (o.diadema)
    s += `<path d="M-7.1 ${H + 0.4} a7.1 7.4 0 0 1 14.2 0" stroke="#334155" stroke-width="1.5" fill="none"/><rect x="5.8" y="${H - 0.8}" width="2.6" height="4" rx="1.1" fill="#334155"/><path d="M6.8 ${H + 3} q-1 3 -4.6 3.4" stroke="#334155" stroke-width=".9" fill="none"/><circle cx="2.2" cy="${H + 6.4}" r=".9" fill="#334155"/>`;
  return s;
}

/** PulsoBot: el orbe azul (usa el degradado `gradId`). */
export const botSvg = (gradId: string) =>
  `<circle r="13" fill="url(#${gradId})"/><circle r="13" fill="none" stroke="#93C5FD" stroke-opacity=".6"/><ellipse cx="0" cy="1" rx="8.4" ry="5.6" fill="#0B1220"/><rect x="-5" y="-.4" width="3" height="3.6" rx="1.5" fill="#34D399" class="parpadeo"/><rect x="2" y="-.4" width="3" height="3.6" rx="1.5" fill="#34D399" class="parpadeo"/><circle cx="-4.5" cy="-7" r="2.2" fill="#FFFFFF" opacity=".55"/>`;

"use client";

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { DatosMundo } from "@/mundo/datos";
import type { IdArea } from "@/mundo/areas";
import { COLOR_GLOBO, type EstadoVisibleAgente, type IdAgente } from "@/mundo/agentes";
import { miles } from "@/mundo/areas";
import Persona, { LOOKS } from "./Persona";
import { ALTO_MURO, ANCHO, FONDO, U, VIEWBOX_H, VIEWBOX_W, caja, p, pts, r1, rect, sobreCaraX, sobreMuroX, sobreMuroY, sobrePiso } from "./iso";

/* Paleta: base clara y empresarial, guiada por PULSO (azul #2563EB, noche #0B1220, verde vivo #34D399). */
const PISO = "#F8FAFC";
const LINEA_PISO = "#E8EEF6";
const MURO = "#FFFFFF";
const MURO_LADO = "#EEF3F9";
const MURO_TAPA = "#CBD5E1";
const NOCHE = "#0B1220";
const AZUL = "#2563EB";

export interface Sala {
  id: IdArea;
  num: string;
  nombre: string;
  /** piso de la sala */
  x: number;
  y: number;
  w: number;
  d: number;
  tinte: string;
  borde: string;
  acento: string;
}

export const SALAS: Sala[] = [
  { id: "reloj", num: "01", nombre: "Reloj de Frescura", x: 6.5, y: 0, w: 6.75, d: 7.2, tinte: "#FEF7E6", borde: "#F3D49B", acento: "#D97706" },
  { id: "lab", num: "02", nombre: "Laboratorio de Limpieza", x: 13.25, y: 0, w: 7.5, d: 7.2, tinte: "#E9FAF6", borde: "#9FE3D6", acento: "#0D9488" },
  { id: "monitoreo", num: "05", nombre: "Sala de Monitoreo", x: 20.75, y: 0, w: 7.25, d: 7.2, tinte: "#EAF8F1", borde: "#A7E3C7", acento: "#059669" },
  { id: "ventanilla", num: "03", nombre: "Ventanilla de Apertura", x: 0, y: 8.6, w: 7, d: 5.4, tinte: "#F3F0FE", borde: "#CABDFA", acento: "#7C3AED" },
  { id: "analista", num: "04", nombre: "Analista · PulsoBot", x: 0, y: 14.6, w: 7, d: 5.4, tinte: "#EDF4FF", borde: "#B9D3FB", acento: AZUL },
  { id: "comunicaciones", num: "06", nombre: "Comunicaciones", x: 8.4, y: 17.2, w: 9.4, d: 2.8, tinte: "#FFF4ED", borde: "#FDC9A9", acento: "#C2410C" },
];

const salaDe = (id: IdArea) => SALAS.find((s) => s.id === id)!;

/* ───────── piezas ───────── */

function Bloque({ x, y, z = 0, w, d, h, tapa, izq, der, linea = "#0F172A14" }: { x: number; y: number; z?: number; w: number; d: number; h: number; tapa: string; izq: string; der: string; linea?: string }) {
  const c = caja(x, y, z, w, d, h);
  return (
    <g stroke={linea} strokeWidth={0.7} strokeLinejoin="round">
      <polygon points={c.izquierda} fill={izq} />
      <polygon points={c.derecha} fill={der} />
      <polygon points={c.arriba} fill={tapa} />
    </g>
  );
}

function Escritorio({ x, y, w = 2.4, d = 1.15, lados = ["#E2E8F0", "#CBD5E1"] }: { x: number; y: number; w?: number; d?: number; lados?: [string, string] | string[] }) {
  return (
    <g>
      <Bloque x={x} y={y} w={w} d={d} h={0.78} tapa="#FFFFFF" izq={lados[0]} der={lados[1]} />
    </g>
  );
}

/** Monitor visto por detrás (el agente lo mira desde atrás del escritorio). */
function Monitor({ x, y, z = 0.78, w = 0.95 }: { x: number; y: number; z?: number; w?: number }) {
  const [bx, by] = p(x + w / 2, y + 0.06, z);
  return (
    <g>
      <rect x={bx - 1.4} y={by - 6} width={2.8} height={6} fill="#64748B" />
      <Bloque x={x} y={y} z={z + 0.22} w={w} d={0.1} h={0.62} tapa="#475569" izq="#334155" der="#1E293B" />
      <circle cx={p(x + w / 2, y + 0.1, z + 0.53)[0]} cy={p(x + w / 2, y + 0.1, z + 0.53)[1]} r={1.6} fill="#93C5FD" opacity={0.85} />
    </g>
  );
}

function Silla({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <Bloque x={x} y={y} w={0.9} d={0.9} h={0.45} tapa={color} izq="#CBD5E1" der="#94A3B8" />
      <Bloque x={x} y={y} z={0.45} w={0.9} d={0.2} h={0.95} tapa={color} izq={color} der="#1E293B" linea="#0F172A22" />
    </g>
  );
}

function Planta({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [cx, cy] = p(x + 0.35, y + 0.35, 0.55 * s);
  return (
    <g>
      <Bloque x={x} y={y} w={0.7 * s} d={0.7 * s} h={0.55 * s} tapa="#E2E8F0" izq="#F1F5F9" der="#CBD5E1" />
      <g className="planta-mece">
        <ellipse cx={cx} cy={cy - 10 * s} rx={11 * s} ry={9 * s} fill="#16A34A" />
        <ellipse cx={cx - 6 * s} cy={cy - 15 * s} rx={7 * s} ry={6 * s} fill="#22C55E" />
        <ellipse cx={cx + 6 * s} cy={cy - 18 * s} rx={7 * s} ry={6.5 * s} fill="#15803D" />
        <ellipse cx={cx + 1 * s} cy={cy - 24 * s} rx={6 * s} ry={5.5 * s} fill="#22C55E" />
      </g>
    </g>
  );
}

/**
 * Rutina de cada agente en la vista 2D: se levanta del puesto, pasa por un punto intermedio, se queda frente a su
 * tablero o pantalla y vuelve. Animada con CSS (agente-ronda en globals.css).
 */
const RUTAS_2D: Record<string, { base: [number, number]; lado: [number, number]; tablero: [number, number]; sentado: boolean; dur: number; retraso: number }> = {
  reloj: { base: [9.2, 2.95], lado: [10.7, 2.95], tablero: [11.4, 1.05], sentado: true, dur: 24, retraso: 0 },
  lab: { base: [16.7, 1.75], lado: [18.5, 1.75], tablero: [19.75, 1.05], sentado: false, dur: 20, retraso: -6 },
  monitoreo: { base: [24.35, 3.45], lado: [26.0, 3.4], tablero: [25.3, 1.05], sentado: true, dur: 26, retraso: -11 },
  ventanilla: { base: [2.9, 11.2], lado: [2.0, 10.8], tablero: [1.05, 10.4], sentado: false, dur: 22, retraso: -3 },
  analista: { base: [3.65, 16.5], lado: [2.1, 16.4], tablero: [1.15, 17.3], sentado: true, dur: 25, retraso: -15 },
  comunicaciones: { base: [12.2, 18.2], lado: [14.0, 18.25], tablero: [15.6, 18.45], sentado: true, dur: 23, retraso: -9 },
  guia: { base: [13.5, 12.55], lado: [12.4, 12.4], tablero: [14.7, 12.4], sentado: false, dur: 16, retraso: -5 },
};

function Ronda({ id, children }: { id: string; children: ReactNode }) {
  const r = RUTAS_2D[id];
  if (!r) return <>{children}</>;
  const [bx, by] = p(r.base[0], r.base[1]);
  const delta = (q: [number, number]) => {
    const [x, y] = p(q[0], q[1]);
    return [r1(x - bx), r1(y - by)];
  };
  const [x1, y1] = delta(r.lado);
  const [x2, y2] = delta(r.tablero);
  const estilo = {
    "--x1": `${x1}px`,
    "--y1": `${y1}px`,
    "--x2": `${x2}px`,
    "--y2": `${y2}px`,
    "--sit": r.sentado ? "5px" : "0px",
    animationDuration: `${r.dur}s`,
    animationDelay: `${r.retraso}s`,
  } as CSSProperties;
  return (
    <g className="agente-ronda" style={estilo}>
      {children}
    </g>
  );
}

function Agente({ id, x, y, saluda = false }: { id: keyof typeof LOOKS; x: number; y: number; saluda?: boolean }) {
  const [sx, sy] = p(x, y);
  return (
    <g transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`}>
      <Ronda id={id}>
        <g className="agente-respira">
          <Persona look={LOOKS[id]} saluda={saluda} />
        </g>
      </Ronda>
    </g>
  );
}

/** Etiqueta flotante: nombre del agente y su cifra con el color del estado. */
function Etiqueta({ x, y, nombre, info, alto = 64 }: { x: number; y: number; nombre: string; info?: EstadoVisibleAgente; alto?: number }) {
  const [sx, sy] = p(x, y);
  const ancho = nombre.length * 6.4 + 18;
  const cifra = info?.cifra ?? "";
  const anchoCifra = cifra.length * 6.6 + 14;
  const color = info ? COLOR_GLOBO[info.estado] : "#475569";
  const total = ancho + (cifra ? anchoCifra + 4 : 0);
  const x0 = sx - total / 2;
  const y0 = sy - alto;
  return (
    <g pointerEvents="none">
      <path d={`M${sx - 4},${y0 + 21} L${sx},${y0 + 26} L${sx + 4},${y0 + 21}`} fill="#FFFFFF" />
      <rect x={x0} y={y0} width={ancho} height={21} rx={10.5} fill="#FFFFFF" stroke="#E2E8F0" />
      <text x={x0 + ancho / 2} y={y0 + 14.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0F172A">
        {nombre}
      </text>
      {cifra && (
        <g>
          {info?.estado === "te-necesita" && (
            <rect className="globo-late" x={x0 + ancho + 4} y={y0} width={anchoCifra} height={21} rx={10.5} fill={color} opacity={0.35} />
          )}
          <rect x={x0 + ancho + 4} y={y0} width={anchoCifra} height={21} rx={10.5} fill={color} />
          <text x={x0 + ancho + 4 + anchoCifra / 2} y={y0 + 14.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#FFFFFF" fontFamily="var(--font-jetbrains), monospace">
            {cifra}
          </text>
        </g>
      )}
    </g>
  );
}

/** Rótulo pintado en el piso, frente a cada sala. */
function Rotulo({ x, y, num, texto, color }: { x: number; y: number; num?: string; texto: string; color: string }) {
  return (
    <g transform={sobrePiso(x, y)} pointerEvents="none">
      {num && (
        <>
          <rect x={0} y={-11} width={24} height={16} rx={4} fill={color} />
          <text x={12} y={1.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#FFFFFF" fontFamily="var(--font-jetbrains), monospace">
            {num}
          </text>
        </>
      )}
      <text x={num ? 30 : 0} y={1.5} fontSize={10.5} fontWeight={800} letterSpacing="0.05em" fill={color}>
        {texto.toUpperCase()}
      </text>
    </g>
  );
}

function Ventana({ x, z = 3, w = 2.6, h = 1.7 }: { x: number; z?: number; w?: number; h?: number }) {
  return (
    <g transform={sobreMuroX(x, z)}>
      <rect x={0} y={0} width={w * U} height={h * U} rx={3} fill="#DBEAFE" stroke="#CBD5E1" strokeWidth={2} />
      <rect x={4} y={4} width={w * U - 8} height={h * U * 0.55} fill="#BFDBFE" />
      <path d={`M${(w * U) / 2},0 V${h * U} M0,${(h * U) / 2} H${w * U}`} stroke="#FFFFFF" strokeWidth={3} />
    </g>
  );
}

/** Contenedor interactivo de una sala: clic, Enter o espacio abre su herramienta. */
function Interactiva({ id, etiqueta, activa, onAbrir, children }: { id: IdArea; etiqueta: string; activa: boolean; onAbrir(id: IdArea): void; children: ReactNode }) {
  const tecla = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAbrir(id);
    }
  };
  return (
    <g role="button" tabIndex={0} aria-label={etiqueta} className={`sala ${activa ? "sala-activa" : ""}`} onClick={() => onAbrir(id)} onKeyDown={tecla}>
      {children}
    </g>
  );
}

function Alfombra({ s }: { s: Sala }) {
  return <polygon className="alfombra" points={rect(s.x + 0.18, s.y + 0.18, s.w - 0.36, s.d - 0.36)} fill={s.tinte} stroke={s.borde} strokeWidth={1.4} />;
}

/** Mampara de vidrio vertical (plano x = cte o y = cte). */
function Mampara({ desde, hasta, fijo, eje }: { desde: number; hasta: number; fijo: number; eje: "x" | "y" }) {
  const h = 1.15;
  const puntos: [number, number, number][] =
    eje === "x"
      ? [
          [desde, fijo, 0],
          [hasta, fijo, 0],
          [hasta, fijo, h],
          [desde, fijo, h],
        ]
      : [
          [fijo, desde, 0],
          [fijo, hasta, 0],
          [fijo, hasta, h],
          [fijo, desde, h],
        ];
  const [a, b] = eje === "x" ? [p(desde, fijo, h), p(hasta, fijo, h)] : [p(fijo, desde, h), p(fijo, hasta, h)];
  return (
    <g pointerEvents="none">
      <polygon points={pts(puntos)} fill="#E0F2FE" opacity={0.35} stroke="#BAE6FD" strokeWidth={0.8} />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#94A3B8" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

/* ───────── Medellín en la Salida a PULSO (ilustración de referencia, sin cifras) ───────── */

function Ventanas({ x, y, w, d, h, paso = 0.35 }: { x: number; y: number; w: number; d: number; h: number; paso?: number }) {
  const v: ReactNode[] = [];
  let k = 0;
  for (let z = 0.3; z < h - 0.15; z += 0.42) {
    for (let u = 0.2; u < w - 0.1; u += paso) {
      const [wx, wy] = p(x + u, y + d, z);
      v.push(<rect key={`i${k++}`} x={wx - 1.5} y={wy - 2.5} width={3} height={3} fill="#FDE68A" opacity={(k * 7) % 5 ? 0.85 : 0.22} />);
    }
    for (let u = 0.2; u < d - 0.1; u += paso) {
      const [wx, wy] = p(x + w, y + u, z);
      v.push(<rect key={`d${k++}`} x={wx - 1.5} y={wy - 2.5} width={3} height={3} fill="#FDE68A" opacity={(k * 3) % 4 ? 0.7 : 0.2} />);
    }
  }
  return <g>{v}</g>;
}

function Edificio({ x, y, w = 0.85, d = 0.85, h }: { x: number; y: number; w?: number; d?: number; h: number }) {
  return (
    <g>
      <Bloque x={x} y={y} w={w} d={d} h={h} tapa="#3B6296" izq="#1E3A5F" der="#14294A" linea="#0B122066" />
      <Ventanas x={x} y={y} w={w} d={d} h={h} />
    </g>
  );
}

function Lugar({ x, y, z, texto }: { x: number; y: number; z: number; texto: string }) {
  const [lx, ly] = p(x, y, z);
  const ancho = texto.length * 5.6 + 12;
  return (
    <g pointerEvents="none">
      <rect x={lx - ancho / 2} y={ly - 14} width={ancho} height={15} rx={4} fill="#0B1220" opacity={0.85} />
      <text x={lx} y={ly - 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#E0F2FE">
        {texto}
      </text>
    </g>
  );
}

function Medellin() {
  const apice = p(26.7, 12.9, 5.3);
  const [mx, my] = p(23.4, 16.6, 0.05);
  return (
    <g>
      {/* río Medellín y plaza de La Alpujarra */}
      <polygon points={rect(19.8, 12.3, 0.55, 7.7, 0.01)} fill="#1D4ED8" opacity={0.85} />
      <polygon points={rect(21.0, 15.75, 3.3, 1.7, 0.02)} fill="#94A3B8" opacity={0.9} />
      <Edificio x={21.0} y={12.6} h={1.3} />
      <Edificio x={23.5} y={12.5} h={1.6} />
      {/* Gobernación de Antioquia: torre ancha con aletas verticales */}
      <Bloque x={21.0} y={14.4} w={2.5} d={1.1} h={2.7} tapa="#E2E8F0" izq="#CBD5E1" der="#94A3B8" linea="#0B122044" />
      <Ventanas x={21.0} y={14.4} w={2.5} d={1.1} h={2.7} paso={0.3} />
      {Array.from({ length: 9 }, (_, k) => {
        const [ax, ay] = p(21.0 + k * 0.3, 15.5, 0);
        const [bx, by] = p(21.0 + k * 0.3, 15.5, 2.7);
        return <line key={k} x1={ax} y1={ay} x2={bx} y2={by} stroke="#F8FAFC" strokeWidth={1.2} opacity={0.9} />;
      })}
      <Edificio x={24.8} y={13.4} h={2.3} />
      {/* Edificio Coltejer: torre esbelta con remate en forma de aguja */}
      <Bloque x={26.2} y={12.4} w={1.0} d={1.0} h={4.0} tapa="#F1F5F9" izq="#E2E8F0" der="#94A3B8" linea="#0B122044" />
      <Ventanas x={26.2} y={12.4} w={1.0} d={1.0} h={4.0} paso={0.3} />
      <polygon points={`${pts([[26.2, 13.4, 4.0], [27.2, 13.4, 4.0]])} ${apice[0]},${apice[1]}`} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.7} />
      <polygon points={`${pts([[27.2, 12.4, 4.0], [27.2, 13.4, 4.0]])} ${apice[0]},${apice[1]}`} fill="#94A3B8" stroke="#64748B" strokeWidth={0.7} />
      <line x1={p(26.7, 13.4, 4.25)[0]} y1={p(26.7, 13.4, 4.25)[1]} x2={p(26.7, 13.15, 4.8)[0]} y2={p(26.7, 13.15, 4.8)[1]} stroke="#FDE68A" strokeWidth={2.4} strokeLinecap="round" />
      <line x1={apice[0]} y1={apice[1]} x2={apice[0]} y2={apice[1] - 15} stroke="#94A3B8" strokeWidth={1.4} />
      <Edificio x={26.9} y={14.9} h={1.5} />
      <Edificio x={25.6} y={16.2} h={0.9} />
      {/* Monumento a la Raza, en la plaza de La Alpujarra */}
      <Bloque x={23.2} y={16.4} z={0.02} w={0.4} d={0.4} h={0.12} tapa="#94A3B8" izq="#64748B" der="#475569" />
      <path d={`M${mx},${my - 3} C${mx + 3},${my - 18} ${mx - 5},${my - 32} ${mx + 1},${my - 46} S${mx + 13},${my - 60} ${mx + 9},${my - 64}`} fill="none" stroke="#B7793E" strokeWidth={4.5} strokeLinecap="round" />
      {/* Alcaldía de Medellín: bloque bajo y ancho con franjas horizontales */}
      <Bloque x={21.0} y={17.6} w={2.9} d={1.5} h={1.5} tapa="#E2E8F0" izq="#CBD5E1" der="#94A3B8" linea="#0B122044" />
      <Ventanas x={21.0} y={17.6} w={2.9} d={1.5} h={1.5} paso={0.3} />
      {[0.45, 0.9, 1.35].map((z) => {
        const [ax, ay] = p(21.0, 19.1, z);
        const [bx, by] = p(23.9, 19.1, z);
        return <line key={z} x1={ax} y1={ay} x2={bx} y2={by} stroke="#F8FAFC" strokeWidth={1.6} />;
      })}
      <Edificio x={26.9} y={18.6} h={0.7} />
      <Edificio x={25.4} y={18.9} h={0.5} />
      <Lugar x={26.7} y={12.9} z={6.1} texto="Edificio Coltejer" />
      <Lugar x={22.25} y={14.95} z={3.3} texto="Gobernación de Antioquia" />
      <Lugar x={23.6} y={16.6} z={2.7} texto="La Alpujarra" />
      <Lugar x={22.45} y={18.7} z={1.85} texto="Alcaldía de Medellín" />
      <Lugar x={20.1} y={18.9} z={0.2} texto="Río Medellín" />
    </g>
  );
}

/* ───────── escena ───────── */

export default function OficinaIso({
  agentes,
  datos,
  onAbrir,
  enfocado,
}: {
  agentes: Record<IdAgente, EstadoVisibleAgente>;
  datos: DatosMundo;
  onAbrir(id: IdArea): void;
  enfocado: IdArea | null;
}) {
  const r = salaDe("reloj");
  const l = salaDe("lab");
  const m = salaDe("monitoreo");
  const v = salaDe("ventanilla");
  const a = salaDe("analista");
  const etiqueta = (id: IdArea, nombre: string) => `${nombre}. ${agentes[id as IdAgente]?.frase ?? ""} Abrir la herramienta.`;

  // tablero del Reloj: barras con los estados reales del catálogo
  const estados: { k: keyof DatosMundo["porEstado"]; c: string; t: string }[] = [
    { k: "al-dia", c: "#16A34A", t: "al día" },
    { k: "atrasado", c: "#D97706", t: "atrasados" },
    { k: "critico", c: "#DC2626", t: "críticos" },
    { k: "sin-periodicidad", c: "#94A3B8", t: "sin periodicidad" },
  ];
  const maxEstado = Math.max(1, ...estados.map((e) => datos.porEstado[e.k]));

  // flujo de los datos: del archivo crudo, por los despachos, hasta PULSO
  const flujo = pts([
    [3.2, 6.4],
    [3.2, 7.9],
    [23.6, 7.9],
    [23.6, 11.2],
  ]);

  return (
    <svg viewBox={`0 0 ${VIEWBOX_W.toFixed(0)} ${VIEWBOX_H.toFixed(0)}`} className="h-auto w-full select-none" role="group" aria-label="Oficina de la Agencia de datos: cinco despachos, el archivo de datos crudos de MEData y la salida hacia PULSO.">
      <defs>
        <pattern id="baldosa" width={U} height={U} patternUnits="userSpaceOnUse" patternTransform={sobrePiso(0, 0)}>
          <rect width={U} height={U} fill={PISO} />
          <path d={`M${U},0 V${U} H0`} fill="none" stroke={LINEA_PISO} strokeWidth={1} />
        </pattern>
        <pattern id="noche" width={U} height={U} patternUnits="userSpaceOnUse" patternTransform={sobrePiso(0, 0)}>
          <rect width={U} height={U} fill={NOCHE} />
          <path d={`M${U},0 V${U} H0`} fill="none" stroke="#1B2B47" strokeWidth={1} />
        </pattern>
      </defs>

      {/* ── piso y muros ── */}
      <polygon points={rect(0, 0, ANCHO, FONDO)} fill="url(#baldosa)" stroke="#CBD5E1" strokeWidth={1.5} />
      <polygon points={pts([[0, 0, 0], [ANCHO, 0, 0], [ANCHO, 0, ALTO_MURO], [0, 0, ALTO_MURO]])} fill={MURO} stroke="#E2E8F0" />
      <polygon points={pts([[0, 0, 0], [0, FONDO, 0], [0, FONDO, ALTO_MURO], [0, 0, ALTO_MURO]])} fill={MURO_LADO} stroke="#E2E8F0" />
      <polygon points={pts([[0, -0.3, ALTO_MURO], [ANCHO, -0.3, ALTO_MURO], [ANCHO, 0, ALTO_MURO], [0, 0, ALTO_MURO]])} fill={MURO_TAPA} />
      <polygon points={pts([[-0.3, -0.3, ALTO_MURO], [0, -0.3, ALTO_MURO], [0, FONDO, ALTO_MURO], [-0.3, FONDO, ALTO_MURO]])} fill={MURO_TAPA} />
      {/* zócalo */}
      <polygon points={pts([[0, 0, 0], [ANCHO, 0, 0], [ANCHO, 0, 0.18], [0, 0, 0.18]])} fill="#E2E8F0" />
      <polygon points={pts([[0, 0, 0], [0, FONDO, 0], [0, FONDO, 0.18], [0, 0, 0.18]])} fill="#DCE3EC" />

      {/* ventanas y letrero del muro */}
      <Ventana x={14.2} />
      <Ventana x={17.4} />
      <g transform={sobreMuroY(7.6, 3.1)}>
        <rect x={0} y={0} width={2.4 * U} height={1.6 * U} rx={3} fill="#DBEAFE" stroke="#CBD5E1" strokeWidth={2} />
        <path d={`M${1.2 * U},0 V${1.6 * U}`} stroke="#FFFFFF" strokeWidth={3} />
      </g>

      {/* ── alfombras de las zonas comunes ── */}
      {/* Archivo MEData */}
      <polygon points={rect(0.18, 0.18, 6.1, 6.84)} fill="#EEF2F7" stroke="#CBD5E1" strokeWidth={1.4} />
      {/* Salida a PULSO: el piso se vuelve el mapa nocturno */}
      <Link href="/" aria-label="Salida a PULSO: ver la ciudad en vivo">
        <g className="salida-pulso">
          <polygon points={rect(19.6, 11, 8.4, 9)} fill="url(#noche)" stroke="#1E3A8A" strokeWidth={1.6} />
        </g>
      </Link>

      {/* camino del flujo de datos */}
      <polyline points={flujo} fill="none" stroke="#BFDBFE" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={flujo} fill="none" stroke={AZUL} strokeWidth={2.4} strokeDasharray="8 6" strokeLinejoin="round" className="pulso-linea" />
      <g transform={sobrePiso(8.6, 8.5)} pointerEvents="none">
        <text fontSize={9.5} fontWeight={700} fill="#64748B" fontFamily="var(--font-jetbrains), monospace" letterSpacing="0.08em">
          DATOS CRUDOS →
        </text>
      </g>
      <g transform={sobrePiso(14.6, 8.5)} pointerEvents="none">
        <text fontSize={9.5} fontWeight={700} fill={AZUL} fontFamily="var(--font-jetbrains), monospace" letterSpacing="0.08em">
          AUDITADOS Y LIMPIOS → PULSO
        </text>
      </g>

      {/* ── fila del fondo ── */}
      {/* Archivo MEData: estantes de servidores y cajas de papeles */}
      <g pointerEvents="none">
        <g transform={sobreMuroX(0.7, 3.25)}>
          <rect x={0} y={0} width={4.8 * U} height={0.8 * U} rx={4} fill={NOCHE} />
          <text x={10} y={14} fontSize={10} fontWeight={800} fill="#FFFFFF" letterSpacing="0.08em">
            ARCHIVO MEDATA
          </text>
          <text x={10} y={26} fontSize={9} fill="#93C5FD" fontFamily="var(--font-jetbrains), monospace">
            {miles(datos.totalConjuntos)} conjuntos · datos crudos
          </text>
        </g>
        {[0.5, 1.95, 3.4].map((x) => (
          <g key={x}>
            <Bloque x={x} y={0.35} w={1.25} d={1.15} h={2.4} tapa="#475569" izq="#334155" der="#1E293B" />
            {[0.5, 0.95, 1.4, 1.85].map((z, i) => {
              const [lx, ly] = p(x + 0.25, 1.5, z);
              return (
                <g key={z}>
                  <circle cx={lx + 4} cy={ly + 2} r={1.6} fill={i % 2 ? "#34D399" : "#60A5FA"} className={i % 2 ? "led-parpadea" : "led-parpadea-lento"} />
                  <circle cx={lx + 10} cy={ly + 5} r={1.3} fill="#FBBF24" opacity={0.85} />
                </g>
              );
            })}
          </g>
        ))}
        <Bloque x={1.0} y={4.0} w={1.0} d={0.8} h={0.45} tapa="#F5F0E6" izq="#E7DFCF" der="#D6CCB8" />
        <Bloque x={1.05} y={4.05} z={0.45} w={0.9} d={0.7} h={0.4} tapa="#FBF8F1" izq="#EDE6D6" der="#DCD2BE" />
        <Bloque x={2.6} y={4.6} w={1.0} d={0.8} h={0.45} tapa="#F5F0E6" izq="#E7DFCF" der="#D6CCB8" />
        <Bloque x={4.3} y={3.3} w={1.1} d={0.9} h={0.55} tapa="#F5F0E6" izq="#E7DFCF" der="#D6CCB8" />
        <Bloque x={4.35} y={3.35} z={0.55} w={1.0} d={0.8} h={0.4} tapa="#FBF8F1" izq="#EDE6D6" der="#DCD2BE" />
        <Planta x={5.3} y={5.9} s={0.85} />
      </g>

      <Mampara desde={0} hasta={7.2} fijo={6.4} eje="y" />

      {/* 01 · Reloj de Frescura */}
      <Interactiva id="reloj" etiqueta={etiqueta("reloj", "01 Reloj de Frescura")} activa={enfocado === "reloj"} onAbrir={onAbrir}>
        <Alfombra s={r} />
        {/* reloj de pared */}
        <g transform={sobreMuroX(7.4, 3.15)}>
          <circle cx={0.9 * U} cy={0.9 * U} r={0.85 * U} fill="#FFFFFF" stroke="#1E293B" strokeWidth={3} />
          {Array.from({ length: 12 }, (_, i) => {
            const ang = (i * Math.PI) / 6;
            return <line key={i} x1={r1(0.9 * U + Math.sin(ang) * 0.68 * U)} y1={r1(0.9 * U - Math.cos(ang) * 0.68 * U)} x2={r1(0.9 * U + Math.sin(ang) * 0.76 * U)} y2={r1(0.9 * U - Math.cos(ang) * 0.76 * U)} stroke="#475569" strokeWidth={1.6} />;
          })}
          <line x1={0.9 * U} y1={0.9 * U} x2={0.9 * U} y2={0.9 * U - 0.55 * U} stroke="#1E293B" strokeWidth={2.4} strokeLinecap="round" className="manecilla-min" />
          <line x1={0.9 * U} y1={0.9 * U} x2={0.9 * U + 0.36 * U} y2={0.9 * U} stroke="#D97706" strokeWidth={2.4} strokeLinecap="round" className="manecilla-hora" />
          <circle cx={0.9 * U} cy={0.9 * U} r={2.6} fill="#D97706" />
        </g>
        {/* tablero con los estados reales del catálogo */}
        <g transform={sobreMuroX(9.9, 3.2)}>
          <rect x={0} y={0} width={3.0 * U} height={2.0 * U} rx={4} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={2} />
          <text x={8} y={13} fontSize={8.5} fontWeight={800} fill="#475569" letterSpacing="0.06em">
            ESTADO DEL CATÁLOGO
          </text>
          {estados.map((e, i) => {
            const alto = (datos.porEstado[e.k] / maxEstado) * 1.15 * U;
            return (
              <g key={e.k}>
                <title>{`${miles(datos.porEstado[e.k])} conjuntos ${e.t}`}</title>
                <rect x={12 + i * 0.68 * U} y={1.75 * U - alto} width={0.46 * U} height={alto} rx={2} fill={e.c} />
              </g>
            );
          })}
        </g>
        <Silla x={8.75} y={2.0} color="#D97706" />
        <Agente id="reloj" x={9.2} y={2.95} />
        <Escritorio x={8.0} y={3.3} lados={["#FDF1D8", "#F3D49B"]} />
        <Monitor x={8.4} y={3.38} />
        {/* reloj de arena */}
        <g transform={`translate(${p(9.95, 3.75, 0.78)[0].toFixed(1)} ${p(9.95, 3.75, 0.78)[1].toFixed(1)})`}>
          <path d="M-4,-14 H4 L0,-7 L4,0 H-4 L0,-7 Z" fill="#FDE68A" stroke="#B45309" strokeWidth={1} />
        </g>
        <Planta x={12.2} y={5.9} s={0.8} />
        <Rotulo x={7.0} y={6.75} num={r.num} texto="Reloj de Frescura" color={r.acento} />
      </Interactiva>

      <Mampara desde={0} hasta={7.2} fijo={13.25} eje="y" />

      {/* 02 · Laboratorio de Limpieza */}
      <Interactiva id="lab" etiqueta={etiqueta("lab", "02 Laboratorio de Limpieza")} activa={enfocado === "lab"} onAbrir={onAbrir}>
        <Alfombra s={l} />
        <Agente id="lab" x={16.7} y={1.75} />
        <Bloque x={14.4} y={2.2} w={4.8} h={0.85} d={1.25} tapa="#FFFFFF" izq="#D5F5EF" der="#9FE3D6" />
        {/* frascos sobre el mesón */}
        {[
          [14.8, 2.7, "#14B8A6"],
          [15.5, 2.55, "#60A5FA"],
          [17.9, 2.6, "#F59E0B"],
          [18.6, 2.75, "#34D399"],
        ].map(([x, y, c]) => {
          const [fx, fy] = p(x as number, y as number, 0.85);
          return (
            <g key={`${x}`} transform={`translate(${fx.toFixed(1)} ${fy.toFixed(1)})`}>
              <path d="M-2.4,-17 H2.4 V-11 L6,-2 Q6,1 3,1 H-3 Q-6,1 -6,-2 L-2.4,-11 Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth={0.9} opacity={0.95} />
              <path d="M-4.6,-5 L4.6,-5 L6,-2 Q6,1 3,1 H-3 Q-6,1 -6,-2 Z" fill={c as string} />
            </g>
          );
        })}
        <Monitor x={16.2} y={2.3} z={0.85} w={1.1} />
        {/* tablero antes / después en la pared */}
        <g transform={sobreMuroX(19.0, 3.2)}>
          <rect x={0} y={0} width={1.5 * U} height={1.9 * U} rx={4} fill={NOCHE} />
          <rect x={6} y={8} width={0.5 * U} height={1.5 * U} rx={2} fill="#7F1D1D" />
          <rect x={0.8 * U} y={8} width={0.5 * U} height={1.5 * U} rx={2} fill="#065F46" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={9} y={13 + i * 7} width={i % 2 ? 6 : 8} height={3} fill="#FCA5A5" />
              <rect x={0.8 * U + 3} y={13 + i * 7} width={8} height={3} fill="#6EE7B7" />
            </g>
          ))}
        </g>
        <Planta x={13.7} y={5.8} s={0.8} />
        <Rotulo x={13.8} y={6.75} num={l.num} texto="Laboratorio de Limpieza" color={l.acento} />
      </Interactiva>

      <Mampara desde={0} hasta={7.2} fijo={20.75} eje="y" />

      {/* 05 · Sala de Monitoreo */}
      <Interactiva id="monitoreo" etiqueta={etiqueta("monitoreo", "05 Sala de Monitoreo")} activa={enfocado === "monitoreo"} onAbrir={onAbrir}>
        <Alfombra s={m} />
        {/* videowall */}
        <g transform={sobreMuroX(21.4, 3.3)}>
          {[0, 1, 2].map((c) =>
            [0, 1].map((f) => (
              <g key={`${c}-${f}`} transform={`translate(${c * 1.95 * U} ${f * 1.05 * U})`}>
                <rect width={1.85 * U} height={0.95 * U} rx={3} fill={NOCHE} stroke="#334155" strokeWidth={1.5} />
                {f === 0 && c === 0 && (
                  <polyline points="6,18 14,12 22,15 30,7 40,10" fill="none" stroke="#34D399" strokeWidth={1.8} />
                )}
                {f === 0 && c === 1 && [6, 14, 22, 30, 38].map((x, i) => <rect key={x} x={x} y={20 - (i % 3) * 4 - 4} width={5} height={(i % 3) * 4 + 4} fill="#60A5FA" />)}
                {f === 0 && c === 2 && (
                  <>
                    <circle cx={14} cy={12} r={3} fill="#34D399" className="led-parpadea" />
                    <circle cx={28} cy={9} r={3} fill="#FBBF24" />
                    <circle cx={38} cy={16} r={3} fill="#34D399" />
                  </>
                )}
                {f === 1 && <path d="M6,16 Q16,4 26,12 T46,9" fill="none" stroke="#7DD3FC" strokeWidth={1.6} />}
              </g>
            )),
          )}
        </g>
        <Silla x={23.9} y={2.6} color="#059669" />
        <Agente id="monitoreo" x={24.35} y={3.45} />
        <Escritorio x={22.9} y={3.8} w={2.9} lados={["#DDF5EA", "#A7E3C7"]} />
        <Monitor x={23.1} y={3.88} />
        <Monitor x={24.55} y={3.88} />
        <Planta x={27.0} y={5.9} s={0.8} />
        <Rotulo x={21.3} y={6.75} num={m.num} texto="Sala de Monitoreo" color={m.acento} />
      </Interactiva>

      {/* mampara frontal de la fila del fondo (con puertas) */}
      {[
        [0, 2.2],
        [4.6, 9.2],
        [11.0, 15.4],
        [17.6, 22.4],
        [24.6, 28],
      ].map(([d, h]) => (
        <Mampara key={d} desde={d} hasta={h} fijo={7.2} eje="x" />
      ))}

      {/* 03 · Ventanilla de Apertura */}
      <Interactiva id="ventanilla" etiqueta={etiqueta("ventanilla", "03 Ventanilla de Apertura")} activa={enfocado === "ventanilla"} onAbrir={onAbrir}>
        <Alfombra s={v} />
        {/* tablero de propuestas en la pared */}
        <g transform={sobreMuroY(13.4, 3.15)}>
          <rect x={0} y={0} width={4.2 * U} height={1.9 * U} rx={4} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={2} />
          <text x={8} y={13} fontSize={8.5} fontWeight={800} fill="#6D28D9" letterSpacing="0.06em">
            PROPUESTAS DE APERTURA
          </text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={10 + (i % 3) * 1.3 * U} y={20 + Math.floor(i / 3) * 0.72 * U} width={1.05 * U} height={0.55 * U} rx={2} fill={["#EDE9FE", "#DDD6FE", "#FEF3C7"][i % 3]} stroke="#C4B5FD" strokeWidth={0.8} />
          ))}
        </g>
        <Agente id="ventanilla" x={2.9} y={11.2} />
        {/* mostrador con vidrio de ventanilla */}
        <Bloque x={4.1} y={9.4} w={1.0} d={3.8} h={1.05} tapa="#FFFFFF" izq="#EDE9FE" der="#CABDFA" />
        <polygon points={pts([[4.6, 9.4, 1.05], [4.6, 13.2, 1.05], [4.6, 13.2, 2.35], [4.6, 9.4, 2.35]])} fill="#E0F2FE" opacity={0.45} stroke="#A5B4FC" strokeWidth={1} />
        <polygon points={pts([[4.6, 10.6, 1.05], [4.6, 12.0, 1.05], [4.6, 12.0, 1.6], [4.6, 10.6, 1.6]])} fill="#FFFFFF" opacity={0.7} />
        {/* bandeja con tarjetas de propuesta */}
        <polygon points={rect(4.25, 9.7, 0.7, 0.55, 1.06)} fill="#8B5CF6" />
        <polygon points={rect(4.3, 9.75, 0.6, 0.45, 1.12)} fill="#FFFFFF" stroke="#C4B5FD" strokeWidth={0.6} />
        <Planta x={0.6} y={13.0} s={0.85} />
        <Rotulo x={0.35} y={13.6} num={v.num} texto="Ventanilla de Apertura" color={v.acento} />
      </Interactiva>

      {/* recepción */}
      <g pointerEvents="none">
        <g transform={sobrePiso(13.6, 12.6)}>
          <circle cx={0} cy={0} r={3.4 * U} fill="#EFF6FF" stroke="#BFDBFE" strokeWidth={1.5} />
          <circle cx={0} cy={0} r={2.7 * U} fill="none" stroke="#DBEAFE" strokeWidth={1.2} strokeDasharray="5 6" />
        </g>
        <Agente id="guia" x={13.5} y={12.55} saluda />
        <Bloque x={11.6} y={13.0} w={4.0} d={1.1} h={1.0} tapa="#FFFFFF" izq={NOCHE} der="#1E293B" />
        <g transform={sobreCaraX(11.6, 14.1, 0.92)}>
          <circle cx={16} cy={11} r={4} fill="#34D399" />
          <text x={26} y={15} fontSize={12} fontWeight={800} fill="#FFFFFF" letterSpacing="0.14em">
            PULSO
          </text>
          <text x={73} y={15} fontSize={8.5} fill="#93C5FD">
            Agencia de datos
          </text>
        </g>
        <Planta x={10.0} y={10.0} s={1.15} />
        <Planta x={17.3} y={15.4} s={1.1} />
        {/* sala de espera */}
        <Bloque x={16.4} y={9.6} w={1.9} d={0.85} h={0.42} tapa="#DBEAFE" izq="#BFDBFE" der="#93C5FD" />
        <Bloque x={16.4} y={9.6} z={0.42} w={1.9} d={0.25} h={0.55} tapa="#BFDBFE" izq="#93C5FD" der="#60A5FA" />
        <Bloque x={9.6} y={15.6} w={1.2} d={1.2} h={0.42} tapa="#FFFFFF" izq="#E2E8F0" der="#CBD5E1" />
      </g>

      {/* 06 · Comunicaciones */}
      <Interactiva id="comunicaciones" etiqueta={etiqueta("comunicaciones", "06 Comunicaciones")} activa={enfocado === "comunicaciones"} onAbrir={onAbrir}>
        <Alfombra s={salaDe("comunicaciones")} />
        {/* exhibidor con informes */}
        <Bloque x={8.9} y={17.5} w={0.9} d={0.5} h={1.3} tapa="#FFFFFF" izq="#FED7AA" der="#FDBA74" />
        {[0.35, 0.75, 1.1].map((z, k) => (
          <polygon key={z} points={pts([[9.0, 18.0, z], [9.7, 18.0, z], [9.7, 18.0, z + 0.28], [9.0, 18.0, z + 0.28]])} fill={["#FFFFFF", "#FFEDD5", "#DBEAFE"][k]} stroke="#FB923C" strokeWidth={0.6} />
        ))}
        {/* impresora con hojas que salen */}
        <Bloque x={15.2} y={17.45} w={1.0} d={0.75} h={0.8} tapa="#E2E8F0" izq="#CBD5E1" der="#94A3B8" />
        <Bloque x={15.3} y={17.5} z={0.8} w={0.8} d={0.55} h={0.22} tapa="#334155" izq="#1E293B" der="#0B1220" />
        <g className="hoja-imprime">
          <polygon points={rect(15.4, 17.95, 0.6, 0.5, 0.82)} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth={0.6} />
          <line x1={p(15.5, 18.1, 0.83)[0]} y1={p(15.5, 18.1, 0.83)[1]} x2={p(15.85, 18.1, 0.83)[0]} y2={p(15.85, 18.1, 0.83)[1]} stroke="#C2410C" strokeWidth={1.2} />
        </g>
        <circle cx={p(16.2, 17.8, 0.65)[0]} cy={p(16.2, 17.8, 0.65)[1]} r={1.8} fill="#34D399" className="led-parpadea-lento" />
        <Silla x={11.8} y={17.4} color="#C2410C" />
        <Agente id="comunicaciones" x={12.2} y={18.2} />
        <Escritorio x={11.0} y={18.55} w={2.4} d={0.95} lados={["#FFEDD5", "#FDC9A9"]} />
        <Monitor x={11.75} y={18.62} />
        <Planta x={17.0} y={18.9} s={0.85} />
        <Rotulo x={8.7} y={19.72} num="06" texto="Comunicaciones" color="#C2410C" />
      </Interactiva>

      {/* 04 · Analista (PulsoBot) */}
      <Interactiva id="analista" etiqueta={etiqueta("analista", "04 Analista, PulsoBot")} activa={enfocado === "analista"} onAbrir={onAbrir}>
        <Alfombra s={a} />
        {/* pantalla de conversación en la pared */}
        <g transform={sobreMuroY(19.6, 3.15)}>
          <rect x={0} y={0} width={4.4 * U} height={2.0 * U} rx={5} fill={NOCHE} />
          <rect x={10} y={10} width={2.2 * U} height={12} rx={6} fill="#1E3A8A" />
          <rect x={1.9 * U} y={28} width={2.2 * U} height={12} rx={6} fill={AZUL} />
          <circle cx={4.4 * U - 14} cy={14} r={3.5} fill="#34D399" className="led-parpadea" />
        </g>
        <Silla x={3.2} y={15.6} color={AZUL} />
        <Agente id="analista" x={3.65} y={16.5} />
        <Escritorio x={2.5} y={16.85} lados={["#E0ECFF", "#B9D3FB"]} />
        <Monitor x={2.9} y={16.93} />
        {/* globo de diálogo flotante */}
        <g transform={`translate(${p(5.6, 16.2, 2.3)[0]} ${p(5.6, 16.2, 2.3)[1]})`}>
          <g className="globo-flota">
            <rect x={-15} y={-11} width={30} height={20} rx={9} fill="#FFFFFF" stroke="#BFDBFE" />
            <circle cx={-7} cy={-1} r={2} fill={AZUL} />
            <circle cx={0} cy={-1} r={2} fill={AZUL} opacity={0.7} />
            <circle cx={7} cy={-1} r={2} fill={AZUL} opacity={0.4} />
          </g>
        </g>
        <Planta x={0.6} y={19.0} s={0.9} />
        <Rotulo x={0.35} y={19.6} num={a.num} texto="Analista · PulsoBot" color={a.acento} />
      </Interactiva>

      {/* salida a PULSO: ciudad nocturna (ilustración, sin cifras) */}
      <Link href="/" aria-label="Salida a PULSO: ver la ciudad en vivo" className="salida-pulso">
        <g>
          <Medellin />
          <g transform={sobrePiso(20.6, 19.75)}>
            <rect x={-4} y={-13} width={182} height={20} rx={10} fill={AZUL} />
            <text x={10} y={1.5} fontSize={11.5} fontWeight={800} fill="#FFFFFF" letterSpacing="0.08em">
              SALIDA A PULSO · EN VIVO →
            </text>
          </g>
          {/* faros (decorativos) */}
          {[
            [20.9, 11.6],
            [24.4, 11.5],
            [27.4, 11.6],
          ].map(([x, y], i) => {
            const [bx, by] = p(x, y);
            return (
              <g key={i}>
                <ellipse cx={bx} cy={by} rx={12} ry={6} fill="none" stroke="#34D399" strokeWidth={1.5} className="faro-late" />
                <circle cx={bx} cy={by - 2} r={3.5} fill="#34D399" />
              </g>
            );
          })}
        </g>
      </Link>

      {/* ── etiquetas flotantes (siempre encima) ── */}
      <g onClick={() => onAbrir("reloj")} className="cursor-pointer">
        <Ronda id="reloj">
          <Etiqueta x={9.2} y={2.95} nombre="Relojero" info={agentes.reloj} />
        </Ronda>
      </g>
      <g onClick={() => onAbrir("lab")} className="cursor-pointer">
        <Ronda id="lab">
          <Etiqueta x={16.7} y={1.75} nombre="Científica de datos" info={agentes.lab} />
        </Ronda>
      </g>
      <g onClick={() => onAbrir("monitoreo")} className="cursor-pointer">
        <Ronda id="monitoreo">
          <Etiqueta x={24.35} y={3.45} nombre="Operadora" info={agentes.monitoreo} />
        </Ronda>
      </g>
      <g onClick={() => onAbrir("ventanilla")} className="cursor-pointer">
        <Ronda id="ventanilla">
          <Etiqueta x={2.9} y={11.2} nombre="Ventanilla" info={agentes.ventanilla} />
        </Ronda>
      </g>
      <g onClick={() => onAbrir("analista")} className="cursor-pointer">
        <Ronda id="analista">
          <Etiqueta x={3.65} y={16.5} nombre="PulsoBot" info={agentes.analista} />
        </Ronda>
      </g>
      <g onClick={() => onAbrir("comunicaciones")} className="cursor-pointer">
        <Ronda id="comunicaciones">
          <Etiqueta x={12.2} y={18.2} nombre="Vocera" info={agentes.comunicaciones} />
        </Ronda>
      </g>
      <Ronda id="guia">
        <Etiqueta x={13.5} y={12.55} nombre="Recepción" info={agentes.guia} alto={68} />
      </Ronda>
    </svg>
  );
}

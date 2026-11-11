"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { decimal, miles } from "@/mundo/areas";
import { EJES_ARANA, type CalorAbandono, type EjeArana, type FlujoCatalogo, type PerfilSecretaria, type Visuales } from "@/lib/visuales";

/** Se activa cuando el bloque entra en pantalla (para que la animación se vea, no que ocurra fuera de vista). */
function useVisible<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sin animación: se muestra de una vez
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisible(true), io.disconnect()), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}

/** Número que sube de 0 a su valor cuando el bloque aparece. */
function Contador({ valor, activo, duracion = 900 }: { valor: number; activo: boolean; duracion?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!activo) return;
    let raf = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / duracion);
      setN(Math.round(valor * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [activo, valor, duracion]);
  return <>{miles(activo ? n : 0)}</>;
}

const tarjeta = "min-w-0 rounded-3xl border border-[#E3EAF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)] sm:p-6";

/* ───────────────────── 1. Flujo del catálogo (diagrama de Sankey) ───────────────────── */

interface Nodo {
  id: string;
  col: number;
  valor: number;
  color: string;
  texto: string;
  y?: number;
  h?: number;
  sal?: number;
  ent?: number;
}
interface Enlace {
  de: string;
  a: string;
  valor: number;
}

export function FlujoSankey({ flujo }: { flujo: FlujoCatalogo }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [foco, setFoco] = useState<string | null>(null);
  const W = 920;
  const H = 360;
  const ancho = 16;
  const cols = [20, 300, 580, 884];
  const gap = 14;
  const e = Object.fromEntries(flujo.estados.map((x) => [x.estado, x]));
  const nodos: Nodo[] = [
    { id: "cat", col: 0, valor: flujo.total, color: "#475569", texto: "Catálogo de MEData" },
    { id: "con", col: 1, valor: flujo.conPeriodicidad, color: "#2563EB", texto: "Prometen una periodicidad" },
    { id: "sin", col: 1, valor: flujo.sinPeriodicidad, color: "#94A3B8", texto: "No dicen cada cuánto" },
    { id: "al-dia", col: 2, valor: e["al-dia"].n, color: "#16A34A", texto: "Al día" },
    { id: "atrasado", col: 2, valor: e.atrasado.n, color: "#D97706", texto: "Atrasados" },
    { id: "critico", col: 2, valor: e.critico.n, color: "#DC2626", texto: "Críticos" },
    { id: "prop", col: 3, valor: flujo.propuestas, color: "#7C3AED", texto: "Con propuesta de mejora" },
    { id: "ok", col: 3, valor: flujo.sinPropuesta, color: "#CBD5E1", texto: "Sin problemas" },
  ];
  const enlaces: Enlace[] = [
    { de: "cat", a: "con", valor: flujo.conPeriodicidad },
    { de: "cat", a: "sin", valor: flujo.sinPeriodicidad },
    ...(["al-dia", "atrasado", "critico"] as const).map((k) => ({ de: "con", a: k, valor: e[k].n })),
    ...(["al-dia", "atrasado", "critico"] as const).flatMap((k) => [
      { de: k, a: "prop", valor: e[k].conPropuesta },
      { de: k, a: "ok", valor: e[k].n - e[k].conPropuesta },
    ]),
    { de: "sin", a: "prop", valor: flujo.sinPeriodicidadConPropuesta },
    { de: "sin", a: "ok", valor: flujo.sinPeriodicidad - flujo.sinPeriodicidadConPropuesta },
  ].filter((l) => l.valor > 0);

  // escala: la columna más llena ocupa el alto disponible
  const porCol = [0, 1, 2, 3].map((c) => nodos.filter((n) => n.col === c));
  const escala = Math.min(...porCol.map((ns) => (H - 30 - gap * (ns.length - 1)) / ns.reduce((a, n) => a + n.valor, 0)));
  for (const ns of porCol) {
    const alto = ns.reduce((a, n) => a + n.valor * escala, 0) + gap * (ns.length - 1);
    let y = (H - alto) / 2;
    for (const n of ns) {
      n.h = Math.max(2, n.valor * escala);
      n.y = y;
      n.sal = 0;
      n.ent = 0;
      y += n.h + gap;
    }
  }
  const por = Object.fromEntries(nodos.map((n) => [n.id, n]));
  const caminos = enlaces.map((l) => {
    const a = por[l.de];
    const b = por[l.a];
    const g = l.valor * escala;
    const y0 = a.y! + a.sal!;
    const y1 = b.y! + b.ent!;
    a.sal! += g;
    b.ent! += g;
    const x0 = cols[a.col] + ancho;
    const x1 = cols[b.col];
    const m = (x0 + x1) / 2;
    return {
      ...l,
      color: b.color,
      col: a.col,
      d: `M${x0},${y0} C${m},${y0} ${m},${y1} ${x1},${y1} L${x1},${y1 + g} C${m},${y1 + g} ${m},${y0 + g} ${x0},${y0 + g} Z`,
    };
  });
  const activo = (l: Enlace) => !foco || l.de === foco || l.a === foco;

  return (
    <section className={tarjeta} aria-labelledby="titulo-flujo">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="titulo-flujo" className="text-[17px] font-extrabold text-[#0B1220]">
            Por dónde pasan los {miles(flujo.total)} conjuntos
          </h3>
          <p className="mt-1 max-w-[640px] text-[13.5px] leading-relaxed text-[#475569]">
            Del catálogo crudo a la propuesta: cuántos prometen actualizarse, cuántos cumplen y cuántos terminan en la Ventanilla con algo por mejorar. Pasa el
            puntero o toca una caja para seguir su camino.
          </p>
        </div>
      </div>
      <div ref={ref} className="mt-4 overflow-x-auto [scrollbar-width:thin]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[640px]" role="img" aria-label={`Flujo del catálogo: ${flujo.total} conjuntos; ${flujo.conPeriodicidad} con periodicidad y ${flujo.sinPeriodicidad} sin; ${e["al-dia"].n} al día, ${e.atrasado.n} atrasados y ${e.critico.n} críticos; ${flujo.propuestas} con propuesta de mejora.`}>
          <defs>
            {[0, 1, 2].map((c) => (
              <clipPath key={c} id={`revela-${c}`}>
                <rect x={cols[c]} y={0} height={H} width={visible ? cols[c + 1] - cols[c] + ancho : 0} style={{ transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${c * 450}ms` }} />
              </clipPath>
            ))}
          </defs>
          {caminos.map((l, i) => (
            <path
              key={i}
              d={l.d}
              fill={l.color}
              clipPath={`url(#revela-${l.col})`}
              opacity={activo(l) ? (foco ? 0.62 : 0.34) : 0.08}
              style={{ transition: "opacity 250ms" }}
            >
              <title>{`${por[l.de].texto} → ${por[l.a].texto}: ${miles(l.valor)} conjuntos`}</title>
            </path>
          ))}
          {nodos.map((n) => {
            const izq = n.col === 3;
            return (
              <g
                key={n.id}
                onMouseEnter={() => setFoco(n.id)}
                onMouseLeave={() => setFoco(null)}
                onClick={() => setFoco((f) => (f === n.id ? null : n.id))}
                className="cursor-pointer"
                style={{ opacity: visible ? 1 : 0, transition: `opacity 500ms ${n.col * 450}ms` }}
              >
                <rect x={cols[n.col]} y={n.y} width={ancho} height={n.h} rx={4} fill={n.color} />
                <text x={izq ? cols[n.col] - 8 : cols[n.col] + ancho + 8} y={n.y! + n.h! / 2 - 4} textAnchor={izq ? "end" : "start"} fontSize={13} fontWeight={700} fill="#0F172A">
                  {n.texto}
                </text>
                <text x={izq ? cols[n.col] - 8 : cols[n.col] + ancho + 8} y={n.y! + n.h! / 2 + 13} textAnchor={izq ? "end" : "start"} fontSize={14} fontWeight={600} fill={n.color === "#CBD5E1" ? "#475569" : n.color} fontFamily="var(--font-jetbrains), monospace">
                  <Contador valor={n.valor} activo={visible} />
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 font-mono text-[11px] text-[#64748B]">Fuente: catálogo de MEData y reglas de la Ventanilla (src/lib/ventanilla.ts).</p>
    </section>
  );
}

/* ───────────────────── 2. Mapa de calor del abandono ───────────────────── */

const ESCALA = ["#EFF6FF", "#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8", "#1E40AF"];

export function MapaCalor({ calor }: { calor: CalorAbandono }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [sel, setSel] = useState<{ f: number; a: number } | null>(null);
  const ultimo = calor.anios.length - 1;
  const totalUltimo = calor.totalesAnio[ultimo];
  const color = (n: number) => (n === 0 ? "#F8FAFC" : ESCALA[Math.min(ESCALA.length - 1, Math.ceil((n / calor.max) * (ESCALA.length - 1)))]);
  const cols = `minmax(120px,1.6fr) repeat(${calor.anios.length}, minmax(34px,1fr))`;
  const info = sel ? calor.filas[sel.f] : null;

  return (
    <section className={tarjeta} aria-labelledby="titulo-calor">
      <h3 id="titulo-calor" className="text-[17px] font-extrabold text-[#0B1220]">
        Mapa de calor del abandono
      </h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-[#475569]">
        Año de la última actualización de cada conjunto, por secretaría. En {calor.anios[ultimo]} solo se actualizaron{" "}
        <strong className="text-[#B91C1C]">{miles(totalUltimo)}</strong> de los conjuntos del catálogo.
      </p>
      <div ref={ref} className="mt-4 overflow-x-auto [scrollbar-width:thin]">
        <div className="min-w-[480px]" role="table" aria-label="Conjuntos por secretaría y año de última actualización">
          <div className="grid gap-1" style={{ gridTemplateColumns: cols }} role="row">
            <span role="columnheader" className="text-[11px] font-bold text-[#64748B]">
              Secretaría
            </span>
            {calor.anios.map((a, i) => (
              <span key={a} role="columnheader" className={`text-center font-mono text-[11px] font-bold ${i === ultimo ? "text-[#B91C1C]" : "text-[#64748B]"}`}>
                {a}
              </span>
            ))}
          </div>
          {calor.filas.map((f, fi) => (
            <div key={f.publicador} className="mt-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }} role="row">
              <span role="rowheader" className="truncate pr-1 text-[12.5px] text-[#0F172A]" title={`${f.publicador}: ${f.total} conjuntos`}>
                {f.publicador}
              </span>
              {f.porAnio.map((n, ai) => (
                <button
                  key={ai}
                  role="cell"
                  onMouseEnter={() => setSel({ f: fi, a: ai })}
                  onFocus={() => setSel({ f: fi, a: ai })}
                  onClick={() => setSel({ f: fi, a: ai })}
                  aria-label={`${f.publicador}, ${calor.anios[ai]}: ${n} conjuntos`}
                  className={`flex h-7 items-center justify-center rounded-md font-mono text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#0B1220] ${ai === ultimo ? "ring-1 ring-[#FCA5A5]" : ""}`}
                  style={{
                    background: color(n),
                    color: n / calor.max > 0.45 ? "#FFFFFF" : "#1E3A8A",
                    transform: visible ? "scale(1)" : "scale(0.2)",
                    opacity: visible ? 1 : 0,
                    transition: `transform 450ms cubic-bezier(.2,.8,.2,1.2) ${fi * 45 + ai * 35}ms, opacity 300ms ${fi * 45 + ai * 35}ms`,
                  }}
                >
                  {n || "·"}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 min-h-[20px] text-[12.5px] text-[#334155]" aria-live="polite">
        {info && sel ? (
          <>
            <strong>{info.publicador}</strong>: {miles(info.porAnio[sel.a])} de sus {miles(info.total)} conjuntos se actualizaron por última vez en {calor.anios[sel.a]}.
          </>
        ) : (
          "Pasa el puntero o toca una celda para leerla."
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#64748B]">
        <span>menos</span>
        {ESCALA.map((c) => (
          <span key={c} className="h-2.5 w-5 rounded-sm" style={{ background: c }} aria-hidden="true" />
        ))}
        <span>más conjuntos</span>
      </div>
      <p className="mt-2 font-mono text-[11px] text-[#64748B]">Fuente: campo «modified» del catálogo de MEData. Las {calor.filas.length} secretarías con más conjuntos.</p>
    </section>
  );
}

/* ───────────────────── 3. Araña comparativa por secretaría ───────────────────── */

const COLOR_A = "#2563EB";
const COLOR_B = "#7C3AED";

export function AranaSecretarias({ perfiles }: { perfiles: PerfilSecretaria[] }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const nombres = perfiles.map((p) => p.publicador);
  const [a, setA] = useState(nombres[0]);
  const [b, setB] = useState(nombres.includes("Planeación") ? "Planeación" : nombres[1]);
  const pa = perfiles.find((p) => p.publicador === a)!;
  const pb = perfiles.find((p) => p.publicador === b)!;

  // interpolación suave cuando cambia la secretaría elegida
  const objetivo = (p: PerfilSecretaria) => EJES_ARANA.map((e) => (visible ? (p.valores[e.k] ?? 0) : 0));
  const [va, setVa] = useState<number[]>(EJES_ARANA.map(() => 0));
  const [vb, setVb] = useState<number[]>(EJES_ARANA.map(() => 0));
  const desde = useRef<{ a: number[]; b: number[] }>({ a: va, b: vb });
  const metaA = objetivo(pa).join(",");
  const metaB = objetivo(pb).join(",");
  useEffect(() => {
    const ta = metaA.split(",").map(Number);
    const tb = metaB.split(",").map(Number);
    const ia = desde.current.a;
    const ib = desde.current.b;
    let raf = 0;
    let t0 = -1;
    const paso = (t: number) => {
      if (t0 < 0) t0 = t;
      const k = Math.min(1, (t - t0) / 700);
      const s = 1 - Math.pow(1 - k, 3);
      const na = ta.map((v, i) => ia[i] + (v - ia[i]) * s);
      const nb = tb.map((v, i) => ib[i] + (v - ib[i]) * s);
      setVa(na);
      setVb(nb);
      desde.current = { a: na, b: nb };
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [metaA, metaB]);

  const R = 110;
  const C = 160;
  const n = EJES_ARANA.length;
  const punto = (i: number, v: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [C + Math.cos(ang) * R * (v / 100), C + Math.sin(ang) * R * (v / 100)];
  };
  const poli = (vals: number[]) => vals.map((v, i) => punto(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  const valor = (p: PerfilSecretaria, k: EjeArana) => (p.valores[k] == null ? "sin dato" : `${decimal(p.valores[k]!, p.valores[k]! % 1 ? 1 : 0)} %`);

  return (
    <section className={tarjeta} aria-labelledby="titulo-arana">
      <h3 id="titulo-arana" className="text-[17px] font-extrabold text-[#0B1220]">
        Araña de calidad: compara dos secretarías
      </h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-[#475569]">Cinco señales de un dato abierto sano. Más área = mejor publicado.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { v: a, set: setA, c: COLOR_A, id: "arana-a" },
          { v: b, set: setB, c: COLOR_B, id: "arana-b" },
        ].map((s) => (
          <label key={s.id} htmlFor={s.id} className="flex min-w-0 flex-col gap-1 text-[11.5px] font-bold" style={{ color: s.c }}>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.c }} aria-hidden="true" />
              Secretaría
            </span>
            <select
              id={s.id}
              value={s.v}
              onChange={(e) => s.set(e.target.value)}
              className="min-w-0 rounded-lg border border-[#E3EAF3] bg-white px-2 py-2 text-[13px] font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              {nombres.map((nm) => (
                <option key={nm} value={nm}>
                  {nm}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div ref={ref} className="mx-auto mt-2 max-w-[420px]">
        <svg viewBox="-70 -6 460 336" className="h-auto w-full" role="img" aria-label={`Comparación de ${a} y ${b} en ${EJES_ARANA.map((e) => e.t).join(", ")}.`}>
          {[25, 50, 75, 100].map((r) => (
            <polygon key={r} points={poli(EJES_ARANA.map(() => r))} fill={r === 100 ? "#F8FAFC" : "none"} stroke="#E2E8F0" strokeWidth={1} />
          ))}
          {EJES_ARANA.map((e, i) => {
            const [x, y] = punto(i, 100);
            const [lx, ly] = punto(i, 124);
            return (
              <g key={e.k}>
                <line x1={C} y1={C} x2={x} y2={y} stroke="#E2E8F0" />
                <text x={lx} y={ly} textAnchor={Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end"} dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#334155">
                  {e.t}
                </text>
              </g>
            );
          })}
          <polygon points={poli(va)} fill={COLOR_A} fillOpacity={0.22} stroke={COLOR_A} strokeWidth={2.2} strokeLinejoin="round" />
          <polygon points={poli(vb)} fill={COLOR_B} fillOpacity={0.18} stroke={COLOR_B} strokeWidth={2.2} strokeLinejoin="round" strokeDasharray="5 3" />
          {va.map((v, i) => {
            const [x, y] = punto(i, v);
            return <circle key={`a${i}`} cx={x} cy={y} r={3.5} fill={COLOR_A} />;
          })}
          {vb.map((v, i) => {
            const [x, y] = punto(i, v);
            return <circle key={`b${i}`} cx={x} cy={y} r={3.5} fill={COLOR_B} />;
          })}
        </svg>
      </div>
      <table className="mt-2 w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] text-[#64748B]">
            <th className="py-1 font-bold">Señal</th>
            <th className="py-1 text-right font-bold" style={{ color: COLOR_A }}>
              {a}
            </th>
            <th className="py-1 text-right font-bold" style={{ color: COLOR_B }}>
              {b}
            </th>
          </tr>
        </thead>
        <tbody>
          {EJES_ARANA.map((e) => (
            <tr key={e.k} className="border-t border-[#EEF2F7]" title={e.d}>
              <td className="py-1.5 text-[#334155]">{e.t}</td>
              <td className="py-1.5 text-right font-mono font-semibold text-[#0F172A]">{valor(pa, e.k)}</td>
              <td className="py-1.5 text-right font-mono font-semibold text-[#0F172A]">{valor(pb, e.k)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[11px] text-[#64748B]">
        Fuente: catálogo de MEData · {miles(pa.total)} y {miles(pb.total)} conjuntos · secretarías con 5 conjuntos o más.
      </p>
    </section>
  );
}

/** Bloque completo: cómo se ve el problema. */
export default function VisualesAgencia({ visuales }: { visuales: Visuales }) {
  return (
    <section aria-labelledby="titulo-visuales" className="flex flex-col gap-4">
      <div>
        <h2 id="titulo-visuales" className="text-[19px] font-extrabold text-[#0B1220]">
          Cómo se ve el problema
        </h2>
        <p className="mt-0.5 text-[13px] text-[#64748B]">Tres lecturas del mismo catálogo, para entenderlo de un vistazo.</p>
      </div>
      <FlujoSankey flujo={visuales.flujo} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <MapaCalor calor={visuales.calor} />
        <AranaSecretarias perfiles={visuales.perfiles} />
      </div>
    </section>
  );
}
